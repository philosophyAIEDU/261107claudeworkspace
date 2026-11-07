import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, screen, session, shell, type IpcMainInvokeEvent } from 'electron';
import type { IpcEventMap, IpcEventName } from '../shared/ipc';
import type { ClaudeCheckResult } from '../shared/types';
import { AppStore } from './store/AppStore';
import { PtyManager, type PtySpawnFn } from './pty/PtyManager';
import { FileWatcher } from './fs/fileWatcher';
import { loadSessionSdk } from './claude/sdk';
import { checkClaude } from './claude/claudeLocator';
import { makeLocatorDeps } from './claude/locatorDeps';
import { ClaudeProjectsWatcher, debounce } from './claude/claudeWatcher';
import { getShellEnv } from './env/shellEnv';
import { installIpcRouter } from './ipc/handle';
import type { MainContext } from './ipc/context';
import { registerWorkspaceHandlers, refreshMissing } from './ipc/workspaces';
import { registerSessionHandlers, syncSessions } from './ipc/sessions';
import { registerPtyHandlers } from './ipc/pty';
import { registerFileHandlers } from './ipc/files';
import { registerSettingsHandlers } from './ipc/settings';
import { installKoreanMenu } from './menu';

const isMac = process.platform === 'darwin';
const DEV_URL = process.env.ELECTRON_RENDERER_URL;

app.setName('필로소피 Claude 작업실');
// 앱 데이터 위치를 고정한다. (Windows: %APPDATA%\필로소피 Claude 작업실, macOS: ~/Library/Application Support/필로소피 Claude 작업실)
app.setPath('userData', path.join(app.getPath('appData'), '필로소피 Claude 작업실'));

// 두 번 실행하면 이미 열린 창을 앞으로 가져온다(같은 데이터 파일을 두 앱이 동시에 쓰지 않게).
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let quitting = false;

function loadPty(): { spawn: PtySpawnFn | null; error?: string } {
  try {
    // node-pty는 네이티브 모듈이라 번들하지 않고 실행할 때 불러온다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePty = require('node-pty') as typeof import('node-pty');
    const spawn: PtySpawnFn = (file, args, options) => nodePty.spawn(file, args, options);
    return { spawn };
  } catch (err) {
    console.error('[pty] node-pty를 불러오지 못했어요:', err);
    return { spawn: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function send<E extends IpcEventName>(event: E, payload: IpcEventMap[E]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(`event:${event}`, payload);
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) return false;
  const url = event.senderFrame?.url ?? '';
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
}

function restoreBounds(store: AppStore): { x?: number; y?: number; width: number; height: number; maximized: boolean } {
  const saved = store.get().ui.window;
  const fallback = { width: 1360, height: 860 };
  const area = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(saved?.width ?? fallback.width, area.width);
  const height = Math.min(saved?.height ?? fallback.height, area.height);
  let x = saved?.x;
  let y = saved?.y;
  // 저장된 위치가 지금 연결된 모니터 밖이면(모니터를 뺀 경우) 가운데에 띄운다.
  if (x !== undefined && y !== undefined) {
    const visible = screen.getAllDisplays().some((d) => {
      const b = d.workArea;
      return x! >= b.x - 50 && y! >= b.y - 50 && x! < b.x + b.width - 100 && y! < b.y + b.height - 100;
    });
    if (!visible) x = y = undefined;
  }
  return { x, y, width, height, maximized: saved?.maximized ?? false };
}

async function main(): Promise<void> {
  await app.whenReady();

  const homeDir = os.homedir();
  const defaultParent = path.join(app.getPath('documents'), '필로소피 Claude 작업실');
  const store = await AppStore.open(path.join(app.getPath('userData'), 'app-data.json'), defaultParent);
  let dataResetNotice = store.outcome === 'reset' || store.outcome === 'restoredFromBackup';

  const ptyLoad = loadPty();
  const pty = ptyLoad.spawn ? new PtyManager(ptyLoad.spawn) : null;
  const fileWatcher = new FileWatcher((e) => send('files:changed', e));
  const projectsDir = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(homeDir, '.claude'), 'projects');

  let claudeCache: { at: number; result: ClaudeCheckResult } | null = null;
  let syncing: Promise<{ added: number }> | null = null;

  const ctx: MainContext = {
    store,
    pty,
    ptyError: ptyLoad.error,
    fileWatcher,
    sdk: loadSessionSdk,
    projectsDir,
    homeDir,
    platform: process.platform,
    appVersion: app.getVersion(),
    getWindow: () => mainWindow,
    send,
    getEnv: getShellEnv,
    checkClaude: async (force = false) => {
      if (!force && claudeCache && Date.now() - claudeCache.at < 60_000 && claudeCache.result.found) return claudeCache.result;
      const deps = await makeLocatorDeps(ctx);
      const result = await checkClaude(deps, store.get().settings.claudePath);
      claudeCache = { at: Date.now(), result };
      return result;
    },
    syncNow: () => {
      if (!syncing) {
        syncing = syncSessions(ctx)
          .catch((err) => {
            console.warn('[sync] 대화 목록 동기화 실패:', err);
            return { added: 0 };
          })
          .finally(() => {
            syncing = null;
          });
      }
      return syncing;
    },
    scheduleSync: () => scheduled(),
    requestQuit: () => {
      quitting = true;
      pty?.disposeAll();
      app.quit();
    },
  };
  const scheduled = debounce(() => void ctx.syncNow(), 1000);

  installIpcRouter(isTrustedSender);
  registerSettingsHandlers(ctx, () => {
    const v = dataResetNotice;
    dataResetNotice = false; // 안내는 한 번만
    return v;
  });
  registerWorkspaceHandlers(ctx);
  registerSessionHandlers(ctx);
  registerPtyHandlers(ctx);
  registerFileHandlers(ctx);

  // PTY 출력은 아주 잘게 쪼개져 오므로 조금씩 모아서(16ms) 화면에 보낸다.
  if (pty) {
    const pending = new Map<string, string>();
    let timer: NodeJS.Timeout | null = null;
    pty.onData((tabId, data) => {
      pending.set(tabId, (pending.get(tabId) ?? '') + data);
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          for (const [id, chunk] of pending) send('pty:data', { tabId: id, data: chunk });
          pending.clear();
        }, 16);
      }
    });
    pty.onExit((tabId, exitCode, signal) => {
      const chunk = pending.get(tabId);
      if (chunk) {
        send('pty:data', { tabId, data: chunk });
        pending.delete(tabId);
      }
      send('pty:exit', { tabId, exitCode, signal });
      ctx.scheduleSync();
    });
  }

  // ───── 보안 설정 ─────
  // 카메라·마이크·위치 등 권한 요청은 모두 거절한다.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (ev) => ev.preventDefault());
    // 새 창은 열지 않고, https 링크만 기본 브라우저로 연다.
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    // 앱 창 안에서 다른 페이지로 이동하지 못하게 막는다.
    contents.on('will-navigate', (ev, url) => {
      const allowed = DEV_URL ? url.startsWith(DEV_URL) : false;
      if (!allowed) {
        ev.preventDefault();
        if (url.startsWith('https://')) void shell.openExternal(url);
      }
    });
  });

  installKoreanMenu(isMac);

  const createWindow = (): void => {
    const b = restoreBounds(store);
    mainWindow = new BrowserWindow({
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      minWidth: 900,
      minHeight: 600,
      show: false,
      title: '필로소피 Claude 작업실',
      backgroundColor: '#1b1d23',
      autoHideMenuBar: !isMac,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
      },
    });
    if (b.maximized) mainWindow.maximize();
    mainWindow.once('ready-to-show', () => mainWindow?.show());

    const saveBounds = debounce(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const nb = mainWindow.getNormalBounds();
      void store.update((d) => {
        d.ui.window = { x: nb.x, y: nb.y, width: nb.width, height: nb.height, maximized: mainWindow!.isMaximized() };
      });
    }, 800);
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);
    mainWindow.on('maximize', saveBounds);
    mainWindow.on('unmaximize', saveBounds);

    // 열린 대화가 있으면 바로 닫지 않고 화면에 확인 창을 띄운다.
    mainWindow.on('close', (ev) => {
      if (quitting) return;
      const running = pty?.runningCount() ?? 0;
      if (running > 0) {
        ev.preventDefault();
        send('app:closeRequested', { openTabs: running });
      }
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    if (DEV_URL) void mainWindow.loadURL(DEV_URL);
    else void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  };

  createWindow();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
  app.on('before-quit', (ev) => {
    if (quitting) return;
    const running = pty?.runningCount() ?? 0;
    if (running > 0 && mainWindow) {
      ev.preventDefault();
      send('app:closeRequested', { openTabs: running });
      return;
    }
    quitting = true;
    pty?.disposeAll();
  });
  app.on('will-quit', () => {
    void fileWatcher.stop();
    void claudeWatcher.stop();
  });

  // 시작할 때 동기화하고, 기록 폴더를 감시해 자동으로 새로 고친다.
  const claudeWatcher = new ClaudeProjectsWatcher(projectsDir, () => ctx.scheduleSync());
  void claudeWatcher.start();
  void refreshMissing(ctx).catch(() => undefined);
  void ctx.syncNow();
}

void main();
