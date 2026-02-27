/**
 * Toast — global notification system powered by Sonner.
 *
 * Wraps Sonner (3KB gzip) while preserving the exact same public API:
 *
 *   - toast("message")        → success variant
 *   - toast.error("message")  → error variant
 *   - toast.info("message")   → info variant
 *   - <ToastProvider>         → wraps <Toaster /> with theme integration
 *   - useToast()              → returns the callable toast function
 *
 * All existing consumers require zero changes.
 */

"use client";

import { Toaster, toast as sonnerToast } from "sonner";
import { createContext, useContext } from "react";

type ToastFn = {
  (message: string): void;
  error: (message: string) => void;
  info: (message: string) => void;
};

function createToastFn(): ToastFn {
  const fn = ((message: string) => {
    sonnerToast.success(message);
  }) as ToastFn;

  fn.error = (message: string) => {
    sonnerToast.error(message);
  };

  fn.info = (message: string) => {
    sonnerToast.info(message);
  };

  return fn;
}

const toastFn = createToastFn();

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          classNames: {
            toast: "!bg-card !text-foreground !border-border !shadow-lg",
            success: "!bg-success !text-success-foreground",
            error: "!bg-destructive !text-destructive-foreground",
            info: "!bg-card !text-foreground !border-border",
          },
        }}
        gap={8}
        visibleToasts={5}
      />
    </ToastContext.Provider>
  );
}

/**
 * Hook to show toasts from any component.
 *
 * @example
 * const toast = useToast();
 * toast("Record saved");
 * toast.error("Something failed");
 * toast.info("3 records selected");
 */
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
