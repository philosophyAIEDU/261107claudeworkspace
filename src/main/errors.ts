// 사용자에게 그대로 보여 줘도 되는 오류. 메시지는 항상 쉬운 한국어로 쓴다.
export class UserError extends Error {
  readonly code: string;
  constructor(message: string, code = 'USER_ERROR') {
    super(message);
    this.name = 'UserError';
    this.code = code;
  }
}

export function toUserMessage(err: unknown): { error: string; code?: string } {
  if (err instanceof UserError) return { error: err.message, code: err.code };
  return { error: '알 수 없는 문제가 생겼어요. 잠시 후 다시 해 보세요.', code: 'UNKNOWN' };
}
