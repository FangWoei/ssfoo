// src/firebase/chat.js
// Outlet ↔ Admin chat (ported from Ladybird, adapted for Ssfoo).
// One thread per outlet: chats/{outletUid} + messages subcollection.
// Outlets can only talk to the admin; admin sees all threads.
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

  // Fan out to all admins
  notifyAdminsChat(outletUid, outletName, outletId, lastMessage);
};

// ── Admin replies to an outlet (text and/or product) ──
export const sendAdminReply = async (
  outletUid,
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
      lastMessage,
      lastMessageAt: serverTimestamp(),
      unreadByUser: true,
      unreadByAdmin: false,
    },
    { merge: true },
  );

  await addDoc(collection(db, "chats", outletUid, "messages"), {
    text,
    product: cleanProduct,
    senderRole: "admin",
    createdAt: serverTimestamp(),
  });

  notifyOutletChat(outletUid, lastMessage);
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

// ── Notify admins of a new outlet message ─────────────
async function notifyAdminsChat(outletUid, outletName, outletId, preview) {
  try {
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("role", "==", "admin")),
    );
    if (usersSnap.empty) return;
    const batch = writeBatch(db);
    usersSnap.docs.forEach((u) => {
      const ref = doc(collection(db, "notifications"));
      batch.set(ref, {
        userId: u.id,
        type: "chat_message",
        outletUid,
        outletName: outletName || "",
        outletId: outletId || "",
        preview: (preview || "").slice(0, 120),
        read: false,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (e) {
    console.error("Chat notify (admin) failed:", e);
  }
}

// ── Notify outlet when admin replies ──────────────────
async function notifyOutletChat(outletUid, preview) {
  try {
    await addDoc(collection(db, "notifications"), {
      userId: outletUid,
      type: "chat_reply",
      outletUid,
      preview: (preview || "").slice(0, 120),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Chat notify (outlet) failed:", e);
  }
}
