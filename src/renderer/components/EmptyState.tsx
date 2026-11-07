import type { ReactNode } from 'react';

export function EmptyState({ icon, title, body, children }: { icon?: string; title: string; body?: ReactNode; children?: ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      {icon && (
        <div className="text-5xl" aria-hidden>
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="max-w-md text-muted">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
