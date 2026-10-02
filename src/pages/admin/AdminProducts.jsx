// src/pages/admin/AdminProducts.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import Pagination, { DEFAULT_PAGE_SIZE } from "@/components/common/Pagination";
import RefreshControl from "@/components/common/RefreshControl";
import {
  bulkAddProducts,
  bulkDeleteProducts,
  bulkUpdateProducts,
  deleteProduct,
  getAllProducts,
  getBrands,
  getCategories,
  getUoms,
  toggleProductPromo,
  updateProduct,
} from "@/firebase/products";
import usePersistedState from "@/hooks/usePersistedState";
import { formatPrice } from "@/utils/helpers";
import {
  downloadProductTemplate,
  exportProductsToExcel,
  parseProductFile,
} from "@/utils/productImport";
import { isOnPromo } from "@/utils/promo";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  FiDownload,
  FiEdit2,
  FiLoader,
  FiPlus,
  FiSearch,
  FiSliders,
  FiTag,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";
const STATUS_FILTERS = ["all", "active", "editing", "draft"];
const STATUS_LABEL = { active: "Active", editing: "Editing", draft: "Draft" };
const STATUS_PILL = {
  active:
    "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400",
  editing:
    "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  draft: "bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400",
};
const STATUS_DONE = {
  active: "activated",
  editing: "marked as editing",
  draft: "set to draft",
};
// Bulk price edit: keep the list short so the admin doesn't get lost
const MAX_PRICE_EDIT = 15;
const QTY_STEPS = [1, 3, 6, 12, 24];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState("ap-search", "");
  const [catFilter, setCatFilter] = usePersistedState("ap-cat", "all");
  const [brandFilter, setBrandFilter] = usePersistedState("ap-brand", "all");
  const [statusFilter, setStatusFilter] = usePersistedState("ap-status", "all");
  const [pageSize, setPageSize] = usePersistedState(
    "ap-size",
    DEFAULT_PAGE_SIZE,
  );
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const [uoms, setUoms] = useState([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [priceEditOpen, setPriceEditOpen] = useState(false);

  const load = async () => {
    try {
      const [prods, cats, brandList, uomList] = await Promise.all([
        getAllProducts(),
        getCategories(),
        getBrands(),
        getUoms(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setBrands(brandList);
      setUoms(uomList);
    } catch (e) {
      console.error("Load products failed:", e);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      const [prods, cats] = await Promise.all([
        getAllProducts(),
        getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    let list = products;
    if (statusFilter !== "all")
      list = list.filter((p) => (p.status || "draft") === statusFilter);
    if (catFilter !== "all")
      list = list.filter((p) => p.category === catFilter);
    if (brandFilter !== "all")
      list = list.filter((p) =>
        brandFilter === "__none__" ? !p.brand : p.brand === brandFilter,
      );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.itemCode?.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, statusFilter, catFilter, brandFilter, search]);

  // Any filter or size change resets to page 1
  useEffect(() => {
    setPage(1);
  }, [statusFilter, catFilter, brandFilter, search, pageSize]);

  // Slice the visible page
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const changeStatus = async (product, next) => {
    if (next === (product.status || "draft")) return;
    try {
      await updateProduct(product.id, { status: next });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: next } : p)),
      );
      toast.success(
        next === "active"
          ? "Published"
          : next === "editing"
            ? "Marked as editing — still visible in shop"
            : "Moved to draft",
      );
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`))
      return;
    try {
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setSelected((prev) => prev.filter((id) => id !== product.id));
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleBulkSetStatus = async (newStatus) => {
    if (!selected.length) return;
    if (
      !window.confirm(
        `Set ${selected.length} product${selected.length > 1 ? "s" : ""} to ${STATUS_LABEL[newStatus]}?`,
      )
    )
      return;
    try {
      await bulkUpdateProducts(
        selected.map((id) => ({ id, data: { status: newStatus } })),
      );
      setProducts((prev) =>
        prev.map((p) =>
          selected.includes(p.id) ? { ...p, status: newStatus } : p,
        ),
      );
      toast.success(
        `${selected.length} product${selected.length > 1 ? "s" : ""} ${STATUS_DONE[newStatus]}`,
      );
      setSelected([]);
    } catch (e) {
      console.error("Bulk status change failed:", e);
      toast.error("Some updates failed — try again");
    }
  };

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Delete ${selected.length} products? This cannot be undone.`,
      )
    )
      return;
    try {
      // Firestore batches cap at 500 writes — delete in chunks
      for (let i = 0; i < selected.length; i += 450)
        await bulkDeleteProducts(selected.slice(i, i + 450));
      setProducts((prev) => prev.filter((p) => !selected.includes(p.id)));
      setSelected([]);
      toast.success("Products deleted");
    } catch {
      toast.error("Bulk delete failed");
    }
  };

  const toggleSelect = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const allSelected =
    paged.length > 0 && paged.every((p) => selected.includes(p.id));

  const toggleSelectAll = () =>
    setSelected(
      allSelected
        ? selected.filter((id) => !paged.some((p) => p.id === id))
        : [...new Set([...selected, ...paged.map((p) => p.id)])],
    );

  // Every product that matches the current filters (all pages)
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.includes(p.id));
  const selectAllFiltered = () =>
    setSelected([...new Set([...selected, ...filtered.map((p) => p.id)])]);

  // ── Bulk edit: apply the same fields to every selected product ──
  const handleBulkEdit = async (changes, onProgress) => {
    const ids = [...selected];
    await bulkUpdateProducts(
      ids.map((id) => ({ id, data: changes })),
      onProgress,
    );
    const idSet = new Set(ids);
    setProducts((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, ...changes } : p)),
    );
    toast.success(`${ids.length} product${ids.length > 1 ? "s" : ""} updated`);
    setSelected([]);
    setBulkEditOpen(false);
  };

  const openPriceEdit = () => {
    if (selected.length > MAX_PRICE_EDIT) {
      toast.error(
        `Bulk price edit is max ${MAX_PRICE_EDIT} products — you selected ${selected.length}`,
      );
      return;
    }
    setPriceEditOpen(true);
  };

  // updates: [{ id, data: { basePrice, salePrice? } }] — only changed rows
  const handleBulkPriceSave = async (updates) => {
    await bulkUpdateProducts(updates);
    const map = new Map(updates.map((u) => [u.id, u.data]));
    setProducts((prev) =>
      prev.map((p) => (map.has(p.id) ? { ...p, ...map.get(p.id) } : p)),
    );
    toast.success(
      `${updates.length} price${updates.length > 1 ? "s" : ""} updated`,
    );
    setSelected([]);
    setPriceEditOpen(false);
  };

  const handleTogglePromo = async (product) => {
    const next = !product.isPromo;
    if (
      next &&
      !(product.salePrice > 0 && product.salePrice < product.basePrice)
    ) {
      toast.error("Set a promotion price first (edit the product)");
      return;
    }
    try {
      await toggleProductPromo(product.id, next);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isPromo: next } : p)),
      );
      toast.success(next ? "Added to promotions" : "Removed from promotions");
    } catch {
      toast.error("Failed to update promotion");
    }
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await parseProductFile(file, categories, brands);
      // Match rows to existing products by itemCode → update vs create
      const byCode = new Map(
        products
          .filter((pr) => pr.itemCode)
          .map((pr) => [String(pr.itemCode).toLowerCase(), pr]),
      );
      const creates = [];
      const updates = [];
      result.valid.forEach((row) => {
        const existing = byCode.get(String(row.itemCode).toLowerCase());
        if (existing) updates.push({ id: existing.id, data: row });
        else creates.push(row);
      });
      setImportResult({ ...result, creates, updates });
      setImportModal(true);
    } catch (err) {
      console.error("Parse failed:", err);
      toast.error("Could not read that file");
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    const creates = importResult?.creates || [];
    const updates = importResult?.updates || [];
    if (!creates.length && !updates.length) return;
    setImporting(true);
    try {
      if (creates.length) await bulkAddProducts(creates);
      if (updates.length) await bulkUpdateProducts(updates);
      toast.success(`${creates.length} added · ${updates.length} updated`);
      setImportModal(false);
      setImportResult(null);
      setLoading(true);
      await load();
    } catch (err) {
      console.error("Import failed:", err);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Products
          </h1>
          <p className="text-dark-400 text-sm">
            {products.length} products · {filtered.length} shown
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshControl
            onRefresh={doRefresh}
            refreshing={refreshing}
            storageKey="ssfoo-refresh-products"
          />
          <button
            onClick={() => {
              if (!products.length) return toast.error("No products yet");
              exportProductsToExcel(products);
            }}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 text-sm font-semibold transition-colors"
            title="Download all products as Excel — edit and re-import to update">
            <FiDownload size={15} /> Export
          </button>
          <button
            onClick={() => downloadProductTemplate(categories, brands)}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 text-sm font-semibold transition-colors">
            <FiDownload size={15} /> Template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-500 disabled:opacity-60 text-sm font-semibold transition-colors">
            {importing ? (
              <FiLoader size={15} className="animate-spin" />
            ) : (
              <FiUploadCloud size={15} />
            )}
            Import
          </button>
          <Link
            to="/admin/products/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/25 transition-all">
            <FiPlus size={16} /> Add Product
          </Link>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFilePick}
            className="hidden"
          />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item code or name…"
            className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary-500 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400">
              <FiX size={13} />
            </button>
          )}
        </div>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none hover:border-primary-500 focus:border-primary-500 transition-colors">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="px-3 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none hover:border-primary-500 focus:border-primary-500 transition-colors">
          <option value="all">All brands</option>
          <option value="__none__">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm shadow-primary-500/25 border border-transparent"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
              }`}>
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl px-4 py-3 shadow-md shadow-primary-500/25">
          <span className="text-sm font-semibold">
            {selected.length} selected
          </span>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors">
              Clear
            </button>
            <button
              onClick={() => setBulkEditOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-primary-700 hover:bg-white/90 transition-colors inline-flex items-center gap-1">
              <FiSliders size={12} /> Bulk Edit
            </button>
            <button
              onClick={openPriceEdit}
              title={`Edit prices of up to ${MAX_PRICE_EDIT} products`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors ${
                selected.length > MAX_PRICE_EDIT
                  ? "bg-white/10 text-white/60 cursor-not-allowed"
                  : "bg-white text-primary-700 hover:bg-white/90"
              }`}>
              RM Bulk Price
              {selected.length > MAX_PRICE_EDIT && ` (max ${MAX_PRICE_EDIT})`}
            </button>
            <button
              onClick={() => handleBulkSetStatus("active")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors">
              ✓ Set Active
            </button>
            <button
              onClick={() => handleBulkSetStatus("draft")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors">
              ✎ Set Draft
            </button>
            <button
              onClick={() => handleBulkSetStatus("editing")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors">
              ✐ Set Editing
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 transition-colors">
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Product list ── */}
      {/* Pagination (top) */}
      <Pagination
        total={totalFiltered}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onPageSizeChange={setPageSize}
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm shadow-slate-200/40 dark:shadow-none">
        {filtered.length === 0 ? (
          <p className="text-sm text-dark-400 text-center py-14">
            No products found
          </p>
        ) : (
          <>
            {/* Select all */}
            <label className="flex items-center gap-3 px-4 py-2.5 border-b border-dark-100 dark:border-dark-800 bg-dark-50/60 dark:bg-dark-800/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="accent-primary-600"
              />
              <span className="text-xs font-semibold text-dark-500 dark:text-dark-400">
                Select all on page ({paged.length})
              </span>
              {selected.length > 0 && !allSelected && (
                <span className="text-xs text-dark-400">
                  · {selected.length} selected
                </span>
              )}
              {filtered.length > paged.length && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    allFilteredSelected ? setSelected([]) : selectAllFiltered();
                  }}
                  className="ml-auto text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                  {allFilteredSelected
                    ? "Clear selection"
                    : `Select all ${filtered.length} matching products`}
                </button>
              )}
            </label>
            <div className="divide-y divide-dark-100 dark:divide-dark-800">
              {paged.map((p) => {
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-dark-50 dark:hover:bg-dark-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="accent-primary-600 shrink-0"
                    />
                    <img
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (p.images?.[0]) setPreviewImg(p.images[0]);
                      }}
                      style={p.images?.[0] ? { cursor: "zoom-in" } : undefined}
                      title={p.images?.[0] ? "Click to enlarge" : ""}
                      src={p.images?.[0] || PLACEHOLDER}
                      alt={p.name}
                      className="w-11 h-11 rounded-lg object-contain bg-white border border-dark-100 dark:border-dark-700 shrink-0"
                    />
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-sm font-semibold text-dark-900 dark:text-dark-100 truncate">
                        {p.itemCode && (
                          <span className="font-mono text-primary-600 dark:text-primary-400 mr-1.5">
                            {p.itemCode}
                          </span>
                        )}
                        {p.name}
                      </p>
                      <p className="text-xs text-dark-400">
                        {p.category || "Uncategorized"}
                        {p.brand ? ` · ${p.brand}` : ""} · MOQ {p.minOrder || 1}
                        {(p.qtyStep || 1) > 1 ? ` · ×${p.qtyStep}` : ""}
                      </p>
                      {/* Mobile-only price (desktop shows the right column) */}
                      <p className="sm:hidden text-xs mt-0.5">
                        <span className="font-bold text-dark-900 dark:text-dark-100">
                          {isOnPromo(p)
                            ? formatPrice(p.salePrice)
                            : formatPrice(p.basePrice || 0)}
                        </span>
                        {isOnPromo(p) && (
                          <span className="text-dark-400 line-through ml-1">
                            {formatPrice(p.basePrice || 0)}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="hidden sm:block text-right shrink-0 w-24">
                      {isOnPromo(p) ? (
                        <>
                          <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                            {formatPrice(p.salePrice)}
                          </p>
                          <p className="text-[11px] text-dark-400 line-through">
                            {formatPrice(p.basePrice || 0)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-dark-900 dark:text-dark-100">
                          {formatPrice(p.basePrice || 0)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <button
                        onClick={() => handleTogglePromo(p)}
                        className={`shrink-0 p-2 rounded-lg transition-colors ${
                          p.isPromo
                            ? "text-primary-600 bg-primary-50 dark:bg-primary-900/30"
                            : "text-dark-300 dark:text-dark-600 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                        }`}
                        title={
                          p.isPromo ? "On promotion" : "Add to promotions"
                        }>
                        <FiTag size={15} />
                      </button>

                      <select
                        value={p.status || "draft"}
                        onChange={(e) => changeStatus(p, e.target.value)}
                        title="Change status"
                        className={`shrink-0 pl-2.5 pr-6 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border-0 outline-none cursor-pointer ${
                          STATUS_PILL[p.status] || STATUS_PILL.draft
                        }`}>
                        {Object.keys(STATUS_LABEL).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-1 shrink-0">
                        <Link
                          to={`/admin/products/${p.id}/edit`}
                          className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          title="Edit">
                          <FiEdit2 size={15} />
                        </Link>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-2 rounded-lg text-dark-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete">
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Import preview modal ── */}
      {importModal && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !importing && setImportModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-dark-900 dark:text-dark-100">
                Import Preview
              </h2>
              <button
                onClick={() => !importing && setImportModal(false)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800">
                <FiX size={16} />
              </button>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {importResult.creates?.length || 0}
                </p>
                <p className="text-xs text-dark-500">New products</p>
              </div>
              <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {importResult.updates?.length || 0}
                </p>
                <p className="text-xs text-dark-500">Updates (by item code)</p>
              </div>
              <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-500">
                  {importResult.errors.length}
                </p>
                <p className="text-xs text-dark-500">Skipped (errors)</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                  These rows will be skipped:
                </p>
                <ul className="space-y-1">
                  {importResult.errors.map((e, i) => (
                    <li
                      key={i}
                      className="text-xs text-dark-600 dark:text-dark-400">
                      <span className="font-semibold">Row {e.line}</span> (
                      {e.name}): {e.issues.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.valid.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto border border-dark-100 dark:border-dark-800 rounded-xl divide-y divide-dark-100 dark:divide-dark-800">
                {importResult.valid.slice(0, 20).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium text-dark-800 dark:text-dark-200 truncate">
                      {p.name}
                    </span>
                    <span className="text-dark-400 shrink-0 ml-2">
                      {p.category} · {formatPrice(p.basePrice)}
                    </span>
                  </div>
                ))}
                {importResult.valid.length > 20 && (
                  <p className="px-3 py-2 text-xs text-dark-400 text-center">
                    +{importResult.valid.length - 20} more…
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setImportModal(false)}
                disabled={importing}
                className="flex-1 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 text-sm font-semibold disabled:opacity-60">
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing || importResult.valid.length === 0}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
                {importing ? (
                  <>
                    <FiLoader size={15} className="animate-spin" /> Importing…
                  </>
                ) : (
                  `Import ${(importResult.creates?.length || 0) + (importResult.updates?.length || 0)} rows`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk edit modal ── */}
      {bulkEditOpen && (
        <BulkEditModal
          count={selected.length}
          categories={categories}
          brands={brands}
          uoms={uoms}
          onClose={() => setBulkEditOpen(false)}
          onApply={handleBulkEdit}
        />
      )}

      {/* ── Bulk price modal ── */}
      {priceEditOpen && (
        <BulkPriceModal
          products={products.filter((p) => selected.includes(p.id))}
          onClose={() => setPriceEditOpen(false)}
          onSave={handleBulkPriceSave}
        />
      )}

      {/* ── Image lightbox ── */}
      {previewImg &&
        createPortal(
          <div
            onClick={() => setPreviewImg(null)}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <img
              src={previewImg}
              alt="Preview"
              className="rounded-2xl bg-white shadow-2xl"
              style={{
                maxWidth: "92vw",
                maxHeight: "90vh",
                objectFit: "contain",
              }}
            />
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors">
              <FiX size={22} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Toggle row used by the bulk edit modal (kept outside the modal so
// inputs inside it don't remount and lose focus while typing)
function BulkRow({ k, label, on, toggle, children }) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        on[k]
          ? "border-primary-400 bg-primary-50/40 dark:bg-primary-900/10"
          : "border-dark-100 dark:border-dark-800"
      }`}>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!on[k]}
          onChange={() => toggle(k)}
          className="accent-primary-600 w-4 h-4"
        />
        <span className="text-sm font-semibold text-dark-800 dark:text-dark-200">
          {label}
        </span>
        {!on[k] && (
          <span className="ml-auto text-[11px] text-dark-400">keep as is</span>
        )}
      </label>
      {on[k] && <div className="mt-2.5 ml-6">{children}</div>}
    </div>
  );
}

// ── Bulk Edit Modal ────────────────────────────────────
// Each field starts OFF ("keep as is"). Only the fields the admin
// switches on are written, so nothing else on the products changes.
function BulkEditModal({ count, categories, brands, uoms, onClose, onApply }) {
  const [on, setOn] = useState({});
  const [vals, setVals] = useState({
    qtyStep: 1,
    minOrder: 1,
    category: "",
    brand: "",
    uom: "",
    focBuy: "",
    focFree: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = (key) => setOn((o) => ({ ...o, [key]: !o[key] }));
  const setVal = (key) => (e) =>
    setVals((v) => ({ ...v, [key]: e.target ? e.target.value : e }));

  const activeCount = Object.values(on).filter(Boolean).length;

  const buildChanges = () => {
    const c = {};
    if (on.qtyStep) c.qtyStep = Number(vals.qtyStep) || 1;
    if (on.minOrder) {
      const n = parseInt(vals.minOrder, 10);
      if (!n || n < 1) throw new Error("MOQ must be at least 1");
      c.minOrder = n;
    }
    if (on.category) {
      if (!vals.category) throw new Error("Pick a category");
      c.category = vals.category;
    }
    if (on.brand) c.brand = vals.brand || "";
    if (on.uom) {
      if (!vals.uom) throw new Error("Pick a UOM");
      c.uom = vals.uom;
    }
    if (on.foc) {
      const buy = parseInt(vals.focBuy, 10) || 0;
      const free = parseInt(vals.focFree, 10) || 0;
      if (buy > 0 !== free > 0)
        throw new Error("FOC: fill in both Buy and Free (or both 0 to remove)");
      c.focBuy = buy;
      c.focFree = free;
    }
    if (on.status) c.status = vals.status;
    return c;
  };

  const apply = async () => {
    let changes;
    try {
      changes = buildChanges();
    } catch (e) {
      toast.error(e.message);
      return;
    }
    if (!Object.keys(changes).length) {
      toast.error("Turn on at least one field to change");
      return;
    }
    const summary = Object.entries(changes)
      .map(([k, v]) => `• ${k}: ${v === "" ? "(none)" : v}`)
      .join("\n");
    if (
      !window.confirm(
        `Update ${count} product${count > 1 ? "s" : ""}?\n\n${summary}`,
      )
    )
      return;
    setSaving(true);
    setProgress(0);
    try {
      await onApply(changes, (done, total) =>
        setProgress(Math.round((done / total) * 100)),
      );
    } catch (e) {
      console.error("Bulk edit failed:", e);
      toast.error("Bulk edit failed — some products may not be updated");
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors disabled:opacity-40";

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose()}
      />
      <div className="relative w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl p-5 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-dark-900 dark:text-dark-100">
            Bulk Edit · {count} product{count > 1 ? "s" : ""}
          </h2>
          <button
            onClick={() => !saving && onClose()}
            className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800">
            <FiX size={16} />
          </button>
        </div>
        <p className="text-xs text-dark-400 mb-4">
          Tick only what you want to change. Unticked fields stay the same on
          every product.
        </p>

        <div className="space-y-2.5">
          <BulkRow
            k="qtyStep"
            label="Order in multiples of (+ / − step)"
            on={on}
            toggle={toggle}>
            <div className="flex flex-wrap gap-2">
              {QTY_STEPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setVals((v) => ({ ...v, qtyStep: n }))}
                  className={`min-w-[52px] px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
                    Number(vals.qtyStep) === n
                      ? "bg-primary-600 border-primary-600 text-white"
                      : "bg-dark-50 dark:bg-dark-800 border-transparent text-dark-600 dark:text-dark-300 hover:border-primary-500"
                  }`}>
                  +{n}
                </button>
              ))}
            </div>
          </BulkRow>

          <BulkRow
            k="minOrder"
            label="Minimum order quantity (MOQ)"
            on={on}
            toggle={toggle}>
            <input
              type="number"
              min="1"
              value={vals.minOrder}
              onChange={setVal("minOrder")}
              className={`${inputCls} max-w-[140px]`}
            />
          </BulkRow>

          <BulkRow k="category" label="Category" on={on} toggle={toggle}>
            <select
              value={vals.category}
              onChange={setVal("category")}
              className={inputCls}>
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow k="brand" label="Brand" on={on} toggle={toggle}>
            <select
              value={vals.brand}
              onChange={setVal("brand")}
              className={inputCls}>
              <option value="">— No brand (visible to all outlets) —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow k="uom" label="UOM" on={on} toggle={toggle}>
            <select
              value={vals.uom}
              onChange={setVal("uom")}
              className={inputCls}>
              <option value="">Select UOM…</option>
              {uoms.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </BulkRow>

          <BulkRow k="foc" label="FOC — Buy X Free Y" on={on} toggle={toggle}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={vals.focBuy}
                onChange={setVal("focBuy")}
                placeholder="Buy"
                className={inputCls}
              />
              <span className="text-dark-400 text-xs shrink-0">free</span>
              <input
                type="number"
                min="0"
                value={vals.focFree}
                onChange={setVal("focFree")}
                placeholder="Free"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-dark-400 mt-1">
              Put 0 and 0 to remove FOC from all selected products.
            </p>
          </BulkRow>

          <BulkRow
            k="status"
            label="Status (Editing = still shown in shop)"
            on={on}
            toggle={toggle}>
            <div className="flex gap-2">
              {["active", "editing", "draft"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setVals((v) => ({ ...v, status: st }))}
                  className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize border transition-colors ${
                    vals.status === st
                      ? "bg-primary-600 border-primary-600 text-white"
                      : "bg-dark-50 dark:bg-dark-800 border-transparent text-dark-600 dark:text-dark-300"
                  }`}>
                  {st}
                </button>
              ))}
            </div>
          </BulkRow>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 text-sm font-semibold disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={saving || activeCount === 0}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            {saving ? (
              <>
                <FiLoader size={15} className="animate-spin" /> Updating…{" "}
                {progress}%
              </>
            ) : (
              `Apply to ${count} product${count > 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Bulk Price Modal ───────────────────────────────────
// Item code + name on the left, price input on the right.
// Products on promotion also get a promo price box.
function BulkPriceModal({ products, onClose, onSave }) {
  const [rows, setRows] = useState(() =>
    products.map((p) => ({
      id: p.id,
      itemCode: p.itemCode || "",
      name: p.name || "",
      isPromo: Boolean(p.isPromo),
      oldBase: Number(p.basePrice) || 0,
      oldSale: p.salePrice != null ? Number(p.salePrice) : null,
      basePrice: p.basePrice != null ? String(p.basePrice) : "",
      salePrice: p.salePrice != null ? String(p.salePrice) : "",
    })),
  );
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    firstRef.current?.select();
  }, []);

  const setField = (id, key, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  // Validate each row; returns error text or ""
  const rowError = (r) => {
    const base = parseFloat(r.basePrice);
    if (isNaN(base) || base <= 0) return "Enter a valid price";
    if (r.isPromo) {
      const sale = parseFloat(r.salePrice);
      if (isNaN(sale) || sale <= 0) return "Enter a valid promo price";
      if (sale >= base) return "Promo must be lower than price";
    }
    return "";
  };

  const isChanged = (r) => {
    const base = parseFloat(r.basePrice);
    if (Math.abs(base - r.oldBase) > 0.0001) return true;
    if (r.isPromo) {
      const sale = parseFloat(r.salePrice);
      if (r.oldSale == null || Math.abs(sale - r.oldSale) > 0.0001) return true;
    }
    return false;
  };

  const changedCount = rows.filter((r) => !rowError(r) && isChanged(r)).length;
  const errorCount = rows.filter((r) => rowError(r)).length;

  const save = async () => {
    if (errorCount) {
      toast.error("Fix the highlighted prices first");
      return;
    }
    const updates = rows.filter(isChanged).map((r) => {
      const data = {
        basePrice: Math.round(parseFloat(r.basePrice) * 100) / 100,
      };
      if (r.isPromo)
        data.salePrice = Math.round(parseFloat(r.salePrice) * 100) / 100;
      return { id: r.id, data };
    });
    if (!updates.length) {
      toast("No price changed");
      return;
    }
    setSaving(true);
    try {
      await onSave(updates);
    } catch (e) {
      console.error("Bulk price save failed:", e);
      toast.error("Failed to save prices");
      setSaving(false);
    }
  };

  // Enter moves to the next price box (like Excel), Ctrl/Cmd+Enter saves
  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) return save();
    const inputs = Array.from(
      e.currentTarget
        .closest("[data-price-list]")
        .querySelectorAll("input[data-price]"),
    );
    const i = inputs.indexOf(e.currentTarget);
    const next = inputs[i + 1];
    if (next) {
      next.focus();
      next.select();
    } else e.currentTarget.blur();
  };

  const inputCls =
    "w-24 px-2.5 py-2 text-sm text-right font-semibold rounded-lg bg-dark-50 dark:bg-dark-800 border outline-none transition-colors text-dark-900 dark:text-dark-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !saving && onClose()}
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-dark-900 rounded-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-bold text-dark-900 dark:text-dark-100">
              Bulk Price Edit · {rows.length} product
              {rows.length > 1 ? "s" : ""}
            </h2>
            <p className="text-xs text-dark-400 mt-0.5">
              Press Enter to jump to the next price.
            </p>
          </div>
          <button
            onClick={() => !saving && onClose()}
            className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800">
            <FiX size={16} />
          </button>
        </div>

        {/* Column titles */}
        <div className="flex items-center gap-3 px-5 py-2 border-y border-dark-100 dark:border-dark-800 bg-dark-50/60 dark:bg-dark-800/40 text-[11px] font-semibold uppercase tracking-wide text-dark-400">
          <span className="flex-1">Item</span>
          <span className="w-24 text-right">Price (RM)</span>
        </div>

        {/* Rows */}
        <div
          data-price-list
          className="flex-1 overflow-y-auto divide-y divide-dark-100 dark:divide-dark-800">
          {rows.map((r, idx) => {
            const err = rowError(r);
            const changed = !err && isChanged(r);
            return (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">
                    {r.itemCode || "—"}
                  </p>
                  <p className="text-sm text-dark-800 dark:text-dark-200 leading-snug break-words">
                    {r.name}
                  </p>
                  {changed && (
                    <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5 font-semibold">
                      was {formatPrice(r.oldBase)}
                      {r.isPromo && r.oldSale != null
                        ? ` · promo was ${formatPrice(r.oldSale)}`
                        : ""}
                    </p>
                  )}
                  {err && (
                    <p className="text-[11px] text-red-500 mt-0.5 font-semibold">
                      {err}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <input
                    ref={idx === 0 ? firstRef : undefined}
                    data-price
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={r.basePrice}
                    onChange={(e) =>
                      setField(r.id, "basePrice", e.target.value)
                    }
                    onKeyDown={onKeyDown}
                    onFocus={(e) => e.target.select()}
                    className={`${inputCls} ${
                      err && !(parseFloat(r.basePrice) > 0)
                        ? "border-red-400"
                        : changed
                          ? "border-primary-400"
                          : "border-transparent focus:border-primary-500"
                    }`}
                  />
                  {r.isPromo && (
                    <label className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase">
                        Promo
                      </span>
                      <input
                        data-price
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={r.salePrice}
                        onChange={(e) =>
                          setField(r.id, "salePrice", e.target.value)
                        }
                        onKeyDown={onKeyDown}
                        onFocus={(e) => e.target.select()}
                        className={`${inputCls} ${
                          err && err.startsWith("Promo")
                            ? "border-red-400"
                            : "border-transparent focus:border-primary-500"
                        }`}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-dark-100 dark:border-dark-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 text-sm font-semibold disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || changedCount === 0 || errorCount > 0}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            {saving ? (
              <>
                <FiLoader size={15} className="animate-spin" /> Saving…
              </>
            ) : changedCount === 0 ? (
              "No changes yet"
            ) : (
              `Save ${changedCount} price${changedCount > 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
