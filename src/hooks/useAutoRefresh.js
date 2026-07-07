import { useEffect, useRef, useState } from "react";

const INTERVALS = [
  { label: "Off", value: 0 },
  { label: "30s", value: 30000 },
  { label: "1 min", value: 60000 },
  { label: "2 min", value: 120000 },
  { label: "5 min", value: 300000 },
  { label: "10 min", value: 600000 },
  { label: "20 min", value: 1200000 },
  { label: "30 min", value: 1800000 },
];

export { INTERVALS };

export default function useAutoRefresh(callback, storageKey = "autoRefresh") {
  const [interval, setIntervalVal] = useState(() => {
    return Number(localStorage.getItem(storageKey) || 300000);
  });
  const [countdown, setCountdown] = useState(interval / 1000);
  const timerRef = useRef(null);
  const countRef = useRef(null);
  const callbackRef = useRef(callback); // ✅ ADD THIS

  // ✅ ADD THIS — keep ref always pointing to latest callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const saveInterval = (val) => {
    setIntervalVal(val);
    localStorage.setItem(storageKey, val);
  };

  useEffect(() => {
    clearInterval(timerRef.current);
    clearInterval(countRef.current);

    if (interval === 0) {
      setCountdown(0);
      return;
    }

    setCountdown(interval / 1000);

    countRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return interval / 1000;
        return prev - 1;
      });
    }, 1000);

    // ✅ CHANGED — use callbackRef.current instead of callback directly
    timerRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(countRef.current);
    };
  }, [interval]); // ✅ interval only — no need to add callback since we use ref

  return { interval, setInterval: saveInterval, countdown, INTERVALS };
}
