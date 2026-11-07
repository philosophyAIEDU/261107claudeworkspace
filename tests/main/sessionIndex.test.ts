import { describe, expect, it } from 'vitest';
import { groupImportCandidates, mergeSessions, truncatePreview, type SessionInfoLike } from '../../src/main/claude/sessionIndex';
import type { SessionRecord, Workspace } from '../../src/shared/types';

const ws = (id: string, path: string): Workspace => ({ id, path, pinned: false, lastOpenedAt: '2026-11-01T00:00:00.000Z' });
const rec = (p: Partial<SessionRecord> & { sessionId: string }): SessionRecord => ({
  workspaceId: 'w1',
  title: '앱 대화',
  hidden: false,
  source: 'app',
  createdAt: '2026-11-01T00:00:00.000Z',
  lastActiveAt: '2026-11-01T00:00:00.000Z',
  ...p,
});
const info = (p: Partial<SessionInfoLike> & { sessionId: string }): SessionInfoLike => ({ summary: '요약', lastModified: Date.parse('2026-11-05T00:00:00Z'), ...p });

const workspaces = [ws('w1', '/home/t/수업-자료'), ws('w2', 'C:\\Users\\홍길동\\문서\\영어 단어앱')];

describe('mergeSessions', () => {
  it('앱에서 만든 대화와 밖에서 만든 대화를 합친다', () => {
    const r = mergeSessions(
      [rec({ sessionId: 'a' })],
      [info({ sessionId: 'a', cwd: '/home/t/수업-자료' }), info({ sessionId: 'b', cwd: '/home/t/수업-자료', customTitle: 'CLI에서 만든 대화', firstPrompt: '안녕' })],
      workspaces,
      'linux',
    );
    expect(r.added).toBe(1);
    expect(r.sessions.map((s) => s.sessionId).sort()).toEqual(['a', 'b']);
    const b = r.sessions.find((s) => s.sessionId === 'b')!;
    expect(b).toMatchObject({ source: 'imported', workspaceId: 'w1', title: 'CLI에서 만든 대화', firstPrompt: '안녕', hidden: false });
    // 기존 대화의 마지막 활동 시각은 더 최근 값으로
    expect(r.sessions.find((s) => s.sessionId === 'a')!.lastActiveAt).toBe('2026-11-05T00:00:00.000Z');
  });

  it('중복을 제거한다 (기존 목록 중복 + SDK 결과 중복)', () => {
    const r = mergeSessions(
      [rec({ sessionId: 'a', lastActiveAt: '2026-11-01T00:00:00.000Z' }), rec({ sessionId: 'a', title: '더 최근', lastActiveAt: '2026-11-03T00:00:00.000Z' })],
      [info({ sessionId: 'c', cwd: '/home/t/수업-자료' }), info({ sessionId: 'c', cwd: '/home/t/수업-자료' })],
      workspaces,
      'linux',
    );
    expect(r.sessions.filter((s) => s.sessionId === 'a')).toHaveLength(1);
    expect(r.sessions.find((s) => s.sessionId === 'a')!.title).toBe('더 최근');
    expect(r.sessions.filter((s) => s.sessionId === 'c')).toHaveLength(1);
    expect(r.added).toBe(1);
  });

  it('숨김·메모·폴더 연결은 동기화해도 유지된다', () => {
    const r = mergeSessions([rec({ sessionId: 'a', hidden: true, memo: '중요' })], [info({ sessionId: 'a', cwd: '/다른/곳' })], workspaces, 'linux');
    expect(r.sessions[0]).toMatchObject({ hidden: true, memo: '중요', workspaceId: 'w1' });
  });

  it('CLI에서 /rename한 이름(customTitle)을 따른다', () => {
    const r = mergeSessions([rec({ sessionId: 'a', title: '옛 이름' })], [info({ sessionId: 'a', customTitle: '새 이름' })], workspaces, 'linux');
    expect(r.sessions[0]!.title).toBe('새 이름');
  });

  it('폴더 경로가 없는 항목은 건너뛰고 수를 센다', () => {
    const r = mergeSessions([], [info({ sessionId: 'x' }), info({ sessionId: 'y', cwd: '' })], workspaces, 'linux');
    expect(r.sessions).toEqual([]);
    expect(r.noCwd).toBe(2);
  });

  it('등록 안 된 폴더의 대화는 가져오기 후보로 돌려준다', () => {
    const r = mergeSessions([], [info({ sessionId: 'z', cwd: '/home/t/새폴더' })], workspaces, 'linux');
    expect(r.sessions).toEqual([]);
    expect(r.unmatched.map((u) => u.sessionId)).toEqual(['z']);
  });

  it('SDK 목록에 없는 앱 대화(아직 기록 파일 없음)는 지우지 않는다', () => {
    const r = mergeSessions([rec({ sessionId: 'only-app' })], [], workspaces, 'linux');
    expect(r.sessions.map((s) => s.sessionId)).toEqual(['only-app']);
  });

  it('Windows는 대소문자·끝의 구분자를 무시하고 폴더를 맞춘다', () => {
    const r = mergeSessions([], [info({ sessionId: 'w', cwd: 'c:\\users\\홍길동\\문서\\영어 단어앱\\' })], workspaces, 'win32');
    expect(r.sessions[0]?.workspaceId).toBe('w2');
  });
});

describe('groupImportCandidates', () => {
  it('폴더별로 묶고 최근순으로 정렬한다', () => {
    const r = groupImportCandidates(
      [
        info({ sessionId: '1', cwd: '/a', lastModified: Date.parse('2026-11-01T00:00:00Z') }),
        info({ sessionId: '2', cwd: '/b', lastModified: Date.parse('2026-11-04T00:00:00Z') }),
        info({ sessionId: '3', cwd: '/a/', lastModified: Date.parse('2026-11-02T00:00:00Z') }),
      ],
      3,
      (p) => p !== '/b',
      'linux',
    );
    expect(r.unknownFolderCount).toBe(3);
    expect(r.candidates.map((c) => [c.path, c.sessionCount, c.exists])).toEqual([
      ['/b', 1, false],
      ['/a', 2, true],
    ]);
  });
});

describe('truncatePreview', () => {
  it('80자로 자르고 줄바꿈을 합친다', () => {
    expect(truncatePreview('가\n나')).toBe('가 나');
    const long = truncatePreview('한'.repeat(200))!;
    expect(Array.from(long)).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
    expect(truncatePreview('   ')).toBeUndefined();
  });
});
