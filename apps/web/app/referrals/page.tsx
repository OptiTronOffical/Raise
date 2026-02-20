"use client";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { api } from "../../lib/api";

export default function Referrals() {
  const [me,setMe] = useState<any>(null);
  const [balance,setBalance] = useState<any>(null);
  const [stats,setStats] = useState<any>(null);

  async function refresh() {
    const [m,b,s] = await Promise.all([api.me(), api.balance(), api.refStats()]);
    setMe(m); setBalance(b); setStats(s);
  }
  useEffect(()=>{ refresh().catch(()=>{}); }, []);

  const refLink = useMemo(() => {
    if (!me?.tg_id) return "";
    const base = "https://t.me/YOUR_BOT?start=";
    return base + me.tg_id;
  }, [me]);

  return (
    <div className="page">
      <TopBar/>
      <BalancePill balanceTon={balance?.ton || "0"} />
      <ProfilePill username={me?.username || "user"} />
      <div className="h2">Referrals</div>

      <div className="card">
        <div className="smallMuted">Invite and earn 0.25% from friend's bet</div>
        <div className="mt12" style={{fontWeight:900, wordBreak:"break-all"}}>{refLink || "—"}</div>
        <button className="btnBlue mt12" onClick={()=>{ navigator.clipboard?.writeText(refLink); alert("Copied"); }}>Copy link</button>
      </div>

      <div className="card mt12">
        <div className="row"><div style={{fontWeight:900}}>Invited</div><div>{stats?.invited ?? "—"}</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Active</div><div>{stats?.active ?? "—"}</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Friends stake</div><div>{stats?.friends_stake_ton ?? "—"} TON</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Earned</div><div>{stats?.earned_ton ?? "—"} TON</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Available</div><div>{stats?.available_ton ?? "—"} TON</div></div>
      </div>

      <BottomNav/>
    </div>
  );
}
