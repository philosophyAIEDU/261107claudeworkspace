import { existsSync } from 'node:fs';
import type { FSWatcher } from 'chokidar';

/**
 * ~/.claude/projects 를 감시해서, 기록 파일이 생기거나 바뀌면(앱 밖의 터미널에서 대화한 경우 포함)
 * 대화 목록을 자동으로 새로 고친다. 변경이 몰려와도 1초에 한 번만 동기화한다(디바운스).
 * 이 폴더는 읽기만 하고 절대 쓰지 않는다.
 */
export class ClaudeProjectsWatcher {
  private watcher: FSWatcher | null = null;
  private retry: NodeJS.Timeout | null = null;

  constructor(
    private readonly projectsDir: string,
    private readonly onChange: () => void,
  ) {}

  async start(): Promise<void> {
    if (!existsSync(this.projectsDir)) {
      // 아직 Claude Code를 한 번도 안 썼으면 폴더가 없다. 30초마다 생겼는지 본다.
      this.retry = setTimeout(() => void this.start(), 30_000);
      return;
    }
    const { watch } = await import('chokidar');
    this.watcher = watch(this.projectsDir, {
      ignoreInitial: true,
      depth: 1,
      ignored: (p: string, stats?: { isFile(): boolean }) => Boolean(stats?.isFile()) && !p.endsWith('.jsonl'),
    });
    this.watcher.on('all', () => this.onChange()).on('error', () => undefined);
  }

  async stop(): Promise<void> {
    if (this.retry) clearTimeout(this.retry);
    await this.watcher?.close();
    this.watcher = null;
  }
}

export function debounce(fn: () => void, ms: number): () => void {
  let t: NodeJS.Timeout | null = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn();
    }, ms);
  };
}
