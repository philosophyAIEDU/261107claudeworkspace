import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 메인 프로세스 테스트는 node 환경, 화면(렌더러) 테스트는 파일 맨 위의
// `// @vitest-environment jsdom` 주석으로 jsdom 환경을 고른다.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
