// src/pages/admin/AdminProductForm.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  addProduct,
  addUom,
  deleteUom,
  getBrands,
  getCategories,
  getProduct,
  getUoms,
  notifyRestockedProduct,
  updateProduct,
} from "@/firebase/products";
import { uploadImages } from "@/firebase/storage";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiImage,
  FiLoader,
  FiPlus,
  FiSettings,
  FiTag,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";

const MAX_IMAGES = 6;

const QUICK_UOMS = ["PCS", "CTN", "BOX", "PKT", "DOZ", "SET", "PACK"];

const BLANK = {
  itemCode: "",
  name: "",
  description: "",
  brand: "",
  uom: "PCS",
  focBuy: "",
  focFree: "",
  lowStockAt: "",
  category: "",
  basePrice: "",
  salePrice: "",
  isPromo: false,
  minOrder: 1,
  stock: 0,
  status: "draft",
  images: [],
};

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState(BLANK);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewImg, setPreviewImg] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [uoms, setUoms] = useState([]);
  const [prevStock, setPrevStock] = useState(0);
  const [brands, setBrands] = useState([]);
  const [uomModal, setUomModal] = useState(false);
  const [newUom, setNewUom] = useState("");
  const [savingUom, setSavingUom] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cats, uomList, brandList] = await Promise.all([
          getCategories(),
          getUoms(),
          getBrands(),
        ]);
        setCategories(cats);
        setUoms(uomList);
        setBrands(brandList);
        if (isEdit) {
          const p = await getProduct(id);
          if (!p) {
            toast.error("Product not found");
            navigate("/admin/products");
            return;
          }
          // Remember the previous stock so we can detect a 0→n restock
          setPrevStock(p.stock || 0);
          setForm({
            ...BLANK,
            ...p,
            category: (p.category || "").trim(),
            brand: p.brand || "",
          });
        }
      } catch (e) {
        console.error("Load failed:", e);
        toast.error("Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addFiles = async (files) => {
    if (!files.length) return;
    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images`);
      return;
    }
    const toUpload = files.slice(0, room);

    setUploading(true);
    setUploadPct(0);
    try {
      const urls = await uploadImages(
        toUpload,
        `products/${id || Date.now()}`,
        (i, total, pct) =>
          setUploadPct(Math.round(((i + pct / 100) / total) * 100)),
      );
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
      toast.success(
        `${urls.length} image${urls.length > 1 ? "s" : ""} uploaded`,
      );
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUpload = (e) => addFiles(Array.from(e.target.files || []));

  // ── Add an image from the web (URL / drag / paste) ──
  // Tries to copy it into Firebase Storage; if the site blocks
  // cross-origin download, links the URL directly instead.
  const addImageFromUrl = async (rawUrl) => {
    const url = (rawUrl || "").trim();
    if (!url) return;
    if (form.images.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images`);
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not an image");
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
      const file = new File([blob], `web-image-${Date.now()}.${ext}`, {
        type: blob.type,
      });
      setUploading(false);
      await addFiles([file]);
    } catch {
      // CORS or blocked — link the image directly
      setUploading(false);
      setForm((f) => ({ ...f, images: [...f.images, url] }));
      toast("🔗 Linked image from the web (couldn't copy it)", {
        duration: 3500,
      });
    }
  };

  const extractDroppedUrl = (dt) => {
    const uri = dt.getData("text/uri-list") || dt.getData("text/plain");
    if (uri && /^(https?:|data:image)/i.test(uri.trim()))
      return uri.trim().split("\n")[0];
    const html = dt.getData("text/html");
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) return m[1];
    }
    return "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length) return addFiles(files);
    const url = extractDroppedUrl(e.dataTransfer);
    if (url) {
      if (url.startsWith("data:image")) {
        // data URI → convert to a real file
        fetch(url)
          .then((r) => r.blob())
          .then((b) =>
            addFiles([
              new File([b], `pasted-${Date.now()}.png`, { type: b.type }),
            ]),
          );
      } else {
        addImageFromUrl(url);
      }
    }
  };

  // Ctrl+V anywhere on this page: pasted image (Copy image → paste)
  // uploads directly; pasted URL text is fetched.
  useEffect(() => {
    const onPaste = (e) => {
      const active = document.activeElement;
      // don't hijack pasting text into normal inputs
      const files = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        addFiles(files);
        return;
      }
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      )
        return;
      const txt = e.clipboardData?.getData("text/plain")?.trim();
      if (
        txt &&
        /^https?:\/\/.+\.(png|jpe?g|webp|gif|bmp)([?#].*)?$/i.test(txt)
      ) {
        e.preventDefault();
        addImageFromUrl(txt);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.images.length, id]);

  const removeImage = (idx) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));

  const handleAddUom = async (rawName) => {
    const name = (rawName ?? newUom).trim().toUpperCase();
    if (!name) return;
    if (uoms.some((u) => u.name === name)) {
      toast.error(`${name} already exists`);
      return;
    }
    setSavingUom(true);
    try {
      await addUom(name);
      const list = await getUoms();
      setUoms(list);
      setForm((f) => ({ ...f, uom: name }));
      setNewUom("");
      toast.success(`${name} added`);
    } catch (e) {
      console.error("Add UOM failed:", e);
      toast.error("Failed to add UOM");
    } finally {
      setSavingUom(false);
    }
  };

  const handleDeleteUom = async (u) => {
    if (!window.confirm(`Delete UOM "${u.name}"? Existing products keep it.`))
      return;
    try {
      await deleteUom(u.id);
      setUoms((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`${u.name} removed`);
    } catch {
      toast.error("Failed to delete UOM");
    }
  };

  const handleSave = async (statusOverride) => {
    if (saving) return;
    const name = form.name.trim();
    const price = parseFloat(form.basePrice);
    const minOrder = parseInt(form.minOrder, 10) || 1;
    const stock = parseInt(form.stock, 10) || 0;
    const isPromo = Boolean(form.isPromo);
    const salePrice = isPromo ? parseFloat(form.salePrice) : null;
    const uom = form.uom.trim().toUpperCase();
    const focBuy = parseInt(form.focBuy, 10) || 0;
    const focFree = parseInt(form.focFree, 10) || 0;
    const lowStockAt = parseInt(form.lowStockAt, 10) || 0;

    const itemCode = form.itemCode.trim();
    if (!itemCode) return toast.error("Item code is required");
    if (!name) return toast.error("Product name is required");
    if (!form.category) return toast.error("Please select a category");
    if (isNaN(price) || price <= 0) return toast.error("Enter a valid price");
    if (minOrder < 1) return toast.error("MOQ must be at least 1");
    if (stock < 0) return toast.error("Stock cannot be negative");
    if (isPromo) {
      if (isNaN(salePrice) || salePrice <= 0)
        return toast.error("Enter a valid promotion price");
      if (salePrice >= price)
        return toast.error("Promotion price must be lower than the base price");
    }
    if (!uom) return toast.error("UOM is required");
    if (focBuy > 0 !== focFree > 0)
      return toast.error(
        "FOC: fill in both Buy and Free quantities (or leave both empty)",
      );

    const status = statusOverride || form.status || "draft";
    const data = {
      itemCode,
      name,
      description: form.description.trim(),
      brand: form.brand || "",
      uom,
      focBuy,
      focFree,
      lowStockAt,
      category: form.category,
      basePrice: price,
      salePrice: isPromo ? salePrice : null,
      isPromo,
      minOrder,
      stock,
      status,
      inStock: stock > 0,
      images: form.images,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateProduct(id, data);
        toast.success("Product updated");
        // Restock notification: only if this admin bumped stock from 0
        if (prevStock === 0 && (data.stock || 0) > 0) {
          try {
            const count = await notifyRestockedProduct({ id, ...data });
            if (count > 0) {
              toast.success(
                `🔔 ${count} outlet${count > 1 ? "s" : ""} notified`,
              );
            }
          } catch (e) {
            console.error("Restock notify failed:", e);
          }
        }
      } else {
        await addProduct(data);
        toast.success("Product created");
      }
      navigate("/admin/products");
    } catch (e) {
      console.error("Save failed:", e);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const inputCls =
    "w-full px-3 py-2.5 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors";
  const labelCls =
    "block text-xs font-medium text-dark-500 dark:text-dark-400 mb-1";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/products"
          className="p-2 rounded-lg text-dark-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          <FiArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
          {isEdit ? "Edit Product" : "New Product"}
        </h1>
      </div>

      {/* ── Basic info ── */}
      <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
          <div>
            <label className={labelCls}>Item code *</label>
            <input
              value={form.itemCode}
              onChange={set("itemCode")}
              placeholder="e.g. BW-080"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Product name *</label>
            <input
              value={form.name}
              onChange={set("name")}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category *</label>
            <select
              value={form.category}
              onChange={set("category")}
              className={inputCls}>
              <option value="">Select category…</option>
              {form.category &&
                !categories.some((c) => c.name === form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                No categories yet —{" "}
                <Link to="/admin/categories" className="underline">
                  create one first
                </Link>
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Price (RM) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.basePrice}
              onChange={set("basePrice")}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Brand{" "}
              <span className="normal-case font-normal">
                (controls outlet visibility)
              </span>
            </label>
            <select
              value={form.brand}
              onChange={set("brand")}
              className={inputCls}>
              <option value="">— No brand (visible to all outlets) —</option>
              {form.brand && !brands.some((b) => b.name === form.brand) && (
                <option value={form.brand}>{form.brand}</option>
              )}
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`${labelCls} mb-0`}>
                UOM (unit of measure) *
              </label>
              <button
                type="button"
                onClick={() => setUomModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                <FiSettings size={11} /> Manage
              </button>
            </div>
            <select value={form.uom} onChange={set("uom")} className={inputCls}>
              {form.uom && !uoms.some((u) => u.name === form.uom) && (
                <option value={form.uom}>{form.uom}</option>
              )}
              {uoms.length === 0 && !form.uom && (
                <option value="">— add a UOM first —</option>
              )}
              {uoms.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              FOC — Buy X Free Y{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={form.focBuy}
                onChange={set("focBuy")}
                placeholder="Buy (e.g. 12)"
                className={inputCls}
              />
              <span className="text-dark-400 text-xs shrink-0">free</span>
              <input
                type="number"
                min="0"
                value={form.focFree}
                onChange={set("focFree")}
                placeholder="1"
                className={inputCls}
              />
            </div>
            {parseInt(form.focBuy, 10) > 0 &&
              parseInt(form.focFree, 10) > 0 && (
                <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-1 font-semibold">
                  🎁 Buy {form.focBuy} Free {form.focFree} — auto-calculated on
                  orders
                </p>
              )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Minimum order quantity (MOQ)</label>
            <input
              type="number"
              min="1"
              value={form.minOrder}
              onChange={set("minOrder")}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Stock</label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={set("stock")}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Low-stock alert level{" "}
            <span className="normal-case font-normal">
              (optional — empty uses the global default)
            </span>
          </label>
          <input
            type="number"
            min="0"
            value={form.lowStockAt}
            onChange={set("lowStockAt")}
            placeholder="e.g. 24"
            className={inputCls}
            style={{ maxWidth: "200px" }}
          />
        </div>
      </div>

      {/* ── Promotion ── */}
      <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPromo}
            onChange={(e) =>
              setForm((f) => ({ ...f, isPromo: e.target.checked }))
            }
            className="accent-primary-600 w-4 h-4"
          />
          <span className="flex items-center gap-1.5 text-sm font-semibold text-dark-900 dark:text-dark-100">
            <FiTag
              size={15}
              className="text-primary-600 dark:text-primary-400"
            />
            On Promotion
          </span>
        </label>
        <p className="text-[11px] text-dark-400 mt-1 ml-7">
          Promoted products appear in a special row at the top of the shop.
        </p>

        {form.isPromo && (
          <div className="mt-4 ml-7">
            <label className={labelCls}>Promotion price (RM) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.salePrice}
              onChange={set("salePrice")}
              placeholder="Must be lower than base price"
              className={`${inputCls} max-w-[200px]`}
            />
            {form.salePrice &&
              form.basePrice &&
              parseFloat(form.salePrice) < parseFloat(form.basePrice) && (
                <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-1.5 font-semibold">
                  {Math.round(
                    (1 -
                      parseFloat(form.salePrice) / parseFloat(form.basePrice)) *
                      100,
                  )}
                  % off · was {form.basePrice}, now {form.salePrice}
                </p>
              )}
          </div>
        )}
      </div>

      {/* ── Images ── */}
      <div className="bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-dark-500 dark:text-dark-400 flex items-center gap-1.5">
            <FiImage size={14} /> Images
          </label>
          <span className="text-xs text-dark-400">
            {form.images.length} / {MAX_IMAGES}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {form.images.map((url, idx) => (
            <div key={idx} className="relative group aspect-square">
              <img
                src={url}
                alt=""
                onClick={() => setPreviewImg(url)}
                title="Click to enlarge"
                className="w-full h-full rounded-xl object-contain bg-white border border-dark-100 dark:border-dark-700 cursor-zoom-in"
              />
              {idx === 0 && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-primary-600 text-white text-[9px] font-bold">
                  MAIN
                </span>
              )}
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all">
                <FiTrash2 size={12} />
              </button>
            </div>
          ))}

          {form.images.length < MAX_IMAGES && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                dragOver
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600"
                  : "border-dark-200 dark:border-dark-700 hover:border-primary-500 text-dark-400 hover:text-primary-600"
              }`}>
              {uploading ? (
                <>
                  <FiLoader size={18} className="animate-spin" />
                  <span className="text-[10px] font-semibold">
                    {uploadPct}%
                  </span>
                </>
              ) : (
                <>
                  <FiUploadCloud size={18} />
                  <span className="text-[10px] font-semibold">Upload</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />

        {/* Add from the web */}
        {form.images.length < MAX_IMAGES && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <input
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImageFromUrl(imgUrl);
                    setImgUrl("");
                  }
                }}
                placeholder="Paste an image link from the web…"
                className={`${inputCls} text-xs`}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                type="button"
                onClick={() => {
                  addImageFromUrl(imgUrl);
                  setImgUrl("");
                }}
                disabled={uploading || !imgUrl.trim()}
                className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-semibold shrink-0 transition-colors">
                Add
              </button>
            </div>
            <p className="text-[11px] text-dark-400 mt-1.5">
              💡 Tip: right-click any image online → <b>Copy image</b> → press{" "}
              <b>Ctrl+V</b> here, or drag the image onto the upload box.
            </p>
          </div>
        )}
        <p className="text-[11px] text-dark-400 mt-2">
          First image is the thumbnail shown in the shop.
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleSave("active")}
          disabled={saving || uploading}
          className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
          {saving ? (
            <FiLoader size={15} className="animate-spin" />
          ) : isEdit && form.status === "active" ? (
            "Save Changes"
          ) : (
            "Save & Publish"
          )}
        </button>
        <button
          onClick={() => handleSave("draft")}
          disabled={saving || uploading}
          className="flex-1 py-3 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-200 hover:border-primary-500 disabled:opacity-60 text-sm font-semibold transition-colors">
          Save as Draft
        </button>
      </div>

      {/* ── Image lightbox ── */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setPreviewImg(null)}>
          <img
            src={previewImg}
            alt="Preview"
            className="rounded-2xl bg-white"
            style={{
              maxWidth: "92vw",
              maxHeight: "88vh",
              objectFit: "contain",
            }}
          />
          <button
            onClick={() => setPreviewImg(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors">
            <FiX size={20} />
          </button>
        </div>
      )}

      {/* ── UOM manager modal ── */}
      {uomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setUomModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-dark-900 rounded-2xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-dark-900 dark:text-dark-100">
                Units of Measure
              </h2>
              <button
                onClick={() => setUomModal(false)}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800">
                <FiX size={16} />
              </button>
            </div>

            {/* Add new */}
            <div className="flex gap-2 mb-3">
              <input
                value={newUom}
                onChange={(e) => setNewUom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUom();
                  }
                }}
                placeholder="e.g. CTN"
                className={`${inputCls} uppercase flex-1`}
              />
              <button
                onClick={() => handleAddUom()}
                disabled={savingUom || !newUom.trim()}
                className="px-4 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors">
                {savingUom ? (
                  <FiLoader size={14} className="animate-spin" />
                ) : (
                  <FiPlus size={14} />
                )}
                Add
              </button>
            </div>

            {/* Quick-add chips for missing common units */}
            {QUICK_UOMS.filter((q) => !uoms.some((u) => u.name === q)).length >
              0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {QUICK_UOMS.filter((q) => !uoms.some((u) => u.name === q)).map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => handleAddUom(q)}
                      disabled={savingUom}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 transition-colors">
                      + {q}
                    </button>
                  ),
                )}
              </div>
            )}

            {/* Existing list */}
            {uoms.length === 0 ? (
              <p className="text-xs text-dark-400 text-center py-4">
                No UOMs yet — add one above or tap a suggestion.
              </p>
            ) : (
              <div className="divide-y divide-dark-100 dark:divide-dark-800 border border-dark-100 dark:border-dark-800 rounded-xl overflow-hidden">
                {uoms.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-sm font-mono font-semibold text-dark-800 dark:text-dark-200">
                      {u.name}
                    </span>
                    <button
                      onClick={() => handleDeleteUom(u)}
                      className="p-1.5 rounded-lg text-dark-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
