/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Preserves layout while content loads, preventing layout shift
 * and giving users a sense of the page structure.
 */

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
    />
  );
}

/** Skeleton for the entity list page — table header + rows */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Bone className="h-7 w-40 mb-2" />
          <Bone className="h-4 w-24" />
        </div>
        <div className="flex gap-3">
          <Bone className="h-9 w-20" />
          <Bone className="h-9 w-20" />
          <Bone className="h-9 w-28" />
        </div>
      </div>
      <Bone className="h-9 w-64 mb-4" />
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 flex gap-6">
          <Bone className="h-4 w-8" />
          <Bone className="h-4 w-32" />
          <Bone className="h-4 w-24" />
          <Bone className="h-4 w-20" />
          <Bone className="h-4 w-16 ml-auto" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-4 flex gap-6 border-t border-border">
            <Bone className="h-4 w-4" />
            <Bone className="h-4 w-40" />
            <Bone className="h-4 w-28" />
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the entity detail page — field grid */
export function DetailSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Bone className="h-4 w-20 mb-2" />
          <Bone className="h-7 w-48" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-16" />
          <Bone className="h-9 w-16" />
        </div>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex px-6 py-4">
            <Bone className="h-4 w-32 shrink-0 mr-12" />
            <Bone className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for create/edit forms — labels + inputs */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-2xl">
      <Bone className="h-4 w-16 mb-2" />
      <Bone className="h-7 w-36 mb-6" />
      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Bone className="h-4 w-24 mb-2" />
            <Bone className="h-10 w-full" />
          </div>
        ))}
        <div className="flex gap-3 pt-4">
          <Bone className="h-10 w-32" />
          <Bone className="h-10 w-20" />
        </div>
      </div>
    </div>
  );
}
