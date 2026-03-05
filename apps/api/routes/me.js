import { verifyTelegramWebAppData } from "../lib/telegram.js";
import { getBalanceNano, getCashbackNano, getReferralNano, formatBalance } from "../db.js";

// Basic TON address validation
function isValidTonAddress(address) {
  return /^(EQ|UQ)[a-zA-Z0-9_-]{46,48}$/.test(address);
}

export async function requireUser(fastify, req) {
  const initData = String(req.headers["x-init-data"] || "");
  
  if (fastify.config.ALLOW_DEMO_AUTH === "1" && !initData) {
    return { 
      tg_id: 1, 
      username: "demo",
      is_demo: true 
    };
  }

  const v = verifyTelegramWebAppData(initData, fastify.config.BOT_TOKEN);
  if (!v.ok || !v.user?.id) {
    throw new Error(`UNAUTH: ${v.reason || "invalid_auth"}`);
  }
  
  return { 
    tg_id: v.user.id, 
    username: v.user.username || v.user.first_name || "user",
    first_name: v.user.first_name,
    last_name: v.user.last_name,
    language_code: v.user.language_code,
    is_premium: v.user.is_premium || false,
    photo_url: v.user.photo_url
  };
}

export function meRoutes(fastify) {
  fastify.get("/me", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      // Use transaction for user creation/update
      const user = await fastify.db.transaction(async () => {
        let row = await fastify.db.get(
          "SELECT * FROM users WHERE tg_id=?", 
          u.tg_id
        );
        
        if (!row) {
          // New user
          const now = new Date().toISOString();
          await fastify.db.run(
            `INSERT INTO users(
              tg_id, username, first_name, last_name, 
              language_code, is_premium, photo_url, registered_at
            ) VALUES(?,?,?,?,?,?,?,?)`,
            u.tg_id, 
            u.username,
            u.first_name || null,
            u.last_name || null,
            u.language_code || null,
            u.is_premium ? 1 : 0,
            u.photo_url || null,
            now
          );
          
          row = await fastify.db.get(
            "SELECT * FROM users WHERE tg_id=?", 
            u.tg_id
          );
        } else {
          // Update existing user info
          await fastify.db.run(
            `UPDATE users 
             SET username = ?, 
                 first_name = ?,
                 last_name = ?,
                 language_code = ?,
                 is_premium = ?,
                 photo_url = ?,
                 last_seen = ?
             WHERE tg_id = ?`,
            u.username,
            u.first_name || null,
            u.last_name || null,
            u.language_code || null,
            u.is_premium ? 1 : 0,
            u.photo_url || null,
            new Date().toISOString(),
            u.tg_id
          );
        }
        
        return row;
      });

      return {
        ok: true,
        user: {
          tg_id: user.tg_id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          registered_at: user.registered_at,
          last_seen: user.last_seen,
          wallet_address: user.wallet_address || null,
          referrer_tg_id: user.referrer_tg_id || null,
          is_premium: Boolean(user.is_premium),
          language_code: user.language_code,
          photo_url: user.photo_url
        }
      };
    } catch (error) {
      fastify.log.error("Me endpoint error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: error.message === "UNAUTH" ? "unauthorized" : "internal_error" 
      });
    }
  });

  fastify.get("/balance", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      const [bal, cb, rf] = await Promise.all([
        getBalanceNano(fastify.db, u.tg_id),
        getCashbackNano(fastify.db, u.tg_id),
        getReferralNano(fastify.db, u.tg_id)
      ]);
      
      const formatted = formatBalance(bal, cb, rf);
      
      return {
        ok: true,
        ...formatted,
        // Also return raw nano values for precision
        raw: {
          balance_nano: bal.toString(),
          cashback_nano: cb.toString(),
          referral_nano: rf.toString()
        }
      };
    } catch (error) {
      fastify.log.error("Balance fetch error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  fastify.post("/wallet/set", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      const address = String(req.body?.address || "").trim();
      
      if (!address) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "missing_address" 
        });
      }
      
      if (!isValidTonAddress(address)) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "invalid_address" 
        });
      }
      
      // Check if address is already used by another user
      const existing = await fastify.db.get(
        "SELECT tg_id FROM users WHERE wallet_address = ? AND tg_id != ?",
        address, u.tg_id
      );
      
      if (existing) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "address_already_used" 
        });
      }
      
      await fastify.db.run(
        "UPDATE users SET wallet_address = ?, wallet_updated_at = ? WHERE tg_id = ?",
        address, 
        new Date().toISOString(), 
        u.tg_id
      );
      
      return { 
        ok: true,
        address
      };
    } catch (error) {
      fastify.log.error("Wallet set error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  fastify.get("/profile/stats", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      // Get various stats in parallel
      const [betStats, winStats, referralCount] = await Promise.all([
        fastify.db.get(
          `SELECT 
            COUNT(*) as total_bets,
            COALESCE(SUM(CAST(amount_nano AS INTEGER)), 0) as total_bet_amount
           FROM ledger 
           WHERE tg_id = ? AND type = 'bet'`,
          u.tg_id
        ),
        fastify.db.get(
          `SELECT 
            COUNT(*) as total_wins,
            COALESCE(SUM(CAST(amount_nano AS INTEGER)), 0) as total_win_amount
           FROM ledger 
           WHERE tg_id = ? AND type = 'win'`,
          u.tg_id
        ),
        fastify.db.get(
          "SELECT COUNT(*) as count FROM users WHERE referrer_tg_id = ?",
          u.tg_id
        )
      ]);
      
      return {
        ok: true,
        stats: {
          total_bets: betStats?.total_bets || 0,
          total_bet_ton: nanoToTon(-(BigInt(betStats?.total_bet_amount || 0))),
          total_wins: winStats?.total_wins || 0,
          total_win_ton: nanoToTon(BigInt(winStats?.total_win_amount || 0)),
          total_referrals: referralCount?.count || 0,
          win_rate: betStats?.total_bets ? 
            ((winStats?.total_wins || 0) / betStats.total_bets * 100).toFixed(2) : 
            "0"
        }
      };
    } catch (error) {
      fastify.log.error("Profile stats error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });
}