import { ko } from '../../i18n/ko';

export function QuickStart(): React.JSX.Element {
  return (
    <ol className="flex flex-col gap-2">
      {ko.help.quickStart.map((s, i) => (
        <li key={s} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-fg" aria-hidden>
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
