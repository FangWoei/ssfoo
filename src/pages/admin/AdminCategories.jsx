// src/pages/admin/AdminCategories.jsx
import { db } from "@/firebase/config";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const blank = { name: "" };

  const load = async () => {
    const snap = await getDocs(collection(db, "categories"));
    setCats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      if (form.id) {
        await updateDoc(doc(db, "categories", form.id), {
          name: form.name,
          updatedAt: serverTimestamp(),
        });
        setCats((p) =>
          p.map((c) => (c.id === form.id ? { ...c, ...form } : c)),
        );
        toast.success("Category updated");
      } else {
        const ref = await addDoc(collection(db, "categories"), {
          name: form.name,
          createdAt: serverTimestamp(),
        });
        setCats((p) => [...p, { id: ref.id, ...form }]);
        toast.success("Category added");
      }
      setForm(null);
    } catch {
      toast.error("Save failed");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this category?")) return;
    await deleteDoc(doc(db, "categories", id));
    setCats((p) => p.filter((c) => c.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
            Categories
          </h1>
          <p className="text-dark-400 text-sm">{cats.length} categories</p>
        </div>
        <button
          onClick={() => setForm(blank)}
          className="btn-primary gap-2 text-sm py-2.5">
          <FiPlus size={15} />
          Add Category
        </button>
      </div>

      {form && (
        <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-5 space-y-3">
          <h3 className="font-semibold text-dark-900 dark:text-dark-100">
            {form.id ? "Edit" : "New"} Category
          </h3>
          <div></div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-dark-600 dark:text-dark-400 mb-1">
              Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100"
              placeholder="e.g. Wallets"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setForm(null)}
              className="btn-ghost text-sm gap-1 dark:text-dark-400 dark:hover:bg-dark-800">
              <FiX size={14} />
              Cancel
            </button>
            <button onClick={save} className="btn-primary text-sm gap-1">
              <FiCheck size={14} />
              Save
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 divide-y divide-dark-50 dark:divide-dark-800">
        {loading ? (
          <div className="p-6 text-center text-sm text-dark-400">Loading…</div>
        ) : cats.length === 0 ? (
          <div className="p-6 text-center text-sm text-dark-400">
            No categories yet.
          </div>
        ) : (
          cats.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-dark-50/50 dark:hover:bg-dark-800/50 transition-colors">
              <span className="text-2xl">{c.emoji}</span>
              <div className="flex-1">
                <p className="font-medium text-dark-900 dark:text-dark-100 text-sm">
                  {c.name}
                </p>
                {c.description && (
                  <p className="text-xs text-dark-400">{c.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setForm(c)}
                  className="p-1.5 text-dark-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <FiEdit2 size={14} />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="p-1.5 text-dark-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
