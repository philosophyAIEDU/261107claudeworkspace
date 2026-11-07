import { useState } from 'react';
import type { WorkspaceView } from '../../../shared/types';
import { ko } from '../../i18n/ko';
import { TAG_COLORS } from '../../lib/colors';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { displayName } from './WorkspaceCard';

export interface WorkspaceInfo {
  alias: string;
  memo: string;
  color: string;
}

export function WorkspaceInfoDialog({ workspace, onSave, onCancel }: { workspace: WorkspaceView; onSave: (v: WorkspaceInfo) => void; onCancel: () => void }): React.JSX.Element {
  const [alias, setAlias] = useState(workspace.alias ?? '');
  const [memo, setMemo] = useState(workspace.memo ?? '');
  const [color, setColor] = useState(workspace.color ?? '');
  return (
    <Modal title={`${ko.workspaceCard.editInfo} · ${displayName(workspace)}`} onClose={onCancel}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ alias, memo, color });
        }}
      >
        <label className="font-medium">
          {ko.workspaceCard.aliasLabel}
          <input data-autofocus className="mt-1 block w-full rounded-lg border border-line bg-bg p-2" value={alias} placeholder={displayName({ path: workspace.path })} onChange={(e) => setAlias(e.target.value)} />
        </label>
        <label className="font-medium">
          {ko.workspaceCard.memoLabel}
          <input className="mt-1 block w-full rounded-lg border border-line bg-bg p-2" value={memo} placeholder={ko.workspaceCard.memoPlaceholder} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <fieldset>
          <legend className="font-medium">{ko.workspaceCard.colorLabel}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {[{ value: '', label: ko.workspaceCard.noColor }, ...ko.colors].map((c) => (
              <label key={c.value || 'none'} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 ${color === c.value ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <input type="radio" name="color" className="sr-only" checked={color === c.value} onChange={() => setColor(c.value)} />
                <span className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: c.value ? TAG_COLORS[c.value] : 'transparent' }} aria-hidden />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{ko.common.cancel}</Button>
          <Button type="submit" variant="primary">
            {ko.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
