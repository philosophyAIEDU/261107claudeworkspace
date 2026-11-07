import { useEffect, useMemo, useState } from 'react';
import type { HomeSort } from '../../shared/types';
import { ko } from '../i18n/ko';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { WorkspaceList, filterAndSortWorkspaces } from '../features/workspaces/WorkspaceList';
import type { WorkspaceCardHandlers } from '../features/workspaces/WorkspaceCard';
import { useWorkspaceActions } from '../features/workspaces/useWorkspaces';
import { useSessionActions } from '../features/sessions/useSessions';
import { ImportPanel } from '../features/sessions/ImportPanel';

export function HomePage(): React.JSX.Element {
  const { workspaces, ui, updateUi, navigate, info } = useApp();
  const wsActions = useWorkspaceActions();
  const sessionActions = useSessionActions();
  const [query, setQuery] = useState('');
  const [importCount, setImportCount] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const sort: HomeSort = ui?.homeSort ?? 'recent';

  useEffect(() => {
    void api().invoke('workspaces:refreshMissing', undefined).catch(() => undefined);
    void api()
      .invoke('sessions:importScan', undefined)
      .then((r) => setImportCount(r.candidates.filter((c) => c.exists).length))
      .catch(() => undefined);
  }, [workspaces.length]);

  useEffect(() => {
    if (info?.dataResetNotice) setResetNotice(true);
  }, [info]);

  const list = useMemo(() => filterAndSortWorkspaces(workspaces, query, sort), [workspaces, query, sort]);

  const handlers: WorkspaceCardHandlers = {
    onResume: (w) => void sessionActions.continueLatest(w),
    onNewSession: (w) => sessionActions.newSession(w),
    onOpenOnly: (w) => navigate({ page: 'workspace', workspaceId: w.id }),
    onTogglePin: (w) => void wsActions.togglePin(w),
    onEditInfo: (w) => wsActions.editInfo(w),
    onRemove: (w) => void wsActions.remove(w),
    onRelocate: (w) => void wsActions.relocate(w),
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="text-2xl font-bold">{ko.home.title}</h1>
        {resetNotice && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-accent-soft p-3">
            <span className="flex-1">{ko.home.dataReset}</span>
            <Button size="sm" onClick={() => setResetNotice(false)}>
              {ko.common.close}
            </Button>
          </div>
        )}
        {importCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-3">
            <span className="flex-1">📥 {ko.home.importBanner(importCount)}</span>
            <Button variant="primary" onClick={() => setImportOpen(true)}>
              {ko.home.importBannerButton}
            </Button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold">{ko.home.subtitle}</h2>
          <input
            type="search"
            aria-label={ko.home.searchPlaceholder}
            placeholder={ko.home.searchPlaceholder}
            className="w-64 rounded-lg border border-line bg-panel px-3 py-1.5"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="flex items-center gap-1.5">
            <span className="text-sm text-muted">{ko.home.sortLabel}</span>
            <select className="rounded-lg border border-line bg-panel px-2 py-1.5" value={sort} onChange={(e) => updateUi({ homeSort: e.target.value as HomeSort })}>
              <option value="recent">{ko.home.sortRecent}</option>
              <option value="name">{ko.home.sortName}</option>
              <option value="pinned">{ko.home.sortPinned}</option>
            </select>
          </label>
          <Button onClick={() => void wsActions.pickAndAdd()}>{ko.home.openFolder}</Button>
          <Button variant="primary" onClick={() => void wsActions.createNew()}>
            {ko.home.newFolder}
          </Button>
        </div>
        <div className="mt-4">
          {workspaces.length === 0 ? (
            <EmptyState icon="📂" title={ko.home.emptyTitle} body={ko.home.emptyBody}>
              <Button onClick={() => void wsActions.pickAndAdd()}>{ko.home.openFolder}</Button>
              <Button variant="primary" onClick={() => void wsActions.createNew()}>
                {ko.home.newFolder}
              </Button>
            </EmptyState>
          ) : list.length === 0 ? (
            <p className="text-muted">{ko.home.noMatch}</p>
          ) : (
            <WorkspaceList workspaces={list} handlers={handlers} />
          )}
        </div>
      </div>
      {importOpen && (
        <Modal title={ko.setup.importTitle} onClose={() => setImportOpen(false)} wide>
          <ImportPanel
            onDone={() => {
              setImportOpen(false);
              setImportCount(0);
            }}
          />
        </Modal>
      )}
      {wsActions.dialogs}
    </div>
  );
}
