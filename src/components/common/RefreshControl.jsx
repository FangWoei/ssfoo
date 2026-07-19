// src/components/common/RefreshControl.jsx
// Manual refresh button + auto-refresh interval picker.
// v2: defaults to every 5 minutes for everyone; once the user picks a
// different interval it's remembered (per page, via localStorage).
import { REFRESH_INTERVALS } from "@/utils/config";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiClock, FiRefreshCw } from "react-icons/fi";

const DEFAULT_INTERVAL = 300; // 5 minutes

export default function RefreshControl({
  onRefresh,
  refreshing = false,
  storageKey = "ssfoo-refresh",
}) {
  // Default 5m; a saved choice (including "Off") overrides it
  const [interval, setIntervalVal] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return DEFAULT_INTERVAL; // first visit → 5 min
    const saved = Number(raw);
    return REFRESH_INTERVALS.some((r) => r.value === saved)
      ? saved
      : DEFAULT_INTERVAL;
  });
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const menuRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Remember the user's choice
  useEffect(() => {
    localStorage.setItem(storageKey, String(interval));
  }, [interval, storageKey]);

  // Countdown ticker
  useEffect(() => {
    if (!interval) {
      setCountdown(0);
      return;
    }
    setCountdown(interval);
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [interval]);

  // Fire the refresh when the countdown reaches zero, then restart
  useEffect(() => {
    if (interval > 0 && countdown <= 0) {
      onRefreshRef.current?.();
      setCountdown(interval);
    }
  }, [countdown, interval]);

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

  const fmtCountdown = (s) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${s}s`);

  return (
    <div className="flex items-center gap-1.5">
      {/* Auto-refresh dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
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
