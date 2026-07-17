"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert } from "@/components/ui/Alert";
import type { Tone } from "@/types";

const AUTO_DISMISS_MS = 5000;

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: Tone;
};

type ToastRecord = ToastOptions & { id: string };

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return value;
}

type ToastItemProps = {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { id } = toast;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    // Alert's tone tint is translucent, so it needs an opaque backing to sit over content.
    <div className="pointer-events-auto rounded-surface bg-surface shadow-lg">
      <Alert
        // The region below already announces; a nested live region would double it up.
        role="none"
        tone={toast.tone}
        title={toast.title}
        onDismiss={() => onDismiss(id)}
      >
        {toast.description}
      </Alert>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: (options) =>
        setToasts((current) => [
          ...current,
          { ...options, id: crypto.randomUUID() },
        ]),
    }),
    [],
  );

  return (
    <ToastContext value={value}>
      {children}

      {/* Mounted even when empty: assistive tech only announces insertions into a region it already sees. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-3"
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}
