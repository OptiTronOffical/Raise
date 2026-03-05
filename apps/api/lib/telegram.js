import crypto from "crypto";

export function verifyTelegramWebAppData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData) return { ok: false, reason: "missing_init_data" };
  
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing_hash" };
  
  // Check auth_date to prevent replay attacks
  const authDate = params.get("auth_date");
  if (!authDate) return { ok: false, reason: "missing_auth_date" };
  
  const authTimestamp = parseInt(authDate, 10);
  if (isNaN(authTimestamp)) return { ok: false, reason: "invalid_auth_date" };
  
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - authTimestamp > maxAgeSeconds) {
    return { ok: false, reason: "auth_date_expired" };
  }
  
  params.delete("hash");
  
  // Sort entries and create data check string
  const entries = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  
  // Generate secret key and compute hash
  const secretKey = crypto.createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  
  const computedHash = crypto.createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  
  // Use constant-time comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');
  
  if (hashBuffer.length !== computedBuffer.length || 
      !crypto.timingSafeEqual(hashBuffer, computedBuffer)) {
    return { ok: false, reason: "bad_hash" };
  }
  
  // Parse user data if present
  const userRaw = params.get("user");
  let user = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      return { ok: false, reason: "invalid_user_json" };
    }
  }
  
  // Return all parsed data for completeness
  return { 
    ok: true, 
    user,
    auth_date: authTimestamp,
    query_id: params.get("query_id") || null,
    chat_instance: params.get("chat_instance") || null,
    chat_type: params.get("chat_type") || null,
    start_param: params.get("start_param") || null,
    can_send_after: params.get("can_send_after") || null
  };
}