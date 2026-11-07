import { describe, expect, it } from 'vitest';
import { checkClaude, findClaude, parseVersion, type LocatorDeps, type RunResult } from '../../src/main/claude/claudeLocator';

function deps(p: Partial<LocatorDeps> & { files?: string[]; runs?: Record<string, RunResult> }): LocatorDeps {
  const files = new Set(p.files ?? []);
  return {
    platform: p.platform ?? 'darwin',
    env: p.env ?? { PATH: '/usr/bin:/opt/homebrew/bin' },
    homeDir: p.homeDir ?? '/Users/hong',
    exists: async (x) => files.has(x),
    run:
      p.run ??
      (async (file, args) => {
        const key = `${file} ${Array.isArray(args) ? args.join(' ') : args}`;
        const r = p.runs?.[key];
        if (!r) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return r;
      }),
  };
}

describe('claudeLocator', () => {
  it('설치됨: PATH에서 찾아 버전을 읽는다', async () => {
    const d = deps({ files: ['/opt/homebrew/bin/claude'], runs: { '/opt/homebrew/bin/claude --version': { code: 0, stdout: '2.1.230 (Claude Code)\n', stderr: '' } } });
    expect(await checkClaude(d)).toEqual({ found: true, path: '/opt/homebrew/bin/claude', version: '2.1.230' });
  });

  it('PATH에 없어도 흔한 설치 위치(~/.local/bin)에서 찾는다', async () => {
    expect(await findClaude(deps({ env: { PATH: '/usr/bin' }, files: ['/Users/hong/.local/bin/claude'] }))).toBe('/Users/hong/.local/bin/claude');
  });

  it('안 됨: 어디에도 없으면 found=false와 한국어 안내', async () => {
    const r = await checkClaude(deps({ files: [] }));
    expect(r.found).toBe(false);
    expect(r.error).toContain('찾지 못했어요');
  });

  it('찾았지만 실행이 실패하면 found=false', async () => {
    const r = await checkClaude(deps({ files: ['/usr/bin/claude'], runs: { '/usr/bin/claude --version': { code: 1, stdout: '', stderr: 'boom' } } }));
    expect(r).toMatchObject({ found: false, path: '/usr/bin/claude' });
  });

  it('사용자 지정 경로를 우선하고, 없으면 그 사실을 알려 준다', async () => {
    const d = deps({ files: ['/custom/claude', '/usr/bin/claude'], runs: { '/custom/claude --version': { code: 0, stdout: '2.0.1', stderr: '' } } });
    expect(await checkClaude(d, '/custom/claude')).toMatchObject({ found: true, path: '/custom/claude' });
    expect((await checkClaude(d, '/nope/claude')).error).toContain('설정에서 지정한 위치');
  });

  it('Windows: where 결과에서 .exe를 .cmd보다 먼저 고르고, .cmd는 cmd.exe로 버전 확인', async () => {
    const whereOut = 'C:\\Users\\홍길동\\AppData\\Roaming\\npm\\claude\r\nC:\\Users\\홍길동\\AppData\\Roaming\\npm\\claude.cmd\r\nC:\\Users\\홍길동\\.local\\bin\\claude.exe\r\n';
    const d = deps({
      platform: 'win32',
      homeDir: 'C:\\Users\\홍길동',
      env: { PATH: 'C:\\Windows' },
      files: ['C:\\Users\\홍길동\\AppData\\Roaming\\npm\\claude.cmd', 'C:\\Users\\홍길동\\.local\\bin\\claude.exe'],
      runs: { 'where claude': { code: 0, stdout: whereOut, stderr: '' } },
    });
    expect(await findClaude(d)).toBe('C:\\Users\\홍길동\\.local\\bin\\claude.exe');

    const onlyCmd = deps({
      platform: 'win32',
      homeDir: 'C:\\Users\\홍길동',
      env: { PATH: 'C:\\Users\\홍길동\\AppData\\Roaming\\npm', APPDATA: 'C:\\Users\\홍길동\\AppData\\Roaming' },
      files: ['C:\\Users\\홍길동\\AppData\\Roaming\\npm\\claude.cmd'],
      run: async (file) => (file === 'cmd.exe' ? { code: 0, stdout: '2.1.0 (Claude Code)', stderr: '' } : { code: 1, stdout: '', stderr: '' }),
    });
    expect(await checkClaude(onlyCmd)).toMatchObject({ found: true, version: '2.1.0' });
  });

  it('parseVersion', () => {
    expect(parseVersion('2.1.230 (Claude Code)')).toBe('2.1.230');
    expect(parseVersion('nothing')).toBeNull();
  });
});
