// src/components/chat/ImageLightbox.jsx
// Full-screen viewer for chat images. Click a thumbnail to open;
// supports left/right arrows (keyboard + on-screen) when a message
// has more than one photo, Esc / backdrop click / X to close.
import { useEffect } from "react";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

export default function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}) {
  const count = images?.length || 0;

  useEffect(() => {
    if (!count) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && count > 1) {
        onIndexChange((index + 1) % count);
      }
      if (e.key === "ArrowLeft" && count > 1) {
        onIndexChange((index - 1 + count) % count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, index, onClose, onIndexChange]);

  if (!count) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}>
      <button
        onClick={onClose}
        title="Close"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
        <FiX size={20} />
      </button>

      {count > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + count) % count);
          }}
          title="Previous"
          className="absolute left-2 md:left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
          <FiChevronLeft size={24} />
        </button>
      )}

      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] rounded-lg"
        style={{ objectFit: "contain" }}
      />

      {count > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % count);
          }}
          title="Next"
          className="absolute right-2 md:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
          <FiChevronRight size={24} />
        </button>
      )}

      {count > 1 && (
        <p className="absolute bottom-5 text-xs text-white/70 tracking-wide">
          {index + 1} / {count}
        </p>
      )}
    </div>
  );
}
