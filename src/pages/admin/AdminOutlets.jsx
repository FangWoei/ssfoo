// src/pages/admin/AdminOutlets.jsx
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  createOutlet,
  getAllOutlets,
  sendOutletPasswordReset,
  toggleOutletActive,
  updateOutlet,
} from "@/firebase/outlets";
import { getBrands } from "@/firebase/products";
import { isValidEmail, tsToDate } from "@/utils/helpers";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiEdit2,
  FiHome,
  FiKey,
  FiLoader,
  FiPlus,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
  FiX,
} from "react-icons/fi";

const BLANK = {
  email: "",
  password: "",
  outletId: "",
  outletName: "",
  phone: "",
  address: "",
  allowedBrands: [],
};

export default function AdminOutlets() {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState([]);
  const [modal, setModal] = useState(null); // { mode: 'create' } | { mode: 'edit', outlet }
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [data, brandList] = await Promise.all([
        getAllOutlets(),
        getBrands(),
      ]);
      setOutlets(data);
      setBrands(brandList);
    } catch (e) {
      console.error("Load outlets failed:", e);
      toast.error("Failed to load outlets");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return outlets;
    const q = search.trim().toLowerCase();
    return outlets.filter(
      (o) =>
        o.outletId?.toLowerCase().includes(q) ||
        o.outletName?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q),
    );
  }, [outlets, search]);

  const openCreate = () => {
    setForm(BLANK);
    setModal({ mode: "create" });
  };
  const openEdit = (outlet) => {
    setForm({
      email: outlet.email || "",
      password: "",
      outletId: outlet.outletId || "",
      outletName: outlet.outletName || "",
      phone: outlet.phone || "",
      address: outlet.address || "",
      allowedBrands: Array.isArray(outlet.allowedBrands)
        ? outlet.allowedBrands
        : [],
    });
    setModal({ mode: "edit", outlet });
  };
  const closeModal = () => {
    if (!saving) setModal(null);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleBrand = (name) =>
    setForm((f) => ({
      ...f,
      allowedBrands: f.allowedBrands.includes(name)
        ? f.allowedBrands.filter((b) => b !== name)
        : [...f.allowedBrands, name],
    }));

  const handleSave = async () => {
    if (saving) return;
    const isCreate = modal.mode === "create";

    if (!form.outletId.trim()) return toast.error("Outlet ID is required");
    if (!form.outletName.trim()) return toast.error("Outlet name is required");
    if (isCreate) {
      if (!isValidEmail(form.email)) return toast.error("Enter a valid email");
      if (form.password.length < 6)
        return toast.error("Password must be at least 6 characters");
      const dupId = outlets.some(
        (o) => o.outletId?.toLowerCase() === form.outletId.trim().toLowerCase(),
      );
      if (dupId) return toast.error("This Outlet ID is already in use");
    }

    setSaving(true);
    try {
      if (isCreate) {
        await createOutlet({
          email: form.email.trim(),
          password: form.password,
          outletId: form.outletId.trim(),
          outletName: form.outletName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          allowedBrands: form.allowedBrands,
        });
        toast.success("Outlet created!");
      } else {
        await updateOutlet(modal.outlet.id, {
          outletId: form.outletId.trim(),
          outletName: form.outletName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          allowedBrands: form.allowedBrands,
        });
        toast.success("Outlet updated");
      }
      setModal(null);
      setLoading(true);
      await load();
    } catch (e) {
      console.error("Save outlet failed:", e);
      if (e.code === "auth/email-already-in-use") {
        toast.error("This email is already registered");
      } else {
        toast.error("Failed to save outlet");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (outlet) => {
    const next = !(outlet.active !== false);
    try {
      await toggleOutletActive(outlet.id, next);
      setOutlets((prev) =>
        prev.map((o) => (o.id === outlet.id ? { ...o, active: next } : o)),
      );
      toast.success(next ? "Outlet activated" : "Outlet deactivated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleReset = async (outlet) => {
    if (!window.confirm(`Send a password reset email to ${outlet.email}?`))
      return;
    try {
      await sendOutletPasswordReset(outlet.email);
      toast.success("Reset email sent");
    } catch {
      toast.error("Failed to send reset email");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const inputCls =
    "w-full px-3 py-2.5 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors";
  const labelCls =
    "block text-xs font-medium text-dark-500 dark:text-dark-400 mb-1";

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Outlets
          </h1>
          <p className="text-dark-400 text-sm">
            {outlets.length} outlets ·{" "}
            {outlets.filter((o) => o.active !== false).length} active
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
          <FiPlus size={16} /> New Outlet
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-xs">
        <FiSearch
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ID, name, or email…"
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

      {/* ── Outlet list ── */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FiHome size={28} className="text-dark-300 mb-3" />
            <p className="text-sm text-dark-400 mb-4">
              {outlets.length === 0 ? "No outlets yet" : "No matching outlets"}
            </p>
            {outlets.length === 0 && (
              <button
                onClick={openCreate}
                className="text-sm font-semibold text-primary-600 hover:underline">
                Create your first outlet
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-dark-100 dark:divide-dark-800">
            {filtered.map((o) => {
              const active = o.active !== false;
              return (
                <div
                  key={o.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    active ? "" : "opacity-60"
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                    {(o.outletName || o.outletId || "?").slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-dark-900 dark:text-dark-100 truncate">
                        {o.outletName || "—"}
                      </p>
                      <span className="px-1.5 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-dark-500 dark:text-dark-400 text-[10px] font-mono font-bold">
                        {o.outletId}
                      </span>
                      {!active && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-dark-400 truncate">
                      {o.email}
                      {o.phone ? ` · ${o.phone}` : ""} · joined{" "}
                      {tsToDate(o.createdAt)}
                    </p>
                    <p className="text-[11px] mt-0.5 truncate">
                      {Array.isArray(o.allowedBrands) &&
                      o.allowedBrands.length > 0 ? (
                        <span className="text-primary-600 dark:text-primary-400 font-medium">
                          Brands: {o.allowedBrands.join(", ")}
                        </span>
                      ) : (
                        <span className="text-dark-400">All brands</span>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleReset(o)}
                      className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="Send password reset email">
                      <FiKey size={15} />
                    </button>
                    <button
                      onClick={() => openEdit(o)}
                      className="p-2 rounded-lg text-dark-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="Edit">
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(o)}
                      className={`p-2 rounded-lg transition-colors ${
                        active
                          ? "text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                          : "text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800"
                      }`}
                      title={active ? "Deactivate" : "Activate"}>
                      {active ? (
                        <FiToggleRight size={18} />
                      ) : (
                        <FiToggleLeft size={18} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-white dark:bg-dark-900 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-dark-900 dark:text-dark-100">
                {modal.mode === "create" ? "New Outlet" : "Edit Outlet"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800">
                <FiX size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {modal.mode === "create" ? (
                <>
                  <div>
                    <label className={labelCls}>Login email *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Password * (min. 6 characters)
                    </label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={set("password")}
                      className={inputCls}
                      placeholder="Share this with the outlet"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>Login email</label>
                  <input
                    value={form.email}
                    disabled
                    className={`${inputCls} opacity-60 cursor-not-allowed`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Outlet ID *</label>
                  <input
                    value={form.outletId}
                    onChange={set("outletId")}
                    className={inputCls}
                    placeholder="e.g. OUTLET-01"
                  />
                </div>
                <div>
                  <label className={labelCls}>Outlet name *</label>
                  <input
                    value={form.outletName}
                    onChange={set("outletName")}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Phone</label>
                <input
                  value={form.phone}
                  onChange={set("phone")}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <textarea
                  value={form.address}
                  onChange={set("address")}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* ── Visible brands ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${labelCls} mb-0`}>Visible brands</label>
                  {brands.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          allowedBrands:
                            f.allowedBrands.length === brands.length
                              ? []
                              : brands.map((b) => b.name),
                        }))
                      }
                      className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                      {form.allowedBrands.length === brands.length
                        ? "Clear all"
                        : "Select all"}
                    </button>
                  )}
                </div>
                {brands.length === 0 ? (
                  <p className="text-[11px] text-dark-400">
                    No brands yet — add them in Categories & Brands. Outlets see
                    all products until brands are assigned.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {brands.map((b) => (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-dark-50 dark:bg-dark-800 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.allowedBrands.includes(b.name)}
                            onChange={() => toggleBrand(b.name)}
                            className="accent-primary-600"
                          />
                          <span className="text-xs font-medium text-dark-800 dark:text-dark-200 truncate">
                            {b.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-dark-400 mt-1.5">
                      {form.allowedBrands.length === 0
                        ? "None ticked = this outlet sees ALL brands."
                        : `Sees only: ${form.allowedBrands.join(", ")} (+ products with no brand)`}
                    </p>
                  </>
                )}
              </div>

              {modal.mode === "edit" && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                  ⚠️ Changing the Outlet ID will disconnect this outlet's past
                  orders from their history. Only change it if the outlet has no
                  orders yet.
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {saving ? (
                  <>
                    <FiLoader size={15} className="animate-spin" />
                    {modal.mode === "create" ? "Creating…" : "Saving…"}
                  </>
                ) : modal.mode === "create" ? (
                  "Create Outlet"
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
