/**
 * Toast Tests
 *
 * Tests the ToastProvider context, useToast hook,
 * and toast function API (success, error, info).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import { ToastProvider, useToast } from "./Toast.js";

// Mock Sonner to verify calls without rendering actual toasts
vi.mock("sonner", () => {
  const success = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  return {
    toast: Object.assign(vi.fn(), { success, error, info }),
    Toaster: ({ children }: any) => <div data-testid="sonner-toaster" />,
  };
});

import { toast as sonnerToast } from "sonner";

describe("ToastProvider", () => {
  it("renders children", () => {
    render(
      <ToastProvider>
        <div data-testid="child">Hello</div>
      </ToastProvider>
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByTestId("child").textContent).toBe("Hello");
  });

  it("renders Sonner Toaster", () => {
    render(
      <ToastProvider>
        <span />
      </ToastProvider>
    );
    expect(screen.getByTestId("sonner-toaster")).toBeDefined();
  });
});

describe("useToast", () => {
  it("throws when used outside ToastProvider", () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow("useToast must be used within <ToastProvider>");
  });

  it("returns a toast function when inside provider", () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });
    expect(typeof result.current).toBe("function");
  });

  it("toast() calls sonner success", () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });
    result.current("Record saved");
    expect(sonnerToast.success).toHaveBeenCalledWith("Record saved");
  });

  it("toast.error() calls sonner error", () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });
    result.current.error("Something failed");
    expect(sonnerToast.error).toHaveBeenCalledWith("Something failed");
  });

  it("toast.info() calls sonner info", () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });
    result.current.info("3 items selected");
    expect(sonnerToast.info).toHaveBeenCalledWith("3 items selected");
  });

  it("has error and info methods on the function", () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
    });
    expect(typeof result.current.error).toBe("function");
    expect(typeof result.current.info).toBe("function");
  });
});
