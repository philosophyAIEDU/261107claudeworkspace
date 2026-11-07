import type { BrowserWindow } from 'electron';
import type { IpcEventMap, IpcEventName } from '../../shared/ipc';
import type { ClaudeCheckResult } from '../../shared/types';
import type { AppStore } from '../store/AppStore';
import type { PtyManager } from '../pty/PtyManager';
import type { FileWatcher } from '../fs/fileWatcher';
import type { SessionSdk } from '../claude/sdk';

/** IPC 처리기들이 함께 쓰는 메인 프로세스 도구 상자 */
export interface MainContext {
  store: AppStore;
  pty: PtyManager | null;
  ptyError?: string;
  fileWatcher: FileWatcher;
  sdk: () => Promise<SessionSdk>;
  projectsDir: string;
  homeDir: string;
  platform: NodeJS.Platform;
  appVersion: string;
  getWindow: () => BrowserWindow | null;
  send: <E extends IpcEventName>(event: E, payload: IpcEventMap[E]) => void;
  /** claude 실행 파일 확인(결과는 잠깐 기억해 둠) */
  checkClaude: (force?: boolean) => Promise<ClaudeCheckResult>;
  getEnv: () => Promise<Record<string, string>>;
  /** 대화 목록 동기화 예약(여러 번 불려도 1초에 한 번만 실제로 실행) */
  scheduleSync: () => void;
  syncNow: () => Promise<{ added: number }>;
  requestQuit: () => void;
}
