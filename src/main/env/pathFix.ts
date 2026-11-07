import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PathFixResult } from '../../shared/types';
import { profileAlreadyHas, profileExportLine, shellProfileFor } from './pathTools';


// 공식 문서(troubleshoot-install "Fix your PATH")와 같은 방법으로 PATH에 폴더를 등록한다.
// - Windows: 사용자 PATH에 추가 ([Environment]::SetEnvironmentVariable(..., 'User')).
//   setx는 1024자에서 PATH를 잘라 버리는 문제가 있어 쓰지 않는다. 관리자 권한도 필요 없다.
//   폴더 경로는 명령 문자열에 끼워 넣지 않고 환경 변수로 넘겨, 경로에 특수문자가 있어도 안전하다.
// - macOS·Linux: 셸 설정 파일(~/.zshrc 등)에 export 한 줄을 덧붙인다(이미 있으면 그대로 둠).

const WIN_SCRIPT = [
  '$d = $env:PCW_ADD_DIR',
  "$p = [Environment]::GetEnvironmentVariable('Path', 'User')",
  "if ($null -eq $p) { $p = '' }",
  // @( ) 로 감싸야 항목이 하나뿐일 때도 배열로 다뤄진다(아니면 문자열끼리 붙어 버림).
  "$parts = @($p -split ';' | Where-Object { $_ -ne '' })",
  "if (@($parts | Where-Object { $_.TrimEnd('\\') -ieq $d.TrimEnd('\\') }).Count -gt 0) { 'ALREADY'; exit 0 }",
  "[Environment]::SetEnvironmentVariable('Path', ((@($parts) + $d) -join ';'), 'User')",
  "'ADDED'",
].join('; ');

export async function addDirToUserPath(dir: string, platform: NodeJS.Platform, home: string, shell: string | undefined): Promise<PathFixResult> {
  if (platform === 'win32') {
    const ps = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const out = await new Promise<string | null>((resolve) => {
      execFile(
        ps,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WIN_SCRIPT],
        { env: { ...process.env, PCW_ADD_DIR: dir }, timeout: 20000, windowsHide: true, encoding: 'utf8' },
        (err, stdout) => resolve(err ? null : String(stdout)),
      );
    });
    if (out === null) {
      return { ok: false, manual: `시작 메뉴에서 "환경 변수"를 검색해 [사용자 변수]의 Path에 ${dir} 를 추가해 주세요.` };
    }
    return { ok: true, where: '사용자 환경 변수(Path)', alreadyDone: out.includes('ALREADY') };
  }
  const profile = shellProfileFor(shell, platform, home);
  const line = profileExportLine(dir, home);
  if (!profile) return { ok: false, manual: `쓰고 있는 셸의 설정 파일에 다음 한 줄을 추가해 주세요 → ${line}` };
  const content = await fs.readFile(profile, 'utf8').catch(() => '');
  if (profileAlreadyHas(content, dir, home)) return { ok: true, where: profile, alreadyDone: true };
  const prefix = content.length && !content.endsWith('\n') ? '\n' : '';
  await fs.appendFile(profile, `${prefix}\n# 필로소피 Claude 작업실: Claude Code 실행 파일 위치\n${line}\n`, 'utf8');
  return { ok: true, where: profile };
}
