import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
  separatorBefore?: boolean;
}

/** "⋯ 더 보기" 같은 작은 펼침 메뉴. 키보드(↑/↓/Enter/Esc)로도 쓸 수 있다. */
export function Menu({ label, items, buttonClassName = '', align = 'right' }: { label: string; items: MenuItem[]; buttonClassName?: string; align?: 'left' | 'right' }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const move = (dir: 1 | -1): void => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + dir + items.length) % items.length]?.focus();
  };

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`rounded-md px-2 py-1 text-muted hover:bg-panel-2 hover:text-fg ${buttonClassName}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          className={`absolute top-full z-40 mt-1 min-w-[14rem] rounded-xl border border-line bg-panel p-1 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              move(1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              move(-1);
            }
          }}
        >
          {items.map((it) => (
            <div key={it.label}>
              {it.separatorBefore && <div className="my-1 border-t border-line" role="separator" />}
              <button
                type="button"
                role="menuitem"
                title={it.hint}
                className={`block w-full rounded-lg px-3 py-1.5 text-left text-base hover:bg-panel-2 focus:bg-panel-2 ${it.danger ? 'text-danger' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
