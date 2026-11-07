import type { z } from 'zod';
import type { ipcRequestSchemas, IpcChannel } from './schemas';
import type {
  AppInfo,
  AppSettings,
  ClaudeCheckResult,
  FileChangeEvent,
  FileEntry,
  FileReadResult,
  HistoryResult,
  ImportScanResult,
  InstallerStartResult,
  PathFixResult,
  PtyStartResult,
  PtyTabInfo,
  SearchHit,
  SessionView,
  UiState,
  Workspace,
  WorkspaceView,
} from './types';

// IPC 채널 이름·요청·응답 타입을 한곳에 모은다.
// 요청 모양은 schemas.ts의 zod 스키마에서 그대로 끌어오므로 둘이 어긋날 수 없다.

export type IpcRequest<C extends IpcChannel> = z.input<(typeof ipcRequestSchemas)[C]>;

export interface IpcResponseMap {
  'app:getInfo': AppInfo;
  'app:quit': void;
  'app:cancelQuit': void;
  'setup:checkClaude': ClaudeCheckResult;
  'setup:pickClaudePath': ClaudeCheckResult | null;
  'setup:runInstaller': InstallerStartResult;
  'setup:fixPath': PathFixResult;
  'settings:get': AppSettings;
  'settings:update': AppSettings;
  'settings:pickFolder': string | null;
  'settings:pickFile': string | null;
  'ui:get': UiState;
  'ui:update': UiState;
  'workspaces:list': WorkspaceView[];
  'workspaces:pickAndAdd': Workspace | null;
  'workspaces:createNew': Workspace;
  'workspaces:update': Workspace;
  'workspaces:remove': void;
  'workspaces:relocate': Workspace | null;
  'workspaces:touch': void;
  'workspaces:refreshMissing': void;
  'sessions:list': SessionView[];
  'sessions:sync': { added: number };
  'sessions:importScan': ImportScanResult;
  'sessions:importApply': { addedWorkspaces: number; addedSessions: number };
  'sessions:rename': void;
  'sessions:update': void;
  'sessions:deleteFile': void;
  'sessions:history': HistoryResult;
  'sessions:search': SearchHit[];
  'sessions:exportMarkdown': string | null;
  'pty:start': PtyStartResult;
  'pty:write': void;
  'pty:resize': void;
  'pty:kill': void;
  'pty:close': void;
  'pty:list': PtyTabInfo[];
  'pty:buffer': string;
  'files:tree': FileEntry[];
  'files:read': FileReadResult;
  'files:write': void;
  'files:create': void;
  'files:rename': void;
  'files:trash': void;
  'files:reveal': void;
  'files:openInIde': void;
  'files:watch': void;
  'shell:openExternal': void;
}

/** 메인 → 화면 알림 */
export interface IpcEventMap {
  'pty:data': { tabId: string; data: string };
  'pty:exit': { tabId: string; exitCode: number; signal?: number };
  'sessions:changed': void;
  'workspaces:changed': void;
  'files:changed': FileChangeEvent;
  'app:closeRequested': { openTabs: number };
}

export type IpcEventName = keyof IpcEventMap;

export const IPC_EVENT_NAMES: readonly IpcEventName[] = [
  'pty:data',
  'pty:exit',
  'sessions:changed',
  'workspaces:changed',
  'files:changed',
  'app:closeRequested',
];

/** 메인이 화면에 돌려주는 결과. 오류는 한국어 문구와 함께 감싸서 보낸다. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

export interface ExposedApi {
  invoke<C extends IpcChannel>(channel: C, request: IpcRequest<C>): Promise<IpcResponseMap[C]>;
  on<E extends IpcEventName>(event: E, listener: (payload: IpcEventMap[E]) => void): () => void;
}
