import os from 'node:os';
import path from 'node:path';
import { dialog, shell } from 'electron';
import { UserError } from '../errors';
import { addDirToUserPath } from '../env/pathFix';
import { invalidateShellEnv } from '../env/shellEnv';
import { checkClaude } from '../claude/claudeLocator';
import { handle } from './handle';
import type { MainContext } from './context';
import { makeLocatorDeps } from '../claude/locatorDeps';

export function registerSettingsHandlers(ctx: MainContext, dataResetNotice: () => boolean): void {
  handle('app:getInfo', () => ({
    platform: ctx.platform,
    appVersion: ctx.appVersion,
    homeDir: ctx.homeDir,
    dataResetNotice: dataResetNotice(),
    ptyAvailable: ctx.pty !== null,
    ptyError: ctx.ptyError,
  }));
  handle('app:quit', () => ctx.requestQuit());
  handle('app:cancelQuit', () => undefined);

  handle('setup:checkClaude', () => ctx.checkClaude(true));

  // 공식 설치 명령을 앱 안의 터미널에서 실행한다.
  // - Windows: 64비트 Windows PowerShell을 경로로 직접 지정한다(32비트 "PowerShell (x86)"에서는 설치가 실패함).
  //   -ExecutionPolicy Bypass는 이 한 번의 실행에만 적용되어, 학교·회사 PC의 스크립트 차단 정책에 막히지 않는다.
  //   -NoProfile로 사용자 프로필 스크립트의 간섭도 막는다.
  // - macOS·Linux: 로그인 셸(bash -l)로 실행해 평소 터미널과 같은 환경에서 설치한다.
  handle('setup:runInstaller', async ({ tabId, cols, rows }) => {
    if (!ctx.pty) throw new UserError('터미널 기능을 불러오지 못해 설치를 실행할 수 없어요.', 'PTY_UNAVAILABLE');
    const isWin = ctx.platform === 'win32';
    const command = isWin ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash';
    const file = isWin
      ? path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : '/bin/bash';
    const args = isWin ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command] : ['-lc', command];
    invalidateShellEnv();
    ctx.pty.startCommand({ tabId, title: 'Claude Code 설치', file, args, cwd: os.homedir(), cols, rows, env: await ctx.getEnv() });
    return { tabId, command };
  });

  // claude 폴더를 "저장된 PATH"에 등록한다 → 안티그래비티 같은 다른 프로그램의 터미널에서도 claude를 쓸 수 있게.
  handle('setup:fixPath', async () => {
    const check = await ctx.checkClaude(true);
    if (!check.found || !check.dir) throw new UserError('먼저 Claude Code를 설치해 주세요.', 'NO_CLAUDE');
    const result = await addDirToUserPath(check.dir, ctx.platform, os.homedir(), process.env.SHELL);
    invalidateShellEnv();
    await ctx.checkClaude(true);
    return result;
  });

  handle('setup:pickClaudePath', async () => {
    const win = ctx.getWindow();
    const opts = {
      title: 'claude 실행 파일 고르기',
      properties: ['openFile'] as Array<'openFile'>,
      filters: ctx.platform === 'win32' ? [{ name: '실행 파일', extensions: ['exe', 'cmd', 'bat'] }] : undefined,
    };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    const picked = res.filePaths[0];
    if (res.canceled || !picked) return null;
    const result = await checkClaude(await makeLocatorDeps(ctx), picked);
    if (result.found) {
      await ctx.store.update((d) => {
        d.settings.claudePath = picked;
      });
      await ctx.checkClaude(true);
    }
    return result;
  });

  handle('settings:get', () => ctx.store.get().settings);
  handle('settings:update', async (patch) => {
    const data = await ctx.store.update((d) => {
      d.settings = { ...d.settings, ...patch };
      if (patch.claudePath === '') d.settings.claudePath = undefined;
      if (patch.externalIdePath === '') d.settings.externalIdePath = undefined;
    });
    if ('claudePath' in patch) await ctx.checkClaude(true);
    return data.settings;
  });
  handle('settings:pickFolder', async () => {
    const win = ctx.getWindow();
    const opts = { title: '폴더 고르기', properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });
  handle('settings:pickFile', async () => {
    const win = ctx.getWindow();
    const opts = {
      title: '프로그램 고르기',
      defaultPath: ctx.platform === 'darwin' ? '/Applications' : undefined,
      properties: ['openFile'] as Array<'openFile'>,
    };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });

  handle('ui:get', () => ctx.store.get().ui);
  handle('ui:update', async (patch) => {
    const data = await ctx.store.update((d) => {
      d.ui = { ...d.ui, ...patch };
    });
    return data.ui;
  });

  // 외부 링크는 앱 창이 아니라 기본 브라우저에서 연다(https만 허용 — 스키마에서 검사).
  handle('shell:openExternal', async ({ url }) => {
    await shell.openExternal(url);
  });

}
