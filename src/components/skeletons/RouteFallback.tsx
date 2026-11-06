import type { ReactNode } from 'react';
import { matchPath, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import Navbar from '../Navbar';
import AdminLayout from '../admin/AdminLayout';
import {
  AdminStatCardsSkeleton,
  AdminTableSkeleton,
} from '../admin/AdminStates';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AcarsPageSkeleton,
  CreatePageSkeleton,
  FlightDetailPageSkeleton,
  FlightsPageSkeleton,
  HeroPageSkeleton,
  MyFlightsPageSkeleton,
  PilotProfilePageSkeleton,
  SessionsPageSkeleton,
  SettingsPageSkeleton,
  SubmitPageSkeleton,
} from './PageSkeletons';

function AdminRouteSkeleton({ overview }: { overview: boolean }) {
  return (
    <AdminLayout>
      <div
        className="mx-auto flex w-full max-w-[1600px] flex-col gap-6"
        role="status"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-6 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        {overview ? (
          <>
            <AdminStatCardsSkeleton />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </>
        ) : (
          <>
            <Skeleton className="h-9 w-full max-w-md rounded-lg" />
            <AdminTableSkeleton avatar={false} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

const ROUTES: [string, (params: Record<string, string>) => ReactNode][] = [
  ['/sessions', () => <SessionsPageSkeleton />],
  ['/create', () => <CreatePageSkeleton />],
  ['/my-flights', () => <MyFlightsPageSkeleton />],
  ['/my-flights/:id', () => <FlightDetailPageSkeleton />],
  ['/flight/:flightId', () => <FlightDetailPageSkeleton />],
  ['/settings', () => <SettingsPageSkeleton />],
  ['/submit/:sessionId', () => <SubmitPageSkeleton />],
  ['/user/:username', () => <PilotProfilePageSkeleton />],
  ['/acars/:sessionId/:flightId', () => <AcarsPageSkeleton />],
  [
    '/view/:sessionId',
    ({ sessionId }) => <FlightsPageSkeleton sessionId={sessionId} />,
  ],
  ['/charts', () => <HeroPageSkeleton title="CHARTS" />],
  ['/pricing', () => <HeroPageSkeleton title="SUPPORT PFCONTROL" />],
  ['/admin', () => <AdminRouteSkeleton overview />],
  ['/admin/*', () => <AdminRouteSkeleton overview={false} />],
];

export default function RouteFallback() {
  const { pathname } = useLocation();
  for (const [pattern, render] of ROUTES) {
    const match = matchPath(pattern, pathname);
    if (match) return render(match.params as Record<string, string>);
  }
  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex justify-center pt-40">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    </div>
  );
}
