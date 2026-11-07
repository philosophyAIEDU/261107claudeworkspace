import { useCallback, useEffect, useState } from 'react';
import type { FileEntry, WorkspaceView } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { baseName, dirName, joinPath } from '../../lib/time';
import { ko } from '../../i18n/ko';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { Menu, type MenuItem } from '../../components/Menu';

interface Props {
  workspace: WorkspaceView;
  onOpen: (path: string) => void;
  recentlyChanged: Map<string, number>;
  version: number;
  activePath?: string;
  onRenamed: (from: string, to: string) => void;
}

/** 현재 작업 폴더의 파일 트리. 폴더는 펼칠 때 그 단계만 읽는다. */
export function FileTree({ workspace, onOpen, recentlyChanged, version, activePath, onRenamed }: Props): React.JSX.Element {
  const [children, setChildren] = useState<Map<string, FileEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set([workspace.path]));
  const { info } = useApp();
  const dialog = useDialog();
  const toast = useToast();
  const fail = useCallback((err: unknown) => toast.show(errorMessage(err), 'error'), [toast]);

  const loadDir = useCallback(
    async (dir: string) => {
      try {
        const list = await api().invoke('files:tree', { workspaceId: workspace.id, dir });
        setChildren((m) => new Map(m).set(dir, list));
      } catch {
        setChildren((m) => new Map(m).set(dir, []));
      }
    },
    [workspace.id],
  );

  useEffect(() => {
    setChildren(new Map());
    setExpanded(new Set([workspace.path]));
    void loadDir(workspace.path);
  }, [workspace.path, loadDir]);

  // 파일이 바뀌면 펼쳐 둔 폴더를 다시 읽는다.
  useEffect(() => {
    if (version === 0) return;
    const t = setTimeout(() => {
      for (const d of expanded) void loadDir(d);
    }, 300);
    return () => clearTimeout(t);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (dir: string): void => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(dir)) n.delete(dir);
      else {
        n.add(dir);
        void loadDir(dir);
      }
      return n;
    });
  };

  const create = async (parent: string, kind: 'file' | 'dir'): Promise<void> => {
    const name = await dialog.prompt({ title: kind === 'file' ? ko.files.newFile : ko.files.newFolder, label: ko.files.nameLabel });
    if (!name) return;
    const target = joinPath(parent, name.trim());
    try {
      await api().invoke('files:create', { path: target, kind });
      setExpanded((s) => new Set(s).add(parent));
      await loadDir(parent);
      if (kind === 'file') onOpen(target);
    } catch (err) {
      fail(err);
    }
  };

  const rename = async (entry: FileEntry): Promise<void> => {
    const name = await dialog.prompt({ title: ko.files.rename, label: ko.files.nameLabel, initial: entry.name });
    if (!name || name === entry.name) return;
    const to = joinPath(dirName(entry.path), name.trim());
    try {
      await api().invoke('files:rename', { from: entry.path, to });
      onRenamed(entry.path, to);
      await loadDir(dirName(entry.path));
    } catch (err) {
      fail(err);
    }
  };

  const trash = async (entry: FileEntry): Promise<void> => {
    const ok = await dialog.confirm({ title: ko.files.trashConfirmTitle, body: ko.files.trashConfirmBody(entry.name), confirmLabel: ko.files.trash, danger: true });
    if (!ok) return;
    try {
      await api().invoke('files:trash', { path: entry.path });
      await loadDir(dirName(entry.path));
    } catch (err) {
      fail(err);
    }
  };

  const menuFor = (entry: FileEntry): MenuItem[] => {
    const items: MenuItem[] = [];
    if (entry.kind === 'dir') {
      items.push({ label: ko.files.newFile, onSelect: () => void create(entry.path, 'file') }, { label: ko.files.newFolder, onSelect: () => void create(entry.path, 'dir') });
    }
    items.push(
      { label: ko.files.rename, onSelect: () => void rename(entry) },
      { label: info?.platform === 'darwin' ? ko.files.revealMac : ko.files.reveal, onSelect: () => void api().invoke('files:reveal', { path: entry.path }).catch(fail) },
      { label: ko.files.openInIde, onSelect: () => void api().invoke('files:openInIde', { path: entry.path }).catch(fail) },
      { label: ko.files.trash, danger: true, onSelect: () => void trash(entry), separatorBefore: true },
    );
    return items;
  };

  const renderDir = (dir: string, depth: number): React.JSX.Element => {
    const list = children.get(dir);
    if (!list) return <div className="px-3 py-1 text-sm text-muted">{ko.common.loading}</div>;
    if (list.length === 0 && depth === 0) return <div className="px-3 py-1 text-sm text-muted">{ko.files.empty}</div>;
    return (
      <ul role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? baseName(dir) : undefined}>
        {list.map((e) => {
          const changed = recentlyChanged.has(e.path);
          const open = expanded.has(e.path);
          return (
            <li key={e.path} role="treeitem" aria-expanded={e.kind === 'dir' ? open : undefined} aria-selected={activePath === e.path}>
              <div className={`group flex items-center rounded-md pr-1 ${activePath === e.path ? 'bg-accent-soft' : 'hover:bg-panel-2'}`} style={{ paddingLeft: `${depth * 14 + 6}px` }}>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left text-[0.95rem]" onClick={() => (e.kind === 'dir' ? toggle(e.path) : onOpen(e.path))}>
                  <span aria-hidden className="w-4 shrink-0 text-center text-xs text-muted">
                    {e.kind === 'dir' ? (open ? '▾' : '▸') : ''}
                  </span>
                  <span aria-hidden>{e.kind === 'dir' ? '📁' : '📄'}</span>
                  <span className="truncate">{e.name}</span>
                  {changed && (
                    <span className="shrink-0 text-xs font-semibold text-accent" title={ko.files.changedTip}>
                      {ko.files.changed}
                    </span>
                  )}
                </button>
                <span className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <Menu label={`${ko.files.actions}: ${e.name}`} items={menuFor(e)} />
                </span>
              </div>
              {e.kind === 'dir' && open && renderDir(e.path, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-line p-2">
        <button type="button" className="rounded-md px-2 py-0.5 text-sm hover:bg-panel-2" onClick={() => void create(workspace.path, 'file')}>
          {ko.files.newFile}
        </button>
        <button type="button" className="rounded-md px-2 py-0.5 text-sm hover:bg-panel-2" onClick={() => void create(workspace.path, 'dir')}>
          {ko.files.newFolder}
        </button>
        <button type="button" className="rounded-md px-2 py-0.5 text-sm hover:bg-panel-2" onClick={() => [...expanded].forEach((d) => void loadDir(d))}>
          {ko.files.refresh}
        </button>
      </div>
      <div className="flex-1 overflow-auto py-1">{renderDir(workspace.path, 0)}</div>
    </div>
  );
}
