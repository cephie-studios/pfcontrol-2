import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ExternalLink,
  Loader2,
  MoreVertical,
  Plane,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  claimSubmittedFlight,
  deleteFlight,
  fetchMyFlights,
  toggleFeaturedOnProfile,
} from '../utils/fetch/flights';
import type { Flight } from '../types/flight';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/auth/useAuth';
import PageHero from '../components/common/PageHero';
import SessionTypeLabel from '../components/common/SessionTypeLabel';
import { Button } from '@/components/ui/button';
import { minDuration } from '@/lib/minDuration';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

function FlightCardSkeleton() {
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

const ACTION_TONES = {
  blue: 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white dark:hover:bg-blue-600',
  amber:
    'border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white focus-visible:bg-amber-500 focus-visible:text-white dark:hover:bg-amber-500',
} as const;

function CardAction({
  label,
  tone = 'blue',
  active = false,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
  tone?: keyof typeof ACTION_TONES;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn(
            'border-2 focus-visible:ring-0 aria-disabled:opacity-50',
            ACTION_TONES[tone],
            active && 'bg-amber-500 text-white dark:bg-amber-500',
            className
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function FlightCard({
  flight,
  featuredCount,
  onFeaturedToggle,
  onDelete,
}: {
  flight: Flight;
  featuredCount: number;
  onFeaturedToggle: (id: string, featured: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const maxFeatured = user?.limits?.featuredFlights ?? 3;
  const [featured, setFeatured] = useState(flight.featured_on_profile ?? false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const coverSnap = flight.snap_images?.[0];

  const acarsUrl = flight.acars_token
    ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
    : null;

  const publicFlightUrl = flight.acars_token
    ? `${window.location.origin}/flight/${flight.id}`
    : null;

  const callsign = flight.callsign?.toUpperCase() || 'Unknown';
  const atCap = !featured && featuredCount >= maxFeatured;

  const handleShare = async () => {
    if (!publicFlightUrl) return;
    try {
      await navigator.clipboard.writeText(publicFlightUrl);
      toast.success('Flight link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleToggleFeatured = async () => {
    if (featuredLoading) return;
    if (atCap) {
      toast.error(`You can feature up to ${maxFeatured} flights`);
      return;
    }
    setFeaturedLoading(true);
    try {
      const result = await minDuration(
        toggleFeaturedOnProfile(String(flight.id))
      );
      setFeatured(result.featured);
      onFeaturedToggle(String(flight.id), result.featured);
    } catch {
      toast.error('Failed to update featured flights');
    } finally {
      setFeaturedLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await minDuration(deleteFlight(flight.session_id, flight.id));
      setDeleteConfirmOpen(false);
      onDelete(String(flight.id));
    } catch {
      toast.error('Failed to delete flight');
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      <Link
        to={`/my-flights/${flight.id}`}
        className={cn(
          'relative isolate flex h-full flex-col overflow-hidden rounded-3xl border-2 border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700',
          !coverSnap && 'hover:bg-zinc-800/60'
        )}
      >
        {coverSnap && (
          <>
            <img
              src={coverSnap.url}
              alt=""
              aria-hidden
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-zinc-950/75" />
          </>
        )}
        <div className="flex min-w-0 items-center gap-3 pt-4 pr-32 pb-3 pl-5">
          <Plane className="size-5 shrink-0 text-blue-400" />
          <span className="truncate font-medium">{callsign}</span>
          {featured && (
            <Star
              aria-label="Featured on profile"
              className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
            />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2.5 px-5 pb-4 text-sm text-zinc-300 [&_svg]:text-zinc-500">
          <span className="flex items-center gap-2 font-mono font-medium text-foreground">
            {flight.departure || '----'}
            <ArrowRight className="size-3.5 text-muted-foreground" />
            {flight.arrival || '----'}
          </span>
          <span className="flex items-center gap-2">
            <Plane className="size-4 shrink-0" />
            {flight.aircraft || 'Unknown aircraft'}
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0" />
            {flight.created_at
              ? new Date(flight.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Unknown date'}
          </span>
        </div>
        <div className="px-5 pb-4">
          <SessionTypeLabel
            isAdvancedATC={flight.isAdvancedATC}
            isPFATC={flight.isPFATC}
          />
        </div>
      </Link>

      <div className="absolute top-3 right-3 flex gap-1.5">
        <CardAction
          label={
            featured
              ? 'Remove from profile'
              : atCap
                ? `You can feature up to ${maxFeatured} flights`
                : 'Feature on profile'
          }
          tone="amber"
          active={featured}
          aria-disabled={atCap || featuredLoading}
          onClick={handleToggleFeatured}
        >
          {featuredLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Star className={cn(featured && 'fill-current')} />
          )}
        </CardAction>
        {publicFlightUrl && (
          <CardAction label="Copy share link" onClick={handleShare}>
            <Share2 />
          </CardAction>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More options"
              className={cn(
                'border-2 focus-visible:ring-0 data-[state=open]:bg-blue-600 data-[state=open]:text-white',
                ACTION_TONES.blue
              )}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="shadcn-scope w-44">
            {acarsUrl && (
              <>
                <DropdownMenuItem
                  onSelect={() => window.open(acarsUrl, '_blank')}
                >
                  <ExternalLink />
                  Open ACARS
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={deleting}
              onSelect={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 />
              Delete flight
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => !deleting && setDeleteConfirmOpen(open)}
      >
        <AlertDialogContent variant="danger" className="shadcn-scope">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flight?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{callsign}</span>{' '}
              will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
            >
              {deleting && <Loader2 className="animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete flight'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MyFlights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const claimSessionId = searchParams.get('claimSessionId');
  const claimFlightId = searchParams.get('claimFlightId');
  const claimToken = searchParams.get('claimToken');

  useEffect(() => {
    const loadFlights = async () => {
      try {
        if (claimSessionId && claimFlightId && claimToken) {
          await claimSubmittedFlight(claimSessionId, claimFlightId, claimToken);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('claimSessionId');
            next.delete('claimFlightId');
            next.delete('claimToken');
            return next;
          });
        }

        const result = await fetchMyFlights();
        setFlights(result);
      } catch {
        setError('Failed to load your flights.');
      } finally {
        setLoading(false);
      }
    };

    loadFlights();
  }, [claimSessionId, claimFlightId, claimToken, setSearchParams]);

  const featuredCount = useMemo(
    () => flights.filter((f) => f.featured_on_profile).length,
    [flights]
  );

  const handleFeaturedToggle = (id: string, newFeatured: boolean) => {
    setFlights((prev) =>
      prev.map((f) =>
        String(f.id) === id ? { ...f, featured_on_profile: newFeatured } : f
      )
    );
  };

  const handleDelete = (id: string) => {
    setFlights((prev) => prev.filter((f) => String(f.id) !== id));
  };

  const filteredFlights = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter((flight) =>
      [flight.callsign, flight.departure, flight.arrival, flight.aircraft]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [flights, query]);

  return (
    <TooltipProvider>
      <div className="shadcn-scope min-h-screen bg-background text-foreground">
        <Navbar />

        <PageHero title="MY FLIGHTS">
          {loading ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 tabular-nums">
              <Plane className="size-4 text-blue-400" />
              {filteredFlights.length}{' '}
              {filteredFlights.length === 1 ? 'flight' : 'flights'}
            </div>
          )}
        </PageHero>

        <div className="relative z-10 mx-auto -mt-6 w-full max-w-7xl px-4 pb-16 sm:px-6 md:-mt-8">
          <div className="flex flex-col gap-6">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search callsign, airport, aircraft..."
                aria-label="Search flights"
                className="h-11 rounded-xl border-zinc-800 bg-zinc-900 pl-10 dark:bg-zinc-900"
              />
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <FlightCardSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {error}
              </div>
            ) : filteredFlights.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
                <Plane className="size-10 text-blue-400" />
                {query.trim() ? (
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">
                      No matching flights
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Nothing matches “{query.trim()}”.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">No flights yet</h2>
                      <p className="text-sm text-muted-foreground">
                        Submit a flight plan and it will show up here.
                      </p>
                    </div>
                    <Button asChild>
                      <Link to="/create">
                        <Plus />
                        Create session
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFlights.map((flight) => (
                  <FlightCard
                    key={String(flight.id)}
                    flight={flight}
                    featuredCount={featuredCount}
                    onFeaturedToggle={handleFeaturedToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
