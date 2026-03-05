import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { nanoToTon } from "./lib/ton.js";

export async function openDb() {
  const db = await open({ 
    filename: "./data.sqlite", 
    driver: sqlite3.Database 
  });
  
  // Enable foreign keys and WAL mode for better concurrency
  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 30000000000;
    PRAGMA page_size = 4096;
  `);

  // Create tables with proper constraints and indexes
  await db.exec(`

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    tg_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT,
    is_premium BOOLEAN DEFAULT 0,
    photo_url TEXT,
    wallet_address TEXT UNIQUE,
    wallet_updated_at TEXT,
    referrer_tg_id INTEGER REFERENCES users(tg_id) ON DELETE SET NULL,
    registered_at TEXT NOT NULL,
    last_seen TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_tg_id);
  CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);

  -- Ledger table (all transactions)
  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount_nano TEXT NOT NULL,
    created_at TEXT NOT NULL,
    meta_json TEXT,
    CHECK (type IN (
      'deposit_pending', 'deposit_confirmed', 'deposit_expired', 'deposit_cancelled',
      'withdraw_requested', 'withdraw_paid', 'withdraw_rejected',
      'bet', 'win',
      'cashback_accrued', 'referral_accrued',
      'promo_bonus', 'daily_bonus'
    ))
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_tg_id ON ledger(tg_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type);
  CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger(created_at);
  CREATE INDEX IF NOT EXISTS idx_ledger_tg_type ON ledger(tg_id, type);
  CREATE INDEX IF NOT EXISTS idx_ledger_tg_created ON ledger(tg_id, created_at);

  -- Deposits
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    amount_nano TEXT NOT NULL,
    status TEXT NOT NULL,
    comment TEXT UNIQUE,
    tx_hash TEXT UNIQUE,
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    expires_at TEXT NOT NULL,
    CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled'))
  );

  CREATE INDEX IF NOT EXISTS idx_deposits_tg_id ON deposits(tg_id);
  CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
  CREATE INDEX IF NOT EXISTS idx_deposits_comment ON deposits(comment);
  CREATE INDEX IF NOT EXISTS idx_deposits_tx_hash ON deposits(tx_hash);
  CREATE INDEX IF NOT EXISTS idx_deposits_created ON deposits(created_at);

  -- Withdrawals
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    amount_nano TEXT NOT NULL,
    status TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    tx_hash TEXT UNIQUE,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    processed_by INTEGER REFERENCES users(tg_id),
    notes TEXT,
    CHECK (status IN ('requested', 'processing', 'paid', 'rejected'))
  );

  CREATE INDEX IF NOT EXISTS idx_withdrawals_tg_id ON withdrawals(tg_id);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at);

  -- Rounds (Jackpot)
  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    target_bank_nano TEXT NOT NULL,
    bank_nano TEXT NOT NULL DEFAULT '0',
    server_commit TEXT NOT NULL,
    server_seed TEXT,
    winner_tg_id INTEGER REFERENCES users(tg_id),
    winning_nft_index INTEGER,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    resolved_at TEXT,
    CHECK (status IN ('open', 'resolving', 'closed'))
  );

  CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
  CREATE INDEX IF NOT EXISTS idx_rounds_created ON rounds(created_at);

  -- Round entries
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    tg_id INTEGER NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    amount_nano TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(round_id, tg_id, created_at)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_round ON entries(round_id);
  CREATE INDEX IF NOT EXISTS idx_entries_tg_id ON entries(tg_id);
  CREATE INDEX IF NOT EXISTS idx_entries_round_tg ON entries(round_id, tg_id);

  -- Round history
  CREATE TABLE IF NOT EXISTS round_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
    bank_nano TEXT NOT NULL,
    winner_tg_id INTEGER NOT NULL REFERENCES users(tg_id),
    winning_nft_index INTEGER NOT NULL,
    server_commit TEXT NOT NULL,
    server_seed_reveal TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Cashback
  CREATE TABLE IF NOT EXISTS cashback (
    tg_id INTEGER PRIMARY KEY REFERENCES users(tg_id) ON DELETE CASCADE,
    available_nano TEXT NOT NULL DEFAULT '0',
    total_earned_nano TEXT NOT NULL DEFAULT '0',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Referral earnings
  CREATE TABLE IF NOT EXISTS referral_earnings (
    tg_id INTEGER PRIMARY KEY REFERENCES users(tg_id) ON DELETE CASCADE,
    available_nano TEXT NOT NULL DEFAULT '0',
    total_earned_nano TEXT NOT NULL DEFAULT '0',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Promo codes
  CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    amount_nano TEXT NOT NULL,
    max_uses INTEGER NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    created_by INTEGER REFERENCES users(tg_id),
    CHECK (uses <= max_uses)
  );

  CREATE INDEX IF NOT EXISTS idx_promo_expires ON promo_codes(expires_at);

  -- Promo activations
  CREATE TABLE IF NOT EXISTS promo_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
    tg_id INTEGER NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(code, tg_id)
  );

  CREATE INDEX IF NOT EXISTS idx_promo_activations_tg ON promo_activations(tg_id);

  -- Settings
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  `);

  // Initialize default settings
  const defaultSettings = [
    ['required_channels', JSON.stringify([])],
    ['daily_bonus_pool', JSON.stringify(['0.05', '0.10', '0.05', '0.05'])],
    ['min_bet_amount', JSON.stringify('0.01')],
    ['max_bet_amount', JSON.stringify('10')],
    ['maintenance_mode', JSON.stringify(false)]
  ];

  for (const [key, value] of defaultSettings) {
    await db.run(
      `INSERT OR IGNORE INTO settings(key, value_json) VALUES(?, ?)`,
      key, value
    );
  }

  return db;
}

// Helper function for transactions
export async function withTransaction(db, callback) {
  const savepoint = `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await db.run(`SAVEPOINT ${savepoint}`);
    const result = await callback(db);
    await db.run(`RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    await db.run(`ROLLBACK TO ${savepoint}`);
    throw error;
  }
}

// Ledger operations with validation
export async function ledgerAdd(db, tgId, type, amountNano, meta = null) {
  // Validate amount format
  try {
    BigInt(String(amountNano));
  } catch {
    throw new Error(`Invalid amount format: ${amountNano}`);
  }

  // Validate type
  const validTypes = [
    'deposit_pending', 'deposit_confirmed', 'deposit_expired', 'deposit_cancelled',
    'withdraw_requested', 'withdraw_paid', 'withdraw_rejected',
    'bet', 'win',
    'cashback_accrued', 'referral_accrued',
    'promo_bonus', 'daily_bonus'
  ];
  
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid ledger type: ${type}`);
  }

  await db.run(
    `INSERT INTO ledger(
      tg_id, type, amount_nano, created_at, meta_json
    ) VALUES(?, ?, ?, ?, ?)`,
    tgId, 
    type, 
    String(amountNano), 
    new Date().toISOString(), 
    meta ? JSON.stringify(meta) : null
  );
}

// Optimized balance calculation
export async function getBalanceNano(db, tgId) {
  const result = await db.get(`
    SELECT COALESCE(SUM(CAST(amount_nano AS INTEGER)), 0) as balance
    FROM ledger 
    WHERE tg_id = ? AND type IN (
      'deposit_confirmed', 'win', 'bet', 'withdraw_requested',
      'withdraw_rejected', 'promo_bonus', 'daily_bonus'
    )
  `, tgId);
  
  return BigInt(result.balance);
}

// Cashback operations
export async function getCashbackNano(db, tgId) {
  const row = await db.get(
    "SELECT available_nano FROM cashback WHERE tg_id = ?", 
    tgId
  );
  return row ? BigInt(row.available_nano) : 0n;
}

export async function addCashbackNano(db, tgId, deltaNano) {
  return withTransaction(db, async (db) => {
    const current = await getCashbackNano(db, tgId);
    const next = current + BigInt(deltaNano);
    
    await db.run(
      `INSERT INTO cashback(tg_id, available_nano, total_earned_nano, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(tg_id) DO UPDATE SET
         available_nano = excluded.available_nano,
         total_earned_nano = total_earned_nano + ?,
         updated_at = excluded.updated_at`,
      tgId, 
      next.toString(), 
      (current === 0n ? next : current + next).toString(),
      new Date().toISOString(),
      deltaNano.toString()
    );
    
    return next;
  });
}

// Referral operations
export async function getReferralNano(db, tgId) {
  const row = await db.get(
    "SELECT available_nano FROM referral_earnings WHERE tg_id = ?", 
    tgId
  );
  return row ? BigInt(row.available_nano) : 0n;
}

export async function addReferralNano(db, tgId, deltaNano) {
  return withTransaction(db, async (db) => {
    const current = await getReferralNano(db, tgId);
    const next = current + BigInt(deltaNano);
    
    await db.run(
      `INSERT INTO referral_earnings(tg_id, available_nano, total_earned_nano, updated_at)
       VALUES(?, ?, ?, ?)
       ON CONFLICT(tg_id) DO UPDATE SET
         available_nano = excluded.available_nano,
         total_earned_nano = total_earned_nano + ?,
         updated_at = excluded.updated_at`,
      tgId, 
      next.toString(), 
      (current === 0n ? next : current + next).toString(),
      new Date().toISOString(),
      deltaNano.toString()
    );
    
    return next;
  });
}

// Claim functions
export async function claimCashback(db, tgId) {
  return withTransaction(db, async (db) => {
    const available = await getCashbackNano(db, tgId);
    if (available <= 0n) return 0n;
    
    await db.run(
      "UPDATE cashback SET available_nano = '0', updated_at = ? WHERE tg_id = ?",
      new Date().toISOString(), tgId
    );
    
    await ledgerAdd(db, tgId, "cashback_claimed", available.toString(), {
      source: "cashback_claim"
    });
    
    return available;
  });
}

export async function claimReferral(db, tgId) {
  return withTransaction(db, async (db) => {
    const available = await getReferralNano(db, tgId);
    if (available <= 0n) return 0n;
    
    await db.run(
      "UPDATE referral_earnings SET available_nano = '0', updated_at = ? WHERE tg_id = ?",
      new Date().toISOString(), tgId
    );
    
    await ledgerAdd(db, tgId, "referral_claimed", available.toString(), {
      source: "referral_claim"
    });
    
    return available;
  });
}

export function formatBalance(balanceNano, cashbackNano, referralNano) {
  return {
    ton: nanoToTon(balanceNano),
    ton_nano: balanceNano.toString(),
    cashback_available_ton: nanoToTon(cashbackNano),
    cashback_nano: cashbackNano.toString(),
    referral_available_ton: nanoToTon(referralNano),
    referral_nano: referralNano.toString(),
    total_bonus_ton: nanoToTon(cashbackNano + referralNano),
    total_nano: (balanceNano + cashbackNano + referralNano).toString()
  };
}