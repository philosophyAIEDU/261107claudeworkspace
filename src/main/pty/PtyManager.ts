import type { PtyTabInfo } from '../../shared/types';
import { buildClaudeArgs, resolveSpawnCommand, type ClaudeLaunch } from '../claude/commandBuilder';

// node-pty와 같은 모양의 최소 인터페이스 (테스트에서 가짜로 바꿔 끼우기 위함)
export interface Disposable {
  dispose(): void;
}
export interface PtyLike {
  readonly pid: number;
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (e: { exitCode: number; signal?: number }) => void): Disposable;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}
export interface PtySpawnOptions {
  name: string;
  cwd: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
  useConpty?: boolean;
}
export type PtySpawnFn = (file: string, args: string[] | string, options: PtySpawnOptions) => PtyLike;

export interface StartOptions {
  tabId: string;
  workspaceId: string;
  /** 그 대화를 시작한 작업 폴더. 이어서 하기도 반드시 여기서 실행한다. */
  workspacePath: string;
  sessionId: string;
  title: string;
  launch: ClaudeLaunch;
  claudePath: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
}

interface Tab {
  info: PtyTabInfo;
  pty: PtyLike | null;
  buffer: string[];
  bufferSize: number;
  disposables: Disposable[];
}

const MAX_BUFFER = 512 * 1024; // 탭마다 최근 출력 512KB 보관 (화면을 새로 그릴 때 복원용)

/** 끼어들면 안 되는 환경 변수를 정리하고 한글·색상 설정을 넣는다. */
export function buildPtyEnv(base: Record<string, string>, platform: string = process.platform): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    // 앱 자체(Electron)의 설정이 Claude Code로 새어 들어가지 않게 뺀다.
    if (k.startsWith('ELECTRON_') || k === 'NODE_OPTIONS') continue;
    // 이 앱을 다른 Claude Code 터미널에서 띄웠을 때 "Claude 안에서 Claude 실행"으로 오인되지 않게 뺀다.
    if (k === 'CLAUDECODE' || k === 'CLAUDE_CODE_ENTRYPOINT') continue;
    env[k] = v;
  }
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  if (platform !== 'win32') {
    if (!env.LANG || !/utf-?8/i.test(env.LANG)) env.LANG = 'ko_KR.UTF-8';
    if (env.LC_ALL && !/utf-?8/i.test(env.LC_ALL)) delete env.LC_ALL;
  }
  return env;
}

/**
 * Claude Code CLI를 가상 터미널(PTY)에서 실행하고 탭별로 관리한다.
 */
export class PtyManager {
  private tabs = new Map<string, Tab>();
  private dataListeners = new Set<(tabId: string, data: string) => void>();
  private exitListeners = new Set<(tabId: string, exitCode: number, signal?: number) => void>();

  constructor(
    private readonly spawnPty: PtySpawnFn,
    private readonly platform: NodeJS.Platform | string = process.platform,
  ) {}

  onData(l: (tabId: string, data: string) => void): () => void {
    this.dataListeners.add(l);
    return () => this.dataListeners.delete(l);
  }

  onExit(l: (tabId: string, exitCode: number, signal?: number) => void): () => void {
    this.exitListeners.add(l);
    return () => this.exitListeners.delete(l);
  }

  start(opts: StartOptions): PtyTabInfo {
    const existing = this.tabs.get(opts.tabId);
    if (existing?.pty) throw new Error(`tab ${opts.tabId} already running`);
    if (existing) this.disposeTab(existing);

    const args = buildClaudeArgs(opts.launch);
    const cmd = resolveSpawnCommand(opts.claudePath, args, this.platform);
    // 이어서 하기는 반드시 그 대화를 시작한 폴더에서 실행해야 한다.
    // Claude Code는 작업 폴더별로 대화 기록을 나눠 저장하므로, 다른 폴더에서 --resume 하면
    // "대화를 찾을 수 없다"고 하거나(옛 버전) 엉뚱한 폴더에서 파일을 고치게 된다.
    const pty = this.spawnPty(cmd.file, cmd.args, {
      name: 'xterm-256color',
      cwd: opts.workspacePath,
      cols: opts.cols,
      rows: opts.rows,
      env: buildPtyEnv(opts.env, this.platform),
      useConpty: this.platform === 'win32' ? true : undefined,
    });
    const tab: Tab = {
      info: {
        tabId: opts.tabId,
        sessionId: opts.sessionId,
        workspaceId: opts.workspaceId,
        title: opts.title,
        running: true,
      },
      pty,
      buffer: [],
      bufferSize: 0,
      disposables: [],
    };
    tab.disposables.push(
      pty.onData((data) => {
        this.appendBuffer(tab, data);
        for (const l of this.dataListeners) l(opts.tabId, data);
      }),
      pty.onExit(({ exitCode, signal }) => {
        tab.info.running = false;
        tab.info.exitCode = exitCode;
        tab.pty = null;
        for (const l of this.exitListeners) l(opts.tabId, exitCode, signal);
      }),
    );
    this.tabs.set(opts.tabId, tab);
    return { ...tab.info };
  }

  private appendBuffer(tab: Tab, data: string): void {
    tab.buffer.push(data);
    tab.bufferSize += data.length;
    while (tab.bufferSize > MAX_BUFFER && tab.buffer.length > 1) {
      tab.bufferSize -= tab.buffer.shift()!.length;
    }
  }

  write(tabId: string, data: string): void {
    this.tabs.get(tabId)?.pty?.write(data);
  }

  resize(tabId: string, cols: number, rows: number): void {
    const pty = this.tabs.get(tabId)?.pty;
    if (!pty) return;
    try {
      pty.resize(Math.max(10, Math.floor(cols)), Math.max(4, Math.floor(rows)));
    } catch {
      // 이미 끝난 프로세스에 resize하면 오류가 날 수 있어 무시한다.
    }
  }

  /** 프로세스만 끝낸다(탭 기록은 남겨 "대화가 종료됐어요" 화면을 보여 줄 수 있게). */
  kill(tabId: string): void {
    const pty = this.tabs.get(tabId)?.pty;
    if (!pty) return;
    try {
      pty.kill();
    } catch {
      // 이미 끝났으면 무시
    }
  }

  /** 탭을 완전히 닫는다. */
  close(tabId: string): PtyTabInfo | undefined {
    const tab = this.tabs.get(tabId);
    if (!tab) return undefined;
    this.kill(tabId);
    this.disposeTab(tab);
    this.tabs.delete(tabId);
    return { ...tab.info };
  }

  private disposeTab(tab: Tab): void {
    for (const d of tab.disposables) {
      try {
        d.dispose();
      } catch {
        // 무시
      }
    }
    tab.disposables = [];
  }

  getBuffer(tabId: string): string {
    return this.tabs.get(tabId)?.buffer.join('') ?? '';
  }

  list(): PtyTabInfo[] {
    return [...this.tabs.values()].map((t) => ({ ...t.info }));
  }

  runningCount(): number {
    return [...this.tabs.values()].filter((t) => t.pty).length;
  }

  isSessionOpen(sessionId: string): boolean {
    return [...this.tabs.values()].some((t) => t.info.sessionId === sessionId);
  }

  findTabBySession(sessionId: string): PtyTabInfo | undefined {
    const t = [...this.tabs.values()].find((x) => x.info.sessionId === sessionId);
    return t ? { ...t.info } : undefined;
  }

  /** 앱을 닫을 때: 모든 Claude를 끝낸다. 대화 기록은 Claude Code가 이미 디스크에 저장해 두었다. */
  disposeAll(): void {
    for (const id of [...this.tabs.keys()]) this.close(id);
  }
}
