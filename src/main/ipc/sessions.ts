import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import type { HistoryResult, SearchHit, SessionRecord, SessionView } from '../../shared/types';
import { UserError } from '../errors';
import { groupImportCandidates, mergeSessions } from '../claude/sessionIndex';
import { historyPlainText, historyToMarkdown, normalizeMessages, readTranscriptDirect } from '../claude/transcriptReader';
import { handle } from './handle';
import { addWorkspaceTo, findWorkspace } from './workspaces';
import type { MainContext } from './context';

export function findSession(ctx: MainContext, sessionId: string): SessionRecord {
  const s = ctx.store.get().sessions.find((x) => x.sessionId === sessionId);
  if (!s) throw new UserError('대화를 찾을 수 없어요. 목록을 새로 고쳐 보세요.', 'SESSION_NOT_FOUND');
  return s;
}

/** SDK로 모든 대화를 찾아 앱 목록에 합친다. 앱 밖(다른 IDE 터미널)에서 만든 대화도 포함된다. */
export async function syncSessions(ctx: MainContext): Promise<{ added: number }> {
  const sdk = await ctx.sdk();
  const infos = await sdk.listSessions();
  const before = ctx.store.get();
  const merged = mergeSessions(before.sessions, infos, before.workspaces, ctx.platform);
  const changed = JSON.stringify(merged.sessions) !== JSON.stringify(before.sessions);
  if (changed) {
    await ctx.store.update((d) => {
      d.sessions = merged.sessions;
    });
    ctx.send('sessions:changed', undefined);
    ctx.send('workspaces:changed', undefined);
  }
  return { added: merged.added };
}

const historyCache = new Map<string, { key: string; result: HistoryResult }>();

export async function readHistory(ctx: MainContext, rec: SessionRecord): Promise<HistoryResult> {
  const ws = ctx.store.get().workspaces.find((w) => w.id === rec.workspaceId);
  const cacheKey = rec.lastActiveAt;
  const cached = historyCache.get(rec.sessionId);
  if (cached && cached.key === cacheKey) return cached.result;
  let result: HistoryResult;
  try {
    const sdk = await ctx.sdk();
    let messages = await sdk.getSessionMessages(rec.sessionId, { dir: ws?.path, includeSystemMessages: true });
    // 폴더가 옮겨졌으면 해당 폴더 기준으로는 못 찾을 수 있어 전체에서 다시 찾는다.
    if (messages.length === 0 && ws) messages = await sdk.getSessionMessages(rec.sessionId, { includeSystemMessages: true });
    result = normalizeMessages(messages);
  } catch (err) {
    console.warn('[history] SDK로 읽기 실패, 직접 읽기로 바꿉니다:', err);
    result = await readTranscriptDirect(ctx.projectsDir, rec.sessionId);
  }
  historyCache.set(rec.sessionId, { key: cacheKey, result });
  return result;
}

function snippetAround(text: string, query: string): string {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text.slice(0, 80);
  const start = Math.max(0, i - 30);
  const end = Math.min(text.length, i + query.length + 50);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
}

export function registerSessionHandlers(ctx: MainContext): void {
  handle('sessions:list', ({ workspaceId, includeHidden }) => {
    const data = ctx.store.get();
    const list: SessionView[] = data.sessions
      .filter((s) => (!workspaceId || s.workspaceId === workspaceId) && (includeHidden || !s.hidden))
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
      .map((s) => ({ ...s, open: ctx.pty?.isSessionOpen(s.sessionId) ?? false }));
    return list;
  });

  handle('sessions:sync', () => ctx.syncNow());

  handle('sessions:importScan', async () => {
    const sdk = await ctx.sdk();
    const infos = await sdk.listSessions();
    const data = ctx.store.get();
    const merged = mergeSessions(data.sessions, infos, data.workspaces, ctx.platform);
    return groupImportCandidates(merged.unmatched, merged.noCwd, (p) => existsSync(p), ctx.platform);
  });

  handle('sessions:importApply', async ({ paths }) => {
    let addedWorkspaces = 0;
    await ctx.store.update((d) => {
      for (const p of paths) {
        if (!existsSync(p)) continue;
        const before = d.workspaces.length;
        addWorkspaceTo(d, p, ctx.platform);
        if (d.workspaces.length > before) addedWorkspaces++;
      }
    });
    const { added } = await ctx.syncNow();
    ctx.send('workspaces:changed', undefined);
    return { addedWorkspaces, addedSessions: added };
  });

  handle('sessions:rename', async ({ sessionId, title }) => {
    const rec = findSession(ctx, sessionId);
    await ctx.store.update((d) => {
      const s = d.sessions.find((x) => x.sessionId === sessionId)!;
      s.title = title.trim();
    });
    // Claude Code 쪽 이름(/resume 목록에 보이는 이름)도 맞춰 둔다. 기록 파일이 아직 없으면 실패할 수 있어 무시.
    const ws = ctx.store.get().workspaces.find((w) => w.id === rec.workspaceId);
    try {
      const sdk = await ctx.sdk();
      await sdk.renameSession(sessionId, title.trim(), { dir: ws?.path });
    } catch {
      // 무시
    }
    ctx.send('sessions:changed', undefined);
  });

  handle('sessions:update', async ({ sessionId, patch }) => {
    findSession(ctx, sessionId);
    await ctx.store.update((d) => {
      const s = d.sessions.find((x) => x.sessionId === sessionId)!;
      if (patch.memo !== undefined) s.memo = patch.memo.trim() || undefined;
      if (patch.hidden !== undefined) s.hidden = patch.hidden;
    });
    ctx.send('sessions:changed', undefined);
    ctx.send('workspaces:changed', undefined);
  });

  // 실제 기록 파일 삭제 (되돌릴 수 없음). 화면에서 2단계 확인을 거친 뒤에만 부른다.
  handle('sessions:deleteFile', async ({ sessionId }) => {
    const rec = findSession(ctx, sessionId);
    if (ctx.pty?.isSessionOpen(sessionId)) throw new UserError('열려 있는 대화는 지울 수 없어요. 먼저 대화 탭을 닫아 주세요.', 'OPEN');
    const ws = ctx.store.get().workspaces.find((w) => w.id === rec.workspaceId);
    try {
      const sdk = await ctx.sdk();
      await sdk.deleteSession(sessionId, { dir: ws?.path });
    } catch (err) {
      // 기록 파일이 처음부터 없었던 경우(한 마디도 안 한 대화)는 목록에서만 지우면 된다.
      if (!/not found/i.test(String(err))) throw new UserError('기록 파일을 지우지 못했어요. 잠시 후 다시 해 보세요.', 'DELETE_FAILED');
    }
    historyCache.delete(sessionId);
    await ctx.store.update((d) => {
      d.sessions = d.sessions.filter((s) => s.sessionId !== sessionId);
    });
    ctx.send('sessions:changed', undefined);
    ctx.send('workspaces:changed', undefined);
  });

  handle('sessions:history', async ({ sessionId }) => {
    const rec = findSession(ctx, sessionId);
    const result = await readHistory(ctx, rec);
    const count = result.items.filter((i) => i.kind === 'user' || i.kind === 'assistant').length;
    if (result.found && rec.messageCount !== count) {
      await ctx.store.update((d) => {
        const s = d.sessions.find((x) => x.sessionId === sessionId);
        if (s) s.messageCount = count;
      });
    }
    return result;
  });

  handle('sessions:search', async ({ query }) => {
    const q = query.toLowerCase();
    const data = ctx.store.get();
    const wsById = new Map(data.workspaces.map((w) => [w.id, w]));
    const hits: SearchHit[] = [];
    const seen = new Set<string>();
    const folderName = (id: string): string => {
      const w = wsById.get(id);
      return w ? w.alias || path.basename(w.path) : '';
    };
    const sessions = data.sessions.filter((s) => !s.hidden).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    for (const s of sessions) {
      const base = { sessionId: s.sessionId, workspaceId: s.workspaceId, title: s.title, folderName: folderName(s.workspaceId) };
      if (s.title.toLowerCase().includes(q)) hits.push({ ...base, where: 'title', snippet: s.title });
      else if (s.memo?.toLowerCase().includes(q)) hits.push({ ...base, where: 'memo', snippet: snippetAround(s.memo, query) });
      else if (base.folderName.toLowerCase().includes(q) || wsById.get(s.workspaceId)?.memo?.toLowerCase().includes(q)) {
        hits.push({ ...base, where: 'folder', snippet: base.folderName });
      } else continue;
      seen.add(s.sessionId);
    }
    // 메시지 본문 검색 (최근 대화부터, 결과가 너무 많으면 멈춤)
    for (const s of sessions) {
      if (hits.length >= 100) break;
      if (seen.has(s.sessionId)) continue;
      const result = await readHistory(ctx, s).catch(() => null);
      if (!result) continue;
      const text = historyPlainText(result);
      if (text.toLowerCase().includes(q)) {
        hits.push({
          sessionId: s.sessionId,
          workspaceId: s.workspaceId,
          title: s.title,
          folderName: folderName(s.workspaceId),
          where: 'message',
          snippet: snippetAround(text, query),
        });
      }
    }
    return hits;
  });

  handle('sessions:exportMarkdown', async ({ sessionId }) => {
    const rec = findSession(ctx, sessionId);
    const ws = findWorkspace(ctx, rec.workspaceId);
    const result = await readHistory(ctx, rec);
    const safeName = rec.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || '대화';
    const win = ctx.getWindow();
    const opts = {
      title: '대화 기록 내보내기',
      defaultPath: path.join(app.getPath('documents'), `${safeName}.md`),
      filters: [{ name: 'Markdown 문서', extensions: ['md'] }],
    };
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return null;
    await fs.writeFile(res.filePath, historyToMarkdown(rec.title, ws.path, result), 'utf8');
    return res.filePath;
  });
}
