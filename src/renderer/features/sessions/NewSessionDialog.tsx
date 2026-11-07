import { useState } from 'react';
import type { PermissionMode } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { HelpTip } from '../../components/Tooltip';

export interface NewSessionValues {
  title: string;
  model?: string;
  permissionMode?: PermissionMode;
}

/** 새 대화 시작 창: 이름(기본값 제공) + 고급 옵션(모델, 권한 모드) */
export function NewSessionDialog({
  defaultTitle,
  folderName,
  onSubmit,
  onCancel,
}: {
  defaultTitle: string;
  folderName: string;
  onSubmit: (v: NewSessionValues) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(defaultTitle);
  const [model, setModel] = useState('');
  const [perm, setPerm] = useState<PermissionMode>('default');
  const valid = title.trim().length > 0;
  return (
    <Modal title={`${ko.sessions.newSessionTitle} · ${folderName}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit({ title: title.trim(), model: model || undefined, permissionMode: perm });
        }}
        className="flex flex-col gap-4"
      >
        <label className="font-medium">
          {ko.sessions.newTitleLabel}
          <input
            data-autofocus
            className="mt-1 block w-full rounded-lg border border-line bg-bg p-2 text-base"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer font-medium">{ko.sessions.advanced}</summary>
          <div className="mt-3 flex flex-col gap-3">
            <label className="font-medium">
              <span className="flex items-center gap-2">
                {ko.sessions.newSessionModel} <HelpTip text={ko.sessions.newSessionModelHelp} />
              </span>
              <select className="mt-1 block w-full rounded-lg border border-line bg-bg p-2" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">{ko.sessions.modelDefault}</option>
                <option value="opus">{ko.sessions.modelOpus}</option>
                <option value="sonnet">{ko.sessions.modelSonnet}</option>
                <option value="haiku">{ko.sessions.modelHaiku}</option>
              </select>
            </label>
            <fieldset>
              <legend className="font-medium">{ko.sessions.newSessionPerm}</legend>
              {(
                [
                  ['default', ko.sessions.permDefault],
                  ['acceptEdits', ko.sessions.permAcceptEdits],
                  ['plan', ko.sessions.permPlan],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="mt-1 flex items-center gap-2">
                  <input type="radio" name="perm" value={value} checked={perm === value} onChange={() => setPerm(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        </details>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{ko.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {ko.sessions.start}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
