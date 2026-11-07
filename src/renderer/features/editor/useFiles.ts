import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileChangeEvent, WorkspaceView } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { isInsideLoose, samePathLoose } from '../../lib/time';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';

export interface FileTab {
  kind: 'file';
  key: string;
  path: string;
  content: string;
  savedContent: string;
  tooLarge: boolean;
  binary: boolean;
  /** 밖(대개 Claude)에서 바뀌었는지 */
  external?: 'changed' | 'deleted';
  preview: boolean;
}
export interface HistoryTab {
  kind: 'history';
  key: string;
  sessionId: string;
}
export type CenterTab = FileTab | HistoryTab;

export function isDirty(t: CenterTab): boolean {
  return t.kind === 'file' && t.content !== t.savedContent;
}

const RECENT_MS = 10 * 60 * 1000; // "방금 바뀜" 표시를 10분 동안 보여 줌

export function useFiles(ws: WorkspaceView | undefined): {
  tabs: CenterTab[];
  activeKey: string | null;
  setActiveKey: (k: string) => void;
  openFile: (path: string) => Promise<void>;
  openHistory: (sessionId: string) => void;
  closeTab: (key: string) => void;
  updateContent: (key: string, content: string) => void;
  save: (key: string) => Promise<void>;
  reload: (key: string) => Promise<void>;
  dismissExternal: (key: string) => void;
  togglePreview: (key: string) => void;
  recentlyChanged: Map<string, number>;
  treeVersion: number;
  renamePath: (from: string, to: string) => void;
} {
  const { ui, updateUi } = useApp();
  const toast = useToast();
  const [tabs, setTabs] = useState<CenterTab[]>([]);
  const [activeKey, setActiveKeyState] = useState<string | null>(null);
  const [recentlyChanged, setRecentlyChanged] = useState<Map<string, number>>(new Map());
  const [treeVersion, setTreeVersion] = useState(0);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const restoredFor = useRef<string | null>(null);

  const persist = useCallback(
    (next: CenterTab[], active: string | null) => {
      if (!ws) return;
      const files = next.filter((t): t is FileTab => t.kind === 'file').map((t) => t.path);
      const activeTab = next.find((t) => t.key === active);
      updateUi({
        openFiles: { ...(ui?.openFiles ?? {}), [ws.id]: files },
        activeFile: { ...(ui?.activeFile ?? {}), [ws.id]: activeTab?.kind === 'file' ? activeTab.path : undefined },
      });
    },
    [ws, ui, updateUi],
  );

  const setActiveKey = useCallback(
    (k: string) => {
      setActiveKeyState(k);
      persist(tabsRef.current, k);
    },
    [persist],
  );

  const loadFile = useCallback(async (path: string): Promise<FileTab | null> => {
    try {
      const r = await api().invoke('files:read', { path });
      return { kind: 'file', key: `file:${path}`, path, content: r.content, savedContent: r.content, tooLarge: r.tooLarge, binary: r.binary, preview: false };
    } catch {
      return null;
    }
  }, []);

  // 작업 폴더가 바뀌면 그 폴더에서 열려 있던 파일 탭을 복원하고 파일 감시를 시작한다.
  useEffect(() => {
    if (!ws || !ui) return;
    if (restoredFor.current === ws.id) return;
    restoredFor.current = ws.id;
    void api().invoke('files:watch', { workspaceId: ws.id }).catch(() => undefined);
    setRecentlyChanged(new Map());
    void (async () => {
      const paths = ui.openFiles[ws.id] ?? [];
      const loaded = (await Promise.all(paths.map(loadFile))).filter((t): t is FileTab => t !== null);
      setTabs(loaded);
      const active = ui.activeFile[ws.id];
      setActiveKeyState(active && loaded.some((t) => t.path === active) ? `file:${active}` : (loaded[0]?.key ?? null));
    })();
  }, [ws, ui, loadFile]);

  // 밖에서 파일이 바뀌면(대개 Claude가 고침) 표시하고, 열린 파일이면 안내를 띄운다.
  useEffect(() => {
    return api().on('files:changed', (e: FileChangeEvent) => {
      if (!ws || e.workspaceId !== ws.id) return;
      setTreeVersion((v) => v + 1);
      if (e.type === 'change' || e.type === 'add') {
        setRecentlyChanged((m) => new Map(m).set(e.path, Date.now()));
      }
      setTabs((ts) =>
        ts.map((t) => {
          if (t.kind !== 'file') return t;
          if (!samePathLoose(t.path, e.path) && !(e.type === 'unlinkDir' && isInsideLoose(e.path, t.path))) return t;
          if (e.type === 'unlink' || e.type === 'unlinkDir') return { ...t, external: 'deleted' };
          if (e.type === 'change') return { ...t, external: 'changed' };
          return t;
        }),
      );
    });
  }, [ws]);

  // 오래된 "방금 바뀜" 표시 정리
  useEffect(() => {
    const t = setInterval(() => {
      setRecentlyChanged((m) => {
        const now = Date.now();
        const next = new Map([...m].filter(([, at]) => now - at < RECENT_MS));
        return next.size === m.size ? m : next;
      });
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const openFile = useCallback(
    async (path: string) => {
      const key = `file:${path}`;
      setRecentlyChanged((m) => {
        if (!m.has(path)) return m;
        const n = new Map(m);
        n.delete(path);
        return n;
      });
      if (tabsRef.current.some((t) => t.key === key)) {
        setActiveKey(key);
        return;
      }
      try {
        const r = await api().invoke('files:read', { path });
        const tab: FileTab = { kind: 'file', key, path, content: r.content, savedContent: r.content, tooLarge: r.tooLarge, binary: r.binary, preview: false };
        const next = [...tabsRef.current, tab];
        setTabs(next);
        setActiveKeyState(key);
        persist(next, key);
      } catch (err) {
        toast.show(errorMessage(err), 'error');
      }
    },
    [persist, setActiveKey, toast],
  );

  const openHistory = useCallback((sessionId: string) => {
    const key = `history:${sessionId}`;
    setTabs((ts) => (ts.some((t) => t.key === key) ? ts : [...ts, { kind: 'history', key, sessionId }]));
    setActiveKeyState(key);
  }, []);

  const closeTab = useCallback(
    (key: string) => {
      const ts = tabsRef.current;
      const i = ts.findIndex((t) => t.key === key);
      const next = ts.filter((t) => t.key !== key);
      setTabs(next);
      const nextActive = activeKey === key ? (next[Math.min(i, next.length - 1)]?.key ?? null) : activeKey;
      setActiveKeyState(nextActive);
      persist(next, nextActive);
    },
    [activeKey, persist],
  );

  const updateContent = useCallback((key: string, content: string) => {
    setTabs((ts) => ts.map((t) => (t.key === key && t.kind === 'file' ? { ...t, content } : t)));
  }, []);

  const save = useCallback(
    async (key: string) => {
      const t = tabsRef.current.find((x) => x.key === key);
      if (!t || t.kind !== 'file' || t.tooLarge || t.binary) return;
      try {
        await api().invoke('files:write', { path: t.path, content: t.content });
        setTabs((ts) => ts.map((x) => (x.key === key && x.kind === 'file' ? { ...x, savedContent: t.content, external: undefined } : x)));
      } catch (err) {
        toast.show(errorMessage(err), 'error');
      }
    },
    [toast],
  );

  const reload = useCallback(
    async (key: string) => {
      const t = tabsRef.current.find((x) => x.key === key);
      if (!t || t.kind !== 'file') return;
      const fresh = await loadFile(t.path);
      if (!fresh) return;
      setTabs((ts) => ts.map((x) => (x.key === key ? { ...fresh, preview: (x as FileTab).preview } : x)));
    },
    [loadFile],
  );

  const dismissExternal = useCallback((key: string) => {
    setTabs((ts) => ts.map((t) => (t.key === key && t.kind === 'file' ? { ...t, external: undefined } : t)));
  }, []);

  const togglePreview = useCallback((key: string) => {
    setTabs((ts) => ts.map((t) => (t.key === key && t.kind === 'file' ? { ...t, preview: !t.preview } : t)));
  }, []);

  const renamePath = useCallback((from: string, to: string) => {
    setTabs((ts) =>
      ts.map((t) => {
        if (t.kind !== 'file' || !isInsideLoose(from, t.path)) return t;
        const p = to + t.path.slice(from.length);
        return { ...t, path: p, key: `file:${p}` };
      }),
    );
  }, []);

  return { tabs, activeKey, setActiveKey, openFile, openHistory, closeTab, updateContent, save, reload, dismissExternal, togglePreview, recentlyChanged, treeVersion, renamePath };
}
