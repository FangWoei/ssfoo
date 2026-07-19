// src/components/common/EnterToNext.jsx
// Pressing Enter in any text/number input moves focus to the next
// field instead of submitting (arrow keys can't be used because they
// change values in number inputs). On the LAST field of a form,
// Enter falls through to the default behavior (submit).
// Mount once in App: <EnterToNext />
import { useEffect } from "react";

const SKIP_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "button",
  "submit",
  "hidden",
  "range",
  "color",
]);

export default function EnterToNext() {
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;

      const t = e.target;
      // Only plain inputs — textareas keep Enter for new lines,
      // selects/buttons keep their native behavior
      if (!(t instanceof HTMLInputElement)) return;
      if (SKIP_TYPES.has(t.type)) return;

      // All focusable form fields currently visible, in DOM order
      const fields = Array.from(
        document.querySelectorAll("input, select, textarea"),
      ).filter(
        (el) =>
          !el.disabled &&
          el.type !== "hidden" &&
          !SKIP_TYPES.has(el.type) &&
          el.offsetParent !== null, // visible
      );

      const idx = fields.indexOf(t);
      if (idx === -1) return;

      // Prefer the next field inside the SAME form (or same modal/page
      // region); fall back to next field on the page
      const next = fields[idx + 1];
      if (next) {
        e.preventDefault();
        next.focus();
        if (typeof next.select === "function") {
          try {
            next.select();
          } catch {
            /* selects/textareas may not support it */
          }
        }
      }
      // No next field → allow default (e.g. submit the login form)
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return null;
}
