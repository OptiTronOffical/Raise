import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd } from "../db.js";

function isAdmin(fastify, tgId) {
  const admins = String(fastify.config.ADMIN_TG_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return admins.includes(String(tgId));
}

export function promoRoutes(fastify) {
  fastify.post("/promo/activate", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      const code = String(req.body?.code || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''); // Sanitize
      
      if (!code || code.length < 3) {
        return reply.code(400).send({ 
          ok: false, 
          reason: "invalid_code" 
        });
      }

      // Use transaction to ensure consistency
      const result = await fastify.db.transaction(async () => {
        const promo = await fastify.db.get(
          "SELECT * FROM promo_codes WHERE code=?", 
          code
        );
        
        if (!promo) {
          throw { status: 404, reason: "not_found" };
        }
        
        // Check expiration
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
          throw { status: 400, reason: "expired" };
        }
        
        if (promo.uses >= promo.max_uses) {
          throw { status: 400, reason: "exhausted" };
        }

        const already = await fastify.db.get(
          "SELECT * FROM promo_activations WHERE code=? AND tg_id=?", 
          code, u.tg_id
        );
        
        if (already) {
          throw { status: 400, reason: "already_used" };
        }

        await fastify.db.run(
          "INSERT INTO promo_activations(code, tg_id, created_at) VALUES(?,?,?)",
          code, u.tg_id, new Date().toISOString()
        );
        
        await fastify.db.run(
          "UPDATE promo_codes SET uses=uses+1 WHERE code=?", 
          code
        );

        await ledgerAdd(
          fastify.db, 
          u.tg_id, 
          "deposit_confirmed", 
          promo.amount_nano, 
          { source: "promo", code }
        );
        
        return promo;
      });

      return { 
        ok: true, 
        amount_ton: nanoToTon(result.amount_nano) 
      };
      
    } catch (error) {
      if (error.status) {
        return reply.code(error.status).send({ 
          ok: false, 
          reason: error.reason 
        });
      }
      fastify.log.error("Promo activation error:", error);
      return reply.code(401).send({ 
        ok: false, 
        reason: "unauthorized" 
      });
    }
  });

  // Admin routes with authentication hook
  fastify.register(async function adminPromoRoutes(instance) {
    instance.addHook('preHandler', async (req, reply) => {
      const adminId = Number(req.headers["x-admin-tg-id"] || 0);
      if (!isAdmin(fastify, adminId)) {
        return reply.code(403).send({ 
          ok: false, 
          reason: "forbidden" 
        });
      }
    });

    instance.post("/admin/promo/create", async (req, reply) => {
      try {
        const code = String(req.body?.code || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
        
        const amountTon = String(req.body?.amount_ton || "").trim();
        const maxUses = Number(req.body?.max_uses || 100);
        const expiresInDays = Number(req.body?.expires_in_days) || null;
        
        if (!code || !amountTon) {
          return reply.code(400).send({ 
            ok: false, 
            reason: "missing_fields" 
          });
        }
        
        if (code.length < 3 || code.length > 20) {
          return reply.code(400).send({ 
            ok: false, 
            reason: "invalid_code_length" 
          });
        }

        const nano = tonToNano(amountTon);
        if (nano <= 0n) {
          return reply.code(400).send({ 
            ok: false, 
            reason: "invalid_amount" 
          });
        }

        // Calculate expiration date
        let expires_at = null;
        if (expiresInDays > 0) {
          const date = new Date();
          date.setDate(date.getDate() + expiresInDays);
          expires_at = date.toISOString();
        }

        await fastify.db.run(
          `INSERT OR REPLACE INTO promo_codes(
            code, amount_nano, max_uses, uses, created_at, expires_at
          ) VALUES(?,?,?,?,?,?)`,
          code, nano.toString(), maxUses, 0, new Date().toISOString(), expires_at
        );
        
        return { 
          ok: true,
          promo: {
            code,
            amount_ton: nanoToTon(nano),
            max_uses,
            expires_at
          }
        };
      } catch (error) {
        fastify.log.error("Promo creation error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.get("/admin/promo/list", async (req, reply) => {
      try {
        const rows = await fastify.db.all(`
          SELECT 
            code, 
            amount_nano, 
            max_uses, 
            uses, 
            created_at, 
            expires_at,
            (SELECT COUNT(*) FROM promo_activations WHERE code = p.code) as activations
          FROM promo_codes p
          ORDER BY created_at DESC
          LIMIT 100
        `);
        
        return {
          ok: true,
          promos: rows.map(p => ({
            code: p.code,
            amount_ton: nanoToTon(p.amount_nano),
            max_uses: p.max_uses,
            uses: p.uses,
            activations: p.activations,
            created_at: p.created_at,
            expires_at: p.expires_at,
            is_active: (!p.expires_at || new Date(p.expires_at) > new Date()) && p.uses < p.max_uses
          }))
        };
      } catch (error) {
        fastify.log.error("Promo list error:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });
  }, { prefix: '/admin' });
}