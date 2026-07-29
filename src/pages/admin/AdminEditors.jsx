// src/pages/admin/AdminEditors.jsx
// Manage editor accounts. Editors are internal staff who can view
// products/orders and mark orders as done, but can't edit products,
// manage outlets, or delete anything.
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/config";
import { createEditor } from "@/firebase/editors";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FiEdit3,
  FiLock,
  FiMail,
  FiPlus,
  FiSearch,
  FiUser,
  FiX,
} from "react-icons/fi";

export default function AdminEditors() {
  const { isAdmin } = useAuth();
  const [editors, setEditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | { mode: "create" }

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "users"), where("role", "==", "editor"));
    return onSnapshot(
      q,
      (snap) => {
        setEditors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Editors listen failed:", err);
        setLoading(false);
      },
    );
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!search.trim()) return editors;
    const q = search.trim().toLowerCase();
    return editors.filter(
      (e) =>
        e.email?.toLowerCase().includes(q) || e.name?.toLowerCase().includes(q),
    );
  }, [editors, search]);

  const toggleActive = async (editor) => {
    try {
      await updateDoc(doc(db, "users", editor.id), {
        active: !editor.active,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        editor.active ? "Editor deactivated" : "Editor re-activated",
      );
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update editor");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-dark-900 dark:text-dark-100">
            Editors
          </h1>
          <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
            {editors.length} editor{editors.length !== 1 ? "s" : ""} ·{" "}
            {editors.filter((e) => e.active !== false).length} active
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/25 transition-all">
          <FiPlus size={16} />
          Add Editor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <FiSearch
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search editors..."
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 focus:border-primary-500 outline-none text-sm text-dark-800 dark:text-dark-200 transition-colors"
        />
      </div>

      {/* List */}
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-dark-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-dark-400">
            {editors.length === 0
              ? "No editors yet. Click 'Add Editor' to create one."
              : "No editors match your search."}
          </div>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center shrink-0">
                <FiEdit3 size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-dark-900 dark:text-dark-100 truncate">
                  {e.name || "(no name)"}
                </p>
                <p className="text-xs text-dark-500 dark:text-dark-400 truncate">
                  {e.email}
                </p>
              </div>
              <button
                onClick={() => toggleActive(e)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  e.active !== false
                    ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100"
                    : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100"
                }`}>
                {e.active !== false ? "Active" : "Inactive"}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {modal && <CreateEditorModal onClose={() => setModal(null)} />}
    </div>
  );
}

function CreateEditorModal({ onClose }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.email.trim()) return toast.error("Email is required");
    if (form.password.length < 6)
      return toast.error("Password must be at least 6 characters");

    setSaving(true);
    try {
      await createEditor({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
      });
      toast.success("Editor created!");
      onClose();
    } catch (e) {
      console.error(e);
      if (e.code === "auth/email-already-in-use") {
        toast.error("Email is already in use");
      } else {
        toast.error(e.message || "Failed to create editor");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-dark-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-dark-900 dark:text-dark-100">
              New Editor
            </h2>
            <p className="text-xs text-dark-400 mt-0.5">
              Editors can view orders and products, and mark orders as done.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-dark-500 hover:text-dark-800 dark:hover:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-600 dark:text-dark-400 mb-1.5">
              Name (optional)
            </label>
            <div className="relative">
              <FiUser
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
              />
              <input
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Ah Wei"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-primary-500 focus:bg-white text-sm text-dark-800 dark:text-dark-200 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-600 dark:text-dark-400 mb-1.5">
              Email *
            </label>
            <div className="relative">
              <FiMail
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
              />
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="e.g. editor@ssfoo.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-primary-500 focus:bg-white text-sm text-dark-800 dark:text-dark-200 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-600 dark:text-dark-400 mb-1.5">
              Password * (min. 6 characters)
            </label>
            <div className="relative">
              <FiLock
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
              />
              <input
                type="text"
                value={form.password}
                onChange={set("password")}
                placeholder="Share this with the editor"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-primary-500 focus:bg-white text-sm text-dark-800 dark:text-dark-200 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/25 disabled:opacity-60 transition-all">
            {saving ? "Creating…" : "Create Editor"}
          </button>
        </div>
      </div>
    </div>
  );
}
