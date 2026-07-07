// src/pages/shop/OrderSuccessPage.jsx
import { useEffect } from "react";
import { FiArrowRight, FiCheck, FiShoppingBag } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function OrderSuccessPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const orderId = state?.orderId;

  // Direct URL visits without an order → back to shop
  useEffect(() => {
    if (!orderId) navigate("/shop", { replace: true });
  }, [orderId, navigate]);

  if (!orderId) return null;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Success mark */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-teal-600 flex items-center justify-center animate-[popIn_0.4s_ease-out]">
          <FiCheck size={38} className="text-white" strokeWidth={3} />
        </div>
        <div className="absolute inset-0 rounded-full bg-teal-500/30 animate-ping [animation-iteration-count:2]" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Order Placed!
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-1">
        Your order has been submitted and stock has been reserved.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        The admin will review and process it shortly.
      </p>

      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 mb-8">
        <span className="text-[11px] uppercase tracking-wide text-slate-400 block">
          Order ID
        </span>
        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
          {orderId}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to={`/orders/${orderId}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors">
          View Order <FiArrowRight size={15} />
        </Link>
        <Link
          to="/shop"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 text-sm font-semibold transition-colors">
          <FiShoppingBag size={15} /> Back to Shop
        </Link>
      </div>

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
