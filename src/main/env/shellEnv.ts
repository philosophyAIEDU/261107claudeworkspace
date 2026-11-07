import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// macOS에서 앱을 Finder(Dock)로 실행하면 PATH가 /usr/bin:/bin 정도로 아주 짧다.
// 그래서 터미널에서는 되던 `claude`를 앱에서는 못 찾는 일이 생긴다.
// 로그인 셸을 한 번 띄워 사용자가 평소 쓰는 PATH를 받아 와 PTY 환경에 넣는다.

let cached: Record<string, string> | null = null;

const START = '__PCW_PATH_START__';
const END = '__PCW_PATH_END__';

export function extractPath(output: string): string | null {
  const s = output.indexOf(START);
  const e = output.indexOf(END, s + START.length);
  if (s < 0 || e < 0) return null;
  const value = output.slice(s + START.length, e).trim();
  return value.length ? value : null;
}

function readLoginShellPath(): Promise<string | null> {
  const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  return new Promise((resolve) => {
    execFile(
      shell,
      ['-ilc', `printf '%s' "${START}$PATH${END}"`],
      { timeout: 5000, env: { ...process.env, DISABLE_AUTO_UPDATE: 'true' } },
      (err, stdout) => resolve(err && !stdout ? null : extractPath(String(stdout))),
    );
  });
}

export function mergePath(...parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const dir of (part ?? '').split(path.delimiter)) {
      if (dir && !seen.has(dir)) {
        seen.add(dir);
        out.push(dir);
      }
    }
  }
  return out.join(path.delimiter);
}

/** PTY와 claude 탐색에 쓸 환경 변수 */
export async function getShellEnv(): Promise<Record<string, string>> {
  if (cached) return cached;
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') base[k] = v;
  if (process.platform !== 'win32') {
    const loginPath = await readLoginShellPath();
    const home = os.homedir();
    base.PATH = mergePath(
      loginPath ?? undefined,
      base.PATH,
      [path.join(home, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].join(path.delimiter),
    );
  }
  cached = base;
  return base;
}
