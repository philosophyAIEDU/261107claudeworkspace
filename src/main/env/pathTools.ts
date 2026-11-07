import nodePath from 'node:path';

// PATH(실행 파일을 찾는 폴더 목록)를 다루는 순수 함수 모음.
//
// 왜 필요한가: Claude Code 공식 설치 프로그램은 claude를 ~/.local/bin(Windows: %USERPROFILE%\.local\bin)에
// 넣지만 PATH에는 직접 추가하지 않는다(안내 문구만 보여 줌). 그래서
//  - 그 폴더가 원래 PATH에 있던 사람은 바로 되고,
//  - 없던 사람은 "'claude' is not recognized"가 뜬다.
// 게다가 PATH를 고쳐도 이미 켜져 있던 IDE(안티그래비티 등)의 터미널은 IDE가 켜질 때 받아 둔
// 옛 PATH를 그대로 물려받기 때문에, IDE를 완전히 껐다 켜기 전까지는 여전히 못 찾는다.
// 이 앱은 PATH에 기대지 않고 claude를 직접 찾고, 필요하면 PATH를 새로 읽어 터미널에 넣어 준다.

export type Platform = NodeJS.Platform | string;

const sepOf = (platform: Platform): string => (platform === 'win32' ? ';' : ':');

export function splitPath(value: string | undefined, platform: Platform): string[] {
  return (value ?? '')
    .split(sepOf(platform))
    .map((d) => d.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean);
}

function dirKey(dir: string, platform: Platform): string {
  const api = platform === 'win32' ? nodePath.win32 : nodePath.posix;
  let d = api.normalize(dir);
  if (d.length > 1 && /[\\/]$/.test(d) && !/^[a-zA-Z]:[\\/]$/.test(d)) d = d.slice(0, -1);
  return platform === 'win32' ? d.toLowerCase() : d;
}

export function isDirOnPath(pathValue: string | undefined, dir: string, platform: Platform): boolean {
  const key = dirKey(dir, platform);
  return splitPath(pathValue, platform).some((d) => dirKey(d, platform) === key);
}

/** 중복 없이 폴더들을 PATH 앞(또는 뒤)에 붙인다. */
export function addDirsToPath(pathValue: string | undefined, dirs: string[], platform: Platform, where: 'front' | 'back' = 'front'): string {
  const existing = splitPath(pathValue, platform);
  const seen = new Set(existing.map((d) => dirKey(d, platform)));
  const extra: string[] = [];
  for (const d of dirs) {
    const k = dirKey(d, platform);
    if (d && !seen.has(k)) {
      seen.add(k);
      extra.push(d);
    }
  }
  const all = where === 'front' ? [...extra, ...existing] : [...existing, ...extra];
  return all.join(sepOf(platform));
}

/** Windows 환경 변수 키는 대소문자를 가리지 않는다(Path, PATH). 실제로 쓰인 키 이름을 찾는다. */
export function pathKeyOf(env: Record<string, string | undefined>, platform: Platform): string {
  if (platform !== 'win32') return 'PATH';
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path';
}

/**
 * 환경 변수 묶음의 PATH 앞에 폴더를 넣은 새 묶음을 돌려준다.
 * Windows에서 'Path'와 'PATH'가 둘 다 생기면 어느 쪽이 쓰일지 알 수 없으므로 하나로 합친다.
 */
export function withDirsOnPath(env: Record<string, string>, dirs: string[], platform: Platform): Record<string, string> {
  const key = pathKeyOf(env, platform);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (!(platform === 'win32' && k.toUpperCase() === 'PATH' && k !== key)) out[k] = v;
  out[key] = addDirsToPath(env[key], dirs, platform, 'front');
  return out;
}

/** "%USERPROFILE%\.local\bin" 같은 Windows 변수 표기를 실제 값으로 바꾼다. */
export function expandWindowsVars(value: string, env: Record<string, string | undefined>): string {
  return value.replace(/%([^%]+)%/g, (whole, name: string) => {
    const k = Object.keys(env).find((x) => x.toUpperCase() === name.toUpperCase());
    return k && env[k] !== undefined ? env[k]! : whole;
  });
}

/**
 * `reg query <키> /v Path` 출력에서 값을 꺼낸다.
 * 예)     Path    REG_EXPAND_SZ    C:\Windows;%USERPROFILE%\.local\bin
 */
export function parseRegQueryValue(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/i);
    if (m) return m[1]!.trim();
  }
  return null;
}

/** macOS·Linux: 셸에 맞는 설정 파일 (공식 문서 안내와 같음) */
export function shellProfileFor(shellPath: string | undefined, platform: Platform, home: string): string | null {
  const shell = nodePath.posix.basename(shellPath || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash'));
  if (shell === 'zsh') return nodePath.posix.join(home, '.zshrc');
  // macOS의 bash는 로그인 셸로 뜨므로 .bash_profile을 읽는다.
  if (shell === 'bash') return nodePath.posix.join(home, platform === 'darwin' ? '.bash_profile' : '.bashrc');
  return null; // fish 등은 문법이 달라 자동으로 고치지 않는다
}

/** 셸 설정 파일에 넣을 한 줄. ~/.local/bin이면 공식 문서와 똑같은 줄을 쓴다. */
export function profileExportLine(dir: string, home: string): string {
  if (dir === nodePath.posix.join(home, '.local/bin')) return 'export PATH="$HOME/.local/bin:$PATH"';
  const quoted = `'${dir.replace(/'/g, `'\\''`)}'`;
  return `export PATH=${quoted}:"$PATH"`;
}

export function profileAlreadyHas(content: string, dir: string, home: string): boolean {
  if (content.includes(profileExportLine(dir, home))) return true;
  return dir === nodePath.posix.join(home, '.local/bin') && /^[^#\n]*PATH=[^\n]*(\$HOME|~)\/\.local\/bin/m.test(content);
}
