import { useCallback, useState } from 'react';
import type { WorkspaceView } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { ko } from '../../i18n/ko';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { WorkspaceInfoDialog } from './WorkspaceInfoDialog';

/** 작업 폴더 관련 동작 모음(폴더 열기·만들기·고정·메모·빼기·새 위치) */
export function useWorkspaceActions(): {
  pickAndAdd: () => Promise<void>;
  createNew: () => Promise<void>;
  togglePin: (w: WorkspaceView) => Promise<void>;
  editInfo: (w: WorkspaceView) => void;
  remove: (w: WorkspaceView) => Promise<void>;
  relocate: (w: WorkspaceView) => Promise<void>;
  dialogs: React.JSX.Element | null;
} {
  const { navigate, settings } = useApp();
  const dialog = useDialog();
  const toast = useToast();
  const [editing, setEditing] = useState<WorkspaceView | null>(null);
  const fail = useCallback((err: unknown) => toast.show(errorMessage(err), 'error'), [toast]);

  const pickAndAdd = async (): Promise<void> => {
    try {
      const ws = await api().invoke('workspaces:pickAndAdd', undefined);
      if (ws) navigate({ page: 'workspace', workspaceId: ws.id });
    } catch (err) {
      fail(err);
    }
  };

  const createNew = async (): Promise<void> => {
    const name = await dialog.prompt({
      title: ko.home.newFolderTitle,
      label: ko.home.newFolderLabel(settings?.defaultParentFolder ?? ''),
      placeholder: ko.home.newFolderPlaceholder,
    });
    if (!name) return;
    try {
      const ws = await api().invoke('workspaces:createNew', { name: name.trim() });
      navigate({ page: 'workspace', workspaceId: ws.id });
    } catch (err) {
      fail(err);
    }
  };

  const togglePin = async (w: WorkspaceView): Promise<void> => {
    await api().invoke('workspaces:update', { id: w.id, patch: { pinned: !w.pinned } }).catch(fail);
  };

  const remove = async (w: WorkspaceView): Promise<void> => {
    const ok = await dialog.confirm({ title: ko.workspaceCard.removeConfirmTitle, body: ko.workspaceCard.removeConfirmBody, confirmLabel: ko.workspaceCard.remove, danger: true });
    if (ok) await api().invoke('workspaces:remove', { id: w.id }).catch(fail);
  };

  const relocate = async (w: WorkspaceView): Promise<void> => {
    await api().invoke('workspaces:relocate', { id: w.id }).catch(fail);
  };

  const dialogs = editing ? (
    <WorkspaceInfoDialog
      workspace={editing}
      onCancel={() => setEditing(null)}
      onSave={(v) => {
        const id = editing.id;
        setEditing(null);
        void api().invoke('workspaces:update', { id, patch: { alias: v.alias, memo: v.memo, color: v.color } }).catch(fail);
      }}
    />
  ) : null;

  return { pickAndAdd, createNew, togglePin, editInfo: setEditing, remove, relocate, dialogs };
}
