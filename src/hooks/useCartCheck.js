// src/hooks/useCartCheck.js
// Runs the cart integrity check against live product data.
// Used by both CartPage (on open) and CheckoutPage (before placing an order)
// so the two screens can never disagree about what is wrong with the cart.

import { useAuth } from "@/context/AuthContext";
import useCartStore from "@/context/cartStore";
import { getProductsByIds } from "@/firebase/products";
import { failedResult, validateCart } from "@/utils/cartValidation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function useCartCheck({ auto = true } = {}) {
  const items = useCartStore((s) => s.items);
  const applyCartFixes = useCartStore((s) => s.applyCartFixes);
  const { profile, isAdmin, isEditor } = useAuth();

  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);

  // Read items from a ref so run() keeps a stable identity — otherwise every
  // qty tap would re-create it and re-fire the effect below.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const allowedBrands = profile?.allowedBrands;
  const brandKey = useMemo(
    () => (Array.isArray(allowedBrands) ? allowedBrands.join("|") : ""),
    [allowedBrands],
  );
  const ignoreBrands = Boolean(isAdmin || isEditor);

  const run = useCallback(async () => {
    const current = itemsRef.current || [];
    if (current.length === 0) {
      setResult(null);
      return validateCart([], new Map());
    }

    setChecking(true);
    try {
      const live = await getProductsByIds(current.map((i) => i.productId));
      const res = validateCart(current, live, {
        allowedBrands: brandKey ? brandKey.split("|") : null,
        ignoreBrands,
      });
      setResult(res.ok ? null : res);
      setCheckedAt(Date.now());
      return res;
    } catch (e) {
      console.error("Cart check failed:", e);
      const res = failedResult();
      setResult(res);
      return res;
    } finally {
      setChecking(false);
    }
  }, [brandKey, ignoreBrands]);

  // Applies every fix in one go and clears the banner.
  const resolve = useCallback(
    (res) => {
      const target = res || result;
      if (!target || target.failed) return null;
      const updated = applyCartFixes({
        removals: target.removals,
        patches: target.patches,
      });
      setResult(null);
      return updated;
    },
    [result, applyCartFixes],
  );

  const dismiss = useCallback(() => setResult(null), []);

  useEffect(() => {
    if (auto) run();
  }, [auto, run]);

  return {
    result,
    checking,
    checkedAt,
    run,
    resolve,
    dismiss,
    // Convenience flags for the callers
    blocked: Boolean(result && !result.ok),
    issuesFor: (productId) => result?.byProduct?.[productId] || [],
  };
}
