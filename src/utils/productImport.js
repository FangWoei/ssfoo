// src/utils/productImport.js
// Parse + validate an Excel/CSV of products (#8) and generate a template.
import * as XLSX from "xlsx";

// Columns expected in the sheet (header row must match these names)
const HEADERS = [
  "itemCode",
  "name",
  "description",
  "category",
  "brand",
  "basePrice",
  "minOrder",
  "stock",
  "status",
  "uom",
  "focBuy",
  "focFree",
];

// ── Generate a downloadable template with an example row ──
export const downloadProductTemplate = (categories = [], brands = []) => {
  const example = {
    itemCode: "BW-080",
    name: "Baby Wipes 80s (example)",
    description: "Soft unscented baby wipes, 80 sheets",
    category: categories[0]?.name || "Diapers",
    brand: brands[0]?.name || "",
    basePrice: 4.5,
    minOrder: 12,
    stock: 500,
    status: "active",
    uom: "PCS",
    focBuy: 12,
    focFree: 1,
  };

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([example], { header: HEADERS });
  ws["!cols"] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 40 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 9 },
    { wch: 8 },
    { wch: 10 },
    { wch: 7 },
    { wch: 8 },
    { wch: 8 },
  ];

  // Second sheet: instructions + valid categories
  const notes = [
    {
      Field: "itemCode",
      Required: "Yes",
      Notes: "Unique product code, e.g. BW-080",
    },
    { Field: "name", Required: "Yes", Notes: "Product name" },
    { Field: "description", Required: "No", Notes: "Optional text" },
    {
      Field: "category",
      Required: "Yes",
      Notes: `Must match an existing category: ${categories.map((c) => c.name).join(", ") || "(create categories first)"}`,
    },
    {
      Field: "brand",
      Required: "No",
      Notes: `Empty = visible to all outlets. Otherwise must match a brand: ${brands.map((b) => b.name).join(", ") || "(none created yet)"}`,
    },
    { Field: "basePrice", Required: "Yes", Notes: "Number > 0, e.g. 4.50" },
    { Field: "minOrder", Required: "No", Notes: "Whole number, default 1" },
    { Field: "stock", Required: "No", Notes: "Whole number, default 0" },
    {
      Field: "status",
      Required: "No",
      Notes: "active or draft (default draft)",
    },
    {
      Field: "uom",
      Required: "No",
      Notes: "Unit of measure, e.g. PCS / CTN (default PCS)",
    },
    {
      Field: "focBuy",
      Required: "No",
      Notes:
        "FOC rule: buy this many… (fill both focBuy and focFree, or neither)",
    },
    { Field: "focFree", Required: "No", Notes: "…get this many free" },
  ];
  const ws2 = XLSX.utils.json_to_sheet(notes);
  ws2["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 60 }];

  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
  XLSX.writeFile(wb, "ssfoo_product_template.xlsx");
};

// ── Parse an uploaded file → { valid, errors } ────────
export const parseProductFile = async (file, categories = [], brands = []) => {
  const catNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const brandByLower = new Map(
    brands.map((b) => [b.name.toLowerCase(), b.name]),
  );
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const valid = [];
  const errors = [];

  rows.forEach((raw, idx) => {
    const line = idx + 2; // header is row 1
    const itemCode = String(raw.itemCode || "").trim();
    const name = String(raw.name || "").trim();
    const category = String(raw.category || "").trim();
    const brandRaw = String(raw.brand || "").trim();
    const price = parseFloat(raw.basePrice);
    const minOrder = parseInt(raw.minOrder, 10);
    const stock = parseInt(raw.stock, 10);
    const status =
      String(raw.status || "draft")
        .trim()
        .toLowerCase() === "active"
        ? "active"
        : "draft";

    // Skip fully blank rows silently
    if (!itemCode && !name && !category && !raw.basePrice) return;

    const rowErrors = [];
    if (!itemCode) rowErrors.push("missing itemCode");
    if (!name) rowErrors.push("missing name");
    if (!category) rowErrors.push("missing category");
    else if (!catNames.has(category.toLowerCase()))
      rowErrors.push(`unknown category "${category}"`);
    if (isNaN(price) || price <= 0) rowErrors.push("invalid basePrice");
    if (brandRaw && !brandByLower.has(brandRaw.toLowerCase()))
      rowErrors.push(`unknown brand "${brandRaw}"`);

    if (rowErrors.length) {
      errors.push({ line, name: name || "(no name)", issues: rowErrors });
      return;
    }

    const focBuy = parseInt(raw.focBuy, 10);
    const focFree = parseInt(raw.focFree, 10);

    valid.push({
      itemCode,
      name,
      description: String(raw.description || "").trim(),
      brand: brandRaw ? brandByLower.get(brandRaw.toLowerCase()) : "",
      uom:
        String(raw.uom || "PCS")
          .trim()
          .toUpperCase() || "PCS",
      focBuy: !isNaN(focBuy) && focBuy > 0 && focFree > 0 ? focBuy : 0,
      focFree: !isNaN(focFree) && focBuy > 0 && focFree > 0 ? focFree : 0,
      category,
      basePrice: price,
      minOrder: isNaN(minOrder) || minOrder < 1 ? 1 : minOrder,
      stock: isNaN(stock) || stock < 0 ? 0 : stock,
      status,
      inStock: (isNaN(stock) ? 0 : stock) > 0,
      images: [],
      isPromo: false,
    });
  });

  return { valid, errors, total: rows.length };
};
