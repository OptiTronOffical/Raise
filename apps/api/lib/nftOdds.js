import crypto from "crypto";

export function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function randFloat(seed, salt) {
  const h = sha256Hex(`${seed}|${salt}`);
  const slice = h.slice(0, 12); // 48 bits
  return parseInt(slice, 16) / 0x1000000000000;
}

function pickUniform(list, r) {
  const idx = Math.min(list.length - 1, Math.floor(r * list.length));
  return list[idx];
}

function pickWeighted(items, weights, r) {
  let total = 0;
  for (const w of weights) total += w;
  let x = r * total;
  for (let i=0;i<items.length;i++){
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length-1];
}

/**
 * DEMO (as requested):
 *  - mainIds (default 1..4) with prob mainProb (default 0.9)
 * PROD (as requested):
 *  - NFT 1..5 are 2x rarer than 6..15 (weights 1 vs 2)
 */
export function rollNftIndex({ mode, seed, demoMainIds=[1,2,3,4], demoMainProb=0.9 }) {
  const NFT_COUNT = 15;
  const r1 = randFloat(seed, "nft:r1");
  const r2 = randFloat(seed, "nft:r2");

  if (mode === "demo") {
    const main = demoMainIds;
    const rest = [];
    for (let i=1;i<=NFT_COUNT;i++) if (!main.includes(i)) rest.push(i);
    return (r1 < demoMainProb) ? pickUniform(main, r2) : pickUniform(rest, r2);
  }

  const items = Array.from({length:NFT_COUNT},(_,i)=>i+1);
  const weights = items.map(i => (i <= 5 ? 1 : 2));
  return pickWeighted(items, weights, r1);
}
