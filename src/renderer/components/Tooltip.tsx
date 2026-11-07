import { useId, useState, type ReactNode } from 'react';

/** (?) 물음표를 누르거나 마우스를 올리면 쉬운 설명이 나온다. 키보드로도 열 수 있다. */
export function HelpTip({ text, label = '도움말' }: { text: ReactNode; label?: string }): React.JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-panel-2 text-xs font-bold text-muted hover:text-fg"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-panel p-3 text-sm font-normal leading-snug text-fg shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
