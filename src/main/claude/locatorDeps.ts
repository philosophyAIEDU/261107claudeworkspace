import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import type { LocatorDeps, RunResult } from './claudeLocator';

interface EnvSource {
  platform: NodeJS.Platform;
  homeDir: string;
  getEnv: () => Promise<Record<string, string>>;
}

/** 실제 컴퓨터에서 claude를 찾을 때 쓰는 도구들 */
export async function makeLocatorDeps(src: EnvSource): Promise<LocatorDeps> {
  const env = await src.getEnv();
  return {
    platform: src.platform,
    env,
    homeDir: src.homeDir,
    exists: (p) =>
      fs.stat(p).then(
        (s) => s.isFile(),
        () => false,
      ),
    run: (file, args, timeoutMs) =>
      new Promise<RunResult>((resolve, reject) => {
        const verbatim = typeof args === 'string';
        execFile(
          file,
          verbatim ? [args] : args,
          { timeout: timeoutMs, env, windowsHide: true, windowsVerbatimArguments: verbatim, encoding: 'utf8' },
          (err, stdout, stderr) => {
            if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return reject(err);
            const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
            resolve({ code, stdout: String(stdout), stderr: String(stderr) });
          },
        );
      }),
  };
}
