import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Gift, Heart, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSection from '../../components/admin/AdminSection';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminNativeTable from '../../components/admin/AdminNativeTable';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminTextInput from '../../components/admin/AdminTextInput';
import AdminToggleSwitch from '../../components/admin/AdminToggleSwitch';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import {
  ADMIN_NATIVE_TBODY,
  ADMIN_NATIVE_TD,
  ADMIN_NATIVE_TH,
  ADMIN_NATIVE_THEAD,
  ADMIN_NATIVE_TR,
} from '../../components/admin/adminConstants';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import SupporterAvatar from '../../components/billing/SupporterAvatar';
import SupporterIcon from '../../components/billing/SupporterIcon';
import {
  addAdminExpense,
  deleteAdminExpense,
  fetchAdminBilling,
  grantPlan,
  setChartSourceEnabled,
  type AdminBillingOverview,
  type ChartSourceKey,
  type ExpenseCadence,
} from '../../utils/fetch/admin/billing';
import { fetchGiftRecipient } from '../../utils/fetch/billing';
import type { PaidPlan, PassMonths } from '../../types/billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { minDuration } from '@/lib/minDuration';
import {
  PLAN_NAMES,
  PLAN_TEXT,
  discordAvatarUrl,
  monthsLabel,
} from '@/lib/plans';
import { cn } from '@/lib/utils';

const SOURCE_INFO: Record<ChartSourceKey, { name: string; detail: string }> = {
  pfatc: {
    name: 'PFATC charts',
    detail: 'Bundled charts in the session drawer',
  },
  cephie: {
    name: 'Cephie Charts',
    detail: 'Generated charts, full size for Supporters',
  },
  celesbit: {
    name: 'Celesbit charts',
    detail: 'Partner plates in the session drawer',
  },
  chartfox: {
    name: 'ChartFox',
    detail: 'Real-world charts for linked accounts',
  },
};

const CADENCE_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'once', label: 'One-time' },
];

const CADENCE_LABEL: Record<ExpenseCadence, string> = {
  month: 'a month',
  year: 'a year',
  once: 'once',
};

const SOURCE_LABEL = {
  subscription: 'Subscription',
  pass: 'Pass',
  gift: 'Gift',
  admin: 'Granted',
} as const;

const thisMonth = () => new Date().toISOString().slice(0, 7);

function useMoney(currency: string | undefined) {
  return useMemo(() => {
    const format = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency ?? 'usd').toUpperCase(),
    });
    return (cents: number) => format.format(cents / 100);
  }, [currency]);
}

const formatMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

function PlanLabel({ plan }: { plan: PaidPlan }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        PLAN_TEXT[plan]
      )}
    >
      <SupporterIcon className="size-4" />
      {PLAN_NAMES[plan]}
    </span>
  );
}

export default function AdminBilling() {
  const [data, setData] = useState<AdminBillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [togglingSource, setTogglingSource] = useState<ChartSourceKey | null>(
    null
  );
  const { confirm, confirmDialog } = useAdminConfirm();

  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<ExpenseCadence>('month');
  const [startsMonth, setStartsMonth] = useState(thisMonth);
  const [savingExpense, setSavingExpense] = useState(false);

  const [grantName, setGrantName] = useState('');
  const [grantMonths, setGrantMonths] = useState<PassMonths>(1);
  const [granting, setGranting] = useState(false);

  const money = useMoney(data?.currency);

  const load = useCallback(async (refresh = false) => {
    try {
      setError(null);
      setData(await fetchAdminBilling(refresh));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSource = async (source: ChartSourceKey) => {
    if (!data) return;
    const enabled = !data.chartSources[source];
    setTogglingSource(source);
    try {
      const chartSources = await minDuration(
        setChartSourceEnabled(source, enabled)
      );
      setData({ ...data, chartSources });
      toast.success(
        `${SOURCE_INFO[source].name} ${enabled ? 'turned on' : 'turned off'}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setTogglingSource(null);
    }
  };

  const amountCents = Math.round(Number(amount) * 100);
  const expenseValid =
    label.trim().length > 0 &&
    amountCents > 0 &&
    /^\d{4}-\d{2}$/.test(startsMonth);

  const submitExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!data || !expenseValid) return;
    setSavingExpense(true);
    try {
      const expenses = await minDuration(
        addAdminExpense({
          label: label.trim(),
          amountCents,
          cadence,
          startsMonth,
          endsMonth: null,
        })
      );
      setData({ ...data, expenses });
      setLabel('');
      setAmount('');
      toast.success('Expense added');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const removeExpense = (id: number, name: string) =>
    confirm({
      title: `Delete ${name}?`,
      description: 'It stops counting towards spending in every month.',
      confirmText: 'Delete',
      destructive: true,
      action: async () => {
        await deleteAdminExpense(id);
        toast.success('Expense deleted');
        await load();
      },
    });

  const submitGrant = async (e: FormEvent) => {
    e.preventDefault();
    const name = grantName.trim();
    if (!name) return;
    setGranting(true);
    try {
      await minDuration(
        (async () => {
          const recipient = await fetchGiftRecipient(name);
          await grantPlan(recipient.id, 'supporter', grantMonths);
        })()
      );
      toast.success(
        `Gave ${name} ${monthsLabel(grantMonths)} of ${PLAN_NAMES.supporter}`
      );
      setGrantName('');
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not grant plan');
    } finally {
      setGranting(false);
    }
  };

  const supporters = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.supporters ?? [];
    return q
      ? list.filter((s) =>
          [s.username, s.userId].some((v) => v?.toLowerCase().includes(q))
        )
      : list;
  }, [data, query]);

  const current = data?.months?.at(-1);
  const months = data?.months ? [...data.months].reverse() : null;

  return (
    <AdminLayout>
      <TooltipProvider>
        <AdminPage
          title="Plans & revenue"
          description="Who supports PFControl, what comes in and what goes out."
          icon={Wallet}
          actions={
            <AdminRefreshButton
              onClick={() => {
                setLoading(true);
                void load(true);
              }}
              loading={loading}
            />
          }
        >
          {loading && !data ? (
            <AdminLoading />
          ) : error ? (
            <AdminErrorState
              title="Failed to load billing"
              message={error}
              onRetry={() => void load()}
            />
          ) : data ? (
            <>
              <AdminStatCards
                items={[
                  {
                    label: 'Supporters',
                    value: data.plans.supporters,
                    sub: 'Active right now',
                  },
                  {
                    label: 'Monthly recurring',
                    value: money(data.monthlyRecurringCents),
                    sub: `${data.plans.subscriptions} renewing, ${data.plans.passes} on passes`,
                  },
                  {
                    label: 'Net this month',
                    value: current ? money(current.netCents) : '–',
                    sub: current
                      ? `${money(current.grossCents)} gross`
                      : 'Stripe not connected',
                  },
                  {
                    label: 'Profit this month',
                    value: current ? (
                      <span
                        className={
                          current.profitCents < 0
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }
                      >
                        {money(current.profitCents)}
                      </span>
                    ) : (
                      '–'
                    ),
                    sub: current
                      ? `after ${money(current.expenseCents)} spending`
                      : undefined,
                  },
                ]}
              />

              <AdminSection
                title="Revenue"
                description="From Stripe, last 12 months. Yearly costs are spread across months."
              >
                {data.stripeError ? (
                  <AdminErrorState
                    title="Stripe could not be reached"
                    message={data.stripeError}
                    onRetry={() => void load(true)}
                  />
                ) : !months ? (
                  <AdminEmptyState
                    icon={Wallet}
                    title="Stripe isn't connected"
                    description="Set STRIPE_SECRET_KEY to see revenue."
                  />
                ) : (
                  <AdminNativeTable minWidth="720px">
                    <thead className={ADMIN_NATIVE_THEAD}>
                      <tr className={ADMIN_NATIVE_TR}>
                        <th className={ADMIN_NATIVE_TH}>Month</th>
                        <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                          Gross
                        </th>
                        <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                          Stripe fees
                        </th>
                        <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                          Refunds
                        </th>
                        <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                          Net
                        </th>
                        <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                          Spending
                        </th>
                        <th className={cn(ADMIN_NATIVE_TH, 'text-right')}>
                          Profit
                        </th>
                      </tr>
                    </thead>
                    <tbody className={ADMIN_NATIVE_TBODY}>
                      {months.map((row) => (
                        <tr key={row.month} className={ADMIN_NATIVE_TR}>
                          <td className={cn(ADMIN_NATIVE_TD, 'font-medium')}>
                            {formatMonth(row.month)}
                          </td>
                          {(
                            [
                              row.grossCents,
                              row.feeCents,
                              row.refundCents,
                              row.netCents,
                              row.expenseCents,
                            ] as number[]
                          ).map((value, i) => (
                            <td
                              key={i}
                              className={cn(
                                ADMIN_NATIVE_TD,
                                'text-right tabular-nums',
                                value === 0 && 'text-muted-foreground'
                              )}
                            >
                              {money(value)}
                            </td>
                          ))}
                          <td
                            className={cn(
                              ADMIN_NATIVE_TD,
                              'text-right font-semibold tabular-nums',
                              row.profitCents < 0
                                ? 'text-red-400'
                                : row.profitCents > 0
                                  ? 'text-emerald-400'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {money(row.profitCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminNativeTable>
                )}
              </AdminSection>

              <div className="grid gap-6 xl:grid-cols-2">
                <AdminSection
                  title="Spending"
                  description="Servers, domains and other costs. Stripe fees are counted automatically."
                >
                  <div className="flex flex-col gap-4 rounded-2xl border p-4">
                    <form
                      onSubmit={submitExpense}
                      className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <AdminTextInput
                        label="What"
                        className="sm:col-span-4"
                        value={label}
                        onChange={setLabel}
                        placeholder="Hetzner server"
                        required
                      />
                      <AdminTextInput
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={setAmount}
                        placeholder="12.00"
                        required
                      />
                      <div className="grid gap-2">
                        <Label>Repeats</Label>
                        <AdminSelect
                          options={CADENCE_OPTIONS}
                          value={cadence}
                          onChange={(v) => setCadence(v as ExpenseCadence)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="expense-start">From</Label>
                        <Input
                          id="expense-start"
                          type="month"
                          value={startsMonth}
                          onChange={(e) => setStartsMonth(e.target.value)}
                          className="[color-scheme:dark]"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={!expenseValid || savingExpense}
                      >
                        {savingExpense ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Plus />
                        )}
                        Add
                      </Button>
                    </form>

                    {data.expenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No spending recorded yet.
                      </p>
                    ) : (
                      <ul className="flex flex-col">
                        {data.expenses.map((expense) => (
                          <li
                            key={expense.id}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {expense.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Since {formatMonth(expense.startsMonth)}
                                {expense.endsMonth
                                  ? `, until ${formatMonth(expense.endsMonth)}`
                                  : ''}
                              </p>
                            </div>
                            <span className="text-sm tabular-nums">
                              {money(expense.amountCents)}{' '}
                              <span className="text-muted-foreground">
                                {CADENCE_LABEL[expense.cadence]}
                              </span>
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${expense.label}`}
                                  onClick={() =>
                                    removeExpense(expense.id, expense.label)
                                  }
                                  className="cursor-pointer text-red-500 hover:bg-red-600 hover:text-white"
                                >
                                  <Trash2 />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent
                                className="shadcn-scope"
                                sideOffset={6}
                              >
                                Delete
                              </TooltipContent>
                            </Tooltip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </AdminSection>

                <div className="flex flex-col gap-6">
                  <AdminSection
                    title="Chart sources"
                    description="Switch a source off everywhere: the Charts page, sessions and the API."
                  >
                    <div className="divide-y rounded-2xl border">
                      {(Object.keys(SOURCE_INFO) as ChartSourceKey[]).map(
                        (source) => (
                          <div
                            key={source}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {SOURCE_INFO[source].name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {SOURCE_INFO[source].detail}
                              </p>
                            </div>
                            {togglingSource === source && (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            )}
                            <AdminToggleSwitch
                              checked={data.chartSources[source]}
                              onChange={() => void toggleSource(source)}
                              disabled={!!togglingSource}
                              aria-label={`${SOURCE_INFO[source].name} enabled`}
                            />
                          </div>
                        )
                      )}
                    </div>
                  </AdminSection>

                  <AdminSection
                    title="Grant a plan"
                    description="Free pass for staff, giveaways or support cases. It never renews."
                  >
                    <form
                      onSubmit={submitGrant}
                      className="grid items-end gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_9rem_auto]"
                    >
                      <AdminTextInput
                        label="Username"
                        value={grantName}
                        onChange={setGrantName}
                        placeholder="PFControl username"
                        required
                      />
                      <div className="grid gap-2">
                        <Label>Length</Label>
                        <AdminSelect
                          options={[1, 3, 12].map((m) => ({
                            value: String(m),
                            label: monthsLabel(m),
                          }))}
                          value={String(grantMonths)}
                          onChange={(v) =>
                            setGrantMonths(Number(v) as PassMonths)
                          }
                          className="sm:w-full"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={!grantName.trim() || granting}
                      >
                        {granting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Gift />
                        )}
                        Grant
                      </Button>
                    </form>
                  </AdminSection>
                </div>
              </div>

              <AdminSection
                title="Supporters"
                description={`${data.supporters.length} people with an active plan.`}
                actions={
                  <AdminSearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search username or ID"
                  />
                }
              >
                {data.supporters.length === 0 ? (
                  <AdminEmptyState
                    icon={Heart}
                    title="No supporters yet"
                    description="People with an active plan show up here."
                  />
                ) : supporters.length === 0 ? (
                  <AdminEmptyState
                    title="No matches"
                    description={`Nobody matches “${query.trim()}”.`}
                  />
                ) : (
                  <AdminNativeTable minWidth="760px">
                    <thead className={ADMIN_NATIVE_THEAD}>
                      <tr className={ADMIN_NATIVE_TR}>
                        <th className={ADMIN_NATIVE_TH}>User</th>
                        <th className={ADMIN_NATIVE_TH}>Plan</th>
                        <th className={ADMIN_NATIVE_TH}>How</th>
                        <th className={ADMIN_NATIVE_TH}>Since</th>
                        <th className={ADMIN_NATIVE_TH}>Until</th>
                      </tr>
                    </thead>
                    <tbody className={ADMIN_NATIVE_TBODY}>
                      {supporters.map((s) => (
                        <tr key={s.userId} className={ADMIN_NATIVE_TR}>
                          <td className={ADMIN_NATIVE_TD}>
                            <div className="flex items-center gap-3">
                              <SupporterAvatar
                                src={discordAvatarUrl(s.userId, s.avatar, 64)}
                                alt=""
                                plan={s.plan}
                                className="size-8"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {s.username ?? 'Unknown'}
                                </p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                  {s.userId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={ADMIN_NATIVE_TD}>
                            <PlanLabel plan={s.plan} />
                          </td>
                          <td className={ADMIN_NATIVE_TD}>
                            {s.sources
                              .map((src) => SOURCE_LABEL[src])
                              .join(', ')}
                            {s.interval && (
                              <span className="text-muted-foreground">
                                {' '}
                                ({s.interval === 'year' ? 'yearly' : 'monthly'})
                              </span>
                            )}
                            {s.status === 'past_due' && (
                              <span className="text-red-400">
                                {' '}
                                payment failed
                              </span>
                            )}
                          </td>
                          <td className={cn(ADMIN_NATIVE_TD, 'tabular-nums')}>
                            {formatDate(s.since)}
                          </td>
                          <td className={cn(ADMIN_NATIVE_TD, 'tabular-nums')}>
                            {formatDate(s.endsAt)}
                            <span className="text-muted-foreground">
                              {s.renews ? ', renews' : ', ends'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminNativeTable>
                )}
              </AdminSection>
            </>
          ) : null}
          {confirmDialog}
        </AdminPage>
      </TooltipProvider>
    </AdminLayout>
  );
}
