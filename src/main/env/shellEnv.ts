import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { addDirsToPath, expandWindowsVars, parseRegQueryValue, pathKeyOf } from './pathTools';

// PTY(터미널)와 claude 탐색에 쓸 환경 변수 만들기.
//
// macOS: 앱을 Finder(Dock)로 실행하면 PATH가 /usr/bin:/bin 정도로 아주 짧다.
//        로그인 셸을 한 번 띄워 사용자가 평소 쓰는 PATH를 받아 온다.
// Windows: 프로그램은 "켜질 때의" PATH를 계속 쓴다. 앱을 켠 뒤에 Claude Code를 설치하거나
//        PATH를 고쳐도 그대로다(안티그래비티 터미널이 IDE 재시작 전까지 claude를 못 찾는 것과 같은 이유).
//        그래서 레지스트리에 저장된 최신 PATH를 다시 읽어 합친다.
// 공통: 공식 설치 위치(~/.local/bin)는 PATH에 없더라도 항상 넣어 둔다.

let cached: Record<string, string> | null = null;
let loginPathCache: string | null | undefined;

const START = '__PCW_PATH_START__';
const END = '__PCW_PATH_END__';

// 표시 문자열과 $PATH를 따로따로 넘긴다. "$PATH__END__"처럼 붙여 쓰면 셸이 PATH__END__라는
// (비어 있는) 변수로 읽어 버리기 때문이다. printf '%s'는 여러 인자를 그대로 이어 붙여 출력한다.
export const LOGIN_PATH_COMMAND = `printf '%s' '${START}' "$PATH" '${END}'`;

export function extractPath(output: string): string | null {
  const s = output.indexOf(START);
  const e = output.indexOf(END, s + START.length);
  if (s < 0 || e < 0) return null;
  const value = output.slice(s + START.length, e).trim();
  return value.length ? value : null;
}

function run(file: string, args: string[], timeout = 5000, env: NodeJS.ProcessEnv = process.env): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, env, windowsHide: true, encoding: 'utf8' }, (err, stdout) => resolve({ ok: !err, stdout: String(stdout ?? '') }));
  });
}

/** macOS·Linux: 로그인 셸이 쓰는 PATH (사용자의 .zshrc 등이 반영된 값) */
export async function readLoginShellPath(): Promise<string | null> {
  if (process.platform === 'win32') return null;
  if (loginPathCache !== undefined) return loginPathCache;
  const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  const r = await run(shell, ['-ilc', LOGIN_PATH_COMMAND], 5000, { ...process.env, DISABLE_AUTO_UPDATE: 'true' });
  loginPathCache = extractPath(r.stdout);
  return loginPathCache;
}

/** Windows: 레지스트리에 저장된 최신 PATH (시스템 + 사용자). 새로 연 터미널이 받게 될 값과 같다. */
export async function readWindowsRegistryPath(): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  const [machine, user] = await Promise.all([
    run('reg', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'Path']),
    run('reg', ['query', 'HKCU\\Environment', '/v', 'Path']),
  ]);
  const parts = [machine.ok ? parseRegQueryValue(machine.stdout) : null, user.ok ? parseRegQueryValue(user.stdout) : null].filter((x): x is string => !!x);
  if (!parts.length) return null;
  return expandWindowsVars(parts.join(';'), process.env);
}

/** 다른 프로그램(새 터미널, 안티그래비티 등)이 보게 될 "저장된" PATH */
export async function readPersistentPath(): Promise<string | null> {
  return process.platform === 'win32' ? readWindowsRegistryPath() : readLoginShellPath();
}

export function knownInstallDirs(platform: NodeJS.Platform, env: Record<string, string | undefined>, home: string): string[] {
  if (platform === 'win32') {
    const p = path.win32;
    const appData = env.APPDATA ?? p.join(home, 'AppData', 'Roaming');
    return [p.join(home, '.local', 'bin'), p.join(appData, 'npm')];
  }
  return [path.posix.join(home, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
}

/** 설치·PATH 수정 뒤에 다시 읽도록 기억해 둔 값을 지운다. */
export function invalidateShellEnv(): void {
  cached = null;
  loginPathCache = undefined;
}

export async function getShellEnv(): Promise<Record<string, string>> {
  if (cached) return cached;
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') base[k] = v;
  const key = pathKeyOf(base, process.platform);
  const fresh = await readPersistentPath();
  let value = base[key] ?? '';
  if (fresh) value = addDirsToPath(value, fresh.split(path.delimiter), process.platform, process.platform === 'win32' ? 'back' : 'front');
  value = addDirsToPath(value, knownInstallDirs(process.platform, base, os.homedir()), process.platform, 'back');
  base[key] = value;
  cached = base;
  return base;
}
