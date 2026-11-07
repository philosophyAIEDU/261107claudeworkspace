import { useEffect, useState } from 'react';
import type { HistoryResult, SessionView } from '../../../shared/types';
import { api } from '../../lib/api';
import { SessionHistoryView } from './SessionHistoryView';
import { useSessionActions } from './useSessions';

/** 가운데 영역의 "대화 기록" 탭: 기록을 불러와 말풍선으로 보여 준다. */
export function HistoryPane({ session }: { session: SessionView }): React.JSX.Element {
  const actions = useSessionActions();
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api()
      .invoke('sessions:history', { sessionId: session.sessionId })
      .then((r) => !cancelled && setHistory(r))
      .catch(() => !cancelled && setHistory({ items: [], compacted: false, found: false }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.sessionId, session.lastActiveAt]);
  return (
    <SessionHistoryView
      session={session}
      history={history}
      loading={loading}
      onResume={() => void actions.resume(session.workspaceId, session.sessionId)}
      onFork={() => void actions.fork(session.workspaceId, session.sessionId)}
      onExport={() => void actions.exportMarkdown(session)}
    />
  );
}
