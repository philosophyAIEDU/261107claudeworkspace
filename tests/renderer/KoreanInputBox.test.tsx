// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KoreanInputBox } from '../../src/renderer/features/terminal/KoreanInputBox';

const setup = (history: string[] = []) => {
  const onSend = vi.fn().mockResolvedValue(undefined);
  render(<KoreanInputBox onSend={onSend} quickPhrases={['지금까지 한 일을 정리해 줘']} history={history} />);
  const box = screen.getByRole('textbox', { name: /한글 입력창/ });
  const button = screen.getByRole('button', { name: '보내기' });
  return { onSend, box, button };
};

describe('KoreanInputBox', () => {
  it('빈 입력은 보낼 수 없다', async () => {
    const { onSend, box, button } = setup();
    expect(button).toBeDisabled();
    await userEvent.type(box, '   ');
    expect(button).toBeDisabled();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter로 보내고 입력창을 비운다 (그냥 Enter는 줄바꿈)', async () => {
    const { onSend, box } = setup();
    await userEvent.type(box, '첫 줄{Enter}둘째 줄');
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(onSend).toHaveBeenCalledWith('첫 줄\n둘째 줄');
    expect(box).toHaveValue('');
  });

  it('한글 조합 중의 Enter는 무시한다', () => {
    const { onSend, box } = setup();
    fireEvent.change(box, { target: { value: '한' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('[보내기] 버튼과 자주 쓰는 문장 버튼', async () => {
    const { onSend, box, button } = setup();
    await userEvent.click(screen.getByRole('button', { name: '지금까지 한 일을 정리해 줘' }));
    expect(box).toHaveValue('지금까지 한 일을 정리해 줘');
    await userEvent.click(button);
    expect(onSend).toHaveBeenCalledWith('지금까지 한 일을 정리해 줘');
  });

  it('↑ 키로 최근 보낸 문장을 불러온다', () => {
    const { box } = setup(['예전 문장 1', '예전 문장 2']);
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(box).toHaveValue('예전 문장 2');
  });
});
