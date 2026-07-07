// src/context/cartStore.js
import { loadCartFromFirestore, saveCartToFirestore } from "@/firebase/cart";
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
          set({ items: items || [] });
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
        let updated;
        if (existing) {
          updated = items.map((i) =>
            i.productId === item.productId
              ? { ...i, qty: Math.min(i.qty + item.qty, item.stock) }
              : i,
          );
        } else {
          updated = [...items, { ...item }];
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
        if (qty < 1) return;
        const updated = get().items.map((i) =>
          i.productId === productId ? { ...i, qty: Math.min(qty, i.stock) } : i,
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

      get totalItems() {
        return get().items.reduce((s, i) => s + i.qty, 0);
      },
      get subtotal() {
        return get().items.reduce((s, i) => s + i.price * i.qty, 0);
      },
    }),
    { name: "ssfoo-cart" },
  ),
);

export default useCartStore;
