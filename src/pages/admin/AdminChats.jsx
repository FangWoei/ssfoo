// src/pages/admin/AdminChats.jsx
// Admin side of the chat: list of outlet threads (left) + selected
// conversation (right). On mobile it shows one at a time with a back
// button. Adapted from Ladybird for Ssfoo.
import {
  listenAllChats,
  listenMessages,
  markReadByAdmin,
  sendAdminReply,
} from "@/firebase/chat";
import { getAllProducts } from "@/firebase/products";
import { effectivePrice } from "@/utils/promo";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiMessageCircle,
  FiPackage,
  FiSend,
  FiUser,
  FiX,
} from "react-icons/fi";

const fmtTime = (ts) => {
  const d = ts?.toDate?.();
  if (!d) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
};

export default function AdminChats() {
  const [chats, setChats] = useState([]);
  const [selected, setSelected] = useState(null); // outletUid
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attached, setAttached] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [prods, setProds] = useState(null);
  const [loadingProds, setLoadingProds] = useState(false);
  const bottomRef = useRef(null);

  // All threads (realtime)
  useEffect(() => listenAllChats(setChats), []);

  // Selected thread messages (realtime) + mark read
  useEffect(() => {
    if (!selected) return;
    const unsub = listenMessages(selected, setMessages);
    markReadByAdmin(selected).catch(() => {});
    return unsub;
  }, [selected]);

  // Mark read as new messages arrive while viewing + autoscroll
  useEffect(() => {
    if (selected) markReadByAdmin(selected).catch(() => {});
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected]);

  const activeChat = chats.find((c) => c.outletUid === selected);

  const openPicker = async () => {
    setPickerOpen(true);
    if (prods === null && !loadingProds) {
      setLoadingProds(true);
      try {
        const all = await getAllProducts();
        setProds(all.filter((p) => p.status === "active"));
      } catch {
        setProds([]);
      } finally {
        setLoadingProds(false);
      }
    }
  };

  const q = pickerSearch.toLowerCase();
  const pickerList = (prods || [])
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.itemCode?.toLowerCase().includes(q),
    )
    .slice(0, 40);
  const unreadCount = chats.filter((c) => c.unreadByAdmin).length;

  const handleSend = async () => {
    const t = text.trim();
    if ((!t && !attached) || sending || !selected) return;
    setSending(true);
    try {
      await sendAdminReply(selected, { text: t, product: attached });
      setText("");
      setAttached(null);
    } catch (e) {
      console.error("Reply failed:", e);
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
          Chats
        </h1>
        <p className="text-dark-400 text-sm">
          {chats.length} conversation{chats.length !== 1 ? "s" : ""}
          {unreadCount > 0 && (
            <span className="ml-1.5 text-primary-600 dark:text-primary-400 font-semibold">
              · {unreadCount} unread
            </span>
          )}
        </p>
      </div>

      <div
        className="bg-white dark:bg-dark-900 rounded-2xl border border-dark-100 dark:border-dark-800 overflow-hidden"
        style={{
          display: "flex",
          height: "calc(100vh - 180px)",
          minHeight: "420px",
        }}>
        {/* ── Thread list ── */}
        <div
          className={`${selected ? "hidden md:flex" : "flex"} flex-col border-r border-dark-100 dark:border-dark-800`}
          style={{
            width: "100%",
            maxWidth: "320px",
            minWidth: 0,
            flex: "0 0 auto",
          }}>
          <div className="px-4 py-3 border-b border-dark-100 dark:border-dark-800 shrink-0">
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Outlets
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-6 text-center text-sm text-dark-400">
                <FiMessageCircle
                  size={28}
                  className="mx-auto mb-2 text-dark-300"
                />
                No conversations yet. Outlets can message you from the shop.
              </div>
            ) : (
              chats.map((c) => (
                <button
                  key={c.outletUid}
                  onClick={() => setSelected(c.outletUid)}
                  className={`w-full text-left px-4 py-3 border-b border-dark-50 dark:border-dark-800/60 transition-colors ${
                    selected === c.outletUid
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "hover:bg-dark-50 dark:hover:bg-dark-800/50"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                      <FiUser size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${
                            c.unreadByAdmin
                              ? "font-bold text-dark-900 dark:text-dark-100"
                              : "font-medium text-dark-700 dark:text-dark-300"
                          }`}
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                          {c.outletName || c.outletId || "Outlet"}
                        </p>
                        <span className="text-[10px] text-dark-400 shrink-0">
                          {fmtTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`text-xs flex-1 ${
                            c.unreadByAdmin
                              ? "text-dark-700 dark:text-dark-200 font-medium"
                              : "text-dark-400"
                          }`}
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                          {typeof c.lastMessage === "string"
                            ? c.lastMessage
                            : c.lastMessage?.text ||
                              (c.lastMessage?.product
                                ? `📦 ${c.lastMessage.product.itemCode || c.lastMessage.product.name || "Product"}`
                                : "")}
                        </p>
                        {c.unreadByAdmin && (
                          <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Conversation ── */}
        <div
          className={`${selected ? "flex" : "hidden md:flex"} flex-col`}
          style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-dark-400 gap-2">
              <FiMessageCircle size={36} className="text-dark-300" />
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-dark-100 dark:border-dark-800 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden p-1.5 rounded-lg text-dark-500 hover:bg-dark-50 dark:hover:bg-dark-800">
                  <FiArrowLeft size={16} />
                </button>
                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <FiUser size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p className="text-sm font-bold text-dark-900 dark:text-dark-100 truncate">
                    {activeChat.outletName || "Outlet"}
                  </p>
                  {activeChat.outletId && (
                    <p className="text-[11px] font-mono text-dark-400 truncate">
                      {activeChat.outletId}
                    </p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-4 py-3 bg-dark-50/50 dark:bg-dark-950/40"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}>
                {messages.map((m) => {
                  const mine = m.senderRole === "admin";
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "75%",
                      }}>
                      <div
                        className={`rounded-2xl text-sm overflow-hidden ${
                          mine
                            ? "bg-primary-600 text-white rounded-br-md"
                            : "bg-white dark:bg-dark-800 text-dark-800 dark:text-dark-200 border border-dark-100 dark:border-dark-700 rounded-bl-md"
                        }`}>
                        {m.product && (
                          <div className="flex items-center gap-2.5 p-2 bg-dark-50 dark:bg-dark-900">
                            {m.product.image ? (
                              <img
                                src={m.product.image}
                                alt=""
                                className="w-12 h-12 rounded-lg bg-white shrink-0"
                                style={{ objectFit: "contain" }}
                              />
                            ) : (
                              <span className="w-12 h-12 rounded-lg bg-dark-100 dark:bg-dark-800 flex items-center justify-center shrink-0">
                                📦
                              </span>
                            )}
                            <div style={{ minWidth: 0 }}>
                              {m.product.itemCode && (
                                <p className="text-[11px] font-mono font-bold text-primary-600 dark:text-primary-400 truncate">
                                  {m.product.itemCode}
                                </p>
                              )}
                              <p className="text-xs font-semibold text-dark-900 dark:text-dark-100 truncate">
                                {m.product.name}
                              </p>
                              {m.product.price > 0 && (
                                <p className="text-[11px] text-dark-500 dark:text-dark-400">
                                  RM {Number(m.product.price).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {m.text && (
                          <p className="px-3 py-2 whitespace-pre-wrap break-words">
                            {typeof m.text === "string"
                              ? m.text
                              : m.text?.text || ""}
                          </p>
                        )}
                      </div>
                      <p
                        className={`text-[10px] text-dark-400 mt-0.5 ${
                          mine ? "text-right" : ""
                        }`}>
                        {fmtTime(m.createdAt)}
                      </p>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Attached product preview */}
              {attached && (
                <div className="px-3 pt-2 shrink-0">
                  <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/60 rounded-xl px-2.5 py-1.5">
                    {attached.image && (
                      <img
                        src={attached.image}
                        alt=""
                        className="w-8 h-8 rounded-lg bg-white shrink-0"
                        style={{ objectFit: "contain" }}
                      />
                    )}
                    <p
                      className="text-xs font-medium text-dark-800 dark:text-dark-200 flex-1 truncate"
                      style={{ minWidth: 0 }}>
                      {attached.itemCode && (
                        <span className="font-mono font-bold text-primary-600 dark:text-primary-400 mr-1">
                          {attached.itemCode}
                        </span>
                      )}
                      {attached.name}
                    </p>
                    <button
                      onClick={() => setAttached(null)}
                      className="p-1 rounded-md text-dark-400 hover:text-red-500 shrink-0">
                      <FiX size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-dark-100 dark:border-dark-800 flex items-center gap-2 shrink-0">
                <button
                  onClick={openPicker}
                  title="Send a product"
                  className="w-10 h-10 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500 hover:text-primary-600 flex items-center justify-center shrink-0 transition-colors">
                  <FiPackage size={16} />
                </button>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Reply to ${activeChat.outletName || "outlet"}…`}
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors"
                  style={{ minWidth: 0 }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || (!text.trim() && !attached)}
                  className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors">
                  <FiSend size={16} />
                </button>
              </div>

              {/* ── Product picker overlay ── */}
              {pickerOpen && (
                <div className="absolute inset-0 z-10 bg-white dark:bg-dark-900 flex flex-col">
                  <div className="px-4 py-3 border-b border-dark-100 dark:border-dark-800 flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPickerOpen(false)}
                      className="p-1.5 rounded-lg text-dark-500 hover:bg-dark-50 dark:hover:bg-dark-800">
                      <FiX size={16} />
                    </button>
                    <p className="font-bold text-sm text-dark-900 dark:text-dark-100">
                      Send a product to {activeChat?.outletName || "outlet"}
                    </p>
                  </div>
                  <div className="p-3 shrink-0">
                    <input
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search name or item code…"
                      autoFocus
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pb-2">
                    {loadingProds ? (
                      <p className="text-xs text-dark-400 text-center py-6">
                        Loading products…
                      </p>
                    ) : pickerList.length === 0 ? (
                      <p className="text-xs text-dark-400 text-center py-6">
                        No products found
                      </p>
                    ) : (
                      pickerList.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setAttached({
                              id: p.id,
                              itemCode: p.itemCode || "",
                              name: p.name,
                              image: p.images?.[0] || "",
                              price: effectivePrice(p),
                            });
                            setPickerOpen(false);
                            setPickerSearch("");
                          }}
                          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left transition-colors">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt=""
                              className="w-10 h-10 rounded-lg bg-white border border-dark-100 dark:border-dark-700 shrink-0"
                              style={{ objectFit: "contain" }}
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-lg bg-dark-100 dark:bg-dark-800 flex items-center justify-center shrink-0">
                              📦
                            </span>
                          )}
                          <span style={{ minWidth: 0, flex: 1 }}>
                            {p.itemCode && (
                              <span className="block text-[10px] font-mono font-bold text-primary-600 dark:text-primary-400 truncate">
                                {p.itemCode}
                              </span>
                            )}
                            <span className="block text-xs font-medium text-dark-800 dark:text-dark-200 truncate">
                              {p.name}
                            </span>
                          </span>
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400 shrink-0">
                            RM {effectivePrice(p).toFixed(2)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
