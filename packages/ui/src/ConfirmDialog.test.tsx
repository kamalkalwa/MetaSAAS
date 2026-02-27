/**
 * ConfirmDialog Tests
 *
 * Tests rendering, confirm/cancel handlers, keyboard shortcuts,
 * and ARIA accessibility attributes.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog.js";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    title: "Delete record?",
    message: "This action cannot be undone.",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} open={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders title and message when open", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Delete record?")).toBeDefined();
    expect(screen.getByText("This action cannot be undone.")).toBeDefined();
  });

  it("renders default button labels", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirm")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    );
    expect(screen.getByText("Yes, delete")).toBeDefined();
    expect(screen.getByText("No, keep it")).toBeDefined();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when backdrop clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    // The backdrop is the outer fixed overlay
    const backdrop = screen.getByRole("alertdialog").parentElement!;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Escape key pressed", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not call onCancel when clicking inside the dialog", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Delete record?"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  describe("ARIA attributes", () => {
    it("has role=alertdialog", () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByRole("alertdialog")).toBeDefined();
    });

    it("has aria-labelledby pointing to title", () => {
      render(<ConfirmDialog {...defaultProps} />);
      const dialog = screen.getByRole("alertdialog");
      expect(dialog.getAttribute("aria-labelledby")).toBe("confirm-dialog-title");
      expect(document.getElementById("confirm-dialog-title")?.textContent).toBe(
        "Delete record?"
      );
    });

    it("has aria-describedby pointing to message", () => {
      render(<ConfirmDialog {...defaultProps} />);
      const dialog = screen.getByRole("alertdialog");
      expect(dialog.getAttribute("aria-describedby")).toBe("confirm-dialog-message");
      expect(document.getElementById("confirm-dialog-message")?.textContent).toBe(
        "This action cannot be undone."
      );
    });
  });

  describe("variants", () => {
    it("renders danger variant with destructive styling", () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />);
      const confirmBtn = screen.getByText("Confirm");
      expect(confirmBtn.className).toContain("bg-destructive");
    });

    it("renders default variant with primary styling", () => {
      render(<ConfirmDialog {...defaultProps} variant="default" />);
      const confirmBtn = screen.getByText("Confirm");
      expect(confirmBtn.className).toContain("bg-primary");
    });
  });
});
