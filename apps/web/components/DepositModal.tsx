import { useState } from "react";
import { api } from "../lib/api";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DepositModal({ isOpen, onClose, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositInfo, setDepositInfo] = useState<any>(null);

  if (!isOpen) return null;

  const handleDeposit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.depositCreate(amount);
      setDepositInfo(res);
    } catch (err: any) {
      setError(err?.data?.reason || "Failed to create deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>Deposit TON</h3>
          <button className="closeButton" onClick={onClose}>×</button>
        </div>

        {!depositInfo ? (
          <>
            <div className="modalBody">
              <div className="inputGroup">
                <label>Amount (TON)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="1.0"
                  min="0.1"
                  step="0.1"
                  disabled={loading}
                />
              </div>
              {error && <div className="error">{error}</div>}
            </div>

            <div className="modalFooter">
              <button className="cancelButton" onClick={onClose}>Cancel</button>
              <button 
                className="depositButton" 
                onClick={handleDeposit}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Deposit'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modalBody">
              <div className="successIcon">💰</div>
              <p className="instruction">Send exactly <strong>{depositInfo.amount_ton} TON</strong> to:</p>
              
              <div className="addressBox">
                <code>{depositInfo.treasury_address}</code>
                <button 
                  className="copyButton"
                  onClick={() => handleCopy(depositInfo.treasury_address)}
                >
                  📋
                </button>
              </div>

              <p className="instruction">With comment:</p>
              <div className="commentBox">
                <code>{depositInfo.comment}</code>
                <button 
                  className="copyButton"
                  onClick={() => handleCopy(depositInfo.comment)}
                >
                  📋
                </button>
              </div>

              <div className="warning">
                ⚠️ Transaction must include the exact comment
              </div>

              <p className="expiry">Expires: {new Date(depositInfo.expires_at).toLocaleString()}</p>
            </div>

            <div className="modalFooter">
              <button className="doneButton" onClick={() => {
                setDepositInfo(null);
                onClose();
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
          }

          .closeButton {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #64748b;
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

          .inputGroup {
            margin-bottom: 16px;
          }

          .inputGroup label {
            display: block;
            margin-bottom: 8px;
            color: #475569;
            font-weight: 500;
          }

          .inputGroup input {
            width: 100%;
            height: 48px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 0 16px;
            font-size: 16px;
          }

          .error {
            color: #ef4444;
            font-size: 14px;
            margin-top: 8px;
          }

          .cancelButton, .depositButton, .doneButton {
            flex: 1;
            height: 48px;
            border: none;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
          }

          .cancelButton {
            background: #f1f5f9;
            color: #475569;
          }

          .depositButton, .doneButton {
            background: #2f7cf6;
            color: white;
          }

          .depositButton:disabled {
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
            margin-bottom: 16px;
          }

          .addressBox, .commentBox {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .addressBox code, .commentBox code {
            flex: 1;
            word-break: break-all;
            font-size: 14px;
          }

          .copyButton {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
          }

          .warning {
            background: #fef3c7;
            color: #92400e;
            padding: 12px;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 16px;
          }

          .expiry {
            text-align: center;
            color: #64748b;
            font-size: 13px;
          }
        `}</style>
      </div>
    </div>
  );
}