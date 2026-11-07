import { useRef } from 'react';

/**
 * 패널 크기 조절 손잡이. 마우스로 끌거나, 초점을 둔 뒤 화살표 키로 조절한다.
 * direction: 'x'는 좌우로, 'y'는 위아래로 조절. invert는 오른쪽/아래 패널처럼 반대 방향일 때.
 */
export function ResizeHandle({
  direction,
  value,
  min,
  max,
  onChange,
  invert = false,
  label,
}: {
  direction: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  invert?: boolean;
  label: string;
}): React.JSX.Element {
  const start = useRef<{ pos: number; value: number } | null>(null);
  const clamp = (v: number): number => Math.max(min, Math.min(max, v));
  return (
    <div
      role="separator"
      aria-orientation={direction === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={`shrink-0 bg-line/60 transition hover:bg-accent focus:bg-accent ${direction === 'x' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { pos: direction === 'x' ? e.clientX : e.clientY, value };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const delta = (direction === 'x' ? e.clientX : e.clientY) - start.current.pos;
        onChange(clamp(start.current.value + (invert ? -delta : delta)));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 60 : 20;
        const dec = direction === 'x' ? 'ArrowLeft' : 'ArrowUp';
        const inc = direction === 'x' ? 'ArrowRight' : 'ArrowDown';
        if (e.key === dec || e.key === inc) {
          e.preventDefault();
          const sign = (e.key === inc ? 1 : -1) * (invert ? -1 : 1);
          onChange(clamp(value + sign * step));
        }
      }}
    />
  );
}
