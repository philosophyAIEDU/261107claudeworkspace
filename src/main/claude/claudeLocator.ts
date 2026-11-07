import nodePath from 'node:path';
import type { ClaudeCheckResult } from '../../shared/types';
import { resolveSpawnCommand } from './commandBuilder';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface LocatorDeps {
  platform: NodeJS.Platform | string;
  env: Record<string, string | undefined>;
  homeDir: string;
  exists: (p: string) => Promise<boolean>;
  run: (file: string, args: string[] | string, timeoutMs: number) => Promise<RunResult>;
}

function api(platform: string): typeof nodePath.posix {
  return platform === 'win32' ? nodePath.win32 : nodePath.posix;
}

function pathDirs(deps: LocatorDeps): string[] {
  const raw = deps.env.PATH ?? deps.env.Path ?? '';
  const sep = deps.platform === 'win32' ? ';' : ':';
  return raw
    .split(sep)
    .map((d) => d.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

/** 운영체제마다 Claude Code가 흔히 설치되는 곳 */
export function knownLocations(deps: LocatorDeps): string[] {
  const p = api(deps.platform);
  const home = deps.homeDir;
  if (deps.platform === 'win32') {
    const appData = deps.env.APPDATA ?? p.join(home, 'AppData', 'Roaming');
    const localAppData = deps.env.LOCALAPPDATA ?? p.join(home, 'AppData', 'Local');
    return [
      p.join(home, '.local', 'bin', 'claude.exe'),
      p.join(localAppData, 'Programs', 'claude', 'claude.exe'),
      p.join(appData, 'npm', 'claude.cmd'),
    ];
  }
  return [
    p.join(home, '.local', 'bin', 'claude'),
    p.join(home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    p.join(home, '.npm-global', 'bin', 'claude'),
  ];
}

/**
 * claude 실행 파일을 찾는다.
 * 순서: 사용자가 설정에서 지정한 경로 → PATH(Windows는 `where claude` 결과 포함) → 흔한 설치 위치.
 * Windows는 .exe(네이티브 설치)를 .cmd(npm 설치)보다 먼저 고른다.
 */
export async function findClaude(deps: LocatorDeps, customPath?: string): Promise<string | null> {
  if (customPath) return (await deps.exists(customPath)) ? customPath : null;
  const p = api(deps.platform);
  const names = deps.platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.bat'] : ['claude'];
  const candidates: string[] = [];
  if (deps.platform === 'win32') {
    const where = await deps.run('where', ['claude'], 5000).catch(() => null);
    if (where && where.code === 0) {
      const lines = where.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // where는 확장자 없는 파일(npm의 셸 스크립트)도 돌려주므로 실행 가능한 확장자만 고른다.
      const rank = (l: string): number => (/\.exe$/i.test(l) ? 0 : /\.(cmd|bat)$/i.test(l) ? 1 : 9);
      candidates.push(...lines.filter((l) => rank(l) < 9).sort((a, b) => rank(a) - rank(b)));
    }
  }
  for (const name of names) for (const dir of pathDirs(deps)) candidates.push(p.join(dir, name));
  candidates.push(...knownLocations(deps));
  for (const c of candidates) if (await deps.exists(c)) return c;
  return null;
}

export function parseVersion(output: string): string | null {
  const m = output.match(/(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/);
  return m ? m[1]! : null;
}

/** `claude --version`을 실행해 설치 여부와 버전을 확인한다. */
export async function checkClaude(deps: LocatorDeps, customPath?: string): Promise<ClaudeCheckResult> {
  const found = await findClaude(deps, customPath);
  if (!found) {
    return {
      found: false,
      error: customPath ? '설정에서 지정한 위치에 Claude Code가 없어요.' : 'Claude Code를 찾지 못했어요.',
    };
  }
  const cmd = resolveSpawnCommand(found, ['--version'], deps.platform);
  try {
    const res = await deps.run(cmd.file, cmd.args, 15000);
    const version = parseVersion(`${res.stdout}\n${res.stderr}`);
    if (res.code === 0 && version) return { found: true, path: found, version };
    return { found: false, path: found, error: 'Claude Code를 찾았지만 실행되지 않았어요. 다시 설치해 보세요.' };
  } catch {
    return { found: false, path: found, error: 'Claude Code를 실행하지 못했어요.' };
  }
}
