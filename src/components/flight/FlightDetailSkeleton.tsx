import { Skeleton } from '@/components/ui/skeleton';

export default function FlightDetailSkeleton() {
  return (
    <>
      <div className="relative flex h-80 w-full flex-col md:h-[400px]">
        <div className="container mx-auto flex max-w-4xl items-center justify-between px-4 pt-20">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          <Skeleton className="h-10 w-56 sm:h-12 sm:w-72" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div
        className="container relative z-10 mx-auto max-w-4xl px-4 pb-10"
        role="status"
      >
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="mt-5 flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-3">
            {['items-start', 'items-center', 'items-end'].map((align) => (
              <div key={align} className={`flex flex-col gap-1.5 ${align}`}>
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
