import { useEffect, useRef } from 'react';
import { getTerminal } from './terminalRegistry';

/** 미리 만들어 둔 xterm 화면을 이 자리에 붙이고, 크기가 바뀌면 PTY에도 알린다(fit → onResize → pty:resize). */
export function ClaudeTerminal({ tabId, focusKey }: { tabId: string; focusKey?: number }): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const entry = getTerminal(tabId);
    const el = host.current;
    if (!entry || !el) return;
    el.appendChild(entry.element);
    if (!entry.opened) {
      entry.term.open(entry.element);
      entry.opened = true;
    }
    const doFit = (): void => {
      try {
        if (el.clientWidth > 0 && el.clientHeight > 0) entry.fit.fit();
      } catch {
        // 무시
      }
    };
    doFit();
    const ro = new ResizeObserver(() => doFit());
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (entry.element.parentElement === el) el.removeChild(entry.element);
    };
  }, [tabId]);

  useEffect(() => {
    if (focusKey) getTerminal(tabId)?.term.focus();
  }, [focusKey, tabId]);

  return <div ref={host} className="h-full w-full overflow-hidden bg-[#fbfbf8] dark:bg-[#14161b]" aria-label="Claude 터미널" />;
}
