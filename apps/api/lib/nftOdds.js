import crypto from "crypto";

export function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function randFloat(seed, salt) {
  if (!seed || !salt) throw new Error("Seed and salt are required");
  const h = sha256Hex(`${String(seed)}|${String(salt)}`);
  const slice = h.slice(0, 12); // 48 bits
  return parseInt(slice, 16) / 0x1000000000000;
}

function pickUniform(list, r) {
  if (!list || list.length === 0) return null;
  if (r < 0 || r >= 1) throw new Error("Random value must be in [0,1)");
  const idx = Math.min(list.length - 1, Math.floor(r * list.length));
  return list[idx];
}

function pickWeighted(items, weights, r) {
  if (!items || items.length === 0) return null;
  if (items.length !== weights.length) {
    throw new Error("Items and weights must have same length");
  }
  if (r < 0 || r >= 1) throw new Error("Random value must be in [0,1)");
  
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new Error("Total weight must be positive");
  
  let x = r * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * DEMO (as requested):
 *  - mainIds (default 1..4) with prob mainProb (default 0.9)
 * PROD (as requested):
 *  - NFT 1..5 are 2x rarer than 6..15 (weights 1 vs 2)
 */
export function rollNftIndex({ mode, seed, demoMainIds = [1,2,3,4], demoMainProb = 0.9 }) {
  // Input validation
  if (!seed) throw new Error("Seed is required");
  if (!["demo", "prod"].includes(mode)) {
    throw new Error("Mode must be either 'demo' or 'prod'");
  }
  
  const NFT_COUNT = 15;
  
  // Validate demo parameters
  if (mode === "demo") {
    if (!Array.isArray(demoMainIds) || demoMainIds.length === 0) {
      throw new Error("demoMainIds must be a non-empty array");
    }
    if (demoMainProb < 0 || demoMainProb > 1) {
      throw new Error("demoMainProb must be between 0 and 1");
    }
    
    // Validate demoMainIds are within range
    for (const id of demoMainIds) {
      if (id < 1 || id > NFT_COUNT) {
        throw new Error(`demoMainIds must be between 1 and ${NFT_COUNT}`);
      }
    }
  }
  
  const r1 = randFloat(seed, "nft:r1");
  const r2 = randFloat(seed, "nft:r2");

  if (mode === "demo") {
    // More efficient rest array generation
    const mainSet = new Set(demoMainIds);
    const rest = [];
    for (let i = 1; i <= NFT_COUNT; i++) {
      if (!mainSet.has(i)) rest.push(i);
    }
    
    // Handle edge case where all IDs are in main
    if (rest.length === 0) return pickUniform(demoMainIds, r2);
    
    return (r1 < demoMainProb) ? pickUniform(demoMainIds, r2) : pickUniform(rest, r2);
  }

  // Production mode
  const items = Array.from({ length: NFT_COUNT }, (_, i) => i + 1);
  const weights = items.map(i => (i <= 5 ? 1 : 2));
  return pickWeighted(items, weights, r1);
}