"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TopBar } from "../../components/TopBar";
import { BalancePill } from "../../components/BalancePill";
import { ProfilePill } from "../../components/ProfilePill";
import { BottomNav } from "../../components/BottomNav";
import { api } from "../../lib/api";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useInView } from "react-intersection-observer";

/* ---------------- TYPES ---------------- */

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

interface TransactionMeta {
  round_id?: number;
  nftIndex?: number;
  source?: string;
}

interface Transaction {
  id: number;
  type: string;
  amount_ton: string;
  created_at: string;
  meta?: TransactionMeta;
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

/* ---------------- CONFIG ---------------- */

const TRANSACTION_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  deposit_confirmed: { label: "Deposit", color: "#10b981", icon: "💰" },
  deposit_pending: { label: "Deposit Pending", color: "#f59e0b", icon: "⏳" },
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

/* ---------------- HELPERS ---------------- */

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diff = now.getTime() - date.getTime();

  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

/* ---------------- PAGE ---------------- */

export default function Transactions() {
  const [me, setMe] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });

  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { ref: loadMoreRef, inView } = useInView();

  const fetchingRef = useRef(false);

  /* ---------------- FETCH ---------------- */

  const fetchData = useCallback(
    async (offset = 0) => {
      if (fetchingRef.current) return;

      fetchingRef.current = true;

      try {
        offset === 0 ? setLoading(true) : setLoadingMore(true);
        setError(null);

        const [userData, balanceData, txData] = await Promise.all([
          offset === 0 ? api.me() : Promise.resolve(me),
          offset === 0 ? api.balance() : Promise.resolve(balance),
          api.transactions(
            offset,
            pagination.limit,
            filter !== "all" ? filter : undefined
          )
        ]);

        if (offset === 0) {
          setMe(userData);
          setBalance(balanceData);
          setTransactions(txData.transactions ?? []);
        } else {
          setTransactions((prev) => [
            ...prev,
            ...(txData.transactions ?? [])
          ]);
        }

        setPagination(txData.pagination);

      } catch (err) {
        console.error(err);
        setError("Failed to load transactions");
      } finally {
        fetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [filter, pagination.limit, me, balance]
  );

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    setTransactions([]);
    fetchData(0);
  }, [filter]);

  /* ---------------- INFINITE SCROLL ---------------- */

  useEffect(() => {
    if (!inView) return;
    if (!pagination.has_more) return;
    if (loadingMore || loading) return;

    fetchData(pagination.offset + pagination.limit);
  }, [inView, pagination, loadingMore, loading, fetchData]);

  /* ---------------- FILTER ---------------- */

  const handleFilterChange = (value: string) => {
    if (value === filter) return;
    setFilter(value);
  };

  /* ---------------- AMOUNT ---------------- */

  const positiveTypes = [
    "deposit_confirmed",
    "win",
    "cashback_accrued",
    "referral_accrued",
    "promo_bonus",
    "daily_bonus"
  ];

  const getAmountColor = (type: string) =>
    positiveTypes.includes(type) ? "#10b981" : "#ef4444";

  const getAmountPrefix = (type: string) =>
    positiveTypes.includes(type) ? "+" : "";

  /* ---------------- LOADING ---------------- */

  if (loading && transactions.length === 0) {
    return (
      <div className="page">
        <TopBar />
        <BalancePill balanceTon={balance?.ton ?? "0"} />
        <ProfilePill username={me?.username ?? "user"} />
        <div className="h2">Transactions</div>
        <LoadingSpinner text="Loading transactions..." />
        <BottomNav />
      </div>
    );
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="page">
      <TopBar />
      <BalancePill balanceTon={balance?.ton ?? "0"} />
      <ProfilePill username={me?.username ?? "user"} />

      <div className="transactionsHeader">
        <div className="h2">Transactions</div>

        <div className="filterButtons">
          {["all", "deposit", "withdraw", "bet", "bonus"].map((f) => (
            <button
              key={f}
              className={`filterButton ${filter === f ? "active" : ""}`}
              onClick={() => handleFilterChange(f)}
            >
              {f === "all"
                ? "All"
                : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          onRetry={() => fetchData(0)}
        />
      )}

      <div className="transactionsList">
        {transactions.length === 0 ? (
          <div className="emptyState">
            <div className="emptyIcon">📭</div>
            <div className="emptyTitle">No transactions yet</div>
            <div className="emptyText">
              Your history will appear here
            </div>
          </div>
        ) : (
          <>
            {transactions.map((tx) => {
              const config = getTransactionConfig(tx.type);

              return (
                <div key={tx.id} className="transactionItem">
                  <div
                    className="transactionIcon"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    {config.icon}
                  </div>

                  <div className="transactionDetails">
                    <div className="transactionMain">
                      <span className="transactionType">
                        {config.label}
                      </span>

                      <span
                        className="transactionAmount"
                        style={{
                          color: getAmountColor(tx.type)
                        }}
                      >
                        {getAmountPrefix(tx.type)}
                        {tx.amount_ton} TON
                      </span>
                    </div>

                    <div className="transactionMeta">
                      {formatDate(tx.created_at)}

                      {tx.meta?.round_id &&
                        ` • Round #${tx.meta.round_id}`}
                      {tx.meta?.nftIndex &&
                        ` • NFT #${tx.meta.nftIndex}`}
                    </div>
                  </div>
                </div>
              );
            })}

            {pagination.has_more && (
              <div ref={loadMoreRef} className="loadMoreTrigger">
                {loadingMore && <LoadingSpinner size="small" />}
              </div>
            )}

            <div className="transactionsSummary">
              Showing {transactions.length} of {pagination.total}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}