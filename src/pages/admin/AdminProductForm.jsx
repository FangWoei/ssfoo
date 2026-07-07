import LoadingSpinner from "@/components/common/LoadingSpinner";
import { db, storage } from "@/firebase/config";
import { addProduct, getProduct, updateProduct } from "@/firebase/products";
import useFormKeyboard from "@/hooks/useFormKeyboard";
import { formatPrice, genId } from "@/utils/helpers";
import { collection, getDocs } from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiPlus,
  FiSave,
  FiStar,
  FiTag,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiUpload,
  FiX,
  FiZoomIn,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";

const blankVariant = () => ({
  id: genId(),
  label: "",
  price: "",
  stock: 0,
  thumbnail: "",
});

function ImageLightbox({ url, onClose }) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex justify-center p-5"
      onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
        aria-label="Close">
        <FiX size={24} />
      </button>
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "85vw", maxHeight: "85vh" }}
        className="object-contain rounded-2xl shadow-2xl"
      />
    </div>
  );
}

function BulkImageUpload({ currentCount, maxCount, onUpload }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, pct: 0 });

  const handleFiles = async (files) => {
    const remaining = maxCount - currentCount;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) {
      toast.error("Maximum 6 images reached");
      return;
    }

    // Validate all files first
    for (const file of toUpload) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB`);
        return;
      }
    }

    setUploading(true);
    setProgress({ current: 0, total: toUpload.length, pct: 0 });

    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const path = `products/${Date.now()}_${file.name}`;
        const r = ref(storage, path);
        const task = uploadBytesResumable(r, file);

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (s) => {
              const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
              setProgress({ current: i + 1, total: toUpload.length, pct });
            },
            reject,
            resolve,
          );
        });

        const url = await getDownloadURL(task.snapshot.ref);
        onUpload(url);
        setProgress({ current: i + 1, total: toUpload.length, pct: 100 });
      }
      toast.success(
        `${toUpload.length} image${toUpload.length > 1 ? "s" : ""} uploaded!`,
      );
    } catch (e) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-dark-200 dark:border-dark-700 rounded-xl flex flex-col items-center justify-center gap-2 p-6 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <>
          <div className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-dark-600 dark:text-dark-400">
            Uploading {progress.current}/{progress.total}…
          </p>
          <div className="w-48 h-1.5 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <FiUpload size={22} className="text-dark-400" />
          <p className="text-sm font-medium text-dark-600 dark:text-dark-400">
            Click or drag images here
          </p>
          <p className="text-xs text-dark-400">
            Select up to {maxCount - currentCount} image
            {maxCount - currentCount > 1 ? "s" : ""} at once · Max 5MB each
          </p>
        </>
      )}
    </div>
  );
}

// ── Reusable image upload box ─────────────────────────
function ImageBox({ url, onUpload, onRemove, small = false }) {
  const inputRef = useRef(null);
  const [prog, setProg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false); // ← add this

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB per image");
      return;
    }
    setBusy(true);
    setProg(0);
    try {
      const path = `products/${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      const task = uploadBytesResumable(r, file);
      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (s) => setProg(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          reject,
          resolve,
        );
      });
      const downloadUrl = await getDownloadURL(task.snapshot.ref);
      onUpload(downloadUrl);
    } catch (e) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (url)
    return (
      <>
        {zoom && <ImageLightbox url={url} onClose={() => setZoom(false)} />}
        <div
          className={`relative rounded-xl overflow-hidden border border-dark-200 dark:border-dark-700 group ${small ? "h-20 w-20 shrink-0" : "aspect-square"}`}>
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setZoom(true)}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-dark-700 hover:bg-white transition-colors">
              <FiZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-red-500 hover:bg-white transition-colors">
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>
      </>
    );

  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files?.[0]);
      }}
      onDragOver={(e) => e.preventDefault()}
      className={`relative border-2 border-dashed border-dark-200 dark:border-dark-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all ${small ? "h-20 w-20 shrink-0" : "aspect-square"}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {busy ? (
        <div className="flex flex-col items-center gap-1">
          <div className="h-6 w-6 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          {!small && <p className="text-xs text-dark-400">{prog}%</p>}
        </div>
      ) : (
        <>
          <FiUpload size={small ? 14 : 20} className="text-dark-400" />
          {!small && (
            <p className="text-xs text-dark-500 mt-1 text-center px-2">
              Click or drag
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Delete image from Storage ─────────────────────────
const tryDeleteStorageImage = async (url) => {
  if (!url?.startsWith("https://firebasestorage")) return;
  try {
    await deleteObject(ref(storage, url));
  } catch {}
};

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState([]);

  const [form, setForm] = useState({
    name: "",
    category: "",
    basePrice: "",
    comparePrice: "",
    description: "",
    badge: "",
    images: [],
    variants: [blankVariant()],
  });

  const { handleKeyDown } = useFormKeyboard();

  useEffect(() => {
    getDocs(collection(db, "categories"))
      .then((snap) =>
        setCats(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getProduct(id).then((p) => {
      if (p) {
        const variants = p.variants || [];
        if (variants.length > 0)
          variants[0] = { ...variants[0], price: p.basePrice };
        setForm({
          ...p,
          basePrice: p.basePrice || "",
          comparePrice: p.comparePrice || "",
          variants,
          images: p.images || [],
        });
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setVariant = (idx, key, val) =>
    setForm((p) => ({
      ...p,
      variants: p.variants.map((v, i) =>
        i === idx ? { ...v, [key]: val } : v,
      ),
    }));
  const addVariant = () =>
    setForm((p) => ({ ...p, variants: [...p.variants, blankVariant()] }));
  const removeVariant = (idx) => {
    if (form.variants.length <= 1) {
      toast.error("At least one variant required");
      return;
    }
    setForm((p) => ({
      ...p,
      variants: p.variants.filter((_, i) => i !== idx),
    }));
  };

  // ── Product image handlers ────────────────────────────
  const handleProductImageUpload = (url) => {
    setForm((p) => ({ ...p, images: [...(p.images || []), url] }));
  };

  const handleRemoveProductImage = async (index) => {
    await tryDeleteStorageImage(form.images[index]);
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== index) }));
  };

  // ── Variant image handlers ────────────────────────────
  const handleVariantImageUpload = (idx, url) => {
    setVariant(idx, "thumbnail", url);
  };

  const handleRemoveVariantImage = async (idx) => {
    await tryDeleteStorageImage(form.variants[idx].thumbnail);
    setVariant(idx, "thumbnail", "");
  };

  // ── Save ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim() || !form.basePrice) {
      toast.error("Name and price are required");
      return;
    }
    if (!form.category) {
      toast.error("Category is required");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        badge: form.badge.trim(),
        basePrice: parseFloat(form.basePrice),
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
        images: (form.images || []).filter(Boolean),
        variants: form.variants.map((v, i) => ({
          ...v,
          price:
            i === 0
              ? parseFloat(form.basePrice)
              : parseFloat(v.price) || parseFloat(form.basePrice),
          stock: parseInt(v.stock) || 0,
        })),
        inStock: form.variants.some((v) => parseInt(v.stock) > 0),
        // ✅ New products default to draft, edit keeps existing status
        status: isEdit ? form.status || "draft" : "draft",
      };
      if (isEdit) {
        await updateProduct(id, data);
        toast.success("Product updated!");
      } else {
        await addProduct(data);
        toast.success("Product added!");
      }
      navigate("/admin/products");
    } catch (err) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <form className="max-w-3xl space-y-5" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/products"
            className="p-2 hover:bg-dark-100 dark:hover:bg-dark-800 rounded-lg transition-colors text-dark-600 dark:text-dark-400">
            <FiArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            {isEdit ? "Edit Product" : "New Product"}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary gap-2 text-sm py-2.5">
          <FiSave size={15} /> {saving ? "Saving…" : "Save Product"}
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5 space-y-4">
        <h2 className="font-semibold text-dark-900 dark:text-dark-100">
          Basic Information
        </h2>
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
            Product Name *
          </label>
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
            placeholder="Premium Leather Wallet"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={4}
            className="input resize-none dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
            placeholder="Product description…"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100">
              <option value="">Select category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Badge (optional)
            </label>
            <input
              value={form.badge}
              onChange={(e) => setField("badge", e.target.value)}
              className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
              placeholder="e.g. Best Seller, New"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Base Price (RM) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.basePrice}
              onChange={(e) => {
                setForm((p) => ({
                  ...p,
                  basePrice: e.target.value,
                  variants: p.variants.map((v, i) =>
                    i === 0 ? { ...v, price: e.target.value } : v,
                  ),
                }));
              }}
              className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
              placeholder="89.90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
              Compare Price (RM)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.comparePrice}
              onChange={(e) => setField("comparePrice", e.target.value)}
              className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
              placeholder="129.00"
            />
          </div>
        </div>
      </div>

      {/* Product Images */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-dark-900 dark:text-dark-100">
            Product Images
          </h2>
          <span className="text-xs text-dark-400">
            {(form.images || []).filter(Boolean).length} / 10
          </span>
        </div>
        <p className="text-xs text-dark-400">
          First image is the main display. Max 5MB per image.
        </p>

        {/* Bulk upload button */}
        {(form.images || []).length < 10 && (
          <BulkImageUpload
            currentCount={(form.images || []).length}
            maxCount={10}
            onUpload={(url) =>
              setForm((p) => ({ ...p, images: [...(p.images || []), url] }))
            }
          />
        )}

        {/* Image grid */}
        {(form.images || []).length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
            {(form.images || []).map((url, i) => (
              <div key={i} className="relative">
                <ImageBox
                  url={url}
                  onRemove={() => handleRemoveProductImage(i)}
                  onUpload={() => {}}
                />
                {i === 0 && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-0.5 text-[9px] bg-primary-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                    <FiStar size={8} /> Main
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-dark-900 dark:text-dark-100">
              Variants
            </h2>
            <p className="text-xs text-dark-400 mt-0.5">
              Each variant can have its own label, price, stock, and image.
            </p>
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="btn-outline text-xs py-1.5 px-3 gap-1.5 dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800">
            <FiPlus size={13} /> Add Variant
          </button>
        </div>

        {form.variants.map((v, idx) => (
          <div
            key={v.id}
            className="border border-dark-200 dark:border-dark-700 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">
                Variant {idx + 1}{" "}
                {idx === 0 && (
                  <span className="text-primary-500">(Default)</span>
                )}
              </span>
              {form.variants.length > 1 && (
                <button
                  onClick={() => removeVariant(idx)}
                  className="text-dark-400 hover:text-red-500 transition-colors">
                  <FiTrash2 size={14} />
                </button>
              )}
            </div>

            {/* Image + fields row */}
            <div className="flex gap-3 items-start">
              {/* Variant image upload */}
              <div className="shrink-0">
                <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                  Image
                </label>
                <ImageBox
                  small
                  url={v.thumbnail}
                  onUpload={(url) => handleVariantImageUpload(idx, url)}
                  onRemove={() => handleRemoveVariantImage(idx)}
                />
              </div>

              {/* Fields */}
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 sm:col-span-1">
                    <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                      Label
                    </label>
                    <input
                      value={v.label}
                      onChange={(e) => setVariant(idx, "label", e.target.value)}
                      className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
                      placeholder="e.g. Black, Size M"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                      Price (RM){" "}
                      {idx === 0 && (
                        <span className="text-primary-500 text-[10px]">
                          = Base
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={idx === 0 ? form.basePrice : v.price}
                      onChange={(e) =>
                        idx !== 0 && setVariant(idx, "price", e.target.value)
                      }
                      readOnly={idx === 0}
                      className={`input text-sm py-2 dark:border-dark-700 ${idx === 0 ? "bg-dark-50 dark:bg-dark-800 text-dark-400 cursor-not-allowed" : "dark:bg-dark-800 dark:text-dark-100"}`}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => setVariant(idx, "stock", e.target.value)}
                      className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Promotion */}
            <div className="border-t border-dark-100 dark:border-dark-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-dark-500 dark:text-dark-400 flex items-center gap-1.5">
                  <FiTag size={12} /> Variant Promotion
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setVariant(idx, "promotion", {
                      ...v.promotion,
                      active: !v.promotion?.active,
                    })
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${v.promotion?.active ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400"}`}>
                  {v.promotion?.active ? (
                    <FiToggleRight size={14} />
                  ) : (
                    <FiToggleLeft size={14} />
                  )}
                  {v.promotion?.active ? "On" : "Off"}
                </button>
              </div>

              {v.promotion?.active && (
                <div className="space-y-2.5 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3">
                  <div>
                    <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                      Promotion Label
                    </label>
                    <input
                      value={v.promotion?.label || ""}
                      onChange={(e) =>
                        setVariant(idx, "promotion", {
                          ...v.promotion,
                          label: e.target.value,
                        })
                      }
                      className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
                      placeholder="e.g. Flash Sale, Raya Special"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={v.promotion?.discountType || "percentage"}
                        onChange={(e) =>
                          setVariant(idx, "promotion", {
                            ...v.promotion,
                            discountType: e.target.value,
                          })
                        }
                        className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100">
                        <option value="percentage">% Off</option>
                        <option value="fixed">RM Off</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                        Value{" "}
                        {v.promotion?.discountType === "percentage"
                          ? "(%)"
                          : "(RM)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={v.promotion?.discountValue || ""}
                        onChange={(e) =>
                          setVariant(idx, "promotion", {
                            ...v.promotion,
                            discountValue: parseFloat(e.target.value),
                          })
                        }
                        className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
                        placeholder={
                          v.promotion?.discountType === "percentage"
                            ? "20"
                            : "10.00"
                        }
                      />
                    </div>
                  </div>

                  {/* Price preview */}
                  {(v.price || form.basePrice) &&
                    v.promotion?.discountValue && (
                      <div className="flex items-center justify-between bg-white dark:bg-dark-800 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900/30">
                        <span className="text-xs text-dark-500 dark:text-dark-400">
                          Preview:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-dark-400 line-through">
                            {formatPrice(
                              parseFloat(v.price) || parseFloat(form.basePrice),
                            )}
                          </span>
                          <span className="text-sm font-bold text-red-500">
                            {formatPrice(
                              v.promotion?.discountType === "percentage"
                                ? (parseFloat(v.price) ||
                                    parseFloat(form.basePrice)) *
                                    (1 - v.promotion.discountValue / 100)
                                : Math.max(
                                    0,
                                    (parseFloat(v.price) ||
                                      parseFloat(form.basePrice)) -
                                      v.promotion.discountValue,
                                  ),
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                        Start Date
                      </label>
                      <input
                        type="datetime-local"
                        value={v.promotion?.startDate || ""}
                        onChange={(e) =>
                          setVariant(idx, "promotion", {
                            ...v.promotion,
                            startDate: e.target.value,
                          })
                        }
                        className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
                        End Date
                      </label>
                      <input
                        type="datetime-local"
                        value={v.promotion?.endDate || ""}
                        onChange={(e) =>
                          setVariant(idx, "promotion", {
                            ...v.promotion,
                            endDate: e.target.value,
                          })
                        }
                        className="input text-sm py-2 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pb-4">
        <Link
          to="/admin/products"
          className="btn-outline text-sm dark:border-dark-700 dark:text-dark-300 dark:hover:bg-dark-800">
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary gap-2 text-sm">
          <FiSave size={15} /> {saving ? "Saving…" : "Save Product"}
        </button>
      </div>
    </form>
  );
}
