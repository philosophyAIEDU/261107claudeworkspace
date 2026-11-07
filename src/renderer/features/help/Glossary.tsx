import { ko } from '../../i18n/ko';

export function Glossary(): React.JSX.Element {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
      {ko.help.glossary.map((g) => (
        <div key={g.term} className="contents">
          <dt className="font-semibold">{g.term}</dt>
          <dd className="text-muted">{g.desc}</dd>
        </div>
      ))}
    </dl>
  );
}
