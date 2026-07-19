// src/firebase/chat.js
// Outlet ↔ Admin chat (ported from Ladybird, adapted for Ssfoo).
// One thread per outlet: chats/{outletUid} + messages subcollection.
// Outlets can only talk to the admin; admin sees all threads.
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./config";

// ── Outlet sends a message (text and/or product) ──────
export const sendMessage = async (
  outletUid,
  outletName,
  outletId,
  { text = "", product = null } = {},
) => {
  const cleanProduct = product
    ? {
        id: product.id || "",
        itemCode: product.itemCode || "",
        name: product.name || "",
        image: product.image || "",
        price: product.price || 0,
      }
    : null;

  const lastMessage = cleanProduct
    ? `📦 ${cleanProduct.itemCode || cleanProduct.name}${text ? ` — ${text}` : ""}`
    : text;

  await setDoc(
    doc(db, "chats", outletUid),
    {
      outletUid,
      outletName: outletName || "",
      outletId: outletId || "",
      lastMessage,
      lastMessageAt: serverTimestamp(),
      unreadByAdmin: true,
    },
    { merge: true },
  );

  await addDoc(collection(db, "chats", outletUid, "messages"), {
    text,
    product: cleanProduct,
    senderRole: "outlet",
    createdAt: serverTimestamp(),
  });
};

// ── Admin replies to an outlet ────────────────────────
export const sendAdminReply = async (outletUid, text) => {
  await setDoc(
    doc(db, "chats", outletUid),
    {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      unreadByUser: true,
      unreadByAdmin: false,
    },
    { merge: true },
  );

  await addDoc(collection(db, "chats", outletUid, "messages"), {
    text,
    senderRole: "admin",
    createdAt: serverTimestamp(),
  });
};

// ── Realtime listeners ────────────────────────────────
export const listenMessages = (outletUid, callback) => {
  return onSnapshot(
    query(
      collection(db, "chats", outletUid, "messages"),
      orderBy("createdAt", "asc"),
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
};

export const listenAllChats = (callback) => {
  return onSnapshot(
    query(collection(db, "chats"), orderBy("lastMessageAt", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
};

export const listenUserUnread = (outletUid, callback) => {
  return onSnapshot(doc(db, "chats", outletUid), (snap) => {
    callback(snap.exists() && snap.data().unreadByUser === true);
  });
};

// ── Read receipts ─────────────────────────────────────
export const markReadByAdmin = async (outletUid) => {
  await updateDoc(doc(db, "chats", outletUid), { unreadByAdmin: false });
};

export const markReadByUser = async (outletUid) => {
  try {
    await updateDoc(doc(db, "chats", outletUid), { unreadByUser: false });
  } catch {
    /* thread may not exist yet */
  }
};
