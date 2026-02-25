/**
 * CopyButton — click-to-copy inline button for field values and IDs.
 *
 * Shows a brief "Copied!" confirmation, then reverts.
 */

import { useState, useCallback } from "react";

interface CopyButtonProps {
  value: string;
  className?: string;
  /** Text to display. If omitted, shows the value itself. */
  label?: string;
}

export function CopyButton({ value, className = "", label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the text for manual copy
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      title={copied ? "Copied!" : "Click to copy"}
      className={`inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {label ?? value}
      <span className="text-[10px] shrink-0">
        {copied ? "✓" : "⎘"}
      </span>
    </button>
  );
}
