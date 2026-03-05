export function tonToNano(tonStr) {
  if (tonStr === null || tonStr === undefined) {
    throw new Error("TON amount is required");
  }
  
  // Handle numbers and scientific notation
  const s = String(tonStr).trim();
  
  // Allow scientific notation and negative numbers
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(s)) {
    throw new Error("Invalid TON amount format");
  }
  
  // Convert to regular decimal string first (handle scientific notation)
  const num = Number(s);
  if (!isFinite(num)) {
    throw new Error("TON amount out of range");
  }
  
  // Split into integer and fractional parts with proper decimal handling
  const [a, b = ""] = num.toString().split(".");
  
  // Handle negative numbers
  const isNegative = a.startsWith('-');
  const absA = isNegative ? a.slice(1) : a;
  
  // Pad or truncate fractional part to 9 digits
  let frac = b;
  if (frac.length > 9) {
    // Round to 9 decimal places (nano precision)
    const roundingDigit = parseInt(frac[9]);
    frac = frac.slice(0, 9);
    if (roundingDigit >= 5) {
      // Handle rounding up
      let fracNum = parseInt(frac) + 1;
      if (fracNum >= 1000000000) {
        // Overflow to integer part
        return BigInt(absA) * 1000000000n + 1000000000n;
      }
      frac = String(fracNum).padStart(9, '0');
    }
  } else {
    frac = frac.padEnd(9, '0');
  }
  
  const result = BigInt(absA) * 1000000000n + BigInt(frac);
  return isNegative ? -result : result;
}

export function nanoToTon(n) {
  if (n === null || n === undefined) {
    throw new Error("Nano amount is required");
  }
  
  let x;
  try {
    x = BigInt(n);
  } catch {
    throw new Error("Invalid nano amount format");
  }
  
  const sign = x < 0n ? "-" : "";
  const abs = x < 0n ? -x : x;
  
  const a = abs / 1000000000n;
  const b = abs % 1000000000n;
  
  // Remove trailing zeros from fractional part
  let frac = b.toString().padStart(9, "0");
  frac = frac.replace(/0+$/, "");
  
  // Handle edge case where fraction becomes empty after removing zeros
  if (frac === "") {
    return sign + a.toString();
  }
  
  return sign + a.toString() + "." + frac;
}

// Additional utility function for validation
export function isValidTonAmount(value) {
  try {
    tonToNano(value);
    return true;
  } catch {
    return false;
  }
}

// Format TON amount with specified decimal places
export function formatTonAmount(nanoAmount, decimals = 9) {
  const tonStr = nanoToTon(nanoAmount);
  const [intPart, fracPart = ""] = tonStr.split(".");
  
  if (decimals === 0) return intPart;
  
  const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  return `${intPart}.${paddedFrac}`;
}