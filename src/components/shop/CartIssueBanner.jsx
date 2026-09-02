// src/components/shop/CartIssueBanner.jsx
// Shows what changed in the catalogue since the cart was filled, and gives
// one action to bring the cart back in line. Shared by Cart and Checkout.

import { SEVERITY } from "@/utils/cartValidation";
import {
  FiAlertTriangle,
  FiLoader,
  FiRefreshCw,
  FiSlash,
  FiTrendingDown,
  FiTrendingUp,
  FiWifiOff,
} from "react-icons/fi";

export default function CartIssueBanner({
  result,
  onResolve,
  onRetry,
  applying = false,
  className = "",
}) {
  if (!result || result.ok) return null;

  /* ── The check itself couldn't run ── */
  if (result.failed) {
    return (
      <div
        className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <FiWifiOff size={18} className="text-slate-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Couldn&apos;t check prices and availability
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your cart may not reflect the latest catalogue. Check your
              connection and try again.
            </p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const removed = result.issues.filter((i) => i.severity === SEVERITY.REMOVE);
  const updated = result.issues.filter((i) => i.severity === SEVERITY.UPDATE);

  const headline =
    removed.length > 0 && updated.length > 0
      ? "Some items changed and some are no longer available"
      : removed.length > 0
        ? removed.length > 1
          ? "Some items are no longer available"
          : "One item is no longer available"
        : updated.length > 1
          ? "Some prices and terms changed"
          : "A price or term changed";

  const actionLabel =
    removed.length > 0 && updated.length === 0
      ? removed.length > 1
        ? "Remove them"
        : "Remove it"
      : "Update cart";

  return (
    <div
      className={`rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <FiAlertTriangle
          size={18}
          className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            {headline}
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            The catalogue was updated after you added these to your cart.
          </p>

          <ul className="mt-3 space-y-2">
            {removed.map((issue) => (
              <li
                key={`${issue.productId}-${issue.type}`}
                className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                <FiSlash size={13} className="mt-0.5 shrink-0 opacity-70" />
                <span>{issue.message}</span>
              </li>
            ))}
            {updated.map((issue) => (
              <li
                key={`${issue.productId}-${issue.type}`}
                className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                {issue.type === "price_up" ? (
                  <FiTrendingUp
                    size={13}
                    className="mt-0.5 shrink-0 opacity-70"
                  />
                ) : issue.type === "price_down" ? (
                  <FiTrendingDown
                    size={13}
                    className="mt-0.5 shrink-0 opacity-70"
                  />
                ) : (
                  <FiRefreshCw
                    size={13}
                    className="mt-0.5 shrink-0 opacity-70"
                  />
                )}
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={onResolve}
              disabled={applying}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors">
              {applying ? (
                <>
                  <FiLoader size={13} className="animate-spin" /> Updating…
                </>
              ) : (
                actionLabel
              )}
            </button>
            <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
              You can review the cart before ordering.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
