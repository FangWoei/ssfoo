// src/pages/auth/LoginPage.jsx
import logo from "@/assets/logo.jpg";
import LoginMascot from "@/components/common/LoginMascot";
import { getUserProfile, loginUser, logoutUser } from "@/firebase/auth";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowRight,
  FiBox,
  FiEye,
  FiEyeOff,
  FiHash,
  FiLock,
  FiMail,
  FiShield,
  FiShoppingCart,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";

const ADMIN_CODE = import.meta.env.VITE_ADMIN_CODE;

const FEATURES = [
  { icon: FiBox, text: "Browse the full wholesale catalogue" },
  { icon: FiShoppingCart, text: "Order in bulk with outlet pricing" },
  { icon: FiTruck, text: "Track every order in one place" },
];

export default function LoginPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("outlet"); // 'outlet' | 'admin'
  const [form, setForm] = useState({
    email: "",
    password: "",
    outletId: "",
    adminCode: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoad] = useState(false);
  const [focused, setFocused] = useState(null);

  // Mascot state
  const covering = focused === "password" || focused === "adminCode";
  const watching = focused === "email" || focused === "outletId";
  const watchedText = focused === "outletId" ? form.outletId : form.email;
  const lookX = (Math.min(watchedText.length, 26) / 26) * 12 - 6;

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

  const inputWrap = "relative";
  const inputCls =
    "w-full pl-11 pr-4 py-3 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-dark-800 text-dark-900 dark:text-dark-100 placeholder-dark-400 dark:placeholder-dark-500 outline-none transition-all";
  const iconCls =
    "absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none";
  const labelCls =
    "block text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide mb-1.5";

  return (
    <div className="min-h-screen flex bg-white dark:bg-dark-950">
      {/* ══ Left: brand panel (desktop only) ══ */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-teal-900 flex-col justify-between p-12">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-32 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 right-10 w-[28rem] h-[28rem] rounded-full bg-teal-400/10" />

        {/* Logo row */}
        <div className="relative flex items-center gap-3">
          <img
            src={logo}
            alt="SS FOO"
            className="w-11 h-11 rounded-2xl object-cover ring-2 ring-white/30"
          />
          <div>
            <p className="font-display text-xl font-bold text-white leading-none">
              SS FOO SDN. BHD.
            </p>
            <p className="text-primary-200 text-xs mt-1">
              Outlet Ordering Portal
            </p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-tight">
            Wholesale ordering,
            <br />
            <span className="text-teal-200">made simple.</span>
          </h1>
          <p className="text-primary-100/90 text-sm mt-4 leading-relaxed">
            One portal for all your outlet orders — browse, order, and track
            without the back-and-forth.
          </p>

          <div className="mt-8 space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-teal-200" />
                </div>
                <span className="text-sm text-primary-50">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-primary-200/60 text-xs">
          © {new Date().getFullYear()} SS FOO SDN. BHD. · Authorized outlets
          only
        </p>
      </div>

      {/* ══ Right: form ══ */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 bg-dark-50 dark:bg-dark-950">
        <div className="w-full max-w-sm">
          {/* Mascot — watches email, covers eyes on password */}
          <div className="flex justify-center mb-2">
            <LoginMascot
              watching={watching}
              covering={covering}
              peeking={showPw}
              lookX={lookX}
            />
          </div>

          {/* Mobile brand name */}
          <div className="lg:hidden text-center mb-4">
            <h1 className="font-display text-2xl font-bold text-primary-600">
              SS FOO SDN. BHD.
            </h1>
            <p className="text-dark-400 text-xs mt-1">Outlet Ordering Portal</p>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold text-dark-900 dark:text-dark-100">
              Welcome back
            </h2>
            <p className="text-sm text-dark-400 mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {/* Segmented tab switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-dark-100 dark:bg-dark-800 mb-6">
            {[
              { key: "outlet", label: "Outlet", icon: FiUser },
              { key: "admin", label: "Admin", icon: FiShield },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === key
                    ? "bg-white dark:bg-dark-900 text-primary-600 shadow-sm"
                    : "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200"
                }`}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className={labelCls}>Email</label>
              <div className={inputWrap}>
                <FiMail size={16} className={iconCls} />
                <input
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handle}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Password</label>
              <div className={inputWrap}>
                <FiLock size={16} className={iconCls} />
                <input
                  name="password"
                  type={showPw ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={handle}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-200 transition-colors">
                  {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Outlet ID — outlet tab only */}
            {tab === "outlet" && (
              <div>
                <label className={labelCls}>Outlet ID</label>
                <div className={inputWrap}>
                  <FiHash size={16} className={iconCls} />
                  <input
                    name="outletId"
                    type="text"
                    required
                    value={form.outletId}
                    onChange={handle}
                    onFocus={() => setFocused("outletId")}
                    onBlur={() => setFocused(null)}
                    placeholder="your-outlet-id"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            )}

            {/* Admin Code — admin tab only */}
            {tab === "admin" && (
              <div>
                <label className={labelCls}>Admin Code</label>
                <div className={inputWrap}>
                  <FiShield size={16} className={iconCls} />
                  <input
                    name="adminCode"
                    type="password"
                    required
                    value={form.adminCode}
                    onChange={handle}
                    onFocus={() => setFocused("adminCode")}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••••"
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* Forgot password */}
            <div className="flex justify-end -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25 transition-all">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In <FiArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footnote */}
          <p className="text-center text-xs text-dark-400 mt-8">
            No account?{" "}
            <span className="text-dark-500 dark:text-dark-300">
              Outlet accounts are created by the admin — contact SS FOO to get
              access.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
