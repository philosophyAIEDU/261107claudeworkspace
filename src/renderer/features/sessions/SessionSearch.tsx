import { useEffect, useState } from 'react';
import type { SearchHit } from '../../../shared/types';
import { api } from '../../lib/api';
import { ko } from '../../i18n/ko';
import { Modal } from '../../components/Modal';

/** 🔍 전체 검색: 모든 폴더의 대화 제목·메모·메시지 본문에서 찾는다. */
export function SessionSearch({ onClose, onPick }: { onClose: () => void; onPick: (hit: SearchHit) => void }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setBusy(true);
      void api()
        .invoke('sessions:search', { query: q })
        .then((r) => !cancelled && setHits(r))
        .catch(() => !cancelled && setHits([]))
        .finally(() => !cancelled && setBusy(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <Modal title={ko.search.title} onClose={onClose} wide>
      <input
        type="search"
        data-autofocus
        aria-label={ko.search.placeholder}
        placeholder={ko.search.placeholder}
        className="mb-3 w-full rounded-lg border border-line bg-bg p-2.5 text-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div aria-live="polite" className="min-h-[8rem]">
        {query.trim().length < 2 && <p className="text-muted">{ko.search.hint}</p>}
        {busy && <p className="text-muted">{ko.search.searching}</p>}
        {!busy && hits && hits.length === 0 && <p className="text-muted">{ko.search.none}</p>}
        {hits && hits.length > 0 && (
          <ul className="flex flex-col gap-1">
            {hits.map((h) => (
              <li key={`${h.sessionId}-${h.where}`}>
                <button type="button" className="w-full rounded-lg border border-transparent px-3 py-2 text-left hover:border-line hover:bg-panel-2" onClick={() => onPick(h)}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{h.title}</span>
                    <span className="rounded bg-panel-2 px-1.5 text-xs">{ko.search.where[h.where]}</span>
                  </div>
                  <div className="text-sm text-muted">📂 {h.folderName}</div>
                  <div className="truncate text-sm">{h.snippet}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
