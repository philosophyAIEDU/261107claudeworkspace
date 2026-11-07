// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceCard, type WorkspaceCardHandlers } from '../../src/renderer/features/workspaces/WorkspaceCard';
import { filterAndSortWorkspaces } from '../../src/renderer/features/workspaces/WorkspaceList';
import type { WorkspaceView } from '../../src/shared/types';

const handlers = (): WorkspaceCardHandlers => ({
  onResume: vi.fn(),
  onNewSession: vi.fn(),
  onOpenOnly: vi.fn(),
  onTogglePin: vi.fn(),
  onEditInfo: vi.fn(),
  onRemove: vi.fn(),
  onRelocate: vi.fn(),
});

const base: WorkspaceView = {
  id: 'w1',
  path: 'C:\\Users\\홍길동\\문서\\필로소피 Claude 작업실\\영어단어앱',
  alias: '3학년 영어 단어 앱',
  pinned: true,
  lastOpenedAt: '2026-11-04T00:00:00.000Z',
  lastActiveAt: '2026-11-04T00:00:00.000Z',
  sessionCount: 4,
  lastSessionTitle: '퀴즈 결과 화면 고치기',
  lastSessionId: 's1',
};

describe('WorkspaceCard', () => {
  it('별칭·경로·마지막 작업·대화 수·최근 대화를 보여 주고, [이어서 작업하기]를 누르면 호출된다', async () => {
    const h = handlers();
    render(<WorkspaceCard workspace={base} handlers={h} now={new Date('2026-11-07T00:00:00.000Z')} />);
    expect(screen.getByRole('heading', { name: /3학년 영어 단어 앱/ })).toBeInTheDocument();
    expect(screen.getByText(base.path)).toBeInTheDocument();
    expect(screen.getByText(/마지막 작업: 3일 전 · 대화 4개/)).toBeInTheDocument();
    expect(screen.getByText('최근 대화: "퀴즈 결과 화면 고치기"')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '▶ 이어서 작업하기' }));
    expect(h.onResume).toHaveBeenCalledWith(base);
    await userEvent.click(screen.getByRole('button', { name: '＋ 새 대화' }));
    expect(h.onNewSession).toHaveBeenCalled();
  });

  it('경로가 없으면 "폴더를 찾을 수 없어요"와 [새 위치 지정]/[목록에서 빼기]를 보여 준다', async () => {
    const h = handlers();
    render(<WorkspaceCard workspace={{ ...base, missing: true }} handlers={h} />);
    expect(screen.getByRole('alert')).toHaveTextContent('폴더를 찾을 수 없어요');
    expect(screen.queryByRole('button', { name: '▶ 이어서 작업하기' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: '📍 새 위치 지정' })[0]!);
    expect(h.onRelocate).toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('button', { name: '🗑 목록에서 빼기' })[0]!);
    expect(h.onRemove).toHaveBeenCalled();
  });
});

describe('filterAndSortWorkspaces', () => {
  const list: WorkspaceView[] = [
    { ...base, id: 'a', alias: '나 폴더', pinned: false, lastActiveAt: '2026-11-06T00:00:00.000Z', memo: '연구' },
    { ...base, id: 'b', alias: '가 폴더', pinned: true, lastActiveAt: '2026-11-01T00:00:00.000Z', memo: '1학기 수업' },
    { ...base, id: 'c', alias: '다 폴더', pinned: false, lastActiveAt: '2026-11-03T00:00:00.000Z' },
  ];
  it('최근순 / 이름순 / 고정 먼저', () => {
    expect(filterAndSortWorkspaces(list, '', 'recent').map((w) => w.id)).toEqual(['a', 'c', 'b']);
    expect(filterAndSortWorkspaces(list, '', 'name').map((w) => w.id)).toEqual(['b', 'a', 'c']);
    expect(filterAndSortWorkspaces(list, '', 'pinned').map((w) => w.id)).toEqual(['b', 'a', 'c']);
  });
  it('이름·메모로 검색', () => {
    expect(filterAndSortWorkspaces(list, '수업', 'recent').map((w) => w.id)).toEqual(['b']);
    expect(filterAndSortWorkspaces(list, '다 폴', 'recent').map((w) => w.id)).toEqual(['c']);
  });
});
