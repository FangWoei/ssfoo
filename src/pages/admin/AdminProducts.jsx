// src/pages/admin/AdminProducts.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import RefreshControl from "@/components/common/RefreshControl";
import {
  bulkAddProducts,
  bulkDeleteProducts,
  deleteProduct,
  getAllProducts,
  getBrands,
  getCategories,
  toggleProductPromo,
  updateProduct,
} from "@/firebase/products";
import { formatPrice } from "@/utils/helpers";
import {
  downloadProductTemplate,
  parseProductFile,
} from "@/utils/productImport";
import { isOnPromo } from "@/utils/promo";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiDownload,
  FiEdit2,
  FiLoader,
  FiPlus,
  FiSearch,
  FiTag,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='12' fill='%23ccfbf1'/%3E%3Ctext x='48' y='62' font-size='38' text-anchor='middle'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";
const STATUS_FILTERS = ["all", "active", "draft"];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [importModal, setImportModal] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [prods, cats, brandList] = await Promise.all([
        getAllProducts(),
        getCategories(),
        getBrands(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setBrands(brandList);
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
      list = list.filter((p) => p.name?.toLowerCase().includes(q));
    }
    return list;
  }, [products, statusFilter, catFilter, brandFilter, search]);

  const toggleStatus = async (product) => {
    const next = product.status === "active" ? "draft" : "active";
    try {
      await updateProduct(product.id, { status: next });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: next } : p)),
      );
      toast.success(next === "active" ? "Published" : "Moved to draft");
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

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Delete ${selected.length} products? This cannot be undone.`,
      )
    )
      return;
    try {
      await bulkDeleteProducts(selected);
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
    filtered.length > 0 && filtered.every((p) => selected.includes(p.id));

  const toggleSelectAll = () =>
    setSelected(allSelected ? [] : filtered.map((p) => p.id));

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
      setImportResult(result);
      setImportModal(true);
    } catch (err) {
      console.error("Parse failed:", err);
      toast.error("Could not read that file");
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importResult?.valid?.length) return;
    setImporting(true);
    try {
      await bulkAddProducts(importResult.valid);
      toast.success(`${importResult.valid.length} products imported`);
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
            onClick={() => downloadProductTemplate(categories, brands)}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-500 text-sm font-semibold transition-colors">
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
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
            placeholder="Search products…"
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

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-700 dark:text-dark-200 outline-none">
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
          className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-700 dark:text-dark-200 outline-none">
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
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between bg-primary-600 text-white rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold">
            {selected.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25 transition-colors">
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 transition-colors">
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* ── Product list ── */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 overflow-hidden">
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
                Select all ({filtered.length})
              </span>
              {selected.length > 0 && !allSelected && (
                <span className="text-xs text-dark-400">
                  · {selected.length} selected
                </span>
              )}
            </label>
            <div className="divide-y divide-dark-100 dark:divide-dark-800">
              {filtered.map((p) => {
                const active = p.status === "active";
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
                      src={p.images?.[0] || PLACEHOLDER}
                      alt={p.name}
                      className="w-11 h-11 rounded-lg object-cover bg-dark-100 dark:bg-dark-800 shrink-0"
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
                      </p>
                      {/* Mobile-only price + stock (desktop shows the right column) */}
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
                        <span
                          className={`ml-1.5 ${
                            (p.stock || 0) > 0
                              ? "text-dark-400"
                              : "text-red-500 font-semibold"
                          }`}>
                          · {p.stock || 0} in stock
                        </span>
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
                        <>
                          <p className="text-sm font-bold text-dark-900 dark:text-dark-100">
                            {formatPrice(p.basePrice || 0)}
                          </p>
                          <p
                            className={`text-[11px] ${
                              (p.stock || 0) > 0
                                ? "text-dark-400"
                                : "text-red-500 font-semibold"
                            }`}>
                            {p.stock || 0} in stock
                          </p>
                        </>
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

                      <button
                        onClick={() => toggleStatus(p)}
                        className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
                          active
                            ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 hover:bg-primary-100"
                            : "bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400 hover:bg-dark-200"
                        }`}
                        title="Click to toggle">
                        {active ? "Active" : "Draft"}
                      </button>

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
                  {importResult.valid.length}
                </p>
                <p className="text-xs text-dark-500">Ready to import</p>
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
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {importing ? (
                  <>
                    <FiLoader size={15} className="animate-spin" /> Importing…
                  </>
                ) : (
                  `Import ${importResult.valid.length} products`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
