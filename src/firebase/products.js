// src/firebase/products.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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

// ── Shared in-memory cache for getAllProducts ──
// The full catalogue (1500-2000 docs) was being independently
// re-fetched by ShopPage, the chat product picker (both sides), and
// admin pages — up to 6 separate full-collection reads per session.
// Read-only screens (Shop, chat picker) should share one fetch;
// admin management screens should always see the latest data.
let _productsCache = { data: null, ts: 0 };
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export const getAllProductsCached = async ({ force = false } = {}) => {
  const fresh =
    !force &&
    _productsCache.data &&
    Date.now() - _productsCache.ts < CACHE_TTL_MS;
  if (fresh) return _productsCache.data;

  const data = await getAllProducts();
  _productsCache = { data, ts: Date.now() };
  return data;
};

// Call after any write (add/update/delete/bulk import) so the next
// read anywhere in the app — even outside the TTL window — gets the
// change immediately instead of possibly serving a stale cache.
export const invalidateProductsCache = () => {
  _productsCache = { data: null, ts: 0 };
};

export const getProduct = async (id) => {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Fetch a specific set of products by document id, always from the server
// (never the getAllProducts cache — the cart checker must see what the admin
// changed 10 seconds ago). Firestore caps an `in` query at 30 values, so the
// id list is chunked. Ids with no matching doc are simply absent from the
// returned Map, which the cart checker reads as "deleted".
export const getProductsByIds = async (ids = []) => {
  const unique = [...new Set(ids.filter(Boolean))];
  const found = new Map();
  const CHUNK = 30;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const snap = await getDocs(
      query(collection(db, COL), where(documentId(), "in", slice)),
    );
    snap.docs.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }));
  }
  return found;
};

export const getCategories = async () => {
  const snap = await getDocs(collection(db, "categories"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addProduct = async (data) => {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateProductsCache();
  return ref;
};

export const updateProduct = async (id, data) => {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  invalidateProductsCache();
};

export const deleteProduct = async (id) => {
  await deleteDoc(doc(db, COL, id));
  invalidateProductsCache();
};

export const bulkDeleteProducts = async (ids) => {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COL, id)));
  await batch.commit();
  invalidateProductsCache();
};

// ── Promotion toggle (#5) ────────────────────────────
export const toggleProductPromo = async (id, isPromo) => {
  await updateDoc(doc(db, COL, id), {
    isPromo,
    updatedAt: serverTimestamp(),
  });
  invalidateProductsCache();
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
  invalidateProductsCache();
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
  invalidateProductsCache();
  return updates.length;
};
