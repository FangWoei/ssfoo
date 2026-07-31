// src/utils/orderHelpers.js
// Small helpers shared by outlet and admin order pages.

// Firestore Timestamp | Date | undefined → readable string
export const formatOrderDate = (ts) => {
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  if (!d) return "—";
  return d.toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const shortId = (id = "") => `#${id.slice(-6).toUpperCase()}`;

// Prefer the sequential orderNumber (00001) when available.
// Falls back to the truncated Firestore autoId (#UZBRJW) for legacy orders.
export const orderLabel = (order = {}) => {
  const num = order.orderNumber;
  if (num) return `#${num}`;
  return shortId(order.id || "");
};
