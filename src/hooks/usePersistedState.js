// src/hooks/usePersistedState.js
// Like useState, but remembers the value in sessionStorage so filters
// and searches survive navigating away and back (e.g. list → edit →
// back). Clears automatically when the browser tab is closed.
import { useEffect, useState } from "react";

export default function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full/blocked — degrade to normal state */
    }
  }, [key, value]);

  return [value, setValue];
}
