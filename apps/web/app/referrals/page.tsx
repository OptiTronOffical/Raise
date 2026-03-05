"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { api } from "../../lib/api";
import QRCode from "react-qr-code";

// Types
interface User {
  tg_id: number;
  username: string;
  wallet_address?: string;
}

interface Balance {
  ton: string;
  ton_nano: string;
  cashback_available_ton: string;
  referral_available_ton: string;
}

interface ReferralStats {
  invited: number;
  active: number;
  friends_stake_ton: string;
  earned_ton: string;
  available_ton: string;
  referrals: ReferralUser[];
}

interface ReferralUser {
  tg_id: number;
  username: string;
  registered_at: string;
  bet_count: number;
  total_bet_ton: string;
}

// Bot username from environment (should be configured)
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "YourBot";

export default function Referrals() {
  const [me, setMe] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'stats' | 'list'>('stats');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [userData, balanceData, statsData] = await Promise.all([
        api.me(),
        api.balance(),
        api.refStats()
      ]);
      
      setMe(userData);
      setBalance(balanceData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referral data");
      console.error("Referrals fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refLink = useMemo(() => {
    if (!me?.tg_id) return "";
    return `https://t.me/${BOT_USERNAME}?start=${me.tg_id}`;
  }, [me]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Jackpot Game!',
          text: `Play jackpot games and earn rewards! Use my referral link:`,
          url: refLink
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleClaim = async () => {
    if (!stats?.available_ton || stats.available_ton === "0") return;
    
    try {
      setClaiming(true);
      const result = await api.claimReferral();
      if (result.ok) {
        await fetchData(); // Refresh data
      }
    } catch (err) {
      console.error("Claim failed:", err);
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading && !stats) {
    return (
      <div className="page">
        <TopBar />
        <BalancePill balanceTon={balance?.ton || "0"} />
        <ProfilePill username={me?.username || "user"} />
        <div className="h2">Referrals</div>
        <LoadingSpinner text="Loading referral data..." />
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
        <div className="h2">Referrals</div>
        <div className="headerSub">Invite friends and earn together</div>
      </div>

      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={fetchData} 
        />
      )}

      {/* Referral Link Card */}
      <div className="card referralCard">
        <div className="referralHeader">
          <div className="referralTitle">
            <span className="emoji">👥</span>
            Your Referral Link
          </div>
          <div className="referralRate">Earn 0.25% of friend's bets</div>
        </div>

        <div className="linkContainer">
          <div className="linkBox">
            <span className="linkText">{refLink || "—"}</span>
          </div>
          
          <div className="linkActions">
            <button 
              className={`actionButton copyButton ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
              title="Copy link"
            >
              {copied ? '✓' : '📋'}
            </button>
            
            {typeof navigator.share !== 'undefined' && (
              <button 
                className="actionButton shareButton"
                onClick={handleShare}
                title="Share"
              >
                📤
              </button>
            )}
            
            <button 
              className="actionButton qrButton"
              onClick={() => setShowQR(!showQR)}
              title="Show QR code"
            >
              📱
            </button>
          </div>
        </div>

        {showQR && (
          <div className="qrContainer">
            <QRCode value={refLink} size={200} />
            <div className="qrHint">Scan to open in Telegram</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${selectedTab === 'stats' ? 'active' : ''}`}
          onClick={() => setSelectedTab('stats')}
        >
          Statistics
        </button>
        <button 
          className={`tab ${selectedTab === 'list' ? 'active' : ''}`}
          onClick={() => setSelectedTab('list')}
        >
          Referrals List
        </button>
      </div>

      {selectedTab === 'stats' ? (
        <>
          {/* Stats Cards */}
          <div className="statsGrid">
            <div className="statCard">
              <div className="statValue">{stats?.invited ?? 0}</div>
              <div className="statLabel">Invited</div>
            </div>
            
            <div className="statCard">
              <div className="statValue">{stats?.active ?? 0}</div>
              <div className="statLabel">Active</div>
            </div>
            
            <div className="statCard">
              <div className="statValue">{stats?.friends_stake_ton ?? "0"} TON</div>
              <div className="statLabel">Friends Stake</div>
            </div>
          </div>

          {/* Earnings Card */}
          <div className="card earningsCard">
            <div className="earningsHeader">
              <div className="earningsTitle">Your Earnings</div>
              <div className="earningsSub">Lifetime rewards from referrals</div>
            </div>

            <div className="earningsGrid">
              <div className="earningItem">
                <div className="earningLabel">Total Earned</div>
                <div className="earningValue positive">{stats?.earned_ton ?? "0"} TON</div>
              </div>
              
              <div className="earningItem">
                <div className="earningLabel">Available</div>
                <div className="earningValue highlight">{stats?.available_ton ?? "0"} TON</div>
              </div>
            </div>

            {stats?.available_ton && stats.available_ton !== "0" && (
              <button 
                className={`claimButton ${claiming ? 'claiming' : ''}`}
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? 'Claiming...' : 'Claim Available Rewards'}
              </button>
            )}
          </div>

          {/* How it works */}
          <div className="howItWorks">
            <div className="howTitle">📖 How it works</div>
            <div className="steps">
              <div className="step">
                <div className="stepNumber">1</div>
                <div className="stepText">Share your unique link with friends</div>
              </div>
              <div className="step">
                <div className="stepNumber">2</div>
                <div className="stepText">Friends join through your link</div>
              </div>
              <div className="step">
                <div className="stepNumber">3</div>
                <div className="stepText">You earn 0.25% of every bet they make</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Referrals List */
        <div className="referralsList">
          {!stats?.referrals || stats.referrals.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon">👥</div>
              <div className="emptyTitle">No referrals yet</div>
              <div className="emptyText">
                Share your referral link to start earning rewards!
              </div>
            </div>
          ) : (
            <>
              {stats.referrals.map((ref, index) => (
                <div key={ref.tg_id} className="referralItem">
                  <div className="referralRank">#{index + 1}</div>
                  <div className="referralInfo">
                    <div className="referralName">
                      {ref.username || `User ${ref.tg_id}`}
                    </div>
                    <div className="referralDate">
                      Joined {formatDate(ref.registered_at)}
                    </div>
                  </div>
                  <div className="referralStats">
                    <div className="referralBets">
                      <span className="stat">{ref.bet_count}</span> bets
                    </div>
                    <div className="referralVolume">
                      {ref.total_bet_ton} TON
                    </div>
                  </div>
                </div>
              ))}

              {stats.referrals.length > 0 && (
                <div className="listSummary">
                  Showing {stats.referrals.length} referrals
                </div>
              )}
            </>
          )}
        </div>
      )}

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

        .referralCard {
          margin: 16px;
        }

        .referralHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .referralTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #1e293b;
        }

        .emoji {
          font-size: 20px;
        }

        .referralRate {
          background: #3b82f620;
          color: #3b82f6;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .linkContainer {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .linkBox {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          overflow-x: auto;
        }

        .linkText {
          font-size: 14px;
          color: #1e293b;
          word-break: break-all;
          font-family: monospace;
        }

        .linkActions {
          display: flex;
          gap: 8px;
        }

        .actionButton {
          width: 44px;
          height: 44px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: white;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .actionButton:hover {
          background: #f8fafc;
          transform: scale(1.05);
        }

        .copyButton.copied {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        .qrContainer {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          background: white;
          border-radius: 12px;
          margin-top: 16px;
        }

        .qrHint {
          margin-top: 12px;
          color: #64748b;
          font-size: 13px;
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
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 0 16px;
          margin-bottom: 16px;
        }

        .statCard {
          background: white;
          padding: 16px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .statValue {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .statLabel {
          font-size: 12px;
          color: #64748b;
        }

        .earningsCard {
          margin: 16px;
        }

        .earningsHeader {
          margin-bottom: 16px;
        }

        .earningsTitle {
          font-weight: 600;
          color: #1e293b;
        }

        .earningsSub {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
        }

        .earningsGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }

        .earningItem {
          text-align: center;
        }

        .earningLabel {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .earningValue {
          font-size: 18px;
          font-weight: 700;
        }

        .earningValue.positive {
          color: #10b981;
        }

        .earningValue.highlight {
          color: #3b82f6;
          font-size: 22px;
        }

        .claimButton {
          width: 100%;
          padding: 14px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .claimButton:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-2px);
        }

        .claimButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .claimButton.claiming {
          background: #94a3b8;
        }

        .howItWorks {
          margin: 16px;
          padding: 20px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .howTitle {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 16px;
        }

        .steps {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .step {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stepNumber {
          width: 28px;
          height: 28px;
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }

        .stepText {
          color: #475569;
          font-size: 14px;
        }

        .referralsList {
          padding: 0 16px;
        }

        .referralItem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          margin-bottom: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .referralRank {
          width: 32px;
          height: 32px;
          background: #f1f5f9;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #64748b;
          font-size: 14px;
        }

        .referralInfo {
          flex: 1;
        }

        .referralName {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
        }

        .referralDate {
          font-size: 12px;
          color: #94a3b8;
        }

        .referralStats {
          text-align: right;
        }

        .referralBets {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .stat {
          font-weight: 600;
          color: #3b82f6;
        }

        .referralVolume {
          font-weight: 700;
          color: #10b981;
        }

        .emptyState {
          text-align: center;
          padding: 48px 24px;
          background: white;
          border-radius: 16px;
        }

        .emptyIcon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .emptyTitle {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .emptyText {
          color: #64748b;
          margin-bottom: 24px;
        }

        .listSummary {
          text-align: center;
          padding: 20px;
          color: #94a3b8;
          font-size: 13px;
        }

        @media (max-width: 640px) {
          .statsGrid {
            gap: 8px;
          }
          
          .statCard {
            padding: 12px;
          }
          
          .statValue {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}