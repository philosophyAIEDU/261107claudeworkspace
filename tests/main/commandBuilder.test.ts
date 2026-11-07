import { describe, expect, it } from 'vitest';
import { buildClaudeArgs, defaultSessionTitle, resolveSpawnCommand, sanitizeTitle } from '../../src/main/claude/commandBuilder';

const ID = '3f1c2a9e-8b7d-4c6e-9f0a-1b2c3d4e5f60';
const NEW_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('buildClaudeArgs', () => {
  it('새 대화: --session-id와 --name을 넣는다', () => {
    expect(buildClaudeArgs({ kind: 'new', sessionId: ID, title: '퀴즈 앱 만들기' })).toEqual(['--session-id', ID, '--name', '퀴즈 앱 만들기']);
  });

  it('새 대화: 모델·권한 모드 옵션을 붙인다(기본 모드는 생략)', () => {
    expect(buildClaudeArgs({ kind: 'new', sessionId: ID, title: 'a', model: 'sonnet', permissionMode: 'plan' })).toEqual([
      '--session-id', ID, '--name', 'a', '--model', 'sonnet', '--permission-mode', 'plan',
    ]);
    expect(buildClaudeArgs({ kind: 'new', sessionId: ID, title: 'a', permissionMode: 'default' })).not.toContain('--permission-mode');
  });

  it('이어서 하기: --resume <ID>', () => {
    expect(buildClaudeArgs({ kind: 'resume', sessionId: ID })).toEqual(['--resume', ID]);
  });

  it('갈라서 이어 하기: --resume + --fork-session + 앱이 정한 새 ID', () => {
    expect(buildClaudeArgs({ kind: 'fork', sessionId: ID, newSessionId: NEW_ID })).toEqual(['--resume', ID, '--fork-session', '--session-id', NEW_ID]);
  });

  it('이름에 따옴표·한글·공백·셸 특수문자가 있어도 인자 하나로 그대로 전달한다', () => {
    const title = `"선생님's" 수업 & 자료; $(rm -rf ~) | 테스트`;
    const args = buildClaudeArgs({ kind: 'new', sessionId: ID, title });
    expect(args).toHaveLength(4);
    expect(args[3]).toBe(title);
  });

  it('이름의 줄바꿈·제어 문자는 공백으로 바꾸고, 비어 있으면 기본 이름을 쓴다', () => {
    expect(sanitizeTitle('첫 줄\n둘째 줄\t\u0007끝')).toBe('첫 줄 둘째 줄 끝');
    expect(sanitizeTitle('   \n ')).toBe('새 대화');
    expect(Array.from(sanitizeTitle('가'.repeat(300)))).toHaveLength(100);
  });
});

describe('defaultSessionTitle', () => {
  it('"새 대화 (11월 7일 오후 3:59)" 형식', () => {
    expect(defaultSessionTitle(new Date(2026, 10, 7, 15, 59))).toBe('새 대화 (11월 7일 오후 3:59)');
    expect(defaultSessionTitle(new Date(2026, 0, 2, 0, 5))).toBe('새 대화 (1월 2일 오전 12:05)');
  });
});

describe('resolveSpawnCommand', () => {
  it('macOS·Linux와 Windows .exe는 그대로 실행', () => {
    expect(resolveSpawnCommand('/usr/local/bin/claude', ['--resume', ID], 'darwin')).toEqual({ file: '/usr/local/bin/claude', args: ['--resume', ID] });
    expect(resolveSpawnCommand('C:\\Users\\홍길동\\.local\\bin\\claude.exe', ['-v'], 'win32')).toEqual({ file: 'C:\\Users\\홍길동\\.local\\bin\\claude.exe', args: ['-v'] });
  });

  it('Windows .cmd는 cmd.exe로 감싸고 특수문자를 이스케이프한다', () => {
    const cmd = resolveSpawnCommand('C:\\Users\\홍 길동\\AppData\\Roaming\\npm\\claude.cmd', ['--name', 'A & B "C"'], 'win32');
    expect(cmd.file).toBe('cmd.exe');
    expect(typeof cmd.args).toBe('string');
    const line = cmd.args as string;
    expect(line.startsWith('/d /s /c "')).toBe(true);
    // & 와 " 가 그대로 드러나지 않고 ^로 이스케이프되어 있어야 한다
    expect(line).not.toMatch(/[^^]&/);
    expect(line).toContain('^^^&');
    expect(line).toContain('홍^ 길동');
  });
});
