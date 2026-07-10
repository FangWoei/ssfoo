// src/pages/admin/AdminOrderDetail.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getOrder, toggleOrderDone } from "@/firebase/orders";
import { getOutlet } from "@/firebase/outlets";
import { exportOrderClientFormat, printOrderPDF } from "@/utils/exporters";
import { formatPrice } from "@/utils/helpers";
import { formatOrderDate, shortId } from "@/utils/orderHelpers";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiCheck,
  FiDownload,
  FiFileText,
  FiHome,
  FiPackage,
  FiPrinter,
  FiRotateCcw,
} from "react-icons/fi";
import { Link, useParams } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [outlet, setOutlet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrder(id);
        setOrder(data);
        if (data?.userId) {
          const out = await getOutlet(data.userId);
          setOutlet(out);
        }
      } catch (e) {
        console.error("Load order failed:", e);
        toast.error("Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleToggle = async () => {
    if (!order || toggling) return;
    const next = !order.done;
    setToggling(true);
    try {
      await toggleOrderDone(order.id, next);
      setOrder((o) => ({ ...o, done: next }));
      toast.success(next ? "Marked as done" : "Moved back to new");
    } catch {
      toast.error("Failed to update");
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  if (!order) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <FiPackage size={36} className="text-dark-300 mb-4" />
        <p className="font-semibold text-dark-900 dark:text-dark-100 mb-1">
          Order not found
        </p>
        <Link
          to="/admin/orders"
          className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">
          Back to Orders
        </Link>
      </div>
    );
  }

  const isNew = order.done === false;
  const items = order.items || [];
  const subtotal =
    order.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/orders"
          className="p-2 rounded-lg text-dark-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <FiArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold font-mono text-dark-900 dark:text-dark-100">
              {shortId(order.id)}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                isNew
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                  : "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
              }`}>
              {isNew ? "New" : "Done"}
            </span>
          </div>
          <p className="text-xs text-dark-400 mt-0.5">
            Placed {formatOrderDate(order.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportOrderClientFormat(order)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-500 transition-colors">
            <FiDownload size={15} /> Excel
          </button>
          <button
            onClick={() => printOrderPDF(order, { outlet, forAdmin: true })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-500 transition-colors">
            <FiPrinter size={15} /> PDF
          </button>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
              isNew
                ? "bg-primary-600 hover:bg-primary-700 text-white"
                : "border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-500"
            }`}>
            {isNew ? (
              <>
                <FiCheck size={15} /> Mark as Done
              </>
            ) : (
              <>
                <FiRotateCcw size={14} /> Move to New
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="space-y-4">
          {/* ── Outlet info ── */}
          <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FiHome
                size={15}
                className="text-primary-600 dark:text-primary-400"
              />
              <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100">
                Outlet
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-xs text-dark-400 block">Outlet ID</span>
                <span className="font-semibold text-dark-900 dark:text-dark-100">
                  {order.outletId || "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-dark-400 block">Name</span>
                <span className="font-semibold text-dark-900 dark:text-dark-100">
                  {order.outletName || outlet?.outletName || "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-dark-400 block">Email</span>
                <span className="font-semibold text-dark-900 dark:text-dark-100 break-all">
                  {outlet?.email || "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-dark-400 block">Phone</span>
                <span className="font-semibold text-dark-900 dark:text-dark-100">
                  {outlet?.phone || "—"}
                </span>
              </div>
              {outlet?.address && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-dark-400 block">Address</span>
                  <span className="font-semibold text-dark-900 dark:text-dark-100">
                    {outlet.address}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Items ── */}
          <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100 mb-4">
              Items ({items.length})
            </h2>
            <div className="divide-y divide-dark-100 dark:divide-dark-800">
              {items.map((item, idx) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex gap-3 items-center">
                    <img
                      src={item.image || PLACEHOLDER}
                      alt={item.name}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                      className="w-12 h-12 rounded-lg object-cover bg-dark-100 dark:bg-dark-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-dark-900 dark:text-dark-100 truncate">
                        {item.itemCode && (
                          <span className="font-mono text-primary-600 dark:text-primary-400 mr-1.5">
                            {item.itemCode}
                          </span>
                        )}
                        {item.name}
                      </p>
                      <p className="text-xs text-dark-400">
                        {formatPrice(item.price)} × {item.qty}
                        {item.uom ? ` ${item.uom}` : ""}
                        {item.foc > 0 && (
                          <span className="ml-1.5 font-bold text-primary-600 dark:text-primary-400">
                            🎁 +{item.foc} FOC
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-dark-900 dark:text-dark-100 shrink-0">
                      {formatPrice(item.price * item.qty)}
                    </span>
                  </div>
                  {item.note?.trim() && (
                    <p className="mt-1.5 text-xs text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-3 py-1.5">
                      📝 {item.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Side ── */}
        <div className="space-y-4">
          {order.remarks?.trim() && (
            <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiFileText
                  size={15}
                  className="text-primary-600 dark:text-primary-400"
                />
                <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100">
                  Order Remarks
                </h2>
              </div>
              <p className="text-sm text-dark-600 dark:text-dark-300 leading-relaxed whitespace-pre-wrap">
                {order.remarks}
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100 mb-3">
              Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-dark-400">
                <span>Products</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Total units</span>
                <span>
                  {order.totalItems ??
                    items.reduce((n, i) => n + (i.qty || 0), 0)}
                </span>
              </div>
              <div className="border-t border-dark-100 dark:border-dark-800 pt-2.5 flex justify-between font-bold text-dark-900 dark:text-dark-100">
                <span>Total</span>
                <span className="text-primary-700 dark:text-primary-400">
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
