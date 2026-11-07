import { useState } from 'react';
import type { SessionView, WorkspaceView } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { SessionList, type SessionListHandlers } from '../sessions/SessionList';
import { useSessionActions, useSessionList } from '../sessions/useSessions';
import { displayName } from './WorkspaceCard';

function FolderSessions({ ws, showHidden, handlers, activeSessionId }: { ws: WorkspaceView; showHidden: boolean; handlers: SessionListHandlers; activeSessionId?: string }): React.JSX.Element {
  const { sessions } = useSessionList(ws.id, showHidden);
  return <SessionList sessions={sessions} showHidden={showHidden} handlers={handlers} activeSessionId={activeSessionId} />;
}

/** 왼쪽 사이드바 "📂 작업 폴더" 탭: 폴더 → 대화 목록 */
export function WorkspacesSidebar({ current, onOpenHistory, activeSessionId }: { current: WorkspaceView; onOpenHistory: (s: SessionView) => void; activeSessionId?: string }): React.JSX.Element {
  const { workspaces, navigate } = useApp();
  const actions = useSessionActions();
  const toast = useToast();
  const [showHidden, setShowHidden] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([current.id]));

  const handlers: SessionListHandlers = {
    onOpenHistory,
    onResume: (s) => void actions.resume(s.workspaceId, s.sessionId),
    onRename: (s) => void actions.rename(s),
    onMemo: (s) => void actions.editMemo(s),
    onToggleHidden: (s) => void actions.setHidden(s, !s.hidden),
    onFork: (s) => void actions.fork(s.workspaceId, s.sessionId),
    onExport: (s) => void actions.exportMarkdown(s),
    onDeleteFile: (s) => void actions.deleteFile(s),
  };

  const sorted = [...workspaces].sort((a, b) => (a.id === current.id ? -1 : b.id === current.id ? 1 : b.lastActiveAt.localeCompare(a.lastActiveAt)));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          {ko.sidebar.showHidden}
        </label>
        <div className="flex-1" />
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-sm hover:bg-panel-2"
          title={ko.sidebar.syncTip}
          onClick={() => void api().invoke('sessions:sync', undefined).then((r) => toast.show(ko.settings.resyncDone(r.added)))}
        >
          {ko.sidebar.sync}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {sorted.map((ws) => {
          const open = expanded.has(ws.id);
          const isCurrent = ws.id === current.id;
          return (
            <section key={ws.id} className="mb-1">
              <div className={`flex items-center gap-1 rounded-lg px-1 ${isCurrent ? 'bg-panel-2' : ''}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left font-semibold"
                  onClick={() =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(ws.id)) n.delete(ws.id);
                      else n.add(ws.id);
                      return n;
                    })
                  }
                >
                  <span aria-hidden className="w-4 text-xs text-muted">
                    {open ? '▾' : '▸'}
                  </span>
                  {ws.pinned && <span aria-hidden>📌</span>}
                  <span className="truncate" title={ws.path}>
                    {displayName(ws)}
                  </span>
                  <span className="shrink-0 text-xs font-normal text-muted">({ws.sessionCount})</span>
                  {ws.missing && <span className="text-xs text-danger">⚠️</span>}
                </button>
                {!isCurrent && (
                  <button type="button" className="shrink-0 rounded px-1.5 text-sm text-muted hover:bg-panel hover:text-fg" onClick={() => navigate({ page: 'workspace', workspaceId: ws.id })}>
                    {ko.workspaceCard.openOnly}
                  </button>
                )}
                {isCurrent && (
                  <button type="button" className="shrink-0 rounded px-1.5 text-sm text-accent hover:bg-panel" onClick={() => actions.newSession(ws)}>
                    {ko.sidebar.newSession}
                  </button>
                )}
              </div>
              {open && (
                <div className="ml-3 border-l border-line pl-1">
                  <FolderSessions ws={ws} showHidden={showHidden} handlers={handlers} activeSessionId={activeSessionId} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
