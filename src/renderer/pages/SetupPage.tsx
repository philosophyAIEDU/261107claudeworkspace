import { useCallback, useEffect, useState } from 'react';
import type { ClaudeCheckResult } from '../../shared/types';
import { ko } from '../i18n/ko';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { Button } from '../components/Button';
import { HelpTip } from '../components/Tooltip';
import { ImportPanel } from '../features/sessions/ImportPanel';
import { InstallerDialog } from '../features/setup/InstallerDialog';
import { ClaudePathStatus } from '../features/setup/ClaudePathStatus';

/** 첫 실행 화면 "시작하기 전에 확인해요" */
export function SetupPage({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { info } = useApp();
  const [check, setCheck] = useState<ClaudeCheckResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const isWin = info?.platform === 'win32';
  const steps = isWin ? ko.setup.installWin : ko.setup.installMac;
  const cmd = isWin ? ko.setup.installCmdWin : ko.setup.installCmdMac;

  const recheck = useCallback(async () => {
    setCheck(null);
    setCheck(await api().invoke('setup:checkClaude', undefined).catch(() => ({ found: false })));
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
        <h1 className="text-3xl font-bold">{ko.setup.title}</h1>
        <p className="text-lg text-muted">{ko.setup.intro}</p>

        {info && !info.ptyAvailable && (
          <div role="alert" className="rounded-xl border border-danger p-4 text-danger">
            {ko.setup.ptyMissing} {info.ptyError && <code className="text-sm">({info.ptyError})</code>}
          </div>
        )}

        <section className="rounded-2xl border border-line bg-panel p-5" aria-live="polite">
          <h2 className="mb-2 text-xl font-semibold">1. Claude Code</h2>
          {!check && <p>{ko.setup.checking}</p>}
          {check?.found && (
            <div>
              <p className="text-lg font-semibold text-ok">{ko.setup.found(check.version ?? '?')}</p>
              {check.path && <p className="text-sm text-muted">{ko.setup.foundAt(check.path)}</p>}
              <ClaudePathStatus check={check} />
            </div>
          )}
          {check && !check.found && (
            <div className="flex flex-col gap-3">
              <p className="text-lg font-semibold text-danger">{ko.setup.notFoundTitle}</p>
              {check.error && <p className="text-muted">{check.error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="lg" onClick={() => setInstalling(true)} disabled={info?.ptyAvailable === false}>
                  {ko.setup.autoInstall}
                </Button>
                <HelpTip text={ko.setup.autoInstallHelp} />
              </div>
              <p className="text-sm text-muted">{ko.setup.autoInstallHelp}</p>
              <details className="rounded-lg border border-line p-3">
              <summary className="cursor-pointer font-medium">{ko.setup.manualInstall}</summary>
              <h3 className="mt-2 font-semibold">{ko.setup.installStepsTitle}</h3>
              <ol className="list-decimal pl-6">
                {steps.map((s) => (
                  <li key={s} className="mb-1">
                    {s}
                  </li>
                ))}
              </ol>
              <div className="flex items-center gap-2 rounded-lg bg-panel-2 p-2">
                <code className="flex-1 select-all break-all font-mono text-sm">{cmd}</code>
                <Button
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard.writeText(cmd).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                  }
                >
                  {copied ? ko.setup.copied : ko.setup.copy}
                </Button>
              </div>
              <div>
                <button type="button" className="text-accent underline" onClick={() => void api().invoke('shell:openExternal', { url: ko.setup.docsUrl })}>
                  {ko.setup.docsLink} ↗
                </button>
              </div>
              </details>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => void recheck()}>{ko.setup.recheck}</Button>
            <Button
              variant="ghost"
              onClick={() =>
                void api()
                  .invoke('setup:pickClaudePath', undefined)
                  .then((r) => r && setCheck(r))
              }
            >
              {ko.setup.pickPath}
            </Button>
            <HelpTip text={ko.setup.pickPathTip} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-2 text-xl font-semibold">2. {ko.setup.loginTitle}</h2>
          <p>{ko.setup.loginBody}</p>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-2 text-xl font-semibold">3. {ko.setup.importTitle}</h2>
          <ImportPanel />
        </section>

        {installing && <InstallerDialog onClose={() => setInstalling(false)} onChecked={setCheck} />}

        <div className="flex justify-end">
          <Button variant="primary" size="lg" onClick={onDone}>
            {ko.setup.start}
          </Button>
        </div>
      </div>
    </div>
  );
}
