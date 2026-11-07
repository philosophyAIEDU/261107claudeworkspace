import { ko } from '../../i18n/ko';
import { baseName } from '../../lib/time';
import { isDirty, type CenterTab } from './useFiles';

export function EditorTabs({
  tabs,
  activeKey,
  onSelect,
  onClose,
  titleFor,
}: {
  tabs: CenterTab[];
  activeKey: string | null;
  onSelect: (k: string) => void;
  onClose: (k: string) => void;
  titleFor: (t: CenterTab) => string;
}): React.JSX.Element | null {
  if (tabs.length === 0) return null;
  return (
    <div role="tablist" aria-label="열린 파일" className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line bg-panel-2 px-1 pt-1">
      {tabs.map((t) => {
        const active = t.key === activeKey;
        const dirty = isDirty(t);
        const title = t.kind === 'file' ? baseName(t.path) : ko.editor.historyTab(titleFor(t));
        return (
          <div key={t.key} className={`flex max-w-[16rem] shrink-0 items-center rounded-t-md border border-b-0 ${active ? 'border-line bg-bg' : 'border-transparent'}`}>
            <button type="button" role="tab" aria-selected={active} title={t.kind === 'file' ? t.path : title} className="truncate py-1 pl-3 pr-1 text-sm" onClick={() => onSelect(t.key)}>
              {title}
              {dirty && (
                <span className="ml-1 text-accent" title={ko.editor.unsaved}>
                  ● <span className="sr-only">{ko.editor.unsaved}</span>
                </span>
              )}
            </button>
            <button type="button" aria-label={`${ko.common.close}: ${title}`} className="mr-1 rounded px-1 text-muted hover:bg-panel hover:text-fg" onClick={() => onClose(t.key)}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
