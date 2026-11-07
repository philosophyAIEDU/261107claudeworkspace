import { describe, expect, it, vi } from 'vitest';
import { PtyManager, buildPtyEnv, type PtyLike, type PtySpawnFn, type PtySpawnOptions } from '../../src/main/pty/PtyManager';

const ID = '3f1c2a9e-8b7d-4c6e-9f0a-1b2c3d4e5f60';

class FakePty implements PtyLike {
  pid = 1234;
  written: string[] = [];
  resized: Array<[number, number]> = [];
  killed = false;
  private dataL: Array<(d: string) => void> = [];
  private exitL: Array<(e: { exitCode: number; signal?: number }) => void> = [];
  onData(l: (d: string) => void) {
    this.dataL.push(l);
    return { dispose: () => (this.dataL = this.dataL.filter((x) => x !== l)) };
  }
  onExit(l: (e: { exitCode: number; signal?: number }) => void) {
    this.exitL.push(l);
    return { dispose: () => (this.exitL = this.exitL.filter((x) => x !== l)) };
  }
  write(d: string) {
    this.written.push(d);
  }
  resize(c: number, r: number) {
    this.resized.push([c, r]);
  }
  kill() {
    this.killed = true;
  }
  emitData(d: string) {
    this.dataL.forEach((l) => l(d));
  }
  emitExit(code: number) {
    this.exitL.forEach((l) => l({ exitCode: code }));
  }
}

function setup(platform = 'linux') {
  const ptys: FakePty[] = [];
  const calls: Array<{ file: string; args: string[] | string; opts: PtySpawnOptions }> = [];
  const spawn: PtySpawnFn = (file, args, opts) => {
    calls.push({ file, args, opts });
    const p = new FakePty();
    ptys.push(p);
    return p;
  };
  return { mgr: new PtyManager(spawn, platform), ptys, calls };
}

const base = {
  workspaceId: 'ws1',
  claudePath: '/usr/local/bin/claude',
  cols: 100,
  rows: 30,
  env: { PATH: '/usr/bin', HOME: '/home/t' },
};

describe('PtyManager', () => {
  it('이어서 하기는 그 대화의 원래 작업 폴더를 cwd로 실행한다', () => {
    const { mgr, calls } = setup();
    mgr.start({ ...base, tabId: 't1', workspacePath: '/home/t/문서/수업 자료', sessionId: ID, title: '퀴즈', launch: { kind: 'resume', sessionId: ID } });
    expect(calls[0]!.opts.cwd).toBe('/home/t/문서/수업 자료');
    expect(calls[0]!.file).toBe('/usr/local/bin/claude');
    expect(calls[0]!.args).toEqual(['--resume', ID]);
  });

  it('resize를 PTY에 전달한다', () => {
    const { mgr, ptys } = setup();
    mgr.start({ ...base, tabId: 't1', workspacePath: '/w', sessionId: ID, title: 'a', launch: { kind: 'resume', sessionId: ID } });
    mgr.resize('t1', 120, 40);
    expect(ptys[0]!.resized).toEqual([[120, 40]]);
  });

  it('입력을 전달하고, 출력은 리스너와 버퍼로 보낸다', () => {
    const { mgr, ptys } = setup();
    const seen: string[] = [];
    mgr.onData((_id, d) => seen.push(d));
    mgr.start({ ...base, tabId: 't1', workspacePath: '/w', sessionId: ID, title: 'a', launch: { kind: 'resume', sessionId: ID } });
    mgr.write('t1', '안녕\r');
    ptys[0]!.emitData('Claude: 안녕하세요');
    expect(ptys[0]!.written).toEqual(['안녕\r']);
    expect(seen).toEqual(['Claude: 안녕하세요']);
    expect(mgr.getBuffer('t1')).toBe('Claude: 안녕하세요');
  });

  it('프로세스가 끝나면 종료 코드를 알리고 running=false가 된다', () => {
    const { mgr, ptys } = setup();
    const exit = vi.fn();
    mgr.onExit(exit);
    mgr.start({ ...base, tabId: 't1', workspacePath: '/w', sessionId: ID, title: 'a', launch: { kind: 'resume', sessionId: ID } });
    expect(mgr.runningCount()).toBe(1);
    ptys[0]!.emitExit(1);
    expect(exit).toHaveBeenCalledWith('t1', 1, undefined);
    expect(mgr.list()[0]).toMatchObject({ running: false, exitCode: 1 });
    expect(mgr.runningCount()).toBe(0);
    // 끝난 뒤의 입력·resize는 조용히 무시
    expect(() => mgr.write('t1', 'x')).not.toThrow();
    expect(() => mgr.resize('t1', 80, 20)).not.toThrow();
  });

  it('close와 disposeAll은 프로세스를 끝내고 탭을 지운다', () => {
    const { mgr, ptys } = setup();
    mgr.start({ ...base, tabId: 't1', workspacePath: '/w', sessionId: ID, title: 'a', launch: { kind: 'resume', sessionId: ID } });
    mgr.start({ ...base, tabId: 't2', workspacePath: '/w', sessionId: ID, title: 'b', launch: { kind: 'resume', sessionId: ID } });
    mgr.close('t1');
    expect(ptys[0]!.killed).toBe(true);
    expect(mgr.list().map((t) => t.tabId)).toEqual(['t2']);
    mgr.disposeAll();
    expect(ptys[1]!.killed).toBe(true);
    expect(mgr.list()).toEqual([]);
  });

  it('Windows의 claude.cmd는 cmd.exe로 감싸 ConPTY로 실행한다', () => {
    const { mgr, calls } = setup('win32');
    mgr.start({ ...base, claudePath: 'C:\\npm\\claude.cmd', tabId: 't1', workspacePath: 'C:\\Users\\홍길동\\문서\\수업 자료', sessionId: ID, title: 'a', launch: { kind: 'resume', sessionId: ID } });
    expect(calls[0]!.file).toBe('cmd.exe');
    expect(calls[0]!.opts.useConpty).toBe(true);
    expect(calls[0]!.opts.cwd).toBe('C:\\Users\\홍길동\\문서\\수업 자료');
  });
});

describe('PtyManager.startCommand (설치용 터미널)', () => {
  it('지정한 프로그램·인자·폴더로 실행하고 installer 종류로 표시한다', () => {
    const { mgr, calls } = setup('win32');
    const tab = mgr.startCommand({
      tabId: 'i1',
      title: 'Claude Code 설치',
      file: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'],
      cwd: 'C:\\Users\\홍길동',
      cols: 100,
      rows: 30,
      env: { Path: 'C:\\Windows' },
    });
    expect(tab).toMatchObject({ kind: 'installer', running: true, sessionId: '' });
    expect(calls[0]!.file).toContain('powershell.exe');
    expect(calls[0]!.args).toContain('Bypass');
    expect(calls[0]!.opts.cwd).toBe('C:\\Users\\홍길동');
    // 설치 탭은 어떤 대화로도 "열려 있음"으로 잡히지 않는다
    expect(mgr.isSessionOpen('')).toBe(false);
  });
});

describe('buildPtyEnv', () => {
  it('Electron·중첩 Claude 변수를 빼고 UTF-8과 색상 설정을 넣는다', () => {
    const env = buildPtyEnv({ PATH: '/bin', ELECTRON_RUN_AS_NODE: '1', CLAUDECODE: '1', LANG: 'C' }, 'darwin');
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.LANG).toBe('ko_KR.UTF-8');
    expect(env.TERM).toBe('xterm-256color');
    expect(buildPtyEnv({ LANG: 'en_US.UTF-8' }, 'linux').LANG).toBe('en_US.UTF-8');
  });
});
