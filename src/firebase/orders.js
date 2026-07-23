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
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const COL = "orders";

export const placeOrder = async (userId, orderData) => {
  const orderRef = doc(collection(db, COL));

  // Stock tracking has been removed — outlets order freely and
  // availability is handled offline. Just write the order.
  await setDoc(orderRef, {
    ...orderData,
    userId,
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
    query(collection(db, "users"), where("role", "==", "admin")),
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
