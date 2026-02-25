/**
 * Pagination — offset-based page navigation for list views.
 *
 * Shows: "Showing 1–25 of 142 records" with Previous / Next buttons
 * and numbered page links for direct access (up to 7 visible pages).
 */

interface PaginationProps {
  /** Current page (1-indexed) */
  page: number;
  /** Records per page */
  pageSize: number;
  /** Total record count from the API */
  total: number;
  /** Called when the user selects a different page */
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total <= pageSize) return null;

  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-muted-foreground">
        Showing {start}–{end} of {total} records
      </span>

      <div className="flex items-center gap-1">
        <PageButton
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          label="Previous"
        />

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[2rem] h-8 rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          )
        )}

        <PageButton
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          label="Next"
        />
      </div>
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="px-3 h-8 rounded-md text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}

/**
 * Builds an array of page numbers to display, with ellipsis ("...")
 * for gaps. Always shows first page, last page, and a window of
 * pages around the current page.
 *
 * Examples (7 max visible):
 *   page=1,  total=10 → [1, 2, 3, 4, 5, "...", 10]
 *   page=5,  total=10 → [1, "...", 4, 5, 6, "...", 10]
 *   page=10, total=10 → [1, "...", 6, 7, 8, 9, 10]
 */
export function buildPageNumbers(
  current: number,
  totalPages: number
): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  pages.push(1);

  if (current > 3) pages.push("...");

  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(totalPages - 1, current + 1);

  for (let i = windowStart; i <= windowEnd; i++) {
    pages.push(i);
  }

  if (current < totalPages - 2) pages.push("...");

  pages.push(totalPages);

  return pages;
}
