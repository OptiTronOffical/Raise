export function getInitData(): string {
  // @ts-ignore
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  return tg?.initData || "";
}
export function ready() {
  // @ts-ignore
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  try { tg?.ready?.(); } catch {}
}
