import { useEffect, useState, type ReactNode } from 'react';
import type { AppSettings, FontScale } from '../../shared/types';
import { ko } from '../i18n/ko';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { HelpTip } from '../components/Tooltip';
import { Modal } from '../components/Modal';
import { ImportPanel } from '../features/sessions/ImportPanel';

function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function PathRow({ label, help, value, onPick, onReset }: { label: string; help?: string; value?: string; onPick: () => void; onReset?: () => void }): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-2 font-medium">
        {label} {help && <HelpTip text={help} />}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-panel-2 px-2 py-1.5 text-sm">{value || ko.settings.notSet}</code>
        <Button onClick={onPick}>{ko.settings.pick}</Button>
        {onReset && value && <Button variant="ghost" onClick={onReset}>{ko.settings.reset}</Button>}
      </div>
    </div>
  );
}

function ScaleRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }): React.JSX.Element {
  const step = 0.1;
  const set = (v: number): void => onChange(Math.round(Math.max(min, Math.min(max, v)) * 10) / 10);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-32 font-medium">{label}</span>
      <Button aria-label={`${label} ${ko.settings.smaller}`} onClick={() => set(value - step)}>
        A−
      </Button>
      <output className="w-16 text-center">{Math.round(value * 100)}%</output>
      <Button aria-label={`${label} ${ko.settings.bigger}`} onClick={() => set(value + step)}>
        A＋
      </Button>
    </div>
  );
}

export function SettingsPage(): React.JSX.Element {
  const { settings, updateSettings } = useApp();
  const toast = useToast();
  const [phrases, setPhrases] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [claudeInfo, setClaudeInfo] = useState<string>('');

  useEffect(() => {
    if (settings) setPhrases(settings.quickPhrases.join('\n'));
  }, [settings?.quickPhrases]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void api()
      .invoke('setup:checkClaude', undefined)
      .then((r) => setClaudeInfo(r.found ? `${ko.setup.found(r.version ?? '?')} — ${r.path ?? ''}` : (r.error ?? ko.setup.notFoundTitle)))
      .catch(() => undefined);
  }, [settings?.claudePath]);

  if (!settings) return <p className="p-6">{ko.common.loading}</p>;

  const set = (patch: Partial<AppSettings>): void => {
    void updateSettings(patch).then(() => toast.show(ko.settings.saved));
  };
  const setScale = (k: keyof FontScale, v: number): void => void updateSettings({ fontScale: { ...settings.fontScale, [k]: v } });

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
        <h1 className="text-2xl font-bold">{ko.settings.title}</h1>

        <Section title={ko.settings.claudeSection}>
          <PathRow
            label={ko.settings.claudePath}
            help={ko.settings.claudePathHelp}
            value={settings.claudePath ?? ko.settings.claudePathAuto}
            onPick={() => void api().invoke('setup:pickClaudePath', undefined).then(() => api().invoke('settings:get', undefined)).then((s) => updateSettings({ claudePath: s.claudePath }))}
            onReset={settings.claudePath ? () => set({ claudePath: '' }) : undefined}
          />
          <p className="text-sm text-muted">{claudeInfo}</p>
        </Section>

        <Section title={ko.settings.folderSection}>
          <PathRow
            label={ko.settings.defaultParent}
            value={settings.defaultParentFolder}
            onPick={() => void api().invoke('settings:pickFolder', undefined).then((p) => p && set({ defaultParentFolder: p }))}
          />
          <PathRow
            label={ko.settings.externalIde}
            help={ko.settings.externalIdeHelp}
            value={settings.externalIdePath}
            onPick={() => void api().invoke('settings:pickFile', undefined).then((p) => p && set({ externalIdePath: p }))}
            onReset={() => set({ externalIdePath: '' })}
          />
        </Section>

        <Section title={ko.settings.layoutSection}>
          <fieldset className="flex flex-wrap items-center gap-4">
            <legend className="mb-1 font-medium">{ko.settings.terminalPosition}</legend>
            {(['right', 'bottom'] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="pos" checked={settings.terminalPosition === v} onChange={() => set({ terminalPosition: v })} />
                {v === 'right' ? ko.settings.right : ko.settings.bottom}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-4">
            <legend className="mb-1 font-medium">{ko.settings.theme}</legend>
            {(
              [
                ['light', ko.settings.themeLight],
                ['dark', ko.settings.themeDark],
                ['system', ko.settings.themeSystem],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" name="theme" checked={settings.theme === v} onChange={() => set({ theme: v })} />
                {label}
              </label>
            ))}
          </fieldset>
        </Section>

        <Section title={ko.settings.fontSection}>
          <ScaleRow label={ko.settings.fontUi} value={settings.fontScale.ui} min={0.8} max={1.6} onChange={(v) => setScale('ui', v)} />
          <ScaleRow label={ko.settings.fontEditor} value={settings.fontScale.editor} min={0.8} max={2.4} onChange={(v) => setScale('editor', v)} />
          <ScaleRow label={ko.settings.fontTerminal} value={settings.fontScale.terminal} min={0.8} max={2.4} onChange={(v) => setScale('terminal', v)} />
        </Section>

        <Section title={ko.settings.inputSection}>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.koreanInputBox} onChange={(e) => set({ koreanInputBox: e.target.checked })} />
            {ko.settings.koreanInput}
          </label>
          <label className="font-medium">
            {ko.settings.quickPhrases}
            <textarea className="mt-1 block w-full rounded-lg border border-line bg-bg p-2" rows={5} value={phrases} onChange={(e) => setPhrases(e.target.value)} />
          </label>
          <div>
            <Button
              variant="primary"
              onClick={() =>
                set({
                  quickPhrases: phrases
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 30),
                })
              }
            >
              {ko.common.save}
            </Button>
          </div>
        </Section>

        <Section title={ko.settings.dataSection}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void api().invoke('sessions:sync', undefined).then((r) => toast.show(ko.settings.resyncDone(r.added)))}>{ko.settings.resync}</Button>
            <Button onClick={() => setImportOpen(true)}>{ko.settings.importAgain}</Button>
          </div>
          <p className="text-sm text-muted">🔒 {ko.settings.privacy}</p>
        </Section>
      </div>
      {importOpen && (
        <Modal title={ko.setup.importTitle} onClose={() => setImportOpen(false)} wide>
          <ImportPanel onDone={() => setImportOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
