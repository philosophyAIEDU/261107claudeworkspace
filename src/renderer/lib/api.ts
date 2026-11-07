import type { ExposedApi } from '../../shared/ipc';

// preload가 노출한 타입 지정 API. 테스트에서는 window.api를 가짜로 바꿔 끼운다.
export function api(): ExposedApi {
  return window.api;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return '알 수 없는 문제가 생겼어요.';
}
