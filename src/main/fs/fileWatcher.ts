import type { FSWatcher } from 'chokidar';
import { HIDDEN_NAMES } from './fileTree';
import type { FileChangeEvent } from '../../shared/types';
import { pathKey } from './pathGuard';

type Emit = (e: FileChangeEvent) => void;

/**
 * 지금 열린 작업 폴더 하나만 감시한다. 변경이 생기면 화면에 알려
 * "Claude가 방금 바꾼 파일"(● 점) 표시와 열린 파일 새로 불러오기 안내에 쓴다.
 * 앱이 직접 저장한 파일은 잠깐 동안 알림에서 뺀다(내가 저장한 걸 Claude가 바꿨다고 착각하지 않게).
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private current: { workspaceId: string; root: string } | null = null;
  private ownWrites = new Map<string, number>();

  constructor(private readonly emit: Emit) {}

  markOwnWrite(filePath: string): void {
    this.ownWrites.set(pathKey(filePath), Date.now());
  }

  async watch(workspaceId: string | undefined, root: string | undefined): Promise<void> {
    if (this.current && this.current.workspaceId === workspaceId) return;
    await this.stop();
    if (!workspaceId || !root) return;
    const { watch } = await import('chokidar');
    this.current = { workspaceId, root };
    const w = watch(root, {
      ignoreInitial: true,
      ignored: (p: string) => p.split(/[\\/]/).some((part) => HIDDEN_NAMES.has(part)),
      depth: 12,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });
    const handler = (type: FileChangeEvent['type']) => (p: string) => {
      const key = pathKey(p);
      const own = this.ownWrites.get(key);
      if (own && Date.now() - own < 2000) return;
      this.emit({ workspaceId, path: p, type });
    };
    w.on('add', handler('add'))
      .on('change', handler('change'))
      .on('unlink', handler('unlink'))
      .on('addDir', handler('addDir'))
      .on('unlinkDir', handler('unlinkDir'))
      .on('error', () => undefined);
    this.watcher = w;
  }

  async stop(): Promise<void> {
    const w = this.watcher;
    this.watcher = null;
    this.current = null;
    if (w) await w.close();
  }
}
