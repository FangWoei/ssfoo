// src/firebase/orders.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const COL = "orders";

export const placeOrder = async (userId, orderData) => {
  const batch = writeBatch(db);
  const orderRef = doc(collection(db, COL));

  batch.set(orderRef, {
    ...orderData,
    userId,
    createdAt: serverTimestamp(),
  });

  // Reduce flat stock
  for (const item of orderData.items) {
    const productRef = doc(db, "products", item.productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) continue;
    const currentStock = productSnap.data().stock || 0;
    const newStock = Math.max(0, currentStock - item.qty);
    batch.update(productRef, {
      stock: newStock,
      inStock: newStock > 0,
      ...(newStock === 0 ? { status: "draft" } : {}),
    });
  }

  await batch.commit();

  // Clear cart
  try {
    await updateDoc(doc(db, "carts", userId), {
      items: [],
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Clear cart failed:", e);
  }

  return orderRef.id;
};

// Outlet's own orders — queried by userId so Firestore rules can
// verify the query (rules allow: resource.data.userId == auth.uid)
export const getMyOrders = async (userId) => {
  const snap = await getDocs(
    query(
      collection(db, COL),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getOrder = async (orderId) => {
  const snap = await getDoc(doc(db, COL, orderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getAllOrders = async ({ pageSize = 50 } = {}) => {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("createdAt", "desc"), limit(pageSize)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const toggleOrderDone = async (orderId, done) => {
  await updateDoc(doc(db, COL, orderId), {
    done,
    updatedAt: serverTimestamp(),
  });
};
