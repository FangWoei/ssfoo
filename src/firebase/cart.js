// src/firebase/cart.js — Fix #8: persist cart in Firestore
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

export const saveCartToFirestore = async (userId, items) => {
  await setDoc(doc(db, "carts", userId), {
    items,
    updatedAt: serverTimestamp(),
  });
};

export const loadCartFromFirestore = async (userId) => {
  const snap = await getDoc(doc(db, "carts", userId));
  return snap.exists() ? snap.data().items || [] : [];
};
