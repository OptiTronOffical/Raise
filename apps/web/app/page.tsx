"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { TopBar } from "../components/TopBar";
import { BalancePill } from "../components/BalancePill";
import { ProfilePill } from "../components/ProfilePill";
import { BottomNav } from "../components/BottomNav";
import { JackpotReel } from "../components/JackpotReel";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { SuccessMessage } from "../components/SuccessMessage";
import { DepositModal } from "../components/DepositModal";
import { WithdrawModal } from "../components/WithdrawModal";
import { api } from "../lib/api";
import { ready, expand } from "../lib/telegram";

// Types
interface User {
  tg_id: number;
  username: string;
}

interface Balance {
  ton: string;
  ton_nano: string;
  cashback_available_ton: string;
  referral_available_ton: string;
}

interface Participant {
  tg_id: number;
  username: string;
  amount_ton: string;
  chance_pct: string;
}

interface JackpotState {
  round_id: number;
  bank_ton: string;
  target_bank_ton: string;
  status: string;
  participants: Participant[];
  history: JackpotHistory[];
}

interface JackpotHistory {
  round_id: number;
  bank_ton: string;
  winner_username: string;
  winner_tg_id: number;
  winning_nft_index: number;
  created_at: string;
}

export default function Home() {
  const [me, setMe] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [state, setState] = useState<JackpotState | null>(null);
  const [amount, setAmount] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<number | null>(null);
  const [showWinAlert, setShowWinAlert] = useState(false);
  
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  const [selectedTab, setSelectedTab] = useState<'participants' | 'history'>('participants');
  const [betAmountError, setBetAmountError] = useState<string | null>(null);

  const progressInterval = useRef<NodeJS.Timeout>();

  // Calculate progress percentage
  const bankPct = useMemo(() => {
    const b = parseFloat(state?.bank_ton || "0");
    const t = parseFloat(state?.target_bank_ton || "0.10");
    if (t <= 0) return 0;
    return Math.min(100, (b / t) * 100);
  }, [state]);

  // Get user's current bet
  const myBet = useMemo(() => {
    if (!me || !state?.participants) return null;
    return state.participants.find(p => p.tg_id === me.tg_id);
  }, [me, state]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!spinning) {
        fetchData();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [spinning]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [userData, balanceData, stateData] = await Promise.all([
        api.me().catch(() => null),
        api.balance().catch(() => null),
        api.jackpotState()
      ]);
      
      if (userData) setMe(userData);
      if (balanceData) setBalance(balanceData);
      setState(stateData);
    } catch (err) {
      setError("Failed to load game data");
      console.error("Home fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initialize Telegram WebApp
    ready();
    expand(); // Expand to full height
    
    fetchData();
    
    // Cleanup interval on unmount
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [fetchData]);

  // Validate bet amount
  const validateBetAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setBetAmountError("Amount must be greater than 0");
      return false;
    }
    if (num < 0.01) {
      setBetAmountError("Minimum bet is 0.01 TON");
      return false;
    }
    if (num > 10) {
      setBetAmountError("Maximum bet is 10 TON");
      return false;
    }
    if (balance && parseFloat(value) > parseFloat(balance.ton)) {
      setBetAmountError("Insufficient balance");
      return false;
    }
    setBetAmountError(null);
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setAmount(value);
    validateBetAmount(value);
  };

  const onBet = async () => {
    if (!validateBetAmount(amount)) return;
    
    setBusy(true);
    setError(null);
    
    try {
      const res = await api.bet(amount);
      await fetchData();
      
      if (res.resolved && res.winning_nft_index) {
        setWinning(res.winning_nft_index);
        setSpinning(true);
        setShowWinAlert(true);
      } else {
        setSuccess(`Bet placed: ${amount} TON`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      const reason = err?.data?.reason || err?.message || "Failed to place bet";
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  const handleReelDone = () => {
    setSpinning(false);
    if (showWinAlert && winning) {
      setSuccess(` You won NFT #${winning}!`);
      setShowWinAlert(false);
    }
  };

  const quickBetAmounts = ["0.1", "0.5", "1", "5"];

  if (loading && !state) {
    return (
      <div className="page">
        <TopBar />
        <BalancePill balanceTon="0" />
        <ProfilePill username="user" />
        <LoadingSpinner text="Loading game..." />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar />
      <BalancePill 
        balanceTon={balance?.ton || "0"} 
        onDeposit={() => setShowDepositModal(true)}
        onWithdraw={() => setShowWithdrawModal(true)}
      />
      <ProfilePill username={me?.username || "user"} />

      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={() => setError(null)} 
        />
      )}

      {success && (
        <SuccessMessage 
          message={success} 
          onDismiss={() => setSuccess(null)} 
        />
      )}

      <div className="header">
        <div className="h2">Jackpot Game</div>
        <div className="headerSub">Round #{state?.round_id || "—"}</div>
      </div>

      {/* Jackpot Reel */}
      <JackpotReel
        winningIndex={winning}
        spinning={spinning}
        onDone={handleReelDone}
      />

      {/* Progress Card */}
      <div className="progressCard">
        <div className="progressHeader">
          <div className="progressLabel">Round Progress</div>
          <div className="progressAmount">
            {state?.bank_ton || "0"} / {state?.target_bank_ton || "0.10"} TON
          </div>
        </div>
        
        <div className="progressBar">
          <div 
            className="progressFill" 
            style={{ width: `${bankPct}%` }}
          />
        </div>

        {myBet && (
          <div className="myBet">
            Your bet: <strong>{myBet.amount_ton} TON</strong> ({myBet.chance_pct}% chance)
          </div>
        )}
      </div>

      {/* Betting Card */}
      <div className="betCard">
        <div className="betHeader">
          <div className="betTitle">Place Your Bet</div>
          {balance && (
            <div className="betBalance">
              Balance: {balance.ton} TON
            </div>
          )}
        </div>

        <div className="quickBets">
          {quickBetAmounts.map(q => (
            <button
              key={q}
              className={`quickBet ${amount === q ? 'active' : ''}`}
              onClick={() => {
                setAmount(q);
                validateBetAmount(q);
              }}
            >
              {q} TON
            </button>
          ))}
        </div>

        <div className="betInputGroup">
          <input
            type="text"
            className={`betInput ${betAmountError ? 'error' : ''}`}
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.1"
            disabled={busy || spinning}
          />
          <button
            className="maxButton"
            onClick={() => {
              if (balance) {
                setAmount(balance.ton);
                validateBetAmount(balance.ton);
              }
            }}
            disabled={busy || spinning}
          >
            MAX
          </button>
        </div>

        {betAmountError && (
          <div className="betError">{betAmountError}</div>
        )}

        <button
          className={`betButton ${spinning ? 'spinning' : ''}`}
          onClick={onBet}
          disabled={busy || spinning || !!betAmountError}
        >
          {busy ? 'Processing...' : spinning ? 'Round in Progress...' : 'Place Bet'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${selectedTab === 'participants' ? 'active' : ''}`}
          onClick={() => setSelectedTab('participants')}
        >
          Participants ({state?.participants?.length || 0})
        </button>
        <button
          className={`tab ${selectedTab === 'history' ? 'active' : ''}`}
          onClick={() => setSelectedTab('history')}
        >
          History
        </button>
      </div>

      {/* Participants List */}
      {selectedTab === 'participants' && (
        <div className="participantsList">
          {!state?.participants || state.participants.length === 0 ? (
            <div className="emptyList">
              <div className="emptyIcon"></div>
              <div className="emptyText">No bets yet. Be the first!</div>
            </div>
          ) : (
            state.participants.map((p, index) => (
              <div key={p.tg_id} className={`participantItem ${p.tg_id === me?.tg_id ? 'me' : ''}`}>
                <div className="participantRank">#{index + 1}</div>
                <div className="participantInfo">
                  <div className="participantName">
                    {p.username || `User ${p.tg_id}`}
                    {p.tg_id === me?.tg_id && <span className="youBadge">You</span>}
                  </div>
                  <div className="participantChance">{p.chance_pct}% chance</div>
                </div>
                <div className="participantAmount">{p.amount_ton} TON</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History List */}
      {selectedTab === 'history' && (
        <div className="historyList">
          {!state?.history || state.history.length === 0 ? (
            <div className="emptyList">
              <div className="emptyIcon"></div>
              <div className="emptyText">No history yet</div>
            </div>
          ) : (
            state.history.map((h) => (
              <div key={h.round_id} className="historyItem">
                <div className="historyRound">Round #{h.round_id}</div>
                <div className="historyWinner">
                  <span className="winnerLabel">Winner:</span>
                  <span className="winnerName">{h.winner_username}</span>
                </div>
                <div className="historyDetails">
                  <div className="historyPrize">
                    <span className="prizeIcon"></span>
                    {h.bank_ton} TON
                  </div>
                  <div className="historyNft">
                    <span className="nftIcon"></span>
                    NFT #{h.winning_nft_index}
                  </div>
                </div>
                <div className="historyDate">
                  {new Date(h.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={fetchData}
      />

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={fetchData}
        balance={balance?.ton || "0"}
      />

      <BottomNav />

      <style jsx>{`
        .header {
          padding: 16px;
          background: white;
          border-bottom: 1px solid #eef2f6;
        }

        .headerSub {
          color: #64748b;
          font-size: 14px;
          margin-top: 4px;
        }

        .progressCard {
          margin: 16px;
          padding: 16px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .progressHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progressLabel {
          font-weight: 500;
          color: #64748b;
        }

        .progressAmount {
          font-weight: 700;
          color: #2f7cf6;
        }

        .progressBar {
          height: 8px;
          background: #f1f5f9;
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progressFill {
          height: 100%;
          background: linear-gradient(90deg, #2f7cf6, #6d8cff);
          transition: width 0.3s ease;
        }

        .myBet {
          padding: 8px 12px;
          background: #f0f9ff;
          border-radius: 12px;
          color: #0369a1;
          font-size: 14px;
        }

        .betCard {
          margin: 16px;
          padding: 20px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .betHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .betTitle {
          font-weight: 700;
          font-size: 18px;
          color: #0f172a;
        }

        .betBalance {
          color: #64748b;
          font-size: 14px;
        }

        .quickBets {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .quickBet {
          flex: 1;
          min-width: 60px;
          padding: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quickBet:hover {
          background: #f1f5f9;
        }

        .quickBet.active {
          background: #2f7cf6;
          color: white;
          border-color: #2f7cf6;
        }

        .betInputGroup {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .betInput {
          flex: 1;
          height: 52px;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 18px;
          font-weight: 700;
          transition: border-color 0.2s;
        }

        .betInput:focus {
          outline: none;
          border-color: #2f7cf6;
        }

        .betInput.error {
          border-color: #ef4444;
        }

        .maxButton {
          width: 80px;
          height: 52px;
          background: #f1f5f9;
          border: none;
          border-radius: 14px;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s;
        }

        .maxButton:hover {
          background: #e2e8f0;
        }

        .betError {
          color: #ef4444;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .betButton {
          width: 100%;
          height: 56px;
          background: linear-gradient(135deg, #2f7cf6, #6d8cff);
          color: white;
          border: none;
          border-radius: 16px;
          font-weight: 700;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .betButton:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(47,124,246,0.3);
        }

        .betButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .betButton.spinning {
          background: linear-gradient(135deg, #f59e0b, #fbbf24);
        }

        .tabs {
          display: flex;
          gap: 8px;
          padding: 0 16px;
          margin-bottom: 16px;
        }

        .tab {
          flex: 1;
          padding: 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab.active {
          background: #2f7cf6;
          color: white;
          border-color: #2f7cf6;
        }

        .participantsList, .historyList {
          margin: 0 16px 16px;
        }

        .participantItem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: white;
          border-radius: 12px;
          margin-bottom: 8px;
          transition: transform 0.2s;
        }

        .participantItem.me {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
        }

        .participantRank {
          width: 36px;
          height: 36px;
          background: #f1f5f9;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #475569;
        }

        .participantInfo {
          flex: 1;
        }

        .participantName {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .youBadge {
          background: #2f7cf6;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .participantChance {
          font-size: 13px;
          color: #64748b;
        }

        .participantAmount {
          font-weight: 700;
          color: #2f7cf6;
        }

        .historyItem {
          background: white;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 8px;
        }

        .historyRound {
          font-weight: 600;
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .historyWinner {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .winnerLabel {
          color: #64748b;
          font-size: 14px;
        }

        .winnerName {
          font-weight: 700;
          color: #0f172a;
        }

        .historyDetails {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
        }

        .historyPrize, .historyNft {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }

        .prizeIcon, .nftIcon {
          font-size: 16px;
        }

        .historyDate {
          color: #94a3b8;
          font-size: 12px;
        }

        .emptyList {
          text-align: center;
          padding: 48px 24px;
          background: white;
          border-radius: 16px;
        }

        .emptyIcon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .emptyText {
          color: #64748b;
        }

        @media (max-width: 640px) {
          .quickBets {
            flex-wrap: wrap;
          }
          
          .quickBet {
            min-width: calc(50% - 4px);
          }
        }
      `}</style>

      {/* Global styles for modals */}
      <style jsx global>{`
        .modalOverlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
      `}</style>
    </div>
  );
}