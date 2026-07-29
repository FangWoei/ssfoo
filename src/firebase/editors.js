// src/firebase/editors.js
// Create editor accounts (staff who print/process orders).
// Editors are internal-only staff, always have a real email, and never
// have outletId or brand restrictions.
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseConfig } from "./config";

export const createEditor = async ({ email, password, name }) => {
  if (!email || !email.trim()) throw new Error("Email is required");
  if (!password || password.length < 6)
    throw new Error("Password must be at least 6 characters");

  const secondaryApp = initializeApp(firebaseConfig, "editor-creator");
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim(),
      password,
    );
    const uid = credential.user.uid;

    await setDoc(doc(db, "users", uid), {
      uid,
      email: email.trim(),
      name: name?.trim() || "",
      role: "editor",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await signOut(secondaryAuth);
    return { uid, email, name };
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
};
