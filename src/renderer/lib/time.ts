import { ko } from '../i18n/ko';

/** "3일 전" 같은 상대 시각 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return ko.time.justNow;
  if (min < 60) return ko.time.minutesAgo(min);
  const h = Math.floor(min / 60);
  if (h < 24) return ko.time.hoursAgo(h);
  const d = Math.floor(h / 24);
  if (d < 7) return ko.time.daysAgo(d);
  if (d < 35) return ko.time.weeksAgo(Math.floor(d / 7));
  const date = new Date(t);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

export function dirName(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i > 0 ? p.slice(0, i) : p;
}

export function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

/** Windows는 대소문자를 무시하고 같은 경로인지 비교 */
export function samePathLoose(a: string, b: string): boolean {
  const n = (s: string): string => s.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
  return n(a) === n(b);
}

export function isInsideLoose(root: string, p: string): boolean {
  const n = (s: string): string => s.replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
  const r = n(root);
  const x = n(p);
  return x === r || x.startsWith(`${r}/`);
}
