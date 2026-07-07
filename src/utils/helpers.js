// src/utils/helpers.js

// ── Currency formatting ──────────────────────────────
export const formatPrice = (amount, currency = "MYR") =>
  new Intl.NumberFormat("ms-MY", { style: "currency", currency }).format(
    amount,
  );

// ── Truncate text ────────────────────────────────────
export const truncate = (str, n = 60) =>
  str?.length > n ? str.slice(0, n - 3) + "..." : str;

// ── Generate unique ID ───────────────────────────────
export const genId = () => Math.random().toString(36).slice(2, 10);

// ── Get initials from name ───────────────────────────
export const getInitials = (name = "") =>
  name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// ── Convert Firebase Timestamp to Date string ────────
export const tsToDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Validate email ───────────────────────────────────
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Clamp number ─────────────────────────────────────
export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// ── Order status ─────────────────────────────────────
export const ORDER_STATUS = {
  pending: {
    label: "Pending",
    color: "badge-pending",
    border: "border-amber-300 dark:border-amber-700",
  },
  processing: {
    label: "Processing",
    color: "badge-processing",
    border: "border-blue-300 dark:border-blue-700",
  },
  shipped: {
    label: "Shipped",
    color: "badge-shipped",
    border: "border-purple-300 dark:border-purple-700",
  },
  delivered: {
    label: "Delivered",
    color: "badge-delivered",
    border: "border-green-300 dark:border-green-700",
  },
  cancelled: {
    label: "Cancelled",
    color: "badge-cancelled",
    border: "border-red-300 dark:border-red-700",
  },
};
