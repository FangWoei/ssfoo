// src/pages/shop/ShopPage.jsx
import RefreshControl from "@/components/common/RefreshControl";
import { useAuth } from "@/context/AuthContext";
import useCartStore from "@/context/cartStore";
import { getAllProducts, getCategories } from "@/firebase/products";
import { formatPrice, truncate } from "@/utils/helpers";
import { discountPct, effectivePrice, isOnPromo } from "@/utils/promo";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  FiInfo,
  FiMinus,
  FiPackage,
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiTag,
  FiX,
} from "react-icons/fi";

// Responsive columns without CSS breakpoints (works even if the
// stylesheet is stale): <768px → 2, <1024px → 4, ≥1024px → 6
function useGridCols() {
  const get = () =>
    window.innerWidth >= 1024 ? 6 : window.innerWidth >= 768 ? 4 : 2;
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const onResize = () => setCols(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}

export default function ShopPage() {
  const gridCols = useGridCols();
  const gridStyle = {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
  };
  const { profile, isAdmin } = useAuth();
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [brandFilter, setBrandFilter] = useState("all");
  const [modal, setModal] = useState(null); // product | null
  const [refreshing, setRefreshing] = useState(false);

  const fetchShop = async () => {
    const [cats, prods] = await Promise.all([
      getCategories(),
      getAllProducts(),
    ]);
    setCategories(cats);
    setProducts(prods.filter((p) => p.status === "active"));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchShop();
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchShop();
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // ── Per-outlet brand visibility ──
  // Outlets with allowedBrands see only those brands (plus unbranded
  // products). Empty/missing list, or admin browsing = see everything.
  const allowed = profile?.allowedBrands;
  const restricted = !isAdmin && Array.isArray(allowed) && allowed.length > 0;
  const visibleProducts = restricted
    ? products.filter((p) => !p.brand || allowed.includes(p.brand))
    : products;

  // Brands present among visible products (for the optional filter row)
  const visibleBrands = [
    ...new Set(visibleProducts.map((p) => p.brand).filter(Boolean)),
  ].sort();

  const filtered = visibleProducts
    .filter((p) => {
      const matchCat = category === "all" || p.category === category;
      const matchBrand = brandFilter === "all" || p.brand === brandFilter;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchBrand && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.basePrice - b.basePrice;
      if (sortBy === "price_desc") return b.basePrice - a.basePrice;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

  const getCartItem = (productId) =>
    cartItems.find((i) => i.productId === productId);

  // Promotion products — only shown when not actively filtering (#5)
  const promoProducts = visibleProducts.filter((p) => isOnPromo(p));
  const showPromoRow =
    promoProducts.length > 0 &&
    !search &&
    category === "all" &&
    brandFilter === "all";

  const handleAdd = (product, qty) => {
    const min = product.minOrder || 1;
    if (qty < min) {
      toast.error(`Minimum order is ${min} units`);
      return;
    }
    addItem({
      productId: product.id,
      itemCode: product.itemCode || "",
      name: product.name,
      price: effectivePrice(product),
      basePrice: product.basePrice,
      onPromo: isOnPromo(product),
      qty,
      stock: product.stock || 0,
      thumbnail: product.images?.[0] || "",
      minOrder: min,
      uom: product.uom || "",
      focBuy: product.focBuy || 0,
      focFree: product.focFree || 0,
      note: "",
    });
    toast.success(`${product.name} added!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-dark-900 dark:text-dark-100">
              Products
            </h1>
            <p className="text-sm text-dark-400 mt-0.5">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} available
            </p>
          </div>
          <div className="sm:hidden">
            <RefreshControl
              onRefresh={doRefresh}
              refreshing={refreshing}
              storageKey="ssfoo-refresh-shop"
            />
          </div>
        </div>
        <div className="hidden sm:block">
          <RefreshControl
            onRefresh={doRefresh}
            refreshing={refreshing}
            storageKey="ssfoo-refresh-shop"
          />
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="input pl-10 pr-10 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600">
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        {/* Category filter: chips on lg+, dropdown on md/sm */}
        {gridCols < 6 ? (
          <div
            className="flex items-center"
            style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-700 dark:text-dark-200 outline-none"
              style={{ flex: "1 1 150px", minWidth: 0 }}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {visibleBrands.length >= 2 && (
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-700 text-dark-700 dark:text-dark-200 outline-none"
                style={{ flex: "1 1 150px", minWidth: 0 }}>
                <option value="all">All brands</option>
                {visibleBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div
            className="flex items-center"
            style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              onClick={() => setCategory("all")}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === "all"
                  ? "bg-primary-600 text-white"
                  : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700"
              }`}>
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.name)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === c.name
                    ? "bg-primary-600 text-white"
                    : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700"
                }`}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input py-1.5 text-sm w-auto dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100">
            <option value="createdAt_desc">Newest</option>
            <option value="price_asc">Price: Low–High</option>
            <option value="price_desc">Price: High–Low</option>
            <option value="name_asc">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* ── Brand filter (shown only when 2+ brands visible) ── */}
      {visibleBrands.length >= 2 && gridCols >= 6 && (
        <div
          className="flex items-center"
          style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <span className="shrink-0 text-xs font-semibold text-dark-400 uppercase tracking-wide">
            Brand
          </span>
          <button
            onClick={() => setBrandFilter("all")}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              brandFilter === "all"
                ? "bg-dark-900 dark:bg-dark-100 text-white dark:text-dark-900"
                : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700"
            }`}>
            All
          </button>
          {visibleBrands.map((b) => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                brandFilter === b
                  ? "bg-dark-900 dark:bg-dark-100 text-white dark:text-dark-900"
                  : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700"
              }`}>
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      {/* ── Promotions row (#5) ── */}
      {!loading && showPromoRow && (
        <div className="rounded-2xl border border-primary-200 dark:border-primary-800/60 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-600 text-white text-xs font-bold">
              <FiTag size={13} /> Promotions
            </div>
            <span className="text-xs text-dark-400">
              {promoProducts.length} special offer
              {promoProducts.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={gridStyle}>
            {promoProducts.map((p) => (
              <ProductCard
                key={`promo-${p.id}`}
                product={p}
                cartItem={getCartItem(p.id)}
                onAdd={handleAdd}
                onInfo={() => setModal(p)}
              />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={gridStyle}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse space-y-3">
              <div className="bg-dark-100 dark:bg-dark-800 rounded-xl aspect-square" />
              <div className="h-4 bg-dark-100 dark:bg-dark-800 rounded w-3/4" />
              <div className="h-4 bg-dark-100 dark:bg-dark-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FiPackage size={48} className="text-dark-300 mb-4" />
          <h3 className="text-lg font-medium text-dark-700 dark:text-dark-300">
            No products found
          </h3>
          <p className="text-dark-400 text-sm mt-1">
            Try adjusting your search or filter
          </p>
          {(search || category !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
              className="btn-outline mt-4 text-sm">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={gridStyle}>
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              cartItem={getCartItem(p.id)}
              onAdd={handleAdd}
              onInfo={() => setModal(p)}
            />
          ))}
        </div>
      )}

      {/* Info Modal */}
      {modal && (
        <ProductModal
          product={modal}
          cartItem={getCartItem(modal.id)}
          onAdd={handleAdd}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Grid Card ─────────────────────────────────────────
function ProductCard({ product, cartItem, onAdd, onInfo }) {
  const min = product.minOrder || 1;
  const inStock = (product.stock || 0) > 0;
  const [qty, setQty] = useState(min);

  return (
    <div className="card dark:bg-dark-900 dark:border-dark-800 overflow-hidden group hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200 flex flex-col">
      {/* Image */}
      <div
        className="relative aspect-square overflow-hidden bg-dark-50 dark:bg-dark-800"
        style={{ aspectRatio: "1 / 1", overflow: "hidden" }}>
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dark-300">
            <FiPackage size={40} />
          </div>
        )}
        {/* Info button */}
        <button
          onClick={onInfo}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 dark:bg-dark-800/90 flex items-center justify-center text-dark-500 hover:text-primary-600 shadow transition-colors">
          <FiInfo size={13} />
        </button>
        {/* Promo ribbon */}
        {isOnPromo(product) && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <FiTag size={10} /> -{discountPct(product)}%
          </div>
        )}
        {/* Cart badge */}
        {cartItem && (
          <div
            className={`absolute ${isOnPromo(product) ? "top-9" : "top-2"} left-2 bg-dark-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>
            {cartItem.qty} in cart
          </div>
        )}
        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-dark-900/50 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-red-500 px-3 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="text-sm font-medium text-dark-800 dark:text-dark-200 leading-snug">
            {truncate(product.name, 45)}
          </h3>
          {isOnPromo(product) ? (
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-primary-600">
                {formatPrice(product.salePrice)}
              </p>
              <p className="text-xs text-dark-400 line-through">
                {formatPrice(product.basePrice)}
              </p>
              <span className="text-[10px] font-bold text-white bg-primary-600 px-1.5 py-0.5 rounded">
                -{discountPct(product)}%
              </span>
            </div>
          ) : (
            <p className="text-base font-bold text-primary-600 mt-1">
              {formatPrice(product.basePrice)}
            </p>
          )}
          {min > 1 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Min: {min} units
            </p>
          )}
          {product.focBuy > 0 && product.focFree > 0 && (
            <p className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
              🎁 Buy {product.focBuy} Free {product.focFree}
            </p>
          )}
        </div>

        {/* Qty + Add */}
        {inStock && (
          <div className="flex items-center gap-2 mt-auto flex-wrap">
            <div className="flex items-center border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(min, q - 1))}
                disabled={qty <= min}
                className="px-2 py-1.5 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                <FiMinus size={12} />
              </button>
              <span className="px-2 py-1.5 text-xs font-semibold text-dark-900 dark:text-dark-100 min-w-[2rem] text-center border-x border-dark-200 dark:border-dark-700">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                disabled={qty >= product.stock}
                className="px-2 py-1.5 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                <FiPlus size={12} />
              </button>
            </div>
            <button
              onClick={() => onAdd(product, qty)}
              className="flex-1 min-w-[96px] btn-primary py-1.5 text-xs">
              <FiShoppingCart size={12} />
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Info Modal (redesigned, responsive) ───────────────
function ProductModal({ product, cartItem, onAdd, onClose }) {
  const min = product.minOrder || 1;
  const inStock = (product.stock || 0) > 0;
  const promo = isOnPromo(product);
  const [qty, setQty] = useState(min);
  const [selImg, setSelImg] = useState(0);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const price = effectivePrice(product);
  const lowStock = inStock && product.stock <= min * 2;

  // Portal to <body>: escapes the .page-enter transform that otherwise
  // breaks position:fixed and makes the modal follow page scroll.
  return createPortal(
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-dark-900/70 backdrop-blur-sm sm:p-4">
      <div className="bg-white dark:bg-dark-900 w-full sm:max-w-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col sm:flex-row animate-[slideUp_0.25s_ease-out]">
        {/* ── Left: image gallery ── */}
        <div className="sm:w-1/2 bg-dark-50 dark:bg-dark-800 relative shrink-0 flex items-start justify-center self-stretch">
          {/* Close (mobile floats over image) */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 dark:bg-dark-900/90 flex items-center justify-center text-dark-500 hover:text-dark-800 shadow-md transition-colors sm:hidden">
            <FiX size={18} />
          </button>

          {promo && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
              <FiTag size={12} /> -{discountPct(product)}%
            </div>
          )}

          <div className="w-full aspect-square sm:aspect-auto sm:h-full sm:max-h-[90vh] flex items-center justify-center overflow-hidden">
            {product.images?.[selImg] ? (
              <img
                src={product.images[selImg]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full min-h-[200px] flex items-center justify-center text-dark-300">
                <FiPackage size={56} />
              </div>
            )}
          </div>

          {/* Thumbnails overlay */}
          {product.images?.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-white/80 dark:bg-dark-900/80 backdrop-blur px-2 py-1.5 rounded-full">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelImg(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    selImg === i
                      ? "bg-primary-600 w-5"
                      : "bg-dark-300 dark:bg-dark-600"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: details ── */}
        <div className="sm:w-1/2 flex flex-col min-h-0 overflow-y-auto">
          <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
            {/* Close (desktop) */}
            <div className="hidden sm:flex justify-end -mt-2 -mr-2">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-400 hover:text-dark-700 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Category + code */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-full">
                {product.category}
              </span>
              {product.itemCode && (
                <span className="text-xs font-mono font-bold text-dark-500 dark:text-dark-400 bg-dark-100 dark:bg-dark-800 px-2 py-1 rounded-full">
                  {product.itemCode}
                </span>
              )}
            </div>

            {/* Name */}
            <h2 className="text-xl sm:text-2xl font-display font-bold text-dark-900 dark:text-dark-100 leading-tight">
              {product.name}
            </h2>

            {/* Price */}
            <div className="flex items-end gap-2.5 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-primary-600">
                {formatPrice(price)}
              </span>
              {promo && (
                <>
                  <span className="text-base text-dark-400 line-through mb-1">
                    {formatPrice(product.basePrice)}
                  </span>
                  <span className="text-xs font-bold text-white bg-primary-600 px-2 py-0.5 rounded-lg mb-1.5">
                    Save {discountPct(product)}%
                  </span>
                </>
              )}
            </div>

            {/* Stock + MOQ chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  inStock
                    ? lowStock
                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                      : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-500"
                }`}>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    inStock
                      ? lowStock
                        ? "bg-amber-500"
                        : "bg-green-500"
                      : "bg-red-400"
                  }`}
                />
                {inStock ? `${product.stock} in stock` : "Out of stock"}
              </span>
              {min > 1 && (
                <span className="text-xs font-medium text-dark-500 dark:text-dark-400 bg-dark-100 dark:bg-dark-800 px-2.5 py-1 rounded-full">
                  Min order: {min}
                </span>
              )}
              {product.focBuy > 0 && product.focFree > 0 && (
                <span className="text-xs font-semibold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-full">
                  🎁 Buy {product.focBuy} Free {product.focFree}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-dark-600 dark:text-dark-400 leading-relaxed">
                {product.description}
              </p>
            )}

            {cartItem && (
              <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                {cartItem.qty} unit{cartItem.qty !== 1 ? "s" : ""} already in
                cart
              </p>
            )}
          </div>

          {/* Sticky footer: qty + add */}
          {inStock && (
            <div className="p-5 sm:p-6 pt-4 border-t border-dark-100 dark:border-dark-800 bg-white dark:bg-dark-900">
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden shrink-0">
                  <button
                    onClick={() => setQty((q) => Math.max(min, q - 1))}
                    disabled={qty <= min}
                    className="px-3 py-3 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                    <FiMinus size={14} />
                  </button>
                  <span className="px-4 py-3 text-sm font-semibold text-dark-900 dark:text-dark-100 min-w-[3rem] text-center border-x border-dark-200 dark:border-dark-700">
                    {qty}
                  </span>
                  <button
                    onClick={() =>
                      setQty((q) => Math.min(product.stock, q + 1))
                    }
                    disabled={qty >= product.stock}
                    className="px-3 py-3 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                    <FiPlus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => {
                    onAdd(product, qty);
                    onClose();
                  }}
                  className="btn-primary flex-1 py-3 justify-center">
                  <FiShoppingCart size={16} />
                  Add to Cart
                </button>
              </div>
              <p className="text-center text-xs text-dark-400 mt-2">
                Subtotal: {formatPrice(price * qty)}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
