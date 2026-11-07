import { useEffect, useRef, useState } from 'react';
import type { ClaudeCheckResult } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { ko } from '../../i18n/ko';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ClaudeTerminal } from '../terminal/ClaudeTerminal';
import { createTerminal, disposeTerminal } from '../terminal/terminalRegistry';

type Phase = 'ready' | 'running' | 'checking' | 'done';

/** 공식 설치 명령을 앱 안의 터미널에서 실행하고, 끝나면 설치됐는지 다시 확인한다. */
export function InstallerDialog({ onClose, onChecked }: { onClose: () => void; onChecked: (r: ClaudeCheckResult) => void }): React.JSX.Element {
  const { info, isDark, settings } = useApp();
  const isWin = info?.platform === 'win32';
  const command = isWin ? ko.setup.installCmdWin : ko.setup.installCmdMac;
  const [phase, setPhase] = useState<Phase>('ready');
  const [tabId, setTabId] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [result, setResult] = useState<ClaudeCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabRef = useRef<string | null>(null);

  useEffect(() => {
    const off = api().on('pty:exit', ({ tabId: id, exitCode: code }) => {
      if (id !== tabRef.current) return;
      setExitCode(code);
      setPhase('checking');
      void api()
        .invoke('setup:checkClaude', undefined)
        .then((r) => {
          setResult(r);
          onChecked(r);
        })
        .catch(() => setResult({ found: false }))
        .finally(() => setPhase('done'));
    });
    return () => {
      off();
      const id = tabRef.current;
      if (id) {
        void api().invoke('pty:close', { tabId: id }).catch(() => undefined);
        disposeTerminal(id);
      }
    };
  }, [onChecked]);

  const start = async (): Promise<void> => {
    setError(null);
    const id = crypto.randomUUID();
    // 출력을 놓치지 않도록 터미널 화면을 먼저 만들고 나서 설치를 시작한다.
    const entry = createTerminal(id, Math.round(13 * (settings?.fontScale.terminal ?? 1)), isDark);
    entry.term.onData((d) => void api().invoke('pty:write', { tabId: id, data: d }).catch(() => undefined));
    entry.term.onResize(({ cols, rows }) => void api().invoke('pty:resize', { tabId: id, cols, rows }).catch(() => undefined));
    tabRef.current = id;
    setTabId(id);
    setPhase('running');
    await new Promise((r) => setTimeout(r, 50)); // 화면에 붙어 크기가 정해질 때까지 잠깐
    try {
      await api().invoke('setup:runInstaller', { tabId: id, cols: Math.max(entry.term.cols, 40), rows: Math.max(entry.term.rows, 10) });
    } catch (err) {
      setError(errorMessage(err));
      setPhase('ready');
    }
  };

  return (
    <Modal title={ko.setup.installerTitle} onClose={phase === 'running' ? () => undefined : onClose} wide>
      <p>{ko.setup.installerIntro}</p>
      <code className="my-2 block rounded-lg bg-panel-2 p-2 font-mono text-sm break-all">{command}</code>
      <ul className="mb-3 list-disc pl-6 text-sm text-muted">
        {ko.setup.installerWhy.filter((_, i) => isWin || i === 2).map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {tabId && (
        <div className="mb-3 h-72 overflow-hidden rounded-lg border border-line">
          <ClaudeTerminal tabId={tabId} />
        </div>
      )}
      <div aria-live="polite" className="mb-3">
        {error && <p className="text-danger">⚠️ {error}</p>}
        {phase === 'running' && <p>⏳ {ko.setup.installerRunning}</p>}
        {phase === 'checking' && <p>{ko.setup.installerChecking}</p>}
        {phase === 'done' && result?.found && (
          <p className="font-semibold text-ok">
            {ko.setup.installerDone} {ko.setup.found(result.version ?? '?')}
          </p>
        )}
        {phase === 'done' && !result?.found && <p className="text-danger">{exitCode ? ko.setup.installerFailed(exitCode) : ko.setup.installerNotFound}</p>}
      </div>
      <div className="flex justify-end gap-2">
        {phase === 'ready' && (
          <>
            <Button onClick={onClose}>{ko.common.cancel}</Button>
            <Button variant="primary" onClick={() => void start()} disabled={info?.ptyAvailable === false}>
              {ko.setup.installerStart}
            </Button>
          </>
        )}
        {phase === 'done' && (
          <Button variant="primary" onClick={onClose}>
            {ko.common.close}
          </Button>
        )}
      </div>
    </Modal>
  );
}
