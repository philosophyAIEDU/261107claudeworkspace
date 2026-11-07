/** 기본 대화 이름: "새 대화 (11월 7일 오후 3:59)" — 메인 프로세스의 commandBuilder와 같은 규칙 */
export function defaultSessionTitle(now: Date = new Date()): string {
  const h = now.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `새 대화 (${now.getMonth() + 1}월 ${now.getDate()}일 ${ampm} ${h12}:${mm})`;
}
