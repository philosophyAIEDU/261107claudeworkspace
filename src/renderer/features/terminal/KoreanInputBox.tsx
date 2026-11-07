import { useRef, useState } from 'react';
import { ko } from '../../i18n/ko';
import { Button } from '../../components/Button';
import { HelpTip } from '../../components/Tooltip';
import { canSend } from './sendToClaude';

export interface KoreanInputBoxProps {
  onSend: (text: string) => Promise<void> | void;
  quickPhrases: readonly string[];
  history: readonly string[];
  onHistoryAdd?: (text: string) => void;
  disabled?: boolean;
  onHide?: () => void;
}

/**
 * 터미널 아래의 한글 입력창. 일반 textarea라서 한글 조합이 깨지지 않는다.
 * Ctrl+Enter(맥은 ⌘+Enter)로 보내고, ↑/↓로 최근에 보낸 문장을 불러온다.
 */
export function KoreanInputBox({ onSend, quickPhrases, history, onHistoryAdd, disabled, onHide }: KoreanInputBoxProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [histIndex, setHistIndex] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const sendable = canSend(text) && !disabled && !sending;

  const send = async (): Promise<void> => {
    if (!sendable) return;
    setSending(true);
    try {
      await onSend(text);
      onHistoryAdd?.(text);
      setText('');
      setHistIndex(null);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // 한글 조합 중에 누른 Enter는 글자 확정용이므로 무시한다.
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
      return;
    }
    const ta = e.currentTarget;
    if (e.key === 'ArrowUp' && history.length > 0 && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      e.preventDefault();
      const i = histIndex === null ? history.length - 1 : Math.max(0, histIndex - 1);
      setHistIndex(i);
      setText(history[i] ?? '');
      return;
    }
    if (e.key === 'ArrowDown' && histIndex !== null && ta.selectionStart === ta.value.length) {
      e.preventDefault();
      const i = histIndex + 1;
      if (i >= history.length) {
        setHistIndex(null);
        setText('');
      } else {
        setHistIndex(i);
        setText(history[i] ?? '');
      }
    }
  };

  return (
    <div className="border-t border-line bg-panel p-2">
      <div className="mb-1 flex items-center gap-2">
        <label htmlFor="korean-input" className="text-sm font-semibold">
          ⌨️ {ko.input.label}
        </label>
        <HelpTip text={`${ko.input.help} ${ko.input.historyTip}`} />
        <div className="flex-1" />
        {onHide && (
          <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={onHide}>
            {ko.input.hide}
          </button>
        )}
      </div>
      {quickPhrases.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1" role="group" aria-label={ko.input.quick}>
          {quickPhrases.map((p) => (
            <button
              key={p}
              type="button"
              className="rounded-full border border-line bg-panel-2 px-2.5 py-0.5 text-sm hover:border-accent"
              onClick={() => {
                setText(p);
                ref.current?.focus();
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          id="korean-input"
          ref={ref}
          value={text}
          rows={3}
          disabled={disabled}
          placeholder={ko.input.placeholder}
          className="min-h-[4.5rem] flex-1 resize-y rounded-lg border border-line bg-bg p-2 text-base leading-snug"
          onChange={(e) => {
            setText(e.target.value);
            setHistIndex(null);
          }}
          onKeyDown={onKeyDown}
        />
        <Button variant="primary" size="lg" disabled={!sendable} onClick={() => void send()} title={ko.input.sendTip}>
          {ko.input.send}
        </Button>
      </div>
    </div>
  );
}
