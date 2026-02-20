import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd, getBalanceNano } from "../db.js";
import { checkRequiredChannels } from "../lib/subscription.js";

function isAdmin(fastify, tgId) {
  const admins = String(fastify.config.ADMIN_TG_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);
  return admins.includes(String(tgId));
}

export function paymentRoutes(fastify) {
  fastify.post("/deposits/create", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);
      if (amountNano <= 0n) return reply.code(400).send({ ok:false, reason:"bad_amount" });

      const comment = `DEP-${u.tg_id}-${Date.now()}`;
      const now = new Date().toISOString();
      const r = await fastify.db.run(
        "INSERT INTO deposits(tg_id,amount_nano,status,created_at,comment) VALUES(?,?,?,?,?)",
        u.tg_id, amountNano.toString(), "pending", now, comment
      );
      await ledgerAdd(fastify.db, u.tg_id, "deposit_pending", amountNano.toString(), { deposit_id: r.lastID, comment });
      return { ok:true, deposit_id:r.lastID, amount_ton:nanoToTon(amountNano), treasury_address: fastify.config.TREASURY_ADDRESS || "", comment };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/withdraw/request", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);

      const minNano = tonToNano(fastify.config.MIN_WITHDRAW_TON || "1");
      if (amountNano < minNano) return reply.code(400).send({ ok:false, reason:"min_withdraw", min_ton:nanoToTon(minNano) });

      const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
      const channels = s ? JSON.parse(s.value_json) : [];
      const gate = await checkRequiredChannels({
        botToken: fastify.config.BOT_TOKEN,
        tgId: u.tg_id,
        channels,
        skip: fastify.config.SKIP_SUB_CHECK === "1"
      });
      if (!gate.ok) return reply.code(403).send({ ok:false, reason:"subscribe_required", missing: gate.missing });

      const bal = await getBalanceNano(fastify.db, u.tg_id);
      if (bal < amountNano) return reply.code(400).send({ ok:false, reason:"insufficient_balance" });

      const now = new Date().toISOString();
      const r = await fastify.db.run(
        "INSERT INTO withdrawals(tg_id,amount_nano,status,created_at) VALUES(?,?,?,?)",
        u.tg_id, amountNano.toString(), "requested", now
      );
      await ledgerAdd(fastify.db, u.tg_id, "withdraw_requested", (-amountNano).toString(), { withdrawal_id:r.lastID });

      return { ok:true, withdrawal_id:r.lastID, amount_ton:nanoToTon(amountNano) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/admin/deposits/:id/confirm", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });

    const id = Number(req.params.id);
    const dep = await fastify.db.get("SELECT * FROM deposits WHERE id=?", id);
    if (!dep) return reply.code(404).send({ ok:false });
    if (dep.status === "confirmed") return { ok:true, already:true };

    await fastify.db.run("UPDATE deposits SET status='confirmed', confirmed_at=? WHERE id=?", new Date().toISOString(), id);
    await ledgerAdd(fastify.db, dep.tg_id, "deposit_confirmed", dep.amount_nano, { deposit_id:id });
    return { ok:true };
  });

  fastify.post("/admin/withdrawals/:id/pay", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });

    const id = Number(req.params.id);
    const wd = await fastify.db.get("SELECT * FROM withdrawals WHERE id=?", id);
    if (!wd) return reply.code(404).send({ ok:false });
    if (wd.status === "paid") return { ok:true, already:true };

    const tx = String(req.body?.tx_hash || "").trim() || null;
    await fastify.db.run("UPDATE withdrawals SET status='paid', paid_at=?, tx_hash=? WHERE id=?",
      new Date().toISOString(), tx, id
    );
    await ledgerAdd(fastify.db, wd.tg_id, "withdraw_paid", "0", { withdrawal_id:id, tx_hash: tx });
    return { ok:true };
  });
}
