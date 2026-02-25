/**
 * EmptyState — shown when a list has no records.
 *
 * Includes an icon, message, and a primary CTA.
 * Much more inviting than a plain text "No records yet."
 */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="text-center py-16 border border-dashed border-border rounded-lg">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1" />
          <path d="M22 22l-5-10-5 10M15 17h4" />
        </svg>
      </div>
      <p className="text-foreground font-medium mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
          {description}
        </p>
      )}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </a>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
