import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// 화면 테스트끼리 서로 영향을 주지 않도록 매번 그린 것을 지운다.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
