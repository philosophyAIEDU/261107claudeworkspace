import { useEffect, useMemo } from 'react';
import type { WorkspaceView } from '../../shared/types';
import { ko } from '../i18n/ko';
import { useApp } from '../context/AppContext';
import { useDialog } from '../components/ConfirmDialog';
import { ResizeHandle } from '../components/Layout';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';
import { ClaudePanel } from '../features/terminal/ClaudePanel';
import { WorkspacesSidebar } from '../features/workspaces/WorkspacesSidebar';
import { FileTree } from '../features/editor/FileTree';
import { EditorTabs } from '../features/editor/EditorTabs';
import { MonacoPane } from '../features/editor/MonacoPane';
import { Preview } from '../features/editor/Preview';
import { previewKind } from '../features/editor/languages';
import { isDirty, useFiles, type FileTab } from '../features/editor/useFiles';
import { HistoryPane } from '../features/sessions/HistoryPane';
import { useSessionList } from '../features/sessions/useSessions';
import { useWorkspaceActions } from '../features/workspaces/useWorkspaces';

function FileView({
  tab,
  files,
  fontSize,
  dark,
}: {
  tab: FileTab;
  files: ReturnType<typeof useFiles>;
  fontSize: number;
  dark: boolean;
}): React.JSX.Element {
  const dirty = isDirty(tab);
  const pk = previewKind(tab.path);
  if (tab.tooLarge) return <EmptyState icon="📦" title={ko.editor.tooLarge} />;
  if (tab.binary) return <EmptyState icon="🖼️" title={ko.editor.binary} />;
  return (
    <div className="flex h-full flex-col">
      {tab.external && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-3 py-2">
          <span className="flex-1">
            {tab.external === 'deleted' ? ko.editor.deletedOutside : dirty ? ko.editor.changedOutsideDirty : ko.editor.changedOutside}
          </span>
          {tab.external === 'changed' && (
            <Button size="sm" variant={dirty ? 'secondary' : 'primary'} onClick={() => void files.reload(tab.key)}>
              {dirty ? ko.editor.reloadDiscard : ko.editor.reload}
            </Button>
          )}
          <Button size="sm" onClick={() => files.dismissExternal(tab.key)}>
            {dirty ? ko.editor.keepMine : ko.common.close}
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-line px-2 py-1 text-sm">
        <span className="truncate text-muted" title={tab.path}>
          {tab.path}
        </span>
        <div className="flex-1" />
        {dirty && <span className="text-accent">● {ko.editor.unsaved}</span>}
        {pk && (
          <Button size="sm" onClick={() => files.togglePreview(tab.key)}>
            {tab.preview ? ko.editor.code : ko.editor.preview}
          </Button>
        )}
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={() => void files.save(tab.key)} title={ko.editor.saveTip}>
          {ko.common.save}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {tab.preview && pk ? (
          <Preview kind={pk} content={tab.content} />
        ) : (
          <MonacoPane path={tab.path} value={tab.content} fontSize={fontSize} dark={dark} onChange={(v) => files.updateContent(tab.key, v)} onSave={() => void files.save(tab.key)} />
        )}
      </div>
    </div>
  );
}

export function WorkspacePage({ workspace }: { workspace: WorkspaceView }): React.JSX.Element {
  const { ui, updateUi, settings, isDark, historyRequest } = useApp();
  const dialog = useDialog();
  const files = useFiles(workspace);
  const wsActions = useWorkspaceActions();
  const { sessions } = useSessionList(workspace.id, true);

  useEffect(() => {
    if (historyRequest) files.openHistory(historyRequest.sessionId);
  }, [historyRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTab = files.tabs.find((t) => t.key === files.activeKey) ?? null;
  const activeSessionId = activeTab?.kind === 'history' ? activeTab.sessionId : undefined;
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.sessionId, s])), [sessions]);

  const sidebarWidth = ui?.sidebarWidth ?? 280;
  const panelSize = ui?.claudePanelSize ?? 520;
  const sidebarCollapsed = ui?.sidebarCollapsed ?? false;
  const panelCollapsed = ui?.claudePanelCollapsed ?? false;
  const position = settings?.terminalPosition ?? 'right';
  const editorFont = Math.round(14 * (settings?.fontScale.editor ?? 1));

  const closeCenterTab = async (key: string): Promise<void> => {
    const t = files.tabs.find((x) => x.key === key);
    if (t && isDirty(t)) {
      const ok = await dialog.confirm({ title: ko.editor.closeUnsavedTitle, body: ko.editor.closeUnsavedBody, confirmLabel: ko.editor.closeWithoutSave, danger: true });
      if (!ok) return;
    }
    files.closeTab(key);
  };

  const sidebar = sidebarCollapsed ? (
    <div className="flex w-10 shrink-0 flex-col items-center border-r border-line bg-panel py-2">
      <button type="button" className="rounded p-1 hover:bg-panel-2" aria-label={ko.sidebar.expand} title={ko.sidebar.expand} onClick={() => updateUi({ sidebarCollapsed: false })}>
        ⇥
      </button>
    </div>
  ) : (
    <>
      <aside className="flex shrink-0 flex-col border-r border-line bg-panel" style={{ width: sidebarWidth }} aria-label="사이드바">
        <div role="tablist" className="flex items-center gap-1 border-b border-line p-1">
          {(
            [
              ['workspaces', ko.sidebar.workspacesTab],
              ['files', ko.sidebar.filesTab],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ui?.sidebarTab === id}
              className={`flex-1 rounded-md px-2 py-1 text-sm font-semibold ${ui?.sidebarTab === id ? 'bg-accent-soft' : 'hover:bg-panel-2'}`}
              onClick={() => updateUi({ sidebarTab: id })}
            >
              {label}
            </button>
          ))}
          <button type="button" className="rounded px-1.5 py-1 text-sm hover:bg-panel-2" aria-label={ko.sidebar.collapse} title={ko.sidebar.collapse} onClick={() => updateUi({ sidebarCollapsed: true })}>
            ⇤
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {ui?.sidebarTab === 'files' ? (
            <FileTree
              workspace={workspace}
              onOpen={(p) => void files.openFile(p)}
              recentlyChanged={files.recentlyChanged}
              version={files.treeVersion}
              activePath={activeTab?.kind === 'file' ? activeTab.path : undefined}
              onRenamed={files.renamePath}
            />
          ) : (
            <WorkspacesSidebar current={workspace} onOpenHistory={(s) => files.openHistory(s.sessionId)} activeSessionId={activeSessionId} />
          )}
        </div>
      </aside>
      <ResizeHandle direction="x" value={sidebarWidth} min={180} max={600} onChange={(v) => updateUi({ sidebarWidth: v })} label="사이드바 크기 조절" />
    </>
  );

  const center = (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg" aria-label="편집기">
      <EditorTabs
        tabs={files.tabs}
        activeKey={files.activeKey}
        onSelect={files.setActiveKey}
        onClose={(k) => void closeCenterTab(k)}
        titleFor={(t) => (t.kind === 'history' ? (sessionById.get(t.sessionId)?.title ?? ko.history.title) : '')}
      />
      <div className="min-h-0 flex-1">
        {workspace.missing ? (
          <EmptyState icon="⚠️" title={ko.workspaceCard.missing} body={ko.workspaceCard.missingBody}>
            <Button variant="primary" onClick={() => void wsActions.relocate(workspace)}>
              {ko.workspaceCard.relocate}
            </Button>
          </EmptyState>
        ) : !activeTab ? (
          <EmptyState icon="📝" title={ko.editor.empty} />
        ) : activeTab.kind === 'history' ? (
          sessionById.get(activeTab.sessionId) ? <HistoryPane session={sessionById.get(activeTab.sessionId)!} /> : <EmptyState icon="📜" title={ko.common.loading} />
        ) : (
          <FileView tab={activeTab} files={files} fontSize={editorFont} dark={isDark} />
        )}
      </div>
    </main>
  );

  const panel = panelCollapsed ? (
    <div className={`flex shrink-0 items-center border-line bg-panel ${position === 'right' ? 'w-10 flex-col border-l py-2' : 'h-9 border-t px-2'}`}>
      <button type="button" className="rounded p-1 text-sm hover:bg-panel-2" aria-label={ko.terminal.expand} title={ko.terminal.expand} onClick={() => updateUi({ claudePanelCollapsed: false })}>
        🤖 {position === 'bottom' && ko.terminal.expand}
      </button>
    </div>
  ) : (
    <>
      <ResizeHandle
        direction={position === 'right' ? 'x' : 'y'}
        value={panelSize}
        min={260}
        max={1400}
        invert
        onChange={(v) => updateUi({ claudePanelSize: v })}
        label="클로드 패널 크기 조절"
      />
      <div className={`flex min-h-0 min-w-0 shrink-0 ${position === 'right' ? 'border-l' : 'border-t'} border-line`} style={position === 'right' ? { width: panelSize } : { height: panelSize }}>
        <ClaudePanel workspace={workspace} onCollapse={() => updateUi({ claudePanelCollapsed: true })} />
      </div>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {sidebar}
      {position === 'right' ? (
        <>
          {center}
          {panel}
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {center}
          {panel}
        </div>
      )}
      {wsActions.dialogs}
    </div>
  );
}
