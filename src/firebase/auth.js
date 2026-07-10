// src/firebase/auth.js
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";

// ── Login ─────────────────────────────────────────────
export const loginUser = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

// ── Logout ────────────────────────────────────────────
export const logoutUser = () => signOut(auth);

// ── Password Reset ────────────────────────────────────
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

// ── Get User Profile from Firestore ──────────────────
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
};

// ── Change Password ───────────────────────────────────
export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

// ── Auth State Listener ───────────────────────────────
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);
