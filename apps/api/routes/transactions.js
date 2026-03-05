import { requireUser } from "./me.js";
import { nanoToTon } from "../lib/ton.js";

export function txRoutes(fastify) {
  fastify.get("/transactions", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      
      // Add pagination
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const type = req.query.type; // Optional type filter
      
      let query = "SELECT * FROM ledger WHERE tg_id=?";
      const params = [u.tg_id];
      
      if (type) {
        query += " AND type=?";
        params.push(type);
      }
      
      query += " ORDER BY id DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
      
      const rows = await fastify.db.all(query, ...params);
      
      // Also get total count for pagination
      let countQuery = "SELECT COUNT(*) as total FROM ledger WHERE tg_id=?";
      const countParams = [u.tg_id];
      
      if (type) {
        countQuery += " AND type=?";
        countParams.push(type);
      }
      
      const { total } = await fastify.db.get(countQuery, ...countParams);
      
      return {
        ok: true,
        transactions: rows.map(r => ({
          id: r.id,
          tg_id: r.tg_id,
          type: r.type,
          amount_ton: nanoToTon(r.amount_nano),
          created_at: r.created_at,
          meta: r.meta_json ? JSON.parse(r.meta_json) : null
        })),
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + rows.length < total
        }
      };
    } catch (error) {
      fastify.log.error("Transaction fetch error:", error);
      return reply.code(401).send({ ok: false, reason: "unauthorized" });
    }
  });
  
  // Add endpoint to get transaction by ID
  fastify.get("/transactions/:id", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      const id = parseInt(req.params.id);
      
      const row = await fastify.db.get(
        "SELECT * FROM ledger WHERE id=? AND tg_id=?", 
        id, u.tg_id
      );
      
      if (!row) {
        return reply.code(404).send({ ok: false, reason: "not_found" });
      }
      
      return {
        ok: true,
        transaction: {
          id: row.id,
          tg_id: row.tg_id,
          type: row.type,
          amount_ton: nanoToTon(row.amount_nano),
          created_at: row.created_at,
          meta: row.meta_json ? JSON.parse(row.meta_json) : null
        }
      };
    } catch (error) {
      fastify.log.error("Transaction detail error:", error);
      return reply.code(401).send({ ok: false, reason: "unauthorized" });
    }
  });
}