// src/firebase/products.js
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const COL = "products";

export const getProducts = async ({
  category = null,
  sortBy = "createdAt",
  sortDir = "desc",
  pageSize = 100,
  lastDoc = null,
} = {}) => {
  const constraints = [];
  if (category) constraints.push(where("category", "==", category));
  constraints.push(orderBy(sortBy, sortDir));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return {
    products: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
};

// Fetch the ENTIRE catalogue (no limit). Needed because the client
// has 1500-2000 products — pageSize-limited queries silently hide
// everything beyond the first page.
export const getAllProducts = async () => {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getProduct = async (id) => {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getCategories = async () => {
  const snap = await getDocs(collection(db, "categories"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addProduct = async (data) => {
  return addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateProduct = async (id, data) => {
  return updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteProduct = async (id) => {
  return deleteDoc(doc(db, COL, id));
};

export const bulkDeleteProducts = async (ids) => {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COL, id)));
  return batch.commit();
};

// ── Promotion toggle (#5) ────────────────────────────
export const toggleProductPromo = async (id, isPromo) => {
  return updateDoc(doc(db, COL, id), {
    isPromo,
    updatedAt: serverTimestamp(),
  });
};

// ── Brand management (stored in "brands" collection) ──
// Brands control per-outlet product visibility.
export const getBrands = async () => {
  const snap = await getDocs(query(collection(db, "brands"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── UOM management (stored in "uoms" collection) ─────
export const getUoms = async () => {
  const snap = await getDocs(query(collection(db, "uoms"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addUom = async (name) => {
  return addDoc(collection(db, "uoms"), {
    name,
    createdAt: serverTimestamp(),
  });
};

export const deleteUom = async (id) => {
  return deleteDoc(doc(db, "uoms", id));
};

// ── Restock subscribers ────────────────────────────────
// When an outlet taps 🔔 on an out-of-stock product, we set
// products/{id}/subscribers/{userId}. When admin restocks (0 → n),
// we notify each subscriber and clear the subscribers.
export const subscribeRestock = async (productId, userId) => {
  await setDoc(
    doc(db, COL, productId, "subscribers", userId),
    { createdAt: serverTimestamp() },
    { merge: true },
  );
};

export const unsubscribeRestock = async (productId, userId) => {
  await deleteDoc(doc(db, COL, productId, "subscribers", userId));
};

export const getMyRestockSubs = async (userId) => {
  // Uses collectionGroup so we don't need to know which products
  const q = query(
    collectionGroup(db, "subscribers"),
    where("__name__", ">=", ""), // no filter — filter client-side
  );
  const snap = await getDocs(q);
  const mine = snap.docs
    .filter((d) => d.id === userId)
    .map((d) => d.ref.parent.parent.id); // → productId
  return mine;
};

// Simple version — outlet asks "am I subscribed to X"
export const isSubscribedRestock = async (productId, userId) => {
  const snap = await getDoc(doc(db, COL, productId, "subscribers", userId));
  return snap.exists();
};

// After restock: read all subscribers, notify each, then clear.
export const notifyRestockedProduct = async (product) => {
  const subsSnap = await getDocs(
    collection(db, COL, product.id, "subscribers"),
  );
  if (subsSnap.empty) return 0;

  const batch = writeBatch(db);
  subsSnap.docs.forEach((sub) => {
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      userId: sub.id,
      type: "restock",
      productId: product.id,
      productName: product.name || "",
      productImage: product.images?.[0] || "",
      itemCode: product.itemCode || "",
      read: false,
      createdAt: serverTimestamp(),
    });
    batch.delete(sub.ref); // one-shot — remove subscription
  });
  await batch.commit();
  return subsSnap.size;
};

// ── Bulk import from Excel (#8) ──────────────────────
// rows: array of validated product objects.
// Firestore caps a batch at 500 writes, so large imports
// (the client has 1500-2000 products) are split into chunks.
export const bulkAddProducts = async (rows, onProgress) => {
  const CHUNK = 450;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    rows.slice(i, i + CHUNK).forEach((row) => {
      const ref = doc(collection(db, COL));
      batch.set(ref, {
        ...row,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    done = Math.min(i + CHUNK, rows.length);
    onProgress?.(done, rows.length);
  }
  return rows.length;
};

// ── Bulk UPDATE by document id (matched via itemCode) ──
// updates: [{ id, data }]. Only the provided fields change —
// images / promo settings stay untouched.
export const bulkUpdateProducts = async (updates, onProgress) => {
  const CHUNK = 450;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    updates.slice(i, i + CHUNK).forEach(({ id, data }) => {
      batch.update(doc(db, COL, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    done = Math.min(i + CHUNK, updates.length);
    onProgress?.(done, updates.length);
  }
  return updates.length;
};
