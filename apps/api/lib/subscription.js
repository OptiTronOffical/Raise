import fetch from "node-fetch";

const REQUEST_TIMEOUT = 5000; // 5 seconds
const CACHE_TTL = 60000; // 1 minute cache for membership checks
const statusCache = new Map();

function getCacheKey(botToken, chatId, tgId) {
  return `${botToken}:${chatId}:${tgId}`;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

export async function checkRequiredChannels({ botToken, tgId, channels, skip = false }) {
  // Input validation
  if (skip) return { ok: true, missing: [], cached: false };
  
  if (!botToken || typeof botToken !== 'string') {
    throw new Error("Valid botToken is required");
  }
  
  if (!tgId || typeof tgId !== 'number') {
    throw new Error("Valid tgId (number) is required");
  }
  
  if (!channels || !Array.isArray(channels) || channels.length === 0) {
    return { ok: true, missing: [], cached: false };
  }

  const missing = [];
  const now = Date.now();
  
  for (const ch of channels) {
    if (!ch || typeof ch !== 'string') {
      missing.push(String(ch)); // Invalid channel format
      continue;
    }
    
    const chat_id = ch.startsWith("@") ? ch : "@" + ch;
    const cacheKey = getCacheKey(botToken, chat_id, tgId);
    
    // Check cache first
    const cached = statusCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      if (!cached.isMember) missing.push(chat_id);
      continue;
    }
    
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chat_id)}&user_id=${tgId}`;
    
    try {
      const res = await fetchWithTimeout(url, REQUEST_TIMEOUT);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const js = await res.json();
      
      if (!js.ok) {
        throw new Error(js.description || "Telegram API error");
      }
      
      const status = js?.result?.status;
      const isMember = status === "member" || status === "administrator" || status === "creator";
      
      // Cache the result
      statusCache.set(cacheKey, {
        isMember,
        timestamp: now
      });
      
      if (!isMember) missing.push(chat_id);
      
    } catch (error) {
      console.error(`Failed to check channel ${chat_id}:`, error.message);
      missing.push(chat_id);
      
      // Cache failures briefly to avoid hammering the API
      statusCache.set(cacheKey, {
        isMember: false,
        timestamp: now
      });
    }
  }
  
  return { 
    ok: missing.length === 0, 
    missing,
    cached: false
  };
}

// Optional: Function to clear cache
export function clearMembershipCache() {
  statusCache.clear();
}