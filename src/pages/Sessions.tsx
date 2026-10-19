import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  FolderOpen,
  Hash,
  Info,
  Loader2,
  Pencil,
  Plane,
  PlaneTakeoff,
  Plus,
  Search,
  Trash2,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import PageHero from '../components/common/PageHero';
import SessionTypeLabel from '../components/common/SessionTypeLabel';
import { useAuth } from '../hooks/auth/useAuth';
import {
  fetchMySessions,
  updateSessionName,
  deleteSession,
} from '../utils/fetch/sessions';
import type { SessionInfo } from '../types/session';
import { Button } from '@/components/ui/button';
import { minDuration } from '@/lib/minDuration';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const sessionName = (session: SessionInfo | null) =>
  session?.customName || `${session?.airportIcao || 'Unknown'} Session`;

function CountLabel({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 tabular-nums [&_svg]:size-4 [&_svg]:text-blue-400">
      {icon}
      {children}
    </div>
  );
}

function SessionCardSkeleton() {
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

function SessionCard({
  session,
  onRename,
  onDelete,
}: {
  session: SessionInfo;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(session.sessionId);
      setCopied(true);
      toast.success('Session ID copied');
    } catch {
      toast.error('Could not copy the session ID');
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60 has-[a:focus-visible]:border-ring">
      <div className="flex min-w-0 items-center gap-3 pt-4 pr-36 pb-3 pl-5">
        <FolderOpen className="size-5 shrink-0 text-blue-400" />
        <Link
          to={`/view/${session.sessionId}/?accessId=${session.accessId}`}
          className="truncate font-medium outline-none after:absolute after:inset-0"
        >
          {sessionName(session)}
        </Link>
        {session.isLegacy && (
          <Info
            aria-label="Legacy session"
            className="size-4 shrink-0 text-amber-400"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-4 text-sm text-zinc-300 [&_svg]:text-zinc-500">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copyId}
              aria-label={`Copy session ID ${session.sessionId}`}
              className="group/id relative z-10 -mx-1.5 -my-0.5 flex max-w-full min-w-0 cursor-pointer items-center gap-2 self-start rounded-md px-1.5 py-0.5 transition-colors outline-none hover:bg-zinc-800 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Hash className="size-4 shrink-0" />
              <span className="truncate font-mono">{session.sessionId}</span>
              {copied ? (
                <Check className="size-3.5 shrink-0 text-emerald-400!" />
              ) : (
                <Copy className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/id:opacity-100 group-focus-visible/id:opacity-100" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent className="shadcn-scope" sideOffset={6}>
            {copied ? 'Copied!' : 'Copy session ID'}
          </TooltipContent>
        </Tooltip>
        <span className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0" />
          {session.createdAt
            ? new Date(session.createdAt).toLocaleString()
            : 'Date unavailable'}
        </span>
        {session.activeRunway && (
          <span className="flex items-center gap-2">
            <PlaneTakeoff className="size-4 shrink-0" />
            Departure runway
            <span className="font-mono font-medium text-foreground">
              {session.activeRunway}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-4">
        <SessionTypeLabel
          isAdvancedATC={session.isAdvancedATC}
          isPFATC={session.isPFATC}
        />
        <span className="flex items-center gap-1.5 text-sm text-zinc-300 tabular-nums [&_svg]:text-zinc-500">
          <Plane className="size-4" />
          {session.flightCount}{' '}
          {session.flightCount === 1 ? 'flight' : 'flights'}
        </span>
      </div>
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-blue-600"
          onClick={onRename}
        >
          <Pencil />
          Edit
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete session"
              className="border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-red-600"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="shadcn-scope" sideOffset={6}>
            Delete session
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default function Sessions() {
  const { user, isLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renameTarget, setRenameTarget] = useState<SessionInfo | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionInfo | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');

  const maxSessions = user?.limits?.maxSessions ?? 50;
  const atLimit = sessions.length >= maxSessions;

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) =>
      [
        sessionName(session),
        session.sessionId,
        session.airportIcao,
        session.activeRunway,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [sessions, query]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchMySessions()
      .then(setSessions)
      .catch(() => setError('Failed to load sessions.'))
      .finally(() => setLoading(false));
  }, [user]);

  const openRename = (session: SessionInfo) => {
    setRenameTarget(session);
    setEditNameValue(session.customName || '');
    setRenameOpen(true);
  };

  const saveSessionName = async () => {
    if (!renameTarget) return;
    const name = editNameValue.trim();
    if (!name) {
      setRenameOpen(false);
      return;
    }
    setSavingName(true);
    try {
      const { customName } = await minDuration(
        updateSessionName(renameTarget.sessionId, name)
      );
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === renameTarget.sessionId ? { ...s, customName } : s
        )
      );
      setRenameOpen(false);
    } catch {
      toast.error('Failed to update session name.');
    } finally {
      setSavingName(false);
    }
  };

  const openDelete = (session: SessionInfo) => {
    setDeleteTarget(session);
    setDeleteOpen(true);
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await minDuration(deleteSession(deleteTarget.sessionId));
      setSessions((prev) =>
        prev.filter((s) => s.sessionId !== deleteTarget.sessionId)
      );
      setDeleteOpen(false);
    } catch {
      toast.error('Failed to delete session.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoading && !loading && !user) {
    return (
      <div className="shadcn-scope flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <Navbar />
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 p-8 text-center">
          <AlertTriangle className="size-8 text-amber-400" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Not logged in</h2>
            <p className="text-sm text-muted-foreground">
              Please log in to view your sessions.
            </p>
          </div>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const showSkeleton = isLoading || loading;

  return (
    <TooltipProvider>
      <div className="shadcn-scope min-h-screen bg-background text-foreground">
        <Navbar />

        <PageHero title="MY SESSIONS">
          {showSkeleton ? (
            <div className="flex gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
          ) : (
            <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <CountLabel icon={<FolderOpen />}>
                {sessions.length}/{maxSessions}{' '}
                {sessions.length === 1 ? 'session' : 'sessions'}
              </CountLabel>
              {atLimit ? (
                <Button disabled className="w-full sm:w-auto">
                  <Plus />
                  New session
                </Button>
              ) : (
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/create">
                    <Plus />
                    New session
                  </Link>
                </Button>
              )}
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
                placeholder="Search name, session ID, airport, runway..."
                aria-label="Search sessions"
                className="h-11 rounded-xl border-zinc-800 bg-zinc-900 pl-10 dark:bg-zinc-900"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            {!showSkeleton && atLimit && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div className="space-y-0.5 text-sm">
                  <p className="font-medium text-amber-300">
                    Session limit reached
                  </p>
                  <p className="text-muted-foreground">
                    You have reached the maximum of {maxSessions} sessions.
                    Delete an old session to create a new one
                    {user?.plan !== 'supporter' && (
                      <>
                        , or{' '}
                        <Link
                          to="/pricing"
                          className="cursor-pointer font-medium text-amber-400 hover:text-amber-300"
                        >
                          become a Supporter
                        </Link>{' '}
                        for twice the room
                      </>
                    )}
                    .
                  </p>
                </div>
              </div>
            )}

            {showSkeleton ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SessionCardSkeleton key={i} />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
                <Workflow className="size-10 text-blue-400" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">No sessions yet</h2>
                  <p className="text-sm text-muted-foreground">
                    You haven't created any sessions yet.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/create">
                    <Plus />
                    Create your first session
                  </Link>
                </Button>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
                <Search className="size-10 text-blue-400" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">
                    No matching sessions
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Nothing matches “{query.trim()}”.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSessions.map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session}
                    onRename={() => openRename(session)}
                    onDelete={() => openDelete(session)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={renameOpen}
          onOpenChange={(open) => !savingName && setRenameOpen(open)}
        >
          <DialogContent className="shadcn-scope sm:max-w-md">
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveSessionName();
              }}
            >
              <DialogHeader>
                <DialogTitle>Rename session</DialogTitle>
                <DialogDescription>
                  Give this session a name so it's easier to find.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="session-name">Name</Label>
                <Input
                  id="session-name"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder={sessionName(renameTarget)}
                  maxLength={50}
                  disabled={savingName}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameOpen(false)}
                  disabled={savingName}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingName || !editNameValue.trim()}
                >
                  {savingName && <Loader2 className="animate-spin" />}
                  {savingName ? 'Saving…' : 'Save name'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => !deleting && setDeleteOpen(open)}
        >
          <AlertDialogContent variant="danger" className="shadcn-scope">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete session?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">
                  {sessionName(deleteTarget)}
                </span>{' '}
                will be permanently deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteTarget?.isLegacy && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <p>
                  <span className="font-medium text-amber-300">
                    Legacy session.
                  </span>{' '}
                  <span className="text-muted-foreground">
                    It uses old encryption, so deleting it is recommended.
                  </span>
                </p>
              </div>
            )}
            <p className="font-mono text-xs text-muted-foreground">
              ID: {deleteTarget?.sessionId}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteSession();
                }}
              >
                {deleting && <Loader2 className="animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete session'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
