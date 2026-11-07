import { useEffect, useState } from 'react';
import type { ImportScanResult } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { ko } from '../../i18n/ko';
import { relativeTime } from '../../lib/time';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';

/** 앱 밖(다른 IDE 터미널 등)에서 Claude Code로 작업한 폴더를 찾아 목록에 추가한다. */
export function ImportPanel({ onDone }: { onDone?: () => void }): React.JSX.Element {
  const toast = useToast();
  const [scan, setScan] = useState<ImportScanResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api()
      .invoke('sessions:importScan', undefined)
      .then((r) => {
        setScan(r);
        setPicked(new Set(r.candidates.filter((c) => c.exists).map((c) => c.path)));
      })
      .catch(() => setScan({ candidates: [], unknownFolderCount: 0 }));
  }, []);

  if (!scan) return <p className="text-muted">{ko.common.loading}</p>;
  if (scan.candidates.length === 0) return <p className="text-muted">{ko.setup.importNone}</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{ko.setup.importFound(scan.candidates.length)}</p>
      <ul className="max-h-72 overflow-auto rounded-lg border border-line">
        {scan.candidates.map((c) => (
          <li key={c.path} className="border-b border-line last:border-b-0">
            <label className={`flex items-start gap-2 px-3 py-2 ${c.exists ? '' : 'opacity-60'}`}>
              <input
                type="checkbox"
                className="mt-1"
                disabled={!c.exists}
                checked={picked.has(c.path)}
                onChange={(e) =>
                  setPicked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(c.path);
                    else n.delete(c.path);
                    return n;
                  })
                }
              />
              <span className="min-w-0">
                <span className="block truncate">{c.path}</span>
                <span className="text-sm text-muted">
                  {ko.setup.sessionsCount(c.sessionCount)} · {relativeTime(c.lastActiveAt)} {!c.exists && ko.setup.folderMissing}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {scan.unknownFolderCount > 0 && <p className="text-sm text-muted">{ko.setup.importUnknown(scan.unknownFolderCount)}</p>}
      <div>
        <Button
          variant="primary"
          disabled={picked.size === 0 || busy}
          onClick={() => {
            setBusy(true);
            void api()
              .invoke('sessions:importApply', { paths: [...picked] })
              .then((r) => {
                toast.show(ko.setup.importDone(r.addedWorkspaces, r.addedSessions));
                onDone?.();
              })
              .catch((err) => toast.show(errorMessage(err), 'error'))
              .finally(() => setBusy(false));
          }}
        >
          {ko.setup.importButton}
        </Button>
      </div>
    </div>
  );
}
