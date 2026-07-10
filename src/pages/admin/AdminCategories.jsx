// src/pages/admin/AdminCategories.jsx
// Manages BOTH product categories (shop filter) and brands
// (per-outlet visibility) — two identical sections, two collections.
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
import { FiCheck, FiEdit2, FiPlus, FiTag, FiTrash2, FiX } from "react-icons/fi";

function ManagedList({ collectionName, singular, plural, hint, placeholder }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const load = async () => {
    const snap = await getDocs(collection(db, collectionName));
    setItems(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    );
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Name required");
      return;
    }
    if (
      items.some(
        (i) => i.name.toLowerCase() === name.toLowerCase() && i.id !== form.id,
      )
    ) {
      toast.error(`${name} already exists`);
      return;
    }
    try {
      if (form.id) {
        await updateDoc(doc(db, collectionName, form.id), {
          name,
          updatedAt: serverTimestamp(),
        });
        setItems((p) => p.map((c) => (c.id === form.id ? { ...c, name } : c)));
        toast.success(`${singular} updated`);
      } else {
        const ref = await addDoc(collection(db, collectionName), {
          name,
          createdAt: serverTimestamp(),
        });
        setItems((p) =>
          [...p, { id: ref.id, name }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        toast.success(`${singular} added`);
      }
      setForm(null);
    } catch {
      toast.error("Save failed");
    }
  };

  const remove = async (item) => {
    if (
      !window.confirm(
        `Delete ${singular.toLowerCase()} "${item.name}"? Existing products keep the value.`,
      )
    )
      return;
    try {
      await deleteDoc(doc(db, collectionName, item.id));
      setItems((p) => p.filter((c) => c.id !== item.id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark-900 dark:text-dark-100">
            {plural}
          </h2>
          <p className="text-dark-400 text-xs">
            {items.length} {plural.toLowerCase()} · {hint}
          </p>
        </div>
        <button
          onClick={() => setForm({ name: "" })}
          className="btn-primary gap-2 text-sm py-2">
          <FiPlus size={15} />
          Add
        </button>
      </div>

      {form && (
        <div className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 p-4 space-y-3">
          <h3 className="font-semibold text-sm text-dark-900 dark:text-dark-100">
            {form.id ? "Edit" : "New"} {singular}
          </h3>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="input dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 uppercase"
            placeholder={placeholder}
            autoFocus
          />
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
          <div className="p-5 text-center text-sm text-dark-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-center text-sm text-dark-400">
            No {plural.toLowerCase()} yet.
          </div>
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-50/50 dark:hover:bg-dark-800/50 transition-colors">
              <FiTag size={14} className="text-primary-500 shrink-0" />
              <p className="flex-1 font-medium text-dark-900 dark:text-dark-100 text-sm">
                {c.name}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setForm(c)}
                  className="p-1.5 text-dark-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                  <FiEdit2 size={14} />
                </button>
                <button
                  onClick={() => remove(c)}
                  className="p-1.5 text-dark-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function AdminCategories() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
          Categories & Brands
        </h1>
        <p className="text-dark-400 text-sm">
          Categories organize the shop; brands control which outlets can see
          which products.
        </p>
      </div>

      <ManagedList
        collectionName="categories"
        singular="Category"
        plural="Categories"
        hint="product type, shown as shop filters"
        placeholder="e.g. Baby Lotion"
      />

      <ManagedList
        collectionName="brands"
        singular="Brand"
        plural="Brands"
        hint="controls per-outlet product visibility"
        placeholder="e.g. Aiken"
      />
    </div>
  );
}
