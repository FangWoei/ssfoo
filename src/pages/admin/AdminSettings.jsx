// src/pages/admin/AdminSettings.jsx
import { useAuth } from "@/context/AuthContext";
import { saveMinOrder, useMinOrder } from "@/firebase/settings";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiLoader, FiSave, FiShoppingCart } from "react-icons/fi";

export default function AdminSettings() {
  const { user } = useAuth();
  const { minOrder, loading } = useMinOrder();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setValue(String(minOrder));
  }, [loading, minOrder]);

  const changed = value !== "" && Number(value) !== minOrder;

  const handleSave = async () => {
    const n = Number(value);
    if (value === "" || !Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await saveMinOrder(n, user?.uid);
      toast.success(`Minimum order set to RM ${n.toFixed(2)}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save — check Firestore rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Settings
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Changes apply to all outlets immediately.
      </p>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <FiShoppingCart
            size={16}
            className="text-slate-600 dark:text-slate-300"
          />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Minimum order amount
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Outlets can only place an order when their cart total is at least this
          amount. Set 0 to disable.
        </p>

        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Amount (RM)
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              RM
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={value}
              disabled={loading}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && changed && handleSave()}
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-slate-500 text-slate-900 dark:text-slate-100 outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading || !changed}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2">
            {saving ? (
              <FiLoader size={15} className="animate-spin" />
            ) : (
              <FiSave size={15} />
            )}
            Save
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Current: <b>RM {Number(minOrder).toFixed(2)}</b>
        </p>
      </div>
    </div>
  );
}
