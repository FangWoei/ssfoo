// src/pages/shop/CartPage.jsx
import useCartStore from "@/context/cartStore";
import { formatPrice } from "@/utils/helpers";
import toast from "react-hot-toast";
import {
  FiArrowRight,
  FiEdit3,
  FiMinus,
  FiPlus,
  FiShoppingBag,
  FiTrash2,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

export default function CartPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const updateNote = useCartStore((s) => s.updateNote);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const subtotal = items.reduce(
    (s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0),
    0,
  );
  const totalItems = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);

  const getMoq = (item) => Math.max(1, item.minOrder ?? item.moq ?? 1);

  const handleQty = (item, next) => {
    const moq = getMoq(item);
    if (next < moq) {
      toast.error(`Minimum order quantity is ${moq}`);
      return;
    }
    updateQty(item.productId, next);
  };

  const handleQtyInput = (item, raw) => {
    if (raw === "" || raw === "-") return;
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    const moq = getMoq(item);
    updateQty(item.productId, Math.max(moq, num));
  };

  const handleRemove = (item) => {
    removeItem(item.productId);
    toast.success(`${item.name} removed`);
  };

  const handleClear = () => {
    if (!window.confirm("Clear all items from cart?")) return;
    clearCart();
    toast.success("Cart cleared");
  };

  /* ── Empty state ── */
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFE8D6] to-[#A7F3D0] dark:from-teal-900/30 dark:to-teal-900/30 flex items-center justify-center shadow-md mb-5">
          <FiShoppingBag
            size={32}
            className="text-teal-600 dark:text-teal-400"
          />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Your cart is empty
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
          Browse the catalogue and add products to start a new order.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md shadow-primary-500/25 text-sm font-semibold transition-colors">
          Browse Products <FiArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Cart
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {items.length} product{items.length > 1 ? "s" : ""} · {totalItems}{" "}
            unit{totalItems > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleClear}
          className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors">
          Clear all
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* ── Item list ── */}
        <div className="space-y-3">
          {items.map((item) => {
            const moq = getMoq(item);
            return (
              <div
                key={item.productId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <img
                    src={item.thumbnail || item.image || PLACEHOLDER}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER;
                    }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0 self-start"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 break-words">
                          {item.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {formatPrice(item.price)} / unit
                          {moq > 1 && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-[#FFE8D6] dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-[10px] font-semibold">
                              MOQ {moq}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                        title="Remove">
                        <FiTrash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-y-2 gap-x-3">
                      {/* Qty stepper */}
                      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => handleQty(item, item.qty - 1)}
                          disabled={item.qty <= moq}
                          className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <FiMinus size={13} />
                        </button>
                        <input
                          type="number"
                          value={Number.isFinite(item.qty) ? item.qty : ""}
                          min={moq}
                          onChange={(e) => handleQtyInput(item, e.target.value)}
                          className="w-14 text-center text-sm font-semibold bg-transparent text-slate-900 dark:text-slate-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => handleQty(item, item.qty + 1)}
                          className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <FiPlus size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.focBuy > 0 &&
                          item.focFree > 0 &&
                          Math.floor(item.qty / item.focBuy) * item.focFree >
                            0 && (
                            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded">
                              🎁 +
                              {Math.floor(item.qty / item.focBuy) *
                                item.focFree}{" "}
                              FOC
                            </span>
                          )}
                        <span className="text-sm font-bold text-teal-700 dark:text-teal-400">
                          {formatPrice(
                            (Number(item.price) || 0) * (Number(item.qty) || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-item note */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <FiEdit3
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={item.note || ""}
                      onChange={(e) =>
                        updateNote(item.productId, e.target.value)
                      }
                      maxLength={200}
                      placeholder="Note for this item (optional) — e.g. packaging, expiry preference…"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-teal-500 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Summary ── */}
        <div className="bg-white dark:bg-slate-900 border border-white dark:border-slate-800 rounded-3xl shadow-md shadow-primary-500/5 p-5 lg:sticky lg:top-24">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">
            Order Summary
          </h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Products</span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Total units</span>
              <span>{totalItems}</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Subtotal</span>
              <span className="text-teal-700 dark:text-teal-400">
                {formatPrice(subtotal)}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate("/checkout")}
            className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md shadow-primary-500/25 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            Proceed to Checkout <FiArrowRight size={15} />
          </button>
          <Link
            to="/shop"
            className="block text-center mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
