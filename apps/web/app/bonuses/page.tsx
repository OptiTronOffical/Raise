"use client";
import { useEffect, useState, useCallback } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SuccessMessage } from "../../components/SuccessMessage";
import { api } from "../../lib/api";

// Types
interface User {
  tg_id: number;
  username: string;
}

interface Balance {
  ton: string;
  ton_nano: string;
  cashback_available_ton: string;
  cashback_nano?: string;
  referral_available_ton: string;
  referral_nano?: string;
}

interface DailyStatus {
  claimed: boolean;
  available?: string;
  next_claim?: string;
}

interface ClaimResponse {
  ok: boolean;
  amount_ton: string;
}

// Bonus type configuration
const BONUS_CONFIG = {
  daily: {
    title: "Daily Bonus",
    icon: "📅",
    color: "#f97316",
    description: "Claim free TON every day"
  },
  cashback: {
    title: "Cashback",
    icon: "💰",
    color: "#10b981",
    description: "Get back a percentage of your bets"
  },
  referral: {
    title: "Referral Rewards",
    icon: "👥",
    color: "#8b5cf6",
    description: "Earn from your friends' activity"
  },
  promo: {
    title: "Promo Codes",
    icon: "🎫",
    color: "#ec4899",
    description: "Enter special codes for bonuses"
  }
};

export default function Bonuses() {
  const [me, setMe] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [claiming, setClaiming] = useState({
    daily: false,
    cashback: false,
    referral: false,
    promo: false
  });
  
  const [countdown, setCountdown] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [userData, balanceData, dailyData] = await Promise.all([
        api.me(),
        api.balance(),
        api.dailyStatus()
      ]);
      
      setMe(userData);
      setBalance(balanceData);
      setDaily(dailyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bonuses");
      console.error("Bonuses fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Countdown timer for daily bonus
  useEffect(() => {
    if (daily?.claimed && daily.next_claim) {
      const updateCountdown = () => {
        const now = new Date().getTime();
        const next = new Date(daily.next_claim!).getTime();
        const diff = next - now;
        
        if (diff <= 0) {
          setCountdown(null);
          fetchData(); // Refresh status
          return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown(`${hours}h ${minutes}m`);
      };
      
      updateCountdown();
      const timer = setInterval(updateCountdown, 60000); // Update every minute
      
      return () => clearInterval(timer);
    }
  }, [daily, fetchData]);

  const handleClaim = async (type: 'daily' | 'cashback' | 'referral', claimFn: () => Promise<ClaimResponse>) => {
    try {
      setClaiming(prev => ({ ...prev, [type]: true }));
      setError(null);
      setSuccess(null);
      
      const result = await claimFn();
      
      if (result.ok) {
        setSuccess(`Successfully claimed ${result.amount_ton} TON!`);
        await fetchData(); // Refresh all data
      }
    } catch (err: any) {
      const reason = err?.data?.reason || err?.message || "Failed to claim";
      setError(reason);
    } finally {
      setClaiming(prev => ({ ...prev, [type]: false }));
    }
  };

  const handlePromo = async () => {
    // Validate promo code
    if (!promoCode.trim()) {
      setPromoError("Please enter a promo code");
      return;
    }
    
    if (promoCode.length < 3 || promoCode.length > 20) {
      setPromoError("Promo code must be 3-20 characters");
      return;
    }
    
    try {
      setClaiming(prev => ({ ...prev, promo: true }));
      setPromoError(null);
      setPromoSuccess(null);
      
      const result = await api.promoActivate(promoCode.trim().toUpperCase());
      
      if (result.ok) {
        setPromoSuccess(`Promo code activated! +${result.amount_ton} TON`);
        setPromoCode("");
        await fetchData();
      }
    } catch (err: any) {
      const reason = err?.data?.reason || err?.message || "Invalid promo code";
      setPromoError(reason);
    } finally {
      setClaiming(prev => ({ ...prev, promo: false }));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setPromoSuccess(`Code "${code}" copied to clipboard!`);
    setTimeout(() => setPromoSuccess(null), 2000);
  };

  if (loading && !balance) {
    return (
      <div className="page">
        <TopBar />
        <BalancePill balanceTon="0" />
        <ProfilePill username="user" />
        <div className="h2">Bonuses</div>
        <LoadingSpinner text="Loading bonuses..." />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar />
      <BalancePill balanceTon={balance?.ton || "0"} />
      <ProfilePill username={me?.username || "user"} />
      
      <div className="header">
        <div className="h2">Bonuses & Rewards</div>
        <div className="headerSub">Claim your daily bonuses and rewards</div>
      </div>

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

      {/* Daily Bonus Card */}
      <div className="bonusCard" style={{ borderColor: BONUS_CONFIG.daily.color }}>
        <div className="bonusHeader">
          <div className="bonusTitle">
            <span className="bonusIcon">{BONUS_CONFIG.daily.icon}</span>
            {BONUS_CONFIG.daily.title}
          </div>
          <div className="bonusStatus" style={{ 
            background: daily?.claimed ? '#f1f5f9' : `${BONUS_CONFIG.daily.color}20`,
            color: daily?.claimed ? '#64748b' : BONUS_CONFIG.daily.color
          }}>
            {daily?.claimed ? (countdown ? `Next in ${countdown}` : 'Claimed') : 'Available'}
          </div>
        </div>
        
        <div className="bonusDescription">{BONUS_CONFIG.daily.description}</div>
        
        <button 
          className={`bonusButton ${!daily?.claimed ? 'active' : 'disabled'}`}
          style={{ 
            background: !daily?.claimed ? BONUS_CONFIG.daily.color : '#e2e8f0',
            color: !daily?.claimed ? 'white' : '#94a3b8'
          }}
          onClick={() => handleClaim('daily', api.dailyClaim.bind(api))}
          disabled={daily?.claimed || claiming.daily}
        >
          {claiming.daily ? 'Claiming...' : daily?.claimed ? 'Already Claimed' : 'Claim Daily Bonus'}
        </button>
      </div>

      {/* Cashback Card */}
      <div className="bonusCard" style={{ borderColor: BONUS_CONFIG.cashback.color }}>
        <div className="bonusHeader">
          <div className="bonusTitle">
            <span className="bonusIcon">{BONUS_CONFIG.cashback.icon}</span>
            {BONUS_CONFIG.cashback.title}
          </div>
          <div className="bonusAmount">{balance?.cashback_available_ton || "0"} TON</div>
        </div>
        
        <div className="bonusDescription">{BONUS_CONFIG.cashback.description}</div>
        
        <div className="bonusStats">
          <div className="stat">
            <span className="statLabel">Earn rate:</span>
            <span className="statValue">0.5% per bet</span>
          </div>
        </div>
        
        <button 
          className={`bonusButton ${balance?.cashback_available_ton !== "0" ? 'active' : 'disabled'}`}
          style={{ 
            background: balance?.cashback_available_ton !== "0" ? BONUS_CONFIG.cashback.color : '#e2e8f0',
            color: balance?.cashback_available_ton !== "0" ? 'white' : '#94a3b8'
          }}
          onClick={() => handleClaim('cashback', api.cashbackClaim.bind(api))}
          disabled={balance?.cashback_available_ton === "0" || claiming.cashback}
        >
          {claiming.cashback ? 'Claiming...' : balance?.cashback_available_ton === "0" ? 'No Cashback Available' : 'Claim Cashback'}
        </button>
      </div>

      {/* Referral Card */}
      <div className="bonusCard" style={{ borderColor: BONUS_CONFIG.referral.color }}>
        <div className="bonusHeader">
          <div className="bonusTitle">
            <span className="bonusIcon">{BONUS_CONFIG.referral.icon}</span>
            {BONUS_CONFIG.referral.title}
          </div>
          <div className="bonusAmount">{balance?.referral_available_ton || "0"} TON</div>
        </div>
        
        <div className="bonusDescription">{BONUS_CONFIG.referral.description}</div>
        
        <div className="bonusStats">
          <div className="stat">
            <span className="statLabel">Earn rate:</span>
            <span className="statValue">0.25% of friends' bets</span>
          </div>
        </div>
        
        <button 
          className={`bonusButton ${balance?.referral_available_ton !== "0" ? 'active' : 'disabled'}`}
          style={{ 
            background: balance?.referral_available_ton !== "0" ? BONUS_CONFIG.referral.color : '#e2e8f0',
            color: balance?.referral_available_ton !== "0" ? 'white' : '#94a3b8'
          }}
          onClick={() => handleClaim('referral', api.referralClaim.bind(api))}
          disabled={balance?.referral_available_ton === "0" || claiming.referral}
        >
          {claiming.referral ? 'Claiming...' : balance?.referral_available_ton === "0" ? 'No Referral Rewards' : 'Claim Referral Rewards'}
        </button>
      </div>

      {/* Promo Code Card */}
      <div className="bonusCard" style={{ borderColor: BONUS_CONFIG.promo.color }}>
        <div className="bonusHeader">
          <div className="bonusTitle">
            <span className="bonusIcon">{BONUS_CONFIG.promo.icon}</span>
            {BONUS_CONFIG.promo.title}
          </div>
        </div>
        
        <div className="bonusDescription">{BONUS_CONFIG.promo.description}</div>
        
        <div className="promoInputGroup">
          <input 
            className="promoInput"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setPromoError(null);
            }}
            placeholder="ENTER CODE"
            maxLength={20}
            disabled={claiming.promo}
          />
          <button 
            className="promoButton"
            onClick={handlePromo}
            disabled={claiming.promo || !promoCode.trim()}
          >
            {claiming.promo ? 'Applying...' : 'Apply'}
          </button>
        </div>
        
        {promoError && (
          <div className="promoError">
            ❌ {promoError}
          </div>
        )}
        
        {promoSuccess && (
          <div className="promoSuccess">
            ✅ {promoSuccess}
          </div>
        )}

        {/* Example active promos */}
        <div className="activePromos">
          <div className="promosTitle">Active Promos:</div>
          <div className="promoExamples">
            <div className="promoExample" onClick={() => handleCopyCode('WELCOME10')}>
              <span className="exampleCode">WELCOME10</span>
              <span className="exampleValue">+0.1 TON</span>
            </div>
            <div className="promoExample" onClick={() => handleCopyCode('BONUS50')}>
              <span className="exampleCode">BONUS50</span>
              <span className="exampleValue">+0.5 TON</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bonus History */}
      <div className="historySection">
        <div className="historyTitle">Recent Bonus Activity</div>
        <button 
          className="historyButton"
          onClick={() => window.location.href = '/transactions?type=bonus'}
        >
          View All Transactions →
        </button>
      </div>

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

        .bonusCard {
          margin: 16px;
          padding: 20px;
          background: white;
          border-radius: 20px;
          border-left: 4px solid;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s;
        }

        .bonusCard:hover {
          transform: translateY(-2px);
        }

        .bonusHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .bonusTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 18px;
          color: #1e293b;
        }

        .bonusIcon {
          font-size: 24px;
        }

        .bonusStatus {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .bonusAmount {
          font-weight: 700;
          font-size: 20px;
          color: #1e293b;
        }

        .bonusDescription {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .bonusStats {
          background: #f8fafc;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .statLabel {
          color: #64748b;
          font-size: 14px;
        }

        .statValue {
          font-weight: 600;
          color: #1e293b;
        }

        .bonusButton {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .bonusButton.active:hover {
          opacity: 0.9;
          transform: scale(1.02);
        }

        .bonusButton.disabled {
          cursor: not-allowed;
        }

        .promoInputGroup {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .promoInput {
          flex: 1;
          height: 52px;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          padding: 0 16px;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: border-color 0.2s;
        }

        .promoInput:focus {
          outline: none;
          border-color: ${BONUS_CONFIG.promo.color};
        }

        .promoInput:disabled {
          background: #f1f5f9;
          cursor: not-allowed;
        }

        .promoButton {
          width: 100px;
          height: 52px;
          background: ${BONUS_CONFIG.promo.color};
          color: white;
          border: none;
          border-radius: 14px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .promoButton:hover:not(:disabled) {
          opacity: 0.9;
          transform: scale(1.05);
        }

        .promoButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .promoError {
          background: #fef2f2;
          color: #ef4444;
          padding: 12px;
          border-radius: 12px;
          font-size: 14px;
          margin-top: 12px;
        }

        .promoSuccess {
          background: #f0fdf4;
          color: #10b981;
          padding: 12px;
          border-radius: 12px;
          font-size: 14px;
          margin-top: 12px;
        }

        .activePromos {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #eef2f6;
        }

        .promosTitle {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 12px;
        }

        .promoExamples {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .promoExample {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .promoExample:hover {
          background: #f1f5f9;
          transform: scale(1.05);
        }

        .exampleCode {
          font-weight: 700;
          color: ${BONUS_CONFIG.promo.color};
          letter-spacing: 0.5px;
        }

        .exampleValue {
          color: #64748b;
        }

        .historySection {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          margin: 16px;
          background: white;
          border-radius: 16px;
        }

        .historyTitle {
          font-weight: 600;
          color: #1e293b;
        }

        .historyButton {
          background: none;
          border: none;
          color: #3b82f6;
          font-weight: 500;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .bonusCard {
            margin: 12px;
            padding: 16px;
          }
          
          .promoInputGroup {
            flex-direction: column;
          }
          
          .promoButton {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}