import { requireUser } from "./me.js";
import { nanoToTon } from "../lib/ton.js";
import { getReferralNano } from "../db.js";

export function referralRoutes(fastify) {
  fastify.get("/referrals/stats", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      // Get all invited users in one query
      const invited = await fastify.db.all(
        "SELECT tg_id FROM users WHERE referrer_tg_id=?", 
        u.tg_id
      );
      const invitedIds = invited.map(x => x.tg_id);
      
      if (invitedIds.length === 0) {
        return {
          ok: true,
          invited: 0,
          active: 0,
          friends_stake_ton: "0",
          earned_ton: "0",
          available_ton: "0",
          referrals: []
        };
      }
      
      // Use IN clause with placeholders
      const placeholders = invitedIds.map(() => '?').join(',');
      
      // Get active users (those who have placed bets)
      const activeResult = await fastify.db.get(`
        SELECT COUNT(DISTINCT tg_id) as active
        FROM ledger 
        WHERE tg_id IN (${placeholders}) AND type='bet'
      `, ...invitedIds);
      
      // Get total earnings from referrals
      const earnedResult = await fastify.db.get(`
        SELECT COALESCE(SUM(CAST(amount_nano AS INTEGER)), 0) as total
        FROM ledger 
        WHERE tg_id=? AND type='referral_accrued'
      `, u.tg_id);
      
      // Get total stake from friends
      const stakeResult = await fastify.db.get(`
        SELECT COALESCE(SUM(CAST(amount_nano AS INTEGER)), 0) as total
        FROM ledger 
        WHERE tg_id IN (${placeholders}) AND type='bet'
      `, ...invitedIds);
      
      const available = await getReferralNano(fastify.db, u.tg_id);
      
      // Get detailed referral list with their stats
      const referrals = await fastify.db.all(`
        SELECT 
          u.tg_id,
          u.username,
          u.registered_at,
          COALESCE((
            SELECT COUNT(*) 
            FROM ledger 
            WHERE tg_id = u.tg_id AND type='bet'
          ), 0) as bet_count,
          COALESCE((
            SELECT SUM(CAST(amount_nano AS INTEGER)) 
            FROM ledger 
            WHERE tg_id = u.tg_id AND type='bet'
          ), 0) as total_bet_nano
        FROM users u
        WHERE u.referrer_tg_id = ?
        ORDER BY u.registered_at DESC
        LIMIT 100
      `, u.tg_id);
      
      return {
        ok: true,
        invited: invitedIds.length,
        active: activeResult?.active || 0,
        friends_stake_ton: nanoToTon(-(BigInt(stakeResult?.total || 0))),
        earned_ton: nanoToTon(BigInt(earnedResult?.total || 0)),
        available_ton: nanoToTon(available),
        referrals: referrals.map(r => ({
          tg_id: r.tg_id,
          username: r.username || `user${r.tg_id}`,
          registered_at: r.registered_at,
          bet_count: r.bet_count,
          total_bet_ton: nanoToTon(-BigInt(r.total_bet_nano))
        }))
      };
    } catch (error) {
      fastify.log.error("Referral stats error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });
  
  // Add endpoint to get referral leaderboard
  fastify.get("/referrals/leaderboard", async (req, reply) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      
      const rows = await fastify.db.all(`
        SELECT 
          u.tg_id,
          u.username,
          COUNT(r.tg_id) as referral_count,
          COALESCE((
            SELECT SUM(CAST(amount_nano AS INTEGER))
            FROM ledger
            WHERE tg_id = u.tg_id AND type='referral_accrued'
          ), 0) as earned_nano
        FROM users u
        LEFT JOIN users r ON r.referrer_tg_id = u.tg_id
        GROUP BY u.tg_id
        HAVING referral_count > 0
        ORDER BY earned_nano DESC
        LIMIT ?
      `, limit);
      
      return {
        ok: true,
        leaderboard: rows.map((r, index) => ({
          rank: index + 1,
          tg_id: r.tg_id,
          username: r.username || `user${r.tg_id}`,
          referral_count: r.referral_count,
          earned_ton: nanoToTon(BigInt(r.earned_nano))
        }))
      };
    } catch (error) {
      fastify.log.error("Referral leaderboard error:", error);
      return reply.code(500).send({ 
        ok: false, 
        reason: "internal_error" 
      });
    }
  });
}