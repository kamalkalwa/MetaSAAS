/**
 * Toast — lightweight global notification system.
 *
 * Usage:
 *   1. Render <ToastContainer /> once at the app root
 *   2. Call toast("Record saved") or toast.error("Failed") from anywhere
 *
 * Design:
 *   - Auto-dismisses after 3s (configurable)
 *   - Stacks from bottom-right
 *   - Supports success (default), error, and info variants
 *   - Enter/exit animations via CSS transitions
 *   - Max 5 visible toasts (oldest dismissed first)
 */

import { useState, useEffect, useCallback, createContext, useContext } from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  exiting: boolean;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 3000;
const EXIT_ANIMATION_MS = 200;

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = ++nextId;
    setToasts((prev) => {
      const updated = [...prev, { id, message, variant, exiting: false }];
      if (updated.length > MAX_TOASTS) {
        return updated.slice(updated.length - MAX_TOASTS);
      }
      return updated;
    });

    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, EXIT_ANIMATION_MS);
    }, AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_ANIMATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto max-w-sm px-4 py-3 rounded-lg shadow-lg text-sm font-medium cursor-pointer transition-all duration-200 ${
              t.exiting
                ? "opacity-0 translate-x-4"
                : "opacity-100 translate-x-0"
            } ${variantStyles[t.variant]}`}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0">{variantIcons[t.variant]}</span>
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-success text-success-foreground",
  error: "bg-destructive text-destructive-foreground",
  info: "bg-card text-foreground border border-border",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

/**
 * Hook to show toasts from any component.
 *
 * @example
 * const toast = useToast();
 * toast("Record saved");
 * toast.error("Something failed");
 * toast.info("3 records selected");
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");

  const fn = (message: string) => ctx.addToast(message, "success");
  fn.error = (message: string) => ctx.addToast(message, "error");
  fn.info = (message: string) => ctx.addToast(message, "info");
  return fn;
}
