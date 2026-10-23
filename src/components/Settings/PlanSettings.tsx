import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import {
  Award,
  Check,
  Copy,
  CreditCard,
  Gift,
  Loader2,
  Plane,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import SupporterAvatar from '../billing/SupporterAvatar';
import SupporterIcon from '../billing/SupporterIcon';
import RingColorPicker from '../billing/RingColorPicker';
import PlanFeatures from '../billing/PlanFeatures';
import { useAuth } from '../../hooks/auth/useAuth';
import {
  fetchMyPlan,
  openBillingPortal,
  updateSupporterPrefs,
} from '../../utils/fetch/billing';
import type { MyPlan, SupporterRing } from '../../types/billing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  SUPPORTER_RINGS,
  giftLink,
  monthsLabel,
  supporterRank,
} from '@/lib/plans';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

function planStatus(plan: MyPlan): string {
  const parts: string[] = [];
  if (plan.subscription) {
    const { cancelAtPeriodEnd, renewsAt, status } = plan.subscription;
    const name = PLAN_NAMES[plan.subscription.plan];
    if (status === 'past_due') {
      parts.push(
        'Your last payment failed. Update your card in Manage billing.'
      );
    } else {
      parts.push(
        cancelAtPeriodEnd
          ? `${name} is cancelled and stays until ${formatDate(renewsAt)}.`
          : `${name} renews on ${formatDate(renewsAt)}.`
      );
    }
  }
  if (plan.passEndsAt) {
    parts.push(`Your pass runs until ${formatDate(plan.passEndsAt)}.`);
  }
  if (!parts.length && plan.staffAccess) {
    parts.push('Included with your staff access.');
  }
  return parts.length
    ? parts.join(' ')
    : 'Get Cephie Charts and every supporter perk for $1 a month.';
}

export default function PlanSettings() {
  const { user } = useAuth();
  const wallId = useId();
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [savingRing, setSavingRing] = useState<SupporterRing | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftColors, setDraftColors] = useState<string[] | null>(null);
  const [savingColors, setSavingColors] = useState(false);

  useEffect(() => {
    fetchMyPlan()
      .then(setPlan)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (plan && window.location.hash === '#plan-settings') {
      document.getElementById('plan-settings')?.scrollIntoView();
    }
  }, [plan]);

  const savePrefs = async (prefs: Partial<MyPlan['prefs']>) => {
    if (!plan) return;
    const previous = plan.prefs;
    setPlan({ ...plan, prefs: { ...plan.prefs, ...prefs } });
    try {
      const saved = await minDuration(updateSupporterPrefs(prefs));
      setPlan((p) => (p ? { ...p, prefs: saved } : p));
      toast.success('Saved');
    } catch (error) {
      setPlan((p) => (p ? { ...p, prefs: previous } : p));
      toast.error(error instanceof Error ? error.message : 'Could not save');
    }
  };

  const saveColors = async () => {
    if (!draftColors) return;
    setSavingColors(true);
    await savePrefs({ colors: draftColors });
    setDraftColors(null);
    setSavingColors(false);
  };

  const chooseRing = async (ring: SupporterRing) => {
    setSavingRing(ring);
    await savePrefs({ ring });
    setSavingRing(null);
  };

  const manageBilling = async () => {
    setPortalLoading(true);
    try {
      window.location.href = await minDuration(openBillingPortal());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not open billing'
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

  const paid = plan?.supporterPlan !== 'free' ? plan?.supporterPlan : null;
  const effective = plan && plan.plan !== 'free' ? plan.plan : null;
  const PlanIcon = effective ? SupporterIcon : Plane;
  const rank = supporterRank(plan?.supporterMonths ?? 0);

  return (
    <TooltipProvider>
      <SettingsSection
        title="Plan"
        icon={Sparkles}
        actions={
          plan?.canManageBilling ? (
            <Button
              variant="outline"
              size="sm"
              onClick={manageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CreditCard />
              )}
              Manage billing
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/pricing">
                <Sparkles />
                See plans
              </Link>
            </Button>
          )
        }
      >
        {failed ? (
          <p className="text-sm text-zinc-400">
            Your plan could not be loaded. Try again later.
          </p>
        ) : !plan ? (
          <Skeleton className="h-48 w-full rounded-2xl" />
        ) : (
          <SettingsGroup>
            <div>
              <SettingsRow
                icon={
                  <PlanIcon
                    className={
                      effective ? PLAN_TEXT[effective] : 'text-zinc-500'
                    }
                  />
                }
                label={`PFControl ${PLAN_NAMES[plan.plan]}`}
                description={planStatus(plan)}
              >
                {plan.plan === 'free' && (
                  <Button size="sm" asChild>
                    <Link to="/pricing">Upgrade</Link>
                  </Button>
                )}
              </SettingsRow>
              {effective && (
                <PlanFeatures
                  columns={2}
                  showDetail={false}
                  className="px-5 pb-5 sm:pl-[4.125rem]"
                />
              )}
            </div>

            {(paid || plan.supporterMonths > 0) && (
              <SettingsRow
                icon={<Award className="text-amber-500" />}
                label={`${rank.name} supporter`}
                description={
                  rank.next
                    ? `${monthsLabel(plan.supporterMonths)} so far. ${rank.next.name} at ${monthsLabel(rank.next.months)}.`
                    : `${monthsLabel(plan.supporterMonths)} so far. That's the top rank. Thank you!`
                }
              />
            )}

            <SettingsRow
              icon={<Users className="text-blue-400" />}
              label="Show me on the supporter wall"
              description="Your username and avatar appear on the Support page while you're a Supporter."
              htmlFor={wallId}
            >
              <Switch
                id={wallId}
                checked={plan.prefs.wall}
                onCheckedChange={(wall) => savePrefs({ wall })}
              />
            </SettingsRow>

            <SettingsRow
              icon={<SupporterIcon className="text-amber-500" />}
              label="Avatar ring"
              description={
                effective
                  ? 'Shown around your avatar on your profile, in sessions and on the wall. Custom uses your own colours for the ring and your name.'
                  : 'Animated rings are a Supporter perk.'
              }
              stacked
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  {user && (
                    <SupporterAvatar
                      src={user.avatar ?? '/assets/app/default/avatar.webp'}
                      alt=""
                      plan={effective}
                      ring={plan.prefs.ring}
                      colors={draftColors ?? plan.prefs.colors}
                      className="size-12"
                    />
                  )}
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={plan.prefs.ring}
                    onValueChange={(v) => v && chooseRing(v as SupporterRing)}
                    disabled={!effective || !!savingRing}
                    aria-label="Avatar ring"
                    className="flex-wrap"
                  >
                    {SUPPORTER_RINGS.map((ring) => (
                      <ToggleGroupItem
                        key={ring.value}
                        value={ring.value}
                        className="cursor-pointer gap-1.5 px-3 data-[spacing=0]:flex-none"
                      >
                        {savingRing === ring.value && (
                          <Loader2 className="animate-spin" />
                        )}
                        {ring.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                {effective && plan.prefs.ring === 'custom' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <RingColorPicker
                      colors={draftColors ?? plan.prefs.colors}
                      onChange={setDraftColors}
                      disabled={savingColors}
                    />
                    {draftColors && (
                      <>
                        <Button
                          size="sm"
                          onClick={saveColors}
                          disabled={savingColors}
                        >
                          {savingColors ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Check />
                          )}
                          Save colours
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDraftColors(null)}
                          disabled={savingColors}
                        >
                          Reset
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </SettingsRow>

            {user && (
              <SettingsRow
                icon={<Gift className="text-pink-400" />}
                label="Your gift link"
                description="A parent or friend can use it to buy you a pass. No account needed."
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy gift link"
                      onClick={copyGiftLink}
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="shadcn-scope" sideOffset={6}>
                    {copied ? 'Copied!' : 'Copy gift link'}
                  </TooltipContent>
                </Tooltip>
              </SettingsRow>
            )}
          </SettingsGroup>
        )}
      </SettingsSection>
    </TooltipProvider>
  );
}
