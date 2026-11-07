import { z } from 'zod';

// 앱 데이터 파일과 IPC 요청을 검증하는 스키마.
// 화면(렌더러)에서 오는 값은 믿지 않고 메인 프로세스에서 항상 이 스키마로 검사한다.

export const DEFAULT_QUICK_PHRASES = [
  '지금까지 한 일을 정리해 줘',
  '다음에 할 일을 알려 줘',
  '방금 바꾼 내용을 쉽게 설명해 줘',
  '오류가 났어. 원인을 찾아서 고쳐 줘',
];

export const workspaceSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  alias: z.string().optional(),
  memo: z.string().optional(),
  color: z.string().optional(),
  pinned: z.boolean(),
  lastOpenedAt: z.string(),
  missing: z.boolean().optional(),
});

export const sessionRecordSchema = z.object({
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string(),
  memo: z.string().optional(),
  hidden: z.boolean(),
  source: z.enum(['app', 'imported']),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  messageCount: z.number().int().nonnegative().optional(),
  firstPrompt: z.string().optional(),
});

const fontScaleSchema = z.object({
  ui: z.number().min(0.75).max(2),
  editor: z.number().min(0.75).max(2.5),
  terminal: z.number().min(0.75).max(2.5),
});

export const appSettingsSchema = z.object({
  claudePath: z.string().optional(),
  defaultParentFolder: z.string(),
  externalIdePath: z.string().optional(),
  terminalPosition: z.enum(['right', 'bottom']),
  fontScale: fontScaleSchema,
  theme: z.enum(['light', 'dark', 'system']),
  quickPhrases: z.array(z.string()).max(30),
  koreanInputBox: z.boolean(),
});

export const uiStateSchema = z.object({
  window: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().min(400),
      height: z.number().min(300),
      maximized: z.boolean(),
    })
    .optional(),
  lastWorkspaceId: z.string().optional(),
  sidebarWidth: z.number().min(160).max(800),
  claudePanelSize: z.number().min(200).max(2000),
  sidebarCollapsed: z.boolean(),
  claudePanelCollapsed: z.boolean(),
  sidebarTab: z.enum(['workspaces', 'files']),
  openFiles: z.record(z.string(), z.array(z.string())),
  activeFile: z.record(z.string(), z.string().optional()),
  homeSort: z.enum(['recent', 'name', 'pinned']),
  inputHistory: z.array(z.string()).max(200),
  setupDone: z.boolean().default(false),
});

export const appDataSchema = z.object({
  version: z.literal(1),
  workspaces: z.array(workspaceSchema),
  sessions: z.array(sessionRecordSchema),
  settings: appSettingsSchema,
  ui: uiStateSchema,
});

export function defaultSettings(defaultParentFolder: string): z.infer<typeof appSettingsSchema> {
  return {
    defaultParentFolder,
    terminalPosition: 'right',
    fontScale: { ui: 1, editor: 1, terminal: 1 },
    theme: 'system',
    quickPhrases: [...DEFAULT_QUICK_PHRASES],
    koreanInputBox: true,
  };
}

export function defaultUiState(): z.infer<typeof uiStateSchema> {
  return {
    sidebarWidth: 280,
    claudePanelSize: 520,
    sidebarCollapsed: false,
    claudePanelCollapsed: false,
    sidebarTab: 'workspaces',
    openFiles: {},
    activeFile: {},
    homeSort: 'recent',
    inputHistory: [],
    setupDone: false,
  };
}

// ───── IPC 요청 스키마 ─────

const id = z.string().min(1).max(200);
const uuid = z.uuid();
const absPath = z.string().min(1).max(4096);
const shortText = z.string().max(500);

export const ipcRequestSchemas = {
  'app:getInfo': z.void(),
  'app:quit': z.void(),
  'app:cancelQuit': z.void(),
  'setup:checkClaude': z.void(),
  'setup:pickClaudePath': z.void(),
  'settings:get': z.void(),
  'settings:update': appSettingsSchema.partial(),
  'settings:pickFolder': z.void(),
  'settings:pickFile': z.void(),
  'ui:get': z.void(),
  'ui:update': uiStateSchema.partial(),
  'workspaces:list': z.void(),
  'workspaces:pickAndAdd': z.void(),
  'workspaces:createNew': z.object({ name: z.string().min(1).max(120) }),
  'workspaces:update': z.object({
    id,
    patch: z.object({
      alias: shortText.optional(),
      memo: shortText.optional(),
      color: z.string().max(30).optional(),
      pinned: z.boolean().optional(),
    }),
  }),
  'workspaces:remove': z.object({ id }),
  'workspaces:relocate': z.object({ id }),
  'workspaces:touch': z.object({ id }),
  'workspaces:refreshMissing': z.void(),
  'sessions:list': z.object({ workspaceId: id.optional(), includeHidden: z.boolean().optional() }),
  'sessions:sync': z.void(),
  'sessions:importScan': z.void(),
  'sessions:importApply': z.object({ paths: z.array(absPath).max(500) }),
  'sessions:rename': z.object({ sessionId: uuid, title: z.string().trim().min(1).max(200) }),
  'sessions:update': z.object({
    sessionId: uuid,
    patch: z.object({ memo: shortText.optional(), hidden: z.boolean().optional() }),
  }),
  'sessions:deleteFile': z.object({ sessionId: uuid, confirm: z.literal('되돌릴 수 없어요') }),
  'sessions:history': z.object({ sessionId: uuid }),
  'sessions:search': z.object({ query: z.string().trim().min(1).max(200) }),
  'sessions:exportMarkdown': z.object({ sessionId: uuid }),
  'pty:start': z.object({
    workspaceId: id,
    cols: z.number().int().min(10).max(1000),
    rows: z.number().int().min(4).max(500),
    launch: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('new'),
        title: z.string().trim().min(1).max(200),
        model: z
          .string()
          .regex(/^[a-zA-Z0-9._\-[\]]+$/)
          .max(80)
          .optional(),
        permissionMode: z.enum(['default', 'acceptEdits', 'plan']).optional(),
      }),
      z.object({ kind: z.literal('resume'), sessionId: uuid }),
      z.object({ kind: z.literal('fork'), sessionId: uuid }),
    ]),
  }),
  'pty:write': z.object({ tabId: id, data: z.string().max(1_000_000) }),
  'pty:resize': z.object({
    tabId: id,
    cols: z.number().int().min(10).max(1000),
    rows: z.number().int().min(4).max(500),
  }),
  'pty:kill': z.object({ tabId: id }),
  'pty:close': z.object({ tabId: id }),
  'pty:list': z.void(),
  'pty:buffer': z.object({ tabId: id }),
  'files:tree': z.object({ workspaceId: id, dir: absPath }),
  'files:read': z.object({ path: absPath }),
  'files:write': z.object({ path: absPath, content: z.string().max(20_000_000) }),
  'files:create': z.object({ path: absPath, kind: z.enum(['file', 'dir']) }),
  'files:rename': z.object({ from: absPath, to: absPath }),
  'files:trash': z.object({ path: absPath }),
  'files:reveal': z.object({ path: absPath }),
  'files:openInIde': z.object({ path: absPath }),
  'files:watch': z.object({ workspaceId: id.optional() }),
  'shell:openExternal': z.object({ url: z.url({ protocol: /^https$/ }) }),
} as const;

export type IpcChannel = keyof typeof ipcRequestSchemas;
