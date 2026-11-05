import { useEffect, useId, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { minDuration } from '@/lib/minDuration';
import {
  PLAN_NAMES,
  PLAN_TEXT,
  discordAvatarUrl,
  formatPrice,
  giftLink,
  monthsLabel,
} from '@/lib/plans';
import { cn } from '@/lib/utils';
import { useAuth } from '../../hooks/auth/useAuth';
import { startCheckout } from '../../utils/fetch/billing';
import type { BillingCatalog, CheckoutRequest } from '../../types/billing';
import SupporterAvatar from './SupporterAvatar';
import SupporterIcon from './SupporterIcon';
import PlanFeatures from './PlanFeatures';

interface CheckoutDialogProps {
  request: CheckoutRequest | null;
  catalog: BillingCatalog | null;
  // Shown when the buyer may want a parent to pay instead.
  askParentFor?: string | null;
  recipientName?: string | null;
  recipientAvatar?: string | null;
  onClose: () => void;
}

type Payer = 'me' | 'parent';

function amountFor(catalog: BillingCatalog, request: CheckoutRequest) {
  const prices = catalog.plans[request.plan];
  return request.kind === 'pass'
    ? prices.passes[request.months]
    : prices[request.interval];
}

function cadence(request: CheckoutRequest) {
  if (request.kind === 'pass') {
    return `once, for ${monthsLabel(request.months)}`;
  }
  return request.interval === 'year' ? 'a year' : 'a month';
}

export default function CheckoutDialog({
  request,
  catalog,
  askParentFor,
  recipientName,
  recipientAvatar,
  onClose,
}: CheckoutDialogProps) {
  const { user } = useAuth();
  const consentId = useId();
  const [payer, setPayer] = useState<Payer>('me');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (request) {
      setPayer('me');
      setCopied(false);
    } else {
      setConsent(false);
    }
  }, [request]);

  const pay = async () => {
    if (!request) return;
    setLoading(true);
    try {
      window.location.href = await minDuration(startCheckout(request));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not start checkout'
      );
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!askParentFor) return;
    try {
      await navigator.clipboard.writeText(giftLink(askParentFor));
      setCopied(true);
      toast.success('Link copied. Send it to your parent or guardian.');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const plan = request?.plan ?? 'supporter';
  const price =
    request && catalog
      ? formatPrice(amountFor(catalog, request), catalog.currency)
      : '';
  const avatar = recipientAvatar ?? user?.avatar ?? discordAvatarUrl('0', null);
  const terms =
    request?.kind === 'subscription'
      ? 'Renews automatically until you cancel. Cancel anytime in Settings and keep your perks until the period ends.'
      : 'One payment. It never renews, so there are no surprise charges.';

  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => !open && !loading && onClose()}
    >
      <DialogContent className="shadcn-scope top-[calc(50%+2rem)] max-h-[calc(100dvh-6rem)] gap-0 overflow-y-auto border-amber-500/70 p-0 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:max-w-3xl">
        <div className="grid md:grid-cols-[5fr_6fr]">
          <div className="flex flex-col items-center gap-5 bg-zinc-900 p-5 text-center sm:p-8">
            <SupporterAvatar
              src={avatar}
              alt=""
              plan={plan}
              ring="aurora"
              className="mt-2 size-20 md:size-28"
            />
            <div className="flex flex-col items-center gap-1">
              <span className="supporter-name-gradient max-w-full truncate text-xl font-bold">
                {recipientName ?? user?.username ?? 'You'}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm font-semibold',
                  PLAN_TEXT[plan]
                )}
              >
                <SupporterIcon className="size-4" />
                {PLAN_NAMES[plan]}
              </span>
            </div>
            <PlanFeatures
              limits={catalog?.limits.supporter}
              showDetail={false}
              className="hidden w-full md:grid"
            />
          </div>

          <div className="flex flex-col gap-5 p-5 sm:p-8">
            <div className="flex flex-col gap-2 pr-6">
              <DialogTitle className="text-2xl">
                {recipientName
                  ? `Gift ${PLAN_NAMES[plan]} to ${recipientName}`
                  : `Become a ${PLAN_NAMES[plan]}`}
              </DialogTitle>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight">
                  {price}
                </span>
                {request && (
                  <span className="text-zinc-400">{cadence(request)}</span>
                )}
              </div>
              <DialogDescription className="text-zinc-400">
                {terms}
              </DialogDescription>
            </div>

            {askParentFor && (
              <div
                role="radiogroup"
                aria-label="Who is paying?"
                className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1"
              >
                {(
                  [
                    { value: 'me', label: "I'm paying", icon: CreditCard },
                    { value: 'parent', label: 'A parent pays', icon: Users },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={payer === value}
                    onClick={() => setPayer(value)}
                    className={cn(
                      'flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      payer === value
                        ? 'bg-secondary text-foreground'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {payer === 'parent' && askParentFor ? (
              <div className="flex flex-1 flex-col gap-3 text-sm text-zinc-300">
                <p>
                  Send this link to a parent or guardian. They can pick a pass
                  and pay for you without a PFControl account. Passes don't
                  renew.
                </p>
                <div className="rounded-xl border-2 border-zinc-800 px-3 py-2 font-mono text-xs break-all text-zinc-300">
                  {giftLink(askParentFor)}
                </div>
                <Button className="mt-auto h-10" onClick={copyLink}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={consentId}
                    checked={consent}
                    onCheckedChange={(checked) => setConsent(checked === true)}
                    disabled={loading}
                  />
                  <Label
                    htmlFor={consentId}
                    className="text-sm leading-snug font-normal text-zinc-300"
                  >
                    I'm 18 or older, or my parent or guardian is OK with this
                    purchase. I understand perks start right away, so I can't
                    withdraw for a refund once they're active.
                  </Label>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <Button
                    className="h-10 w-full"
                    onClick={pay}
                    disabled={!consent || loading}
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <CreditCard />
                    )}
                    Continue to checkout
                  </Button>
                  <p className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <ShieldCheck className="size-4" />
                    Paid securely through Stripe. PFControl never sees your
                    card.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
