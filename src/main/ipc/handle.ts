import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ipcRequestSchemas, type IpcChannel } from '../../shared/schemas';
import type { IpcRequest, IpcResponseMap, IpcResult } from '../../shared/ipc';
import { toUserMessage, UserError } from '../errors';

type Handler<C extends IpcChannel> = (request: IpcRequest<C>, event: IpcMainInvokeEvent) => Promise<IpcResponseMap[C]> | IpcResponseMap[C];

const handlers = new Map<IpcChannel, Handler<IpcChannel>>();

export function handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  handlers.set(channel, handler as unknown as Handler<IpcChannel>);
}

/**
 * 화면에서 오는 모든 요청은 'api:invoke' 하나로 들어온다.
 * 1) 보낸 곳이 우리 앱 화면인지 확인하고
 * 2) 채널 이름이 등록된 것인지 확인한 뒤
 * 3) zod 스키마로 요청 내용을 검사해서
 * 통과한 경우에만 처리한다.
 */
export function installIpcRouter(isTrustedSender: (event: IpcMainInvokeEvent) => boolean): void {
  ipcMain.handle('api:invoke', async (event, channel: unknown, request: unknown): Promise<IpcResult<unknown>> => {
    try {
      if (!isTrustedSender(event)) throw new UserError('허용되지 않은 요청이에요.', 'UNTRUSTED');
      if (typeof channel !== 'string' || !(channel in ipcRequestSchemas)) {
        throw new UserError('알 수 없는 요청이에요.', 'UNKNOWN_CHANNEL');
      }
      const ch = channel as IpcChannel;
      const handler = handlers.get(ch);
      if (!handler) throw new UserError('아직 준비되지 않은 기능이에요.', 'NO_HANDLER');
      const parsed = ipcRequestSchemas[ch].safeParse(request);
      if (!parsed.success) throw new UserError('요청 내용이 올바르지 않아요.', 'BAD_REQUEST');
      const value = await handler(parsed.data as IpcRequest<IpcChannel>, event);
      return { ok: true, value };
    } catch (err) {
      if (!(err instanceof UserError)) console.error(`[ipc] ${String(channel)} 실패:`, err);
      return { ok: false, ...toUserMessage(err) };
    }
  });
}
