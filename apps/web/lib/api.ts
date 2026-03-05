import { getInitData } from "./telegram";

// Types for API responses
export interface User {
  tg_id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  wallet_address?: string;
  referrer_tg_id?: number;
  registered_at: string;
  last_seen?: string;
  is_premium?: boolean;
  language_code?: string;
  photo_url?: string;
}

export interface Balance {
  ton: string;
  ton_nano: string;
  cashback_available_ton: string;
  cashback_nano: string;
  referral_available_ton: string;
  referral_nano: string;
  total_bonus_ton: string;
  total_nano: string;
}

export interface JackpotState {
  round_id: number;
  bank_ton: string;
  target_bank_ton: string;
  status: 'open' | 'resolving' | 'closed';
  participants: Array<{
    tg_id: number;
    username: string;
    amount_ton: string;
    chance_pct: string;
  }>;
  history: Array<{
    round_id: number;
    bank_ton: string;
    winner_username: string;
    winner_tg_id: number;
    winning_nft_index: number;
    created_at: string;
  }>;
}

export interface BetResponse {
  ok: boolean;
  round_id: number;
  bank_ton: string;
  participant_chance_pct: string;
  resolved?: boolean;
  winner_tg_id?: number;
  winning_nft_index?: number;
  server_seed_reveal?: string;
}

export interface Transaction {
  id: number;
  tg_id: number;
  type: string;
  amount_ton: string;
  created_at: string;
  meta: any | null;
}

export interface TransactionsResponse {
  ok: boolean;
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface DepositResponse {
  ok: boolean;
  deposit_id: number;
  amount_ton: string;
  treasury_address: string;
  comment: string;
  expires_at: string;
}

export interface WithdrawResponse {
  ok: boolean;
  withdrawal_id: number;
  amount_ton: string;
  wallet_address: string;
}

export interface DailyStatusResponse {
  ok: boolean;
  claimed: boolean;
  next_claim?: string;
}

export interface ClaimResponse {
  ok: boolean;
  amount_ton: string;
}

export interface PromoResponse {
  ok: boolean;
  amount_ton: string;
}

export interface ReferralStats {
  ok: boolean;
  invited: number;
  active: number;
  friends_stake_ton: string;
  earned_ton: string;
  available_ton: string;
  referrals: Array<{
    tg_id: number;
    username: string;
    registered_at: string;
    bet_count: number;
    total_bet_ton: string;
  }>;
}

export interface LeaderboardEntry {
  tg_id: number;
  username: string;
  volume_ton: string;
}

export interface Prize {
  place: number;
  title: string;
  type: 'gift' | 'ton';
  amount_ton?: string;
}

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const CACHE_TTL = 60000; // 1 minute

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

// Request queue to prevent duplicate requests
class RequestQueue {
  private queue = new Map<string, Promise<any>>();

  async enqueue<T>(key: string, request: () => Promise<T>): Promise<T> {
    const existing = this.queue.get(key);
    if (existing) return existing as Promise<T>;

    const promise = request().finally(() => {
      this.queue.delete(key);
    });
    
    this.queue.set(key, promise);
    return promise;
  }
}

// Request cancellation support
class AbortControllerManager {
  private controllers = new Map<string, AbortController>();

  create(key: string): AbortController {
    this.cancel(key); // Cancel any existing request
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller;
  }

  cancel(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  cancelAll(): void {
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }
}

// Main API client class
class APIClient {
  private cache = new APICache();
  private queue = new RequestQueue();
  private abortController = new AbortControllerManager();
  private requestCount = 0;
  private isRefreshing = false;

  private async request<T>(
    path: string,
    options: RequestInit = {},
    skipCache: boolean = false,
    retryCount: number = 0
  ): Promise<T> {
    // Generate cache key
    const cacheKey = `${options.method || 'GET'}:${path}:${JSON.stringify(options.body)}`;
    
    // Check cache for GET requests
    if (!skipCache && (!options.method || options.method === 'GET')) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    // Queue identical requests
    return this.queue.enqueue(cacheKey, async () => {
      try {
        // Get init data
        const initData = typeof window !== "undefined" ? getInitData() : "";
        
        // Setup abort controller
        const requestId = `${++this.requestCount}`;
        const controller = this.abortController.create(requestId);
        
        // Setup timeout
        const timeoutId = setTimeout(() => {
          this.abortController.cancel(requestId);
        }, REQUEST_TIMEOUT);

        // Prepare headers
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(options.headers || {})
        };
        
        if (initData) {
          headers["x-init-data"] = initData;
        }

        // Log request in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`🌐 API Request: ${options.method || 'GET'} ${path}`, options.body);
        }

        // Make request
        const res = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        this.abortController.cancel(requestId);

        // Parse response
        const data = await res.json().catch(() => ({}));

        // Handle error responses
        if (!res.ok) {
          // Handle rate limiting
          if (res.status === 429 && retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
            return this.request<T>(path, options, skipCache, retryCount + 1);
          }

          // Handle unauthorized - could trigger refresh
          if (res.status === 401) {
            // Could trigger auth refresh here
            console.warn('Unauthorized request to', path);
          }

          const error = new Error(data?.reason || `HTTP ${res.status}`) as any;
          error.status = res.status;
          error.data = data;
          throw error;
        }

        // Log response in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ API Response: ${options.method || 'GET'} ${path}`, data);
        }

        // Cache successful GET requests
        if (!options.method || options.method === 'GET') {
          this.cache.set(cacheKey, data);
        } else {
          // Invalidate related caches for mutations
          this.cache.invalidate(cacheKey);
          if (path.includes('/jackpot/bet')) {
            this.cache.invalidate('GET:/jackpot/state:{}');
          }
        }

        return data as T;
      } catch (error: any) {
        // Handle abort errors
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }

        // Handle network errors
        if (error.message === 'Failed to fetch') {
          throw new Error('Network error - please check your connection');
        }

        throw error;
      }
    });
  }

  // Public API methods with proper typing
  async me(): Promise<User> {
    return this.request<User>('/me');
  }

  async balance(): Promise<Balance> {
    return this.request<Balance>('/balance');
  }

  async jackpotState(skipCache: boolean = false): Promise<JackpotState> {
    return this.request<JackpotState>('/jackpot/state', {}, skipCache);
  }

  async bet(amount_ton: string): Promise<BetResponse> {
    return this.request<BetResponse>('/jackpot/bet', {
      method: "POST",
      body: JSON.stringify({ amount_ton })
    });
  }

  async transactions(offset: number = 0, limit: number = 20, type?: string): Promise<TransactionsResponse> {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString()
    });
    if (type) params.append('type', type);
    
    return this.request<TransactionsResponse>(`/transactions?${params}`);
  }

  async requirements(): Promise<{ required_channels: string[] }> {
    return this.request<{ required_channels: string[] }>('/requirements');
  }

  async depositCreate(amount_ton: string): Promise<DepositResponse> {
    return this.request<DepositResponse>('/deposits/create', {
      method: "POST",
      body: JSON.stringify({ amount_ton })
    });
  }

  async withdrawRequest(amount_ton: string): Promise<WithdrawResponse> {
    return this.request<WithdrawResponse>('/withdraw/request', {
      method: "POST",
      body: JSON.stringify({ amount_ton })
    });
  }

  async dailyStatus(): Promise<DailyStatusResponse> {
    return this.request<DailyStatusResponse>('/bonuses/status');
  }

  async dailyClaim(): Promise<ClaimResponse> {
    return this.request<ClaimResponse>('/bonuses/daily/claim', {
      method: "POST",
      body: "{}"
    });
  }

  async cashbackClaim(): Promise<ClaimResponse> {
    return this.request<ClaimResponse>('/bonuses/cashback/claim', {
      method: "POST",
      body: "{}"
    });
  }

  async referralClaim(): Promise<ClaimResponse> {
    return this.request<ClaimResponse>('/bonuses/referral/claim', {
      method: "POST",
      body: "{}"
    });
  }

  async promoActivate(code: string): Promise<PromoResponse> {
    return this.request<PromoResponse>('/promo/activate', {
      method: "POST",
      body: JSON.stringify({ code })
    });
  }

  async refStats(): Promise<ReferralStats> {
    return this.request<ReferralStats>('/referrals/stats');
  }

  async leaderboard(): Promise<{ ok: boolean; top: LeaderboardEntry[] }> {
    return this.request<{ ok: boolean; top: LeaderboardEntry[] }>('/leaderboard/top');
  }

  async prizes(): Promise<{ ok: boolean; prizes: Prize[] }> {
    return this.request<{ ok: boolean; prizes: Prize[] }>('/tournament/prizes');
  }

  // Utility methods
  clearCache(): void {
    this.cache.clear();
  }

  cancelAllRequests(): void {
    this.abortController.cancelAll();
  }

  // Prefetch common data
  async prefetchCommonData(): Promise<void> {
    await Promise.all([
      this.me().catch(() => null),
      this.balance().catch(() => null),
      this.jackpotState().catch(() => null)
    ]);
  }
}

// Export singleton instance
export const api = new APIClient();

// Also export individual methods for tree-shaking
export const {
  me,
  balance,
  jackpotState,
  bet,
  transactions,
  requirements,
  depositCreate,
  withdrawRequest,
  dailyStatus,
  dailyClaim,
  cashbackClaim,
  referralClaim,
  promoActivate,
  refStats,
  leaderboard,
  prizes
} = api;