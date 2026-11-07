import { describe, expect, it, vi } from 'vitest';
import { canSend, encodeBody, encodeInput, sendToClaude } from '../../src/renderer/features/terminal/sendToClaude';

describe('한글 입력창 전송 인코딩', () => {
  it('한 줄: 그대로 + Enter(\\r)', () => {
    expect(encodeInput('안녕하세요, 퀴즈 앱을 만들어 줘')).toBe('안녕하세요, 퀴즈 앱을 만들어 줘\r');
  });

  it('여러 줄: bracketed paste로 감싼 뒤 Enter', () => {
    expect(encodeInput('첫째 줄\n둘째 줄')).toBe('\x1b[200~첫째 줄\n둘째 줄\x1b[201~\r');
  });

  it('Windows 줄바꿈(\\r\\n)도 \\n으로 맞추고 끝의 공백은 지운다', () => {
    expect(encodeInput('a\r\nb\r\n\r\n  ')).toBe('\x1b[200~a\nb\x1b[201~\r');
  });

  it('글 안에 붙여넣기 끝 표시가 섞여 있으면 지운다', () => {
    expect(encodeBody('x\x1b[201~\ny')).toBe('\x1b[200~x\ny\x1b[201~');
  });

  it('빈 입력은 보낼 수 없다', () => {
    expect(canSend('   \n ')).toBe(false);
    expect(canSend('가')).toBe(true);
  });

  it('sendToClaude: 본문 다음에 Enter를 따로 보낸다', async () => {
    const write = vi.fn();
    await sendToClaude(write, '두 줄\n입력', 0);
    expect(write.mock.calls.map((c) => c[0])).toEqual(['\x1b[200~두 줄\n입력\x1b[201~', '\r']);
    write.mockClear();
    await sendToClaude(write, '   ', 0);
    expect(write).not.toHaveBeenCalled();
  });
});
