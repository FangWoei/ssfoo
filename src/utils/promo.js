// src/utils/promo.js
// Helpers for promotion pricing (#5).
// A product is "on promo" when isPromo === true AND salePrice is a
// valid number below basePrice.

export const isOnPromo = (p) =>
  Boolean(
    p?.isPromo &&
    typeof p.salePrice === "number" &&
    p.salePrice > 0 &&
    p.salePrice < (p.basePrice ?? Infinity),
  );

// The price the outlet actually pays
export const effectivePrice = (p) =>
  isOnPromo(p) ? p.salePrice : (p.basePrice ?? 0);

// Discount percentage (rounded), or 0 if not on promo
export const discountPct = (p) =>
  isOnPromo(p) ? Math.round((1 - p.salePrice / p.basePrice) * 100) : 0;
