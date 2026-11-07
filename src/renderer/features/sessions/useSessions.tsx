import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionView, WorkspaceView } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { baseName } from '../../lib/time';
import { ko } from '../../i18n/ko';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useTerminal } from '../terminal/useTerminal';
import { NewSessionDialog, type NewSessionValues } from './NewSessionDialog';
import { defaultSessionTitle } from './defaultTitle';

/** 한 작업 폴더(또는 전체)의 대화 목록. 메인에서 바뀌었다고 알려 주면 다시 읽는다. */
export function useSessionList(workspaceId: string | undefined, includeHidden = false): { sessions: SessionView[]; reload: () => Promise<void> } {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const reload = useCallback(async () => {
    if (!workspaceId) {
      setSessions([]);
      return;
    }
    setSessions(await api().invoke('sessions:list', { workspaceId, includeHidden }).catch(() => []));
  }, [workspaceId, includeHidden]);
  useEffect(() => {
    void reload();
    return api().on('sessions:changed', () => void reload());
  }, [reload]);
  return { sessions, reload };
}

interface SessionActions {
  newSession: (ws: WorkspaceView) => void;
  resume: (workspaceId: string, sessionId: string) => Promise<void>;
  /** 처음 화면의 [이어서 작업하기]: 가장 최근 대화를 이어서, 없으면 새 대화 */
  continueLatest: (ws: WorkspaceView) => Promise<void>;
  fork: (workspaceId: string, sessionId: string) => Promise<void>;
  rename: (s: SessionView) => Promise<void>;
  editMemo: (s: SessionView) => Promise<void>;
  setHidden: (s: SessionView, hidden: boolean) => Promise<void>;
  deleteFile: (s: SessionView) => Promise<boolean>;
  exportMarkdown: (s: SessionView) => Promise<void>;
}

const Ctx = createContext<SessionActions | null>(null);

export function SessionActionsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { navigate } = useApp();
  const { start } = useTerminal();
  const dialog = useDialog();
  const toast = useToast();
  const [pendingNew, setPendingNew] = useState<WorkspaceView | null>(null);

  const fail = useCallback((err: unknown) => toast.show(errorMessage(err), 'error'), [toast]);

  const resume = useCallback(
    async (workspaceId: string, sessionId: string) => {
      navigate({ page: 'workspace', workspaceId });
      await start(workspaceId, { kind: 'resume', sessionId });
    },
    [navigate, start],
  );

  const actions: SessionActions = {
    newSession: (ws) => setPendingNew(ws),
    resume,
    continueLatest: async (ws) => {
      if (ws.lastSessionId) await resume(ws.id, ws.lastSessionId);
      else {
        navigate({ page: 'workspace', workspaceId: ws.id });
        setPendingNew(ws);
      }
    },
    fork: async (workspaceId, sessionId) => {
      navigate({ page: 'workspace', workspaceId });
      await start(workspaceId, { kind: 'fork', sessionId });
    },
    rename: async (s) => {
      const title = await dialog.prompt({ title: ko.sessions.renameTitle, label: ko.sessions.newTitleLabel, initial: s.title });
      if (title === null) return;
      await api().invoke('sessions:rename', { sessionId: s.sessionId, title }).catch(fail);
    },
    editMemo: async (s) => {
      const memo = await dialog.prompt({ title: ko.sessions.memoTitle, label: ko.sessions.memoTitle, initial: s.memo ?? '', multiline: true, allowEmpty: true });
      if (memo === null) return;
      await api().invoke('sessions:update', { sessionId: s.sessionId, patch: { memo } }).catch(fail);
    },
    setHidden: async (s, hidden) => {
      await api().invoke('sessions:update', { sessionId: s.sessionId, patch: { hidden } }).catch(fail);
    },
    // 실제 기록 파일 삭제는 2단계로 확인한다.
    deleteFile: async (s) => {
      const first = await dialog.confirm({ title: ko.sessions.deleteStep1Title, body: ko.sessions.deleteStep1Body, confirmLabel: ko.common.yes, danger: true });
      if (!first) return false;
      const second = await dialog.confirm({ title: ko.sessions.deleteStep2Title, body: `"${s.title}" — ${ko.sessions.deleteStep2Body}`, confirmLabel: ko.sessions.deleteConfirm, danger: true });
      if (!second) return false;
      try {
        await api().invoke('sessions:deleteFile', { sessionId: s.sessionId, confirm: '되돌릴 수 없어요' });
        toast.show(ko.sessions.deleted);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    exportMarkdown: async (s) => {
      try {
        const p = await api().invoke('sessions:exportMarkdown', { sessionId: s.sessionId });
        if (p) toast.show(ko.sessions.exported(p));
      } catch (err) {
        fail(err);
      }
    },
  };

  const submitNew = async (ws: WorkspaceView, v: NewSessionValues): Promise<void> => {
    setPendingNew(null);
    navigate({ page: 'workspace', workspaceId: ws.id });
    await start(ws.id, { kind: 'new', title: v.title, model: v.model, permissionMode: v.permissionMode });
  };

  return (
    <Ctx.Provider value={actions}>
      {children}
      {pendingNew && (
        <NewSessionDialog
          defaultTitle={defaultSessionTitle()}
          folderName={pendingNew.alias || baseName(pendingNew.path)}
          onCancel={() => setPendingNew(null)}
          onSubmit={(v) => void submitNew(pendingNew, v)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useSessionActions(): SessionActions {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionActionsProvider가 없어요');
  return v;
}
