// src/pages/auth/LoginPage.jsx
// Redesigned login: soft/warm brand feel for a baby-products wholesaler,
// while keeping every bit of the original login logic (auth, tabs,
// mascot, EnterToNext, T&C modal, error handling).
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
  const [agreed, setAgreed] = useState(false);
  const [tcOpen, setTcOpen] = useState(false);

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
        if (form.adminCode !== ADMIN_CODE) {
          toast.error("Invalid admin code");
          setLoad(false);
          return;
        }
        const user = await loginUser(form.email, form.password);
        const profile = await getUserProfile(user.uid);
        if (profile?.role !== "admin") {
          await logoutUser();
          toast.error("This account is not an admin");
          setLoad(false);
          return;
        }
        toast.success("Welcome, admin!");
        navigate("/admin");
      } else {
        if (!agreed) {
          toast.error("Please accept the Terms & Conditions to continue");
          return;
        }
        if (!form.outletId.trim()) {
          toast.error("Outlet ID is required");
          setLoad(false);
          return;
        }
        const user = await loginUser(form.email, form.password);
        const profile = await getUserProfile(user.uid);
        if (profile?.role !== "outlet") {
          await logoutUser();
          toast.error("This account is not an outlet");
          setLoad(false);
          return;
        }
        if (profile?.outletId !== form.outletId.trim()) {
          await logoutUser();
          toast.error("Outlet ID does not match this account");
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

  // ── Soft/warm input styling ────────────────────────
  const inputWrap = "relative";
  const inputCls =
    "w-full pl-11 pr-4 py-3.5 text-sm rounded-2xl bg-[#FFF7EE] dark:bg-dark-800 border-2 border-transparent focus:border-primary-400 focus:bg-white dark:focus:bg-dark-800 text-dark-900 dark:text-dark-100 placeholder-dark-400 dark:placeholder-dark-500 outline-none transition-all";
  const iconCls =
    "absolute left-4 top-1/2 -translate-y-1/2 text-primary-500/70 pointer-events-none";
  const labelCls =
    "block text-xs font-semibold text-dark-600 dark:text-dark-400 tracking-wide mb-1.5 ml-1";

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#FFF9F5] via-[#FFF5F0] to-[#F0FBF8] dark:from-dark-950 dark:via-dark-950 dark:to-dark-900">
      {/* ══ Left: brand hero (desktop only) ══ */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        {/* Soft gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/95 via-primary-600/95 to-teal-700/95" />

        {/* Warm accent blobs — soft peach & mint on top of teal for warmth */}
        <div
          className="absolute -top-32 -right-24 w-[26rem] h-[26rem] rounded-full opacity-40 blur-2xl"
          style={{
            background: "radial-gradient(circle, #FFD5A5 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 -left-40 w-[24rem] h-[24rem] rounded-full opacity-30 blur-2xl"
          style={{
            background: "radial-gradient(circle, #FFE8D6 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-40 right-4 w-[30rem] h-[30rem] rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, #A7F3D0 0%, transparent 70%)",
          }}
        />

        {/* Soft floating dots for texture */}
        <div className="absolute top-24 right-32 w-3 h-3 rounded-full bg-white/30" />
        <div className="absolute top-40 right-20 w-2 h-2 rounded-full bg-white/40" />
        <div className="absolute bottom-40 left-16 w-4 h-4 rounded-full bg-white/25" />
        <div className="absolute top-1/2 right-48 w-2.5 h-2.5 rounded-full bg-white/35" />

        {/* Logo row */}
        <div className="relative flex items-center gap-3.5">
          <img
            src={logo}
            alt="SS FOO"
            className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg shadow-primary-900/20"
          />
          <div>
            <p className="font-display text-xl font-bold text-white leading-none tracking-tight">
              SS FOO SDN. BHD.
            </p>
            <p className="text-primary-100/90 text-xs mt-1.5 tracking-wide">
              Outlet Ordering Portal
            </p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-[1.1] tracking-tight">
            Wholesale ordering,
            <br />
            <span
              className="italic font-normal"
              style={{
                background: "linear-gradient(90deg, #FFE8D6 0%, #A7F3D0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
              made gentle.
            </span>
          </h1>
          <p className="text-primary-50/95 text-sm mt-5 leading-relaxed max-w-sm">
            One portal for all your outlet orders — browse the catalogue, order
            in bulk, and track every delivery, all in one warm little place.
          </p>

          <div className="mt-9 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    background: "rgba(255, 255, 255, 0.14)",
                    backdropFilter: "blur(8px)",
                  }}>
                  <Icon size={16} className="text-white" />
                </div>
                <span className="text-sm text-primary-50/95">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-primary-100/60 text-xs tracking-wide">
          © {new Date().getFullYear()} SS FOO SDN. BHD. · Authorized outlets
          only
        </p>
      </div>

      {/* ══ Right: form ══ */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 relative">
        {/* Mobile-only soft accent blob */}
        <div
          className="lg:hidden absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-40 blur-2xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, #FFD5A5 0%, transparent 70%)",
          }}
        />
        <div
          className="lg:hidden absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-40 blur-2xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, #A7F3D0 0%, transparent 70%)",
          }}
        />

        <div className="w-full max-w-sm relative">
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
          <div className="lg:hidden text-center mb-5">
            <h1 className="font-display text-2xl font-bold text-primary-600">
              SS FOO SDN. BHD.
            </h1>
            <p className="text-dark-400 text-xs mt-1">Outlet Ordering Portal</p>
          </div>

          {/* Card wrapper — soft cream background with generous rounding */}
          <div className="bg-white/70 dark:bg-dark-900/70 backdrop-blur-xl rounded-[2rem] p-7 sm:p-8 shadow-[0_20px_60px_-20px_rgba(20,184,166,0.25)] border border-white dark:border-dark-800">
            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-display font-bold text-dark-900 dark:text-dark-100 tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1.5">
                Sign in to your account to continue
              </p>
            </div>

            {/* Pill tab switcher */}
            <div
              className="grid grid-cols-2 gap-1 p-1 rounded-2xl mb-6"
              style={{ background: "#FFE8D6" }}>
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
                      ? "bg-white text-primary-600 shadow-sm"
                      : "text-primary-700/70 hover:text-primary-700"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-primary-600 transition-colors">
                    {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Outlet ID (outlet tab only) */}
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
                      placeholder="e.g. OUTLET001"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Admin code (admin tab only) */}
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
                      placeholder="Enter the secret admin code"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Forgot password */}
              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                  Forgot password?
                </Link>
              </div>

              {/* T&C — outlets only */}
              {tab === "outlet" && (
                <label
                  className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-2xl transition-colors"
                  style={{
                    background: agreed ? "rgba(20, 184, 166, 0.08)" : "#FFF7EE",
                  }}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-dark-700 dark:text-dark-300 leading-relaxed">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setTcOpen(true)}
                      className="text-primary-600 dark:text-primary-400 font-bold hover:underline">
                      Terms &amp; Conditions
                    </button>{" "}
                    / 我同意
                    <button
                      type="button"
                      onClick={() => setTcOpen(true)}
                      className="text-primary-600 dark:text-primary-400 font-bold hover:underline ml-1">
                      条款与条件
                    </button>
                  </span>
                </label>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || (tab === "outlet" && !agreed)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 transition-all">
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
          </div>

          {/* Footnote */}
          <p className="text-center text-xs text-dark-400 mt-6 px-4">
            No account?{" "}
            <span className="text-dark-500 dark:text-dark-300">
              Outlet accounts are created by the admin — contact SS FOO to get
              access.
            </span>
          </p>
        </div>
      </div>

      {/* ── Terms & Conditions modal ── */}
      {tcOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setTcOpen(false)}>
          <div className="bg-white dark:bg-dark-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-dark-100 dark:border-dark-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#FFF7EE] to-[#F0FBF8] dark:from-dark-900 dark:to-dark-900">
              <div>
                <h2 className="text-lg font-bold text-dark-900 dark:text-dark-100">
                  Terms &amp; Conditions
                </h2>
                <p className="text-xs text-dark-400">条款与条件</p>
              </div>
              <button
                onClick={() => setTcOpen(false)}
                className="p-2 rounded-xl text-dark-500 hover:text-dark-800 dark:hover:text-dark-200 hover:bg-white/60 dark:hover:bg-dark-800 transition-colors">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* English */}
              <section className="space-y-3">
                <h3 className="font-bold text-dark-900 dark:text-dark-100 text-base">
                  English
                </h3>
                <p className="text-dark-600 dark:text-dark-300 leading-relaxed">
                  By logging into the SS FOO SDN. BHD. wholesale ordering
                  portal, you (the outlet) agree to the following terms:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-dark-600 dark:text-dark-300 leading-relaxed">
                  <li>
                    <b>Account use.</b> This account belongs to the registered
                    outlet only. Do not share your login credentials with anyone
                    outside your business. You shall not disclose confidential
                    prices or commercial information. No sharing screenshots
                    containing prices or promotions. Company may terminate
                    dealership access at its discretion for breach, misuse,
                    overdue payments, fraud, or price disclosure. You are
                    responsible for all activity under your account. All
                    intellectual property including software, database, images
                    and content belongs to the Company. Governed by the laws of
                    Malaysia.
                  </li>
                  <li>
                    <b>Orders are proposals.</b> Placing an order in this portal
                    is a purchase request. SS FOO SDN. BHD. reserves the right
                    to confirm, adjust, or reject any order based on product
                    availability, pricing accuracy, or stock levels.
                  </li>
                  <li>
                    <b>Availability.</b> Website availability is not guaranteed;
                    maintenance may occur. Availability is confirmed offline by
                    our team after your order is placed. If any item is
                    unavailable, we will contact you to adjust or substitute.
                  </li>
                  <li>
                    <b>Pricing.</b> Wholesale prices and promotions are
                    confidential and must not be shared, copied, photographed,
                    or published. Prices shown are indicative wholesale prices
                    and may change without notice. The final invoice price
                    applies.
                  </li>
                  <li>
                    <b>Payment &amp; delivery.</b> Payment terms and delivery
                    arrangements are as agreed separately with SS FOO SDN. BHD.
                  </li>
                  <li>
                    <b>Returns.</b> Returns and exchanges are subject to our
                    standard wholesale policy. Contact us within 3 days of
                    delivery for any issues.
                  </li>
                  <li>
                    <b>Privacy.</b> Your account and order data are used only to
                    process your orders and provide service. We do not share
                    your data with third parties.
                  </li>
                  <li>
                    <b>Changes to terms.</b> These terms may be updated. Your
                    continued use of the portal means you accept any updates.
                  </li>
                </ol>
              </section>

              <hr className="border-dark-100 dark:border-dark-800" />

              {/* Chinese */}
              <section className="space-y-3">
                <h3 className="font-bold text-dark-900 dark:text-dark-100 text-base">
                  中文
                </h3>
                <p className="text-dark-600 dark:text-dark-300 leading-relaxed">
                  登入 SS FOO SDN. BHD.
                  批发订购平台，即代表阁下（门店）同意以下条款：
                </p>
                <ol className="list-decimal list-inside space-y-2 text-dark-600 dark:text-dark-300 leading-relaxed">
                  <li>
                    <b>账号使用。</b>
                    本账号仅供已注册门店使用。请勿将登入资料分享给业务以外的人士。您不得对外泄露机密价格或商业信息，亦不得分享任何含有价格或促销内容的截图。若发生违规、滥用、逾期付款、欺诈或价格泄露等情况，本公司保留自行决定终止经销商权限的权利。您须为账号下的所有操作负责。本平台的所有知识产权，包括软件、数据库、图片及内容，均归本公司所有。本条款受马来西亚法律管辖。
                  </li>
                  <li>
                    <b>订单为请求。</b>在本平台下单属于采购请求。SS FOO SDN.
                    BHD.
                    保留根据货品供应、价格及库存情况，确认、调整或拒绝任何订单的权利。
                  </li>
                  <li>
                    <b>供货情况。</b>
                    本网站不保证随时可用，可能因维护而暂停服务。订单下达后，供货情况由我们的团队在线下确认。若有商品缺货，我们会主动联系您安排调整或替换。
                  </li>
                  <li>
                    <b>价格。</b>
                    批发价格及促销信息属机密资料，不得分享、复制、拍照或公开发布。平台显示的价格为参考批发价，可能随时调整，恕不另行通知。最终以发票价格为准。
                  </li>
                  <li>
                    <b>付款与送货。</b>付款条件与送货安排以与 SS FOO SDN. BHD.
                    另行商定为准。
                  </li>
                  <li>
                    <b>退换货。</b>退换货依照我们的批发政策处理。请在收货 3
                    天内联系我们处理任何问题。
                  </li>
                  <li>
                    <b>隐私。</b>
                    您的账号及订单数据仅用于处理订单及提供服务。我们不会与第三方分享您的数据。
                  </li>
                  <li>
                    <b>条款更新。</b>
                    本条款可能会更新。您持续使用本平台，即视为接受最新版本的条款。
                  </li>
                </ol>
              </section>

              <p className="text-xs text-dark-400 italic pt-2">
                Last updated / 最后更新:{" "}
                {new Date().toLocaleDateString("en-MY", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="px-6 py-4 border-t border-dark-100 dark:border-dark-800 flex items-center justify-between gap-3 shrink-0">
              <p className="text-xs text-dark-500 dark:text-dark-400 hidden sm:block">
                Tick the checkbox to accept / 勾选方框以同意
              </p>
              <button
                onClick={() => {
                  setAgreed(true);
                  setTcOpen(false);
                }}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/30 transition-all">
                Accept &amp; Close / 同意
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
