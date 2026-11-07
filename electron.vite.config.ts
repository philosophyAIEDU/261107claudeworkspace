import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

// 콘텐츠 보안 정책(CSP). 원격 스크립트·페이지를 불러오지 못하게 막는다.
// 개발 모드는 Vite의 빠른 새로 고침(HMR) 때문에 조금 느슨하고, 빌드본은 엄격하다.
function cspPlugin(): Plugin {
  const strict = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "frame-src 'self' blob: data: about:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const dev = strict
    .replace("script-src 'self'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    .replace("connect-src 'self'", "connect-src 'self' ws://localhost:* http://localhost:*");
  let isDev = false;
  return {
    name: 'pcw-csp',
    configResolved(c) {
      isDev = c.command === 'serve';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replaceAll('__APP_CSP__', isDev ? dev : strict);
      },
    },
  };
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss(), cspPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
