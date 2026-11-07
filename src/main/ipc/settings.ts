import { dialog, shell } from 'electron';
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
