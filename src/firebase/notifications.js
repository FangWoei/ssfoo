// src/firebase/notifications.js
// Per-user notifications (new_order, chat_message, chat_reply).
// One doc per event: notifications/{autoId}
//   { userId, type, ...type-specific fields, read: false, createdAt }
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

const COL = "notifications";

// Realtime listener — latest 30 for a user
export const listenMyNotifications = (userId, callback) => {
  if (!userId) return () => {};
  return onSnapshot(
    query(
      collection(db, COL),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
};

export const markNotificationRead = async (id) => {
  try {
    await updateDoc(doc(db, COL, id), { read: true });
  } catch {
    /* already gone */
  }
};

export const listenMyUnreadCount = (userId, callback) => {
  if (!userId) return () => {};
  return onSnapshot(
    query(
      collection(db, COL),
      where("userId", "==", userId),
      where("read", "==", false),
    ),
    (snap) => callback(snap.size),
  );
};

export const markAllRead = async (userId, notifs) => {
  const unread = notifs.filter((n) => !n.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, COL, n.id), { read: true }));
  await batch.commit();
};
