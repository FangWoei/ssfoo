// src/components/chat/ChatImageGrid.jsx
// Renders 1–5 photos attached to a chat message as a compact grid
// inside the bubble. Tapping a photo opens it in ImageLightbox.
export default function ChatImageGrid({ images, onOpen }) {
  if (!images?.length) return null;
  const cols = images.length === 1 ? 1 : 2;

  return (
    <div
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {images.map((url, i) => (
        <button
          key={i}
          onClick={() => onOpen(i)}
          className="block overflow-hidden bg-dark-100 dark:bg-dark-900"
          style={{ aspectRatio: "1 / 1" }}>
          <img
            src={url}
            alt=""
            className="w-full h-full"
            style={{ objectFit: "cover" }}
          />
        </button>
      ))}
    </div>
  );
}
