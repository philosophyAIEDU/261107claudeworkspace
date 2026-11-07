import { realpathSync } from 'node:fs';
import nodePath from 'node:path';
import { UserError } from '../errors';

// 경로 보안 검사.
// 화면(렌더러)이 보낸 경로는 그대로 믿지 않는다. 화면 코드에 문제가 생기거나
// 대화 내용에 섞인 악성 링크가 화면을 속여도, 등록된 작업 폴더 밖의 파일
// (예: C:\Windows, ~/.ssh)은 읽거나 쓸 수 없게 막는 마지막 울타리다.
// 1) 정규화로 `..`·중복 구분자를 정리하고
// 2) 심볼릭 링크를 실제 위치로 풀어서(링크로 밖을 가리키는 꼼수 차단)
// 3) Windows는 드라이브 문자·대소문자를 무시하고 비교한다.

export type Platform = 'win32' | 'darwin' | 'linux' | string;

export interface GuardOptions {
  platform?: Platform;
  /** 실제 경로 풀이 함수(테스트에서 바꿔 끼우기 위함). 없는 경로면 null */
  realpath?: (p: string) => string | null;
}

function pathApi(platform: Platform): typeof nodePath.posix {
  return platform === 'win32' ? nodePath.win32 : nodePath.posix;
}

function defaultRealpath(p: string): string | null {
  try {
    return realpathSync.native(p);
  } catch {
    return null;
  }
}

/** 비교용 키: Windows·macOS는 대소문자를 구분하지 않는 파일 시스템이 기본이라 소문자로 맞춘다. */
export function pathKey(p: string, platform: Platform = process.platform): string {
  const api = pathApi(platform);
  let n = api.normalize(api.resolve(p));
  if (n.length > 1 && (n.endsWith('/') || n.endsWith('\\')) && !/^[a-zA-Z]:[\\/]$/.test(n)) n = n.slice(0, -1);
  if (platform === 'win32' || platform === 'darwin') n = n.toLowerCase();
  return n.normalize('NFC');
}

export function normalizePath(p: string, platform: Platform = process.platform): string {
  const api = pathApi(platform);
  let n = api.normalize(api.resolve(p));
  if (n.length > 1 && (n.endsWith('/') || n.endsWith('\\')) && !/^[a-zA-Z]:[\\/]$/.test(n)) n = n.slice(0, -1);
  if (platform === 'win32' && /^[a-z]:/.test(n)) n = n[0]!.toUpperCase() + n.slice(1);
  // macOS는 한글 파일 이름을 자모 분리(NFD) 형태로 줄 때가 있어 NFC로 맞춘다.
  return n.normalize('NFC');
}

export function samePath(a: string, b: string, platform: Platform = process.platform): boolean {
  return pathKey(a, platform) === pathKey(b, platform);
}

/** target이 root와 같거나 root 안에 있는지 (문자열 기준) */
export function isInsideLexical(root: string, target: string, platform: Platform = process.platform): boolean {
  const api = pathApi(platform);
  const r = pathKey(root, platform);
  const t = pathKey(target, platform);
  if (r === t) return true;
  const rel = api.relative(r, t);
  return rel !== '' && !rel.startsWith('..') && !api.isAbsolute(rel);
}

/**
 * 존재하는 부분까지 실제 경로로 풀어 준다.
 * 새로 만들 파일처럼 아직 없는 경로는, 있는 조상 폴더까지만 풀고 나머지를 붙인다.
 */
export function resolveReal(p: string, opts: GuardOptions = {}): string {
  const platform = opts.platform ?? process.platform;
  const api = pathApi(platform);
  const realpath = opts.realpath ?? defaultRealpath;
  let current = api.resolve(p);
  const rest: string[] = [];
  for (;;) {
    const real = realpath(current);
    if (real !== null) return rest.length ? api.join(real, ...rest.reverse()) : real;
    const parent = api.dirname(current);
    if (parent === current) return api.resolve(p);
    rest.push(api.basename(current));
    current = parent;
  }
}

export function isInside(root: string, target: string, opts: GuardOptions = {}): boolean {
  const platform = opts.platform ?? process.platform;
  if (!isInsideLexical(root, target, platform)) return false;
  const realRoot = resolveReal(root, opts);
  const realTarget = resolveReal(target, opts);
  return isInsideLexical(realRoot, realTarget, platform);
}

/** 여러 허용 폴더 중 하나 안에 있어야 한다. 아니면 사용자용 오류를 던진다. 정규화된 경로를 돌려준다. */
export function assertInsideAny(roots: readonly string[], target: string, opts: GuardOptions = {}): string {
  const platform = opts.platform ?? process.platform;
  const api = pathApi(platform);
  if (!api.isAbsolute(target)) throw new UserError('파일 위치가 올바르지 않아요.', 'PATH_NOT_ABSOLUTE');
  if (target.includes('\0')) throw new UserError('파일 위치가 올바르지 않아요.', 'PATH_INVALID');
  for (const root of roots) {
    if (isInside(root, target, opts)) return normalizePath(target, platform);
  }
  throw new UserError('등록된 작업 폴더 밖의 파일은 열 수 없어요.', 'PATH_OUTSIDE');
}
