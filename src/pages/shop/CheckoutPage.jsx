// src/pages/shop/CheckoutPage.jsx
import { useAuth } from "@/context/AuthContext";
import useCartStore from "@/context/cartStore";
import { sendOrderEmails } from "@/firebase/email";
import { placeOrder } from "@/firebase/orders";
import { formatPrice } from "@/utils/helpers";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiFileText,
  FiHome,
  FiLoader,
} from "react-icons/fi";
import { Link, Navigate, useNavigate } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const updateNote = useCartStore((s) => s.updateNote);

  const [remarks, setRemarks] = useState("");
  const [placing, setPlacing] = useState(false);
  const placedRef = useRef(false); // prevents empty-cart redirect after success

  const outlet = profile || {};
  const outletId = outlet.outletId || user?.outletId || "";
  const outletName = outlet.outletName || outlet.name || "";

  const subtotal = items.reduce(
    (s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0),
    0,
  );
  const totalItems = items.reduce((s, i) => s + i.qty, 0);
  const getMoq = (item) => Math.max(1, item.minOrder ?? item.moq ?? 1);

  // Guard: nothing to checkout (skip after a successful order)
  if (items.length === 0 && !placedRef.current) {
    return <Navigate to="/cart" replace />;
  }

  const handlePlaceOrder = async () => {
    if (placing || items.length === 0) return;

    if (!user?.uid || !outletId) {
      toast.error("Outlet info missing — please log out and log in again.");
      return;
    }

    // Final MOQ validation
    for (const item of items) {
      const moq = getMoq(item);
      if (item.qty < moq) {
        toast.error(`${item.name}: minimum order quantity is ${moq}`);
        return;
      }
    }

    setPlacing(true);
    try {
      const orderData = {
        outletId,
        outletName,
        items: items.map((i) => ({
          productId: i.productId,
          itemCode: i.itemCode || "",
          name: i.name,
          image: i.thumbnail || i.image || "",
          price: i.price,
          qty: i.qty,
          uom: i.uom || "",
          foc:
            i.focBuy > 0 && i.focFree > 0
              ? Math.floor(i.qty / i.focBuy) * i.focFree
              : 0,
          note: (i.note || "").trim(),
        })),
        totalItems,
        subtotal,
        total: subtotal,
        remarks: remarks.trim(),
        done: false,
      };

      const orderId = await placeOrder(user.uid, orderData);

      // Fire confirmation emails (non-blocking, never throws)
      sendOrderEmails(orderData, orderId, user.email);

      placedRef.current = true;
      clearCart();
      navigate("/order-success", { state: { orderId }, replace: true });
    } catch (e) {
      console.error("Place order failed:", e);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/cart"
          className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
          title="Back to cart">
          <FiArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Checkout
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review and confirm your order
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4">
          {/* ── Outlet info ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FiHome size={16} className="text-teal-600 dark:text-teal-400" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Ordering As
              </h2>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Outlet ID</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {outletId || "—"}
                </span>
              </div>
              {outletName && (
                <div>
                  <span className="text-xs text-slate-400 block">
                    Outlet Name
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {outletName}
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs text-slate-400 block">Email</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {user?.email || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Items review ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4">
              Items ({items.length})
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => (
                <div key={item.productId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <img
                      src={item.thumbnail || item.image || PLACEHOLDER}
                      alt={item.name}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0 self-start"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatPrice(item.price)} × {Number(item.qty) || 0}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 sm:shrink-0 whitespace-nowrap sm:text-right">
                      {formatPrice(
                        (Number(item.price) || 0) * (Number(item.qty) || 0),
                      )}
                    </span>
                  </div>
                  <input
                    value={item.note || ""}
                    onChange={(e) => updateNote(item.productId, e.target.value)}
                    placeholder="📝 Note for this item (optional)…"
                    className="mt-1.5 w-full text-xs rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-teal-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none transition-colors"
                    style={{ minWidth: 0 }}
                  />
                </div>
              ))}
            </div>
            <Link
              to="/cart"
              className="inline-block mt-3 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline">
              ← Back to cart (change quantities)
            </Link>
          </div>

          {/* ── Order remarks ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FiFileText
                size={16}
                className="text-teal-600 dark:text-teal-400"
              />
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Order Remarks{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </h2>
            </div>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Anything the admin should know about this order — delivery timing, invoicing, etc."
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-teal-500 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none resize-none transition-colors"
            />
            <p className="text-right text-[11px] text-slate-400 mt-1">
              {remarks.length}/500
            </p>
          </div>
        </div>

        {/* ── Summary / place order ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 lg:sticky lg:top-24">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">
            Summary
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
              <span>Total</span>
              <span className="text-teal-700 dark:text-teal-400">
                {formatPrice(subtotal)}
              </span>
            </div>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="w-full mt-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            {placing ? (
              <>
                <FiLoader size={15} className="animate-spin" /> Placing order…
              </>
            ) : (
              <>
                <FiCheckCircle size={15} /> Place Order
              </>
            )}
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-3 leading-relaxed">
            Stock will be reserved when the order is placed. The admin will
            confirm and process it.
          </p>
        </div>
      </div>
    </div>
  );
}
