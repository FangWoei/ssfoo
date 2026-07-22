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
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";

const COL = "orders";

export const placeOrder = async (userId, orderData) => {
  const orderRef = doc(collection(db, COL));

  // Runs the transaction below, and afterwards drops "new_order"
  // notifications for every admin so they see it in their bell.
  // Transaction: reads current stock and writes atomically, so two
  // outlets ordering the same product at the same moment can't
  // oversell. If any item lacks stock, the whole order fails with a
  // clear message (checkout shows it as a toast).
  await runTransaction(db, async (tx) => {
    // 1. Read every product first (transactions require reads before writes)
    const reads = [];
    for (const item of orderData.items) {
      const ref = doc(db, "products", item.productId);
      reads.push({ item, ref, snap: await tx.get(ref) });
    }

    // 2. Validate stock
    for (const { item, snap } of reads) {
      if (!snap.exists()) continue; // product deleted — allow, skip stock
      const current = snap.data().stock || 0;
      if (current < item.qty) {
        throw new Error(
          `Not enough stock for "${item.name}" — only ${current} left. Please adjust your cart.`,
        );
      }
    }

    // 3. Write order + decrement stock
    tx.set(orderRef, {
      ...orderData,
      userId,
      createdAt: serverTimestamp(),
    });

    for (const { item, ref, snap } of reads) {
      if (!snap.exists()) continue;
      const newStock = (snap.data().stock || 0) - item.qty;
      tx.update(ref, {
        stock: newStock,
        inStock: newStock > 0,
        ...(newStock === 0 ? { status: "draft" } : {}),
      });
    }
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
