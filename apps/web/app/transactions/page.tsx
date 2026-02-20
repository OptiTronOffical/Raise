"use client";
import { useEffect, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { api } from "../../lib/api";

export default function Transactions() {
  const [me,setMe] = useState<any>(null);
  const [balance,setBalance] = useState<any>(null);
  const [rows,setRows] = useState<any[]>([]);

  async function refresh() {
    const [m,b,t] = await Promise.all([api.me(), api.balance(), api.transactions()]);
    setMe(m); setBalance(b); setRows(t);
  }
  useEffect(()=>{ refresh().catch(()=>{}); }, []);

  return (
    <div className="page">
      <TopBar/>
      <BalancePill balanceTon={balance?.ton || "0"} />
      <ProfilePill username={me?.username || "user"} />
      <div className="h2">Transactions</div>

      <div className="card">
        {rows.length===0 && <div className="smallMuted">No transactions</div>}
        {rows.map(r => (
          <div key={r.id} style={{padding:"10px 0", borderBottom:"1px solid #eef2f6"}}>
            <div className="row">
              <div style={{fontWeight:900}}>{r.type}</div>
              <div style={{fontWeight:900}}>{r.amount_ton} TON</div>
            </div>
            <div className="smallMuted" style={{marginTop:4}}>{new Date(r.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <BottomNav/>
    </div>
  );
}
