// src/firebase/orders.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const COL = "orders";

// Atomic sequential order number generator.
// Uses a single counter doc at /counters/orders with a `next` field.
// Numbers are zero-padded to 5 digits (00001, 00002, …).
async function getNextOrderNumber() {
  const counterRef = doc(db, "counters", "orders");
  const nextNum = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data().next) || 1 : 1;
    tx.set(counterRef, { next: current + 1, updatedAt: serverTimestamp() });
    return current;
  });
  return String(nextNum).padStart(5, "0");
}

export const placeOrder = async (userId, orderData) => {
  const orderRef = doc(collection(db, COL));

  // Allocate the sequential order number BEFORE writing the order.
  // If the transaction fails, we don't create a half-formed order.
  let orderNumber = "";
  try {
    orderNumber = await getNextOrderNumber();
  } catch (e) {
    console.error("Order number allocation failed:", e);
    // Fall back to short id from the autoId so orders never get blocked.
    orderNumber = orderRef.id.slice(-5).toUpperCase();
  }

  await setDoc(orderRef, {
    ...orderData,
    userId,
    orderNumber,
    createdAt: serverTimestamp(),
  });

  // Clear cart
  try {
    await updateDoc(doc(db, "carts", userId), {
      items: [],
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Clear cart failed:", e);
  }

  // Notify all admins in the background — fire & forget.
  notifyAdminsNewOrder(orderRef.id, orderData).catch((e) =>
    console.error("Admin notify failed:", e),
  );

  return orderRef.id;
};

// ── Admin fan-out for order notifications ──
async function notifyAdminsNewOrder(orderId, orderData) {
  // Look up every admin (small set — safe to read all)
  const usersSnap = await getDocs(
    query(collection(db, "users"), where("role", "in", ["admin", "editor"])),
  );
  if (usersSnap.empty) return;

  const batch = writeBatch(db);
  usersSnap.docs.forEach((u) => {
    const ref = doc(collection(db, "notifications"));
    batch.set(ref, {
      userId: u.id,
      type: "new_order",
      orderId,
      outletName: orderData.outletName || "",
      outletId: orderData.outletId || "",
      total: Number(orderData.total || 0),
      itemCount: (orderData.items || []).length,
      read: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

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
