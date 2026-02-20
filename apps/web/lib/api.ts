import { getInitData } from "./telegram";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
async function req(path: string, opts: RequestInit = {}) {
  const initData = typeof window !== "undefined" ? getInitData() : "";
  const headers: any = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (initData) headers["x-init-data"] = initData;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error("API error"), { status: res.status, data });
  return data;
}
export const api = {
  me: () => req("/me"),
  balance: () => req("/balance"),
  jackpotState: () => req("/jackpot/state"),
  bet: (amount_ton: string) => req("/jackpot/bet", { method: "POST", body: JSON.stringify({ amount_ton }) }),
  transactions: () => req("/transactions"),
  requirements: () => req("/requirements"),
  depositCreate: (amount_ton: string) => req("/deposits/create", { method: "POST", body: JSON.stringify({ amount_ton }) }),
  withdrawRequest: (amount_ton: string) => req("/withdraw/request", { method: "POST", body: JSON.stringify({ amount_ton }) }),
  dailyStatus: () => req("/bonuses/status"),
  dailyClaim: () => req("/bonuses/daily/claim", { method:"POST", body:"{}" }),
  cashbackClaim: () => req("/bonuses/cashback/claim", { method:"POST", body:"{}" }),
  referralClaim: () => req("/bonuses/referral/claim", { method:"POST", body:"{}" }),
  promoActivate: (code: string) => req("/promo/activate", { method:"POST", body: JSON.stringify({ code }) }),
  refStats: () => req("/referrals/stats"),
  leaderboard: () => req("/leaderboard/top"),
  prizes: () => req("/tournament/prizes"),
};
