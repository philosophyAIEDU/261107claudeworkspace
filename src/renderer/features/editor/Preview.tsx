import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import { ko } from '../../i18n/ko';

// raw HTML을 꺼 둔 마크다운 변환기 (문서 안의 <script> 같은 태그는 글자로만 보인다)
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const baseStyle = `<style>
body{font-family:"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;font-size:16px;line-height:1.7;padding:16px 24px;color:#1d1f24;background:#fff;max-width:860px;margin:0 auto}
pre,code{font-family:Consolas,Menlo,monospace;background:#f2f2ee;border-radius:4px}
pre{padding:10px;overflow:auto} code{padding:1px 4px}
table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:4px 8px}
img{max-width:100%} blockquote{border-left:4px solid #ccc;margin:0;padding-left:12px;color:#555}
</style>`;

/**
 * 마크다운·HTML 미리보기. 둘 다 sandbox iframe 안에서만 그린다.
 * sandbox에 아무 권한도 주지 않으므로 스크립트 실행·창 열기·폼 전송이 모두 막혀 있다.
 * (앱 화면에 HTML을 직접 끼워 넣지 않는다 — dangerouslySetInnerHTML 사용 안 함)
 */
export function Preview({ kind, content }: { kind: 'markdown' | 'html'; content: string }): React.JSX.Element {
  const srcDoc = useMemo(() => {
    if (kind === 'markdown') return `<!doctype html><html lang="ko"><head><meta charset="utf-8">${baseStyle}</head><body>${md.render(content)}</body></html>`;
    return content;
  }, [kind, content]);
  return (
    <div className="flex h-full flex-col">
      <p className="border-b border-line bg-panel-2 px-3 py-1 text-sm text-muted">{ko.editor.previewNote}</p>
      <iframe title="미리보기" sandbox="" srcDoc={srcDoc} className="w-full flex-1 bg-white" />
    </div>
  );
}
