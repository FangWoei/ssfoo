// src/pages/admin/AdminProducts.jsx
import ProductImportModal from "@/components/admin/ProductImportModal";
import { db } from "@/firebase/config";
import { deleteProduct } from "@/firebase/products";
import { formatPrice, tsToDate } from "@/utils/helpers";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FiAlertCircle,
  FiEdit2,
  FiEye,
  FiPlus,
  FiSearch,
  FiStar,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "products"), orderBy("createdAt", "desc")),
      );
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteProduct(id);
      setProducts((p) => p.filter((x) => x.id !== id));
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  const handleTogglePublish = async (productId, currentStatus) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    try {
      await updateDoc(doc(db, "products", productId), { status: newStatus });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: newStatus } : p)),
      );
      toast.success(
        newStatus === "published"
          ? "✅ Product published!"
          : "⏳ Moved to draft",
      );
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleToggleFeatured = async (productId, currentlyFeatured) => {
    // If turning ON, check 10-product limit
    if (!currentlyFeatured) {
      const featuredCount = products.filter((p) => p.featured).length;
      if (featuredCount >= 10) {
        toast.error("Maximum 10 featured products. Unfeature one first.");
        return;
      }
    }

    try {
      const newValue = !currentlyFeatured;
      await updateDoc(doc(db, "products", productId), { featured: newValue });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, featured: newValue } : p,
        ),
      );
      toast.success(
        newValue ? "⭐ Added to homepage" : "Removed from homepage",
      );
    } catch {
      toast.error("Failed to update");
    }
  };

  const filtered = products
    .filter(
      (p) => !search || p.name?.toLowerCase().includes(search.toLowerCase()),
    )
    .filter((p) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "published") return p.status === "published";
      if (statusFilter === "draft") return p.status !== "published";
      if (statusFilter === "featured") return p.featured === true;
      return true;
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Products
          </h1>
          <p className="text-dark-400 text-sm">
            {products.length} total products
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="btn-outline gap-2 text-sm py-2.5 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800">
            <FiUpload size={15} /> Import
          </button>
          <Link
            to="/admin/products/new"
            className="btn-primary gap-2 text-sm py-2.5">
            <FiPlus size={15} /> Add Product
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-dark-100 dark:border-dark-800">
          <div className="relative w-full max-w-xs max-w-xs">
            <FiSearch
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="input pl-9 py-2 text-sm dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
                <FiX size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {[
              { key: "all", label: "All", count: products.length },
              {
                key: "published",
                label: "✅ Published",
                count: products.filter((p) => p.status === "published").length,
              },
              {
                key: "draft",
                label: "⏳ Draft",
                count: products.filter((p) => p.status !== "published").length,
              },
              {
                key: "featured",
                label: "⭐ Featured",
                count: products.filter((p) => p.featured).length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === tab.key
                    ? "bg-primary-600 text-white"
                    : "bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-dark-300"
                }`}>
                {tab.label}{" "}
                <span className="ml-1 opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-8 text-center text-dark-400 text-sm">
            Loading products…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-dark-400 text-sm">
            No products found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-100 dark:border-dark-800 bg-dark-50/50 dark:bg-dark-800/50">
                  {[
                    "Product",
                    "Category",
                    "Price",
                    "Variants",
                    "Status",
                    "Added",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-50 dark:divide-dark-800">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-dark-50/50 dark:hover:bg-dark-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={
                              p.images?.[0] ||
                              "https://placehold.co/40x40/f0e8e0/d14420?text=?"
                            }
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover border border-dark-100 dark:border-dark-800"
                          />
                          {/* ✅ Warning badge if no images */}
                          {(!p.images || p.images.length === 0) && (
                            <span
                              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 border-2 border-white dark:border-dark-900 flex items-center justify-center"
                              title="No image — add one">
                              <FiAlertCircle size={9} className="text-white" />
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-dark-900 dark:text-dark-100 truncate max-w-[180px]">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.badge && (
                              <span className="text-[10px] text-primary-600 font-medium">
                                {p.badge}
                              </span>
                            )}
                            {(!p.images || p.images.length === 0) && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                ⚠️ No image
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-dark-50 dark:bg-dark-800 text-dark-600 dark:text-dark-400 capitalize">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-dark-900 dark:text-dark-100">
                      {formatPrice(p.basePrice)}
                    </td>
                    <td className="px-4 py-3 text-dark-500 dark:text-dark-400">
                      {p.variants?.length || 0} variants
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTogglePublish(p.id, p.status)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          p.status === "published"
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100"
                            : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                        }`}>
                        {p.status === "published" ? "✅ Published" : "⏳ Draft"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-xs">
                      {tsToDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleToggleFeatured(p.id, p.featured)}
                          title={
                            p.featured
                              ? "Remove from homepage"
                              : "Feature on homepage"
                          }
                          className={`p-1.5 rounded-lg transition-colors ${
                            p.featured
                              ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              : "text-dark-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          }`}>
                          <FiStar
                            size={14}
                            className={p.featured ? "fill-current" : ""}
                          />
                        </button>
                        <Link
                          to={`/shop/${p.id}`}
                          target="_blank"
                          className="p-1.5 text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors">
                          <FiEye size={14} />
                        </Link>
                        <Link
                          to={`/admin/products/${p.id}`}
                          className="p-1.5 text-dark-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <FiEdit2 size={14} />
                        </Link>
                        {confirmId === p.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(p.id)}
                              disabled={deleting === p.id}
                              className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600">
                              {deleting === p.id ? "…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="text-xs px-2 py-1 border border-dark-200 dark:border-dark-700 dark:text-dark-400 rounded-lg">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(p.id)}
                            className="p-1.5 text-dark-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ✅ Import Modal */}
      {showImport && (
        <ProductImportModal
          onClose={() => setShowImport(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
