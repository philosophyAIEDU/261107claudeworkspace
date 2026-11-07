import type { SessionView } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { relativeTime } from '../../lib/time';
import { Menu, type MenuItem } from '../../components/Menu';

export interface SessionListHandlers {
  onOpenHistory: (s: SessionView) => void;
  onResume: (s: SessionView) => void;
  onRename: (s: SessionView) => void;
  onMemo: (s: SessionView) => void;
  onToggleHidden: (s: SessionView) => void;
  onFork: (s: SessionView) => void;
  onExport: (s: SessionView) => void;
  onDeleteFile: (s: SessionView) => void;
}

/** 최근 활동순으로 정렬하고, 숨긴 대화는 showHidden일 때만 보인다(순수 함수 — 테스트용). */
export function visibleSessions(sessions: readonly SessionView[], showHidden: boolean): SessionView[] {
  return sessions.filter((s) => showHidden || !s.hidden).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

export function SessionList({
  sessions,
  showHidden = false,
  activeSessionId,
  handlers,
  now,
}: {
  sessions: readonly SessionView[];
  showHidden?: boolean;
  activeSessionId?: string;
  handlers: SessionListHandlers;
  now?: Date;
}): React.JSX.Element {
  const list = visibleSessions(sessions, showHidden);
  if (list.length === 0) return <p className="px-3 py-2 text-sm text-muted">{ko.sessions.empty}</p>;
  return (
    <ul className="flex flex-col gap-0.5" aria-label="대화 목록">
      {list.map((s) => {
        const items: MenuItem[] = [
          { label: ko.sessions.viewHistory, onSelect: () => handlers.onOpenHistory(s) },
          { label: ko.sessions.rename, onSelect: () => handlers.onRename(s) },
          { label: ko.sessions.memo, onSelect: () => handlers.onMemo(s) },
          { label: s.hidden ? ko.sessions.unhide : ko.sessions.hide, onSelect: () => handlers.onToggleHidden(s) },
          { label: ko.sessions.fork, hint: ko.sessions.forkTip, onSelect: () => handlers.onFork(s), separatorBefore: true },
          { label: ko.sessions.exportMd, onSelect: () => handlers.onExport(s) },
          { label: ko.sessions.deleteFile, danger: true, onSelect: () => handlers.onDeleteFile(s), separatorBefore: true },
        ];
        const active = s.sessionId === activeSessionId;
        return (
          <li key={s.sessionId} data-testid="session-item" className={`group rounded-lg ${active ? 'bg-accent-soft' : 'hover:bg-panel-2'}`}>
            <div className="flex items-start gap-1 px-2 py-1.5">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => handlers.onOpenHistory(s)} title={s.memo ?? s.firstPrompt}>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{s.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span>{s.open ? ko.sessions.open : ko.sessions.idle}</span>
                  <span>{relativeTime(s.lastActiveAt, now)}</span>
                  {s.messageCount !== undefined && <span>{ko.sessions.messages(s.messageCount)}</span>}
                  {s.hidden && <span>{ko.sessions.hiddenBadge}</span>}
                </div>
                {s.firstPrompt && <div className="truncate text-sm text-muted">“{s.firstPrompt}”</div>}
                {s.memo && <div className="truncate text-sm">📝 {s.memo}</div>}
              </button>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  className="rounded-md px-1.5 py-1 text-sm text-accent hover:bg-panel"
                  title={ko.sessions.resume}
                  aria-label={`${ko.sessions.resume}: ${s.title}`}
                  onClick={() => handlers.onResume(s)}
                >
                  ▶
                </button>
                <Menu label={`${ko.common.more}: ${s.title}`} items={items} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
