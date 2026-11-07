import type { HomeSort, WorkspaceView } from '../../../shared/types';
import { WorkspaceCard, displayName, type WorkspaceCardHandlers } from './WorkspaceCard';

/** 검색어로 거르고(이름·별칭·메모·경로) 정렬한다. 순수 함수. */
export function filterAndSortWorkspaces(list: readonly WorkspaceView[], query: string, sort: HomeSort): WorkspaceView[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? list.filter((w) => [displayName(w), w.alias ?? '', w.memo ?? '', w.path].some((s) => s.toLowerCase().includes(q)))
    : [...list];
  const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  const byRecent = (a: WorkspaceView, b: WorkspaceView): number => b.lastActiveAt.localeCompare(a.lastActiveAt);
  const byName = (a: WorkspaceView, b: WorkspaceView): number => collator.compare(displayName(a), displayName(b));
  return filtered.sort((a, b) => {
    if (sort === 'pinned' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return sort === 'name' ? byName(a, b) : byRecent(a, b);
  });
}

export function WorkspaceList({ workspaces, handlers }: { workspaces: WorkspaceView[]; handlers: WorkspaceCardHandlers }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-4">
      {workspaces.map((w) => (
        <WorkspaceCard key={w.id} workspace={w} handlers={handlers} />
      ))}
    </div>
  );
}
