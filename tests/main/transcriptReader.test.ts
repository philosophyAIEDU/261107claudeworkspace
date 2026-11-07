import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanUserText,
  historyPlainText,
  historyToMarkdown,
  normalizeMessages,
  parseTranscriptLine,
  parseTranscriptText,
  readTranscriptDirect,
  summarizeToolUse,
} from '../../src/main/claude/transcriptReader';

describe('normalizeMessages', () => {
  it('사용자 / Claude / 도구 사용 요약을 구분한다', () => {
    const r = normalizeMessages([
      { type: 'user', uuid: 'u1', message: { role: 'user', content: '퀴즈 화면 만들어 줘' } },
      {
        type: 'assistant',
        uuid: 'a1',
        message: {
          content: [
            { type: 'thinking', thinking: '...' },
            { type: 'text', text: '네, 만들게요.' },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/w/index.html' } },
          ],
        },
      },
      { type: 'user', uuid: 'u2', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } },
      { type: 'assistant', uuid: 'a2', message: { content: [{ type: 'text', text: '다 됐어요.' }] } },
    ]);
    expect(r.items.map((i) => i.kind)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(r.items[2]).toMatchObject({ kind: 'tool', summary: '파일을 수정했어요: index.html' });
    expect(r.compacted).toBe(false);
  });

  it('모르는 형식·이상한 값이 있어도 예외 없이 건너뛴다', () => {
    const weird = [
      null,
      42,
      'text',
      { type: 'unknown-kind', message: {} },
      { type: 'user' },
      { type: 'user', message: { content: 123 } },
      { type: 'assistant', message: { content: [null, 5, { type: 'tool_use' }, { type: 'image' }] } },
      { type: 'assistant', message: { content: '문자열 답변' } },
    ] as unknown as Parameters<typeof normalizeMessages>[0];
    expect(() => normalizeMessages(weird)).not.toThrow();
    const r = normalizeMessages(weird);
    expect(r.items).toEqual([{ kind: 'assistant', id: expect.any(String), text: '문자열 답변' }]);
  });

  it('자동 압축(compaction) 흔적을 찾아 표시한다', () => {
    const r = normalizeMessages([
      { type: 'system', message: { subtype: 'compact_boundary' } },
      { type: 'user', message: { content: 'This session is being continued from a previous conversation that ran out of context. 요약...' } },
      { type: 'user', message: { content: '이어서 해 줘' } },
    ]);
    expect(r.compacted).toBe(true);
    expect(r.items.filter((i) => i.kind === 'user')).toHaveLength(1);
  });

  it('명령과 시스템 안내 태그를 정리한다', () => {
    expect(cleanUserText('<command-name>/clear</command-name><command-args></command-args>')).toBe('명령: /clear');
    expect(cleanUserText('안녕<system-reminder>숨김</system-reminder>')).toBe('안녕');
  });
});

describe('parseTranscriptLine / parseTranscriptText', () => {
  it('깨진 줄·모르는 줄은 null', () => {
    expect(parseTranscriptLine('{not json')).toBeNull();
    expect(parseTranscriptLine('')).toBeNull();
    expect(parseTranscriptLine('"just a string"')).toBeNull();
    expect(parseTranscriptLine('{"type":"summary","summary":"x"}')).toBeNull();
    expect(parseTranscriptLine('{"type":"user"}')).toBeNull();
    expect(parseTranscriptLine('{"type":"user","isSidechain":true,"message":{"content":"x"}}')).toBeNull();
  });

  it('여러 줄 중 읽을 수 있는 줄만 남긴다', () => {
    const text = [
      '{"type":"user","uuid":"1","message":{"role":"user","content":"안녕"}}',
      'garbage!!',
      '{"type":"file-history-snapshot"}',
      '{"type":"assistant","uuid":"2","message":{"content":[{"type":"text","text":"안녕하세요"}]}}',
      '{"type":"system","subtype":"compact_boundary"}',
      '',
    ].join('\n');
    const msgs = parseTranscriptText(text);
    expect(msgs).toHaveLength(3);
    const r = normalizeMessages(msgs);
    expect(r.compacted).toBe(true);
    expect(historyPlainText(r)).toContain('안녕하세요');
  });

  it('직접 읽기: 폴더 이름을 풀지 않고 세션 파일을 찾아 읽는다', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pcw-proj-'));
    const sub = path.join(dir, '-Users-hong-----');
    mkdirSync(sub);
    const id = '3f1c2a9e-8b7d-4c6e-9f0a-1b2c3d4e5f60';
    writeFileSync(path.join(sub, `${id}.jsonl`), '{"type":"user","message":{"content":"한글 경로 대화"}}\n{broken\n');
    const r = await readTranscriptDirect(dir, id);
    expect(r.found).toBe(true);
    expect(r.items[0]).toMatchObject({ kind: 'user', text: '한글 경로 대화' });
    expect((await readTranscriptDirect(dir, '00000000-0000-0000-0000-000000000000')).found).toBe(false);
    expect((await readTranscriptDirect(dir, '../../etc/passwd')).found).toBe(false);
  });
});

describe('summarizeToolUse / historyToMarkdown', () => {
  it('도구 이름별 한국어 요약', () => {
    expect(summarizeToolUse('Write', { file_path: 'C:\\w\\a.md' })).toContain('a.md');
    expect(summarizeToolUse('Bash', { command: 'npm test\nmore' })).toBe('명령을 실행했어요: npm test');
    expect(summarizeToolUse('Mystery', {})).toBe('도구를 사용했어요: Mystery');
  });
  it('Markdown 내보내기', () => {
    const md = historyToMarkdown('제목', '/w', { found: true, compacted: true, items: [{ kind: 'user', id: '1', text: '질문' }, { kind: 'compacted', id: '2' }] });
    expect(md).toContain('# 제목');
    expect(md).toContain('질문');
    expect(md).toContain('요약되어');
  });
});
