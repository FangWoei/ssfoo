// src/components/common/RefreshControl.jsx
// Manual refresh button + auto-refresh interval picker (#1).
// Usage:
//   const [refreshing, setRefreshing] = useState(false);
//   const doRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
//   <RefreshControl onRefresh={doRefresh} refreshing={refreshing} />
import { REFRESH_INTERVALS } from "@/utils/config";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiClock, FiRefreshCw } from "react-icons/fi";

export default function RefreshControl({
  onRefresh,
  refreshing = false,
  storageKey = "ssfoo-refresh",
}) {
  // Persist the chosen interval per page
  const [interval, setIntervalVal] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey));
    return REFRESH_INTERVALS.some((r) => r.value === saved) ? saved : 0;
  });
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const menuRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Persist selection
  useEffect(() => {
    localStorage.setItem(storageKey, String(interval));
  }, [interval, storageKey]);

  // Auto-refresh timer + countdown
  useEffect(() => {
    if (!interval) {
      setCountdown(0);
      return;
    }
    setCountdown(interval);
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          onRefreshRef.current?.();
          return interval;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [interval]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeLabel = REFRESH_INTERVALS.find(
    (r) => r.value === interval,
  )?.label;

  const fmtCountdown = (s) => {
    if (s >= 60) return `${Math.ceil(s / 60)}m`;
    return `${s}s`;
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Auto-refresh dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            interval
              ? "border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
              : "border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500"
          }`}
          title="Auto-refresh">
          <FiClock size={14} />
          {interval ? (
            <span>
              {activeLabel}
              {countdown > 0 && (
                <span className="text-dark-400 dark:text-dark-500 ml-1">
                  ({fmtCountdown(countdown)})
                </span>
              )}
            </span>
          ) : (
            <span>Auto</span>
          )}
          <FiChevronDown size={13} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-32 bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-xl shadow-lg py-1 z-50">
            {REFRESH_INTERVALS.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  setIntervalVal(r.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  interval === r.value
                    ? "text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-900/20"
                    : "text-dark-600 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800"
                }`}>
                {r.value === 0 ? "Off" : `Every ${r.label}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual refresh */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="p-2 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500 hover:text-primary-600 disabled:opacity-60 transition-colors"
        title="Refresh now">
        <FiRefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
