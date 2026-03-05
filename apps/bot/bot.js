const TelegramBot = require("node-telegram-bot-api");
const dotenv = require("dotenv");
const rateLimit = new Map(); // Simple in-memory rate limiting
const commandCooldowns = new Map();

dotenv.config();

const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

// Configuration with validation
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL || "http://localhost:8787";
const WEBAPP_URL = process.env.WEBAPP_URL || "http://localhost:3000";
const ADMINS = String(process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const NODE_ENV = process.env.NODE_ENV || "development";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 commands per minute
const COMMAND_COOLDOWN = 2000; // 2 seconds between same command

if (!BOT_TOKEN) {
  console.error("❌ Missing BOT_TOKEN environment variable");
  process.exit(1);
}

if (!API_URL) {
  console.warn("⚠️  API_URL not set, using default: http://localhost:8787");
}

if (!WEBAPP_URL) {
  console.warn("⚠️  WEBAPP_URL not set, using default: http://localhost:3000");
}

// Utility functions
function isAdmin(id) {
  return ADMINS.includes(String(id));
}

function formatError(error) {
  if (error?.data?.reason) return error.data.reason;
  if (error?.message) return error.message;
  return "Unknown error";
}

// Rate limiting
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimits = rateLimit.get(userId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > userLimits.resetTime) {
    userLimits.count = 1;
    userLimits.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    userLimits.count++;
  }
  
  rateLimit.set(userId, userLimits);
  return userLimits.count <= RATE_LIMIT_MAX;
}

function checkCooldown(userId, command) {
  const key = `${userId}:${command}`;
  const lastUsed = commandCooldowns.get(key) || 0;
  const now = Date.now();
  
  if (now - lastUsed < COMMAND_COOLDOWN) {
    return false;
  }
  
  commandCooldowns.set(key, now);
  return true;
}

// API wrapper with retry logic
async function api(path, opts = {}, adminId = null, retryCount = 0) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  
  if (adminId) {
    headers["x-admin-tg-id"] = String(adminId);
  }

  try {
    const url = API_URL + path;
    const options = Object.assign({}, opts, { headers });
    
    if (NODE_ENV === "development") {
      console.log(`🔍 API Request: ${opts.method || 'GET'} ${url}`);
    }

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data?.reason || "API error");
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (retryCount < MAX_RETRIES && error.status >= 500) {
      console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRIES} for ${path}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return api(path, opts, adminId, retryCount + 1);
    }
    throw error;
  }
}

// Initialize bot with better error handling
const bot = new TelegramBot(BOT_TOKEN, { 
  polling: true,
  filepath: false, // Disable file downloading to save memory
  polling_options: {
    timeout: 30, // Long polling timeout
    limit: 100, // Max updates per request
  }
});

// Command handlers with improved error handling and user feedback

// Help command
bot.onText(/\/help/, async (msg) => {
  const userId = msg.from.id;
  
  if (!checkRateLimit(userId)) {
    return bot.sendMessage(msg.chat.id, "⏱️ Too many requests. Please wait a minute.");
  }

  const commands = [
    "📋 *Available Commands:*",
    "",
    "👤 *User Commands:*",
    "/start - Open the mini app",
    "/channels - List required channels",
    "/help - Show this help message",
    "",
    "💰 *Bonuses:*",
    "/daily - Claim daily bonus",
    "/cashback - Check cashback balance",
    "/referrals - Check referral stats",
    "",
    "🏆 *Jackpot:*",
    "/status - Current jackpot status",
    "/history - Recent jackpot history",
    ""
  ];

  if (isAdmin(userId)) {
    commands.push(
      "🔐 *Admin Commands:*",
      "/setchannels <channels> - Set required channels (comma-separated or 'none')",
      "/confirm_deposit <id> - Confirm a deposit",
      "/pay_withdrawal <id> [tx_hash] - Mark withdrawal as paid",
      "/admin_help - Show all admin commands",
      "/stats - Show bot statistics",
      "/broadcast <message> - Send message to all users"
    );
  }

  bot.sendMessage(msg.chat.id, commands.join("\n"), { parse_mode: "Markdown" });
});

// Start command
bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "user";
  const ref = match && match[1] ? Number(match[1]) : null;

  // Check rate limit
  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, "⏱️ Too many requests. Please wait a minute.");
  }

  // Send typing indicator for better UX
  bot.sendChatAction(chatId, "typing");

  try {
    // Register user with API
    await api("/bot/start", {
      method: "POST",
      body: JSON.stringify({ 
        tg_id: userId, 
        username, 
        referrer_tg_id: ref 
      })
    });

    // Create inline keyboard with webapp buttons
    const keyboard = {
      inline_keyboard: [
        [{ 
          text: "🎮 Open Jackpot Game", 
          web_app: { url: WEBAPP_URL } 
        }],
        [{ 
          text: "🎁 Bonuses", 
          web_app: { url: `${WEBAPP_URL}/bonuses` } 
        }, 
        { 
          text: "👥 Referrals", 
          web_app: { url: `${WEBAPP_URL}/referrals` } 
        }],
        [{ 
          text: "💰 Deposit", 
          web_app: { url: `${WEBAPP_URL}/deposit` } 
        }, 
        { 
          text: "💸 Withdraw", 
          web_app: { url: `${WEBAPP_URL}/withdraw` } 
        }]
      ]
    };

    // Welcome message with user info
    const welcomeMessage = [
      `🎉 *Welcome${username ? ' ' + username : ''}!*`,
      "",
      "You've successfully joined the Jackpot game.",
      "",
      "🎯 *How to play:*",
      "• Place bets on the jackpot round",
      "• Higher bets = higher winning chance",
      "• Win NFTs and TON prizes",
      "",
      "✨ *Features:*",
      "• Daily bonuses",
      "• Referral rewards",
      "• Cashback on bets",
      "• NFT prizes",
      "",
      "👇 Click below to start playing!"
    ].join("\n");

    await bot.sendMessage(chatId, welcomeMessage, { 
      parse_mode: "Markdown",
      reply_markup: keyboard 
    });

    // Send personalized stats if available
    try {
      const stats = await api(`/me/profile/stats`, {
        headers: { "x-init-data": `user=${JSON.stringify({ id: userId })}` }
      });
      
      if (stats.ok) {
        const statsMessage = [
          "📊 *Your Stats:*",
          `• Total Bets: ${stats.stats.total_bets}`,
          `• Total Wins: ${stats.stats.total_wins}`,
          `• Win Rate: ${stats.stats.win_rate}%`,
          `• Referrals: ${stats.stats.total_referrals}`
        ].join("\n");
        
        await bot.sendMessage(chatId, statsMessage, { parse_mode: "Markdown" });
      }
    } catch (error) {
      // Ignore stats error - not critical
    }

  } catch (error) {
    console.error("Start command error:", error);
    
    // Fallback message if API fails
    const fallbackKeyboard = {
      inline_keyboard: [
        [{ text: "🎮 Open Game", web_app: { url: WEBAPP_URL } }]
      ]
    };
    
    await bot.sendMessage(
      chatId, 
      "⚠️ *Welcome!*\n\nUnable to connect to game server. You can still open the mini app.",
      { 
        parse_mode: "Markdown",
        reply_markup: fallbackKeyboard 
      }
    );
  }
});

// Channels command
bot.onText(/\/channels/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!checkRateLimit(userId) || !checkCooldown(userId, 'channels')) {
    return;
  }

  bot.sendChatAction(chatId, "typing");

  try {
    const r = await api("/requirements");
    const list = r.required_channels || [];
    
    if (list.length === 0) {
      return bot.sendMessage(
        chatId, 
        "✅ No channels are required to play!\n\nYou can start playing immediately."
      );
    }

    const channelList = list.map(ch => `• ${ch}`).join("\n");
    const message = [
      "📢 *Required Channels:*",
      "",
      "To play and withdraw, you must join these channels:",
      "",
      channelList,
      "",
      "After joining, you can start playing!"
    ].join("\n");

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(
      chatId, 
      "❌ Error fetching required channels. Please try again later."
    );
  }
});

// Daily bonus command
bot.onText(/\/daily/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!checkRateLimit(userId) || !checkCooldown(userId, 'daily')) {
    return;
  }

  bot.sendChatAction(chatId, "typing");

  try {
    const result = await api("/bonuses/daily/claim", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "x-init-data": `user=${JSON.stringify({ id: userId })}` }
    });

    if (result.ok) {
      bot.sendMessage(
        chatId,
        `🎁 *Daily Bonus Claimed!*\n\nYou received *${result.amount_ton} TON*!`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (error) {
    if (error.data?.reason === "already_claimed") {
      bot.sendMessage(chatId, "⏰ You've already claimed your daily bonus today!");
    } else if (error.data?.reason === "subscribe_required") {
      const missing = error.data.missing?.join(", ") || "some channels";
      bot.sendMessage(
        chatId,
        `⚠️ Please join required channels first:\n${missing}\n\nUse /channels to see the list.`
      );
    } else {
      bot.sendMessage(chatId, "❌ Failed to claim daily bonus. Please try again later.");
    }
  }
});

// Admin commands
bot.onText(/\/setchannels\s+(.+)/, async (msg, match) => {
  const adminId = msg.from.id;
  const chatId = msg.chat.id;

  if (!isAdmin(adminId)) {
    return bot.sendMessage(chatId, "⛔ This command is for admins only.");
  }

  if (!checkRateLimit(adminId)) {
    return bot.sendMessage(chatId, "⏱️ Rate limit exceeded. Please wait.");
  }

  bot.sendChatAction(chatId, "typing");

  const raw = (match && match[1]) ? String(match[1]).trim() : "";
  
  // Parse channels
  let channels = [];
  if (raw.toLowerCase() !== "none") {
    channels = raw
      .split(",")
      .map(s => s.trim())
      .filter(s => s.startsWith('@') || /^[a-zA-Z0-9_]{5,}$/.test(s))
      .map(s => s.startsWith('@') ? s : `@${s}`);
  }

  try {
    const r = await api("/bot/admin/required-channels", {
      method: "POST",
      body: JSON.stringify({ required_channels: channels })
    }, adminId);

    const message = channels.length === 0
      ? "✅ Required channels cleared. No subscription checks will be performed."
      : `✅ Required channels updated:\n${channels.map(c => `• ${c}`).join("\n")}`;

    bot.sendMessage(chatId, message);
  } catch (error) {
    bot.sendMessage(
      chatId,
      `❌ Failed to save channels: ${formatError(error)}`
    );
  }
});

bot.onText(/\/confirm_deposit\s+(\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  const chatId = msg.chat.id;

  if (!isAdmin(adminId)) {
    return bot.sendMessage(chatId, "⛔ This command is for admins only.");
  }

  const id = Number(match[1]);
  
  bot.sendChatAction(chatId, "typing");

  try {
    const result = await api(`/admin/deposits/${id}/confirm`, { 
      method: "POST", 
      body: "{}" 
    }, adminId);

    if (result.already) {
      bot.sendMessage(chatId, `ℹ️ Deposit #${id} was already confirmed.`);
    } else {
      bot.sendMessage(chatId, `✅ Deposit #${id} confirmed successfully!`);
    }
  } catch (error) {
    bot.sendMessage(
      chatId,
      `❌ Failed to confirm deposit #${id}: ${formatError(error)}`
    );
  }
});

bot.onText(/\/pay_withdrawal\s+(\d+)(?:\s+(.+))?/, async (msg, match) => {
  const adminId = msg.from.id;
  const chatId = msg.chat.id;

  if (!isAdmin(adminId)) {
    return bot.sendMessage(chatId, "⛔ This command is for admins only.");
  }

  const id = Number(match[1]);
  const tx = match[2] ? String(match[2]).trim() : "";

  bot.sendChatAction(chatId, "typing");

  try {
    const result = await api(`/admin/withdrawals/${id}/pay`, { 
      method: "POST", 
      body: JSON.stringify({ tx_hash: tx || null })
    }, adminId);

    if (result.already) {
      bot.sendMessage(chatId, `ℹ️ Withdrawal #${id} was already marked as paid.`);
    } else {
      const message = tx 
        ? `✅ Withdrawal #${id} marked as paid.\nTransaction: ${tx}`
        : `✅ Withdrawal #${id} marked as paid.`;
      
      bot.sendMessage(chatId, message);
    }
  } catch (error) {
    bot.sendMessage(
      chatId,
      `❌ Failed to process withdrawal #${id}: ${formatError(error)}`
    );
  }
});

// Admin help
bot.onText(/\/admin_help/, async (msg) => {
  const adminId = msg.from.id;
  
  if (!isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, "⛔ This command is for admins only.");
  }

  const commands = [
    "🔐 *Admin Commands:*",
    "",
    "📢 *Channel Management:*",
    "/setchannels <channels> - Set required channels (comma-separated or 'none')",
    "",
    "💰 *Deposit Management:*",
    "/confirm_deposit <id> - Confirm a deposit",
    "/list_deposits [pending|confirmed] - List deposits",
    "",
    "💸 *Withdrawal Management:*",
    "/pay_withdrawal <id> [tx_hash] - Mark withdrawal as paid",
    "/reject_withdrawal <id> [reason] - Reject withdrawal",
    "/list_withdrawals [requested|paid] - List withdrawals",
    "",
    "📊 *Statistics:*",
    "/stats - Show bot statistics",
    "/user_info <id> - Get user information",
    "",
    "📨 *Broadcast:*",
    "/broadcast <message> - Send message to all users"
  ];

  bot.sendMessage(msg.chat.id, commands.join("\n"), { parse_mode: "Markdown" });
});

// Statistics command
bot.onText(/\/stats/, async (msg) => {
  const adminId = msg.from.id;
  
  if (!isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, "⛔ This command is for admins only.");
  }

  try {
    // Gather statistics from API
    const [users, deposits, withdrawals, rounds] = await Promise.all([
      api("/admin/stats/users", {}, adminId).catch(() => ({ total: 0 })),
      api("/admin/stats/deposits", {}, adminId).catch(() => ({ total: 0, volume: 0 })),
      api("/admin/stats/withdrawals", {}, adminId).catch(() => ({ total: 0, volume: 0 })),
      api("/admin/stats/rounds", {}, adminId).catch(() => ({ total: 0, volume: 0 }))
    ]);

    const stats = [
      "📊 *Bot Statistics:*",
      "",
      `👥 *Users:* ${users.total || 0}`,
      `📈 *24h Active:* ${users.active_24h || 0}`,
      "",
      `💰 *Total Deposits:* ${deposits.total || 0}`,
      `💵 *Deposit Volume:* ${deposits.volume || 0} TON`,
      "",
      `💸 *Total Withdrawals:* ${withdrawals.total || 0}`,
      `💵 *Withdrawal Volume:* ${withdrawals.volume || 0} TON`,
      "",
      `🎮 *Rounds Played:* ${rounds.total || 0}`,
      `💎 *NFTs Won:* ${rounds.nfts_won || 0}`,
      "",
      `⏱️ *Uptime:* ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`
    ];

    bot.sendMessage(msg.chat.id, stats.join("\n"), { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(msg.chat.id, "❌ Failed to fetch statistics.");
  }
});

// Error handlers
bot.on("polling_error", (error) => {
  console.error("🚨 Polling error:", error?.message || error);
  
  // Attempt to restart polling if critical error
  if (error.code === 'ETELEGRAM' && error.response?.statusCode === 401) {
    console.error("❌ Invalid bot token. Exiting...");
    process.exit(1);
  }
});

bot.on("webhook_error", (error) => {
  console.error("🚨 Webhook error:", error);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  try {
    await bot.stopPolling();
    console.log("✅ Bot stopped polling");
    
    // Clear rate limit maps
    rateLimit.clear();
    commandCooldowns.clear();
    
    console.log("👋 Bot shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught exception:", error);
  // Don't exit immediately, let the bot try to recover
});

process.on("unhandledRejection", (error) => {
  console.error("🚨 Unhandled rejection:", error);
});

console.log(`
🤖 Telegram Bot Started
📊 Mode: ${NODE_ENV}
👥 Admins: ${ADMINS.length ? ADMINS.join(', ') : 'None'}
🌐 API URL: ${API_URL}
🖥️ WebApp URL: ${WEBAPP_URL}
⏱️  ${new Date().toISOString()}
`);

// Additional utility commands (can be expanded)

// List pending deposits (admin)
bot.onText(/\/list_deposits(?:\s+(.+))?/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return;

  const status = match?.[1] || "pending";
  
  try {
    const data = await api(`/admin/deposits/${status}`, {}, adminId);
    
    if (!data.deposits?.length) {
      return bot.sendMessage(msg.chat.id, `No ${status} deposits found.`);
    }

    const list = data.deposits.map(d => 
      `#${d.id} - ${d.amount_ton} TON - User: ${d.username || d.tg_id}`
    ).join("\n");

    bot.sendMessage(
      msg.chat.id,
      `📝 *${status.toUpperCase()} Deposits:*\n\n${list}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    bot.sendMessage(msg.chat.id, "❌ Failed to fetch deposits.");
  }
});

// List requested withdrawals (admin)
bot.onText(/\/list_withdrawals(?:\s+(.+))?/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return;

  const status = match?.[1] || "requested";
  
  try {
    const data = await api(`/admin/withdrawals/${status}`, {}, adminId);
    
    if (!data.withdrawals?.length) {
      return bot.sendMessage(msg.chat.id, `No ${status} withdrawals found.`);
    }

    const list = data.withdrawals.map(w => 
      `#${w.id} - ${w.amount_ton} TON - User: ${w.username || w.tg_id}`
    ).join("\n");

    bot.sendMessage(
      msg.chat.id,
      `📝 *${status.toUpperCase()} Withdrawals:*\n\n${list}`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    bot.sendMessage(msg.chat.id, "❌ Failed to fetch withdrawals.");
  }
});