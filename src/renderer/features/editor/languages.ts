const map: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  svg: 'xml',
  sql: 'sql',
  txt: 'plaintext',
  csv: 'plaintext',
};

export function languageFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return map[ext] ?? 'plaintext';
}

export function previewKind(path: string): 'markdown' | 'html' | null {
  const l = languageFor(path);
  return l === 'markdown' ? 'markdown' : l === 'html' ? 'html' : null;
}
