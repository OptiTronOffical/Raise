"use client";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "../components/TopBar";
import { BalancePill } from "../components/BalancePill";
import { ProfilePill } from "../components/ProfilePill";
import { BottomNav } from "../components/BottomNav";
import { JackpotReel } from "../components/JackpotReel";
import { api } from "../lib/api";
import { ready } from "../lib/telegram";

export default function Home() {
  const [me,setMe] = useState<any>(null);
  const [balance,setBalance] = useState<any>(null);
  const [state,setState] = useState<any>(null);
  const [amount,setAmount] = useState("0.03");
  const [busy,setBusy] = useState(false);

  const [spinning,setSpinning] = useState(false);
  const [winning,setWinning] = useState<number|null>(null);

  const bankPct = useMemo(() => {
    const b = parseFloat(state?.bank_ton || "0");
    const t = parseFloat(state?.target_bank_ton || "0.10");
    if (t <= 0) return 0;
    return Math.min(100, (b/t)*100);
  }, [state]);

  async function refresh() {
    const [m,b,s] = await Promise.all([api.me(), api.balance(), api.jackpotState()]);
    setMe(m); setBalance(b); setState(s);
  }

  useEffect(() => { ready(); refresh().catch(()=>{}); }, []);

  async function onBet() {
    setBusy(true);
    try{
      const res = await api.bet(amount);
      await refresh();
      if (res.resolved && res.winning_nft_index) {
        setWinning(res.winning_nft_index);
        setSpinning(true);
      }
    }catch(e:any){
      alert(e?.data?.reason || "Ошибка");
    }finally{
      setBusy(false);
    }
  }

  async function onDeposit() {
    const a = prompt("Deposit TON amount:", "1");
    if (!a) return;
    try{
      const res = await api.depositCreate(a);
      alert(`Send ${res.amount_ton} TON to: ${res.treasury_address}\nComment: ${res.comment}\n(Then confirm via admin)`);
      await refresh();
    }catch(e:any){
      alert(e?.data?.reason || "Ошибка");
    }
  }

  async function onWithdraw() {
    const a = prompt("Withdraw TON amount:", "1");
    if (!a) return;
    try{
      const res = await api.withdrawRequest(a);
      alert(`Withdraw requested. id=${res.withdrawal_id}. Wait admin confirmation.`);
      await refresh();
    }catch(e:any){
      if (e?.data?.reason === "subscribe_required") {
        alert("Нужно подписаться: " + (e.data.missing || []).join(", "));
      } else {
        alert(e?.data?.reason || "Ошибка");
      }
    }
  }

  return (
    <div className="page">
      <TopBar/>
      <BalancePill balanceTon={balance?.ton || "0"} onWithdraw={onWithdraw}/>
      <ProfilePill username={me?.username || "user"}/>
      <div className="h2">Jackpot</div>

      <JackpotReel
        winningIndex={winning}
        spinning={spinning}
        onDone={() => { setSpinning(false); alert(`Winning NFT #${winning}`); }}
      />

      <div className="card mt12">
        <div className="row">
          <div style={{fontWeight:900}}>Round #{state?.round_id || "—"}</div>
          <div className="smallMuted">{state?.bank_ton || "0"} / {state?.target_bank_ton || "0.10"} TON</div>
        </div>
        <div style={{height:10, background:"#f1f3f7", borderRadius:99, overflow:"hidden", marginTop:10, border:"1px solid #e7ebf0"}}>
          <div style={{height:"100%", width:`${bankPct}%`, background:"#2f7cf6"}} />
        </div>

        <div className="mt16 row">
          <div className="smallMuted">Your bet (TON)</div>
          <input value={amount} onChange={e=>setAmount(e.target.value)}
            style={{width:140, height:40, borderRadius:12, border:"1px solid #e7ebf0", padding:"0 10px", fontWeight:900}}
          />
        </div>

        <div className="mt12">
          <button className="btnPrimary" disabled={busy || spinning} onClick={onBet}>
            {spinning ? "Rolling..." : "Place a bet"}
          </button>
        </div>
        <div className="mt12">
          <button className="btnBlue" onClick={onDeposit}>Deposit</button>
        </div>
      </div>

      <BottomNav/>
    </div>
  );
}
