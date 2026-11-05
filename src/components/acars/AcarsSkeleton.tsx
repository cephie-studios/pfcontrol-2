import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import AcarsWorkspace from './AcarsWorkspace';
import type { useAcarsLayout } from './useAcarsLayout';

function PanelHeaderSkeleton({ action }: { action?: ReactNode }) {
  return (
    <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      {action}
    </div>
  );
}

function FieldRowSkeleton({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2 first:pt-0">
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className={cn('ml-auto h-3.5', value)} />
    </div>
  );
}

const FIELD_VALUES = ['w-14', 'w-12', 'w-12', 'w-8', 'w-10', 'w-12', 'w-16'];

function FlightPlanSkeleton() {
  return (
    <section className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-b border-zinc-800 md:max-h-[60%]">
      <PanelHeaderSkeleton action={<Skeleton className="h-6 w-8" />} />
      <div className="min-h-0 flex-1 overflow-hidden px-5 pb-5">
        {FIELD_VALUES.map((value, index) => (
          <FieldRowSkeleton key={index} value={value} />
        ))}
        <div className="flex flex-col gap-2 py-2 last:pb-0">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-12" />
          </div>
          <Skeleton className="ml-6.5 h-3.5 w-4/5" />
        </div>
      </div>
    </section>
  );
}

function StationsSkeleton() {
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden md:flex-1">
      <PanelHeaderSkeleton />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 pb-5">
        {[3, 2].map((rows, group) => (
          <div key={group} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-12" />
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        ))}
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    </section>
  );
}

const TERMINAL_LINES = [
  ['w-4/5', 'w-2/3'],
  ['w-3/5'],
  ['w-full', 'w-3/4', 'w-1/2'],
  ['w-2/3'],
];

function TerminalSkeleton({
  className,
  style,
}: {
  className: string;
  style: React.CSSProperties;
}) {
  return (
    <section
      style={style}
      className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', className)}
    >
      <PanelHeaderSkeleton
        action={
          <div className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 pt-1">
        {TERMINAL_LINES.map((lines, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="h-3.5 w-12 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {lines.map((width, line) => (
                <Skeleton key={line} className={cn('h-3.5', width)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-800 p-3">
        <Skeleton className="ml-2 h-3.5 w-24" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </section>
  );
}

function NotesSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', className)}
    >
      <PanelHeaderSkeleton />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-5 pb-5">
        {['w-1/2', 'w-2/3', 'w-3/5', 'w-1/2', 'w-3/4', 'w-1/3'].map(
          (width, index) => (
            <Skeleton key={index} className={cn('h-3.5', width)} />
          )
        )}
      </div>
    </section>
  );
}

function TransponderSkeleton() {
  return (
    <section className="flex shrink-0 flex-col overflow-hidden border-t border-zinc-800">
      <PanelHeaderSkeleton />
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="rounded-2xl border-2 border-zinc-800 bg-zinc-900 p-3">
          <Skeleton className="h-3 w-20" />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md" />
        </div>
      </div>
    </section>
  );
}

export function AcarsActionsSkeleton({ buttons = 2 }: { buttons?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="size-8 rounded-md" />
      {Array.from({ length: buttons }, (_, index) => (
        <Skeleton key={index} className="h-8 w-24 rounded-md" />
      ))}
    </div>
  );
}

export default function AcarsSkeleton({
  layoutState,
  transponder = false,
}: {
  layoutState: ReturnType<typeof useAcarsLayout>;
  transponder?: boolean;
}) {
  return (
    <div aria-busy="true" className="flex min-h-0 flex-1 flex-col">
      <AcarsWorkspace
        layoutState={layoutState}
        sidebar={
          <>
            <FlightPlanSkeleton />
            <StationsSkeleton />
          </>
        }
        terminal={(panelProps) => <TerminalSkeleton {...panelProps} />}
        notes={
          <>
            <NotesSkeleton className="min-h-56 flex-1" />
            {transponder && <TransponderSkeleton />}
          </>
        }
      />
    </div>
  );
}
