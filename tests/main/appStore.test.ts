import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppStore } from '../../src/main/store/AppStore';
import { writeFileAtomic } from '../../src/main/store/atomicWrite';

const tmp = (): string => mkdtempSync(path.join(os.tmpdir(), 'pcw-store-'));

describe('AppStore', () => {
  it('처음 실행이면 기본값으로 시작하고, 저장하면 파일이 생긴다', async () => {
    const dir = tmp();
    const file = path.join(dir, 'app-data.json');
    const store = await AppStore.open(file, '/docs/필로소피 Claude 작업실');
    expect(store.outcome).toBe('new');
    expect(store.get().settings.defaultParentFolder).toBe('/docs/필로소피 Claude 작업실');
    await store.update((d) => {
      d.workspaces.push({ id: 'w1', path: '/수업', pinned: true, lastOpenedAt: new Date().toISOString() });
    });
    const again = await AppStore.open(file, '/x');
    expect(again.outcome).toBe('loaded');
    expect(again.get().workspaces[0]!.path).toBe('/수업');
  });

  it('원자적 쓰기: 임시 파일이 남지 않고 내용이 통째로 바뀐다', async () => {
    const dir = tmp();
    const file = path.join(dir, 'a.json');
    await writeFileAtomic(file, '{"a":1}');
    await writeFileAtomic(file, '{"a":2}');
    expect(readFileSync(file, 'utf8')).toBe('{"a":2}');
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('저장할 때 직전 정상본을 .bak으로 남기고, 깨진 파일은 .bak으로 복구한다', async () => {
    const dir = tmp();
    const file = path.join(dir, 'app-data.json');
    const s = await AppStore.open(file, '/p');
    await s.update((d) => {
      d.workspaces.push({ id: 'w1', path: '/one', pinned: false, lastOpenedAt: '2026-01-01T00:00:00.000Z' });
    });
    await s.update((d) => {
      d.workspaces.push({ id: 'w2', path: '/two', pinned: false, lastOpenedAt: '2026-01-01T00:00:00.000Z' });
    });
    expect(existsSync(`${file}.bak`)).toBe(true);
    writeFileSync(file, '{ 깨진 JSON');
    const restored = await AppStore.open(file, '/p');
    expect(restored.outcome).toBe('restoredFromBackup');
    expect(restored.get().workspaces.map((w) => w.id)).toEqual(['w1']);
    // 깨진 원본은 따로 보관된다
    expect(readdirSync(dir).some((f) => f.includes('.broken-'))).toBe(true);
  });

  it('스키마 검증 실패 + 백업 없음 → 살릴 수 있는 항목만 건지고 나머지는 기본값', async () => {
    const dir = tmp();
    const file = path.join(dir, 'app-data.json');
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        workspaces: [{ id: 'ok', path: '/ok', pinned: false, lastOpenedAt: 'x' }, { id: 123 }],
        sessions: 'not-an-array',
        settings: { theme: 'neon' },
      }),
    );
    const s = await AppStore.open(file, '/p');
    expect(s.outcome).toBe('reset');
    expect(s.get().workspaces.map((w) => w.id)).toEqual(['ok']);
    expect(s.get().sessions).toEqual([]);
    expect(s.get().settings.theme).toBe('system');
    // 복구된 내용으로 다시 저장되어 다음에는 정상으로 열린다
    expect((await AppStore.open(file, '/p')).outcome).toBe('loaded');
  });

  it('잘못된 데이터로 update하면 예외가 나고 기존 데이터는 그대로', async () => {
    const s = await AppStore.open(path.join(tmp(), 'd.json'), '/p');
    await expect(
      s.update((d) => {
        (d.settings as { theme: string }).theme = 'neon';
      }),
    ).rejects.toThrow();
    expect(s.get().settings.theme).toBe('system');
  });
});
