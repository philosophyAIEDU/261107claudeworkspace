import type {
  getSessionInfo,
  getSessionMessages,
  listSessions,
  renameSession,
  deleteSession,
  SDKSessionInfo,
  SessionMessage,
} from '@anthropic-ai/claude-agent-sdk';

// 공식 Claude Agent SDK에서 "세션 조회·이름 바꾸기·삭제" 함수만 가져다 쓴다.
// (AI를 부르는 query()는 쓰지 않는다. 이 앱은 사용자가 설치한 CLI를 감싸기만 한다.)
// SDK는 ESM 전용이라 필요할 때 동적으로 불러온다.

export type { SDKSessionInfo, SessionMessage };

export interface SessionSdk {
  listSessions: typeof listSessions;
  getSessionInfo: typeof getSessionInfo;
  getSessionMessages: typeof getSessionMessages;
  renameSession: typeof renameSession;
  deleteSession: typeof deleteSession;
}

let loading: Promise<SessionSdk> | null = null;

export function loadSessionSdk(): Promise<SessionSdk> {
  if (!loading) {
    loading = import('@anthropic-ai/claude-agent-sdk').then((m) => ({
      listSessions: m.listSessions,
      getSessionInfo: m.getSessionInfo,
      getSessionMessages: m.getSessionMessages,
      renameSession: m.renameSession,
      deleteSession: m.deleteSession,
    }));
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}
