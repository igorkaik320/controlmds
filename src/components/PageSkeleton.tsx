import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton mostrado dentro do AppLayout enquanto a página lazy é carregada.
 * Mantém sidebar e header visíveis — sem mais "tela branca".
 */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
