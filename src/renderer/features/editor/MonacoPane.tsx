import Editor, { type OnMount } from '@monaco-editor/react';
import { useRef } from 'react';
import './monacoSetup';
import { languageFor } from './languages';

export function MonacoPane({
  path,
  value,
  fontSize,
  dark,
  onChange,
  onSave,
}: {
  path: string;
  value: string;
  fontSize: number;
  dark: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}): React.JSX.Element {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const onMount: OnMount = (editor, monaco) => {
    // Ctrl+S / ⌘+S 저장
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
    editor.focus();
  };
  return (
    <Editor
      path={path}
      value={value}
      language={languageFor(path)}
      theme={dark ? 'vs-dark' : 'vs'}
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      loading="편집기를 준비하는 중이에요…"
      options={{
        fontSize,
        minimap: { enabled: false },
        wordWrap: 'on',
        automaticLayout: true,
        unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
      }}
    />
  );
}
