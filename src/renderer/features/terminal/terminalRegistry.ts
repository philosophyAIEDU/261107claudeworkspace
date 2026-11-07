import { Terminal, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { api } from '../../lib/api';

// xterm 화면은 탭마다 하나씩 만들어 두고, 화면 전환(처음 화면 ↔ 작업 화면)을 해도 버리지 않는다.
// React 컴포넌트가 다시 그려질 때는 미리 만든 DOM 조각을 옮겨 붙이기만 한다.

export interface TermEntry {
  term: Terminal;
  fit: FitAddon;
  element: HTMLDivElement;
  opened: boolean;
}

const entries = new Map<string, TermEntry>();

export const darkTheme: ITheme = {
  background: '#14161b',
  foreground: '#e8eaee',
  cursor: '#e5b34b',
  selectionBackground: '#3e4a61',
};
export const lightTheme: ITheme = {
  background: '#fbfbf8',
  foreground: '#1d1f24',
  cursor: '#8a5a00',
  selectionBackground: '#cfd8ea',
  black: '#1d1f24',
  white: '#6b6f78',
  brightWhite: '#3a3d44',
  yellow: '#8a6100',
  brightYellow: '#7a5600',
  green: '#1f7a3a',
  brightGreen: '#1a6a32',
  cyan: '#0b6e79',
  brightCyan: '#095e68',
};

export function createTerminal(tabId: string, fontSize: number, dark: boolean): TermEntry {
  const existing = entries.get(tabId);
  if (existing) return existing;
  const term = new Terminal({
    fontSize,
    fontFamily: '"D2Coding", "Cascadia Mono", Consolas, Menlo, "Noto Sans Mono CJK KR", monospace',
    cursorBlink: true,
    scrollback: 10000,
    allowProposedApi: true, // unicode11 애드온에 필요
    theme: dark ? darkTheme : lightTheme,
    macOptionIsMeta: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  // 한글은 화면에서 영문 두 칸을 차지한다. 유니코드 11 기준 폭 계산을 켜야 줄이 어긋나지 않는다.
  const unicode = new Unicode11Addon();
  term.loadAddon(unicode);
  term.unicode.activeVersion = '11';
  term.loadAddon(
    new WebLinksAddon((_e, uri) => {
      if (/^https:\/\//.test(uri)) void api().invoke('shell:openExternal', { url: uri }).catch(() => undefined);
    }),
  );
  const element = document.createElement('div');
  element.style.height = '100%';
  element.style.width = '100%';
  const entry: TermEntry = { term, fit, element, opened: false };
  entries.set(tabId, entry);
  return entry;
}

export function getTerminal(tabId: string): TermEntry | undefined {
  return entries.get(tabId);
}

export function disposeTerminal(tabId: string): void {
  const e = entries.get(tabId);
  if (!e) return;
  e.term.dispose();
  e.element.remove();
  entries.delete(tabId);
}

export function allTerminals(): TermEntry[] {
  return [...entries.values()];
}

/** 터미널에 보이는(스크롤 포함) 글자를 모두 꺼낸다. */
export function terminalText(tabId: string): string {
  const e = entries.get(tabId);
  if (!e) return '';
  const buf = e.term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buf.length; i++) lines.push(buf.getLine(i)?.translateToString(true) ?? '');
  return lines.join('\n').replace(/\n+$/, '');
}
