"use client";
import { useEffect, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { api } from "../../lib/api";

export default function Bonuses() {
  const [me,setMe] = useState<any>(null);
  const [balance,setBalance] = useState<any>(null);
  const [daily,setDaily] = useState<any>(null);
  const [code,setCode] = useState("");

  async function refresh() {
    const [m,b,d] = await Promise.all([api.me(), api.balance(), api.dailyStatus()]);
    setMe(m); setBalance(b); setDaily(d);
  }
  useEffect(()=>{ refresh().catch(()=>{}); }, []);

  async function claimDaily(){
    try{
      const r = await api.dailyClaim();
      alert(`Daily bonus: +${r.amount_ton} TON`);
      refresh();
    }catch(e:any){ alert(e?.data?.reason || "Ошибка"); }
  }
  async function claimCashback(){
    try{
      const r = await api.cashbackClaim();
      alert(`Cashback claimed: +${r.amount_ton} TON`);
      refresh();
    }catch(e:any){ alert(e?.data?.reason || "Ошибка"); }
  }
  async function claimReferral(){
    try{
      const r = await api.referralClaim();
      alert(`Referral claimed: +${r.amount_ton} TON`);
      refresh();
    }catch(e:any){ alert(e?.data?.reason || "Ошибка"); }
  }
  async function promo(){
    try{
      const r = await api.promoActivate(code);
      alert(`Promo: +${r.amount_ton} TON`);
      setCode("");
      refresh();
    }catch(e:any){ alert(e?.data?.reason || "Ошибка"); }
  }

  return (
    <div className="page">
      <TopBar/>
      <BalancePill balanceTon={balance?.ton || "0"} />
      <ProfilePill username={me?.username || "user"} />
      <div className="h2">Bonuses</div>

      <div className="card">
        <div className="row"><div style={{fontWeight:900}}>Daily bonus</div><div className="smallMuted">{daily?.claimed ? "Claimed" : "Available"}</div></div>
        <div className="mt12">
          <button className="btnPrimary" disabled={daily?.claimed} onClick={claimDaily}>Claim daily bonus</button>
        </div>
      </div>

      <div className="card mt12">
        <div style={{fontWeight:900}}>Cashback</div>
        <div className="smallMuted mt12">Available: {balance?.cashback_available_ton || "0"} TON</div>
        <div className="mt12"><button className="btnPrimary" onClick={claimCashback}>Claim cashback</button></div>
      </div>

      <div className="card mt12">
        <div style={{fontWeight:900}}>Referrals</div>
        <div className="smallMuted mt12">Available: {balance?.referral_available_ton || "0"} TON</div>
        <div className="mt12"><button className="btnPrimary" onClick={claimReferral}>Claim referral</button></div>
      </div>

      <div className="card mt12">
        <div style={{fontWeight:900}}>Promo code</div>
        <div className="mt12 row">
          <input value={code} onChange={e=>setCode(e.target.value)} placeholder="CODE"
            style={{flex:1, height:48, borderRadius:14, border:"1px solid #e7ebf0", padding:"0 12px", fontWeight:900}} />
          <button onClick={promo} style={{height:48, borderRadius:14, padding:"0 16px", border:0, background:"#111", color:"#fff", fontWeight:900}}>Apply</button>
        </div>
      </div>

      <div className="card mt12">
        <div style={{fontWeight:900}}>Offerwall</div>
        <div className="smallMuted mt12">Placeholder (plug your offerwall provider)</div>
        <button className="btnGhost mt12" onClick={()=>alert("Offerwall: TODO")}>Open offerwall</button>
      </div>

      <BottomNav/>
    </div>
  );
}
