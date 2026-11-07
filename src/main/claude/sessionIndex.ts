import type { ImportCandidate, ImportScanResult, SessionRecord, Workspace } from '../../shared/types';
import { pathKey, samePath, type Platform } from '../fs/pathGuard';

/** sessionIndex가 SDK에서 필요로 하는 최소한의 세션 정보 (SDKSessionInfo의 일부) */
export interface SessionInfoLike {
  sessionId: string;
  summary: string;
  lastModified: number;
  customTitle?: string;
  firstPrompt?: string;
  cwd?: string;
  createdAt?: number;
}

export interface MergeResult {
  sessions: SessionRecord[];
  added: number;
  /** 등록되지 않은 폴더에서 만든 대화 (가져오기 후보) */
  unmatched: SessionInfoLike[];
  /** 작업 폴더 정보가 없어 어느 폴더 것인지 알 수 없는 대화 수 */
  noCwd: number;
}

export function truncatePreview(text: string | undefined, max = 80): string | undefined {
  if (!text) return undefined;
  const one = text.replace(/\s+/g, ' ').trim();
  if (!one) return undefined;
  const chars = Array.from(one);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : one;
}

function iso(ms: number | undefined, fallback: string): string {
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : fallback;
}

function maxIso(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * 앱이 기억하는 대화 목록과 SDK가 찾은 대화 목록을 합친다(순수 함수).
 *
 * 폴더 연결은 인코딩된 디렉터리 이름(~/.claude/projects/-Users-...)을 거꾸로 풀지 않는다.
 * 그 이름은 `/`, `\`, `.`, 한글 등을 모두 `-`로 바꿔 만든 것이라, 원래 폴더 이름에 하이픈이나
 * 한글이 있으면 원래 경로로 되돌릴 방법이 없다. 대신 SDK가 기록 안에서 읽어 주는 `cwd`를 쓴다.
 *
 * - 이미 아는 대화: 숨김·메모·폴더 연결은 그대로 두고, 마지막 활동 시각·미리보기·이름만 새로 고친다.
 * - 처음 보는 대화: 등록된 폴더의 것이면 'imported'로 추가, 아니면 가져오기 후보로 돌려준다.
 * - SDK 목록에 없는 앱 대화(아직 한 마디도 안 해서 기록 파일이 없는 경우 등)는 지우지 않는다.
 */
export function mergeSessions(
  existing: readonly SessionRecord[],
  infos: readonly SessionInfoLike[],
  workspaces: readonly Workspace[],
  platform: Platform = process.platform,
  now: Date = new Date(),
): MergeResult {
  const byId = new Map<string, SessionRecord>();
  // 중복 제거: 같은 ID가 여러 번 있으면 더 최근 활동 기록 하나만 남긴다.
  for (const rec of existing) {
    const prev = byId.get(rec.sessionId);
    if (!prev || Date.parse(rec.lastActiveAt) > Date.parse(prev.lastActiveAt)) byId.set(rec.sessionId, { ...rec });
  }
  const seenInfo = new Set<string>();
  const unmatched: SessionInfoLike[] = [];
  let added = 0;
  let noCwd = 0;
  const nowIso = now.toISOString();

  for (const info of infos) {
    if (!info.sessionId || seenInfo.has(info.sessionId)) continue;
    seenInfo.add(info.sessionId);
    const lastActive = iso(info.lastModified, nowIso);
    const rec = byId.get(info.sessionId);
    if (rec) {
      rec.lastActiveAt = maxIso(rec.lastActiveAt, lastActive);
      rec.firstPrompt = rec.firstPrompt ?? truncatePreview(info.firstPrompt);
      // CLI의 /rename, --name, SDK renameSession으로 정한 이름이 있으면 그것을 따른다.
      if (info.customTitle && info.customTitle.trim()) rec.title = info.customTitle.trim();
      continue;
    }
    if (!info.cwd) {
      noCwd++;
      continue;
    }
    const ws = workspaces.find((w) => samePath(w.path, info.cwd!, platform));
    if (!ws) {
      unmatched.push(info);
      continue;
    }
    byId.set(info.sessionId, {
      sessionId: info.sessionId,
      workspaceId: ws.id,
      title: (info.customTitle || info.summary || truncatePreview(info.firstPrompt) || '이름 없는 대화').trim(),
      hidden: false,
      source: 'imported',
      createdAt: iso(info.createdAt, lastActive),
      lastActiveAt: lastActive,
      firstPrompt: truncatePreview(info.firstPrompt),
    });
    added++;
  }
  return { sessions: [...byId.values()], added, unmatched, noCwd };
}

/** 가져오기 후보를 폴더별로 묶는다. 같은 폴더(대소문자·끝의 구분자 차이)는 하나로 친다. */
export function groupImportCandidates(
  unmatched: readonly SessionInfoLike[],
  noCwd: number,
  existsSync: (p: string) => boolean,
  platform: Platform = process.platform,
): ImportScanResult {
  const groups = new Map<string, ImportCandidate>();
  for (const info of unmatched) {
    if (!info.cwd) continue;
    const key = pathKey(info.cwd, platform);
    const last = new Date(info.lastModified || 0).toISOString();
    const g = groups.get(key);
    if (g) {
      g.sessionCount++;
      if (last > g.lastActiveAt) g.lastActiveAt = last;
    } else {
      groups.set(key, { path: info.cwd, sessionCount: 1, lastActiveAt: last, exists: existsSync(info.cwd) });
    }
  }
  const candidates = [...groups.values()].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  return { candidates, unknownFolderCount: noCwd };
}
