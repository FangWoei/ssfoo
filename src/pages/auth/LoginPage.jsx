// src/pages/auth/LoginPage.jsx
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, loginUser, logoutUser } from "@/firebase/auth";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiEye, FiEyeOff, FiHash, FiLock, FiMail } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";

const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE;

export default function LoginPage() {
  const navigate = useNavigate();
  const {} = useAuth();

  const [tab, setTab] = useState("outlet"); // 'outlet' | 'admin'
  const [form, setForm] = useState({
    email: "",
    password: "",
    outletId: "",
    adminCode: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoad] = useState(false);

  const handle = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoad(true);
    try {
      if (tab === "admin") {
        // Validate admin code first
        if (form.adminCode !== ADMIN_CODE) {
          toast.error("Invalid admin code");
          setLoad(false);
          return;
        }
        const user = await loginUser(form.email, form.password);
        const profile = await getUserProfile(user.uid);
        if (profile?.role !== "admin") {
          await logoutUser();
          toast.error("Not an admin account");
          setLoad(false);
          return;
        }
        toast.success("Welcome back, Admin!");
        navigate("/admin");
      } else {
        // Outlet login
        if (!form.outletId.trim()) {
          toast.error("Outlet ID is required");
          setLoad(false);
          return;
        }
        const user = await loginUser(form.email, form.password);
        const profile = await getUserProfile(user.uid);

        if (profile?.role !== "outlet") {
          await logoutUser();
          toast.error("Not an outlet account");
          setLoad(false);
          return;
        }
        if (profile?.outletId !== form.outletId.trim()) {
          await logoutUser();
          toast.error("Outlet ID does not match");
          setLoad(false);
          return;
        }
        if (profile?.active === false) {
          await logoutUser();
          toast.error("This outlet has been deactivated");
          setLoad(false);
          return;
        }
        toast.success(`Welcome, ${profile.outletName}!`);
        navigate("/shop");
      }
    } catch (err) {
      toast.error(
        err.code === "auth/invalid-credential"
          ? "Invalid email or password"
          : err.message,
      );
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-primary-600 tracking-tight">
            Ssfoo
          </h1>
          <p className="text-dark-400 text-sm mt-1">Outlet Ordering Portal</p>
        </div>

        <div className="card dark:bg-dark-900 dark:border-dark-800 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-dark-100 dark:border-dark-800">
            {["outlet", "admin"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3.5 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50 dark:bg-primary-900/10"
                    : "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200"
                }`}>
                {t === "outlet" ? "Outlet Login" : "Admin Login"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <FiMail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
                />
                <input
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handle}
                  placeholder="you@example.com"
                  className="input pl-10 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <FiLock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
                />
                <input
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={handle}
                  placeholder="••••••••"
                  className="input pl-10 pr-10 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600">
                  {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Outlet ID — outlet tab only */}
            {tab === "outlet" && (
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Outlet ID
                </label>
                <div className="relative">
                  <FiHash
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
                  />
                  <input
                    name="outletId"
                    type="text"
                    required
                    value={form.outletId}
                    onChange={handle}
                    placeholder="your-outlet-id"
                    className="input pl-10 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
                  />
                </div>
              </div>
            )}

            {/* Admin Code — admin tab only */}
            {tab === "admin" && (
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                  Admin Code
                </label>
                <div className="relative">
                  <FiHash
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
                  />
                  <input
                    name="adminCode"
                    type="password"
                    required
                    value={form.adminCode}
                    onChange={handle}
                    placeholder="••••••••"
                    className="input pl-10 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
                  />
                </div>
              </div>
            )}

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-primary-600 hover:text-primary-700">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
