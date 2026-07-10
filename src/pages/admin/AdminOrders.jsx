// src/pages/admin/AdminOrders.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import RefreshControl from "@/components/common/RefreshControl";
import { getAllOrders, toggleOrderDone } from "@/firebase/orders";
import { exportOrdersToExcel } from "@/utils/exporters";
import { formatPrice } from "@/utils/helpers";
import { formatOrderDate, shortId } from "@/utils/orderHelpers";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowRight,
  FiCheck,
  FiDownload,
  FiInbox,
  FiRotateCcw,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";

const TABS = [
  { key: "new", label: "New" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

const TIME_RANGES = [
  { key: "all", label: "All time", days: null },
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("new");
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    const data = await getAllOrders({ pageSize: 300 });
    setOrders(data);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchOrders();
      } catch (e) {
        console.error("Load orders failed:", e);
        toast.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchOrders();
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const counts = useMemo(
    () => ({
      new: orders.filter((o) => o.done === false).length,
      done: orders.filter((o) => o.done === true).length,
      all: orders.length,
    }),
    [orders],
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (tab === "new") list = list.filter((o) => o.done === false);
    if (tab === "done") list = list.filter((o) => o.done === true);

    const days = TIME_RANGES.find((r) => r.key === timeRange)?.days;
    if (days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      list = list.filter((o) => {
        const d = o.createdAt?.toDate?.();
        return d && d.getTime() >= cutoff;
      });
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.outletId?.toLowerCase().includes(q) ||
          o.outletName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [orders, tab, search, timeRange]);

  const handleToggle = async (order) => {
    const next = !order.done;
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, done: next } : o)),
    );
    try {
      await toggleOrderDone(order.id, next);
      toast.success(next ? "Marked as done" : "Moved back to new");
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, done: !next } : o)),
      );
      toast.error("Failed to update");
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No orders to export");
      return;
    }
    exportOrdersToExcel(filtered, "ssfoo_orders");
    toast.success(`Exported ${filtered.length} orders`);
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Orders
          </h1>
          <p className="text-dark-400 text-sm">
            {counts.new} new · {counts.all} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshControl
            onRefresh={doRefresh}
            refreshing={refreshing}
            storageKey="ssfoo-refresh-orders"
          />
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
            <FiDownload size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* ── Tabs + search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t.key
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500"
              }`}>
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto sm:w-64">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID or outlet…"
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 focus:border-primary-500 text-dark-700 dark:text-dark-200 outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400">
              <FiX size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Time range ── */}
      <div className="flex gap-1.5 flex-wrap">
        {TIME_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setTimeRange(r.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              timeRange === r.key
                ? "bg-dark-900 dark:bg-dark-100 text-white dark:text-dark-900"
                : "bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500"
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Order list ── */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FiInbox size={28} className="text-dark-300 mb-3" />
            <p className="text-sm text-dark-400">
              {tab === "new" ? "No new orders 🎉" : "No orders found"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-dark-100 dark:divide-dark-800">
            {filtered.map((o) => {
              const isNew = o.done === false;
              return (
                <div
                  key={o.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isNew
                      ? "bg-amber-50/50 dark:bg-amber-900/5"
                      : "hover:bg-dark-50 dark:hover:bg-dark-800/50"
                  }`}>
                  {/* Done toggle */}
                  <button
                    onClick={() => handleToggle(o)}
                    title={isNew ? "Mark as done" : "Move back to new"}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isNew
                        ? "border-2 border-dark-300 dark:border-dark-600 text-transparent hover:border-primary-500 hover:text-primary-500"
                        : "bg-primary-600 text-white hover:bg-primary-700"
                    }`}>
                    {isNew ? <FiCheck size={14} /> : <FiRotateCcw size={13} />}
                  </button>

                  <Link
                    to={`/admin/orders/${o.id}`}
                    className="flex-1 flex items-center gap-3 min-w-0 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-dark-900 dark:text-dark-100">
                          {shortId(o.id)}
                        </span>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-dark-400 truncate">
                        {o.outletName || o.outletId} · {(o.items || []).length}{" "}
                        products · {formatOrderDate(o.createdAt)}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-primary-700 dark:text-primary-400 shrink-0">
                      {formatPrice(o.total || 0)}
                    </span>
                    <FiArrowRight
                      size={15}
                      className="text-dark-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
