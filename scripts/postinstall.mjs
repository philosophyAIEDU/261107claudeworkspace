// npm install 뒤에 자동으로 실행된다.
// node-pty(가상 터미널)는 네이티브 모듈이다. node-pty 1.x는 Node-API를 쓰므로
// Windows·macOS용 미리 만든 파일(prebuilds)을 Electron에서 그대로 쓸 수 있다.
// → 그 파일이 있으면 아무것도 하지 않고, 없을 때만(Linux 등) Electron용으로 다시 빌드한다.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let ptyDir;
try {
  ptyDir = path.dirname(require.resolve('node-pty/package.json'));
} catch {
  console.log('[postinstall] node-pty가 아직 설치되지 않았어요. 건너뜁니다.');
  process.exit(0);
}

const prebuild = path.join(ptyDir, 'prebuilds', `${process.platform}-${process.arch}`, 'pty.node');
const built = path.join(ptyDir, 'build', 'Release', 'pty.node');
if (existsSync(prebuild) || existsSync(built)) {
  console.log(`[postinstall] node-pty 준비됨 (${existsSync(prebuild) ? '미리 만든 파일 사용' : '이미 빌드됨'}).`);
  process.exit(0);
}

const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;

console.log('[postinstall] node-pty를 Electron용으로 빌드합니다…');
if (run('npx', ['electron-rebuild', '-f', '-w', 'node-pty'], process.cwd())) process.exit(0);
// Node-API 모듈이라 Node용으로 빌드해도 Electron에서 동작한다(Electron 헤더를 못 받는 환경 대비).
if (run('npx', ['node-gyp', 'rebuild'], ptyDir)) process.exit(0);

console.warn('[postinstall] ⚠️ node-pty를 빌드하지 못했어요. 앱의 터미널 기능이 동작하지 않을 수 있어요.');
console.warn('  Windows: "Visual Studio Build Tools"의 C++ 도구를, macOS: "xcode-select --install"을 설치한 뒤 npm install을 다시 해 보세요.');
process.exit(0);
