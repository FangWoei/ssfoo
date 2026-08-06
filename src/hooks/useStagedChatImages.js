// src/hooks/useStagedChatImages.js
// Shared image-staging logic for the chat composer (outlet ChatWidget
// + admin AdminChats). Both used to hand-roll their own copy of this;
// now it lives once here.
//
// Adds AdminProductForm's smarter "add from the web" behaviour: a
// pasted/dropped URL is fetched and checked to make sure it's really
// an image before it's accepted, instead of being trusted blindly.
// If the source blocks cross-origin fetches (CORS), it falls back to
// linking the URL directly, same as AdminProductForm does.
//
// It also unwraps Google Images "imgres" result-page links down to
// the actual image file (see resolveActualImageUrl below) — those
// links are what people usually end up copying from a Google Images
// search, and the page itself isn't an image so it would otherwise
// just render blank.
import { useRef, useState } from "react";
import toast from "react-hot-toast";

export const MAX_CHAT_IMAGES = 5;

let _seq = 0;
const newId = () =>
  `${Date.now()}_${(_seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// A link copied from a Google Images results page looks like
// "https://www.google.com/imgres?...&imgurl=<real image URL>&..."
// — that page itself is HTML, not an image, so <img src> on it just
// renders blank. The real file is sitting in the imgurl param, so
// unwrap it before treating the link as an image.
const resolveActualImageUrl = (rawUrl) => {
  try {
    const u = new URL(rawUrl);
    const isGoogleImages =
      /(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname === "/imgres";
    const imgurl = u.searchParams.get("imgurl");
    if (isGoogleImages && imgurl) return imgurl;
  } catch {
    // not a valid URL — let the caller handle/reject it as-is
  }
  return rawUrl;
};

export default function useStagedChatImages(max = MAX_CHAT_IMAGES) {
  const [staged, setStaged] = useState([]); // [{ id, kind: 'file'|'url', file?, url?, preview }]
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const roomLeft = () => max - staged.length;

  const addFiles = (files) => {
    if (!files.length) return;
    setStaged((prev) => {
      const room = max - prev.length;
      if (room <= 0) {
        toast.error(`Up to ${max} photos per message`);
        return prev;
      }
      if (files.length > room) {
        toast.error(
          `Only ${room} more photo${room !== 1 ? "s" : ""} allowed (max ${max})`,
        );
      }
      const take = files.slice(0, room);
      return [
        ...prev,
        ...take.map((file) => ({
          id: newId(),
          kind: "file",
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
    });
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file later
    addFiles(files);
  };

  // Paste a screenshot / copied image straight into the composer
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      addFiles(files);
      return;
    }
    // pasted a plain image URL as text (or a Google Images result link)
    const txt = e.clipboardData?.getData("text/plain")?.trim();
    if (!txt) return;
    const resolved = resolveActualImageUrl(txt);
    if (/^https?:\/\/.+\.(png|jpe?g|webp|gif|bmp)([?#].*)?$/i.test(resolved)) {
      e.preventDefault();
      addImageFromUrl(resolved);
    }
  };

  // ── Add an image from the web (URL / drag / paste) ──
  // Checks it's actually an image before accepting it; tries to copy
  // it into Firebase Storage via addFiles, and only links it directly
  // if the source blocks the cross-origin fetch.
  const addImageFromUrl = async (rawUrl) => {
    const url = resolveActualImageUrl((rawUrl || "").trim());
    if (!url) return;
    if (roomLeft() <= 0) {
      toast.error(`Up to ${max} photos per message`);
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not an image");
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
      const file = new File([blob], `web-image-${Date.now()}.${ext}`, {
        type: blob.type,
      });
      addFiles([file]);
    } catch {
      // CORS or blocked — link the image directly instead
      setStaged((prev) => {
        if (prev.length >= max) {
          toast.error(`Up to ${max} photos per message`);
          return prev;
        }
        return [...prev, { id: newId(), kind: "url", url, preview: url }];
      });
      toast("🔗 Linked image from the web (couldn't copy it)", {
        duration: 3500,
      });
    }
  };

  const extractDroppedUrl = (dt) => {
    const uri = dt.getData("text/uri-list") || dt.getData("text/plain");
    if (uri && /^(https?:|data:image)/i.test(uri.trim()))
      return uri.trim().split("\n")[0];
    const html = dt.getData("text/html");
    if (html) {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) return m[1];
    }
    return "";
  };

  // Drag a photo (or an image dragged from another tab/site) onto
  // the composer.
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length) return addFiles(files);
    const url = extractDroppedUrl(e.dataTransfer);
    if (!url) return;
    if (url.startsWith("data:image")) {
      fetch(url)
        .then((r) => r.blob())
        .then((b) =>
          addFiles([
            new File([b], `pasted-${Date.now()}.png`, { type: b.type }),
          ]),
        );
    } else {
      addImageFromUrl(url);
    }
  };

  const removeStaged = (id) => {
    setStaged((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.kind === "file") URL.revokeObjectURL(item.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearStaged = () => {
    staged.forEach((s) => {
      if (s.kind === "file") URL.revokeObjectURL(s.preview);
    });
    setStaged([]);
  };

  // At send time: turn staged items into final URLs. `uploadFn(file, i)`
  // should upload one file and resolve to its stored URL.
  const resolveStagedImages = (uploadFn) =>
    Promise.all(
      staged.map((s, i) =>
        s.kind === "url" ? Promise.resolve(s.url) : uploadFn(s.file, i),
      ),
    );

  return {
    staged,
    roomLeft: roomLeft(),
    max,
    fileInputRef,
    dragOver,
    setDragOver,
    addFiles,
    handleFilesSelected,
    handlePaste,
    handleDrop,
    removeStaged,
    clearStaged,
    resolveStagedImages,
  };
}
