import { useCallback } from "react";

export default function useFormKeyboard() {
  const handleKeyDown = useCallback((e) => {
    const { key, target, shiftKey } = e;

    // Get all focusable form elements in the form
    const form = target.closest("form") || document.querySelector("form");
    if (!form) return;

    const focusable = Array.from(
      form.querySelectorAll(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
      ),
    ).filter((el) => el.offsetParent !== null); // only visible elements

    const currentIndex = focusable.indexOf(target);
    if (currentIndex === -1) return;

    let nextIndex = null;

    if (
      key === "Enter" &&
      target.tagName !== "TEXTAREA" &&
      target.type !== "submit"
    ) {
      e.preventDefault();
      nextIndex = shiftKey ? currentIndex - 1 : currentIndex + 1;
    }

    if (
      key === "ArrowDown" &&
      (target.tagName === "INPUT" || target.tagName === "SELECT")
    ) {
      e.preventDefault();
      nextIndex = currentIndex + 1;
    }

    if (
      key === "ArrowUp" &&
      (target.tagName === "INPUT" || target.tagName === "SELECT")
    ) {
      e.preventDefault();
      nextIndex = currentIndex - 1;
    }

    if (
      key === "ArrowRight" &&
      target.tagName === "INPUT" &&
      target.type !== "text" &&
      target.type !== "email" &&
      target.type !== "password" &&
      target.type !== "number"
    ) {
      e.preventDefault();
      nextIndex = currentIndex + 1;
    }

    if (
      key === "ArrowLeft" &&
      target.tagName === "INPUT" &&
      target.type !== "text" &&
      target.type !== "email" &&
      target.type !== "password" &&
      target.type !== "number"
    ) {
      e.preventDefault();
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== null) {
      const next = focusable[nextIndex];
      if (next) {
        next.focus();
        // Select text if it's an input for easy overwriting
        if (
          next.tagName === "INPUT" &&
          next.type !== "checkbox" &&
          next.type !== "radio"
        ) {
          next.select();
        }
      }
    }
  }, []);

  return { handleKeyDown };
}
