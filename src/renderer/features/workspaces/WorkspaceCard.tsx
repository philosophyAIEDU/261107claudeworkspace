import type { WorkspaceView } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { baseName, relativeTime } from '../../lib/time';
import { TAG_COLORS } from '../../lib/colors';
import { Button } from '../../components/Button';
import { Menu } from '../../components/Menu';
import { HelpTip } from '../../components/Tooltip';

export interface WorkspaceCardHandlers {
  onResume: (w: WorkspaceView) => void;
  onNewSession: (w: WorkspaceView) => void;
  onOpenOnly: (w: WorkspaceView) => void;
  onTogglePin: (w: WorkspaceView) => void;
  onEditInfo: (w: WorkspaceView) => void;
  onRemove: (w: WorkspaceView) => void;
  onRelocate: (w: WorkspaceView) => void;
}

export function displayName(w: Pick<WorkspaceView, 'alias' | 'path'>): string {
  return w.alias || baseName(w.path);
}

export function WorkspaceCard({ workspace: w, handlers, now }: { workspace: WorkspaceView; handlers: WorkspaceCardHandlers; now?: Date }): React.JSX.Element {
  const colorLabel = ko.colors.find((c) => c.value === w.color)?.label;
  return (
    <article
      aria-label={displayName(w)}
      className={`relative flex flex-col gap-2 rounded-2xl border bg-panel p-4 shadow-sm ${w.missing ? 'border-danger' : 'border-line'}`}
      style={w.color && TAG_COLORS[w.color] ? { borderLeft: `6px solid ${TAG_COLORS[w.color]}` } : undefined}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-lg font-bold">
            {w.pinned && (
              <span aria-label={ko.workspaceCard.pinned} title={ko.workspaceCard.pinned}>
                📌
              </span>
            )}
            <span className="truncate">{displayName(w)}</span>
            {colorLabel && <span className="shrink-0 rounded bg-panel-2 px-1.5 text-xs font-normal">{colorLabel}</span>}
          </h3>
          <p className="truncate text-xs text-muted" title={w.path}>
            {w.path}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md px-1.5 py-1 text-sm hover:bg-panel-2"
          aria-pressed={w.pinned}
          title={w.pinned ? ko.workspaceCard.unpin : ko.workspaceCard.pin}
          aria-label={w.pinned ? ko.workspaceCard.unpin : ko.workspaceCard.pin}
          onClick={() => handlers.onTogglePin(w)}
        >
          {w.pinned ? '📌' : '📍'}
        </button>
        <Menu
          label={ko.workspaceCard.menu}
          items={[
            { label: ko.workspaceCard.editInfo, onSelect: () => handlers.onEditInfo(w) },
            { label: ko.workspaceCard.relocate, onSelect: () => handlers.onRelocate(w) },
            { label: ko.workspaceCard.remove, danger: true, onSelect: () => handlers.onRemove(w), separatorBefore: true },
          ]}
        />
      </header>

      {w.memo && <p className="text-base">📝 {w.memo}</p>}

      {w.missing ? (
        <div role="alert" className="rounded-lg bg-panel-2 p-3">
          <p className="font-semibold text-danger">{ko.workspaceCard.missing}</p>
          <p className="text-sm text-muted">{ko.workspaceCard.missingBody}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => handlers.onRelocate(w)}>
              {ko.workspaceCard.relocate}
            </Button>
            <Button onClick={() => handlers.onRemove(w)}>{ko.workspaceCard.remove}</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {ko.workspaceCard.lastWork(relativeTime(w.lastActiveAt, now))} · {ko.workspaceCard.sessionCount(w.sessionCount)}
          </p>
          <p className="truncate text-sm">{w.lastSessionTitle ? ko.workspaceCard.lastSession(w.lastSessionTitle) : ko.workspaceCard.noSession}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => handlers.onResume(w)}>
              {ko.workspaceCard.resume}
            </Button>
            <HelpTip text={ko.workspaceCard.resumeTip} />
            <Button onClick={() => handlers.onNewSession(w)}>{ko.workspaceCard.newSession}</Button>
            <Button variant="ghost" onClick={() => handlers.onOpenOnly(w)}>
              {ko.workspaceCard.openOnly}
            </Button>
          </div>
        </>
      )}
    </article>
  );
}
