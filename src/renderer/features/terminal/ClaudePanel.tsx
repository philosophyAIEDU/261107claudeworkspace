import { useMemo, useState } from 'react';
import type { WorkspaceView } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { HelpTip } from '../../components/Tooltip';
import { EmptyState } from '../../components/EmptyState';
import { useSessionActions } from '../sessions/useSessions';
import { ClaudeTerminal } from './ClaudeTerminal';
import { KoreanInputBox } from './KoreanInputBox';
import { TerminalTabs } from './TerminalTabs';
import { useTerminal } from './useTerminal';
import { sendToClaude } from './sendToClaude';
import { terminalText } from './terminalRegistry';

export function ClaudePanel({ workspace, onCollapse }: { workspace: WorkspaceView; onCollapse: () => void }): React.JSX.Element {
  const { settings, ui, updateSettings, updateUi } = useApp();
  const { tabs, activeTabId, setActiveTabId, closeTab, restart, stop, write } = useTerminal();
  const actions = useSessionActions();
  const dialog = useDialog();
  const toast = useToast();
  const [focusKey, setFocusKey] = useState(0);

  // 이 작업 폴더에서 연 대화만 탭으로 보여 준다(대화마다 실행 폴더가 다르므로).
  const myTabs = useMemo(() => tabs.filter((t) => t.workspaceId === workspace.id), [tabs, workspace.id]);
  const otherCount = tabs.length - myTabs.length;
  const active = myTabs.find((t) => t.tabId === activeTabId) ?? myTabs[myTabs.length - 1];
  const position = settings?.terminalPosition ?? 'right';

  const onClose = async (tabId: string): Promise<void> => {
    const t = myTabs.find((x) => x.tabId === tabId);
    if (t?.running) {
      const ok = await dialog.confirm({ title: ko.terminal.closeTabConfirmTitle, body: ko.terminal.closeTabConfirmBody, confirmLabel: ko.common.close });
      if (!ok) return;
    }
    await closeTab(tabId);
  };

  const history = ui?.inputHistory ?? [];

  return (
    <section aria-label={ko.terminal.panelTitle} className="flex h-full min-h-0 min-w-0 flex-col bg-panel">
      <div className="flex items-end gap-1 border-b border-line bg-panel-2 px-1 pt-1">
        <TerminalTabs tabs={myTabs} activeTabId={active?.tabId ?? null} onSelect={setActiveTabId} onClose={(id) => void onClose(id)} />
        <div className="flex shrink-0 items-center gap-1 pb-1">
          <Button size="sm" variant="primary" onClick={() => actions.newSession(workspace)}>
            {ko.terminal.newSession}
          </Button>
          <button
            type="button"
            className="rounded px-1.5 py-1 text-sm hover:bg-panel"
            title={position === 'right' ? ko.terminal.moveBottom : ko.terminal.moveRight}
            aria-label={position === 'right' ? ko.terminal.moveBottom : ko.terminal.moveRight}
            onClick={() => void updateSettings({ terminalPosition: position === 'right' ? 'bottom' : 'right' })}
          >
            {position === 'right' ? '⬇' : '➡'}
          </button>
          <button type="button" className="rounded px-1.5 py-1 text-sm hover:bg-panel" title={ko.terminal.collapse} aria-label={ko.terminal.collapse} onClick={onCollapse}>
            {position === 'right' ? '⇥' : '⤓'}
          </button>
        </div>
      </div>

      {active ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1">
            <Button size="sm" onClick={() => stop(active.tabId)} disabled={!active.running} title={ko.terminal.stopTip}>
              {ko.terminal.stop}
            </Button>
            <Button size="sm" onClick={() => void restart(active.tabId)} title={ko.terminal.restartTip}>
              {ko.terminal.restart}
            </Button>
            <Button
              size="sm"
              title={ko.terminal.copyTip}
              onClick={() => {
                void navigator.clipboard.writeText(terminalText(active.tabId)).then(() => toast.show(ko.terminal.copied));
              }}
            >
              {ko.terminal.copy}
            </Button>
            <HelpTip text={`${ko.terminal.stopTip} ${ko.terminal.restartTip} ${ko.terminal.copyTip}`} />
            <div className="flex-1" />
            {otherCount > 0 && <span className="text-xs text-muted">{ko.terminal.otherFolderTabs(otherCount)}</span>}
          </div>
          <div className="relative min-h-0 flex-1" onClick={() => setFocusKey((k) => k + 1)}>
            <ClaudeTerminal key={active.tabId} tabId={active.tabId} focusKey={focusKey} />
            {!active.running && (
              <div role="status" className="absolute inset-x-3 bottom-3 rounded-xl border border-line bg-panel p-4 shadow-xl">
                <p className="font-bold">⏹ {ko.terminal.ended}</p>
                <p className="mt-1 text-sm text-muted">
                  {active.exitCode !== undefined && active.exitCode !== 0 ? ko.terminal.endedAbnormal(active.exitCode) : ko.terminal.endedBody}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" onClick={() => void restart(active.tabId)}>
                    {ko.terminal.resumeAgain}
                  </Button>
                  <Button onClick={() => void closeTab(active.tabId)}>{ko.terminal.closeTab}</Button>
                </div>
              </div>
            )}
          </div>
          {settings?.koreanInputBox ? (
            <KoreanInputBox
              disabled={!active.running}
              quickPhrases={settings.quickPhrases}
              history={history}
              onHistoryAdd={(text) => updateUi({ inputHistory: [...history.filter((h) => h !== text), text].slice(-100) })}
              onSend={(text) => sendToClaude((d) => write(active.tabId, d), text)}
              onHide={() => void updateSettings({ koreanInputBox: false })}
            />
          ) : (
            <div className="border-t border-line p-1 text-right">
              <button type="button" className="text-sm text-muted hover:text-fg hover:underline" onClick={() => void updateSettings({ koreanInputBox: true })}>
                {ko.input.show}
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon="🤖" title={ko.terminal.noTabs} body={ko.terminal.noTabsHint}>
          <Button variant="primary" size="lg" onClick={() => actions.newSession(workspace)}>
            {ko.terminal.newSession}
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
