// src/pages/admin/AdminDashboard.jsx
import AutoRefreshSelector from "@/components/common/AutoRefreshSelector";
import { db } from "@/firebase/config";
import useAutoRefresh, { INTERVALS } from "@/hooks/useAutoRefresh";
import { formatPrice, ORDER_STATUS, tsToDate } from "@/utils/helpers";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowRight,
  FiArrowUp,
  FiBox,
  FiCalendar,
  FiDollarSign,
  FiDownload,
  FiGift,
  FiShoppingBag,
  FiTrendingUp,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Date range presets ────────────────────────────────
const DATE_RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7days", label: "1 Week", days: 7 },
  { key: "30days", label: "1 Month", days: 30 },
  { key: "90days", label: "3 Months", days: 90 },
  { key: "180days", label: "6 Months", days: 180 },
  { key: "year", label: "1 Year", days: 365 },
  { key: "all", label: "All Time", days: 99999 },
];

const getRangeStart = (rangeKey) => {
  const now = new Date();
  if (rangeKey === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (rangeKey === "all") {
    return new Date(2000, 0, 1);
  }
  const range = DATE_RANGES.find((r) => r.key === rangeKey);
  const start = new Date();
  start.setDate(now.getDate() - (range?.days || 30));
  start.setHours(0, 0, 0, 0);
  return start;
};

const getPrevRangeStart = (rangeKey) => {
  const range = DATE_RANGES.find((r) => r.key === rangeKey);
  const days = range?.days || 30;
  const start = new Date();
  start.setDate(start.getDate() - days * 2);
  start.setHours(0, 0, 0, 0);
  return start;
};

const calcChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

// ── StatCard ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, change, color, subtext }) {
  const positive = change >= 0;
  const showChange = change !== undefined && change !== null;
  return (
    <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        {showChange && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}
            title="Compared to previous period">
            {positive ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}{" "}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-dark-900 dark:text-dark-100">
        {value}
      </p>
      <p className="text-xs text-dark-400 mt-0.5">{label}</p>
      {subtext && <p className="text-[10px] text-dark-400 mt-1">{subtext}</p>}
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg p-2.5">
      <p className="text-xs font-medium text-dark-900 dark:text-dark-100 mb-1">
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color || p.fill }}>
          {p.name}:{" "}
          {typeof p.value === "number" &&
          p.name?.toLowerCase().includes("revenue")
            ? formatPrice(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
}

const STATUS_COLORS = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

// ── Main Dashboard ───────────────────────────────────
export default function AdminDashboard() {
  const [range, setRange] = useState("30days");
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [allOrders, setAllOrders] = useState([]);
  const [users, setUsers] = useState(0);
  const [products, setProducts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStock, setLowStock] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Ref for capturing dashboard for PDF
  const dashboardRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersSnap, usersSnap, productsSnap, recentSnap] =
        await Promise.all([
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "products")),
          getDocs(
            query(
              collection(db, "orders"),
              orderBy("createdAt", "desc"),
              limit(5),
            ),
          ),
        ]);

      const allOrdersData = ordersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const productsData = productsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setAllOrders(allOrdersData);
      setUsers(usersSnap.size);
      setProducts(productsData);
      setRecent(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const lowStockItems = [];
      productsData.forEach((p) => {
        (p.variants || []).forEach((v) => {
          if (v.stock <= 3 && v.stock >= 0) {
            lowStockItems.push({
              productId: p.id,
              productName: p.name,
              variantId: v.id,
              variantLabel: v.label,
              stock: v.stock,
            });
          }
        });
      });
      setLowStock(lowStockItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Filter orders by current range ──────────────────
  const filteredOrders = useMemo(() => {
    if (range === "custom" && customFrom && customTo) {
      const fromDate = new Date(customFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);
      return allOrders.filter((o) => {
        const date = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        return date >= fromDate && date <= toDate;
      });
    }
    const start = getRangeStart(range);
    return allOrders.filter((o) => {
      const date = o.createdAt?.toDate
        ? o.createdAt.toDate()
        : new Date(o.createdAt);
      return date >= start;
    });
  }, [allOrders, range, customFrom, customTo]);

  // ── Previous period orders ──────────────────────────
  const prevPeriodOrders = useMemo(() => {
    if (range === "custom" && customFrom && customTo) {
      const fromDate = new Date(customFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);
      const rangeDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
      const prevTo = new Date(fromDate);
      prevTo.setDate(prevTo.getDate() - 1);
      prevTo.setHours(23, 59, 59, 999);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - rangeDays);
      prevFrom.setHours(0, 0, 0, 0);
      return allOrders.filter((o) => {
        const date = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        return date >= prevFrom && date <= prevTo;
      });
    }
    if (range === "all") return [];
    const prevStart = getPrevRangeStart(range);
    const currStart = getRangeStart(range);
    return allOrders.filter((o) => {
      const date = o.createdAt?.toDate
        ? o.createdAt.toDate()
        : new Date(o.createdAt);
      return date >= prevStart && date < currStart;
    });
  }, [allOrders, range, customFrom, customTo]);

  // ── Stats ───────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = filteredOrders.filter((o) => o.status !== "cancelled");
    const revenue = completed.reduce((s, o) => s + (o.total || 0), 0);
    const orderCount = filteredOrders.length;
    const aov = orderCount > 0 ? revenue / orderCount : 0;

    const prevCompleted = prevPeriodOrders.filter(
      (o) => o.status !== "cancelled",
    );
    const prevRevenue = prevCompleted.reduce((s, o) => s + (o.total || 0), 0);
    const prevOrderCount = prevPeriodOrders.length;
    const prevAov = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

    return {
      revenue,
      orderCount,
      aov,
      revenueChange: calcChange(revenue, prevRevenue),
      ordersChange: calcChange(orderCount, prevOrderCount),
      aovChange: calcChange(aov, prevAov),
    };
  }, [filteredOrders, prevPeriodOrders]);

  // ── Hamper sales ────────────────────────────────────
  const hamperStats = useMemo(() => {
    let hamperRevenue = 0;
    let hamperCount = 0;
    filteredOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const isHamper =
          item.category?.toLowerCase().includes("hamper") ||
          item.productName?.toLowerCase().includes("hamper") ||
          item.name?.toLowerCase().includes("hamper");
        if (isHamper && o.status !== "cancelled") {
          hamperRevenue += (item.price || 0) * (item.qty || 1);
          hamperCount += item.qty || 1;
        }
      });
    });
    return { revenue: hamperRevenue, count: hamperCount };
  }, [filteredOrders]);

  // ── Revenue trend chart data ────────────────────────
  const revenueChartData = useMemo(() => {
    let daysCount;
    let endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    if (range === "custom" && customFrom && customTo) {
      const fromDate = new Date(customFrom);
      const toDate = new Date(customTo);
      daysCount = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
      endDate = toDate;
      endDate.setHours(0, 0, 0, 0);
    } else if (range === "all") {
      let earliest = new Date();
      filteredOrders.forEach((o) => {
        const d = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (d < earliest) earliest = d;
      });
      daysCount = Math.min(
        Math.ceil((new Date() - earliest) / (1000 * 60 * 60 * 24)) + 1,
        365,
      );
    } else if (range === "today") {
      daysCount = 1;
    } else {
      daysCount = DATE_RANGES.find((r) => r.key === range)?.days || 30;
    }

    const groupByWeek = daysCount > 90;
    const buckets = {};
    const labels = [];

    if (groupByWeek) {
      const weekCount = Math.ceil(daysCount / 7);
      for (let i = weekCount - 1; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(endDate.getDate() - i * 7);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = 0;
        labels.push({
          key,
          label: d.toLocaleDateString("en-MY", {
            month: "short",
            day: "2-digit",
          }),
        });
      }
      filteredOrders.forEach((o) => {
        if (o.status === "cancelled") return;
        const date = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        let closestKey = null;
        let minDiff = Infinity;
        Object.keys(buckets).forEach((k) => {
          const diff = Math.abs(date - new Date(k));
          if (diff < minDiff) {
            minDiff = diff;
            closestKey = k;
          }
        });
        if (closestKey) buckets[closestKey] += o.total || 0;
      });
    } else {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(endDate.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = 0;
        labels.push({
          key,
          label: d.toLocaleDateString("en-MY", {
            month: "short",
            day: "2-digit",
          }),
        });
      }
      filteredOrders.forEach((o) => {
        if (o.status === "cancelled") return;
        const date = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        const key = date.toISOString().slice(0, 10);
        if (buckets[key] !== undefined) {
          buckets[key] += o.total || 0;
        }
      });
    }

    return labels.map((l) => ({
      date: l.label,
      revenue: buckets[l.key] || 0,
    }));
  }, [filteredOrders, range, customFrom, customTo]);

  // ── Order status donut ──────────────────────────────
  const statusChartData = useMemo(() => {
    const counts = {};
    filteredOrders.forEach((o) => {
      const status = o.status || "pending";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: ORDER_STATUS[key]?.label || key,
      value,
      color: STATUS_COLORS[key] || "#9ca3af",
    }));
  }, [filteredOrders]);

  // ── Top products ────────────────────────────────────
  const topProductsData = useMemo(() => {
    const counts = {};
    filteredOrders.forEach((o) => {
      if (o.status === "cancelled") return;
      (o.items || []).forEach((item) => {
        const name = item.productName || item.name || "Unknown";
        counts[name] = (counts[name] || 0) + (item.qty || 1);
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name: name.length > 25 ? name.slice(0, 25) + "…" : name,
        sold: count,
      }));
  }, [filteredOrders]);

  // ── Low stock dismissal ─────────────────────────────
  const [dismissedLowStock, setDismissedLowStock] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissedLowStock") || "[]");
    } catch {
      return [];
    }
  });

  const dismissLowStockItem = (variantId) => {
    const updated = [...dismissedLowStock, variantId];
    setDismissedLowStock(updated);
    localStorage.setItem("dismissedLowStock", JSON.stringify(updated));
  };

  const dismissAllLowStock = () => {
    const allIds = lowStock.map((i) => i.variantId);
    const updated = [...new Set([...dismissedLowStock, ...allIds])];
    setDismissedLowStock(updated);
    localStorage.setItem("dismissedLowStock", JSON.stringify(updated));
  };

  const visibleLowStock = lowStock.filter(
    (i) => !dismissedLowStock.includes(i.variantId),
  );

  // ── PDF EXPORT ──────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const periodLabel =
        range === "custom" && customFrom && customTo
          ? `${customFrom} to ${customTo}`
          : range === "all"
            ? "All Time"
            : DATE_RANGES.find((r) => r.key === range)?.label || "30 Days";

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // ── HEADER ──
      pdf.setFillColor(209, 68, 32); // primary-600
      pdf.rect(0, 0, pageWidth, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Ladybird Marketing", margin, 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Analytics Report", margin, 21);
      pdf.setFontSize(8);
      pdf.text(
        `Generated: ${new Date().toLocaleString("en-MY")}`,
        pageWidth - margin,
        14,
        { align: "right" },
      );
      pdf.text(`Period: ${periodLabel}`, pageWidth - margin, 21, {
        align: "right",
      });

      y = 38;
      pdf.setTextColor(0, 0, 0);

      // ── KPI CARDS (4 in a row) ──
      const cardWidth = (contentWidth - 6) / 4;
      const cardHeight = 28;
      const kpis = [
        {
          label: "Revenue",
          value: formatPrice(stats.revenue),
          change: range === "all" ? null : stats.revenueChange,
          color: [209, 68, 32],
        },
        {
          label: "Orders",
          value: String(stats.orderCount),
          change: range === "all" ? null : stats.ordersChange,
          color: [59, 130, 246],
        },
        {
          label: "Avg Order Value",
          value: formatPrice(stats.aov),
          change: range === "all" ? null : stats.aovChange,
          color: [139, 92, 246],
        },
        {
          label: "Hamper Sales",
          value: formatPrice(hamperStats.revenue),
          subtext: `${hamperStats.count} sold`,
          color: [236, 72, 153],
        },
      ];

      kpis.forEach((kpi, i) => {
        const x = margin + i * (cardWidth + 2);
        // Card background
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(230, 230, 230);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");
        // Color tab
        pdf.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        pdf.rect(x, y, 2, cardHeight, "F");
        // Label
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(120, 120, 120);
        pdf.text(kpi.label.toUpperCase(), x + 5, y + 6);
        // Value
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(20, 20, 20);
        pdf.text(kpi.value, x + 5, y + 14);
        // Change/subtext
        if (kpi.change !== null && kpi.change !== undefined) {
          const positive = kpi.change >= 0;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(
            positive ? 34 : 239,
            positive ? 197 : 68,
            positive ? 94 : 68,
          );
          pdf.text(
            `${positive ? "↑" : "↓"} ${Math.abs(kpi.change)}% vs prev`,
            x + 5,
            y + 22,
          );
        } else if (kpi.subtext) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(120, 120, 120);
          pdf.text(kpi.subtext, x + 5, y + 22);
        }
      });
      y += cardHeight + 6;

      // ── CAPTURE CHARTS as image ──
      if (dashboardRef.current) {
        const chartsEl = dashboardRef.current.querySelector(
          "#charts-section-for-pdf",
        );
        if (chartsEl) {
          try {
            const canvas = await html2canvas(chartsEl, {
              scale: 2,
              backgroundColor: "#ffffff",
              logging: false,
              useCORS: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            // Page break if needed
            if (y + imgHeight > pageHeight - 20) {
              pdf.addPage();
              y = margin;
            }
            pdf.addImage(imgData, "PNG", margin, y, contentWidth, imgHeight);
            y += imgHeight + 6;
          } catch (e) {
            console.error("Chart capture failed:", e);
          }
        }

        // Capture top products chart
        const topProductsEl = dashboardRef.current.querySelector(
          "#top-products-for-pdf",
        );
        if (topProductsEl && topProductsData.length > 0) {
          try {
            const canvas = await html2canvas(topProductsEl, {
              scale: 2,
              backgroundColor: "#ffffff",
              logging: false,
              useCORS: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            if (y + imgHeight > pageHeight - 20) {
              pdf.addPage();
              y = margin;
            }
            pdf.addImage(imgData, "PNG", margin, y, contentWidth, imgHeight);
            y += imgHeight + 6;
          } catch (e) {
            console.error("Top products capture failed:", e);
          }
        }
      }

      // ── LOW STOCK SECTION ──
      if (visibleLowStock.length > 0) {
        if (y > pageHeight - 50) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(245, 158, 11);
        pdf.text(`Low Stock Alert (${visibleLowStock.length})`, margin, y);
        y += 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(60, 60, 60);
        visibleLowStock.slice(0, 8).forEach((item) => {
          if (y > pageHeight - 15) {
            pdf.addPage();
            y = margin;
          }
          const stockLabel = item.stock === 0 ? "OUT" : `${item.stock} left`;
          pdf.text(
            `• ${item.productName} (${item.variantLabel}) — ${stockLabel}`,
            margin + 2,
            y,
          );
          y += 4.5;
        });
        if (visibleLowStock.length > 8) {
          pdf.setFont("helvetica", "italic");
          pdf.text(`...and ${visibleLowStock.length - 8} more`, margin + 2, y);
          y += 5;
        }
        y += 4;
      }

      // ── RECENT ORDERS TABLE ──
      if (recent.length > 0) {
        if (y > pageHeight - 60) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(20, 20, 20);
        pdf.text("Recent Orders", margin, y);
        y += 6;

        // Table header
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, y - 4, contentWidth, 6, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(80, 80, 80);
        pdf.text("Order ID", margin + 2, y);
        pdf.text("Date", margin + 35, y);
        pdf.text("Customer", margin + 70, y);
        pdf.text("Status", margin + 130, y);
        pdf.text("Total", pageWidth - margin - 2, y, { align: "right" });
        y += 4;

        // Rows
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(40, 40, 40);
        recent.forEach((order) => {
          if (y > pageHeight - 15) {
            pdf.addPage();
            y = margin;
          }
          const orderId = `#${order.id.slice(0, 8).toUpperCase()}`;
          const date = tsToDate(order.createdAt) || "—";
          const customer = (order.address?.fullName || "—").slice(0, 25);
          const status =
            ORDER_STATUS[order.status]?.label || order.status || "—";
          const total = formatPrice(order.total);

          pdf.text(orderId, margin + 2, y);
          pdf.text(String(date).slice(0, 18), margin + 35, y);
          pdf.text(customer, margin + 70, y);
          pdf.text(status, margin + 130, y);
          pdf.text(total, pageWidth - margin - 2, y, { align: "right" });
          y += 5;
        });
      }

      // ── FOOTER on every page ──
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text("Ladybird Marketing • Confidential", margin, pageHeight - 6);
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - margin,
          pageHeight - 6,
          { align: "right" },
        );
      }

      // Save
      const filename = `ladybird_analytics_${periodLabel.replace(/[\/\s]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
      toast.success("PDF exported! 📄");
    } catch (e) {
      console.error(e);
      toast.error("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const {
    interval,
    setInterval: setIntervalVal,
    countdown,
  } = useAutoRefresh(load, "adminDashboardRefresh");

  // Period label helper for subtext
  const periodLabel =
    range === "custom"
      ? "previous period"
      : range === "all"
        ? "all time"
        : (
            DATE_RANGES.find((r) => r.key === range)?.label || "period"
          ).toLowerCase();

  return (
    <div className="space-y-6" ref={dashboardRef}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Dashboard
          </h1>
          <p className="text-dark-400 text-sm mt-0.5">
            Welcome back! Here's what's happening.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AutoRefreshSelector
            interval={interval}
            setInterval={setIntervalVal}
            countdown={countdown}
            INTERVALS={INTERVALS}
            onRefresh={load}
          />
          {/* ✅ Export PDF button */}
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading}
            className="btn-outline gap-2 text-sm py-2 px-3 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800 disabled:opacity-50">
            <FiDownload size={14} />
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* ✅ Date range filter with custom option */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-dark-500 dark:text-dark-400 mr-2">
            Period:
          </span>
          {DATE_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setRange(r.key);
                setShowCustom(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r.key
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-dark-300"
              }`}>
              {r.label}
            </button>
          ))}
          <button
            onClick={() => {
              setShowCustom((s) => !s);
              if (!showCustom) setRange("custom");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              range === "custom"
                ? "bg-primary-600 text-white"
                : "bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-dark-300"
            }`}>
            <FiCalendar size={11} /> Custom
          </button>
        </div>

        {showCustom && (
          <div className="flex items-center gap-2 flex-wrap p-3 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-dark-600 dark:text-dark-400">
                From:
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || new Date().toISOString().slice(0, 10)}
                className="text-xs border border-dark-200 dark:border-dark-700 rounded-lg px-2.5 py-1 bg-white dark:bg-dark-900 dark:text-dark-100 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-dark-600 dark:text-dark-400">
                To:
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
                max={new Date().toISOString().slice(0, 10)}
                className="text-xs border border-dark-200 dark:border-dark-700 rounded-lg px-2.5 py-1 bg-white dark:bg-dark-900 dark:text-dark-100 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
            </div>
            {customFrom && customTo && (
              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                {Math.ceil(
                  (new Date(customTo) - new Date(customFrom)) /
                    (1000 * 60 * 60 * 24),
                ) + 1}{" "}
                days
              </span>
            )}
            {(customFrom || customTo) && (
              <button
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className="text-xs text-dark-500 hover:text-red-500 ml-auto">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      {visibleLowStock.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <FiAlertTriangle
                  size={16}
                  className="text-amber-600 dark:text-amber-400"
                />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                  Low Stock Alert
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {visibleLowStock.length} variant
                  {visibleLowStock.length > 1 ? "s" : ""} running low (≤ 3
                  units)
                </p>
              </div>
            </div>
            <button
              onClick={dismissAllLowStock}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 border border-amber-200 dark:border-amber-700 px-2.5 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
              Dismiss All
            </button>
          </div>
          <div className="space-y-2">
            {visibleLowStock.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white dark:bg-dark-900 rounded-xl px-3 py-2.5 border border-amber-100 dark:border-amber-800/50">
                <div>
                  <p className="text-sm font-medium text-dark-900 dark:text-dark-100">
                    {item.productName}
                  </p>
                  <p className="text-xs text-dark-400">{item.variantLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-bold ${
                      item.stock === 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                    {item.stock === 0 ? "Out of stock" : `${item.stock} left`}
                  </span>
                  <Link
                    to={`/admin/products/${item.productId}`}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                    Edit
                  </Link>
                  <button
                    onClick={() => dismissLowStockItem(item.variantId)}
                    className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 transition-colors"
                    title="Dismiss">
                    <FiX size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FiDollarSign}
          label="Revenue"
          value={formatPrice(stats.revenue)}
          change={range === "all" ? undefined : stats.revenueChange}
          color="bg-primary-500"
          subtext={range === "all" ? "All time" : `vs previous ${periodLabel}`}
        />
        <StatCard
          icon={FiShoppingBag}
          label="Orders"
          value={stats.orderCount}
          change={range === "all" ? undefined : stats.ordersChange}
          color="bg-blue-500"
          subtext={range === "all" ? "All time" : `vs previous ${periodLabel}`}
        />
        <StatCard
          icon={FiTrendingUp}
          label="Avg Order Value"
          value={formatPrice(stats.aov)}
          change={range === "all" ? undefined : stats.aovChange}
          color="bg-purple-500"
          subtext={range === "all" ? "All time" : `vs previous ${periodLabel}`}
        />
        <StatCard
          icon={FiGift}
          label="Hamper Sales 🎁"
          value={formatPrice(hamperStats.revenue)}
          color="bg-pink-500"
          subtext={`${hamperStats.count} hampers sold`}
        />
      </div>

      {/* Charts row — wrapped for PDF capture */}
      <div id="charts-section-for-pdf" className="grid lg:grid-cols-3 gap-4">
        {/* Revenue line chart */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-dark-900 dark:text-dark-100">
              📈 Revenue Trend
            </h2>
            <span className="text-xs text-dark-400">
              {range === "custom" && customFrom && customTo
                ? `${customFrom} to ${customTo}`
                : range === "all"
                  ? "All time"
                  : DATE_RANGES.find((r) => r.key === range)?.label}
            </span>
          </div>
          {revenueChartData.length === 0 ||
          revenueChartData.every((d) => d.revenue === 0) ? (
            <div className="h-64 flex items-center justify-center text-dark-400 text-sm">
              No revenue in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickFormatter={(v) => `RM${v}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#d14420"
                  strokeWidth={2.5}
                  dot={{ fill: "#d14420", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order status donut */}
        <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5">
          <h2 className="font-semibold text-dark-900 dark:text-dark-100 mb-4">
            📊 Order Status
          </h2>
          {statusChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-dark-400 text-sm">
              No orders yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top products bar chart */}
      <div
        id="top-products-for-pdf"
        className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5">
        <h2 className="font-semibold text-dark-900 dark:text-dark-100 mb-4">
          🏆 Top 5 Products by Sales
        </h2>
        {topProductsData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-dark-400 text-sm">
            No product sales yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topProductsData}
              layout="vertical"
              margin={{ left: 80 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                opacity={0.3}
              />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={140}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="sold"
                fill="#d14420"
                radius={[0, 6, 6, 0]}
                name="Units Sold"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            to: "/admin/products/new",
            label: "Add New Product",
            icon: FiBox,
            color:
              "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800",
          },
          {
            to: "/admin/orders",
            label: "Manage Orders",
            icon: FiShoppingBag,
            color:
              "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
          },
          {
            to: "/admin/users",
            label: "View Customers",
            icon: FiUsers,
            color:
              "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
          },
        ].map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center justify-between p-4 rounded-xl border ${color} hover:shadow-sm transition-shadow`}>
            <div className="flex items-center gap-3">
              <Icon size={18} />
              <span className="font-medium text-sm">{label}</span>
            </div>
            <FiArrowRight size={16} />
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-100 dark:border-dark-800">
          <h2 className="font-semibold text-dark-900 dark:text-dark-100">
            Recent Orders
          </h2>
          <Link
            to="/admin/orders"
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <FiArrowRight size={13} />
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-dark-400 text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-dark-400 text-sm">
            No orders yet.
          </div>
        ) : (
          <div className="divide-y divide-dark-50 dark:divide-dark-800">
            {recent.map((order) => {
              const status = ORDER_STATUS[order.status] || ORDER_STATUS.pending;
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-dark-900 dark:text-dark-100">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-dark-400">
                      {tsToDate(order.createdAt)} · {order.address?.fullName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-sm font-bold text-dark-900 dark:text-dark-100">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
