// src/pages/user/OrderDetail.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { getOrder } from "@/firebase/orders";
import { printOrderPDF } from "@/utils/exporters";
import { formatPrice } from "@/utils/helpers";
import { formatOrderDate, shortId } from "@/utils/orderHelpers";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiArrowLeft, FiFileText, FiPackage, FiPrinter } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

export default function OrderDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const outletId = profile?.outletId || user?.outletId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrder(id);
        // Only allow viewing own outlet's orders
        if (data && data.outletId === outletId) {
          setOrder(data);
        }
      } catch (e) {
        console.error("Load order failed:", e);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, outletId]);

  if (loading) return <LoadingSpinner fullPage />;

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <FiPackage size={36} className="text-slate-300 mb-4" />
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Order not found
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          This order doesn't exist or belongs to another outlet.
        </p>
        <Link
          to="/orders"
          className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">
          Back to My Orders
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const subtotal =
    order.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/orders"
          className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
          title="Back to orders">
          <FiArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {shortId(order.id)}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Placed {formatOrderDate(order.createdAt)}
          </p>
        </div>
        <button
          onClick={() => printOrderPDF(order, { forAdmin: false })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-500 transition-colors shrink-0">
          <FiPrinter size={15} /> PDF
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* ── Items ── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4">
            Items ({items.length})
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item, idx) => (
              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                <div className="flex gap-3 items-center">
                  <img
                    src={item.image || PLACEHOLDER}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER;
                    }}
                    className="w-12 h-12 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatPrice(item.price)} × {item.qty}
                      {item.uom ? ` ${item.uom}` : ""}
                      {item.foc > 0 && (
                        <span className="ml-1.5 font-bold text-teal-600 dark:text-teal-400">
                          🎁 +{item.foc} FOC
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">
                    {formatPrice(item.price * item.qty)}
                  </span>
                </div>
                {item.note?.trim() && (
                  <p className="mt-1.5 text-xs text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded-lg px-3 py-1.5">
                    📝 {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Side: remarks + summary ── */}
        <div className="space-y-4">
          {order.remarks?.trim() && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiFileText
                  size={15}
                  className="text-teal-600 dark:text-teal-400"
                />
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Order Remarks
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {order.remarks}
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3">
              Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Products</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total units</span>
                <span>
                  {order.totalItems ??
                    items.reduce((n, i) => n + (i.qty || 0), 0)}
                </span>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex justify-between font-bold text-slate-900 dark:text-slate-100">
                <span>Total</span>
                <span className="text-teal-700 dark:text-teal-400">
                  {formatPrice(order.total ?? subtotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
