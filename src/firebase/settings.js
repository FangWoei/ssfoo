// src/firebase/settings.js
// App-wide settings stored in Firestore: settings/app
// Admin edits them in /admin/settings — no code change needed.
import { db } from "@/firebase/config";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export const DEFAULT_MIN_ORDER = 500;
const settingsRef = () => doc(db, "settings", "app");

const toMin = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_ORDER;
};

// Live minimum order amount (RM). Falls back to 500 until loaded / if missing.
export function useMinOrder() {
  const [minOrder, setMinOrder] = useState(DEFAULT_MIN_ORDER);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onSnapshot(
      settingsRef(),
      (snap) => {
        setMinOrder(
          snap.exists() ? toMin(snap.data().minOrder) : DEFAULT_MIN_ORDER,
        );
        setLoading(false);
      },
      () => setLoading(false), // permission/network error → keep default
    );
    return unsub;
  }, []);
  return { minOrder, loading };
}

export async function saveMinOrder(value, uid) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  await setDoc(
    settingsRef(),
    { minOrder: n, updatedAt: serverTimestamp(), updatedBy: uid || null },
    { merge: true },
  );
}
