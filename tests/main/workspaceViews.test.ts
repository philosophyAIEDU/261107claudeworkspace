import { describe, expect, it } from 'vitest';
import { addWorkspaceTo, computeWorkspaceViews } from '../../src/main/ipc/workspaces';
import { AppStore } from '../../src/main/store/AppStore';

describe('작업 폴더 목록', () => {
  it('카드 정보: 숨긴 대화는 세지 않고, 최근 대화 제목을 고른다', () => {
    const views = computeWorkspaceViews({
      workspaces: [{ id: 'w', path: '/w', pinned: false, lastOpenedAt: '2026-11-01T00:00:00.000Z' }],
      sessions: [
        { sessionId: 'a', workspaceId: 'w', title: '옛 대화', hidden: false, source: 'app', createdAt: '', lastActiveAt: '2026-11-02T00:00:00.000Z' },
        { sessionId: 'b', workspaceId: 'w', title: '최근 대화', hidden: false, source: 'app', createdAt: '', lastActiveAt: '2026-11-05T00:00:00.000Z' },
        { sessionId: 'c', workspaceId: 'w', title: '숨김', hidden: true, source: 'app', createdAt: '', lastActiveAt: '2026-11-06T00:00:00.000Z' },
      ],
    });
    expect(views[0]).toMatchObject({ sessionCount: 2, lastSessionTitle: '최근 대화', lastSessionId: 'b', lastActiveAt: '2026-11-05T00:00:00.000Z' });
  });

  it('같은 폴더를 두 번 추가하지 않는다 (Windows 대소문자 무시)', () => {
    const d = AppStore.defaults('/p');
    const a = addWorkspaceTo(d, 'C:\\Users\\홍길동\\문서\\수업 자료', 'win32');
    const b = addWorkspaceTo(d, 'c:\\users\\홍길동\\문서\\수업 자료\\', 'win32');
    expect(a.id).toBe(b.id);
    expect(d.workspaces).toHaveLength(1);
  });
});
