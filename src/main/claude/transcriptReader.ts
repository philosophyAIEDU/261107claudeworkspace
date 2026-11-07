import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { HistoryItem, HistoryResult } from '../../shared/types';

// 대화 기록 읽기.
// Claude Code 기록 파일(.jsonl)의 안쪽 구조는 공식으로 약속된 형식이 아니라 언제든 바뀔 수 있다.
// 그래서 (1) 공식 SDK의 getSessionMessages()를 먼저 쓰고,
// (2) 기록 파일을 직접 읽어야 하는 코드는 이 파일 하나에만 모아 둔다.
// 모르는 모양의 줄·깨진 줄은 조용히 건너뛰어, 형식이 바뀌어도 앱이 죽지 않게 한다.

/** SDK SessionMessage와 같은 모양(필요한 부분만) */
export interface MessageLike {
  type: string;
  uuid?: string;
  message?: unknown;
  /** 직접 읽기에서만 채워짐: 시스템 줄의 종류(compact_boundary 등) */
  subtype?: string;
  isCompactSummary?: boolean;
}

const COMPACT_SUMMARY_PREFIX = 'This session is being continued from a previous conversation';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** 사용자 메시지에 섞여 들어오는 시스템 안내 태그를 걷어 낸다. */
export function cleanUserText(raw: string): string {
  let t = raw.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  const cmd = t.match(/<command-name>([\s\S]*?)<\/command-name>/);
  if (cmd) {
    const args = t.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1]?.trim();
    return `명령: ${cmd[1]!.trim()}${args ? ` ${args}` : ''}`;
  }
  t = t.replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '');
  t = t.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '');
  return t.trim();
}

function fileName(p: unknown): string {
  const s = str(p);
  return s ? path.basename(s.replace(/\\/g, '/')) : '';
}

/** 도구 사용을 쉬운 한국어 한 줄로 바꾼다. */
export function summarizeToolUse(name: string, input: unknown): string {
  const inp = isRecord(input) ? input : {};
  const file = fileName(inp.file_path ?? inp.notebook_path ?? inp.path);
  switch (name) {
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return file ? `파일을 수정했어요: ${file}` : '파일을 수정했어요';
    case 'Write':
      return file ? `파일을 만들었어요(또는 새로 썼어요): ${file}` : '파일을 썼어요';
    case 'Read':
      return file ? `파일을 읽었어요: ${file}` : '파일을 읽었어요';
    case 'Bash':
    case 'PowerShell': {
      const command = str(inp.command)?.split('\n')[0]?.slice(0, 80);
      return command ? `명령을 실행했어요: ${command}` : '명령을 실행했어요';
    }
    case 'Glob':
    case 'Grep':
      return '파일을 찾아봤어요';
    case 'WebFetch':
    case 'WebSearch':
      return '인터넷에서 찾아봤어요';
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return '할 일 목록을 정리했어요';
    case 'Task':
    case 'Agent':
      return '도우미(하위 에이전트)에게 일을 맡겼어요';
    default:
      return `도구를 사용했어요: ${name}`;
  }
}

/** SDK 메시지(또는 직접 읽은 줄)를 화면용 말풍선 목록으로 바꾼다. 예외를 던지지 않는다. */
export function normalizeMessages(messages: readonly MessageLike[]): HistoryResult {
  const items: HistoryItem[] = [];
  let compacted = false;
  let n = 0;
  const nextId = (base?: string): string => `${base ?? 'm'}-${n++}`;

  for (const m of messages) {
    try {
      if (!isRecord(m)) continue;
      if (m.type === 'system') {
        const payload = isRecord(m.message) ? m.message : {};
        const subtype = m.subtype ?? str(payload.subtype);
        if (subtype === 'compact_boundary') {
          compacted = true;
          items.push({ kind: 'compacted', id: nextId(m.uuid) });
        }
        continue;
      }
      if (m.type !== 'user' && m.type !== 'assistant') continue;
      const msg = isRecord(m.message) ? m.message : null;
      if (!msg) continue;
      const content = msg.content;

      if (m.type === 'user') {
        const texts: string[] = [];
        if (typeof content === 'string') texts.push(content);
        else if (Array.isArray(content)) {
          for (const block of content) {
            if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') texts.push(block.text);
            // tool_result(도구 실행 결과)는 사람이 쓴 말이 아니므로 보여 주지 않는다.
          }
        }
        const joined = texts.join('\n').trim();
        if (!joined) continue;
        if (m.isCompactSummary || joined.startsWith(COMPACT_SUMMARY_PREFIX)) {
          compacted = true;
          items.push({ kind: 'compacted', id: nextId(m.uuid), text: joined });
          continue;
        }
        const cleaned = cleanUserText(joined);
        if (cleaned) items.push({ kind: 'user', id: nextId(m.uuid), text: cleaned });
        continue;
      }

      // assistant
      if (typeof content === 'string') {
        if (content.trim()) items.push({ kind: 'assistant', id: nextId(m.uuid), text: content.trim() });
        continue;
      }
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!isRecord(block)) continue;
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
          // 한 답변이 여러 조각으로 나뉘어 저장되므로 바로 앞 Claude 말풍선에 이어 붙인다.
          const last = items[items.length - 1];
          if (last && last.kind === 'assistant') last.text = `${last.text}\n\n${block.text.trim()}`;
          else items.push({ kind: 'assistant', id: nextId(m.uuid), text: block.text.trim() });
        } else if (block.type === 'tool_use' && typeof block.name === 'string') {
          items.push({ kind: 'tool', id: nextId(m.uuid), summary: summarizeToolUse(block.name, block.input) });
        }
        // thinking 등 다른 조각은 보여 주지 않는다.
      }
    } catch {
      // 모르는 형식 → 건너뜀
    }
  }
  return { items, compacted, found: messages.length > 0 };
}

/** JSONL 한 줄을 해석한다. 깨졌거나 모르는 줄이면 null. */
export function parseTranscriptLine(line: string): MessageLike | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(obj) || typeof obj.type !== 'string') return null;
  if (obj.isSidechain === true) return null; // 하위 에이전트 대화는 본 대화가 아님
  if (obj.type === 'user' || obj.type === 'assistant') {
    if (!isRecord(obj.message)) return null;
    return {
      type: obj.type,
      uuid: str(obj.uuid),
      message: obj.message,
      isCompactSummary: obj.isCompactSummary === true,
    };
  }
  if (obj.type === 'system') return { type: 'system', uuid: str(obj.uuid), subtype: str(obj.subtype), message: {} };
  return null;
}

export function parseTranscriptText(text: string): MessageLike[] {
  const out: MessageLike[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseTranscriptLine(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * SDK를 쓸 수 없을 때만 쓰는 비상용 직접 읽기.
 * 폴더 이름을 풀지 않고, 기록 폴더들을 훑어 `<세션ID>.jsonl` 파일을 찾는다. (읽기 전용)
 */
export async function readTranscriptDirect(projectsDir: string, sessionId: string): Promise<HistoryResult> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { items: [], compacted: false, found: false };
  const dirs = await fs.readdir(projectsDir, { withFileTypes: true }).catch(() => []);
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const file = path.join(projectsDir, d.name, `${sessionId}.jsonl`);
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    if (text === null) continue;
    return { ...normalizeMessages(parseTranscriptText(text)), found: true };
  }
  return { items: [], compacted: false, found: false };
}

/** 검색용: 말풍선 목록에서 글자만 뽑는다. */
export function historyPlainText(result: HistoryResult): string {
  return result.items
    .map((i) => (i.kind === 'tool' ? i.summary : i.kind === 'compacted' ? '' : i.text))
    .filter(Boolean)
    .join('\n');
}

/** 대화 기록을 Markdown 문서로 만든다(수업 자료·보고용 내보내기). */
export function historyToMarkdown(title: string, folder: string, result: HistoryResult): string {
  const lines: string[] = [`# ${title}`, '', `- 작업 폴더: \`${folder}\``, `- 내보낸 날짜: ${new Date().toLocaleString('ko-KR')}`, ''];
  for (const item of result.items) {
    if (item.kind === 'user') lines.push('## 🙋 나', '', item.text, '');
    else if (item.kind === 'assistant') lines.push('## 🤖 Claude', '', item.text, '');
    else if (item.kind === 'tool') lines.push(`> 🔧 ${item.summary}`, '');
    else lines.push('> 📦 앞부분은 요약되어 있어요.', '');
  }
  return lines.join('\n');
}
