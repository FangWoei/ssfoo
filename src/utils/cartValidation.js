// src/utils/cartValidation.js
// ── Cart integrity checker ───────────────────────────────────────────
// A cart item is a SNAPSHOT taken at "Add to cart" time. Between then and
// checkout the admin can:
//   • change basePrice / salePrice, or start or end a promo
//   • move the product to draft, or delete it entirely
//   • raise the MOQ, or change the FOC deal
//   • re-brand it out of the outlet's allowedBrands list
// None of that reaches a cart that was saved days ago. This module compares
// each snapshot against the live product doc and reports exactly what drifted.
//
// It is a pure function — fetching is the caller's job (see useCartCheck).

import { effectivePrice, isOnPromo } from "@/utils/promo";

const EPS = 0.005; // sen-level tolerance, avoids float noise

export const ISSUE = {
  REMOVED: "removed", // deleted from the catalogue
  UNAVAILABLE: "unavailable", // status !== "active" (drafted)
  RESTRICTED: "restricted", // brand no longer visible to this outlet
  PRICE_UP: "price_up",
  PRICE_DOWN: "price_down",
  MOQ: "moq", // qty in cart is now below the minimum
  FOC: "foc", // free-goods deal changed
};

// REMOVE issues can only be resolved by dropping the item.
// UPDATE issues are resolved by re-syncing the snapshot to live values.
export const SEVERITY = {
  REMOVE: "remove",
  UPDATE: "update",
};

const money = (n) => `RM ${(Number(n) || 0).toFixed(2)}`;

const num = (v, fallback = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

const moqOf = (src) => Math.max(1, num(src?.minOrder ?? src?.moq, 1));

const focOf = (src) => ({
  buy: num(src?.focBuy, 0),
  free: num(src?.focFree, 0),
});

const emptyResult = () => ({
  ok: true,
  failed: false,
  issues: [],
  byProduct: {},
  removals: [],
  patches: {},
});

/**
 * @param {Array}  items      cart items from the store
 * @param {Map|Object} liveById  productId -> live product doc (missing = deleted)
 * @param {Object} opts
 * @param {string[]|null} opts.allowedBrands  outlet's brand whitelist
 * @param {boolean} opts.ignoreBrands         true for admins/editors
 * @returns {{ok, failed, issues, byProduct, removals, patches}}
 */
export function validateCart(items = [], liveById = new Map(), opts = {}) {
  const { allowedBrands = null, ignoreBrands = false } = opts;
  const brandLocked =
    !ignoreBrands && Array.isArray(allowedBrands) && allowedBrands.length > 0;

  const result = emptyResult();
  const lookup = (id) =>
    liveById instanceof Map ? liveById.get(id) : liveById?.[id];

  const push = (issue) => {
    result.issues.push(issue);
    if (!result.byProduct[issue.productId])
      result.byProduct[issue.productId] = [];
    result.byProduct[issue.productId].push(issue);
  };

  for (const item of items) {
    const id = item?.productId;
    if (!id) continue;

    const live = lookup(id);
    const name = live?.name || item.name || "This product";

    /* ── Blocking: item can't be ordered at all ── */
    if (!live) {
      result.removals.push(id);
      push({
        productId: id,
        name,
        type: ISSUE.REMOVED,
        severity: SEVERITY.REMOVE,
        message: `${name} has been taken out of the catalogue.`,
      });
      continue;
    }

    if (live.status !== "active") {
      result.removals.push(id);
      push({
        productId: id,
        name,
        type: ISSUE.UNAVAILABLE,
        severity: SEVERITY.REMOVE,
        message: `${name} is not open for ordering right now.`,
      });
      continue;
    }

    if (brandLocked && live.brand && !allowedBrands.includes(live.brand)) {
      result.removals.push(id);
      push({
        productId: id,
        name,
        type: ISSUE.RESTRICTED,
        severity: SEVERITY.REMOVE,
        message: `${name} is not available to your outlet.`,
      });
      continue;
    }

    /* ── Orderable: check the snapshot for drift ── */
    const patch = {};

    // Price (respects promo pricing — a promo that ended shows up here too)
    const livePrice = num(effectivePrice(live));
    const cartPrice = num(item.price);
    if (Math.abs(livePrice - cartPrice) > EPS) {
      patch.price = livePrice;
      patch.basePrice = num(live.basePrice);
      patch.onPromo = isOnPromo(live);
      const wentUp = livePrice > cartPrice;
      push({
        productId: id,
        name,
        type: wentUp ? ISSUE.PRICE_UP : ISSUE.PRICE_DOWN,
        severity: SEVERITY.UPDATE,
        before: cartPrice,
        after: livePrice,
        message: `${name} is now ${money(livePrice)} per unit — it was ${money(
          cartPrice,
        )} when you added it.`,
      });
    }

    // Minimum order quantity
    const liveMoq = moqOf(live);
    const qty = num(item.qty, 0);
    if (liveMoq !== moqOf(item)) patch.minOrder = liveMoq;
    if (qty < liveMoq) {
      patch.qty = liveMoq;
      push({
        productId: id,
        name,
        type: ISSUE.MOQ,
        severity: SEVERITY.UPDATE,
        before: qty,
        after: liveMoq,
        message: `${name} now has a minimum of ${liveMoq} units — your cart has ${qty}.`,
      });
    }

    // Free-goods deal
    const liveFoc = focOf(live);
    const cartFoc = focOf(item);
    if (liveFoc.buy !== cartFoc.buy || liveFoc.free !== cartFoc.free) {
      patch.focBuy = liveFoc.buy;
      patch.focFree = liveFoc.free;
      const had = cartFoc.buy > 0 && cartFoc.free > 0;
      const has = liveFoc.buy > 0 && liveFoc.free > 0;
      push({
        productId: id,
        name,
        type: ISSUE.FOC,
        severity: SEVERITY.UPDATE,
        message: has
          ? `${name} free-goods offer changed to buy ${liveFoc.buy}, get ${liveFoc.free} free.`
          : `${name} no longer comes with free goods.`,
        // a deal that never existed and still doesn't isn't worth showing
        _silent: !had && !has,
      });
    }

    // Cosmetic drift — synced quietly, never shown to the outlet
    if (live.name && live.name !== item.name) patch.name = live.name;
    if ((live.uom || "") !== (item.uom || "")) patch.uom = live.uom || "";
    if ((live.itemCode || "") !== (item.itemCode || ""))
      patch.itemCode = live.itemCode || "";
    const liveThumb = live.images?.[0] || "";
    if (liveThumb && liveThumb !== item.thumbnail) patch.thumbnail = liveThumb;

    if (Object.keys(patch).length > 0) result.patches[id] = patch;
  }

  // Drop the deals that were flagged but aren't worth a message
  result.issues = result.issues.filter((i) => !i._silent);
  Object.keys(result.byProduct).forEach((id) => {
    result.byProduct[id] = result.byProduct[id].filter((i) => !i._silent);
    if (result.byProduct[id].length === 0) delete result.byProduct[id];
  });

  result.ok = result.issues.length === 0;
  return result;
}

// Result shape to use when the check itself couldn't run (offline, rules, etc.)
export const failedResult = () => ({
  ...emptyResult(),
  ok: false,
  failed: true,
});
