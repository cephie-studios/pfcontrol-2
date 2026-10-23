import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  Check,
  Copy,
  Gift,
  Heart,
  Loader2,
  Minus,
  PartyPopper,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import PageHero from '../components/common/PageHero';
import CheckoutDialog from '../components/billing/CheckoutDialog';
import SupporterAvatar from '../components/billing/SupporterAvatar';
import SupporterWall from '../components/billing/SupporterWall';
import SupporterIcon from '../components/billing/SupporterIcon';
import RingColorPicker from '../components/billing/RingColorPicker';
import RingPicker from '../components/billing/RingPicker';
import PlanFeatures from '../components/billing/PlanFeatures';
import { useAuth } from '../hooks/auth/useAuth';
import {
  fetchBillingCatalog,
  fetchMyPlan,
  openBillingPortal,
  updateSupporterPrefs,
} from '../utils/fetch/billing';
import type {
  BillingCatalog,
  CheckoutRequest,
  MyPlan,
  PaidPlan,
  PassMonths,
  Plan,
  PlanLimits,
  SupporterRing,
} from '../types/billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { minDuration } from '@/lib/minDuration';
import {
  DEFAULT_RING_COLORS,
  PASS_MONTHS,
  PLAN_NAMES,
  PLAN_TEXT,
  discordAvatarUrl,
  formatPrice,
  giftLink,
  monthsLabel,
  nameStyle,
  SUPPORTER_RANKS,
  supporterRank,
} from '@/lib/plans';
import { cn } from '@/lib/utils';

type Billing = 'month' | 'year' | 'pass';
type Cell = boolean | number | string;

const PLANS: Plan[] = ['free', 'supporter'];

// Segments size to their own text; the default stretches them all equally.
const SEGMENT_CLASS =
  'cursor-pointer gap-1.5 px-3 data-[spacing=0]:flex-none sm:px-4';

const CHECK_TEXT: Record<Plan, string> = {
  free: 'text-zinc-500',
  supporter: PLAN_TEXT.supporter,
};

const FAQ = [
  {
    q: 'Is PFControl still free?',
    a: 'Yes. Every ATC tool stays free, and nothing you use today moves behind a paywall. Plans add charts, room and flair and pay for the servers. They never give anyone an advantage in a session.',
  },
  {
    q: 'How do I cancel?',
    a: 'Go to Settings → Plan → Manage billing and cancel with one click. You keep your perks until the end of the period you paid for.',
  },
  {
    q: 'I want my parents to pay',
    a: 'Pick "A parent pays" when you upgrade, or copy your gift link above. They open it, choose a pass and pay. They don\'t need an account, and passes never renew on their own.',
  },
  {
    q: 'What happens when my plan ends?',
    a: 'Your account goes back to Free. Your sessions, flights and settings stay, but only the free limits apply to new ones, and an animated background switches back to the default.',
  },
  {
    q: 'Can I get a refund?',
    a: "Perks start as soon as you pay, so used time can't be refunded. If something went wrong, like a double charge, contact us and we'll sort it out.",
  },
];

function compareRows(limits: Record<Plan, PlanLimits>) {
  const pick = <K extends keyof PlanLimits>(key: K) =>
    PLANS.map((p) => limits[p][key]);
  return [
    {
      label: 'Sessions, strips, PDC, ATIS and ACARS',
      values: [true, true],
    },
    { label: 'Text and voice chat', values: [true, true] },
    { label: 'Community charts and ChartFox', values: [true, true] },
    { label: 'Cephie Charts', values: [false, true] },
    { label: 'Active sessions', values: pick('maxSessions') },
    {
      label: 'Featured flights on your profile',
      values: pick('featuredFlights'),
    },
    { label: 'Photos per flight', values: pick('snapsPerFlight') },
    { label: 'Animated backgrounds', values: pick('animatedBackgrounds') },
    { label: 'Supporter badge and rank', values: [false, true] },
    { label: 'Animated avatar ring', values: [false, true] },
    { label: 'Gradient name', values: [false, true] },
    { label: 'Your own ring and name colours', values: [false, true] },
    { label: 'Early access on canary', values: [false, true] },
  ] satisfies { label: string; values: Cell[] }[];
}

function priceFor(
  catalog: BillingCatalog | null,
  plan: PaidPlan,
  billing: Billing,
  months: PassMonths
) {
  if (!catalog) return null;
  const prices = catalog.plans[plan];
  const amount =
    billing === 'pass'
      ? prices.passes[months]
      : billing === 'year'
        ? prices.year
        : prices.month;
  return formatPrice(amount, catalog.currency);
}

function priceNote(billing: Billing, months: PassMonths) {
  if (billing === 'year') return 'a year';
  if (billing === 'month') return 'a month';
  return `once, for ${monthsLabel(months)}`;
}

function CompareCell({ value, plan }: { value: Cell; plan: Plan }) {
  if (value === true) {
    return (
      <Check
        aria-label="Included"
        className={cn('mx-auto size-5', CHECK_TEXT[plan])}
      />
    );
  }
  if (value === false) {
    return (
      <Minus
        aria-label="Not included"
        className="mx-auto size-4 text-zinc-700"
      />
    );
  }
  return (
    <span
      className={cn(
        'font-semibold tabular-nums',
        plan === 'supporter' ? 'text-amber-500' : 'text-zinc-300'
      )}
    >
      {value}
    </span>
  );
}

export default function Pricing() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState<Billing>('month');
  const [months, setMonths] = useState<PassMonths>(3);
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const [previewRing, setPreviewRing] = useState<SupporterRing>('aurora');
  const [previewColors, setPreviewColors] = useState(DEFAULT_RING_COLORS);
  const [giftName, setGiftName] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const successPlan =
    searchParams.get('checkout') === 'success'
      ? (searchParams.get('plan') as PaidPlan | null)
      : null;

  useEffect(() => {
    fetchBillingCatalog()
      .then(setCatalog)
      .catch(() => setError('Plans could not be loaded. Try again later.'));
  }, []);

  useEffect(() => {
    if (!user) {
      setMyPlan(null);
      return;
    }
    fetchMyPlan()
      .then(setMyPlan)
      .catch(() => setMyPlan(null));
  }, [user, successPlan]);

  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!successPlan || refreshedFor.current === successPlan) return;
    refreshedFor.current = successPlan;
    void refreshUser();
  }, [successPlan, refreshUser]);

  const canSaveRing = !!myPlan && myPlan.plan !== 'free';

  useEffect(() => {
    if (!myPlan || myPlan.plan === 'free') return;
    setPreviewRing(myPlan.prefs.ring);
    setPreviewColors(myPlan.prefs.colors);
  }, [myPlan]);

  const [ringSaving, setRingSaving] = useState(false);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingColors = useRef<string[] | null>(null);

  const saveRingPrefs = async (prefs: {
    ring?: SupporterRing;
    colors?: string[];
  }) => {
    setRingSaving(true);
    try {
      await minDuration(updateSupporterPrefs(prefs));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setRingSaving(false);
    }
  };

  const flushColors = () => {
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = null;
    const colors = pendingColors.current;
    pendingColors.current = null;
    if (colors) void saveRingPrefs({ colors });
  };

  useEffect(
    () => () => {
      if (colorTimer.current) clearTimeout(colorTimer.current);
      if (pendingColors.current)
        void updateSupporterPrefs({ colors: pendingColors.current });
    },
    []
  );

  const chooseRing = (ring: SupporterRing) => {
    setPreviewRing(ring);
    if (canSaveRing) void saveRingPrefs({ ring });
  };

  const chooseColors = (colors: string[]) => {
    setPreviewColors(colors);
    if (!canSaveRing) return;
    pendingColors.current = colors;
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(flushColors, 600);
  };

  const wallSupporters = useMemo(() => {
    const supporters = catalog?.supporters;
    if (!supporters || !user || !canSaveRing) return supporters;
    const mine = <T extends { id: string }>(m: T) =>
      m.id === user.id ? { ...m, ring: previewRing, colors: previewColors } : m;
    return {
      ...supporters,
      wall: supporters.wall.map(mine),
      admins: supporters.admins.map(mine),
    };
  }, [catalog, user, canSaveRing, previewRing, previewColors]);

  const currentPlan: Plan = myPlan?.supporterPlan ?? 'free';
  const loading = !catalog && !error;
  const enabled = catalog?.enabled ?? false;
  const loginHref = `/login?callback=${encodeURIComponent('/pricing')}`;
  const limits = catalog?.limits;
  const rows = useMemo(() => (limits ? compareRows(limits) : null), [limits]);

  const choose = (plan: PaidPlan) => {
    if (billing === 'pass') setCheckout({ kind: 'pass', plan, months });
    else setCheckout({ kind: 'subscription', plan, interval: billing });
  };

  const manageBilling = async () => {
    setPortalLoading(true);
    try {
      window.location.href = await minDuration(openBillingPortal());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not open billing'
      );
      setPortalLoading(false);
    }
  };

  const copyGiftLink = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(giftLink(user.username));
      setCopied(true);
      toast.success('Gift link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const openGift = (e: FormEvent) => {
    e.preventDefault();
    const name = giftName.trim();
    if (name) navigate(`/gift/${encodeURIComponent(name)}`);
  };

  const yearlySavings = useMemo(() => {
    if (!catalog) return null;
    const { month, year } = catalog.plans.supporter;
    return Math.round(12 - year / month);
  }, [catalog]);

  const renderCta = (plan: PaidPlan) => {
    const base = 'h-11 w-full px-8 text-base';
    if (!user && !authLoading) {
      return (
        <Button asChild className={base}>
          <a href={loginHref}>Log in to become a {PLAN_NAMES[plan]}</a>
        </Button>
      );
    }
    if (!enabled) {
      return (
        <Button variant="outline" disabled className={base}>
          Coming soon
        </Button>
      );
    }
    if (billing !== 'pass' && myPlan?.subscription) {
      const isCurrent =
        myPlan.subscription.plan === plan &&
        myPlan.subscription.interval === billing;
      return (
        <Button
          className={base}
          onClick={manageBilling}
          disabled={portalLoading || isCurrent}
        >
          {portalLoading && <Loader2 className="animate-spin" />}
          {isCurrent ? 'Your plan' : 'Switch in Manage billing'}
        </Button>
      );
    }
    return (
      <Button className={base} onClick={() => choose(plan)}>
        <SupporterIcon />
        {billing === 'pass'
          ? `Get ${monthsLabel(months)} of ${PLAN_NAMES[plan]}`
          : currentPlan === plan
            ? 'Subscribe instead'
            : `Become a ${PLAN_NAMES[plan]}`}
      </Button>
    );
  };

  const renderPrice = (plan: PaidPlan) => (
    <div className="flex items-baseline gap-2">
      {loading ? (
        <Skeleton className="h-10 w-20" />
      ) : (
        <span className="text-5xl font-black tracking-tight">
          {priceFor(catalog, plan, billing, months)}
        </span>
      )}
      <span className="text-zinc-400">
        {priceNote(billing, months)}
        {billing === 'year' && yearlySavings ? (
          <span className="text-emerald-400 sm:hidden">
            , {yearlySavings} months free
          </span>
        ) : null}
      </span>
    </div>
  );

  const renderCurrent = (plan: Plan) =>
    !!user && currentPlan === plan ? (
      <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
        <Check className="size-4" />
        Your plan
      </span>
    ) : null;

  const previewAvatar = user?.avatar ?? discordAvatarUrl('0', null);
  const previewName = user?.username ?? 'You';
  const supporterLimits = limits?.supporter;

  return (
    <TooltipProvider>
      <div className="shadcn-scope min-h-screen bg-background text-foreground">
        <Navbar />

        <PageHero title="SUPPORT PFCONTROL">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="max-w-xl text-sm text-zinc-300 sm:text-base">
              PFControl is free and always will be. For $1 a month, Supporters
              keep the servers running and get Cephie Charts, more room and some
              flair in return.
            </p>
            {catalog && catalog.supporters.count > 0 && (
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                <Heart className="size-4 text-sky-500" />
                {catalog.supporters.count}{' '}
                {catalog.supporters.count === 1
                  ? 'pilot supports'
                  : 'pilots support'}{' '}
                PFControl right now
              </span>
            )}
          </div>
        </PageHero>

        <div className="relative z-10 mx-auto -mt-6 flex w-full max-w-6xl flex-col gap-14 px-4 pb-20 sm:px-6 md:-mt-8">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <section className="flex flex-col gap-10">
            <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr]">
              <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
                <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <h2 className="flex items-center gap-3 text-3xl font-black sm:text-4xl">
                    <SupporterIcon className="size-9 text-amber-500" />
                    <p className="mb-2">Supporter</p>
                  </h2>
                  {renderCurrent('supporter')}
                </div>
                <div className="flex flex-col items-center gap-3 lg:items-start">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={billing}
                    onValueChange={(v) => v && setBilling(v as Billing)}
                    aria-label="How you want to pay"
                    className="bg-zinc-900"
                  >
                    <ToggleGroupItem value="month" className={SEGMENT_CLASS}>
                      Monthly
                    </ToggleGroupItem>
                    <ToggleGroupItem value="year" className={SEGMENT_CLASS}>
                      Yearly
                      {yearlySavings ? (
                        <span className="hidden text-emerald-400 sm:inline">
                          {yearlySavings} months free
                        </span>
                      ) : null}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="pass" className={SEGMENT_CLASS}>
                      Prepaid pass
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {billing === 'pass' && (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      value={String(months)}
                      onValueChange={(v) =>
                        v && setMonths(Number(v) as PassMonths)
                      }
                      aria-label="Pass length"
                      className="bg-zinc-900"
                    >
                      {PASS_MONTHS.map((m) => (
                        <ToggleGroupItem
                          key={m}
                          value={String(m)}
                          className={SEGMENT_CLASS}
                        >
                          {monthsLabel(m)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                </div>
                {renderPrice('supporter')}
                <div className="w-full sm:w-auto">{renderCta('supporter')}</div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <SupporterAvatar
                  src={previewAvatar}
                  alt=""
                  plan="supporter"
                  ring={previewRing}
                  colors={previewColors}
                  className="size-32"
                />
                <span
                  className="supporter-name-gradient max-w-full truncate text-2xl font-bold"
                  style={nameStyle(previewRing, previewColors)}
                >
                  {previewName}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-500">
                  <SupporterIcon className="size-5" />
                  Supporter
                </span>
                <RingPicker
                  value={previewRing}
                  colors={previewColors}
                  onChange={chooseRing}
                  className="mt-2"
                />
                {previewRing === 'custom' && (
                  <RingColorPicker
                    colors={previewColors}
                    onChange={chooseColors}
                    className="mt-1"
                  />
                )}
                <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                  {ringSaving && <Loader2 className="size-3.5 animate-spin" />}
                  {canSaveRing
                    ? ringSaving
                      ? 'Saving your ring'
                      : 'Your ring is saved automatically'
                    : 'Try a ring on your avatar'}
                </span>
              </div>
            </div>

            <PlanFeatures limits={supporterLimits} columns={4} tiles />
          </section>

          <SupporterWall supporters={wallSupporters} />

          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">Supporter ranks</h2>
              <p className="text-zinc-400">
                Every month you support PFControl counts, prepaid and gifted
                time included, and gaps never reset your progress.
              </p>
            </div>
            <ol className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {[...SUPPORTER_RANKS].reverse().map((rank) => {
                const current =
                  !!myPlan &&
                  myPlan.supporterMonths > 0 &&
                  supporterRank(myPlan.supporterMonths).name === rank.name;
                return (
                  <li key={rank.name} className="flex flex-col gap-1">
                    <SupporterIcon className={cn('size-7', rank.text)} />
                    <span className={cn('text-xl font-extrabold', rank.text)}>
                      {rank.name}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {rank.months === 0
                        ? 'From day one'
                        : `After ${monthsLabel(rank.months)}`}
                    </span>
                    {current && (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                        <Check className="size-4" />
                        Your rank
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {!!myPlan && myPlan.supporterMonths > 0 && (
              <p className="text-sm text-zinc-400">
                {monthsLabel(myPlan.supporterMonths)} so far.{' '}
                {supporterRank(myPlan.supporterMonths).next
                  ? `${supporterRank(myPlan.supporterMonths).next!.name} at ${monthsLabel(supporterRank(myPlan.supporterMonths).next!.months)}.`
                  : "That's the top rank. Thank you!"}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">Gifting</h2>
            <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
              <form className="flex flex-col gap-4" onSubmit={openGift}>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 text-blue-500">
                    <Gift className="size-5" />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold">Gift a pass</span>
                    <span className="text-sm text-zinc-500">
                      Prepaid, never renews
                    </span>
                  </div>
                </div>
                <div className="relative mt-auto">
                  <Input
                    id="gift-username"
                    aria-label="PFControl username"
                    value={giftName}
                    onChange={(e) => setGiftName(e.target.value)}
                    placeholder="PFControl username"
                    maxLength={32}
                    className="h-11 rounded-xl border-2 border-zinc-800 bg-zinc-900 pr-24 focus-visible:border-ring focus-visible:ring-0 dark:bg-zinc-900"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2"
                    disabled={!giftName.trim()}
                  >
                    <Gift />
                    Gift
                  </Button>
                </div>
              </form>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-pink-500 text-pink-500">
                    <Heart className="size-5" />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold">Get one gifted</span>
                    <span className="text-sm text-zinc-500">
                      Send your link, no account needed
                    </span>
                  </div>
                </div>
                {user ? (
                  <div className="relative mt-auto">
                    <span className="flex h-11 min-w-0 items-center truncate rounded-xl border-2 border-zinc-800 bg-zinc-900 pr-28 pl-3 font-mono text-xs text-zinc-300">
                      {giftLink(user.username)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-1/2 right-1.5 -translate-y-1/2"
                      onClick={copyGiftLink}
                    >
                      {copied ? <Check /> : <Copy />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    asChild
                    className="mt-auto h-11 self-start"
                  >
                    <a href={loginHref}>
                      <User />
                      Log in for your gift link
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">Compare plans</h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="py-3 pl-4 text-left">
                      <span className="sr-only">Feature</span>
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan}
                        scope="col"
                        className={cn(
                          'w-24 px-3 py-3 text-center text-base font-bold sm:w-28',
                          plan === 'free'
                            ? 'text-zinc-400'
                            : PLAN_TEXT[plan as PaidPlan]
                        )}
                      >
                        {PLAN_NAMES[plan]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows
                    ? rows.map((row) => (
                        <tr
                          key={row.label}
                          className="transition-colors hover:bg-zinc-900 [&>*:first-child]:rounded-l-xl [&>*:last-child]:rounded-r-xl"
                        >
                          <th
                            scope="row"
                            className="py-2.5 pl-4 text-left font-normal text-zinc-300"
                          >
                            {row.label}
                          </th>
                          {row.values.map((value, i) => (
                            <td
                              key={PLANS[i]}
                              className="px-3 py-2.5 text-center"
                            >
                              <CompareCell value={value} plan={PLANS[i]} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={3} className="py-2.5 pl-4">
                            <Skeleton className="h-5 w-full" />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold">Questions</h2>
            <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
              {FAQ.map((item) => (
                <div key={item.q} className="flex flex-col gap-2">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="text-zinc-400">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <CheckoutDialog
          request={checkout}
          catalog={catalog}
          askParentFor={user?.username ?? null}
          onClose={() => setCheckout(null)}
        />

        <Dialog
          open={!!successPlan}
          onOpenChange={(open) => !open && setSearchParams({})}
        >
          <DialogContent className="shadcn-scope sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <PartyPopper className="size-12 text-amber-500" />
              <DialogTitle className="text-2xl">
                You're a Supporter now!
              </DialogTitle>
              <DialogDescription>
                Thanks for keeping PFControl flying. Your perks show up within a
                few seconds. A receipt is on its way by email.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button variant="outline" asChild>
                <Link to="/settings#plan-settings">
                  <SettingsIcon />
                  Plan settings
                </Link>
              </Button>
              {user && (
                <Button asChild>
                  <Link to={`/user/${encodeURIComponent(user.username)}`}>
                    <User />
                    See my profile
                  </Link>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
