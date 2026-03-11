/**
 * Form Draft Persistence
 *
 * Saves form data to localStorage on every change so that
 * accidental navigation or browser crashes don't lose input.
 * Drafts are keyed by a unique identifier (e.g., "contacts/new").
 * Cleared on successful submission.
 */

import { useEffect, useCallback, useRef } from "react";

const DRAFT_PREFIX = "metasaas:draft:";

/**
 * Persists form data to localStorage and restores it on mount.
 *
 * @param draftKey - Unique key for this form (e.g., "contacts/new" or "contacts/uuid/edit")
 * @param formData - Current form state
 * @param setFormData - Setter for form state (called with restored draft on mount)
 * @param enabled - Whether drafts should be active (disabled during initial load)
 */
export function useFormDraft(
  draftKey: string,
  formData: Record<string, string>,
  setFormData: (data: Record<string, string>) => void,
  enabled: boolean
) {
  const storageKey = `${DRAFT_PREFIX}${draftKey}`;
  const hasRestored = useRef(false);

  // Restore draft on mount (only once, after form has loaded defaults)
  useEffect(() => {
    if (!enabled || hasRestored.current) return;
    hasRestored.current = true;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        // Merge: only restore fields that have values in the draft
        const merged = { ...formData };
        let hasDraftData = false;
        for (const [key, value] of Object.entries(parsed)) {
          if (value && key in merged) {
            merged[key] = value;
            hasDraftData = true;
          }
        }
        if (hasDraftData) {
          setFormData(merged);
        }
      }
    } catch {
      // Ignore corrupt drafts
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save draft on every change (debounced via the React render cycle)
  useEffect(() => {
    if (!enabled) return;

    // Only save if there's actual form content
    const hasContent = Object.values(formData).some((v) => v !== "");
    if (hasContent) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(formData));
      } catch {
        // localStorage full or unavailable — non-critical
      }
    }
  }, [formData, storageKey, enabled]);

  /** Clear the draft — call on successful submission */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // non-critical
    }
  }, [storageKey]);

  return { clearDraft };
}
