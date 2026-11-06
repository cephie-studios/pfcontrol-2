import type { ReactNode } from 'react';
import Navbar from '../Navbar';
import PageHero from '../common/PageHero';
import FlightTableSkeleton from '../tables/FlightTableSkeleton';
import FlightDetailSkeleton from '../flight/FlightDetailSkeleton';
import AcarsSkeleton, { AcarsActionsSkeleton } from '../acars/AcarsSkeleton';
import { useAcarsLayout } from '../acars/useAcarsLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function SessionCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border-2 border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex flex-col gap-3 px-5 pb-4">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="flex items-center justify-between px-5 pb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3.5 w-16" />
      </div>
    </div>
  );
}

export function FlightCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border-2 border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-3 px-5 pb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="px-5 pb-4">
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

function SettingsSectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-9 items-center gap-2.5">
        <Skeleton className="size-5 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-6 px-5 py-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-full max-w-72" />
            </div>
            <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardListPage({
  title,
  hero,
  card,
}: {
  title: string;
  hero: ReactNode;
  card: ReactNode;
}) {
  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <PageHero title={title}>{hero}</PageHero>
      <div className="relative z-10 mx-auto -mt-6 w-full max-w-7xl px-4 pb-16 sm:px-6 md:-mt-8">
        <div className="flex flex-col gap-6" role="status">
          <div className="h-11 rounded-xl border border-zinc-800 bg-zinc-900" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>{card}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionsPageSkeleton() {
  return (
    <CardListPage
      title="MY SESSIONS"
      hero={
        <div className="flex gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      }
      card={<SessionCardSkeleton />}
    />
  );
}

export function MyFlightsPageSkeleton() {
  return (
    <CardListPage
      title="MY FLIGHTS"
      hero={<Skeleton className="h-5 w-24" />}
      card={<FlightCardSkeleton />}
    />
  );
}

export function CreatePageSkeleton() {
  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <PageHero title="CREATE SESSION">
        <Skeleton className="h-4 w-24" />
      </PageHero>
      <div className="relative z-10 mx-auto -mt-6 w-full max-w-[34rem] px-4 pb-16 md:-mt-8">
        <div
          className="flex flex-col gap-4 rounded-4xl border-2 border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
          role="status"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <PageHero title="YOUR SETTINGS" />
      <div className="relative z-10 mx-auto -mt-6 w-full max-w-4xl min-w-0 px-4 pb-32 sm:px-6 md:-mt-8">
        <div className="flex min-w-0 flex-col gap-12" role="status">
          {[3, 2, 4].map((rows, i) => (
            <SettingsSectionSkeleton key={i} rows={rows} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SubmitPageSkeleton({ navbar = true }: { navbar?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white" role="status">
      {navbar && <Navbar />}
      <div className="relative flex h-96 w-full flex-col items-center justify-center gap-4 px-6 md:h-[32rem]">
        <div className="flex gap-4">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <Skeleton className="h-10 w-72 sm:h-14 sm:w-[28rem]" />
      </div>
      <div className="relative z-10 container mx-auto -mt-32 max-w-3xl px-4 pb-8 md:-mt-40">
        <Skeleton className="mb-6 h-20 w-full rounded-3xl" />
        <div className="space-y-6 rounded-3xl border border-gray-800 bg-gray-900/70 p-6">
          {[3, 2, 2, 1].map((cols, i) => (
            <div
              key={i}
              className={cn(
                'grid grid-cols-1 gap-3',
                cols === 3 && 'sm:grid-cols-3',
                cols === 2 && 'sm:grid-cols-2'
              )}
            >
              {Array.from({ length: cols }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-11 w-full rounded-full" />
                </div>
              ))}
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PilotProfilePageSkeleton({
  navbar = true,
}: {
  navbar?: boolean;
}) {
  return (
    <div className="min-h-screen bg-black text-white" role="status">
      {navbar && <Navbar />}
      <div className="border-b border-zinc-700/50 py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4 pt-24 pb-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <Skeleton className="size-24 self-center rounded-full md:size-32 md:self-auto" />
            <div className="flex flex-1 flex-col items-center gap-3 md:items-start">
              <Skeleton className="h-9 w-56 md:h-12 md:w-72" />
              <Skeleton className="h-5 w-48" />
              <div className="flex gap-3">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-7xl space-y-8 px-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    </div>
  );
}

export function FlightDetailPageSkeleton({
  navbar = true,
}: {
  navbar?: boolean;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {navbar && <Navbar />}
      <FlightDetailSkeleton />
    </div>
  );
}

export function FlightsPageSkeleton({
  sessionId,
  accessId,
}: {
  sessionId?: string;
  accessId?: string;
}) {
  return (
    <div className="min-h-screen text-white relative">
      <div className="relative z-10">
        <Navbar sessionId={sessionId} accessId={accessId} />
        <div className="pt-16">
          <div className="flex items-center justify-between gap-4 px-4 py-2">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <div className="-mt-4">
            <FlightTableSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AcarsPageSkeleton() {
  const layoutState = useAcarsLayout();
  return (
    <div className="shadcn-scope flex min-h-dvh flex-col bg-background text-foreground md:h-dvh">
      <Navbar />
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pt-21 pb-3 sm:px-6">
        <Skeleton className="h-7 w-36" />
        <AcarsActionsSkeleton />
      </header>
      <AcarsSkeleton layoutState={layoutState} />
    </div>
  );
}

export function HeroPageSkeleton({ title }: { title: string }) {
  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <PageHero title={title}>
        <Skeleton className="h-5 w-40" />
      </PageHero>
      <div className="relative z-10 mx-auto -mt-6 w-full max-w-7xl px-4 pb-16 sm:px-6 md:-mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-3xl border-2 border-zinc-800 bg-zinc-900 p-5"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="mt-4 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
