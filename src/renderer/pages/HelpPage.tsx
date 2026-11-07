import type { ReactNode } from 'react';
import { ko } from '../i18n/ko';
import { api } from '../lib/api';
import { Glossary } from '../features/help/Glossary';
import { QuickStart } from '../features/help/QuickStart';

function Card({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function HelpPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
        <h1 className="text-2xl font-bold">{ko.help.title}</h1>
        <Card title={ko.help.whatTitle}>
          <ul className="list-disc pl-6">
            {ko.help.whatBody.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
        <Card title={ko.help.quickStartTitle}>
          <QuickStart />
        </Card>
        <Card title={ko.help.commandsTitle}>
          <p className="mb-3 text-muted">{ko.help.commandsIntro}</p>
          <table className="w-full text-left">
            <tbody>
              {ko.help.commands.map((c) => (
                <tr key={c.cmd} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-1.5 pr-4 font-mono font-semibold">
                    {c.cmd}
                  </th>
                  <td className="py-1.5">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={ko.help.keysTitle}>
          <ul className="flex flex-col gap-1">
            {ko.help.keys.map((k) => (
              <li key={k.key}>
                <kbd className="rounded border border-line bg-panel-2 px-1.5 font-mono text-sm">{k.key}</kbd> {k.desc}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={ko.help.glossaryTitle}>
          <Glossary />
        </Card>
        <Card title={ko.help.faqTitle}>
          <dl className="flex flex-col gap-3">
            {ko.help.faq.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold">❓ {f.q}</dt>
                <dd className="text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <div>
          <button type="button" className="text-accent underline" onClick={() => void api().invoke('shell:openExternal', { url: ko.help.docsUrl })}>
            {ko.help.docsLink} ↗
          </button>
        </div>
      </div>
    </div>
  );
}
