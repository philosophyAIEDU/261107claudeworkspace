import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileEntry } from '../../shared/types';

// 파일 트리에서 기본으로 숨기는 이름들 (양이 많고 교육자가 볼 일이 거의 없는 폴더)
export const HIDDEN_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.cache',
  '.venv',
  '__pycache__',
  '.DS_Store',
  'Thumbs.db',
]);

export function isHiddenName(name: string): boolean {
  return HIDDEN_NAMES.has(name);
}

/** 한 단계만 읽는다(폴더는 펼칠 때 다시 읽음). 폴더 먼저, 이름 가나다순. */
export async function listDirectory(dir: string): Promise<FileEntry[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const entries: FileEntry[] = [];
  for (const d of dirents) {
    if (isHiddenName(d.name)) continue;
    let kind: FileEntry['kind'] | null = d.isDirectory() ? 'dir' : d.isFile() ? 'file' : null;
    if (d.isSymbolicLink()) {
      const st = await fs.stat(path.join(dir, d.name)).catch(() => null);
      kind = st ? (st.isDirectory() ? 'dir' : 'file') : null;
    }
    if (!kind) continue;
    entries.push({ name: d.name.normalize('NFC'), path: path.join(dir, d.name), kind });
  }
  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  entries.sort((a, b) => (a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === 'dir' ? -1 : 1));
  return entries;
}
