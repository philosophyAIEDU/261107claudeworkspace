import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClaudeLaunchRequest, PtyTabInfo } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { createTerminal, darkTheme, disposeTerminal, getTerminal, lightTheme } from './terminalRegistry';

export type TabStatus = 'working' | 'waiting' | 'exited';

export interface TerminalTab extends PtyTabInfo {
  status: TabStatus;
}

interface TerminalContextValue {
  tabs: TerminalTab[];
  activeTabId: string | null;
  setActiveTabId: (id: string) => void;
  start: (workspaceId: string, launch: ClaudeLaunchRequest) => Promise<TerminalTab | null>;
  write: (tabId: string, data: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  restart: (tabId: string) => Promise<void>;
  stop: (tabId: string) => void;
}

const Ctx = createContext<TerminalContextValue | null>(null);

// 마지막 출력 후 이 시간이 지나면 "입력 대기"로 본다(화면 출력이 멈췄다 = Claude가 기다리는 중).
const IDLE_MS = 1500;

export function TerminalProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { settings, isDark } = useApp();
  const toast = useToast();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const lastData = useRef(new Map<string, number>());
  const fontSize = Math.round(14 * (settings?.fontScale.terminal ?? 1));
  const fontRef = useRef(fontSize);
  const darkRef = useRef(isDark);
  fontRef.current = fontSize;
  darkRef.current = isDark;

  const ensureTerm = useCallback((tabId: string) => {
    const existed = getTerminal(tabId);
    const entry = createTerminal(tabId, fontRef.current, darkRef.current);
    if (!existed) {
      entry.term.onData((d) => void api().invoke('pty:write', { tabId, data: d }).catch(() => undefined));
      entry.term.onResize(({ cols, rows }) => void api().invoke('pty:resize', { tabId, cols, rows }).catch(() => undefined));
    }
    return entry;
  }, []);

  // 화면을 새로 고쳤을 때 이미 실행 중인 대화 탭을 되살린다.
  useEffect(() => {
    void (async () => {
      const list = await api().invoke('pty:list', undefined).catch(() => [] as PtyTabInfo[]);
      if (!list.length) return;
      for (const t of list) {
        const entry = ensureTerm(t.tabId);
        const buf = await api().invoke('pty:buffer', { tabId: t.tabId }).catch(() => '');
        if (buf) entry.term.write(buf);
      }
      setTabs(list.map((t) => ({ ...t, status: t.running ? 'waiting' : 'exited' })));
      setActiveTabId((cur) => cur ?? list[0]?.tabId ?? null);
    })();
  }, [ensureTerm]);

  useEffect(() => {
    const offData = api().on('pty:data', ({ tabId, data }) => {
      getTerminal(tabId)?.term.write(data);
      lastData.current.set(tabId, Date.now());
    });
    const offExit = api().on('pty:exit', ({ tabId, exitCode }) => {
      setTabs((ts) => ts.map((t) => (t.tabId === tabId ? { ...t, running: false, exitCode, status: 'exited' } : t)));
    });
    // 상태 점(작업 중/입력 대기) 갱신
    const timer = setInterval(() => {
      setTabs((ts) => {
        let changed = false;
        const next = ts.map((t) => {
          if (!t.running) return t;
          const status: TabStatus = Date.now() - (lastData.current.get(t.tabId) ?? 0) < IDLE_MS ? 'working' : 'waiting';
          if (status !== t.status) changed = true;
          return status === t.status ? t : { ...t, status };
        });
        return changed ? next : ts;
      });
    }, 500);
    return () => {
      offData();
      offExit();
      clearInterval(timer);
    };
  }, []);

  // 글자 크기·테마가 바뀌면 열린 터미널에도 적용
  useEffect(() => {
    for (const t of tabs) {
      const e = getTerminal(t.tabId);
      if (!e) continue;
      e.term.options.fontSize = fontSize;
      e.term.options.theme = isDark ? darkTheme : lightTheme;
      try {
        e.fit.fit();
      } catch {
        // 화면에 안 붙어 있으면 무시
      }
    }
  }, [fontSize, isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(
    async (workspaceId: string, launch: ClaudeLaunchRequest): Promise<TerminalTab | null> => {
      try {
        const { tab } = await api().invoke('pty:start', { workspaceId, launch, cols: 100, rows: 30 });
        ensureTerm(tab.tabId);
        lastData.current.set(tab.tabId, Date.now());
        const full: TerminalTab = { ...tab, status: tab.running ? 'working' : 'exited' };
        setTabs((ts) => (ts.some((t) => t.tabId === tab.tabId) ? ts : [...ts, full]));
        setActiveTabId(tab.tabId);
        return full;
      } catch (err) {
        toast.show(errorMessage(err), 'error');
        return null;
      }
    },
    [ensureTerm, toast],
  );

  const write = useCallback(async (tabId: string, data: string) => {
    await api().invoke('pty:write', { tabId, data });
  }, []);

  const closeTab = useCallback(async (tabId: string) => {
    await api().invoke('pty:close', { tabId }).catch(() => undefined);
    disposeTerminal(tabId);
    setTabs((ts) => {
      const next = ts.filter((t) => t.tabId !== tabId);
      setActiveTabId((cur) => (cur === tabId ? (next[next.length - 1]?.tabId ?? null) : cur));
      return next;
    });
  }, []);

  const restart = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.tabId === tabId);
      if (!tab) return;
      await closeTab(tabId);
      await start(tab.workspaceId, { kind: 'resume', sessionId: tab.sessionId });
    },
    [tabs, closeTab, start],
  );

  const stop = useCallback((tabId: string) => {
    void api().invoke('pty:write', { tabId, data: '\x1b' }).catch(() => undefined);
  }, []);

  return <Ctx.Provider value={{ tabs, activeTabId, setActiveTabId, start, write, closeTab, restart, stop }}>{children}</Ctx.Provider>;
}

export function useTerminal(): TerminalContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('TerminalProvider가 없어요');
  return v;
}
