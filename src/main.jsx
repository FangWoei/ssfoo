// src/main.jsx
import { ThemeProvider } from "@/context/ThemeContext";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import toast, { Toaster } from "react-hot-toast";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              padding: "10px 12px",
              paddingRight: "8px",
            },
          }}>
          {(t) => (
            <div
              style={{
                ...t.style,
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: t.visible ? 1 : 0,
                transition: "opacity 200ms",
                animation:
                  t.visible && (t.pauseDuration ?? 0) === 0
                    ? "toast-in 250ms ease"
                    : undefined,
                background:
                  t.type === "error"
                    ? "#ef4444"
                    : t.type === "success"
                      ? "#10b981"
                      : "#334155",
                color: "white",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}>
              {/* Icon (kept from default resolver) */}
              <span style={{ fontSize: 16, display: "flex" }}>
                {t.type === "error" ? "❌" : t.type === "success" ? "✓" : "•"}
              </span>
              {/* Message */}
              <span style={{ flex: 1, lineHeight: 1.4 }}>
                {typeof t.message === "function" ? t.message(t) : t.message}
              </span>
              {/* Close button */}
              <button
                onClick={() => toast.dismiss(t.id)}
                aria-label="Close"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0,
                  lineHeight: 1,
                }}>
                ✕
              </button>
            </div>
          )}
        </Toaster>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
