import { useState } from 'react';
import type { ClaudeCheckResult, PathFixResult } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { ko } from '../../i18n/ko';
import { Button } from '../../components/Button';
import { HelpTip } from '../../components/Tooltip';

/**
 * claude가 "저장된 PATH"에 등록되어 있는지 보여 주고, 아니면 등록해 준다.
 * (이 앱은 PATH 없이도 동작하지만, 안티그래비티 같은 다른 프로그램의 터미널은 PATH가 있어야 claude를 찾는다)
 */
export function ClaudePathStatus({ check, onChanged }: { check: ClaudeCheckResult; onChanged?: () => void }): React.JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [fix, setFix] = useState<PathFixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!check.found || check.onPath === undefined) return null;
  if (check.onPath && !fix) return <p className="text-sm text-muted">{ko.setup.pathOk}</p>;

  return (
    <div role="status" className="mt-3 rounded-xl border border-line bg-accent-soft p-4">
      {!fix && (
        <>
          <p className="font-semibold">{ko.setup.pathMissingTitle}</p>
          <p className="mt-1 text-sm">{ko.setup.pathMissingBody(check.dir ?? '')}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                void api()
                  .invoke('setup:fixPath', undefined)
                  .then((r) => {
                    setFix(r);
                    onChanged?.();
                  })
                  .catch((err) => setError(errorMessage(err)))
                  .finally(() => setBusy(false));
              }}
            >
              {ko.setup.pathFix}
            </Button>
            <HelpTip text={ko.setup.pathFixHelp} />
          </div>
        </>
      )}
      {error && <p className="mt-2 text-danger">⚠️ {error}</p>}
      {fix?.ok && (
        <>
          <p className="font-semibold text-ok">✅ {fix.alreadyDone ? ko.setup.pathAlready(fix.where ?? '') : ko.setup.pathFixed(fix.where ?? '')}</p>
          <p className="mt-1 text-sm">💡 {ko.setup.pathRestart}</p>
        </>
      )}
      {fix && !fix.ok && (
        <p className="text-sm">
          {ko.setup.pathManual} <code className="break-all">{fix.manual}</code>
        </p>
      )}
    </div>
  );
}
