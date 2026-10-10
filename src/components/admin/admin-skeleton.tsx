import { Skeleton } from "@/components/ui/skeleton";

export function AdminSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-52 rounded-xl" />
    </div>
  );
}
