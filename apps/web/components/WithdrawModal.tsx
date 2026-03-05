"use client";
import { useState } from "react";
import { api } from "../lib/api";
import { haptic } from "../lib/telegram";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balance: string;
}

export function WithdrawModal({ isOpen, onClose, onSuccess, balance }: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawInfo, setWithdrawInfo] = useState<any>(null);

  if (!isOpen) return null;

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setError("Amount must be greater than 0");
      return false;
    }
    if (num > parseFloat(balance)) {
      setError("Insufficient balance");
      return false;
    }
    const minWithdraw = 1; // Minimum 1 TON
    if (num < minWithdraw) {
      setError(`Minimum withdrawal is ${minWithdraw} TON`);
      return false;
    }
    return true;
  };

  const handleWithdraw = async () => {
    if (!validateAmount(amount)) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.withdrawRequest(amount);
      setWithdrawInfo(res);
      haptic.notification('success');
    } catch (err: any) {
      const reason = err?.data?.reason || err?.message || "Failed to create withdrawal";
      setError(reason);
      haptic.notification('error');
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(balance);
  };

  const handleClose = () => {
    setAmount("");
    setAddress("");
    setError(null);
    setWithdrawInfo(null);
    onClose();
  };

  return (
    <div className="modalOverlay" onClick={handleClose}>
      <div className="modalContent" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>Withdraw TON</h3>
          <button className="closeButton" onClick={handleClose}>×</button>
        </div>

        {!withdrawInfo ? (
          <>
            <div className="modalBody">
              <div className="balanceInfo">
                Available balance: <strong>{balance} TON</strong>
              </div>

              <div className="inputGroup">
                <label>Amount (TON)</label>
                <div className="amountInputWrapper">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="1.0"
                    min="1"
                    step="0.1"
                    disabled={loading}
                  />
                  <button 
                    className="maxButton" 
                    onClick={handleMaxClick}
                    disabled={loading}
                  >
                    MAX
                  </button>
                </div>
              </div>

              {error && <div className="error">{error}</div>}

              <div className="infoBox">
                <div className="infoIcon">ℹ️</div>
                <div className="infoText">
                  Withdrawals are processed manually by admins and may take up to 24 hours.
                </div>
              </div>
            </div>

            <div className="modalFooter">
              <button className="cancelButton" onClick={handleClose}>Cancel</button>
              <button 
                className="withdrawButton" 
                onClick={handleWithdraw}
                disabled={loading || !amount || parseFloat(amount) <= 0}
              >
                {loading ? 'Processing...' : 'Request Withdrawal'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modalBody">
              <div className="successIcon">✅</div>
              <p className="instruction">
                Withdrawal request <strong>#{withdrawInfo.withdrawal_id}</strong> created successfully!
              </p>
              
              <div className="detailsBox">
                <div className="detailRow">
                  <span className="detailLabel">Amount:</span>
                  <span className="detailValue">{withdrawInfo.amount_ton} TON</span>
                </div>
                <div className="detailRow">
                  <span className="detailLabel">Status:</span>
                  <span className="detailValue status">Pending</span>
                </div>
              </div>

              <div className="warning">
                ⏳ Your withdrawal will be processed within 24 hours.
                You'll receive a notification when it's completed.
              </div>
            </div>

            <div className="modalFooter">
              <button className="doneButton" onClick={() => {
                handleClose();
                onSuccess();
              }}>Done</button>
            </div>
          </>
        )}

        <style jsx>{`
          .modalContent {
            background: white;
            border-radius: 24px;
            width: 90%;
            max-width: 400px;
            max-height: 90vh;
            overflow-y: auto;
          }

          .modalHeader {
            padding: 20px;
            border-bottom: 1px solid #eef2f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .modalHeader h3 {
            margin: 0;
            font-size: 18px;
            color: #0f172a;
          }

          .closeButton {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #64748b;
            padding: 0 4px;
          }

          .modalBody {
            padding: 20px;
          }

          .modalFooter {
            padding: 20px;
            border-top: 1px solid #eef2f6;
            display: flex;
            gap: 12px;
          }

          .balanceInfo {
            background: #f8fafc;
            padding: 12px;
            border-radius: 12px;
            margin-bottom: 20px;
            text-align: center;
            color: #475569;
          }

          .inputGroup {
            margin-bottom: 16px;
          }

          .inputGroup label {
            display: block;
            margin-bottom: 8px;
            color: #475569;
            font-weight: 500;
          }

          .amountInputWrapper {
            display: flex;
            gap: 8px;
          }

          .amountInputWrapper input {
            flex: 1;
            height: 48px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 0 16px;
            font-size: 16px;
            font-weight: 500;
          }

          .amountInputWrapper input:focus {
            outline: none;
            border-color: #3b82f6;
          }

          .maxButton {
            width: 80px;
            height: 48px;
            background: #f1f5f9;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            color: #475569;
            cursor: pointer;
            transition: all 0.2s;
          }

          .maxButton:hover {
            background: #e2e8f0;
          }

          .maxButton:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .error {
            color: #ef4444;
            font-size: 14px;
            margin-top: 8px;
            padding: 8px;
            background: #fef2f2;
            border-radius: 8px;
          }

          .infoBox {
            display: flex;
            gap: 12px;
            padding: 12px;
            background: #f0f9ff;
            border-radius: 12px;
            margin-top: 16px;
          }

          .infoIcon {
            font-size: 20px;
          }

          .infoText {
            flex: 1;
            color: #0369a1;
            font-size: 13px;
            line-height: 1.5;
          }

          .cancelButton, .withdrawButton, .doneButton {
            flex: 1;
            height: 48px;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .cancelButton {
            background: #f1f5f9;
            color: #475569;
          }

          .withdrawButton, .doneButton {
            background: #3b82f6;
            color: white;
          }

          .withdrawButton:hover:not(:disabled) {
            background: #2563eb;
            transform: translateY(-1px);
          }

          .withdrawButton:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .successIcon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 16px;
          }

          .instruction {
            text-align: center;
            color: #0f172a;
            margin-bottom: 20px;
          }

          .detailsBox {
            background: #f8fafc;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
          }

          .detailRow {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }

          .detailRow:not(:last-child) {
            border-bottom: 1px solid #e2e8f0;
          }

          .detailLabel {
            color: #64748b;
          }

          .detailValue {
            font-weight: 600;
            color: #0f172a;
          }

          .detailValue.status {
            color: #f59e0b;
          }

          .warning {
            background: #fef3c7;
            color: #92400e;
            padding: 12px;
            border-radius: 12px;
            font-size: 14px;
            text-align: center;
          }
        `}</style>
      </div>
    </div>
  );
}