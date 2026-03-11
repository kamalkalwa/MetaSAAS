/**
 * useFormDraft Hook — Test Suite
 *
 * Validates localStorage-based form draft persistence:
 *   - Restores saved drafts on mount when enabled
 *   - Saves form data to localStorage on changes
 *   - clearDraft removes the stored entry
 *   - Does nothing when disabled
 *   - Handles corrupt/invalid JSON gracefully
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormDraft } from "./use-form-draft";

const STORAGE_PREFIX = "metasaas:draft:";

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFormDraft", () => {
  it("restores saved draft from localStorage on mount", () => {
    const draft = { name: "Alice", email: "alice@test.com" };
    localStorageMock.setItem(STORAGE_PREFIX + "contacts/new", JSON.stringify(draft));

    const setFormData = vi.fn();

    renderHook(() =>
      useFormDraft("contacts/new", { name: "", email: "" }, setFormData, true)
    );

    expect(localStorageMock.getItem).toHaveBeenCalledWith(STORAGE_PREFIX + "contacts/new");
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Alice", email: "alice@test.com" })
    );
  });

  it("saves formData to localStorage when it changes", () => {
    const formData = { name: "Bob", email: "bob@test.com" };

    renderHook(() =>
      useFormDraft("contacts/new", formData, vi.fn(), true)
    );

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_PREFIX + "contacts/new",
      JSON.stringify(formData)
    );
  });

  it("does not save when all values are empty strings", () => {
    const formData = { name: "", email: "" };

    renderHook(() =>
      useFormDraft("contacts/new", formData, vi.fn(), true)
    );

    // setItem should not be called with the draft key for empty data
    const draftSetCalls = localStorageMock.setItem.mock.calls.filter(
      ([key]: [string]) => key === STORAGE_PREFIX + "contacts/new"
    );
    expect(draftSetCalls).toHaveLength(0);
  });

  it("clearDraft removes the entry from localStorage", () => {
    localStorageMock.setItem(STORAGE_PREFIX + "contacts/new", JSON.stringify({ name: "Test" }));

    const { result } = renderHook(() =>
      useFormDraft("contacts/new", { name: "Test" }, vi.fn(), true)
    );

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_PREFIX + "contacts/new");
  });

  it("does nothing when enabled is false", () => {
    localStorageMock.setItem(STORAGE_PREFIX + "contacts/new", JSON.stringify({ name: "Draft" }));
    const setFormData = vi.fn();

    renderHook(() =>
      useFormDraft("contacts/new", { name: "Current" }, setFormData, false)
    );

    // Should not restore draft
    expect(setFormData).not.toHaveBeenCalled();
  });

  it("handles corrupt/invalid JSON in localStorage gracefully", () => {
    localStorageMock.setItem(STORAGE_PREFIX + "contacts/new", "not-valid-json{{{");
    const setFormData = vi.fn();

    // Should not throw
    renderHook(() =>
      useFormDraft("contacts/new", { name: "", email: "" }, setFormData, true)
    );

    // setFormData should not be called with corrupt data
    expect(setFormData).not.toHaveBeenCalled();
  });

  it("only restores fields that exist in the initial formData", () => {
    const draft = { name: "Alice", unknown_field: "should be ignored" };
    localStorageMock.setItem(STORAGE_PREFIX + "contacts/new", JSON.stringify(draft));

    const setFormData = vi.fn();

    renderHook(() =>
      useFormDraft("contacts/new", { name: "", email: "" }, setFormData, true)
    );

    // Should restore only the 'name' field that exists in formData
    const calledWith = setFormData.mock.calls[0][0];
    expect(calledWith.name).toBe("Alice");
    expect(calledWith.email).toBe("");
    expect(calledWith).not.toHaveProperty("unknown_field");
  });
});
