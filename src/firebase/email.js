// src/firebase/email.js
// Order-confirmation emails via EmailJS (#4).
// Sends ONE template to two recipients: the outlet + the admin.
// Env vars (add to .env):
//   VITE_EMAILJS_SERVICE_ID
//   VITE_EMAILJS_TEMPLATE_ID
//   VITE_EMAILJS_PUBLIC_KEY
//   VITE_ORDER_EMAIL   (where new-order notifications go — usually the editor/ops inbox)
import emailjs from "@emailjs/browser";

const SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
// Where new order notifications go. This is the operations inbox
// (usually the editor/staff who prints and processes orders), NOT
// the admin's personal Gmail. Prefer VITE_ORDER_EMAIL; fall back
// to the legacy VITE_ADMIN_EMAIL for backwards compat.
const ORDER_INBOX_EMAIL =
  import.meta.env.VITE_ORDER_EMAIL || import.meta.env.VITE_ADMIN_EMAIL;

const rm = (n) => `RM ${Number(n || 0).toFixed(2)}`;

// Build the template params shared by both recipients
const buildParams = (order, orderId, extra = {}) => {
  const items = order.items || [];
  const itemsText = items
    .map(
      (i) =>
        `• ${i.name} — ${i.qty} × ${rm(i.price)} = ${rm(i.price * i.qty)}` +
        (i.note ? `\n   Note: ${i.note}` : ""),
    )
    .join("\n");

  const units = order.totalItems ?? items.reduce((n, i) => n + (i.qty || 0), 0);

  return {
    order_id: order.orderNumber
      ? `#${order.orderNumber}`
      : `#${orderId.slice(-6).toUpperCase()}`,
    outlet_name: order.outletName || order.outletId || "",
    outlet_id: order.outletId || "",
    order_items: itemsText,
    product_count: items.length,
    unit_count: units,
    order_total: rm(order.total),
    order_remarks: order.remarks || "—",
    order_date: new Date().toLocaleString("en-MY"),
    ...extra,
  };
};

// Fire both emails. Never throws — email failure must not block the order.
export const sendOrderEmails = async (order, orderId, outletEmail) => {
  if (!SERVICE || !TEMPLATE || !PUBLIC_KEY) {
    console.warn("EmailJS not configured — skipping order emails");
    return;
  }

  const jobs = [];

  // Outlet copy
  if (outletEmail) {
    jobs.push(
      emailjs.send(
        SERVICE,
        TEMPLATE,
        buildParams(order, orderId, {
          to_email: outletEmail,
          recipient_type: "outlet",
          greeting: `Thank you for your order, ${order.outletName || ""}!`,
        }),
        { publicKey: PUBLIC_KEY },
      ),
    );
  }

  // Order-inbox copy (editor/ops team)
  if (ORDER_INBOX_EMAIL) {
    jobs.push(
      emailjs.send(
        SERVICE,
        TEMPLATE,
        buildParams(order, orderId, {
          to_email: ORDER_INBOX_EMAIL,
          recipient_type: "admin",
          greeting: `New order received from ${order.outletName || order.outletId}.`,
        }),
        { publicKey: PUBLIC_KEY },
      ),
    );
  }

  try {
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("Order email error:", e);
  }
};
