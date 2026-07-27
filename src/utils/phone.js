// src/utils/phone.js
// Utilities for handling Malaysian phone numbers as an alternative
// login credential. Since Firebase Auth requires email+password, we
// synthesize a "pseudo-email" from the phone number for accounts
// that don't have a real email.

const PSEUDO_DOMAIN = "ssfoo.phone";

/**
 * Normalize a Malaysian phone number to a canonical form.
 * Accepts common formats and returns digits-only with 60 country prefix.
 *
 *   012-345 6789     → 60123456789
 *   0123456789       → 60123456789
 *   +60123456789     → 60123456789
 *   60 12 345 6789   → 60123456789
 *
 * Returns "" if the input can't be normalized into a plausible number.
 */
export function normalizePhone(raw) {
  if (!raw) return "";
  // Keep only digits
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";

  // Strip leading zero (local format) — treat as MY prefix
  if (digits.startsWith("0")) {
    digits = "60" + digits.slice(1);
  }
  // If already looks like MY (starts with 60) leave it
  else if (digits.startsWith("60")) {
    // ok
  }
  // Otherwise assume they typed without any prefix — add MY
  else if (digits.length >= 9 && digits.length <= 11) {
    digits = "60" + digits;
  }

  // Sanity: MY mobile numbers are typically 60 + 9-10 digits = 11-12 chars total
  if (digits.length < 10 || digits.length > 13) return "";
  return digits;
}

/**
 * True if the raw input looks phone-shaped (mostly digits) rather than email.
 * Used by login to route the input to the right auth path.
 */
export function looksLikePhone(raw) {
  if (!raw) return false;
  const s = String(raw).trim();
  if (s.includes("@")) return false;
  const digits = s.replace(/\D/g, "");
  // At least 8 digits and mostly digits
  return digits.length >= 8 && digits.length / s.length > 0.5;
}

/**
 * Build the pseudo-email Firebase Auth uses for phone-only accounts.
 * The user never sees this — it's an implementation detail.
 */
export function phoneToPseudoEmail(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  return `${normalized}@${PSEUDO_DOMAIN}`;
}

/**
 * True if a stored email is a pseudo-email (i.e. account was phone-registered).
 * Used to decide whether to send real email notifications.
 */
export function isPseudoEmail(email) {
  if (!email) return false;
  return String(email).endsWith(`@${PSEUDO_DOMAIN}`);
}

/**
 * Pretty-print a stored phone number for the UI.
 * 60123456789 → 012-345 6789
 */
export function formatPhone(phone) {
  const p = normalizePhone(phone);
  if (!p) return "";
  // Turn 60xxxxxxxxx back into 0xxx-xxx xxxx style
  const local = "0" + p.slice(2);
  if (local.length === 10) {
    return `${local.slice(0, 3)}-${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (local.length === 11) {
    return `${local.slice(0, 3)}-${local.slice(3, 7)} ${local.slice(7)}`;
  }
  return local;
}
