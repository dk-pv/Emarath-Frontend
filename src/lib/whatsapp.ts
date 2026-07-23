/**
 * A `wa.me` deep-link from a stored phone number (LEAD-10.2, KAN-03.1).
 *
 * Digits only: a stored phone may carry spaces, dashes or a leading `+`, none of
 * which belong in the path. Returns `null` when nothing dialable remains, so the
 * caller can disable the control rather than open a broken link.
 */
export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
