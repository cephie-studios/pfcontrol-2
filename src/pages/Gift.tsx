import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  Gift as GiftIcon,
  PartyPopper,
  ShieldCheck,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PageHero from '../components/common/PageHero';
import CheckoutDialog from '../components/billing/CheckoutDialog';
import SupporterAvatar from '../components/billing/SupporterAvatar';
import SupporterIcon from '../components/billing/SupporterIcon';
import PlanFeatures from '../components/billing/PlanFeatures';
import { useAuth } from '../hooks/auth/useAuth';
import {
  fetchBillingCatalog,
  fetchGiftRecipient,
} from '../utils/fetch/billing';
import type {
  BillingCatalog,
  CheckoutRequest,
  GiftRecipient,
  PassMonths,
} from '../types/billing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  PASS_MONTHS,
  PLAN_NAMES,
  PLAN_TEXT,
  discordAvatarUrl,
  formatPrice,
  monthsLabel,
} from '@/lib/plans';
import { cn } from '@/lib/utils';

export default function Gift() {
  const { username = '' } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [recipient, setRecipient] = useState<GiftRecipient | null>(null);
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [error, setError] = useState('');
  const [months, setMonths] = useState<PassMonths>(3);
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const success = searchParams.get('checkout') === 'success';

  useEffect(() => {
    setError('');
    Promise.all([fetchGiftRecipient(username), fetchBillingCatalog()])
      .then(([r, c]) => {
        setRecipient(r);
        setCatalog(c);
      })
      .catch(() => setError("We couldn't find a pilot with that username."));
  }, [username]);

  const isSelf = !!user && recipient?.id === user.userId;
  const plan = 'supporter';
  const passPrice = (m: PassMonths) =>
    catalog ? formatPrice(catalog.plans[plan].passes[m], catalog.currency) : '';
  const price = passPrice(months);
  const loading = !recipient && !error;

  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <PageHero title="GIFT PFCONTROL">
        <p className="max-w-xl text-center text-sm text-zinc-300 sm:text-base">
          A one-time pass with charts and supporter perks. It never renews.
        </p>
      </PageHero>

      <div className="relative z-10 mx-auto -mt-6 flex w-full max-w-6xl flex-col gap-6 px-4 pb-20 sm:px-6 md:-mt-8">
        {error ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <AlertTriangle className="size-8 text-amber-400" />
            <p className="text-zinc-300">{error}</p>
            <Button variant="outline" asChild>
              <Link to="/pricing">Back to Support</Link>
            </Button>
          </div>
        ) : (
          <>
            {success && (
              <div className="flex items-start gap-3 rounded-2xl border-2 border-emerald-600 bg-zinc-900 px-5 py-4">
                <PartyPopper className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                <div className="space-y-0.5 text-sm">
                  <p className="font-medium text-emerald-400">
                    {isSelf ? 'Pass added!' : 'Gift sent!'}
                  </p>
                  <p className="text-zinc-300">
                    {isSelf
                      ? 'Your perks are live in a few seconds.'
                      : `${recipient?.username ?? 'They'} will get a notification and their perks right away.`}
                  </p>
                </div>
              </div>
            )}

            <section className="flex flex-col gap-10">
              <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr]">
                <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
                  <h2 className="flex items-center gap-3 text-3xl font-black sm:text-4xl">
                    <GiftIcon className="size-9 text-amber-500" />
                    {isSelf ? 'Get a pass' : 'Gift Supporter'}
                  </h2>
                  <ToggleGroup
                    type="single"
                    variant="outline"
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
                        className="cursor-pointer gap-1.5 px-3 data-[spacing=0]:flex-none sm:px-4"
                      >
                        {monthsLabel(m)}
                        <span className="text-zinc-500 tabular-nums">
                          {passPrice(m)}
                        </span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <div className="flex items-baseline gap-2">
                    {catalog ? (
                      <span className="text-5xl font-black tracking-tight">
                        {price}
                      </span>
                    ) : (
                      <Skeleton className="h-12 w-24" />
                    )}
                    <span className="text-zinc-400">
                      once, for {monthsLabel(months)}
                    </span>
                  </div>
                  <Button
                    size="lg"
                    className="h-11 w-full px-8 text-base sm:w-auto"
                    disabled={!recipient || !catalog?.enabled}
                    onClick={() =>
                      setCheckout({
                        kind: 'pass',
                        plan,
                        months,
                        recipient: recipient?.username,
                      })
                    }
                  >
                    <GiftIcon />
                    {catalog && !catalog.enabled
                      ? 'Coming soon'
                      : `${isSelf ? 'Buy' : 'Gift'} ${monthsLabel(months)} of ${PLAN_NAMES[plan]}`}
                  </Button>
                  <p className="flex max-w-xl items-start gap-3 text-left text-sm text-zinc-400">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-zinc-500" />
                    <span>
                      <span className="font-medium text-zinc-200">
                        Paying for your child?
                      </span>{' '}
                      This is a single payment through Stripe. It never renews
                      and your card details are never shared with PFControl. You
                      don't need an account, and the receipt goes to your email.
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3 text-center">
                  {loading || !recipient ? (
                    <>
                      <Skeleton className="size-32 rounded-full" />
                      <Skeleton className="h-8 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-zinc-400">
                        {isSelf ? 'For you' : 'A gift for'}
                      </span>
                      <SupporterAvatar
                        src={discordAvatarUrl(recipient.id, recipient.avatar)}
                        alt=""
                        plan={plan}
                        ring="aurora"
                        className="size-32"
                      />
                      <span className="supporter-name-gradient max-w-full truncate text-2xl font-bold">
                        {recipient.username}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-sm font-semibold',
                          PLAN_TEXT[plan]
                        )}
                      >
                        <SupporterIcon className="size-5" />
                        {PLAN_NAMES[plan]}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <PlanFeatures limits={catalog?.limits[plan]} columns={4} tiles />
            </section>
          </>
        )}
      </div>

      <CheckoutDialog
        request={checkout}
        catalog={catalog}
        recipientName={isSelf ? null : (recipient?.username ?? null)}
        recipientAvatar={
          recipient ? discordAvatarUrl(recipient.id, recipient.avatar) : null
        }
        onClose={() => setCheckout(null)}
      />
    </div>
  );
}
