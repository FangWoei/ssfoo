// src/pages/shop/ShopPage.jsx
import useCartStore from "@/context/cartStore";
import { getCategories, getProducts } from "@/firebase/products";
import { formatPrice, truncate } from "@/utils/helpers";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FiGrid,
  FiInfo,
  FiList,
  FiMinus,
  FiPackage,
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiX,
} from "react-icons/fi";

export default function ShopPage() {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [modal, setModal] = useState(null); // product | null

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cats, { products: prods }] = await Promise.all([
          getCategories(),
          getProducts({ pageSize: 100 }),
        ]);
        setCategories(cats);
        setProducts(prods.filter((p) => p.status === "active"));
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = products
    .filter((p) => {
      const matchCat = category === "all" || p.category === category;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.basePrice - b.basePrice;
      if (sortBy === "price_desc") return b.basePrice - a.basePrice;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

  const getCartItem = (productId) =>
    cartItems.find((i) => i.productId === productId);

  const handleAdd = (product, qty) => {
    const min = product.minOrder || 1;
    if (qty < min) {
      toast.error(`Minimum order is ${min} units`);
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.basePrice,
      qty,
      stock: product.stock || 0,
      thumbnail: product.images?.[0] || "",
      minOrder: min,
      note: "",
    });
    toast.success(`${product.name} added!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-dark-900 dark:text-dark-100">
            Products
          </h1>
          <p className="text-sm text-dark-400 mt-0.5">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} available
          </p>
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <button
            onClick={() => setCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === c.name
                  ? "bg-primary-600 text-white"
                  : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400 hover:bg-dark-200 dark:hover:bg-dark-700"
              }`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input py-1.5 text-sm w-auto dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100">
            <option value="createdAt_desc">Newest</option>
            <option value="price_asc">Price: Low–High</option>
            <option value="price_desc">Price: High–Low</option>
            <option value="name_asc">Name A–Z</option>
          </select>
          <div className="flex rounded-xl overflow-hidden border border-dark-200 dark:border-dark-700">
            {[
              ["grid", <FiGrid size={16} />],
              ["list", <FiList size={16} />],
            ].map(([v, icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`p-2 transition-colors ${
                  view === v
                    ? "bg-primary-600 text-white"
                    : "bg-white dark:bg-dark-800 text-dark-500 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-700"
                }`}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProductListRow
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
      <div className="relative aspect-square overflow-hidden bg-dark-50 dark:bg-dark-800">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        {/* Cart badge */}
        {cartItem && (
          <div className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
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
          <p className="text-base font-bold text-primary-600 mt-1">
            {formatPrice(product.basePrice)}
          </p>
          {min > 1 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Min: {min} units
            </p>
          )}
        </div>

        {/* Qty + Add */}
        {inStock && (
          <div className="flex items-center gap-2 mt-auto">
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
              className="flex-1 btn-primary py-1.5 text-xs">
              <FiShoppingCart size={12} />
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── List Row ──────────────────────────────────────────
function ProductListRow({ product, cartItem, onAdd, onInfo }) {
  const min = product.minOrder || 1;
  const inStock = (product.stock || 0) > 0;
  const [qty, setQty] = useState(min);

  return (
    <div className="card dark:bg-dark-900 dark:border-dark-800 p-4 flex items-center gap-4 hover:border-primary-200 dark:hover:border-primary-800 transition-all">
      {/* Image */}
      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-dark-50 dark:bg-dark-800 flex-shrink-0">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dark-300">
            <FiPackage size={24} />
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-dark-900/60 flex items-center justify-center">
            <span className="text-white text-[9px] font-semibold text-center leading-tight px-1">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="font-medium text-dark-800 dark:text-dark-200 truncate">
            {product.name}
          </h3>
          <button
            onClick={onInfo}
            className="text-dark-400 hover:text-primary-600 transition-colors flex-shrink-0 mt-0.5">
            <FiInfo size={14} />
          </button>
        </div>
        <p className="text-xs text-dark-400 mt-0.5">{product.category}</p>
        {min > 1 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Min: {min} units
          </p>
        )}
        {cartItem && (
          <p className="text-xs text-primary-600 font-medium mt-0.5">
            {cartItem.qty} in cart
          </p>
        )}
      </div>

      {/* Price + Qty + Add */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-lg font-bold text-primary-600">
          {formatPrice(product.basePrice)}
        </span>
        {inStock && (
          <>
            <div className="flex items-center border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(min, q - 1))}
                disabled={qty <= min}
                className="px-3 py-2 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                <FiMinus size={13} />
              </button>
              <span className="px-4 py-2 text-sm font-semibold text-dark-900 dark:text-dark-100 min-w-[3rem] text-center border-x border-dark-200 dark:border-dark-700">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                disabled={qty >= product.stock}
                className="px-3 py-2 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                <FiPlus size={13} />
              </button>
            </div>
            <button
              onClick={() => onAdd(product, qty)}
              className="btn-primary py-2 px-4 text-sm">
              <FiShoppingCart size={14} />
              Add
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Info Modal ────────────────────────────────────────
function ProductModal({ product, cartItem, onAdd, onClose }) {
  const min = product.minOrder || 1;
  const inStock = (product.stock || 0) > 0;
  const [qty, setQty] = useState(min);
  const [selImg, setSelImg] = useState(0);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-100 dark:border-dark-800">
          <h2 className="font-display font-bold text-dark-900 dark:text-dark-100 text-lg">
            Product Info
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-400 hover:text-dark-700 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Image */}
          <div className="aspect-video rounded-xl overflow-hidden bg-dark-50 dark:bg-dark-800">
            {product.images?.[selImg] ? (
              <img
                src={product.images[selImg]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-dark-300">
                <FiPackage size={48} />
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelImg(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                    selImg === i
                      ? "border-primary-500"
                      : "border-transparent hover:border-dark-300"
                  }`}>
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Details */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-full">
              {product.category}
            </span>
            <h3 className="text-xl font-display font-bold text-dark-900 dark:text-dark-100">
              {product.name}
            </h3>
            <p className="text-2xl font-bold text-primary-600">
              {formatPrice(product.basePrice)}
            </p>
            {product.description && (
              <p className="text-sm text-dark-600 dark:text-dark-400 leading-relaxed pt-1">
                {product.description}
              </p>
            )}
          </div>

          {/* Stock + min order */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${inStock ? "bg-green-500" : "bg-red-400"}`}
              />
              <span className="text-dark-500 dark:text-dark-400">
                {inStock ? `${product.stock} in stock` : "Out of stock"}
              </span>
            </div>
            {min > 1 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Min order: {min}
              </span>
            )}
          </div>

          {/* Qty + Add */}
          {inStock && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center border border-dark-200 dark:border-dark-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQty((q) => Math.max(min, q - 1))}
                  disabled={qty <= min}
                  className="px-3 py-2.5 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                  <FiMinus size={14} />
                </button>
                <span className="px-5 py-2.5 text-sm font-semibold text-dark-900 dark:text-dark-100 min-w-[3.5rem] text-center border-x border-dark-200 dark:border-dark-700">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  disabled={qty >= product.stock}
                  className="px-3 py-2.5 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-40 transition-colors">
                  <FiPlus size={14} />
                </button>
              </div>
              <button
                onClick={() => {
                  onAdd(product, qty);
                  onClose();
                }}
                className="btn-primary flex-1 py-2.5">
                <FiShoppingCart size={16} />
                Add to Cart
              </button>
            </div>
          )}

          {cartItem && (
            <p className="text-center text-xs text-primary-600 font-medium">
              {cartItem.qty} unit{cartItem.qty !== 1 ? "s" : ""} already in cart
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
