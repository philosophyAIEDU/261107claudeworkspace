import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dialog } from 'electron';
import type { AppData, SessionRecord, Workspace, WorkspaceView } from '../../shared/types';
import { UserError } from '../errors';
import { assertValidName } from '../fs/fileService';
import { normalizePath, samePath } from '../fs/pathGuard';
import { handle } from './handle';
import type { MainContext } from './context';

/** 화면용 작업 폴더 카드 정보 계산 (순수 함수) */
export function computeWorkspaceViews(data: Pick<AppData, 'workspaces' | 'sessions'>): WorkspaceView[] {
  const byWs = new Map<string, SessionRecord[]>();
  for (const s of data.sessions) {
    if (s.hidden) continue;
    const list = byWs.get(s.workspaceId) ?? [];
    list.push(s);
    byWs.set(s.workspaceId, list);
  }
  return data.workspaces.map((w) => {
    const list = (byWs.get(w.id) ?? []).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    const last = list[0];
    const lastActiveAt = last && last.lastActiveAt > w.lastOpenedAt ? last.lastActiveAt : w.lastOpenedAt;
    return { ...w, sessionCount: list.length, lastActiveAt, lastSessionTitle: last?.title, lastSessionId: last?.sessionId };
  });
}

/** 같은 폴더가 이미 있으면 그것을, 없으면 새로 추가한 것을 돌려준다. */
export function addWorkspaceTo(draft: AppData, folderPath: string, platform: NodeJS.Platform, now = new Date()): Workspace {
  const normalized = normalizePath(folderPath, platform);
  const found = draft.workspaces.find((w) => samePath(w.path, normalized, platform));
  if (found) {
    found.lastOpenedAt = now.toISOString();
    found.missing = false;
    return found;
  }
  const ws: Workspace = { id: randomUUID(), path: normalized, pinned: false, lastOpenedAt: now.toISOString() };
  draft.workspaces.push(ws);
  return ws;
}

export async function addWorkspace(ctx: MainContext, folderPath: string): Promise<Workspace> {
  let result: Workspace | undefined;
  await ctx.store.update((d) => {
    result = { ...addWorkspaceTo(d, folderPath, ctx.platform) };
  });
  ctx.send('workspaces:changed', undefined);
  return result!;
}

export function findWorkspace(ctx: MainContext, id: string): Workspace {
  const ws = ctx.store.get().workspaces.find((w) => w.id === id);
  if (!ws) throw new UserError('작업 폴더를 찾을 수 없어요. 목록을 새로 고쳐 보세요.', 'WS_NOT_FOUND');
  return ws;
}

export function registerWorkspaceHandlers(ctx: MainContext): void {
  handle('workspaces:list', () => computeWorkspaceViews(ctx.store.get()));

  handle('workspaces:pickAndAdd', async () => {
    const win = ctx.getWindow();
    const opts = { title: '작업 폴더 고르기', properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    const picked = res.filePaths[0];
    if (res.canceled || !picked) return null;
    const ws = await addWorkspace(ctx, picked);
    ctx.scheduleSync();
    return ws;
  });

  handle('workspaces:createNew', async ({ name }) => {
    assertValidName(name);
    const parent = ctx.store.get().settings.defaultParentFolder;
    await fs.mkdir(parent, { recursive: true });
    const target = path.join(parent, name.trim());
    if (existsSync(target)) throw new UserError('같은 이름의 폴더가 이미 있어요. 다른 이름을 써 주세요.', 'EXISTS');
    await fs.mkdir(target);
    return addWorkspace(ctx, target);
  });

  handle('workspaces:update', async ({ id, patch }) => {
    findWorkspace(ctx, id);
    let updated: Workspace | undefined;
    await ctx.store.update((d) => {
      const w = d.workspaces.find((x) => x.id === id)!;
      if (patch.alias !== undefined) w.alias = patch.alias.trim() || undefined;
      if (patch.memo !== undefined) w.memo = patch.memo.trim() || undefined;
      if (patch.color !== undefined) w.color = patch.color || undefined;
      if (patch.pinned !== undefined) w.pinned = patch.pinned;
      updated = { ...w };
    });
    ctx.send('workspaces:changed', undefined);
    return updated!;
  });

  // 목록에서 빼기: 실제 폴더와 Claude 기록은 건드리지 않는다.
  handle('workspaces:remove', async ({ id }) => {
    await ctx.store.update((d) => {
      d.workspaces = d.workspaces.filter((w) => w.id !== id);
      d.sessions = d.sessions.filter((s) => s.workspaceId !== id);
      if (d.ui.lastWorkspaceId === id) d.ui.lastWorkspaceId = undefined;
    });
    ctx.send('workspaces:changed', undefined);
    ctx.send('sessions:changed', undefined);
  });

  // 폴더가 옮겨졌을 때 새 위치 지정. 대화 연결(workspaceId)은 그대로 유지된다.
  handle('workspaces:relocate', async ({ id }) => {
    findWorkspace(ctx, id);
    const win = ctx.getWindow();
    const opts = { title: '폴더의 새 위치 고르기', properties: ['openDirectory'] as Array<'openDirectory'> };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    const picked = res.filePaths[0];
    if (res.canceled || !picked) return null;
    const normalized = normalizePath(picked, ctx.platform);
    const dup = ctx.store.get().workspaces.find((w) => w.id !== id && samePath(w.path, normalized, ctx.platform));
    if (dup) throw new UserError('그 폴더는 이미 목록에 있어요.', 'EXISTS');
    let updated: Workspace | undefined;
    await ctx.store.update((d) => {
      const w = d.workspaces.find((x) => x.id === id)!;
      w.path = normalized;
      w.missing = false;
      updated = { ...w };
    });
    ctx.send('workspaces:changed', undefined);
    ctx.scheduleSync();
    return updated!;
  });

  handle('workspaces:touch', async ({ id }) => {
    findWorkspace(ctx, id);
    await ctx.store.update((d) => {
      const w = d.workspaces.find((x) => x.id === id)!;
      w.lastOpenedAt = new Date().toISOString();
      d.ui.lastWorkspaceId = id;
    });
  });

  handle('workspaces:refreshMissing', async () => {
    await refreshMissing(ctx);
  });
}

export async function refreshMissing(ctx: MainContext): Promise<void> {
  const current = ctx.store.get().workspaces;
  const states = await Promise.all(current.map((w) => fs.stat(w.path).then((s) => s.isDirectory(), () => false)));
  if (current.every((w, i) => Boolean(w.missing) === !states[i])) return;
  await ctx.store.update((d) => {
    d.workspaces.forEach((w) => {
      const i = current.findIndex((c) => c.id === w.id);
      if (i >= 0) w.missing = !states[i] || undefined;
    });
  });
  ctx.send('workspaces:changed', undefined);
}
