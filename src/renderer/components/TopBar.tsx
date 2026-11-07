import { ko } from '../i18n/ko';
import { useApp } from '../context/AppContext';
import { useWorkspaceActions } from '../features/workspaces/useWorkspaces';

export function TopBar(): React.JSX.Element {
  const { route, navigate, setSearchOpen } = useApp();
  const ws = useWorkspaceActions();
  const item = (active: boolean): string =>
    `rounded-lg px-3 py-1.5 text-[0.95rem] font-medium ${active ? 'bg-accent-soft' : 'hover:bg-panel-2'}`;
  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-line bg-panel px-2 py-1.5">
      <span className="mr-2 hidden font-bold text-accent md:inline">🦉 {ko.appName}</span>
      <nav aria-label="주요 메뉴" className="flex flex-wrap items-center gap-1">
        <button type="button" className={item(route.page === 'home')} title={ko.topBar.homeTip} onClick={() => navigate({ page: 'home' })}>
          {ko.topBar.home}
        </button>
        <button type="button" className={item(false)} title={ko.topBar.openFolderTip} onClick={() => void ws.pickAndAdd()}>
          {ko.topBar.openFolder}
        </button>
        <button type="button" className={item(false)} title={ko.topBar.searchTip} onClick={() => setSearchOpen(true)}>
          {ko.topBar.search}
        </button>
        <button type="button" className={item(route.page === 'settings')} onClick={() => navigate({ page: 'settings', workspaceId: route.workspaceId })}>
          {ko.topBar.settings}
        </button>
        <button type="button" className={item(route.page === 'help')} onClick={() => navigate({ page: 'help', workspaceId: route.workspaceId })}>
          {ko.topBar.help}
        </button>
      </nav>
      {ws.dialogs}
    </header>
  );
}
