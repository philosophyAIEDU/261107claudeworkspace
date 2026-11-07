import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ExposedApi, IpcEventName, IpcResult } from '../shared/ipc';

// 화면(렌더러)은 Node·파일·PTY에 직접 손대지 못한다.
// 여기서 노출한 두 함수(invoke, on)만 쓸 수 있고, 실제 검사는 메인 프로세스가 한다.

const EVENTS: readonly IpcEventName[] = [
  'pty:data',
  'pty:exit',
  'sessions:changed',
  'workspaces:changed',
  'files:changed',
  'app:closeRequested',
];

const api: ExposedApi = {
  async invoke(channel, request) {
    const result = (await ipcRenderer.invoke('api:invoke', channel, request)) as IpcResult<never>;
    if (result.ok) return result.value;
    const err = new Error(result.error);
    (err as Error & { code?: string }).code = result.code;
    throw err;
  },
  on(event, listener) {
    if (!EVENTS.includes(event)) throw new Error('unknown event');
    const wrapped = (_e: IpcRendererEvent, payload: unknown): void => listener(payload as never);
    ipcRenderer.on(`event:${event}`, wrapped);
    return () => {
      ipcRenderer.removeListener(`event:${event}`, wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
