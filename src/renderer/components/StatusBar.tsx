import { ko } from '../i18n/ko';
import { useApp } from '../context/AppContext';
import { useTerminal } from '../features/terminal/useTerminal';

/** 아래 상태 바: 현재 폴더 경로 · 대화 이름 · Claude 상태(글자 + 이모지로 표시, 색만 쓰지 않음) */
export function StatusBar(): React.JSX.Element {
  const { currentWorkspace, route } = useApp();
  const { tabs, activeTabId } = useTerminal();
  const ws = route.page === 'workspace' ? currentWorkspace : undefined;
  const mine = tabs.filter((t) => t.workspaceId === ws?.id);
  const tab = mine.find((t) => t.tabId === activeTabId) ?? mine[mine.length - 1];
  const status = tab ? (tab.status === 'working' ? ko.statusBar.working : tab.status === 'waiting' ? ko.statusBar.waiting : ko.statusBar.exited) : '';
  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-line bg-panel-2 px-3 py-1 text-sm" aria-label="상태 표시줄">
      <span className="min-w-0 truncate" title={ws?.path}>
        📁 {ws ? ws.path : ko.statusBar.noFolder}
      </span>
      <span aria-hidden className="text-muted">
        ·
      </span>
      <span className="truncate">💬 {tab ? tab.title : ko.statusBar.noSession}</span>
      {tab && (
        <>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <span role="status" className="shrink-0 font-medium">
            {status}
          </span>
        </>
      )}
    </footer>
  );
}
