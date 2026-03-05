import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd, getBalanceNano } from "../db.js";
import { checkRequiredChannels } from "../lib/subscription.js";

function isAdmin(fastify, tgId) {
  const admins = String(fastify.config.ADMIN_TG_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return admins.includes(String(tgId));
}

// Basic TON address validation (can be improved)
function isValidTonAddress(address) {
  return /^(EQ|UQ)[a-zA-Z0-9_-]{46,48}$/.test(address);
}

export function paymentRoutes(fastify) {
  // User endpoints
  fastify.post("/deposits/create", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      const amountTon = String(req.body?.amount_ton || "").trim();
      let amountNano;
      
      try {
        amountNano = tonToNano(amountTon);
      } catch {
        return reply.code(400).send({ 
          ok: false, 
          reason: "invalid_amount" 
        });
      }
      
      // Validate minimum deposit
      const minDepositNano = tonToNano(fastify.config.MIN_DEPOSIT_TON || "0.1");
      if (amountNano < minDepositNano) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "min_deposit",
          min_ton: nanoToTon(minDepositNano)
        });
      }
      
      // Validate maximum deposit
      const maxDepositNano = tonToNano(fastify.config.MAX_DEPOSIT_TON || "1000");
      if (amountNano > maxDepositNano) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "max_deposit",
          max_ton: nanoToTon(maxDepositNano)
        });
      }

      const comment = `DEP-${u.tg_id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date().toISOString();
      
      const result = await fastify.db.run(
        `INSERT INTO deposits(
          tg_id, amount_nano, status, created_at, comment, expires_at
        ) VALUES(?,?,?,?,?,?)`,
        u.tg_id, 
        amountNano.toString(), 
        "pending", 
        now, 
        comment,
        new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
      );
      
      await ledgerAdd(
        fastify.db, 
        u.tg_id, 
        "deposit_pending", 
        amountNano.toString(), 
        { deposit_id: result.lastID, comment }
      );
      
      return { 
        ok: true, 
        deposit_id: result.lastID, 
        amount_ton: nanoToTon(amountNano), 
        treasury_address: fastify.config.TREASURY_ADDRESS || "", 
        comment,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    } catch (error) {
      fastify.log.error("Deposit creation error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  fastify.get("/deposits/history", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const status = req.query.status; // Optional filter
      
      let query = "SELECT * FROM deposits WHERE tg_id=?";
      const params = [u.tg_id];
      
      if (status && ['pending', 'confirmed', 'expired'].includes(status)) {
        query += " AND status=?";
        params.push(status);
      }
      
      query += " ORDER BY id DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
      
      const rows = await fastify.db.all(query, ...params);
      
      // Get total count
      let countQuery = "SELECT COUNT(*) as total FROM deposits WHERE tg_id=?";
      const countParams = [u.tg_id];
      
      if (status && ['pending', 'confirmed', 'expired'].includes(status)) {
        countQuery += " AND status=?";
        countParams.push(status);
      }
      
      const { total } = await fastify.db.get(countQuery, ...countParams);
      
      return {
        ok: true,
        deposits: rows.map(d => ({
          id: d.id,
          amount_ton: nanoToTon(d.amount_nano),
          status: d.status,
          comment: d.comment,
          created_at: d.created_at,
          confirmed_at: d.confirmed_at,
          expires_at: d.expires_at
        })),
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + rows.length < total
        }
      };
    } catch (error) {
      fastify.log.error("Deposit history error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  fastify.post("/withdraw/request", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      // Validate wallet address exists
      const user = await fastify.db.get(
        "SELECT wallet_address FROM users WHERE tg_id=?", 
        u.tg_id
      );
      
      if (!user?.wallet_address) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "wallet_not_set" 
        });
      }
      
      if (!isValidTonAddress(user.wallet_address)) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "invalid_wallet_address" 
        });
      }
      
      const amountTon = String(req.body?.amount_ton || "").trim();
      let amountNano;
      
      try {
        amountNano = tonToNano(amountTon);
      } catch {
        return reply.code(400).send({ 
          ok: false, 
          reason: "invalid_amount" 
        });
      }

      const minNano = tonToNano(fastify.config.MIN_WITHDRAW_TON || "1");
      if (amountNano < minNano) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "min_withdraw", 
          min_ton: nanoToTon(minNano) 
        });
      }

      const maxNano = tonToNano(fastify.config.MAX_WITHDRAW_TON || "1000");
      if (amountNano > maxNano) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "max_withdraw", 
          max_ton: nanoToTon(maxNano) 
        });
      }

      // Check channel subscription
      const s = await fastify.db.get(
        "SELECT value_json FROM settings WHERE key='required_channels'"
      );
      const channels = s ? JSON.parse(s.value_json) : [];
      const gate = await checkRequiredChannels({
        botToken: fastify.config.BOT_TOKEN,
        tgId: u.tg_id,
        channels,
        skip: fastify.config.SKIP_SUB_CHECK === "1"
      });
      
      if (!gate.ok) {
        return reply.code(403).send({ 
          ok: false, 
          reason: "subscribe_required", 
          missing: gate.missing 
        });
      }

      // Check for pending withdrawals
      const pending = await fastify.db.get(
        "SELECT COUNT(*) as count FROM withdrawals WHERE tg_id=? AND status='requested'",
        u.tg_id
      );
      
      if (pending.count > 0) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "pending_withdrawal_exists" 
        });
      }

      // Use transaction for withdrawal
      const result = await fastify.db.transaction(async () => {
        const bal = await getBalanceNano(fastify.db, u.tg_id);
        if (bal < amountNano) {
          throw { status: 400, reason: "insufficient_balance" };
        }

        const now = new Date().toISOString();
        const r = await fastify.db.run(
          `INSERT INTO withdrawals(
            tg_id, amount_nano, status, created_at, wallet_address
          ) VALUES(?,?,?,?,?)`,
          u.tg_id, 
          amountNano.toString(), 
          "requested", 
          now,
          user.wallet_address
        );
        
        await ledgerAdd(
          fastify.db, 
          u.tg_id, 
          "withdraw_requested", 
          (-amountNano).toString(), 
          { withdrawal_id: r.lastID }
        );

        return { id: r.lastID };
      });

      return { 
        ok: true, 
        withdrawal_id: result.id, 
        amount_ton: nanoToTon(amountNano),
        wallet_address: user.wallet_address
      };
      
    } catch (error) {
      if (error.status) {
        return reply.code(error.status).send({ 
          ok: false, 
          reason: error.reason 
        });
      }
      fastify.log.error("Withdrawal request error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  fastify.get("/withdrawals/history", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      
      const rows = await fastify.db.all(
        `SELECT * FROM withdrawals 
         WHERE tg_id=? 
         ORDER BY id DESC 
         LIMIT ? OFFSET ?`,
        u.tg_id, limit, offset
      );
      
      const { total } = await fastify.db.get(
        "SELECT COUNT(*) as total FROM withdrawals WHERE tg_id=?",
        u.tg_id
      );
      
      return {
        ok: true,
        withdrawals: rows.map(w => ({
          id: w.id,
          amount_ton: nanoToTon(w.amount_nano),
          status: w.status,
          wallet_address: w.wallet_address,
          tx_hash: w.tx_hash,
          created_at: w.created_at,
          paid_at: w.paid_at
        })),
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + rows.length < total
        }
      };
    } catch (error) {
      fastify.log.error("Withdrawal history error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  // Admin endpoints
  fastify.register(async function adminPaymentRoutes(instance) {
    instance.addHook('preHandler', async (req, reply) => {
      const adminId = Number(req.headers["x-admin-tg-id"] || 0);
      if (!isAdmin(fastify, adminId)) {
        return reply.code(403).send({ 
          ok: false, 
          reason: "forbidden" 
        });
      }
    });

    instance.post("/admin/deposits/:id/confirm", async (req, reply) => {
      try {
        const id = Number(req.params.id);
        
        const result = await fastify.db.transaction(async () => {
          const dep = await fastify.db.get(
            "SELECT * FROM deposits WHERE id=?", 
            id
          );
          
          if (!dep) {
            throw { status: 404, reason: "not_found" };
          }
          
          if (dep.status === "confirmed") {
            return { already: true };
          }
          
          if (dep.status === "expired") {
            throw { status: 400, reason: "deposit_expired" };
          }

          await fastify.db.run(
            `UPDATE deposits 
             SET status='confirmed', confirmed_at=? 
             WHERE id=?`,
            new Date().toISOString(), 
            id
          );
          
          await ledgerAdd(
            fastify.db, 
            dep.tg_id, 
            "deposit_confirmed", 
            dep.amount_nano, 
            { deposit_id: id }
          );
          
          return { already: false };
        });

        return { 
          ok: true, 
          ...result 
        };
        
      } catch (error) {
        if (error.status) {
          return reply.code(error.status).send({ 
            ok: false, 
            reason: error.reason 
          });
        }
        fastify.log.error("Deposit confirmation error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.post("/admin/deposits/:id/cancel", async (req, reply) => {
      try {
        const id = Number(req.params.id);
        const reason = String(req.body?.reason || "").trim();
        
        const dep = await fastify.db.get(
          "SELECT * FROM deposits WHERE id=?", 
          id
        );
        
        if (!dep) {
          return reply.code(404).send({ 
            ok: false, 
            reason: "not_found" 
          });
        }
        
        if (dep.status !== "pending") {
          return reply.code(400).send({ 
            ok: false, 
            reason: "cannot_cancel" 
          });
        }

        await fastify.db.run(
          `UPDATE deposits 
           SET status='cancelled' 
           WHERE id=?`,
          id
        );
        
        return { ok: true };
        
      } catch (error) {
        fastify.log.error("Deposit cancellation error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.post("/admin/withdrawals/:id/pay", async (req, reply) => {
      try {
        const id = Number(req.params.id);
        const tx = String(req.body?.tx_hash || "").trim() || null;
        
        const result = await fastify.db.transaction(async () => {
          const wd = await fastify.db.get(
            "SELECT * FROM withdrawals WHERE id=?", 
            id
          );
          
          if (!wd) {
            throw { status: 404, reason: "not_found" };
          }
          
          if (wd.status === "paid") {
            return { already: true };
          }
          
          if (wd.status !== "requested") {
            throw { status: 400, reason: "invalid_status" };
          }

          await fastify.db.run(
            `UPDATE withdrawals 
             SET status='paid', paid_at=?, tx_hash=? 
             WHERE id=?`,
            new Date().toISOString(), 
            tx, 
            id
          );
          
          await ledgerAdd(
            fastify.db, 
            wd.tg_id, 
            "withdraw_paid", 
            "0", 
            { withdrawal_id: id, tx_hash: tx }
          );
          
          return { already: false };
        });

        return { 
          ok: true, 
          ...result 
        };
        
      } catch (error) {
        if (error.status) {
          return reply.code(error.status).send({ 
            ok: false, 
            reason: error.reason 
          });
        }
        fastify.log.error("Withdrawal payment error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.post("/admin/withdrawals/:id/reject", async (req, reply) => {
      try {
        const id = Number(req.params.id);
        const reason = String(req.body?.reason || "").trim();
        
        const result = await fastify.db.transaction(async () => {
          const wd = await fastify.db.get(
            "SELECT * FROM withdrawals WHERE id=?", 
            id
          );
          
          if (!wd) {
            throw { status: 404, reason: "not_found" };
          }
          
          if (wd.status !== "requested") {
            throw { status: 400, reason: "invalid_status" };
          }

          await fastify.db.run(
            `UPDATE withdrawals 
             SET status='rejected' 
             WHERE id=?`,
            id
          );
          
          // Refund the amount
          await ledgerAdd(
            fastify.db, 
            wd.tg_id, 
            "withdraw_rejected", 
            wd.amount_nano, 
            { withdrawal_id: id, reason }
          );
          
          return { success: true };
        });

        return { ok: true };
        
      } catch (error) {
        if (error.status) {
          return reply.code(error.status).send({ 
            ok: false, 
            reason: error.reason 
          });
        }
        fastify.log.error("Withdrawal rejection error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.get("/admin/deposits/pending", async (req, reply) => {
      try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        
        const rows = await fastify.db.all(
          `SELECT d.*, u.username 
           FROM deposits d
           JOIN users u ON u.tg_id = d.tg_id
           WHERE d.status = 'pending'
           ORDER BY d.created_at ASC
           LIMIT ? OFFSET ?`,
          limit, offset
        );
        
        const { total } = await fastify.db.get(
          "SELECT COUNT(*) as total FROM deposits WHERE status='pending'"
        );
        
        return {
          ok: true,
          deposits: rows.map(d => ({
            id: d.id,
            tg_id: d.tg_id,
            username: d.username,
            amount_ton: nanoToTon(d.amount_nano),
            comment: d.comment,
            created_at: d.created_at,
            expires_at: d.expires_at
          })),
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + rows.length < total
          }
        };
      } catch (error) {
        fastify.log.error("Pending deposits fetch error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.get("/admin/withdrawals/requested", async (req, reply) => {
      try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        
        const rows = await fastify.db.all(
          `SELECT w.*, u.username, u.wallet_address 
           FROM withdrawals w
           JOIN users u ON u.tg_id = w.tg_id
           WHERE w.status = 'requested'
           ORDER BY w.created_at ASC
           LIMIT ? OFFSET ?`,
          limit, offset
        );
        
        const { total } = await fastify.db.get(
          "SELECT COUNT(*) as total FROM withdrawals WHERE status='requested'"
        );
        
        return {
          ok: true,
          withdrawals: rows.map(w => ({
            id: w.id,
            tg_id: w.tg_id,
            username: w.username,
            amount_ton: nanoToTon(w.amount_nano),
            wallet_address: w.wallet_address,
            created_at: w.created_at
          })),
          pagination: {
            total,
            limit,
            offset,
            has_more: offset + rows.length < total
          }
        };
      } catch (error) {
        fastify.log.error("Requested withdrawals fetch error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });
  }, { prefix: '/admin' });
}