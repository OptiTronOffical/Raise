"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { TransactionIcon } from "../../components/TransactionIcon";
import { useInView } from "react-intersection-observer";

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

interface Transaction {
  id: number;
  type: string;
  amount_ton: string;
  created_at: string;
  meta: any | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Transaction type configuration
const TRANSACTION_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  deposit_confirmed: { label: "Deposit", color: "#10b981", icon: "💰" },
  deposit_pending: { label: "Deposit (Pending)", color: "#f59e0b", icon: "⏳" },
  withdraw_requested: { label: "Withdrawal Request", color: "#f59e0b", icon: "💸" },
  withdraw_paid: { label: "Withdrawal", color: "#ef4444", icon: "💸" },
  withdraw_rejected: { label: "Withdrawal Rejected", color: "#ef4444", icon: "❌" },
  bet: { label: "Bet Placed", color: "#3b82f6", icon: "🎮" },
  win: { label: "Jackpot Win", color: "#8b5cf6", icon: "🏆" },
  cashback_accrued: { label: "Cashback", color: "#10b981", icon: "🎁" },
  referral_accrued: { label: "Referral Reward", color: "#10b981", icon: "👥" },
  promo_bonus: { label: "Promo Bonus", color: "#ec4899", icon: "🎫" },
  daily_bonus: { label: "Daily Bonus", color: "#f97316", icon: "📅" },
  default: { label: "Transaction", color: "#6b7280", icon: "📝" }
};

function getTransactionConfig(type: string) {
  return TRANSACTION_CONFIG[type] || TRANSACTION_CONFIG.default;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  
  return date.toLocaleDateString();
}

export default function Transactions() {
  const [me, setMe] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, has_more: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  const { ref: loadMoreRef, inView } = useInView();
  const initialLoadRef = useRef(true);

  const fetchData = useCallback(async (offset = 0, limit = 20, type = filter) => {
    try {
      if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // Fetch user and balance in parallel with transactions
      const [userData, balanceData, txData] = await Promise.all([
        offset === 0 ? api.me() : Promise.resolve(me),
        offset === 0 ? api.balance() : Promise.resolve(balance),
        api.transactions(offset, limit, type !== 'all' ? type : undefined)
      ]);

      if (offset === 0) {
        setMe(userData);
        setBalance(balanceData);
        setTransactions(txData.transactions || []);
      } else {
        setTransactions(prev => [...prev, ...(txData.transactions || [])]);
      }

      setPagination(txData.pagination || { total: 0, limit, offset, has_more: false });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
      console.error("Transactions fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filter, me, balance]);

  // Initial load
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      fetchData(0, pagination.limit, filter);
    }
  }, [fetchData, pagination.limit, filter]);

  // Load more when scrolling
  useEffect(() => {
    if (inView && pagination.has_more && !loadingMore && !loading) {
      fetchData(pagination.offset + pagination.limit, pagination.limit, filter);
    }
  }, [inView, pagination.has_more, loadingMore, loading, fetchData, pagination.offset, pagination.limit, filter]);

  // Pull to refresh
  useEffect(() => {
    let touchStart = 0;
    let touchY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStart = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && !refreshing && !loading) {
        touchY = e.touches[0].clientY;
        if (touchY - touchStart > 100) {
          setRefreshing(true);
          fetchData(0, pagination.limit, filter);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [refreshing, loading, fetchData, pagination.limit, filter]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setTransactions([]);
    fetchData(0, pagination.limit, newFilter);
  };

  const getAmountColor = (type: string, amount: string) => {
    const positiveTypes = ['deposit_confirmed', 'win', 'cashback_accrued', 'referral_accrued', 'promo_bonus', 'daily_bonus'];
    if (positiveTypes.includes(type)) return '#10b981';
    if (type === 'bet' || type === 'withdraw_requested') return '#ef4444';
    return '#6b7280';
  };

  const getAmountPrefix = (type: string) => {
    const positiveTypes = ['deposit_confirmed', 'win', 'cashback_accrued', 'referral_accrued', 'promo_bonus', 'daily_bonus'];
    return positiveTypes.includes(type) ? '+' : '';
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="page">
        <TopBar />
        <BalancePill balanceTon={balance?.ton || "0"} />
        <ProfilePill username={me?.username || "user"} />
        <div className="h2">Transactions</div>
        <LoadingSpinner text="Loading transactions..." />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar />
      <BalancePill balanceTon={balance?.ton || "0"} />
      <ProfilePill username={me?.username || "user"} />
      
      <div className="transactionsHeader">
        <div className="h2">Transactions</div>
        <div className="filterButtons">
          <button 
            className={`filterButton ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All
          </button>
          <button 
            className={`filterButton ${filter === 'deposit' ? 'active' : ''}`}
            onClick={() => handleFilterChange('deposit')}
          >
            Deposits
          </button>
          <button 
            className={`filterButton ${filter === 'withdraw' ? 'active' : ''}`}
            onClick={() => handleFilterChange('withdraw')}
          >
            Withdrawals
          </button>
          <button 
            className={`filterButton ${filter === 'bet' ? 'active' : ''}`}
            onClick={() => handleFilterChange('bet')}
          >
            Bets
          </button>
          <button 
            className={`filterButton ${filter === 'bonus' ? 'active' : ''}`}
            onClick={() => handleFilterChange('bonus')}
          >
            Bonuses
          </button>
        </div>
      </div>

      {refreshing && (
        <div className="refreshingIndicator">
          <LoadingSpinner size="small" text="Refreshing..." />
        </div>
      )}

      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={() => fetchData(0, pagination.limit, filter)} 
        />
      )}

      <div className="transactionsList">
        {transactions.length === 0 && !loading && !error ? (
          <div className="emptyState">
            <div className="emptyIcon">📭</div>
            <div className="emptyTitle">No transactions yet</div>
            <div className="emptyText">
              {filter === 'all' 
                ? "Your transaction history will appear here" 
                : `No ${filter} transactions found`}
            </div>
            {filter !== 'all' && (
              <button 
                className="resetFilterButton"
                onClick={() => handleFilterChange('all')}
              >
                Show all transactions
              </button>
            )}
          </div>
        ) : (
          <>
            {transactions.map((tx, index) => {
              const config = getTransactionConfig(tx.type);
              const amountColor = getAmountColor(tx.type, tx.amount_ton);
              const amountPrefix = getAmountPrefix(tx.type);
              
              return (
                <div key={`${tx.id}-${index}`} className="transactionItem">
                  <div className="transactionIcon" style={{ backgroundColor: `${config.color}20` }}>
                    <span>{config.icon}</span>
                  </div>
                  
                  <div className="transactionDetails">
                    <div className="transactionMain">
                      <span className="transactionType">{config.label}</span>
                      <span 
                        className="transactionAmount"
                        style={{ color: amountColor }}
                      >
                        {amountPrefix}{tx.amount_ton} TON
                      </span>
                    </div>
                    
                    <div className="transactionMeta">
                      <span className="transactionDate">
                        {formatDate(tx.created_at)}
                      </span>
                      {tx.meta && (
                        <span className="transactionExtra">
                          {tx.meta.round_id && `Round #${tx.meta.round_id}`}
                          {tx.meta.nftIndex && ` • NFT #${tx.meta.nftIndex}`}
                          {tx.meta.source === 'promo' && ' • Promo'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load more trigger */}
            {pagination.has_more && (
              <div ref={loadMoreRef} className="loadMoreTrigger">
                {loadingMore && <LoadingSpinner size="small" />}
              </div>
            )}

            {/* Summary */}
            {transactions.length > 0 && (
              <div className="transactionsSummary">
                Showing {transactions.length} of {pagination.total} transactions
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />

      <style jsx>{`
        .transactionsHeader {
          padding: 16px;
          background: white;
          border-bottom: 1px solid #eef2f6;
        }

        .filterButtons {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 12px 0 4px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .filterButtons::-webkit-scrollbar {
          display: none;
        }

        .filterButton {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filterButton.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .transactionsList {
          padding: 16px;
        }

        .transactionItem {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: white;
          border-radius: 12px;
          margin-bottom: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          transition: transform 0.2s;
        }

        .transactionItem:hover {
          transform: translateX(4px);
        }

        .transactionIcon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .transactionDetails {
          flex: 1;
        }

        .transactionMain {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .transactionType {
          font-weight: 600;
          color: #1e293b;
        }

        .transactionAmount {
          font-weight: 700;
        }

        .transactionMeta {
          display: flex;
          gap: 8px;
          font-size: 13px;
          color: #94a3b8;
        }

        .transactionExtra {
          color: #64748b;
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

        .resetFilterButton {
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .refreshingIndicator {
          padding: 8px;
          display: flex;
          justify-content: center;
        }

        .loadMoreTrigger {
          padding: 20px;
          display: flex;
          justify-content: center;
        }

        .transactionsSummary {
          text-align: center;
          padding: 20px;
          color: #94a3b8;
          font-size: 13px;
        }

        @media (max-width: 640px) {
          .transactionsList {
            padding: 12px;
          }
          
          .transactionItem {
            padding: 10px;
          }
          
          .transactionIcon {
            width: 40px;
            height: 40px;
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}