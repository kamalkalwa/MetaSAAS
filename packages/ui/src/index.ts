/**
 * @metasaas/ui
 *
 * Shared UI components, utilities, and patterns.
 * Framework-agnostic where possible — Next.js-specific pages stay in apps/web.
 */

// Utilities
export { cn, columnToLabel, formatValue, timeAgo } from "./utils";

// Components
export { FieldInput, type RelationshipOption } from "./FieldInput";
export { SearchFilterBar } from "./SearchFilterBar";
export { BulkActionsBar } from "./BulkActionsBar";
export { ImportModal } from "./ImportModal";
export { DataTable } from "./DataTable";
export { Pagination, buildPageNumbers } from "./Pagination";
export { ToastProvider, useToast } from "./Toast";
export { ConfirmDialog } from "./ConfirmDialog";
export { ListSkeleton, DetailSkeleton, FormSkeleton } from "./Skeleton";
export { EmptyState } from "./EmptyState";
export { CopyButton } from "./CopyButton";
