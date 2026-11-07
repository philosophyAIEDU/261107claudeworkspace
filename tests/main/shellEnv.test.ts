import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { LOGIN_PATH_COMMAND, extractPath, knownInstallDirs } from '../../src/main/env/shellEnv';

describe('로그인 셸 PATH 읽기', () => {
  it.skipIf(process.platform === 'win32')('실제 셸에서 PATH 값을 그대로 꺼낸다', () => {
    const out = execFileSync('/bin/sh', ['-c', LOGIN_PATH_COMMAND], { env: { PATH: '/x/y:/usr/bin:/bin' }, encoding: 'utf8' });
    expect(extractPath(out)).toBe('/x/y:/usr/bin:/bin');
  });

  it('앞뒤에 다른 출력(인사말 등)이 섞여도 꺼낸다', () => {
    expect(extractPath('Welcome!\n__PCW_PATH_START__/a:/b__PCW_PATH_END__\n')).toBe('/a:/b');
    expect(extractPath('nothing')).toBeNull();
  });

  it('공식 설치 위치를 항상 후보에 넣는다', () => {
    expect(knownInstallDirs('win32', { APPDATA: 'C:\\Users\\홍길동\\AppData\\Roaming' }, 'C:\\Users\\홍길동')).toEqual([
      'C:\\Users\\홍길동\\.local\\bin',
      'C:\\Users\\홍길동\\AppData\\Roaming\\npm',
    ]);
    expect(knownInstallDirs('darwin', {}, '/Users/hong')[0]).toBe('/Users/hong/.local/bin');
  });
});
