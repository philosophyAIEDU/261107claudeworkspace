import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { SessionRecord } from '../../shared/types';
import { UserError } from '../errors';
import { defaultSessionTitle, sanitizeTitle, type ClaudeLaunch } from '../claude/commandBuilder';
import { handle } from './handle';
import { findSession } from './sessions';
import { findWorkspace } from './workspaces';
import type { MainContext } from './context';

function requirePty(ctx: MainContext): NonNullable<MainContext['pty']> {
  if (!ctx.pty) {
    throw new UserError(
      `터미널 기능을 불러오지 못했어요. 앱을 다시 설치해 보세요.${ctx.ptyError ? ` (${ctx.ptyError})` : ''}`,
      'PTY_UNAVAILABLE',
    );
  }
  return ctx.pty;
}

export function registerPtyHandlers(ctx: MainContext): void {
  handle('pty:start', async ({ workspaceId, cols, rows, launch }) => {
    const pty = requirePty(ctx);
    const check = await ctx.checkClaude();
    if (!check.found || !check.path) {
      throw new UserError('Claude Code를 찾을 수 없어요. 처음 화면의 "시작하기 전에 확인해요"에서 설치 상태를 확인해 주세요.', 'NO_CLAUDE');
    }

    let sessionId: string;
    let title: string;
    let claudeLaunch: ClaudeLaunch;
    let wsId = workspaceId;
    const now = new Date().toISOString();
    let newRecord: SessionRecord | null = null;

    if (launch.kind === 'new') {
      // 새 대화: 세션 ID를 앱이 먼저 만들고 곧바로 기록한다(화면 출력에서 ID를 긁어 오지 않음).
      sessionId = randomUUID();
      title = sanitizeTitle(launch.title || defaultSessionTitle());
      claudeLaunch = { kind: 'new', sessionId, title, model: launch.model, permissionMode: launch.permissionMode };
      newRecord = { sessionId, workspaceId: wsId, title, hidden: false, source: 'app', createdAt: now, lastActiveAt: now };
    } else {
      const rec = findSession(ctx, launch.sessionId);
      // 이어서 하기·갈라서 이어 하기는 화면이 보낸 폴더가 아니라 "그 대화가 기록된 폴더"에서 실행한다.
      wsId = rec.workspaceId;
      if (launch.kind === 'resume') {
        const open = pty.findTabBySession(rec.sessionId);
        if (open && open.running) return { tab: open };
        if (open) pty.close(open.tabId);
        sessionId = rec.sessionId;
        title = rec.title;
        claudeLaunch = { kind: 'resume', sessionId };
        // 앱에서 시작만 하고 한 마디도 안 한 대화는 기록 파일이 없어 --resume이 실패한다.
        // 그때는 같은 ID로 새로 시작하면 된다.
        if (rec.source === 'app') {
          const ws = findWorkspace(ctx, wsId);
          const info = await ctx
            .sdk()
            .then((sdk) => sdk.getSessionInfo(sessionId, { dir: ws.path }))
            .catch(() => 'unknown' as const);
          if (info === undefined) claudeLaunch = { kind: 'new', sessionId, title };
        }
      } else {
        sessionId = randomUUID();
        title = sanitizeTitle(`${rec.title} (갈라진 대화)`);
        claudeLaunch = { kind: 'fork', sessionId: rec.sessionId, newSessionId: sessionId };
        newRecord = { sessionId, workspaceId: wsId, title, hidden: false, source: 'app', createdAt: now, lastActiveAt: now, firstPrompt: rec.firstPrompt };
      }
    }

    const ws = findWorkspace(ctx, wsId);
    if (!existsSync(ws.path)) {
      throw new UserError('작업 폴더를 찾을 수 없어요. 처음 화면에서 [새 위치 지정]을 눌러 주세요.', 'WS_MISSING');
    }

    // 실행하기 전에 먼저 기록해 둔다. (앱이 갑자기 꺼져도 "이 대화 = 이 폴더"가 남도록)
    await ctx.store.update((d) => {
      if (newRecord) d.sessions.push(newRecord);
      const s = d.sessions.find((x) => x.sessionId === sessionId);
      if (s) {
        s.lastActiveAt = now;
        s.hidden = false;
      }
      const w = d.workspaces.find((x) => x.id === ws.id);
      if (w) w.lastOpenedAt = now;
      d.ui.lastWorkspaceId = ws.id;
    });
    const tabId = randomUUID();
    const tab = pty.start({
      tabId,
      workspaceId: ws.id,
      workspacePath: ws.path,
      sessionId,
      title,
      launch: claudeLaunch,
      claudePath: check.path,
      cols,
      rows,
      env: await ctx.getEnv(),
    });

    ctx.send('sessions:changed', undefined);
    ctx.send('workspaces:changed', undefined);
    return { tab };
  });

  handle('pty:write', ({ tabId, data }) => requirePty(ctx).write(tabId, data));
  handle('pty:resize', ({ tabId, cols, rows }) => requirePty(ctx).resize(tabId, cols, rows));
  handle('pty:kill', ({ tabId }) => requirePty(ctx).kill(tabId));
  handle('pty:close', ({ tabId }) => {
    requirePty(ctx).close(tabId);
    // 대화 탭을 닫을 때 동기화 (마지막 활동 시각·제목 갱신)
    ctx.scheduleSync();
    ctx.send('sessions:changed', undefined);
  });
  handle('pty:list', () => ctx.pty?.list() ?? []);
  handle('pty:buffer', ({ tabId }) => ctx.pty?.getBuffer(tabId) ?? '');
}
