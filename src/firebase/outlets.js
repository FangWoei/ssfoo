// src/firebase/outlets.js
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./config";

// ── Create outlet account (admin only) ───────────────
export const createOutlet = async ({
  email,
  password,
  outletId,
  outletName,
  phone,
  address,
}) => {
  // 1. Create Firebase Auth account
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const uid = credential.user.uid;

  // 2. Save to Firestore
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    outletId,
    outletName,
    phone: phone || "",
    address: address || "",
    role: "outlet",
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { uid, outletId, outletName };
};

// ── Get all outlets ───────────────────────────────────
export const getAllOutlets = async () => {
  const snap = await getDocs(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.role === "outlet");
};

// ── Get single outlet ─────────────────────────────────
export const getOutlet = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ── Update outlet ─────────────────────────────────────
export const updateOutlet = async (uid, data) => {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// ── Deactivate / Reactivate outlet ───────────────────
export const toggleOutletActive = async (uid, active) => {
  await updateDoc(doc(db, "users", uid), {
    active,
    updatedAt: serverTimestamp(),
  });
};

// ── Send password reset to outlet ────────────────────
export const sendOutletPasswordReset = async (email) => {
  await sendPasswordResetEmail(auth, email);
};
