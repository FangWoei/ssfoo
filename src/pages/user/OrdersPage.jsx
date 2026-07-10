// src/pages/user/OrdersPage.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { getMyOrders } from "@/firebase/orders";
import { formatPrice } from "@/utils/helpers";
import { formatOrderDate, shortId } from "@/utils/orderHelpers";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiArrowRight, FiPackage, FiSearch, FiX } from "react-icons/fi";
import { Link } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

export default function OrdersPage() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await getMyOrders(uid);
        setOrders(data);
      } catch (e) {
        console.error("Load orders failed:", e);
        toast.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        (o.items || []).some((i) => i.name?.toLowerCase().includes(q)),
    );
  }, [orders, search]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* ── Header + search ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Orders
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {orders.length} order{orders.length !== 1 ? "s" : ""} placed
          </p>
        </div>

        <div className="relative sm:w-64">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID or product…"
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-teal-500 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <FiX size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
            <FiPackage size={26} className="text-teal-600 dark:text-teal-400" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {orders.length === 0 ? "No orders yet" : "No matching orders"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            {orders.length === 0
              ? "Your placed orders will appear here."
              : "Try a different search term."}
          </p>
          {orders.length === 0 && (
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors">
              Browse Products <FiArrowRight size={15} />
            </Link>
          )}
        </div>
      ) : (
        /* ── Order cards ── */
        <div className="space-y-3">
          {filtered.map((order) => {
            const items = order.items || [];
            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-teal-500 dark:hover:border-teal-500 transition-colors group">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                    {shortId(order.id)}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {formatOrderDate(order.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex -space-x-2 shrink-0">
                      {items.slice(0, 3).map((i, idx) => (
                        <img
                          key={idx}
                          src={i.image || PLACEHOLDER}
                          alt={i.name}
                          onError={(e) => {
                            e.currentTarget.src = PLACEHOLDER;
                          }}
                          className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900"
                        />
                      ))}
                      {items.length > 3 && (
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          +{items.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {items.length} product{items.length !== 1 ? "s" : ""} ·{" "}
                      {order.totalItems ??
                        items.reduce((n, i) => n + (i.qty || 0), 0)}{" "}
                      units
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-teal-700 dark:text-teal-400">
                      {formatPrice(order.total ?? order.subtotal ?? 0)}
                    </span>
                    <FiArrowRight
                      size={15}
                      className="text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
