"use client";
import { haptic } from "../lib/telegram";

interface BalancePillProps {
  balanceTon: string;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  showActions?: boolean;
}

export function BalancePill({ 
  balanceTon, 
  onDeposit, 
  onWithdraw, 
  showActions = true 
}: BalancePillProps) {
  
  const handleDeposit = () => {
    haptic.impact('light');
    onDeposit?.();
  };

  const handleWithdraw = () => {
    haptic.impact('light');
    onWithdraw?.();
  };

  return (
    <div className="balancePill">
      <div className="balanceLeft">
        <div className="balanceIcon" aria-hidden="true"></div>
        <div className="balanceInfo">
          <span className="balanceLabel">Balance</span>
          <span className="balanceValue">
            {balanceTon} <span className="balanceCurrency">TON</span>
          </span>
        </div>
      </div>

      {showActions && (onDeposit || onWithdraw) && (
        <div className="balanceActions">
          {onDeposit && (
            <button 
              className="actionButton deposit" 
              onClick={handleDeposit}
              aria-label="Deposit funds"
              title="Deposit"
            >
              <span aria-hidden="true"></span>
            </button>
          )}
          {onWithdraw && (
            <button 
              className="actionButton withdraw" 
              onClick={handleWithdraw}
              aria-label="Withdraw funds"
              title="Withdraw"
            >
              <span aria-hidden="true"></span>
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .balancePill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          border-radius: 100px;
          padding: 6px 8px 6px 6px;
          margin: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .balanceLeft {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .balanceIcon {
          width: 40px;
          height: 40px;
          background: #f1f5f9;
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .balanceInfo {
          display: flex;
          flex-direction: column;
        }

        .balanceLabel {
          font-size: 11px;
          color: #64748b;
          line-height: 1.2;
        }

        .balanceValue {
          font-weight: 700;
          font-size: 16px;
          color: #0f172a;
          line-height: 1.3;
        }

        .balanceCurrency {
          font-weight: 500;
          color: #64748b;
          font-size: 14px;
        }

        .balanceActions {
          display: flex;
          gap: 4px;
        }

        .actionButton {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 30px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .actionButton.deposit {
          background: #3b82f6;
          color: white;
        }

        .actionButton.deposit:hover {
          background: #2563eb;
          transform: scale(1.05);
        }

        .actionButton.withdraw {
          background: #f1f5f9;
          color: #1e293b;
        }

        .actionButton.withdraw:hover {
          background: #e2e8f0;
          transform: scale(1.05);
        }

        .actionButton:active {
          transform: scale(0.95);
        }

        @media (max-width: 640px) {
          .balancePill {
            margin: 12px;
          }
          
          .balanceIcon {
            width: 36px;
            height: 36px;
            font-size: 18px;
          }
          
          .balanceValue {
            font-size: 15px;
          }
          
          .actionButton {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}