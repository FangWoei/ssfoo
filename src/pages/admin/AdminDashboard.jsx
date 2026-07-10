// src/pages/admin/AdminDashboard.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import RefreshControl from "@/components/common/RefreshControl";
import { getAllOrders } from "@/firebase/orders";
import { getAllOutlets } from "@/firebase/outlets";
import { getProducts } from "@/firebase/products";
import { LOW_STOCK_THRESHOLD } from "@/utils/config";
import { formatPrice } from "@/utils/helpers";
import { formatOrderDate, shortId } from "@/utils/orderHelpers";
import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBox,
  FiDollarSign,
  FiHome,
  FiInbox,
  FiShoppingBag,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "90d", label: "3 Months", days: 90 },
  { key: "all", label: "All Time", days: null },
];

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [outletCount, setOutletCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [ords, prods, outs] = await Promise.all([
      getAllOrders({ pageSize: 300 }),
      getProducts({ pageSize: 200 }),
      getAllOutlets(),
    ]);
    setOrders(ords);
    setProducts(prods.products);
    setOutletCount(outs.filter((o) => o.active !== false).length);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchAll();
      } catch (e) {
        console.error("Dashboard load failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  // Low-stock products (#2)
  const lowStockProducts = products
    .filter(
      (p) => p.status === "active" && (p.stock || 0) <= LOW_STOCK_THRESHOLD,
    )
    .sort((a, b) => (a.stock || 0) - (b.stock || 0));

  const rangeDays = RANGES.find((r) => r.key === range)?.days;

  const filteredOrders = useMemo(() => {
    if (!rangeDays) return orders;
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return orders.filter((o) => {
      const d = o.createdAt?.toDate?.();
      return d && d.getTime() >= cutoff;
    });
  }, [orders, rangeDays]);

  const stats = useMemo(() => {
    const revenue = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
    const newOrders = orders.filter((o) => o.done === false).length;
    return { revenue, count: filteredOrders.length, newOrders };
  }, [filteredOrders, orders]);

  // Revenue by day for the chart
  const chartData = useMemo(() => {
    const days = rangeDays || 90;
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
      });
      map[key] = 0;
    }
    for (const o of filteredOrders) {
      const d = o.createdAt?.toDate?.();
      if (!d) continue;
      const key = d.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
      });
      if (key in map) map[key] += o.total || 0;
    }
    return Object.entries(map).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }));
  }, [filteredOrders, rangeDays]);

  // Top products by units ordered
  const topProducts = useMemo(() => {
    const map = {};
    for (const o of filteredOrders) {
      for (const i of o.items || []) {
        if (!map[i.productId])
          map[i.productId] = { name: i.name, qty: 0, revenue: 0 };
        map[i.productId].qty += i.qty || 0;
        map[i.productId].revenue += (i.price || 0) * (i.qty || 0);
      }
    }
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredOrders]);

  // Top outlets by revenue
  const topOutlets = useMemo(() => {
    const map = {};
    for (const o of filteredOrders) {
      const key = o.outletId || "unknown";
      if (!map[key])
        map[key] = {
          outletId: key,
          name: o.outletName || key,
          revenue: 0,
          count: 0,
        };
      map[key].revenue += o.total || 0;
      map[key].count += 1;
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

  const recentOrders = orders.slice(0, 5);

  if (loading) return <LoadingSpinner fullPage />;

  const statCards = [
    {
      label: "Revenue",
      value: formatPrice(stats.revenue),
      icon: FiDollarSign,
      accent: "text-primary-600 bg-primary-50 dark:bg-primary-900/30",
    },
    {
      label: "Orders",
      value: stats.count,
      icon: FiShoppingBag,
      accent: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
    },
    {
      label: "New Orders",
      value: stats.newOrders,
      icon: FiInbox,
      accent: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
      link: "/admin/orders",
    },
    {
      label: "Products",
      value: products.length,
      icon: FiBox,
      accent: "text-violet-600 bg-violet-50 dark:bg-violet-900/30",
      link: "/admin/products",
    },
    {
      label: "Active Outlets",
      value: outletCount,
      icon: FiHome,
      accent: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
      link: "/admin/outlets",
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header + range ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Dashboard
          </h1>
          <p className="text-dark-400 text-sm">Business overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  range === r.key
                    ? "bg-primary-600 text-white"
                    : "bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 text-dark-500 dark:text-dark-400 hover:border-primary-500"
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          <RefreshControl
            onRefresh={doRefresh}
            refreshing={refreshing}
            storageKey="ssfoo-refresh-dashboard"
          />
        </div>
      </div>

      {/* ── Low-stock alert (#2) ── */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiAlertTriangle
              size={16}
              className="text-amber-600 dark:text-amber-400"
            />
            <h2 className="font-bold text-sm text-amber-800 dark:text-amber-300">
              Low Stock Alert
            </h2>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {lowStockProducts.length} product
              {lowStockProducts.length > 1 ? "s" : ""} at or below{" "}
              {LOW_STOCK_THRESHOLD} units
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.slice(0, 9).map((p) => (
              <Link
                key={p.id}
                to={`/admin/products/${p.id}/edit`}
                className="flex items-center justify-between gap-2 bg-white dark:bg-dark-900 rounded-xl px-3 py-2 hover:ring-1 hover:ring-amber-300 transition-all">
                <span className="text-xs font-medium text-dark-800 dark:text-dark-200 truncate">
                  {p.itemCode && (
                    <span className="font-mono text-primary-600 dark:text-primary-400 mr-1">
                      {p.itemCode}
                    </span>
                  )}
                  {p.name}
                </span>
                <span
                  className={`text-xs font-bold shrink-0 ${
                    (p.stock || 0) === 0
                      ? "text-red-500"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                  {p.stock || 0} left
                </span>
              </Link>
            ))}
          </div>
          {lowStockProducts.length > 9 && (
            <Link
              to="/admin/products"
              className="inline-block mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">
              +{lowStockProducts.length - 9} more — view all products
            </Link>
          )}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((c) => {
          const Card = (
            <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-4 h-full hover:border-primary-400 transition-colors">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.accent}`}>
                <c.icon size={17} />
              </div>
              <p className="text-lg font-bold text-dark-900 dark:text-dark-100 leading-tight">
                {c.value}
              </p>
              <p className="text-xs text-dark-400 mt-0.5">{c.label}</p>
            </div>
          );
          return c.link ? (
            <Link key={c.label} to={c.link}>
              {Card}
            </Link>
          ) : (
            <div key={c.label}>{Card}</div>
          );
        })}
      </div>

      {/* ── Revenue chart ── */}
      <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
        <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100 mb-4">
          Revenue
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(v) => `RM${v}`}
              />
              <Tooltip
                formatter={(v) => [formatPrice(v), "Revenue"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top products + top outlets ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
          <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100 mb-3">
            Top Products
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-xs text-dark-400 py-4 text-center">
              No orders in this period
            </p>
          ) : (
            <div className="space-y-2.5">
              {topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-dark-800 dark:text-dark-200">
                    {p.name}
                  </span>
                  <span className="text-xs text-dark-400 shrink-0">
                    {p.qty} units
                  </span>
                  <span className="text-xs font-bold text-dark-900 dark:text-dark-100 shrink-0 w-20 text-right">
                    {formatPrice(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
          <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100 mb-3">
            Top Outlets
          </h2>
          {topOutlets.length === 0 ? (
            <p className="text-xs text-dark-400 py-4 text-center">
              No orders in this period
            </p>
          ) : (
            <div className="space-y-2.5">
              {topOutlets.map((o, idx) => (
                <div
                  key={o.outletId}
                  className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-dark-800 dark:text-dark-200">
                    {o.name}
                  </span>
                  <span className="text-xs text-dark-400 shrink-0">
                    {o.count} orders
                  </span>
                  <span className="text-xs font-bold text-dark-900 dark:text-dark-100 shrink-0 w-20 text-right">
                    {formatPrice(o.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent orders ── */}
      <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-dark-900 dark:text-dark-100">
            Recent Orders
          </h2>
          <Link
            to="/admin/orders"
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-xs text-dark-400 py-4 text-center">
            No orders yet
          </p>
        ) : (
          <div className="divide-y divide-dark-100 dark:divide-dark-800">
            {recentOrders.map((o) => (
              <Link
                key={o.id}
                to={`/admin/orders/${o.id}`}
                className="flex items-center gap-3 py-2.5 text-sm hover:bg-dark-50 dark:hover:bg-dark-800/50 -mx-2 px-2 rounded-lg transition-colors">
                <span className="font-mono font-bold text-dark-900 dark:text-dark-100 shrink-0">
                  {shortId(o.id)}
                </span>
                {o.done === false && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase shrink-0">
                    New
                  </span>
                )}
                <span className="flex-1 min-w-0 truncate text-dark-500 dark:text-dark-400">
                  {o.outletName || o.outletId}
                </span>
                <span className="text-xs text-dark-400 shrink-0 hidden sm:block">
                  {formatOrderDate(o.createdAt)}
                </span>
                <span className="font-bold text-primary-700 dark:text-primary-400 shrink-0">
                  {formatPrice(o.total || 0)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
