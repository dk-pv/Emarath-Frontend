"use client";

import { useEffect, useMemo, useState } from "react";
import {
  checkLeadDuplicates,
  type DuplicateCheckResult,
} from "@/services/leads-service";

/** The import's own floor for a phone number; anything shorter cannot be a real number yet. */
const MIN_PHONE_DIGITS = 7;
const DEBOUNCE_MS = 600;
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Contact = {
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
};

/**
 * Asks the server which existing leads the enquiry being typed would duplicate (ADR-0092).
 *
 * It asks only once a value looks complete — a phone of at least seven digits, or something
 * shaped like an email — and only after the user has paused typing, so a keystroke is not a
 * request; a newer value cancels the older request. It never gates anything: a failed or
 * slow check leaves the form exactly as it was, and the server applies Duplicate Settings
 * when the lead is saved regardless of what was shown here.
 */
export function useDuplicateCheck({
  enabled,
  primaryPhone,
  secondaryPhone,
  email,
}: {
  enabled: boolean;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
}): DuplicateCheckResult | null {
  const contact = useMemo<Contact>(() => {
    const phone = primaryPhone.trim();
    const second = secondaryPhone.trim();
    const mail = email.trim();
    return {
      ...(phone.length >= MIN_PHONE_DIGITS ? { primaryPhone: phone } : {}),
      ...(second.length >= MIN_PHONE_DIGITS ? { secondaryPhone: second } : {}),
      ...(LOOKS_LIKE_EMAIL.test(mail) ? { email: mail } : {}),
    };
  }, [primaryPhone, secondaryPhone, email]);

  const key = JSON.stringify(contact);
  const usable = enabled && Object.keys(contact).length > 0;
  const [answer, setAnswer] = useState<{
    key: string;
    result: DuplicateCheckResult;
  } | null>(null);

  useEffect(() => {
    if (!usable) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkLeadDuplicates(contact, controller.signal)
        .then((result) => setAnswer({ key, result }))
        .catch(() => {
          /* a warning that cannot be fetched is simply not shown */
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [usable, key, contact]);

  // Tagged with the values it answers, so an old answer never describes newer input.
  return usable && answer?.key === key ? answer.result : null;
}
