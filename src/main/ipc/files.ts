import { spawn } from 'node:child_process';
import path from 'node:path';
import { shell } from 'electron';
import { UserError } from '../errors';
import { assertInsideAny, isInside } from '../fs/pathGuard';
import { listDirectory } from '../fs/fileTree';
import { createEntry, readTextFile, renameEntry, writeTextFile } from '../fs/fileService';
import { handle } from './handle';
import { findWorkspace } from './workspaces';
import type { MainContext } from './context';

// 파일 접근은 "등록된 작업 폴더 안"으로만 제한한다. (pathGuard.ts 설명 참고)
function roots(ctx: MainContext): string[] {
  return ctx.store.get().workspaces.filter((w) => !w.missing).map((w) => w.path);
}

function guard(ctx: MainContext, target: string): string {
  return assertInsideAny(roots(ctx), target, { platform: ctx.platform });
}

export function registerFileHandlers(ctx: MainContext): void {
  handle('files:tree', async ({ workspaceId, dir }) => {
    const ws = findWorkspace(ctx, workspaceId);
    if (!isInside(ws.path, dir, { platform: ctx.platform })) throw new UserError('작업 폴더 밖은 볼 수 없어요.', 'PATH_OUTSIDE');
    try {
      return await listDirectory(dir);
    } catch {
      throw new UserError('폴더를 읽지 못했어요. 폴더가 옮겨졌거나 권한이 없을 수 있어요.', 'READ_DIR');
    }
  });

  handle('files:read', ({ path: p }) => readTextFile(guard(ctx, p)));

  handle('files:write', async ({ path: p, content }) => {
    const safe = guard(ctx, p);
    ctx.fileWatcher.markOwnWrite(safe);
    await writeTextFile(safe, content);
  });

  handle('files:create', async ({ path: p, kind }) => {
    const safe = guard(ctx, p);
    ctx.fileWatcher.markOwnWrite(safe);
    await createEntry(safe, kind);
  });

  handle('files:rename', async ({ from, to }) => {
    const a = guard(ctx, from);
    const b = guard(ctx, to);
    await renameEntry(a, b);
  });

  // 영구 삭제가 아니라 휴지통으로 보낸다(실수해도 되살릴 수 있게).
  handle('files:trash', async ({ path: p }) => {
    const safe = guard(ctx, p);
    if (roots(ctx).some((r) => path.resolve(r) === path.resolve(safe))) {
      throw new UserError('작업 폴더 자체는 여기서 지울 수 없어요.', 'ROOT');
    }
    await shell.trashItem(safe);
  });

  handle('files:reveal', ({ path: p }) => {
    shell.showItemInFolder(guard(ctx, p));
  });

  handle('files:openInIde', async ({ path: p }) => {
    const safe = guard(ctx, p);
    const ide = ctx.store.get().settings.externalIdePath;
    if (!ide) throw new UserError('설정에서 "다른 IDE" 실행 파일 위치를 먼저 지정해 주세요.', 'NO_IDE');
    // 인자 배열로 넘겨 경로에 공백·한글이 있어도 안전하게 연다.
    const child =
      ctx.platform === 'darwin' && ide.endsWith('.app')
        ? spawn('open', ['-a', ide, safe], { detached: true, stdio: 'ignore' })
        : spawn(ide, [safe], { detached: true, stdio: 'ignore', windowsHide: false });
    await new Promise<void>((resolve, reject) => {
      child.once('error', () => reject(new UserError('다른 IDE를 열지 못했어요. 설정의 실행 파일 위치를 확인해 주세요.', 'IDE_FAILED')));
      child.once('spawn', () => resolve());
    });
    child.unref();
  });

  handle('files:watch', async ({ workspaceId }) => {
    const ws = workspaceId ? ctx.store.get().workspaces.find((w) => w.id === workspaceId) : undefined;
    await ctx.fileWatcher.watch(ws?.id, ws?.path);
  });
}
