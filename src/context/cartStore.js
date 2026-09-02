// src/context/cartStore.js
import { loadCartFromFirestore, saveCartToFirestore } from "@/firebase/cart";
import { getProduct } from "@/firebase/products";
import { effectivePrice } from "@/utils/promo";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      userId: null,

      initCart: async (userId) => {
        set({ userId });
        try {
          const items = await loadCartFromFirestore(userId);
          // Auto-heal legacy items with corrupted qty (NaN/string/undefined)
          let clean = (items || []).map((i) => ({
            ...i,
            qty: Number.isFinite(Number(i.qty)) ? Number(i.qty) : 1,
            price: Number.isFinite(Number(i.price)) ? Number(i.price) : 0,
          }));

          // One-time repair: a checkout bug (since removed) briefly
          // overwrote cart item prices with RM0 for anyone who tried to
          // check out while it was live. Re-fetch the real price for any
          // zeroed item so it doesn't stay stuck at RM0 forever.
          const zeroed = clean.filter((i) => i.price <= 0 && i.productId);
          if (zeroed.length > 0) {
            const fixes = await Promise.all(
              zeroed.map(async (i) => {
                try {
                  const product = await getProduct(i.productId);
                  return {
                    productId: i.productId,
                    price: product ? effectivePrice(product) : null,
                  };
                } catch {
                  return { productId: i.productId, price: null };
                }
              }),
            );
            const priceMap = new Map(
              fixes
                .filter((f) => f.price != null && f.price > 0)
                .map((f) => [f.productId, f.price]),
            );
            if (priceMap.size > 0) {
              clean = clean.map((i) =>
                priceMap.has(i.productId)
                  ? { ...i, price: priceMap.get(i.productId) }
                  : i,
              );
              // Persist the repair so it doesn't have to run again on
              // every future load.
              saveCartToFirestore(userId, clean).catch((e) =>
                console.error("Cart price repair sync failed:", e),
              );
            }
          }

          set({ items: clean });
        } catch (e) {
          console.error("Cart load error", e);
        }
      },

      clearUserId: () => set({ userId: null, items: [] }),

      _sync: async (items) => {
        const { userId } = get();
        if (userId) {
          try {
            await saveCartToFirestore(userId, items);
          } catch (e) {
            console.error("Cart sync error:", e);
          }
        }
      },

      addItem: (item) => {
        const { items, _sync } = get();
        const existing = items.find((i) => i.productId === item.productId);
        const addQty = Number(item.qty) || 0;
        let updated;
        if (existing) {
          updated = items.map((i) =>
            i.productId === item.productId
              ? { ...i, qty: (Number(i.qty) || 0) + addQty }
              : i,
          );
        } else {
          updated = [...items, { ...item, qty: addQty }];
        }
        set({ items: updated });
        _sync(updated);
      },

      removeItem: (productId) => {
        const updated = get().items.filter((i) => i.productId !== productId);
        set({ items: updated });
        get()._sync(updated);
      },

      updateQty: (productId, qty) => {
        const n = Number(qty);
        if (isNaN(n) || n < 1) return;
        const updated = get().items.map((i) =>
          i.productId === productId ? { ...i, qty: n } : i,
        );
        set({ items: updated });
        get()._sync(updated);
      },

      updateNote: (productId, note) => {
        const updated = get().items.map((i) =>
          i.productId === productId ? { ...i, note } : i,
        );
        set({ items: updated });
        get()._sync(updated);
      },

      clearCart: () => {
        set({ items: [] });
        get()._sync([]);
      },

      // Applies the output of validateCart() in a single write: drops the
      // items that can no longer be ordered and re-syncs the rest to the
      // live product data (price, MOQ, FOC, name, image).
      applyCartFixes: ({ removals = [], patches = {} } = {}) => {
        const drop = new Set(removals);
        const updated = get()
          .items.filter((i) => !drop.has(i.productId))
          .map((i) =>
            patches[i.productId] ? { ...i, ...patches[i.productId] } : i,
          );
        set({ items: updated });
        get()._sync(updated);
        return updated;
      },

      get totalItems() {
        return get().items.reduce((s, i) => s + i.qty, 0);
      },
      get subtotal() {
        return get().items.reduce((s, i) => s + i.price * i.qty, 0);
      },
    }),
    {
      name: "ssfoo-cart",
      onRehydrateStorage: () => (state) => {
        if (state?.items) {
          state.items = state.items.map((i) => ({
            ...i,
            qty: Number.isFinite(Number(i.qty)) ? Number(i.qty) : 1,
            price: Number.isFinite(Number(i.price)) ? Number(i.price) : 0,
          }));
        }
      },
    },
  ),
);

export default useCartStore;
