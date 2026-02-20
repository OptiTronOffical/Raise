export function BalancePill({ balanceTon, onWithdraw }:{ balanceTon:string; onWithdraw?:()=>void }) {
  return (
    <div className="pill">
      <div className="pillLeft">
        <div className="squareIcon">💳</div>
        <div className="balanceText">{balanceTon} <span>TON</span></div>
      </div>
      <button className="roundIcon" onClick={onWithdraw} title="Withdraw">⬆️</button>
    </div>
  );
}
