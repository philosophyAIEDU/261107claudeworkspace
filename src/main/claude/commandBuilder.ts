import nodePath from 'node:path';
import type { PermissionMode } from '../../shared/types';

// 세션 ID는 앱이 직접 만들어 넘긴다(--session-id).
// 터미널 출력에서 ID를 긁어 오면 CLI 화면 문구가 바뀔 때마다 깨지고,
// 출력이 늦거나 잘려 들어오면 엉뚱한 대화에 연결될 수 있기 때문이다.
// ID를 먼저 정해 두면 "이 대화 = 이 폴더"를 시작하는 순간 바로 기록할 수 있다.
export type ClaudeLaunch =
  | { kind: 'new'; sessionId: string; title: string; model?: string; permissionMode?: PermissionMode }
  | { kind: 'resume'; sessionId: string }
  // 갈라서 이어 하기도 새 ID를 앱이 정해 함께 넘긴다(--fork-session과 --session-id를 같이 쓰면 그 ID로 갈라진다).
  | { kind: 'fork'; sessionId: string; newSessionId: string }
  | { kind: 'continue' };

/**
 * Claude Code CLI에 넘길 인자 배열을 만든다(순수 함수).
 * 셸 문자열을 이어 붙이지 않고 배열로만 넘기므로, 대화 이름에 따옴표·한글·공백·특수문자가 있어도
 * 셸이 그것을 명령으로 해석할 여지가 없다.
 */
export function buildClaudeArgs(launch: ClaudeLaunch): string[] {
  switch (launch.kind) {
    case 'new': {
      const args = ['--session-id', launch.sessionId, '--name', sanitizeTitle(launch.title)];
      if (launch.model) args.push('--model', launch.model);
      if (launch.permissionMode && launch.permissionMode !== 'default') {
        args.push('--permission-mode', launch.permissionMode);
      }
      return args;
    }
    case 'resume':
      return ['--resume', launch.sessionId];
    case 'fork':
      return ['--resume', launch.sessionId, '--fork-session', '--session-id', launch.newSessionId];
    case 'continue':
      return ['--continue'];
  }
}

/** 줄바꿈·제어 문자를 없애고 길이를 줄인다. (터미널 제목·목록에 그대로 쓰이므로) */
export function sanitizeTitle(title: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = title.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const safe = cleaned.length > 0 ? cleaned : '새 대화';
  return Array.from(safe).slice(0, 100).join('');
}

/** 기본 대화 이름: "새 대화 (11월 7일 오후 3:59)" */
export function defaultSessionTitle(now: Date = new Date()): string {
  const h = now.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `새 대화 (${now.getMonth() + 1}월 ${now.getDate()}일 ${ampm} ${h12}:${mm})`;
}

export interface SpawnCommand {
  file: string;
  /** Windows에서 cmd.exe를 거칠 때는 이미 따옴표 처리된 한 줄 문자열로 넘긴다. */
  args: string[] | string;
}

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

function escapeCmdCommand(command: string): string {
  return command.replace(CMD_META, '^$1');
}

// cmd.exe용 인자 이스케이프 (cross-spawn과 같은 방식).
// npm으로 설치한 claude.cmd는 cmd.exe가 한 번 더 해석하므로 특수문자를 두 번 이스케이프한다.
function escapeCmdArgument(arg: string, doubleEscape: boolean): string {
  let a = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  a = a.replace(/(?=(\\+?)?)\1$/, '$1$1');
  a = `"${a}"`;
  a = a.replace(CMD_META, '^$1');
  if (doubleEscape) a = a.replace(CMD_META, '^$1');
  return a;
}

/**
 * 실행 파일 종류에 맞게 실제로 띄울 명령을 정한다.
 * - .exe나 macOS/Linux 실행 파일: 그대로 실행
 * - Windows의 .cmd/.bat(npm 설치본): ConPTY가 직접 못 띄우므로 cmd.exe /d /s /c 로 감싸고 인자를 이스케이프
 */
export function resolveSpawnCommand(claudePath: string, args: string[], platform: NodeJS.Platform | string = process.platform): SpawnCommand {
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(claudePath)) {
    return { file: claudePath, args };
  }
  const shellCommand = [escapeCmdCommand(nodePath.win32.normalize(claudePath)), ...args.map((a) => escapeCmdArgument(a, true))].join(' ');
  return { file: 'cmd.exe', args: `/d /s /c "${shellCommand}"` };
}
