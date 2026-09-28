import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminSurveyEditor from '../../components/admin/AdminSurveyEditor';
import AdminTable from '../../components/admin/AdminTable';
import AdminToolbar from '../../components/admin/AdminToolbar';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import {
  createAdminSurvey,
  deleteAdminSurvey,
  fetchAdminSurveyResponses,
  fetchAdminSurveyResults,
  fetchAdminSurveys,
  resetAdminSurveyResponse,
  setAdminSurveyActive,
  updateAdminSurvey,
  type AdminSurveyInput,
  type AdminSurveyResponse,
  type AdminSurveyResults,
  type AdminSurveySummary,
} from '../../utils/fetch/admin/surveys';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Table,
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
import { minDuration } from '@/lib/minDuration';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

function Answer({ value }: { value: boolean | undefined }) {
  if (value === undefined) {
    return <span className="text-xs text-muted-foreground">–</span>;
  }
  return value ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500">
      <Check className="size-3.5" aria-hidden />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
      <X className="size-3.5" aria-hidden />
      No
    </span>
  );
}

function QuestionTag({ index, text }: { index: number; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-default text-xs font-medium text-muted-foreground tabular-nums"
        >
          Q{index + 1}
        </span>
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope max-w-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function UserCell({ r }: { r: AdminSurveyResponse }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar>
        {r.avatar ? (
          <AvatarImage
            src={`https://cdn.discordapp.com/avatars/${r.userId}/${r.avatar}.png`}
            alt={r.username}
          />
        ) : null}
        <AvatarFallback>
          <UserRound className="size-4 text-zinc-500" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{r.username}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {r.userId}
        </p>
      </div>
    </div>
  );
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function formatDuration(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; initial: AdminSurveyInput; responseCount: number }
  | null;

export default function AdminSurveys() {
  const [surveys, setSurveys] = useState<AdminSurveySummary[]>([]);
  const [surveysLoaded, setSurveysLoaded] = useState(false);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [results, setResults] = useState<AdminSurveyResults | null>(null);
  const [responses, setResponses] = useState<AdminSurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editor, setEditor] = useState<EditorState>(null);
  const [activeBusy, setActiveBusy] = useState(false);
  const { confirm, confirmDialog } = useAdminConfirm();

  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const loadSurveys = useCallback(async (selectId?: string | null) => {
    try {
      const list = await fetchAdminSurveys();
      setSurveys(list);
      setSurveyId((current) => {
        const wanted = selectId === undefined ? current : selectId;
        if (wanted && list.some((s) => s.id === wanted)) return wanted;
        return list.find((s) => s.active)?.id ?? list[0]?.id ?? null;
      });
      if (list.length === 0) {
        setResults(null);
        setLoading(false);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load surveys';
      setError(message);
      setLoading(false);
      toast.error(message);
    } finally {
      setSurveysLoaded(true);
    }
  }, []);

  const loadResults = useCallback(async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      setError(null);
      setResults(await fetchAdminSurveyResults(surveyId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load survey results';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  const loadResponses = useCallback(async () => {
    if (!surveyId) return;
    try {
      setListLoading(true);
      const data = await fetchAdminSurveyResponses(surveyId, {
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
      });
      setResponses(data.responses);
      setPages(data.pagination.pages);
      setTotal(data.pagination.total);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load responses'
      );
    } finally {
      setListLoading(false);
    }
  }, [surveyId, page, debouncedSearch]);

  useEffect(() => {
    void loadSurveys();
  }, [loadSurveys]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const refresh = () => {
    void loadSurveys();
    void loadResults();
    void loadResponses();
  };

  const questions = useMemo(() => results?.questions ?? [], [results]);
  const selected = surveys.find((s) => s.id === surveyId) ?? null;
  const activeSurvey = surveys.find((s) => s.active) ?? null;
  const totalResponses = results?.totalResponses ?? 0;

  const handleReset = async (r: AdminSurveyResponse) => {
    if (!surveyId) return;
    await confirm({
      title: `Reset ${r.username}'s answers?`,
      description:
        'Their answers are deleted and they will have to fill in the survey again on their next visit.',
      confirmText: 'Reset',
      destructive: true,
      action: async () => {
        try {
          await minDuration(resetAdminSurveyResponse(surveyId, r.userId));
          toast.success(`Reset ${r.username}'s answers`);
          refresh();
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to reset answers'
          );
          throw err;
        }
      },
    });
  };

  const handleToggleActive = async () => {
    if (!selected) return;
    const activate = !selected.active;
    const run = async () => {
      setActiveBusy(true);
      try {
        await minDuration(setAdminSurveyActive(selected.id, activate));
        toast.success(
          activate ? `"${selected.title}" is now active` : 'Survey deactivated'
        );
        await loadSurveys(selected.id);
        await loadResults();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update survey'
        );
        throw err;
      } finally {
        setActiveBusy(false);
      }
    };

    if (!activate) {
      await run().catch(() => {});
      return;
    }
    await confirm({
      title: `Activate "${selected.title}"?`,
      description:
        activeSurvey && activeSurvey.id !== selected.id
          ? `Every logged-in user who hasn't answered it will be asked to fill it in. "${activeSurvey.title}" will be deactivated.`
          : "Every logged-in user who hasn't answered it will be asked to fill it in.",
      confirmText: 'Activate',
      action: run,
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    await confirm({
      title: `Delete "${selected.title}"?`,
      description: `The survey and all ${selected.totalResponses.toLocaleString()} response${selected.totalResponses === 1 ? '' : 's'} are deleted permanently.`,
      confirmText: 'Delete',
      destructive: true,
      action: async () => {
        try {
          await minDuration(deleteAdminSurvey(selected.id));
          toast.success('Survey deleted');
          await loadSurveys(null);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to delete survey'
          );
          throw err;
        }
      },
    });
  };

  const openEdit = () => {
    if (!results) return;
    setEditor({
      mode: 'edit',
      initial: {
        title: results.survey.title,
        description: results.survey.description,
        questions: results.questions.map((q) => ({ id: q.id, text: q.text })),
      },
      responseCount: results.totalResponses,
    });
  };

  const handleSave = async (input: AdminSurveyInput) => {
    if (editor?.mode === 'edit' && surveyId) {
      await updateAdminSurvey(surveyId, input);
      toast.success('Survey saved');
      setEditor(null);
      await loadSurveys(surveyId);
      await loadResults();
    } else {
      const { id } = await createAdminSurvey(input);
      toast.success('Survey created');
      setEditor(null);
      setPage(1);
      await loadSurveys(id);
    }
  };

  const renderReset = (r: AdminSurveyResponse) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void handleReset(r)}
          className="cursor-pointer text-destructive hover:text-destructive"
          aria-label={`Reset ${r.username}'s answers`}
        >
          <RotateCcw />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope">Reset answers</TooltipContent>
    </Tooltip>
  );

  return (
    <AdminLayout>
      <AdminPage
        title="Surveys"
        icon={ClipboardList}
        description={results?.survey.description || undefined}
        actions={
          <>
            <AdminRefreshButton
              onClick={refresh}
              loading={loading || listLoading}
            />
            <Button
              className="cursor-pointer"
              onClick={() => setEditor({ mode: 'create' })}
            >
              <Plus />
              New survey
            </Button>
          </>
        }
      >
        {surveys.length > 0 ? (
          <AdminToolbar>
            <AdminSelect
              options={surveys.map((s) => ({
                value: s.id,
                label: `${s.title}${s.active ? ' (active)' : ''}`,
              }))}
              value={surveyId ?? ''}
              onChange={(value) => {
                setSurveyId(value);
                setPage(1);
                setSearch('');
                setDebouncedSearch('');
              }}
              aria-label="Survey"
              className="sm:w-80"
            />
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={openEdit}
              disabled={!results}
            >
              <Pencil />
              Edit
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => void handleToggleActive()}
              disabled={!selected || activeBusy}
            >
              {activeBusy ? (
                <Loader2 className="animate-spin" />
              ) : selected?.active ? (
                <Square />
              ) : (
                <Play />
              )}
              {selected?.active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer border-red-600 text-red-600 hover:bg-red-600 hover:text-white dark:hover:bg-red-600"
              onClick={() => void handleDelete()}
              disabled={!selected}
            >
              <Trash2 />
              Delete
            </Button>
          </AdminToolbar>
        ) : null}

        {!surveysLoaded || (loading && !results) ? (
          <AdminLoading label="Loading surveys…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading surveys"
            message={error}
            onRetry={refresh}
          />
        ) : !results ? (
          <AdminEmptyState icon={ClipboardList} title="No surveys yet" />
        ) : (
          <>
            <AdminStatCards
              columns={4}
              items={[
                {
                  label: 'Responses',
                  value: totalResponses.toLocaleString(),
                },
                {
                  label: 'Status',
                  value: results.survey.active ? 'Active' : 'Inactive',
                  sub: results.survey.active
                    ? 'Shown to every logged-in user who has not answered'
                    : activeSurvey
                      ? `"${activeSurvey.title}" is active`
                      : 'No survey is active',
                },
                { label: 'Questions', value: questions.length },
                {
                  label: 'Median time',
                  value: formatDuration(results.timing.medianDurationMs),
                  sub:
                    results.timing.timedResponses === 0
                      ? 'No timed responses yet'
                      : `${results.timing.reducedWeightResponses.toLocaleString()} fast response${results.timing.reducedWeightResponses === 1 ? '' : 's'} weighted down`,
                },
              ]}
            />

            <section className="grid gap-4">
              <div className="grid gap-1">
                <h2 className="text-sm font-medium">Results per question</h2>
                <p className="text-xs text-muted-foreground">
                  The white marker shows the result weighted by answer time.
                  Surveys finished faster than{' '}
                  {(results.timing.fullWeightMsPerQuestion / 1000).toFixed(1)}s
                  per question count less, down to 10% at instant clicks.
                </p>
              </div>
              <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
                {questions.map((q, i) => {
                  const answered = q.yes + q.no;
                  const yesPct = pct(q.yes, answered);
                  const noPct = answered > 0 ? 100 - yesPct : 0;
                  const weightedTotal = q.weightedYes + q.weightedNo;
                  const weightedYesPct = pct(q.weightedYes, weightedTotal);
                  return (
                    <div key={q.id} className="grid content-start gap-3">
                      <p className="text-sm text-zinc-300">
                        <span className="text-zinc-500 tabular-nums">
                          {i + 1}.
                        </span>{' '}
                        {q.text}
                      </p>
                      <div className="relative">
                        <div
                          className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800"
                          role="img"
                          aria-label={`${q.yes} yes, ${q.no} no`}
                        >
                          <div
                            className="h-full bg-green-600"
                            style={{ width: `${yesPct}%` }}
                          />
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${noPct}%` }}
                          />
                        </div>
                        {weightedTotal > 0 ? (
                          <div
                            className="absolute -top-1 h-[1.125rem] w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgb(9_9_11)]"
                            style={{ left: `${weightedYesPct}%` }}
                            role="img"
                            aria-label={`Weighted: ${weightedYesPct}% yes`}
                          />
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1 text-green-500">
                          <Check className="size-3.5" aria-hidden />
                          Yes {q.yes.toLocaleString()} ({yesPct}%)
                        </span>
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <X className="size-3.5" aria-hidden />
                          No {q.no.toLocaleString()} ({noPct}%)
                        </span>
                      </div>
                      {weightedTotal > 0 ? (
                        <p className="text-xs text-zinc-400 tabular-nums">
                          Weighted: {weightedYesPct}% yes ·{' '}
                          {100 - weightedYesPct}% no
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {results.combinations.length > 0 ? (
              <section className="grid gap-2">
                <h2 className="text-sm font-medium">Answer combinations</h2>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {questions.map((q, i) => (
                        <TableHead key={q.id}>
                          <QuestionTag index={i} text={q.text} />
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.combinations.map((c) => (
                      <TableRow key={JSON.stringify(c.answers)}>
                        {questions.map((q) => (
                          <TableCell key={q.id}>
                            <Answer value={c.answers[q.id]} />
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums">
                          {c.count.toLocaleString()}{' '}
                          <span className="text-muted-foreground">
                            ({pct(c.count, totalResponses)}%)
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            ) : null}

            <section className="grid gap-3">
              <h2 className="text-sm font-medium">Responses</h2>
              <AdminToolbar>
                <AdminSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by username or user ID…"
                  loading={search !== debouncedSearch || listLoading}
                />
              </AdminToolbar>

              {listLoading && responses.length === 0 ? (
                <AdminLoading label="Loading responses…" />
              ) : responses.length === 0 ? (
                <AdminEmptyState
                  icon={ClipboardList}
                  title={
                    debouncedSearch
                      ? 'No responses match your search'
                      : 'No responses yet'
                  }
                />
              ) : (
                <>
                  <AdminTable className="hidden md:block" minWidth="720px">
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        {questions.map((q, i) => (
                          <TableHead key={q.id}>
                            <QuestionTag index={i} text={q.text} />
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Time</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((r) => (
                        <TableRow key={r.userId}>
                          <TableCell>
                            <UserCell r={r} />
                          </TableCell>
                          {questions.map((q) => (
                            <TableCell key={q.id}>
                              <Answer value={r.answers[q.id]} />
                            </TableCell>
                          ))}
                          <TableCell className="text-right tabular-nums">
                            {formatDuration(r.durationMs)}
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {new Date(r.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderReset(r)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </AdminTable>

                  <div className="divide-y rounded-2xl border md:hidden">
                    {responses.map((r) => (
                      <div key={r.userId} className="grid gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <UserCell r={r} />
                          {renderReset(r)}
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                          {questions.map((q, i) => (
                            <div key={q.id} className="contents">
                              <dt>
                                <QuestionTag index={i} text={q.text} />
                              </dt>
                              <dd>
                                <Answer value={r.answers[q.id]} />
                              </dd>
                            </div>
                          ))}
                          <dt className="text-muted-foreground">Time</dt>
                          <dd className="tabular-nums">
                            {formatDuration(r.durationMs)}
                          </dd>
                          <dt className="text-muted-foreground">Submitted</dt>
                          <dd className="tabular-nums">
                            {new Date(r.createdAt).toLocaleString()}
                          </dd>
                        </dl>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center justify-end gap-3 sm:flex-row">
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Page {page} of {Math.max(1, pages)} ·{' '}
                      {total.toLocaleString()} total
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(pages, page + 1))}
                        disabled={page >= pages}
                      >
                        Next
                        <ChevronRight />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </AdminPage>

      <AdminSurveyEditor
        open={editor !== null}
        mode={editor?.mode ?? 'create'}
        initial={editor?.mode === 'edit' ? editor.initial : undefined}
        responseCount={editor?.mode === 'edit' ? editor.responseCount : 0}
        onClose={() => setEditor(null)}
        onSave={handleSave}
      />
      {confirmDialog}
    </AdminLayout>
  );
}
