// src/pages/user/AccountPage.jsx
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase/config";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  FiEye,
  FiEyeOff,
  FiHome,
  FiLoader,
  FiLock,
  FiMail,
} from "react-icons/fi";

export default function AccountPage() {
  const { user, profile } = useAuth();
  const outlet = profile || {};

  const [form, setForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleChangePassword = async () => {
    if (saving) return;
    if (!form.current || !form.next || !form.confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (form.next.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (form.next !== form.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (form.next === form.current) {
      toast.error("New password must be different from the current one");
      return;
    }

    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(
        auth.currentUser.email,
        form.current,
      );
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, form.next);
      toast.success("Password updated!");
      setForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      console.error("Change password failed:", e);
      if (
        e.code === "auth/wrong-password" ||
        e.code === "auth/invalid-credential"
      ) {
        toast.error("Current password is incorrect");
      } else if (e.code === "auth/too-many-requests") {
        toast.error("Too many attempts — try again later");
      } else {
        toast.error("Failed to update password");
      }
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { label: "Outlet ID", value: outlet.outletId || user?.outletId },
    { label: "Outlet Name", value: outlet.outletName || outlet.name },
    { label: "Email", value: user?.email },
    { label: "Phone", value: outlet.phone },
    { label: "Address", value: outlet.address },
  ].filter((r) => r.value);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your outlet details and security settings
        </p>
      </div>

      {/* ── Outlet info ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <FiHome size={16} className="text-teal-600 dark:text-teal-400" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Outlet Information
          </h2>
        </div>
        <div className="space-y-3">
          {infoRows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-sm">
              <span className="text-xs text-slate-400">{row.label}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <FiMail size={11} className="inline mr-1 -mt-0.5" />
          Outlet details are managed by the admin. Contact them to update your
          name, phone, or address.
        </p>
      </div>

      {/* ── Change password ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FiLock size={16} className="text-teal-600 dark:text-teal-400" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Change Password
          </h2>
        </div>

        <div className="space-y-3">
          {[
            { key: "current", label: "Current password" },
            { key: "next", label: "New password (min. 6 characters)" },
            { key: "confirm", label: "Confirm new password" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {field.label}
              </label>
              <input
                type={show ? "text" : "password"}
                value={form[field.key]}
                onChange={set(field.key)}
                autoComplete={
                  field.key === "current" ? "current-password" : "new-password"
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-teal-500 text-slate-900 dark:text-slate-100 outline-none transition-colors"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
            {show ? <FiEyeOff size={13} /> : <FiEye size={13} />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="w-full mt-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            {saving ? (
              <>
                <FiLoader size={15} className="animate-spin" /> Updating…
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
