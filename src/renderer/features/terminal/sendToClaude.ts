// 한글 입력창에서 쓴 글을 터미널(PTY)로 보낼 때의 인코딩.
//
// 왜 입력창을 따로 두나: xterm 안에서 한글을 조합(IME)하면 글자가 겹치거나 빠지는 일이 있다.
// 일반 <textarea>는 운영체제의 한글 입력을 그대로 쓰므로 안전하고, 초보자에게도 익숙하다.
//
// 왜 bracketed paste로 감싸나: 여러 줄을 그냥 보내면 줄바꿈마다 Enter로 처리되어
// 문장이 줄마다 쪼개져 따로 제출된다. 붙여넣기 시작(\x1b[200~)과 끝(\x1b[201~) 표시로 감싸면
// Claude Code가 "한 덩어리로 붙여 넣은 글"로 받아들인다. 그 뒤에 Enter(\r)를 보내 제출한다.

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

/** 줄바꿈을 \n으로 통일하고 앞뒤 빈 줄을 정리한다. */
export function normalizeInput(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
}

/** 본문 부분(제출 Enter 제외) */
export function encodeBody(text: string): string {
  const t = normalizeInput(text);
  // 붙여넣기 끝 표시가 글 안에 섞여 있으면 붙여넣기가 일찍 끝나 버리므로 제거한다.
  const safe = t.split(PASTE_END).join('').split(PASTE_START).join('');
  return safe.includes('\n') ? `${PASTE_START}${safe}${PASTE_END}` : safe;
}

export function encodeInput(text: string): string {
  return `${encodeBody(text)}\r`;
}

export function canSend(text: string): boolean {
  return normalizeInput(text).length > 0;
}

/**
 * 실제 전송. 본문과 Enter를 아주 잠깐 띄워 보낸다.
 * (한 번에 보내면 일부 터미널 프로그램이 Enter까지 붙여넣기의 일부로 여길 수 있어서)
 */
export async function sendToClaude(write: (data: string) => Promise<void> | void, text: string, delayMs = 40): Promise<void> {
  if (!canSend(text)) return;
  await write(encodeBody(text));
  await new Promise((r) => setTimeout(r, delayMs));
  await write('\r');
}
