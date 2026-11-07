import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ko } from '../i18n/ko';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface PromptOptions {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  multiline?: boolean;
  allowEmpty?: boolean;
}

interface DialogApi {
  confirm(opts: ConfirmOptions): Promise<boolean>;
  prompt(opts: PromptOptions): Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

export function ConfirmDialog({ opts, onAnswer }: { opts: ConfirmOptions; onAnswer: (v: boolean) => void }): React.JSX.Element {
  return (
    <Modal title={opts.title} onClose={() => onAnswer(false)}>
      {opts.body && <div className="mb-5 text-base text-muted">{opts.body}</div>}
      <div className="flex justify-end gap-2">
        <Button onClick={() => onAnswer(false)}>{opts.cancelLabel ?? ko.common.cancel}</Button>
        <Button data-autofocus variant={opts.danger ? 'danger' : 'primary'} onClick={() => onAnswer(true)}>
          {opts.confirmLabel ?? ko.common.ok}
        </Button>
      </div>
    </Modal>
  );
}

function PromptDialog({ opts, onAnswer }: { opts: PromptOptions; onAnswer: (v: string | null) => void }): React.JSX.Element {
  const [value, setValue] = useState(opts.initial ?? '');
  const valid = opts.allowEmpty || value.trim().length > 0;
  const submit = (): void => {
    if (valid) onAnswer(value);
  };
  return (
    <Modal title={opts.title} onClose={() => onAnswer(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="mb-1 block font-medium">
          {opts.label}
          {opts.multiline ? (
            <textarea
              className="mt-1 block w-full rounded-lg border border-line bg-bg p-2 text-base"
              rows={4}
              value={value}
              placeholder={opts.placeholder}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <input
              className="mt-1 block w-full rounded-lg border border-line bg-bg p-2 text-base"
              value={value}
              placeholder={opts.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => onAnswer(null)}>{ko.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {opts.confirmLabel ?? ko.common.ok}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DialogProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })), []);
  const prompt = useCallback((opts: PromptOptions) => new Promise<string | null>((resolve) => setPending({ kind: 'prompt', opts, resolve })), []);
  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {pending?.kind === 'confirm' && (
        <ConfirmDialog
          opts={pending.opts}
          onAnswer={(v) => {
            setPending(null);
            pending.resolve(v);
          }}
        />
      )}
      {pending?.kind === 'prompt' && (
        <PromptDialog
          opts={pending.opts}
          onAnswer={(v) => {
            setPending(null);
            pending.resolve(v);
          }}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('DialogProvider가 없어요');
  return ctx;
}
