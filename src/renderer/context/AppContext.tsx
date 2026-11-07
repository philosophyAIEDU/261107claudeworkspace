import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppInfo, AppSettings, UiState, WorkspaceView } from '../../shared/types';
import { api } from '../lib/api';

export type Page = 'setup' | 'home' | 'workspace' | 'settings' | 'help';

export interface Route {
  page: Page;
  workspaceId?: string;
}

interface AppContextValue {
  info: AppInfo | null;
  settings: AppSettings | null;
  ui: UiState | null;
  workspaces: WorkspaceView[];
  route: Route;
  navigate: (r: Route) => void;
  refreshWorkspaces: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  updateUi: (patch: Partial<UiState>) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  /** 다른 화면에서 "이 대화 기록 보기"를 요청할 때 */
  historyRequest: { sessionId: string; nonce: number } | null;
  openHistory: (workspaceId: string, sessionId: string) => void;
  currentWorkspace: WorkspaceView | undefined;
  isDark: boolean;
}

const Ctx = createContext<AppContextValue | null>(null);

function usePrefersDark(): boolean {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return;
    const l = (e: MediaQueryListEvent): void => setDark(e.matches);
    query.addEventListener('change', l);
    return () => query.removeEventListener('change', l);
  }, [query]);
  return dark;
}

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ui, setUi] = useState<UiState | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceView[]>([]);
  const [route, setRoute] = useState<Route>({ page: 'home' });
  const [searchOpen, setSearchOpen] = useState(false);
  const [historyRequest, setHistoryRequest] = useState<AppContextValue['historyRequest']>(null);
  const prefersDark = usePrefersDark();
  const uiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiPending = useRef<Partial<UiState>>({});

  const refreshWorkspaces = useCallback(async () => {
    setWorkspaces(await api().invoke('workspaces:list', undefined));
  }, []);

  useEffect(() => {
    void (async () => {
      const [i, s, u] = await Promise.all([
        api().invoke('app:getInfo', undefined),
        api().invoke('settings:get', undefined),
        api().invoke('ui:get', undefined),
      ]);
      setInfo(i);
      setSettings(s);
      setUi(u);
      await refreshWorkspaces();
    })();
    const off = api().on('workspaces:changed', () => void refreshWorkspaces());
    return off;
  }, [refreshWorkspaces]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    setSettings(await api().invoke('settings:update', patch));
  }, []);

  // 화면 상태(패널 크기 등)는 자주 바뀌므로 모아서 0.4초 뒤에 저장한다.
  const updateUi = useCallback((patch: Partial<UiState>) => {
    setUi((u) => (u ? { ...u, ...patch } : u));
    uiPending.current = { ...uiPending.current, ...patch };
    if (uiTimer.current) clearTimeout(uiTimer.current);
    uiTimer.current = setTimeout(() => {
      const p = uiPending.current;
      uiPending.current = {};
      void api().invoke('ui:update', p);
    }, 400);
  }, []);

  const navigate = useCallback(
    (r: Route) => {
      setRoute(r);
      if (r.page === 'workspace' && r.workspaceId) {
        void api().invoke('workspaces:touch', { id: r.workspaceId }).catch(() => undefined);
      }
    },
    [],
  );

  const openHistory = useCallback(
    (workspaceId: string, sessionId: string) => {
      navigate({ page: 'workspace', workspaceId });
      setHistoryRequest({ sessionId, nonce: Date.now() });
    },
    [navigate],
  );

  const isDark = settings?.theme === 'dark' || (settings?.theme !== 'light' && prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (settings) document.documentElement.style.setProperty('--ui-scale', String(settings.fontScale.ui));
  }, [settings]);

  const currentWorkspace = useMemo(() => workspaces.find((w) => w.id === route.workspaceId), [workspaces, route.workspaceId]);

  const value: AppContextValue = {
    info,
    settings,
    ui,
    workspaces,
    route,
    navigate,
    refreshWorkspaces,
    updateSettings,
    updateUi,
    searchOpen,
    setSearchOpen,
    historyRequest,
    openHistory,
    currentWorkspace,
    isDark,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider가 없어요');
  return v;
}
