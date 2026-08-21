// src/components/chat/ChatWidget.jsx
// Floating chat bubble for OUTLETS — talks to the admin only.
// Mount once in the outlet Layout: <ChatWidget />
// (Renders nothing for admins or logged-out users.)
import { useAuth } from "@/context/AuthContext";
import {
  listenMessages,
  listenUserUnread,
  markReadByUser,
  sendMessage,
} from "@/firebase/chat";
import { getAllProductsCached } from "@/firebase/products";
import { uploadImage } from "@/firebase/storage";
import useStagedChatImages, {
  MAX_CHAT_IMAGES,
} from "@/hooks/useStagedChatImages";
import { effectivePrice } from "@/utils/promo";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiImage,
  FiMessageCircle,
  FiPackage,
  FiSend,
  FiX,
} from "react-icons/fi";
import ChatImageGrid from "./ChatImageGrid";
import ImageLightbox from "./ImageLightbox";

const MAX_IMAGES = MAX_CHAT_IMAGES;

const fmtTime = (ts) => {
  const d = ts?.toDate?.();
  if (!d) return "";
  return d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
};

export default function ChatWidget() {
  const { user, profile, isOutlet } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(false);
  const [sending, setSending] = useState(false);
  const [attached, setAttached] = useState(null); // product | null
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [prods, setProds] = useState(null); // null = not loaded yet
  const [loadingProds, setLoadingProds] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images, index } | null
  const bottomRef = useRef(null);
  const {
    staged,
    fileInputRef,
    dragOver,
    handleFilesSelected,
    handlePaste,
    handleDrop,
    setDragOver,
    removeStaged,
    clearStaged,
    resolveStagedImages,
  } = useStagedChatImages(MAX_IMAGES);

  const uid = user?.uid;

  const openPicker = async () => {
    setPickerOpen(true);
    if (prods === null && !loadingProds) {
      setLoadingProds(true);
      try {
        const all = await getAllProductsCached();
        setProds(all.filter((p) => p.status === "active"));
      } catch {
        setProds([]);
      } finally {
        setLoadingProds(false);
      }
    }
  };

  // Respect this outlet's brand visibility (same rule as the shop)
  const allowed = profile?.allowedBrands;
  const restricted = Array.isArray(allowed) && allowed.length > 0;
  const visibleProds = (prods || []).filter(
    (p) => !restricted || !p.brand || allowed.includes(p.brand),
  );
  const q = pickerSearch.toLowerCase();
  const pickerList = visibleProds
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.itemCode?.toLowerCase().includes(q),
    )
    .slice(0, 40);

  // "Ask admin about this product" from the shop
  useEffect(() => {
    const onAttach = (e) => {
      setAttached(e.detail || null);
      setOpen(true);
    };
    window.addEventListener("ssfoo:chat-product", onAttach);
    return () => window.removeEventListener("ssfoo:chat-product", onAttach);
  }, []);

  // Unread dot (always listening while logged in)
  useEffect(() => {
    if (!uid || !isOutlet) return;
    return listenUserUnread(uid, setUnread);
  }, [uid, isOutlet]);

  // Messages while open
  useEffect(() => {
    if (!open || !uid) return;
    const unsub = listenMessages(uid, setMessages);
    markReadByUser(uid);
    return unsub;
  }, [open, uid]);

  // Mark read as new messages arrive while open + autoscroll
  useEffect(() => {
    if (open && uid) markReadByUser(uid);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, uid]);

  if (!uid || !isOutlet) return null;

  const handleSend = async () => {
    const t = text.trim();
    if ((!t && !attached && staged.length === 0) || sending) return;
    setSending(true);
    try {
      const images = await resolveStagedImages((file, i) =>
        uploadImage(file, `chat-images/${uid}/${Date.now()}_${i}_${file.name}`),
      );
      await sendMessage(
        uid,
        profile?.outletName || profile?.outletId || "",
        profile?.outletId || "",
        { text: t, product: attached, images },
      );
      clearStaged();
      setText("");
      setAttached(null);
    } catch (e) {
      console.error("Send failed:", e);
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Chat with SSFOO"
        className="fixed z-40 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/30 flex items-center justify-center transition-all"
        style={{ right: "1.25rem", bottom: "1.25rem" }}>
        {open ? <FiX size={22} /> : <FiMessageCircle size={24} />}
        {!open && unread && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white dark:border-dark-950" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed z-40 bg-white dark:bg-dark-900 border border-dark-100 dark:border-dark-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            right: "1.25rem",
            bottom: "5.5rem",
            width: "min(360px, calc(100vw - 2.5rem))",
            height: "min(480px, calc(100vh - 8rem))",
          }}>
          {/* Header */}
          <div className="px-4 py-3 bg-primary-600 text-white shrink-0">
            <p className="font-bold text-sm">SSFOO Support</p>
            <p className="text-[11px] text-primary-100">
              Chat directly with the admin
            </p>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3"
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {messages.length === 0 && (
              <p className="text-xs text-dark-400 text-center my-auto">
                👋 Hi {profile?.outletName || ""}! Send us a message — we'll
                reply here.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.senderRole === "outlet";
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                  }}>
                  <div
                    className={`rounded-2xl text-sm overflow-hidden ${
                      mine
                        ? "bg-primary-600 text-white rounded-br-md"
                        : "bg-dark-100 dark:bg-dark-800 text-dark-800 dark:text-dark-200 rounded-bl-md"
                    }`}>
                    {m.product && (
                      <div
                        className={`flex items-center gap-2 p-2 ${
                          mine
                            ? "bg-primary-700/60"
                            : "bg-white dark:bg-dark-900"
                        }`}>
                        {m.product.image ? (
                          <img
                            src={m.product.image}
                            alt=""
                            className="w-10 h-10 rounded-lg bg-white shrink-0"
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            📦
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          {m.product.itemCode && (
                            <p
                              className={`text-[10px] font-mono font-bold truncate ${
                                mine
                                  ? "text-primary-100"
                                  : "text-primary-600 dark:text-primary-400"
                              }`}>
                              {m.product.itemCode}
                            </p>
                          )}
                          <p className="text-xs font-semibold truncate">
                            {m.product.name}
                          </p>
                        </div>
                      </div>
                    )}
                    {m.images?.length > 0 && (
                      <ChatImageGrid
                        images={m.images}
                        onOpen={(i) =>
                          setLightbox({ images: m.images, index: i })
                        }
                      />
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
            <div className="px-2.5 pt-2 shrink-0">
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

          {/* Staged image previews */}
          {staged.length > 0 && (
            <div className="px-2.5 pt-2 shrink-0 flex gap-1.5 overflow-x-auto">
              {staged.map((s) => (
                <div
                  key={s.id}
                  onClick={() =>
                    setLightbox({
                      images: staged.map((x) => x.preview),
                      index: staged.findIndex((x) => x.id === s.id),
                    })
                  }
                  className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-dark-200 dark:border-dark-700 cursor-pointer">
                  <img
                    src={s.preview}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: "cover" }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStaged(s.id);
                    }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center">
                    <FiX size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`p-2.5 border-t flex items-center gap-2 shrink-0 transition-colors ${
              dragOver
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-dark-100 dark:border-dark-800"
            }`}>
            <button
              onClick={openPicker}
              title="Send a product"
              className="w-10 h-10 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500 hover:text-primary-600 flex items-center justify-center shrink-0 transition-colors">
              <FiPackage size={16} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title={`Send photos (up to ${MAX_IMAGES})`}
              disabled={staged.length >= MAX_IMAGES}
              className="w-10 h-10 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-500 dark:text-dark-400 hover:border-primary-500 hover:text-primary-600 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors">
              <FiImage size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFilesSelected}
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder="Type a message… (Ctrl+V to paste a photo or image link)"
              className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors"
              style={{ minWidth: 0 }}
            />
            <button
              onClick={handleSend}
              disabled={
                sending || (!text.trim() && !attached && staged.length === 0)
              }
              className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors">
              <FiSend size={16} />
            </button>
          </div>

          {/* ── Product picker overlay ── */}
          {pickerOpen && (
            <div className="absolute inset-0 z-10 bg-white dark:bg-dark-900 flex flex-col">
              <div className="px-3 py-2.5 bg-primary-600 text-white flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPickerOpen(false)}
                  className="p-1 rounded-md hover:bg-white/15">
                  <FiX size={16} />
                </button>
                <p className="font-bold text-sm">Send a product</p>
              </div>
              <div className="p-2.5 shrink-0">
                <input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search name or item code…"
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm rounded-xl bg-dark-50 dark:bg-dark-800 border border-transparent focus:border-primary-500 text-dark-900 dark:text-dark-100 outline-none transition-colors"
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
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left transition-colors">
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
        </div>
      )}

      {/* ── Fullscreen image viewer ── */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
        />
      )}
    </>
  );
}
