/**
 * UI Polish Components — Test Suite
 *
 * Validates the Toast, ConfirmDialog, Skeleton, EmptyState, and CopyButton.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  ToastProvider,
  useToast,
  ConfirmDialog,
  ListSkeleton,
  DetailSkeleton,
  FormSkeleton,
  EmptyState,
  CopyButton,
} from "@metasaas/ui";

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function ToastTestHarness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast("Success message")}>Show Toast</button>
      <button onClick={() => toast.error("Error message")}>Show Error</button>
      <button onClick={() => toast.info("Info message")}>Show Info</button>
    </div>
  );
}

describe("Toast", () => {
  it("renders a success toast when triggered", () => {
    render(
      <ToastProvider>
        <ToastTestHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Success message")).toBeDefined();
  });

  it("renders an error toast when triggered", () => {
    render(
      <ToastProvider>
        <ToastTestHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Error"));
    expect(screen.getByText("Error message")).toBeDefined();
  });

  it("renders an info toast when triggered", () => {
    render(
      <ToastProvider>
        <ToastTestHarness />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Info"));
    expect(screen.getByText("Info message")).toBeDefined();
  });

  it("throws if useToast is used outside provider", () => {
    function Bad() { useToast(); return null; }
    expect(() => render(<Bad />)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

describe("ConfirmDialog", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Delete"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders title and message when open", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete record"
        message="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("Delete record")).toBeDefined();
    expect(screen.getByText("This cannot be undone.")).toBeDefined();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        message="Sure?"
        confirmLabel="Yes, delete"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Yes, delete"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        message="Sure?"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete"
        message="Sure?"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses danger variant styling", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Remove item"
        message="Sure?"
        confirmLabel="Yes, remove"
        variant="danger"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    const btn = screen.getByText("Yes, remove");
    expect(btn.className).toContain("destructive");
  });
});

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

describe("Skeletons", () => {
  it("ListSkeleton renders without crashing", () => {
    const { container } = render(<ListSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("ListSkeleton respects row count", () => {
    const { container } = render(<ListSkeleton rows={3} />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(3);
  });

  it("DetailSkeleton renders without crashing", () => {
    const { container } = render(<DetailSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("FormSkeleton renders without crashing", () => {
    const { container } = render(<FormSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No tasks yet"
        description="Create your first task to get started."
      />
    );
    expect(screen.getByText("No tasks yet")).toBeDefined();
    expect(screen.getByText("Create your first task to get started.")).toBeDefined();
  });

  it("renders action link when actionHref is provided", () => {
    render(
      <EmptyState
        title="No tasks"
        actionLabel="Create task"
        actionHref="/tasks/new"
      />
    );
    const link = screen.getByText("Create task");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/tasks/new");
  });

  it("renders action button when onAction is provided", () => {
    const onAction = vi.fn();
    render(
      <EmptyState title="No tasks" actionLabel="Create task" onAction={onAction} />
    );
    fireEvent.click(screen.getByText("Create task"));
    expect(onAction).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

describe("CopyButton", () => {
  it("renders the value as text", () => {
    render(<CopyButton value="abc-123" />);
    expect(screen.getByText(/abc-123/)).toBeDefined();
  });

  it("renders custom label when provided", () => {
    render(<CopyButton value="abc-123" label="Copy ID" />);
    expect(screen.getByText(/Copy ID/)).toBeDefined();
  });

  it("copies to clipboard on click", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWrite },
    });

    render(<CopyButton value="test-value" />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Click to copy"));
    });

    expect(mockWrite).toHaveBeenCalledWith("test-value");
  });
});
