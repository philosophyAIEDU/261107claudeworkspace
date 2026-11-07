// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionList, visibleSessions, type SessionListHandlers } from '../../src/renderer/features/sessions/SessionList';
import type { SessionView } from '../../src/shared/types';

const s = (p: Partial<SessionView> & { sessionId: string; title: string }): SessionView => ({
  workspaceId: 'w',
  hidden: false,
  source: 'app',
  createdAt: '2026-11-01T00:00:00.000Z',
  lastActiveAt: '2026-11-01T00:00:00.000Z',
  open: false,
  ...p,
});

const sessions = [
  s({ sessionId: '1', title: '오래된 대화', lastActiveAt: '2026-11-01T00:00:00.000Z' }),
  s({ sessionId: '2', title: '최근 대화', lastActiveAt: '2026-11-06T00:00:00.000Z', open: true, firstPrompt: '퀴즈 만들어 줘', messageCount: 12 }),
  s({ sessionId: '3', title: '숨긴 대화', lastActiveAt: '2026-11-07T00:00:00.000Z', hidden: true }),
];

const handlers = (): SessionListHandlers => ({
  onOpenHistory: vi.fn(),
  onResume: vi.fn(),
  onRename: vi.fn(),
  onMemo: vi.fn(),
  onToggleHidden: vi.fn(),
  onFork: vi.fn(),
  onExport: vi.fn(),
  onDeleteFile: vi.fn(),
});

describe('SessionList', () => {
  it('최근 활동순으로 정렬하고 숨긴 대화는 기본으로 빼다', () => {
    render(<SessionList sessions={sessions} handlers={handlers()} />);
    const titles = screen.getAllByTestId('session-item').map((li) => li.querySelector('.font-medium')?.textContent);
    expect(titles).toEqual(['최근 대화', '오래된 대화']);
  });

  it('숨긴 대화 보기를 켜면 숨김 배지와 함께 보인다', () => {
    render(<SessionList sessions={sessions} showHidden handlers={handlers()} />);
    const items = screen.getAllByTestId('session-item');
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByText('🙈 숨김')).toBeInTheDocument();
  });

  it('상태 배지(글자 포함), 미리보기, 메시지 수를 보여 주고 ▶ 로 이어서 하기', async () => {
    const h = handlers();
    render(<SessionList sessions={sessions} handlers={h} />);
    const first = screen.getAllByTestId('session-item')[0]!;
    expect(within(first).getByText('🟢 지금 열려 있음')).toBeInTheDocument();
    expect(within(first).getByText('“퀴즈 만들어 줘”')).toBeInTheDocument();
    expect(within(first).getByText('메시지 12개')).toBeInTheDocument();
    await userEvent.click(within(first).getByRole('button', { name: '▶ 이어서 하기: 최근 대화' }));
    expect(h.onResume).toHaveBeenCalledWith(expect.objectContaining({ sessionId: '2' }));
  });

  it('더 보기 메뉴에서 숨기기를 고를 수 있다', async () => {
    const h = handlers();
    render(<SessionList sessions={sessions} handlers={h} />);
    await userEvent.click(screen.getByRole('button', { name: '더 보기: 오래된 대화' }));
    await userEvent.click(screen.getByRole('menuitem', { name: '🙈 목록에서 숨기기' }));
    expect(h.onToggleHidden).toHaveBeenCalledWith(expect.objectContaining({ sessionId: '1' }));
  });

  it('visibleSessions는 순수 함수', () => {
    expect(visibleSessions(sessions, false).map((x) => x.sessionId)).toEqual(['2', '1']);
    expect(visibleSessions(sessions, true).map((x) => x.sessionId)).toEqual(['3', '2', '1']);
  });
});
