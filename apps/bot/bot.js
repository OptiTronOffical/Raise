const TelegramBot = require("node-telegram-bot-api");
const dotenv = require("dotenv");
dotenv.config();

const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || "http://localhost:8787";
const WEBAPP_URL = process.env.WEBAPP_URL || "http://localhost:3000";
const ADMINS = String(process.env.ADMIN_TG_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN");
  process.exit(1);
}

function isAdmin(id){ return ADMINS.includes(String(id)); }

async function api(path, opts={}, adminId=null){
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers||{});
  if (adminId) headers["x-admin-tg-id"] = String(adminId);
  const res = await fetch(API_URL+path, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw Object.assign(new Error("API error"), { status:res.status, data });
  return data;
}

const bot = new TelegramBot(BOT_TOKEN, { polling:true });

bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const tgId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "user";
  const ref = match && match[1] ? Number(match[1]) : null;

  try{
    await api("/bot/start", { method:"POST", body: JSON.stringify({ tg_id: tgId, username, referrer_tg_id: ref }) });
  }catch{}

  const keyboard = {
    inline_keyboard: [
      [{ text:"Open WebApp", web_app:{ url: WEBAPP_URL } }],
      [{ text:"Bonuses", web_app:{ url: WEBAPP_URL + "/bonuses" } }, { text:"Referrals", web_app:{ url: WEBAPP_URL + "/referrals" } }],
    ]
  };
  bot.sendMessage(msg.chat.id, "Welcome. Open the mini app:", { reply_markup: keyboard });
});

bot.onText(/\/channels/, async (msg) => {
  try{
    const r = await api("/requirements");
    const list = r.required_channels || [];
    bot.sendMessage(msg.chat.id, "Required channels:\n" + (list.length? list.join("\n") : "(none)"));
  }catch(e){
    bot.sendMessage(msg.chat.id, "Error reading channels.");
  }
});

bot.onText(/\/setchannels\s+(.+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(msg.chat.id, "Forbidden.");

  const raw = (match && match[1]) ? String(match[1]).trim() : "";
  const arr = raw.toLowerCase()==="none" ? [] : raw.split(",").map(s=>s.trim()).filter(Boolean);

  try{
    const r = await api("/bot/admin/required-channels", {
      method:"POST",
      body: JSON.stringify({ required_channels: arr })
    }, adminId);
    bot.sendMessage(msg.chat.id, "Saved: " + (r.required_channels.length? r.required_channels.join(", ") : "(none)"));
  }catch(e){
    bot.sendMessage(msg.chat.id, "Error saving channels.");
  }
});

bot.onText(/\/confirm_deposit\s+(\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(msg.chat.id, "Forbidden.");
  const id = Number(match[1]);
  try{
    await api(`/admin/deposits/${id}/confirm`, { method:"POST", body:"{}" }, adminId);
    bot.sendMessage(msg.chat.id, `Deposit #${id} confirmed.`);
  }catch(e){
    bot.sendMessage(msg.chat.id, `Failed: ${e?.data?.reason || "error"}`);
  }
});

bot.onText(/\/pay_withdrawal\s+(\d+)(?:\s+(.+))?/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(msg.chat.id, "Forbidden.");
  const id = Number(match[1]);
  const tx = match[2] ? String(match[2]).trim() : "";
  try{
    await api(`/admin/withdrawals/${id}/pay`, { method:"POST", body: JSON.stringify({ tx_hash: tx || null }) }, adminId);
    bot.sendMessage(msg.chat.id, `Withdrawal #${id} marked as paid.`);
  }catch(e){
    bot.sendMessage(msg.chat.id, `Failed: ${e?.data?.reason || "error"}`);
  }
});

bot.on("polling_error", (e) => console.error("polling_error", e?.message || e));
console.log("Bot running...");
