// src/pages/admin/AdminOrders.jsx
import AutoRefreshSelector from "@/components/common/AutoRefreshSelector";
import { getNoteCount } from "@/firebase/orderNotes";
import {
  deleteOrder,
  getAllOrders,
  updateOrderStatus,
} from "@/firebase/orders";
import useAutoRefresh, { INTERVALS } from "@/hooks/useAutoRefresh";
import { exportOrderPDF } from "@/utils/exportOrderPDF";
import { formatPrice, ORDER_STATUS, tsToDate } from "@/utils/helpers";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiCheck,
  FiChevronDown,
  FiDownload,
  FiEye,
  FiMessageSquare,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";

const STATUSES = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// Status transitions valid for bulk update
const BULK_STATUSES = ["processing", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);

  // ✅ Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // ✅ Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const [noteCounts, setNoteCounts] = useState({});

  useEffect(() => {
    if (orders.length === 0) return;
    Promise.all(
      orders.map(async (o) => ({
        id: o.id,
        count: await getNoteCount(o.id),
      })),
    ).then((counts) => {
      const map = {};
      counts.forEach(({ id, count }) => (map[id] = count));
      setNoteCounts(map);
    });
  }, [orders]);

  useEffect(() => {
    load();
  }, [load]);

  const {
    interval,
    setInterval: setIntervalVal,
    countdown,
  } = useAutoRefresh(load, "adminOrdersRefresh");

  const handleStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      toast.success("Status updated");
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(null);
    }
  };

  // ── Search filter ─────────────────────────────────
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      const name = (o.address?.fullName || "").toLowerCase();
      const phone = (o.address?.phone || "").toLowerCase();
      const email = (o.userEmail || "").toLowerCase();
      const orderId = o.id.toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        orderId.includes(q)
      );
    });
  }, [orders, search]);

  const filtered =
    filter === "all"
      ? searchFiltered
      : searchFiltered.filter((o) => o.status === filter);

  const statusCount = (s) =>
    s === "all"
      ? searchFiltered.length
      : searchFiltered.filter((o) => o.status === s).length;

  // ── Group orders by date ──────────────────────────
  const groupOrdersByDate = (orders) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const fmt = (d) => d.toDateString();
    const groups = {};
    orders.forEach((order) => {
      const orderDate = order.createdAt?.toDate
        ? order.createdAt.toDate()
        : new Date(order.createdAt);
      let label;
      if (fmt(orderDate) === fmt(today)) {
        label = "Today";
      } else if (fmt(orderDate) === fmt(yesterday)) {
        label = "Yesterday";
      } else {
        label = orderDate.toLocaleDateString("en-MY", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(order);
    });
    return groups;
  };

  const groupedOrders = groupOrdersByDate(filtered);

  // ── Bulk select handlers ──────────────────────────
  const toggleSelect = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Select all VISIBLE non-completed orders
  const selectableOrders = filtered.filter(
    (o) => o.status !== "cancelled" && o.status !== "delivered",
  );
  const allVisibleSelected =
    selectableOrders.length > 0 &&
    selectableOrders.every((o) => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableOrders.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      // Select all visible selectable
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableOrders.forEach((o) => next.add(o.id));
        return next;
      });
    }
  };

  // ── Selected orders (for bulk delete) ─────────────
  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const selectedDeletableCount = selectedOrders.filter(
    (o) => o.status === "delivered" || o.status === "cancelled",
  ).length;

  // ── Bulk apply status ─────────────────────────────
  const handleBulkApply = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;

    setBulkApplying(true);
    const idsToUpdate = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process in parallel (faster) with toast updates
      const results = await Promise.allSettled(
        idsToUpdate.map((id) => updateOrderStatus(id, bulkStatus)),
      );

      results.forEach((r) => {
        if (r.status === "fulfilled") successCount++;
        else failCount++;
      });

      // Update local state for successful ones
      setOrders((prev) =>
        prev.map((o) =>
          idsToUpdate.includes(o.id) ? { ...o, status: bulkStatus } : o,
        ),
      );

      if (failCount === 0) {
        toast.success(`Updated ${successCount} orders to ${bulkStatus}`);
      } else {
        toast.error(
          `${successCount} updated, ${failCount} failed. Check console.`,
        );
      }
    } catch (e) {
      toast.error("Bulk update failed: " + e.message);
    } finally {
      setBulkApplying(false);
      setBulkConfirm(false);
      setBulkStatus("");
      setSelectedIds(new Set());
    }
  };

  // ── Single delete ─────────────────────────────────
  const handleDelete = async (orderId) => {
    try {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success("Order deleted");
    } catch (e) {
      toast.error("Delete failed: " + e.message);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // ── Bulk delete ───────────────────────────────────
  const handleBulkDelete = async () => {
    const idsToDelete = selectedOrders
      .filter((o) => o.status === "delivered" || o.status === "cancelled")
      .map((o) => o.id);

    if (idsToDelete.length === 0) return;

    setBulkApplying(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const results = await Promise.allSettled(
        idsToDelete.map((id) => deleteOrder(id)),
      );
      results.forEach((r) => {
        if (r.status === "fulfilled") successCount++;
        else failCount++;
      });

      setOrders((prev) => prev.filter((o) => !idsToDelete.includes(o.id)));

      if (failCount === 0) {
        toast.success(`Deleted ${successCount} orders`);
      } else {
        toast.error(`${successCount} deleted, ${failCount} failed`);
      }
    } catch (e) {
      toast.error("Bulk delete failed: " + e.message);
    } finally {
      setBulkApplying(false);
      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkStatus("");
    setBulkConfirm(false);
    setBulkDeleteConfirm(false);
  };

  // ── Shared table row renderer ─────────────────────
  const renderRow = (order) => {
    const isSelected = selectedIds.has(order.id);
    const isCompleted =
      order.status === "cancelled" || order.status === "delivered";
    const isDeletable = isCompleted;

    return (
      <tr
        key={order.id}
        className={`hover:bg-dark-50/40 dark:hover:bg-dark-800/40 transition-colors ${
          isSelected ? "bg-primary-50/30 dark:bg-primary-900/10" : ""
        }`}>
        {/* ✅ Checkbox column */}
        <td className="px-4 py-3 w-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(order.id)}
            className="h-4 w-4 rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-medium text-dark-700 dark:text-dark-300">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            {noteCounts[order.id] > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                title={`${noteCounts[order.id]} note${noteCounts[order.id] > 1 ? "s" : ""}`}>
                <FiMessageSquare size={9} />
                {noteCounts[order.id]}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-dark-900 dark:text-dark-100 text-sm">
            {order.address?.fullName || "—"}
          </p>
          <p className="text-xs text-dark-400">{order.address?.phone}</p>
        </td>
        <td className="px-4 py-3 text-dark-400 text-xs">
          {tsToDate(order.createdAt)}
        </td>
        <td className="px-4 py-3 font-bold text-dark-900 dark:text-dark-100">
          {formatPrice(order.total)}
        </td>
        <td className="px-4 py-3">
          <div className="relative inline-block">
            <select
              value={order.status}
              onChange={(e) => handleStatus(order.id, e.target.value)}
              disabled={
                updating === order.id ||
                order.status === "cancelled" ||
                order.status === "delivered"
              }
              className={`appearance-none text-xs font-medium pl-2.5 pr-7 py-1.5 rounded-full border cursor-pointer focus:outline-none bg-white dark:bg-dark-800 dark:border-dark-700 dark:text-dark-300 ${
                order.status === "cancelled" || order.status === "delivered"
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}>
              {Object.entries(ORDER_STATUS).map(([val, { label }]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            <FiChevronDown
              size={11}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-dark-500 dark:text-dark-400"
            />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Link
              to={`/admin/orders/${order.id}`}
              target="_blank"
              className="p-1.5 text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors inline-flex"
              title="View details">
              <FiEye size={14} />
            </Link>
            <button
              onClick={() => exportOrderPDF(order)}
              className="p-1.5 text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              title="Export PDF">
              <FiDownload size={14} />
            </button>
            {/* ✅ Delete button — only for delivered/cancelled */}
            {isDeletable && (
              <>
                {deleteConfirmId === order.id ? (
                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-xs px-2 py-1 border border-dark-200 dark:border-dark-700 dark:text-dark-400 rounded-lg">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(order.id)}
                    className="p-1.5 text-dark-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete order">
                    <FiTrash2 size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // ── Table header (with select all checkbox) ────────
  const TableHead = () => (
    <thead>
      <tr className="border-b border-dark-100 dark:border-dark-800 bg-dark-50/50 dark:bg-dark-800/50">
        <th className="px-4 py-3 w-10">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            disabled={selectableOrders.length === 0}
            className="h-4 w-4 rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={
              allVisibleSelected
                ? "Deselect all"
                : `Select all ${selectableOrders.length} eligible orders`
            }
          />
        </th>
        {["Order", "Customer", "Date", "Total", "Status", ""].map((h) => (
          <th
            key={h}
            className="text-left px-4 py-3 text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div className="space-y-5 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Orders
          </h1>
          <p className="text-dark-400 text-sm">
            {orders.length} total orders
            {(search || filter !== "all") && (
              <span className="ml-1 text-primary-600 dark:text-primary-400">
                · {filtered.length} matching
              </span>
            )}
          </p>
        </div>
        <AutoRefreshSelector
          interval={interval}
          setInterval={setIntervalVal}
          countdown={countdown}
          INTERVALS={INTERVALS}
          onRefresh={load}
        />
      </div>

      {/* Search bar */}
      <div className="relative">
        <FiSearch
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name, email, phone, or order ID…"
          className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 text-dark-900 dark:text-dark-100 placeholder-dark-400 dark:placeholder-dark-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 p-1 rounded-md hover:bg-dark-100 dark:hover:bg-dark-800">
            <FiX size={14} />
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUSES.map((s) => {
          const count = statusCount(s);
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === s
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-dark-300 dark:hover:border-dark-600"
              }`}>
              {s}{" "}
              {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-dark-400">
            Loading orders…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-dark-400">
            {search || filter !== "all" ? (
              <>
                <p className="text-2xl mb-2">🔍</p>
                <p>No orders match your filters</p>
                {(search || filter !== "all") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                    className="text-xs text-primary-600 hover:underline mt-2">
                    Clear filters
                  </button>
                )}
              </>
            ) : (
              "No orders yet."
            )}
          </div>
        ) : (
          <div>
            {Object.entries(groupedOrders).map(([dateLabel, dateOrders]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-50 dark:bg-dark-800/60 border-b border-t border-dark-100 dark:border-dark-800">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      dateLabel === "Today"
                        ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                        : dateLabel === "Yesterday"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : "bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400"
                    }`}>
                    {dateLabel}
                  </span>
                  <span className="text-xs text-dark-400">
                    {dateOrders.length} order{dateOrders.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-dark-100 dark:bg-dark-800" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <TableHead />
                    <tbody className="divide-y divide-dark-50 dark:divide-dark-800">
                      {dateOrders.map((order) => renderRow(order))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 flex-wrap max-w-[95vw]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-xs">
              {selectedIds.size}
            </div>
            <span className="text-sm font-medium text-dark-900 dark:text-dark-100">
              {selectedIds.size} selected
            </span>
          </div>

          <div className="h-6 w-px bg-dark-200 dark:bg-dark-700" />

          {/* Status changer */}
          {!bulkConfirm && !bulkDeleteConfirm && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-dark-500 dark:text-dark-400">
                  Status:
                </span>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 dark:text-dark-100 capitalize focus:outline-none focus:ring-1 focus:ring-primary-300">
                  <option value="">Choose status…</option>
                  {BULK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS[s]?.label || s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setBulkConfirm(true)}
                  disabled={!bulkStatus}
                  className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                  <FiCheck size={12} /> Apply
                </button>
              </div>

              {/* Bulk delete (only if any selected are deletable) */}
              {selectedDeletableCount > 0 && (
                <>
                  <div className="h-6 w-px bg-dark-200 dark:bg-dark-700" />
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center gap-1.5 border border-red-200 dark:border-red-800"
                    title={`Delete ${selectedDeletableCount} delivered/cancelled orders`}>
                    <FiTrash2 size={12} /> Delete ({selectedDeletableCount})
                  </button>
                </>
              )}
            </>
          )}

          {/* Status change confirmation */}
          {bulkConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-dark-700 dark:text-dark-300">
                Change <strong>{selectedIds.size}</strong> orders to{" "}
                <strong className="text-primary-600 capitalize">
                  {ORDER_STATUS[bulkStatus]?.label || bulkStatus}
                </strong>
                ?
              </span>
              <button
                onClick={handleBulkApply}
                disabled={bulkApplying}
                className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {bulkApplying ? "Applying…" : "Confirm"}
              </button>
              <button
                onClick={() => setBulkConfirm(false)}
                disabled={bulkApplying}
                className="px-3 py-1.5 border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 text-xs rounded-lg hover:bg-dark-50 dark:hover:bg-dark-800">
                Back
              </button>
            </div>
          )}

          {/* Bulk delete confirmation */}
          {bulkDeleteConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 dark:text-red-400">
                Delete <strong>{selectedDeletableCount}</strong> orders
                permanently?
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkApplying}
                className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50">
                {bulkApplying ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                disabled={bulkApplying}
                className="px-3 py-1.5 border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 text-xs rounded-lg hover:bg-dark-50 dark:hover:bg-dark-800">
                Cancel
              </button>
            </div>
          )}

          <button
            onClick={clearSelection}
            disabled={bulkApplying}
            className="ml-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 p-1 rounded-lg disabled:opacity-50"
            title="Clear selection">
            <FiX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
