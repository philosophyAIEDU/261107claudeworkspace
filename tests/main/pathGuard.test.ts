import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertInsideAny, isInside, isInsideLexical, normalizePath, samePath } from '../../src/main/fs/pathGuard';

describe('pathGuard (문자열 기준)', () => {
  it('.. 으로 밖으로 나가는 경로를 막는다', () => {
    expect(isInsideLexical('/home/t/수업', '/home/t/수업/a/../b.txt', 'linux')).toBe(true);
    expect(isInsideLexical('/home/t/수업', '/home/t/수업/../비밀.txt', 'linux')).toBe(false);
    expect(isInsideLexical('/home/t/수업', '/home/t/수업자료/x', 'linux')).toBe(false); // 이름이 겹치는 형제 폴더
  });

  it('Windows: 드라이브 문자·대소문자·구분자 차이를 무시한다', () => {
    expect(isInsideLexical('C:\\Users\\홍길동\\문서\\수업 자료', 'c:/users/홍길동/문서/수업 자료/index.html', 'win32')).toBe(true);
    expect(isInsideLexical('C:\\Users\\홍길동\\문서', 'D:\\Users\\홍길동\\문서\\a.txt', 'win32')).toBe(false);
    expect(samePath('C:\\Work\\', 'c:\\work', 'win32')).toBe(true);
    expect(samePath('/Work', '/work', 'linux')).toBe(false);
    expect(normalizePath('c:\\a\\b\\', 'win32')).toBe('C:\\a\\b');
  });

  it('assertInsideAny: 밖이면 한국어 오류, 상대 경로·NUL도 거부', () => {
    const fake = { platform: 'win32' as const, realpath: (p: string) => p };
    expect(assertInsideAny(['C:\\수업 자료'], 'C:\\수업 자료\\a.txt', fake)).toBe('C:\\수업 자료\\a.txt');
    expect(() => assertInsideAny(['C:\\수업 자료'], 'C:\\Windows\\system32\\x', fake)).toThrow('등록된 작업 폴더 밖');
    expect(() => assertInsideAny(['C:\\수업 자료'], 'a.txt', fake)).toThrow();
    expect(() => assertInsideAny(['C:\\수업 자료'], 'C:\\수업 자료\\a\0.txt', fake)).toThrow();
  });
});

describe('pathGuard (실제 파일 시스템)', () => {
  // Windows에서 폴더 심볼릭 링크를 만들려면 개발자 모드·관리자 권한이 필요해 건너뛴다.
  it.skipIf(process.platform === 'win32')('심볼릭 링크로 밖을 가리키는 꼼수를 막는다', () => {
    const base = mkdtempSync(path.join(os.tmpdir(), 'pcw-guard-'));
    const ws = path.join(base, '수업 자료');
    const outside = path.join(base, '비밀');
    mkdirSync(ws);
    mkdirSync(outside);
    writeFileSync(path.join(outside, 'key.txt'), 'secret');
    symlinkSync(outside, path.join(ws, '링크'), 'dir');
    expect(isInsideLexical(ws, path.join(ws, '링크', 'key.txt'))).toBe(true); // 문자열로는 안쪽처럼 보이지만
    expect(isInside(ws, path.join(ws, '링크', 'key.txt'))).toBe(false); // 실제 위치는 밖
    // 아직 없는 새 파일도 검사할 수 있다
    expect(isInside(ws, path.join(ws, '새 폴더', '새 파일.txt'))).toBe(true);
    expect(isInside(ws, path.join(ws, '링크', '새 파일.txt'))).toBe(false);
  });
});
