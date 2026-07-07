// src/firebase/products.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
