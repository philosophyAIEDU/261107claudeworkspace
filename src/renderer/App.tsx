import { useEffect, useState } from 'react';
import { ko } from './i18n/ko';
import { api } from './lib/api';
import { AppProvider, useApp } from './context/AppContext';
import { DialogProvider, useDialog } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';
import { TerminalProvider } from './features/terminal/useTerminal';
import { SessionActionsProvider } from './features/sessions/useSessions';
import { SessionSearch } from './features/sessions/SessionSearch';
import { HomePage } from './pages/HomePage';
import { WorkspacePage } from './pages/WorkspacePage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { SetupPage } from './pages/SetupPage';

function Shell(): React.JSX.Element {
  const { route, navigate, info, ui, updateUi, workspaces, searchOpen, setSearchOpen, openHistory, currentWorkspace } = useApp();
  const dialog = useDialog();
  const [booted, setBooted] = useState(false);

  // 처음 켤 때: 첫 실행이거나 Claude가 없으면 확인 화면, 아니면 마지막으로 연 폴더를 복원
  useEffect(() => {
    if (booted || !info || !ui) return;
    setBooted(true);
    void api()
      .invoke('setup:checkClaude', undefined)
      .then((c) => {
        if (!ui.setupDone || !c.found || !info.ptyAvailable) navigate({ page: 'setup' });
        else if (ui.lastWorkspaceId && workspaces.some((w) => w.id === ui.lastWorkspaceId)) navigate({ page: 'workspace', workspaceId: ui.lastWorkspaceId });
      })
      .catch(() => navigate({ page: 'setup' }));
  }, [booted, info, ui, workspaces, navigate]);

  // 앱을 닫을 때 열린 대화가 있으면 확인
  useEffect(() => {
    return api().on('app:closeRequested', ({ openTabs }) => {
      void dialog.confirm({ title: ko.close.title, body: ko.close.body(openTabs), confirmLabel: ko.close.confirm, danger: true }).then((ok) => {
        void api().invoke(ok ? 'app:quit' : 'app:cancelQuit', undefined);
      });
    });
  }, [dialog]);

  // Ctrl+Shift+F: 전체 검색
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen]);

  let page: React.JSX.Element;
  if (route.page === 'setup')
    page = (
      <SetupPage
        onDone={() => {
          updateUi({ setupDone: true });
          navigate({ page: 'home' });
        }}
      />
    );
  else if (route.page === 'settings') page = <SettingsPage />;
  else if (route.page === 'help') page = <HelpPage />;
  else if (route.page === 'workspace' && currentWorkspace) page = <WorkspacePage key={currentWorkspace.id} workspace={currentWorkspace} />;
  else page = <HomePage />;

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col">{page}</div>
      <StatusBar />
      {searchOpen && (
        <SessionSearch
          onClose={() => setSearchOpen(false)}
          onPick={(hit) => {
            setSearchOpen(false);
            openHistory(hit.workspaceId, hit.sessionId);
          }}
        />
      )}
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <ToastProvider>
      <DialogProvider>
        <AppProvider>
          <TerminalProvider>
            <SessionActionsProvider>
              <Shell />
            </SessionActionsProvider>
          </TerminalProvider>
        </AppProvider>
      </DialogProvider>
    </ToastProvider>
  );
}
