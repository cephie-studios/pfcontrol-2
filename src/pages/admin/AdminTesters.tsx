import { useState, useEffect, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  Lock,
  LockOpen,
  NotebookPen,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2,
  User,
  UserRound,
  Users,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSection from '../../components/admin/AdminSection';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminTextInput from '../../components/admin/AdminTextInput';
import AdminTable from '../../components/admin/AdminTable';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import {
  fetchTesters,
  addTester,
  removeTester,
  fetchAdminTesterSettings,
  updateTesterSettings,
  type Tester,
  type TesterGateChannel,
  type TesterSettingsByChannel,
} from '../../utils/fetch/testers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const TESTER_GATE_CHANNELS: { channel: TesterGateChannel; label: string }[] = [
  { channel: 'production', label: 'Production' },
  { channel: 'canary', label: 'Canary' },
];

function TesterAvatar({ tester }: { tester: Tester }) {
  return (
    <Avatar>
      {tester.avatar ? (
        <AvatarImage
          src={`https://cdn.discordapp.com/avatars/${tester.user_id}/${tester.avatar}.png`}
          alt={tester.username}
        />
      ) : null}
      <AvatarFallback>
        <UserRound className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

export default function AdminTesters() {
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTesters, setTotalTesters] = useState(0);
  const [addingTester, setAddingTester] = useState(false);
  const [removingTester, setRemovingTester] = useState<string | null>(null);
  const [newTesterUserId, setNewTesterUserId] = useState('');
  const [newTesterNotes, setNewTesterNotes] = useState('');
  const [gateSettings, setGateSettings] = useState<TesterSettingsByChannel>({
    production: { tester_gate_enabled: true },
    canary: { tester_gate_enabled: true },
  });
  const [updatingChannel, setUpdatingChannel] =
    useState<TesterGateChannel | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const fetchTestersData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [testersData, settings] = await Promise.all([
        fetchTesters(currentPage, 50, searchTerm),
        fetchAdminTesterSettings(),
      ]);

      setTesters(testersData.testers);
      setTotalPages(testersData.pagination.pages);
      setTotalTesters(testersData.pagination.total);
      setGateSettings(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch testers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestersData();
  }, [currentPage, searchTerm]);

  const handleAddTester = async () => {
    if (!newTesterUserId.trim()) {
      setToast({ message: 'User ID is required', type: 'error' });
      return;
    }

    try {
      setAddingTester(true);
      await addTester(newTesterUserId.trim(), newTesterNotes.trim());

      setToast({ message: 'Tester added successfully', type: 'success' });
      setNewTesterUserId('');
      setNewTesterNotes('');
      fetchTestersData();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to add tester',
        type: 'error',
      });
    } finally {
      setAddingTester(false);
    }
  };

  const handleRemoveTester = async (userId: string) => {
    try {
      setRemovingTester(userId);
      await removeTester(userId);

      setToast({
        message: 'Tester removed successfully',
        type: 'success',
      });
      fetchTestersData();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to remove tester',
        type: 'error',
      });
    } finally {
      setRemovingTester(null);
    }
  };

  const handleToggleGate = async (channel: TesterGateChannel) => {
    const nextEnabled = !gateSettings[channel].tester_gate_enabled;
    try {
      setUpdatingChannel(channel);
      await updateTesterSettings(channel, {
        tester_gate_enabled: nextEnabled,
      });
      setGateSettings((prev) => ({
        ...prev,
        [channel]: { tester_gate_enabled: nextEnabled },
      }));

      setToast({
        message: `Tester gate ${nextEnabled ? 'enabled' : 'disabled'} on ${channel}`,
        type: 'success',
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to update settings',
        type: 'error',
      });
    } finally {
      setUpdatingChannel(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!addingTester) handleAddTester();
  };

  const renderRemoveButton = (tester: Tester) => {
    const removing = removingTester === tester.user_id;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleRemoveTester(tester.user_id)}
            disabled={removing}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${tester.username} as tester`}
          >
            {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove tester</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Testers"
        icon={FlaskConical}
        actions={
          <AdminRefreshButton onClick={fetchTestersData} loading={loading} />
        }
      >
        <AdminSection title="Tester gate">
          <div className="divide-y rounded-2xl border">
            {TESTER_GATE_CHANNELS.map(({ channel, label }) => {
              const gateEnabled = gateSettings[channel].tester_gate_enabled;
              const updatingGate = updatingChannel === channel;
              return (
                <div
                  key={channel}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {label}
                    <AdminStatusBadge
                      tone={gateEnabled ? 'success' : 'danger'}
                      icon={gateEnabled ? Lock : LockOpen}
                      showLabel
                    >
                      {gateEnabled ? 'Testers only' : 'Open to all users'}
                    </AdminStatusBadge>
                  </p>
                  <Button
                    onClick={() => handleToggleGate(channel)}
                    disabled={updatingChannel !== null}
                    variant={gateEnabled ? 'destructive' : 'default'}
                    size="sm"
                  >
                    {updatingGate ? (
                      <Loader2 className="animate-spin" />
                    ) : gateEnabled ? (
                      <ShieldOff />
                    ) : (
                      <ShieldCheck />
                    )}
                    {gateEnabled ? 'Disable gate' : 'Enable gate'}
                  </Button>
                </div>
              );
            })}
          </div>
        </AdminSection>

        <AdminSection title="Add tester">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <AdminTextInput
              label="User ID"
              icon={<User />}
              value={newTesterUserId}
              onChange={setNewTesterUserId}
              placeholder="Discord user ID"
              inputClassName="font-mono"
              required
            />
            <AdminTextInput
              label="Notes (optional)"
              icon={<NotebookPen />}
              value={newTesterNotes}
              onChange={setNewTesterNotes}
              placeholder="Any notes about this tester"
            />
            <Button type="submit" disabled={addingTester}>
              {addingTester ? <Loader2 className="animate-spin" /> : <Plus />}
              Add tester
            </Button>
          </form>
        </AdminSection>

        <AdminSection
          title="Testers"
          description={`${totalTesters.toLocaleString()} users with tester access`}
          actions={
            <AdminSearchInput
              value={searchTerm}
              onChange={(v) => {
                setSearchTerm(v);
                setCurrentPage(1);
              }}
              placeholder="Search by username or ID…"
              loading={loading}
              grow={false}
            />
          }
        >
          {loading ? (
            <AdminLoading label="Loading testers…" />
          ) : error ? (
            <AdminErrorState
              title="Error loading testers"
              message={error}
              onRetry={fetchTestersData}
            />
          ) : testers.length === 0 ? (
            <AdminEmptyState icon={Users} title="No testers found" />
          ) : (
            <>
              <AdminTable className="hidden md:block" minWidth="720px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Tester</TableHead>
                    <TableHead>Added by</TableHead>
                    <TableHead>Date added</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12 pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testers.map((tester) => (
                    <TableRow key={tester.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <TesterAvatar tester={tester} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {tester.username}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {tester.user_id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{tester.added_by_username}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {new Date(tester.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {tester.notes || 'N/A'}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {renderRemoveButton(tester)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </AdminTable>

              <div className="divide-y rounded-2xl border md:hidden">
                {testers.map((tester) => (
                  <div key={tester.id} className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <TesterAvatar tester={tester} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {tester.username}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {tester.user_id}
                          </p>
                        </div>
                      </div>
                      {renderRemoveButton(tester)}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Added by</dt>
                      <dd>{tester.added_by_username}</dd>
                      <dt className="text-muted-foreground">Date</dt>
                      <dd className="tabular-nums">
                        {new Date(tester.created_at).toLocaleDateString()}
                      </dd>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd
                        className={cn(
                          'break-words',
                          !tester.notes && 'text-muted-foreground'
                        )}
                      >
                        {tester.notes || 'N/A'}
                      </dd>
                    </dl>
                  </div>
                ))}
              </div>
            </>
          )}
        </AdminSection>

        {!loading && !error && totalPages > 1 && (
          <div className="flex flex-col items-center justify-end gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground tabular-nums">
              Page {currentPage} of {totalPages} ·{' '}
              {totalTesters.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </AdminPage>
    </AdminLayout>
  );
}
