import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// 원자적 쓰기: 같은 폴더의 임시 파일에 다 쓴 뒤 rename으로 바꿔치기한다.
// 쓰는 도중 전원이 꺼지거나 앱이 죽어도 "반쯤 쓰인" 파일이 남지 않는다.
// (rename은 같은 디스크 안에서 한 번에 일어나는 동작이기 때문)
export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await renameWithRetry(tmp, filePath);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

// Windows에서는 백신·검색 색인이 파일을 잠깐 붙잡고 있어 rename이 실패할 때가 있어 몇 번 다시 시도한다.
async function renameWithRetry(from: string, to: string): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < 5; i++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw err;
      await new Promise((r) => setTimeout(r, 30 * (i + 1)));
    }
  }
  throw lastErr;
}
