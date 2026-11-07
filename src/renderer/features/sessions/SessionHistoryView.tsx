import type { HistoryResult, SessionView } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { Button } from '../../components/Button';
import { HelpTip } from '../../components/Tooltip';
import { relativeTime } from '../../lib/time';

/** 지난 대화를 말풍선으로 보여 주는 읽기 전용 화면. 글은 모두 일반 텍스트로만 그린다(HTML 해석 안 함). */
export function SessionHistoryView({
  session,
  history,
  loading,
  onResume,
  onFork,
  onExport,
}: {
  session: Pick<SessionView, 'title' | 'lastActiveAt' | 'open' | 'sessionId'>;
  history: HistoryResult | null;
  loading: boolean;
  onResume: () => void;
  onFork?: () => void;
  onExport?: () => void;
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-line bg-panel px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">📜 {session.title}</h2>
          <p className="text-sm text-muted">
            {ko.history.title} · {relativeTime(session.lastActiveAt)} · {ko.history.readOnly}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="lg" onClick={onResume}>
          {ko.history.resume}
        </Button>
        {onFork && (
          <span className="flex items-center gap-1">
            <Button onClick={onFork}>{ko.sessions.fork}</Button>
            <HelpTip text={ko.sessions.forkTip} />
          </span>
        )}
        {onExport && <Button onClick={onExport}>{ko.sessions.exportMd}</Button>}
        </div>
      </header>
      <div className="flex-1 overflow-auto px-4 py-4" aria-live="polite">
        {loading && <p className="text-muted">{ko.history.loading}</p>}
        {!loading && history && !history.found && <p className="text-muted">{ko.history.notFound}</p>}
        {!loading && history?.found && history.items.length === 0 && <p className="text-muted">{ko.history.empty}</p>}
        {!loading && history?.compacted && (
          <div role="note" className="mb-4 rounded-lg border border-line bg-accent-soft px-3 py-2">
            {ko.history.compacted}
          </div>
        )}
        <ol className="mx-auto flex max-w-3xl flex-col gap-3">
          {!loading &&
            history?.items.map((item) => {
              if (item.kind === 'compacted') return null;
              if (item.kind === 'tool') {
                return (
                  <li key={item.id} data-kind="tool" className="self-start rounded-md border border-dashed border-line px-3 py-1 text-sm text-muted">
                    {ko.history.tool} {item.summary}
                  </li>
                );
              }
              const mine = item.kind === 'user';
              return (
                <li key={item.id} data-kind={item.kind} className={`flex max-w-[85%] flex-col ${mine ? 'self-end items-end' : 'self-start'}`}>
                  <span className="mb-0.5 text-xs font-semibold text-muted">{mine ? ko.history.you : ko.history.claude}</span>
                  <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2 ${mine ? 'bg-accent text-accent-fg' : 'border border-line bg-panel'}`}>{item.text}</div>
                </li>
              );
            })}
        </ol>
      </div>
    </div>
  );
}
