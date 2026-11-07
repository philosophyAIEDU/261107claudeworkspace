// 앱 전체(메인·화면)가 함께 쓰는 데이터 모양.
// 앱 데이터는 Claude Code 기록의 "색인"일 뿐이고, 진짜 대화 내용의 원본은
// Claude Code가 저장한 기록 파일이다. 앱 데이터가 사라져도 동기화로 다시 만들 수 있다.

export interface Workspace {
  id: string;
  path: string; // 절대 경로 (정규화해서 저장, Windows는 대소문자 무시 비교)
  alias?: string;
  memo?: string;
  color?: string;
  pinned: boolean;
  lastOpenedAt: string; // ISO
  missing?: boolean; // 경로가 사라졌는지
}

export interface SessionRecord {
  sessionId: string; // Claude Code 세션 UUID
  workspaceId: string;
  title: string;
  memo?: string;
  hidden: boolean;
  source: 'app' | 'imported'; // 앱에서 만들었는지, 밖에서 만든 걸 가져왔는지
  createdAt: string;
  lastActiveAt: string;
  messageCount?: number;
  firstPrompt?: string; // 미리보기 (최대 80자)
}

export type ThemeSetting = 'light' | 'dark' | 'system';
export type TerminalPosition = 'right' | 'bottom';

export interface FontScale {
  ui: number;
  editor: number;
  terminal: number;
}

export interface AppSettings {
  claudePath?: string;
  defaultParentFolder: string;
  externalIdePath?: string;
  terminalPosition: TerminalPosition;
  fontScale: FontScale;
  theme: ThemeSetting;
  quickPhrases: string[];
  koreanInputBox: boolean;
}

/** 앱을 다시 켰을 때 복원할 화면 상태 */
export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface UiState {
  window?: WindowBounds;
  lastWorkspaceId?: string;
  sidebarWidth: number;
  claudePanelSize: number; // 오른쪽이면 너비, 아래면 높이 (px)
  sidebarCollapsed: boolean;
  claudePanelCollapsed: boolean;
  sidebarTab: 'workspaces' | 'files';
  openFiles: Record<string, string[]>; // 작업 폴더 id → 열린 파일 경로들
  activeFile: Record<string, string | undefined>;
  homeSort: HomeSort;
  inputHistory: string[];
  setupDone: boolean; // 첫 실행 확인 화면을 한 번 지나갔는지
}

export type HomeSort = 'recent' | 'name' | 'pinned';

export interface AppData {
  version: 1;
  workspaces: Workspace[];
  sessions: SessionRecord[];
  settings: AppSettings;
  ui: UiState;
}

// ───── 화면에 보여 주기 위한 가공된 모양 ─────

export interface WorkspaceView extends Workspace {
  sessionCount: number;
  lastActiveAt: string; // 폴더 열기·대화 활동 중 가장 최근
  lastSessionTitle?: string;
  lastSessionId?: string;
}

export interface SessionView extends SessionRecord {
  open: boolean; // 지금 탭으로 열려 있는지
}

export interface ClaudeCheckResult {
  found: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface AppInfo {
  platform: 'win32' | 'darwin' | 'linux' | 'aix' | 'freebsd' | 'openbsd' | 'sunos' | 'android' | 'haiku' | 'cygwin' | 'netbsd';
  appVersion: string;
  homeDir: string;
  dataResetNotice: boolean; // 앱 데이터가 깨져서 처음 상태로 되돌렸는지
  ptyAvailable: boolean;
  ptyError?: string;
}

export type ClaudeLaunchRequest =
  | { kind: 'new'; title: string; model?: string; permissionMode?: PermissionMode }
  | { kind: 'resume'; sessionId: string }
  | { kind: 'fork'; sessionId: string };

export type PermissionMode = 'default' | 'acceptEdits' | 'plan';

export interface PtyTabInfo {
  tabId: string;
  sessionId: string;
  workspaceId: string;
  title: string;
  running: boolean;
  exitCode?: number;
}

export interface PtyStartResult {
  tab: PtyTabInfo;
}

export interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'dir';
}

export interface FileReadResult {
  content: string;
  tooLarge: boolean;
  binary: boolean;
}

export type HistoryItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | { kind: 'tool'; id: string; summary: string }
  | { kind: 'compacted'; id: string; text?: string };

export interface HistoryResult {
  items: HistoryItem[];
  compacted: boolean;
  found: boolean;
}

export interface ImportCandidate {
  path: string;
  sessionCount: number;
  lastActiveAt: string;
  exists: boolean;
}

export interface ImportScanResult {
  candidates: ImportCandidate[];
  unknownFolderCount: number; // 작업 폴더 정보가 없는 대화 수
}

export interface SearchHit {
  sessionId: string;
  workspaceId: string;
  title: string;
  folderName: string;
  where: 'title' | 'memo' | 'message' | 'folder';
  snippet: string;
}

export interface FileChangeEvent {
  workspaceId: string;
  path: string;
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
}
