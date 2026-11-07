import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileReadResult } from '../../shared/types';
import { UserError } from '../errors';
import { writeFileAtomic } from '../store/atomicWrite';

const MAX_EDIT_BYTES = 5 * 1024 * 1024; // 5MB 넘는 파일은 편집기로 열지 않음

/** 앞부분에 NUL 바이트가 있으면 그림·실행 파일 같은 이진 파일로 본다. */
function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

export async function readTextFile(filePath: string): Promise<FileReadResult> {
  const st = await fs.stat(filePath).catch(() => null);
  if (!st) throw new UserError('파일을 찾을 수 없어요. 옮겨졌거나 지워졌을 수 있어요.', 'NOT_FOUND');
  if (!st.isFile()) throw new UserError('폴더는 편집기로 열 수 없어요.', 'NOT_FILE');
  if (st.size > MAX_EDIT_BYTES) return { content: '', tooLarge: true, binary: false };
  const buf = await fs.readFile(filePath);
  if (looksBinary(buf)) return { content: '', tooLarge: false, binary: true };
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM 제거
  return { content: text, tooLarge: false, binary: false };
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await writeFileAtomic(filePath, content);
}

const INVALID_NAME = /[<>:"|?*\u0000-\u001f]/;

export function assertValidName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..' || INVALID_NAME.test(trimmed) || /[\\/]/.test(trimmed)) {
    throw new UserError('이름에 쓸 수 없는 글자가 들어 있어요. (\\ / : * ? " < > | 는 쓸 수 없어요)', 'BAD_NAME');
  }
}

export async function createEntry(target: string, kind: 'file' | 'dir'): Promise<void> {
  assertValidName(path.basename(target));
  const exists = await fs.stat(target).then(() => true, () => false);
  if (exists) throw new UserError('같은 이름이 이미 있어요. 다른 이름을 써 주세요.', 'EXISTS');
  if (kind === 'dir') await fs.mkdir(target, { recursive: false });
  else await fs.writeFile(target, '', { flag: 'wx' });
}

export async function renameEntry(from: string, to: string): Promise<void> {
  assertValidName(path.basename(to));
  const exists = await fs.stat(to).then(() => true, () => false);
  // Windows에서 대소문자만 바꾸는 경우는 같은 파일로 보이므로 허용
  if (exists && from.toLowerCase() !== to.toLowerCase()) {
    throw new UserError('같은 이름이 이미 있어요. 다른 이름을 써 주세요.', 'EXISTS');
  }
  await fs.rename(from, to);
}
