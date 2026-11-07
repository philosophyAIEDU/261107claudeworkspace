// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionHistoryView } from '../../src/renderer/features/sessions/SessionHistoryView';
import type { HistoryResult } from '../../src/shared/types';

const session = { sessionId: 's', title: '퀴즈 결과 화면 고치기', lastActiveAt: '2026-11-06T00:00:00.000Z', open: false };

describe('SessionHistoryView', () => {
  it('사용자·Claude·도구 요약을 말풍선으로 구분해 그리고, 이어서 하기 버튼을 누를 수 있다', async () => {
    const history: HistoryResult = {
      found: true,
      compacted: false,
      items: [
        { kind: 'user', id: '1', text: '결과 화면에 점수를 보여 줘' },
        { kind: 'tool', id: '2', summary: '파일을 수정했어요: index.html' },
        { kind: 'assistant', id: '3', text: '점수를 보이게 고쳤어요.' },
      ],
    };
    const onResume = vi.fn();
    const { container } = render(<SessionHistoryView session={session} history={history} loading={false} onResume={onResume} />);
    expect(container.querySelector('[data-kind="user"]')).toHaveTextContent('결과 화면에 점수를 보여 줘');
    expect(container.querySelector('[data-kind="tool"]')).toHaveTextContent('파일을 수정했어요: index.html');
    expect(container.querySelector('[data-kind="assistant"]')).toHaveTextContent('점수를 보이게 고쳤어요.');
    await userEvent.click(screen.getByRole('button', { name: '▶ 이 대화 이어서 하기' }));
    expect(onResume).toHaveBeenCalled();
  });

  it('HTML은 해석하지 않고 글자 그대로 보여 준다', () => {
    const history: HistoryResult = { found: true, compacted: false, items: [{ kind: 'assistant', id: '1', text: '<img src=x onerror=alert(1)><b>굵게</b>' }] };
    const { container } = render(<SessionHistoryView session={session} history={history} loading={false} onResume={() => undefined} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)><b>굵게</b>')).toBeInTheDocument();
  });

  it('자동 압축된 대화면 안내를 보여 준다', () => {
    render(<SessionHistoryView session={session} history={{ found: true, compacted: true, items: [{ kind: 'user', id: '1', text: 'a' }] }} loading={false} onResume={() => undefined} />);
    expect(screen.getByRole('note')).toHaveTextContent('앞부분은 요약되어 있어요');
  });

  it('기록을 못 찾으면 안내', () => {
    render(<SessionHistoryView session={session} history={{ found: false, compacted: false, items: [] }} loading={false} onResume={() => undefined} />);
    expect(screen.getByText(/기록 파일을 찾지 못했어요/)).toBeInTheDocument();
  });
});
