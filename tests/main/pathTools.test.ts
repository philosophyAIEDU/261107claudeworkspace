import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addDirsToPath,
  expandWindowsVars,
  isDirOnPath,
  parseRegQueryValue,
  profileAlreadyHas,
  profileExportLine,
  shellProfileFor,
  withDirsOnPath,
} from '../../src/main/env/pathTools';
import { addDirToUserPath } from '../../src/main/env/pathFix';

describe('PATH 검사', () => {
  it('Windows: 대소문자·끝의 \\ 차이를 무시하고 찾는다', () => {
    const p = 'C:\\Windows;C:\\Users\\홍길동\\.local\\bin\;C:\\Tools';
    expect(isDirOnPath(p, 'c:\\users\\홍길동\\.local\\bin', 'win32')).toBe(true);
    expect(isDirOnPath('C:\\Windows', 'C:\\Users\\홍길동\\.local\\bin', 'win32')).toBe(false);
  });

  it('macOS: 대소문자를 구분하고 : 로 나눈다', () => {
    expect(isDirOnPath('/usr/bin:/Users/hong/.local/bin', '/Users/hong/.local/bin', 'darwin')).toBe(true);
    expect(isDirOnPath('/usr/bin', '/Users/hong/.local/bin', 'darwin')).toBe(false);
  });

  it('addDirsToPath: 중복 없이 앞/뒤에 붙인다', () => {
    expect(addDirsToPath('/a:/b', ['/c', '/a'], 'linux')).toBe('/c:/a:/b');
    expect(addDirsToPath('C:\\A', ['c:\\a\\', 'D:\\B'], 'win32', 'back')).toBe('C:\\A;D:\\B');
    expect(addDirsToPath(undefined, ['/x'], 'linux')).toBe('/x');
  });

  it("withDirsOnPath: Windows에서 'Path'와 'PATH'가 둘 다 생기지 않게 한 키로 합친다", () => {
    const env = withDirsOnPath({ Path: 'C:\\Windows', PATH: 'C:\\Other', HOME: 'h' }, ['C:\\Users\\홍길동\\.local\\bin'], 'win32');
    expect(Object.keys(env).filter((k) => k.toUpperCase() === 'PATH')).toEqual(['Path']);
    expect(env.Path).toBe('C:\\Users\\홍길동\\.local\\bin;C:\\Windows');
    expect(env.HOME).toBe('h');
  });
});

describe('레지스트리 PATH 읽기', () => {
  it('reg query 출력에서 값을 꺼내고 %변수%를 펼친다', () => {
    const out = '\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\.local\\bin;C:\\Tools\r\n\r\n';
    const v = parseRegQueryValue(out);
    expect(v).toBe('%USERPROFILE%\\.local\\bin;C:\\Tools');
    expect(expandWindowsVars(v!, { UserProfile: 'C:\\Users\\홍길동' })).toBe('C:\\Users\\홍길동\\.local\\bin;C:\\Tools');
    expect(expandWindowsVars('%NOPE%\\x', {})).toBe('%NOPE%\\x');
    expect(parseRegQueryValue('ERROR: The system was unable to find the specified registry key or value.')).toBeNull();
  });
});

describe('macOS·Linux 셸 설정 파일', () => {
  it('셸에 맞는 파일을 고른다 (공식 문서와 같음)', () => {
    expect(shellProfileFor('/bin/zsh', 'darwin', '/Users/h')).toBe('/Users/h/.zshrc');
    expect(shellProfileFor('/bin/bash', 'darwin', '/Users/h')).toBe('/Users/h/.bash_profile');
    expect(shellProfileFor('/bin/bash', 'linux', '/home/h')).toBe('/home/h/.bashrc');
    expect(shellProfileFor('/usr/bin/fish', 'darwin', '/Users/h')).toBeNull();
  });

  it('~/.local/bin은 문서와 같은 줄, 다른 폴더는 따옴표로 안전하게', () => {
    expect(profileExportLine('/Users/h/.local/bin', '/Users/h')).toBe('export PATH="$HOME/.local/bin:$PATH"');
    expect(profileExportLine("/opt/it's here", '/Users/h')).toBe(`export PATH='/opt/it'\\''s here':"$PATH"`);
    expect(profileAlreadyHas('export PATH=$HOME/.local/bin:$PATH\n', '/Users/h/.local/bin', '/Users/h')).toBe(true);
    expect(profileAlreadyHas('# export PATH=$HOME/.local/bin:$PATH\n', '/Users/h/.local/bin', '/Users/h')).toBe(false);
  });

  it('addDirToUserPath: 설정 파일에 한 번만 덧붙인다', async () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'pcw-home-'));
    writeFileSync(path.join(home, '.zshrc'), 'alias ll="ls -l"');
    const dir = path.join(home, '.local/bin');
    const first = await addDirToUserPath(dir, 'darwin', home, '/bin/zsh');
    expect(first).toMatchObject({ ok: true, where: path.join(home, '.zshrc') });
    const second = await addDirToUserPath(dir, 'darwin', home, '/bin/zsh');
    expect(second.alreadyDone).toBe(true);
    const content = readFileSync(path.join(home, '.zshrc'), 'utf8');
    expect(content.match(/\.local\/bin/g)).toHaveLength(1);
    expect(content.startsWith('alias ll="ls -l"\n')).toBe(true);
    expect((await addDirToUserPath(dir, 'darwin', home, '/usr/bin/fish')).ok).toBe(false);
  });
});
