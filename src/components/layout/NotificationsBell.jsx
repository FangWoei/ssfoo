// src/components/layout/NotificationsBell.jsx
// Outlet notifications dropdown for the navbar.
// Realtime unread badge + list of latest 30. Click a notification
// → mark read → jump to /shop with a search prefill so the product
// is easy to find.
import { useAuth } from "@/context/AuthContext";
import {
  listenMyNotifications,
  markAllRead,
  markNotificationRead,
} from "@/firebase/notifications";
import { useEffect, useRef, useState } from "react";
import { FiBell, FiPackage } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const fmtWhen = (ts) => {
  const d = ts?.toDate?.();
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
};

export default function NotificationsBell() {
  const { user, isOutlet } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    return listenMyNotifications(user.uid, setItems);
  }, [user?.uid]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user?.uid) return null;

  const unread = items.filter((n) => !n.read).length;

  const openNotif = async (n) => {
    setOpen(false);
    markNotificationRead(n.id); // fire-and-forget
    if (n.type === "restock") {
      const q = n.itemCode || n.productName || "";
      navigate(`/shop?highlight=${encodeURIComponent(q)}`);
    } else if (n.type === "new_order") {
      navigate(`/admin/orders/${n.orderId}`);
    } else if (n.type === "chat_message") {
      navigate("/admin/chats");
    } else if (n.type === "chat_reply") {
      // Outlet: just go to shop where the chat widget lives
      navigate("/shop");
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl text-dark-500 dark:text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition-colors"
        title="Notifications">
        <FiBell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-dark-900">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl shadow-xl overflow-hidden z-50"
          style={{ width: "min(360px, calc(100vw - 2rem))" }}>
          <div className="px-4 py-3 border-b border-dark-100 dark:border-dark-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-dark-900 dark:text-dark-100">
                Notifications
              </p>
              {unread > 0 && (
                <p className="text-[11px] text-primary-600 dark:text-primary-400">
                  {unread} unread
                </p>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllRead(user.uid, items)}
                className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-dark-400">
                <FiBell size={24} className="mx-auto mb-2 text-dark-300" />
                No notifications yet
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotif(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-dark-50 dark:border-dark-800/60 last:border-b-0 hover:bg-dark-50 dark:hover:bg-dark-800/50 transition-colors ${
                    !n.read ? "bg-primary-50/50 dark:bg-primary-900/10" : ""
                  }`}>
                  {n.productImage ? (
                    <img
                      src={n.productImage}
                      alt=""
                      className="w-11 h-11 rounded-lg bg-white border border-dark-100 dark:border-dark-700 shrink-0"
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center shrink-0">
                      {n.type === "new_order" ? (
                        "🛒"
                      ) : n.type === "chat_message" ||
                        n.type === "chat_reply" ? (
                        "💬"
                      ) : (
                        <FiPackage size={18} />
                      )}
                    </span>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                      {n.type === "new_order"
                        ? "🛒 New order received"
                        : n.type === "chat_message"
                          ? "💬 New message"
                          : n.type === "chat_reply"
                            ? "💬 New reply from admin"
                            : "🎉 Back in stock"}
                    </p>
                    <p
                      className="text-xs text-dark-600 dark:text-dark-300 truncate"
                      style={{ minWidth: 0 }}>
                      {n.type === "new_order" ? (
                        <>
                          <span className="font-semibold">
                            {n.outletName || n.outletId}
                          </span>
                          {" · "}
                          {n.itemCount || 0} item
                          {(n.itemCount || 0) !== 1 ? "s" : ""}
                          {" · "}
                          <span className="font-bold text-primary-600 dark:text-primary-400">
                            RM {Number(n.total || 0).toFixed(2)}
                          </span>
                        </>
                      ) : n.type === "chat_message" ? (
                        <>
                          <span className="font-semibold">
                            {n.outletName || n.outletId}
                          </span>
                          {": "}
                          {n.preview}
                        </>
                      ) : n.type === "chat_reply" ? (
                        <>{n.preview}</>
                      ) : (
                        <>
                          {n.itemCode && (
                            <span className="font-mono font-bold text-primary-600 dark:text-primary-400 mr-1">
                              {n.itemCode}
                            </span>
                          )}
                          {n.productName}
                        </>
                      )}
                    </p>
                    <p className="text-[10px] text-dark-400 mt-0.5">
                      {fmtWhen(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
  