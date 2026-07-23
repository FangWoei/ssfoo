// src/utils/exporters.js
// Export helpers for orders (#2 outlet PDF, #3 admin Excel + PDF).
import * as XLSX from "xlsx";
import { formatOrderDate, shortId } from "./orderHelpers";

const rm = (n) => `RM ${Number(n || 0).toFixed(2)}`;

// ── Admin: orders list → Excel (#3, priority) ────────
export const exportOrdersToExcel = (orders, filename = "orders") => {
  // Sheet 1: order summary
  const summary = orders.map((o) => ({
    "Order ID": shortId(o.id),
    "Full ID": o.id,
    Outlet: o.outletName || o.outletId || "",
    "Outlet ID": o.outletId || "",
    Products: (o.items || []).length,
    Units:
      o.totalItems ?? (o.items || []).reduce((n, i) => n + (i.qty || 0), 0),
    Total: Number(o.total || 0),
    Status: o.done ? "Done" : "New",
    Date: formatOrderDate(o.createdAt),
    Remarks: o.remarks || "",
  }));

  // Sheet 2: line items (one row per product per order)
  const lines = [];
  orders.forEach((o) => {
    (o.items || []).forEach((i) => {
      lines.push({
        "Order ID": shortId(o.id),
        Outlet: o.outletName || o.outletId || "",
        "Item Code": i.itemCode || "",
        Product: i.name,
        "Unit Price": Number(i.price || 0),
        Qty: i.qty || 0,
        Subtotal: Number((i.price || 0) * (i.qty || 0)),
        Note: i.note || "",
        Date: formatOrderDate(o.createdAt),
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summary);
  const ws2 = XLSX.utils.json_to_sheet(lines);
  ws1["!cols"] = [
    { wch: 10 },
    { wch: 22 },
    { wch: 20 },
    { wch: 12 },
    { wch: 9 },
    { wch: 7 },
    { wch: 12 },
    { wch: 8 },
    { wch: 20 },
    { wch: 30 },
  ];
  ws2["!cols"] = [
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 28 },
    { wch: 11 },
    { wch: 6 },
    { wch: 11 },
    { wch: 24 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Orders");
  XLSX.utils.book_append_sheet(wb, ws2, "Line Items");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`);
};

// ── Single order → printable PDF via window.print (#2, #3) ──
// Uses a hidden print window so we don't need jsPDF layout math and
// it looks clean. Works for both outlet and admin single-order view.
export const printOrderPDF = (
  order,
  { outlet = null, forAdmin = false } = {},
) => {
  const items = order.items || [];
  const rows = items
    .map(
      (i) => `
    <tr>
      <td class="code">${escapeHtml(i.itemCode || "—")}</td>
      <td>${escapeHtml(i.name)}</td>
      <td class="r">${rm(i.price)}</td>
      <td class="c">${i.qty}</td>
      <td class="r">${rm((i.price || 0) * (i.qty || 0))}</td>
    </tr>
    ${
      i.note
        ? `<tr class="note"><td colspan="5">Note: ${escapeHtml(i.note)}</td></tr>`
        : ""
    }`,
    )
    .join("");

  const total = order.total ?? items.reduce((s, i) => s + i.price * i.qty, 0);
  const units = order.totalItems ?? items.reduce((n, i) => n + (i.qty || 0), 0);

  const contactBlock = forAdmin
    ? `<div class="meta">
         <strong>${escapeHtml(order.outletName || order.outletId || "")}</strong><br/>
         ${escapeHtml(order.outletId || "")}<br/>
         ${outlet?.email ? escapeHtml(outlet.email) + "<br/>" : ""}
         ${outlet?.phone ? escapeHtml(outlet.phone) + "<br/>" : ""}
         ${outlet?.address ? escapeHtml(outlet.address) : ""}
       </div>`
    : `<div class="meta">
         <strong>${escapeHtml(order.outletName || order.outletId || "")}</strong><br/>
         ${escapeHtml(order.outletId || "")}
       </div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>Order ${shortId(order.id)}</title>
  <style>
    * { font-family: Arial, sans-serif; }
    body { color: #1e293b; padding: 32px; }
    h1 { color: #0d9488; margin: 0; font-size: 26px; }
    .sub { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .meta { font-size: 12px; line-height: 1.6; }
    .oid { text-align: right; font-size: 12px; color: #64748b; }
    .oid b { color: #0d9488; font-size: 16px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0fdfa; color: #0f766e; text-align: left; padding: 8px 10px; font-size: 12px; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    td.r, th.r { text-align: right; }
    td.c, th.c { text-align: center; }
    td.code { font-family: monospace; font-weight: bold; color: #0f766e; }
    tr.note td { color: #0d9488; font-style: italic; border-bottom: 1px solid #e2e8f0; }
    .total { margin-top: 16px; text-align: right; font-size: 14px; }
    .total b { color: #0d9488; font-size: 20px; }
    .remarks { margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 12px; }
    .foot { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; }
  </style></head><body>
    <h1>SS FOO</h1>
    <div class="sub">Outlet Ordering Portal — Order Summary</div>
    <div class="row">
      ${contactBlock}
      <div class="oid">
        Order<br/><b>${shortId(order.id)}</b><br/>
        ${formatOrderDate(order.createdAt)}<br/>
        ${forAdmin ? (order.done ? "Status: Done" : "Status: New") : ""}
      </div>
    </div>
    <table>
      <thead><tr><th>Item Code</th><th>Product</th><th class="r">Unit Price</th><th class="c">Qty</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">${items.length} products · ${units} units<br/>Total <b>${rm(total)}</b></div>
    ${
      order.remarks
        ? `<div class="remarks"><strong>Remarks:</strong> ${escapeHtml(order.remarks)}</div>`
        : ""
    }
    <div class="foot">Generated ${new Date().toLocaleString("en-MY")}</div>
  </body></html>`;

  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 350);
};

// ── Single order → Excel (#4) ────────────────────────
export const exportSingleOrderToExcel = (order, outlet = null) => {
  const items = order.items || [];

  // Sheet 1: order info (key/value)
  const info = [
    { Field: "Order ID", Value: shortId(order.id) },
    { Field: "Full ID", Value: order.id },
    { Field: "Status", Value: order.done ? "Done" : "New" },
    { Field: "Date", Value: formatOrderDate(order.createdAt) },
    { Field: "Outlet ID", Value: order.outletId || "" },
    { Field: "Outlet Name", Value: order.outletName || "" },
    { Field: "Email", Value: outlet?.email || "" },
    { Field: "Phone", Value: outlet?.phone || "" },
    { Field: "Address", Value: outlet?.address || "" },
    { Field: "Remarks", Value: order.remarks || "" },
    {
      Field: "Total Units",
      Value: order.totalItems ?? items.reduce((n, i) => n + (i.qty || 0), 0),
    },
    { Field: "Total", Value: Number(order.total || 0) },
  ];

  // Sheet 2: items (Item Code first, #5)
  const lines = items.map((i) => ({
    "Item Code": i.itemCode || "",
    Product: i.name,
    "Unit Price": Number(i.price || 0),
    Qty: i.qty || 0,
    Subtotal: Number((i.price || 0) * (i.qty || 0)),
    Note: i.note || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(info);
  const ws2 = XLSX.utils.json_to_sheet(lines);
  ws1["!cols"] = [{ wch: 14 }, { wch: 40 }];
  ws2["!cols"] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 11 },
    { wch: 6 },
    { wch: 11 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "Order");
  XLSX.utils.book_append_sheet(wb, ws2, "Items");

  XLSX.writeFile(wb, `order_${shortId(order.id).replace("#", "")}.xlsx`);
};

// ── Single order → client "sales order" format (.xls) ──
// Matches the client's accounting template exactly:
// A ItemCode · B Description · C Qty · D FOC · E UOM · F UnitPrice
// Columns G–Q keep their headers but stay empty.
export const exportOrderClientFormat = (order, outlet = null) => {
  const items = order.items || [];

  const HEADERS = [
    "ItemCode",
    "Description ",
    "Qty",
    "FOC",
    "UOM",
    "UnitPrice",
    "",
    "Total",
    "Disc",
    "BDate",
    "RecDtlKey",
    "GST Code",
    "GST Rate",
    "Sales Tax Exemption No.",
    "GST",
    "Total (ex)",
    "Total (inc)",
  ];

  const rows = items.map((i) => [
    i.itemCode || "",
    i.name || "",
    i.qty || 0,
    i.foc > 0 ? i.foc : "",
    (i.uom || "").toLowerCase(),
    Number(i.price || 0),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  // Outlet info rows at the top
  const outletName =
    outlet?.outletName || order.outletName || outlet?.name || "";
  const outletAddress = outlet?.address || "";
  const outletPhone = outlet?.phone || "";
  const outletId = order.outletId || outlet?.outletId || "";

  const infoRows = [
    ["Outlet:", outletName],
    ["Address:", outletAddress],
    ...(outletPhone ? [["Phone:", outletPhone]] : []),
    ...(outletId ? [["Outlet ID:", outletId]] : []),
    [], // blank spacer row
  ];

  const ws = XLSX.utils.aoa_to_sheet([...infoRows, HEADERS, ...rows]);
  ws["!cols"] = [
    { wch: 10 },
    { wch: 45 },
    { wch: 6 },
    { wch: 5 },
    { wch: 6 },
    { wch: 10 },
    { wch: 3 },
    { wch: 8 },
    { wch: 6 },
    { wch: 8 },
    { wch: 10 },
    { wch: 9 },
    { wch: 9 },
    { wch: 22 },
    { wch: 6 },
    { wch: 10 },
    { wch: 11 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "sales order");

  XLSX.writeFile(wb, `sales_order_${shortId(order.id).replace("#", "")}.xls`, {
    bookType: "xls",
  });
};

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Share an order via WhatsApp ───────────────────────
export const shareOrderWhatsApp = (order) => {
  const lines = [];
  lines.push(`*SSFOO Order ${shortId(order.id)}*`);
  if (order.outletName || order.outletId)
    lines.push(
      `Outlet: ${order.outletName || ""}${order.outletId ? ` (${order.outletId})` : ""}`,
    );
  lines.push(`Date: ${formatOrderDate(order.createdAt)}`);
  lines.push("");
  (order.items || []).forEach((i) => {
    let line = `• ${i.itemCode ? i.itemCode + " — " : ""}${i.name}: ${i.qty}${i.uom ? " " + i.uom.toLowerCase() : ""}`;
    if (i.foc > 0) line += ` (+${i.foc} FOC)`;
    line += ` @ RM${Number(i.price || 0).toFixed(2)}`;
    lines.push(line);
    if (i.note) lines.push(`   📝 ${i.note}`);
  });
  lines.push("");
  lines.push(`*Total: RM${Number(order.total || 0).toFixed(2)}*`);
  if (order.remarks) lines.push(`Remarks: ${order.remarks}`);

  window.open(
    `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`,
    "_blank",
  );
};

// ── Picking list — warehouse-friendly print ───────────
// Sorted by item code, big rows, tick boxes.
export const printPickingList = (order, outlet = null) => {
  const items = [...(order.items || [])].sort((a, b) =>
    String(a.itemCode || "").localeCompare(String(b.itemCode || "")),
  );

  const rows = items
    .map(
      (i, idx) => `
    <tr>
      <td class="c">${idx + 1}</td>
      <td class="c box">☐</td>
      <td class="code">${escapeHtml(i.itemCode || "—")}</td>
      <td>${escapeHtml(i.name)}${i.note ? `<div class="note">📝 ${escapeHtml(i.note)}</div>` : ""}</td>
      <td class="c qty">${i.qty}${i.uom ? ` <span class="uom">${escapeHtml(i.uom.toLowerCase())}</span>` : ""}</td>
      <td class="c foc">${i.foc > 0 ? "+" + i.foc : ""}</td>
    </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Picking List ${shortId(order.id)}</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, sans-serif; }
    body { margin: 24px; color: #111; }
    h1 { font-size: 22px; margin: 0 0 2px; }
    .meta { font-size: 13px; color: #444; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
         border-bottom: 2px solid #111; padding: 8px 6px; }
    td { border-bottom: 1px solid #ccc; padding: 12px 6px; font-size: 15px; vertical-align: top; }
    td.c, th.c { text-align: center; }
    td.box { font-size: 22px; width: 44px; }
    td.code { font-family: "Courier New", monospace; font-weight: bold; font-size: 16px; white-space: nowrap; }
    td.qty { font-size: 18px; font-weight: bold; white-space: nowrap; }
    .uom { font-size: 12px; font-weight: normal; color: #555; }
    td.foc { color: #0f766e; font-weight: bold; }
    .note { font-size: 12px; color: #555; margin-top: 3px; }
    .footer { margin-top: 28px; display: flex; gap: 40px; font-size: 13px; }
    .footer span { border-top: 1px solid #111; padding-top: 6px; min-width: 180px; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
    <h1>PICKING LIST — ${shortId(order.id)}</h1>
    <div class="meta">
      Outlet: <b>${escapeHtml(order.outletName || "")}</b>${order.outletId ? ` (${escapeHtml(order.outletId)})` : ""}
      &nbsp;·&nbsp; Placed: ${formatOrderDate(order.createdAt)}
      ${outlet?.phone ? `&nbsp;·&nbsp; ${escapeHtml(outlet.phone)}` : ""}
      &nbsp;·&nbsp; ${items.length} lines
    </div>
    <table>
      <thead><tr><th class="c">#</th><th class="c">✓</th><th>Item Code</th><th>Product</th><th class="c">Qty</th><th class="c">FOC</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <span>Picked by</span>
      <span>Checked by</span>
      <span>Date</span>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
};
