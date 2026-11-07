import { promises as fs } from 'node:fs';
import { appDataSchema, appSettingsSchema, defaultSettings, defaultUiState, sessionRecordSchema, uiStateSchema, workspaceSchema } from '../../shared/schemas';
import type { AppData } from '../../shared/types';
import { writeFileAtomic } from './atomicWrite';

export type LoadOutcome = 'loaded' | 'new' | 'restoredFromBackup' | 'reset';

/**
 * 앱 데이터(작업 폴더 목록, 대화 색인, 설정, 화면 상태)를 JSON 파일 하나에 저장한다.
 * - 쓰기는 항상 원자적으로(임시 파일 → rename) 한다.
 * - 저장할 때마다 직전 정상본을 `.bak`으로 남겨 둔다.
 * - 파일이 깨졌으면 `.bak` → 살릴 수 있는 항목만 건지기 → 처음 상태 순서로 복구한다.
 */
export class AppStore {
  private data: AppData;
  private lastSaved: string | null = null;
  private chain: Promise<void> = Promise.resolve();
  private listeners = new Set<(data: AppData) => void>();
  outcome: LoadOutcome = 'new';

  private constructor(
    private readonly filePath: string,
    private readonly defaultParentFolder: string,
  ) {
    this.data = AppStore.defaults(defaultParentFolder);
  }

  static defaults(defaultParentFolder: string): AppData {
    return {
      version: 1,
      workspaces: [],
      sessions: [],
      settings: defaultSettings(defaultParentFolder),
      ui: defaultUiState(),
    };
  }

  get backupPath(): string {
    return `${this.filePath}.bak`;
  }

  static async open(filePath: string, defaultParentFolder: string): Promise<AppStore> {
    const store = new AppStore(filePath, defaultParentFolder);
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    const main = await readText(this.filePath);
    if (main === null) {
      // 처음 실행. 백업만 남아 있다면(본 파일이 지워진 경우) 백업을 쓴다.
      const bak = await readText(this.backupPath);
      const fromBak = bak !== null ? parseStrict(bak) : null;
      if (fromBak) {
        this.data = fromBak;
        this.outcome = 'restoredFromBackup';
        await this.save();
      } else {
        this.outcome = 'new';
      }
      return;
    }
    const parsed = parseStrict(main);
    if (parsed) {
      this.data = parsed;
      this.lastSaved = main;
      this.outcome = 'loaded';
      return;
    }
    // 본 파일이 깨졌다 → 백업으로 복구 시도
    const bak = await readText(this.backupPath);
    const fromBak = bak !== null ? parseStrict(bak) : null;
    // 깨진 원본은 지우지 않고 따로 보관해 둔다(혹시 직접 살려야 할 때를 위해).
    await fs.copyFile(this.filePath, `${this.filePath}.broken-${Date.now()}`).catch(() => undefined);
    if (fromBak) {
      this.data = fromBak;
      this.outcome = 'restoredFromBackup';
    } else {
      this.data = salvage(main, this.defaultParentFolder);
      this.outcome = 'reset';
    }
    this.lastSaved = null;
    await this.save();
  }

  get(): AppData {
    return this.data;
  }

  /** 데이터를 고치고 저장한다. 저장은 순서대로 한 번에 하나씩 일어난다. */
  async update(mutator: (draft: AppData) => void): Promise<AppData> {
    const draft = structuredClone(this.data);
    mutator(draft);
    const checked = appDataSchema.parse(draft);
    this.data = checked;
    await this.save();
    for (const l of this.listeners) l(this.data);
    return this.data;
  }

  onChange(listener: (data: AppData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 지금까지 예약된 저장이 모두 끝날 때까지 기다린다. */
  flush(): Promise<void> {
    return this.chain;
  }

  private save(): Promise<void> {
    const text = JSON.stringify(this.data, null, 2);
    const previous = this.lastSaved;
    const job = async (): Promise<void> => {
      if (previous !== null && previous !== text) {
        await writeFileAtomic(this.backupPath, previous);
      }
      await writeFileAtomic(this.filePath, text);
      this.lastSaved = text;
    };
    this.chain = this.chain.then(job, job);
    return this.chain;
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function parseStrict(text: string): AppData | null {
  try {
    const json: unknown = JSON.parse(text);
    const result = appDataSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** 깨진 파일에서 멀쩡한 항목만 골라 건진다. 못 건지는 부분은 기본값으로 채운다. */
function salvage(text: string, defaultParentFolder: string): AppData {
  const base = AppStore.defaults(defaultParentFolder);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return base;
  }
  if (typeof json !== 'object' || json === null) return base;
  const obj = json as Record<string, unknown>;
  const pick = <T>(arr: unknown, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }): T[] =>
    Array.isArray(arr)
      ? arr.flatMap((item) => {
          const r = schema.safeParse(item);
          return r.success ? [r.data] : [];
        })
      : [];
  const settings = appSettingsSchema.safeParse({ ...base.settings, ...(asObject(obj.settings) ?? {}) });
  const ui = uiStateSchema.safeParse({ ...base.ui, ...(asObject(obj.ui) ?? {}) });
  return {
    version: 1,
    workspaces: pick(obj.workspaces, workspaceSchema),
    sessions: pick(obj.sessions, sessionRecordSchema),
    settings: settings.success ? settings.data : base.settings,
    ui: ui.success ? ui.data : base.ui,
  };
}

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
