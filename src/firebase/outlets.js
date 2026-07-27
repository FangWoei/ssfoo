// src/firebase/outlets.js
import { normalizePhone, phoneToPseudoEmail } from "@/utils/phone";
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
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
import { auth, db, firebaseConfig } from "./config";

// ── Create outlet account (admin only) ───────────────
// Uses a SECONDARY Firebase app so creating the outlet's
// auth account does NOT sign the admin out of the main app.
export const createOutlet = async ({
  email,
  password,
  outletId,
  outletName,
  phone,
  address,
  allowedBrands = [],
}) => {
  // Normalize phone if provided
  const normalizedPhone = phone ? normalizePhone(phone) : "";

  // Figure out which credential to use for Firebase Auth.
  // Priority: real email if given, otherwise pseudo-email from phone.
  const hasRealEmail = email && email.trim() && !email.endsWith("@ssfoo.phone");
  const authEmail = hasRealEmail
    ? email.trim()
    : normalizedPhone
      ? phoneToPseudoEmail(normalizedPhone)
      : null;

  if (!authEmail) {
    throw new Error("Either email or phone is required");
  }

  const secondaryApp = initializeApp(firebaseConfig, "outlet-creator");
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // 1. Create Firebase Auth account on the secondary app
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      authEmail,
      password,
    );
    const uid = credential.user.uid;

    // 2. Save profile to Firestore (main app — admin is still signed in).
    //    Store the REAL email if given (empty otherwise), plus the phone.
    //    We NEVER store the pseudo-email in this field — that's an
    //    implementation detail only Firebase Auth sees.
    await setDoc(doc(db, "users", uid), {
      uid,
      email: hasRealEmail ? email.trim() : "",
      phone: normalizedPhone,
      outletId,
      outletName,
      address: address || "",
      allowedBrands,
      role: "outlet",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. Sign the new outlet out of the secondary app
    await signOut(secondaryAuth);

    return { uid, outletId, outletName };
  } finally {
    // 4. Clean up the secondary app
    await deleteApp(secondaryApp).catch(() => {});
  }
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
