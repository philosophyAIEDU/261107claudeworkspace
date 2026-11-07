import { ko } from '../../i18n/ko';
import type { TerminalTab } from './useTerminal';

const statusLabel = (t: TerminalTab): string =>
  t.status === 'working' ? ko.terminal.statusWorking : t.status === 'waiting' ? ko.terminal.statusWaiting : ko.terminal.statusExited;

/** 여러 대화를 탭으로. 상태는 색 점과 글자(작업 중/입력 대기)로 함께 보여 준다. */
export function TerminalTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
}: {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}): React.JSX.Element {
  return (
    <div role="tablist" aria-label="열린 대화" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.tabId === activeTabId;
        const dot = t.status === 'working' ? 'bg-amber-500 animate-pulse' : t.status === 'waiting' ? 'bg-green-500' : 'bg-gray-400';
        return (
          <div
            key={t.tabId}
            className={`group flex max-w-[16rem] shrink-0 items-center rounded-t-lg border border-b-0 ${active ? 'border-line bg-bg' : 'border-transparent bg-panel-2'}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={`${t.title} · ${statusLabel(t)}`}
              className="flex min-w-0 items-center gap-1.5 py-1 pl-2.5 pr-1 text-sm"
              onClick={() => onSelect(t.tabId)}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
              <span className="truncate">{t.title}</span>
              <span className="sr-only">({statusLabel(t)})</span>
              <span className="shrink-0 text-xs text-muted" aria-hidden>
                {t.status === 'working' ? '⏳' : t.status === 'waiting' ? '⌨️' : '⏹'}
              </span>
            </button>
            <button
              type="button"
              aria-label={`${ko.terminal.closeTab}: ${t.title}`}
              className="mr-1 rounded px-1 text-muted hover:bg-panel hover:text-fg"
              onClick={() => onClose(t.tabId)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
