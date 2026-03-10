import { useMemo } from 'react';
import Button from '../common/Button';
import { Coins, TicketsPlane } from 'lucide-react';
import { BiSolidBalloon } from 'react-icons/bi';

type FeatureValue = boolean | string;

type PlanTier = 'free' | 'basic' | 'ultimate';

interface Feature {
  label: string;
  free: FeatureValue;
  basic: FeatureValue;
  ultimate: FeatureValue;
}

const features: Feature[] = [
  { label: 'Active sessions', free: '3', basic: '50', ultimate: '250' },
  { label: 'Unlimited flights per session', free: true, basic: true, ultimate: true },
  { label: 'PFATC Overview', free: true, basic: true, ultimate: true },
  { label: 'Basic ACARS', free: true, basic: true, ultimate: true },
  { label: 'PDC & ATIS (ACARS)', free: false, basic: true, ultimate: true },
  { label: 'Custom profile badge', free: false, basic: true, ultimate: true },
  { label: 'Custom background images', free: false, basic: true, ultimate: true },
  { label: 'Text chat', free: false, basic: true, ultimate: true },
  { label: 'Voice chat', free: false, basic: false, ultimate: true },
  { label: 'Early feature access', free: false, basic: false, ultimate: true },
];

const plans = [
  {
    id: 'free' as PlanTier,
    name: 'Free',
    price: 'Free',
    tagline: 'Get started with the basics.',
    icon: Coins,
    highlight: false,
  },
  {
    id: 'basic' as PlanTier,
    name: 'Basic',
    price: '$1.99',
    priceDetail: '/month',
    tagline: 'Unlock text chat, PDC & more.',
    icon: TicketsPlane,
    highlight: false,
  },
  {
    id: 'ultimate' as PlanTier,
    name: 'Ultimate',
    price: '$4.99',
    priceDetail: '/month',
    tagline: 'Everything, including voice chat.',
    icon: BiSolidBalloon,
    highlight: true,
  },
];

const paidPlans = plans.filter((p) => p.id !== 'free');

import { Check, X as XIcon } from 'lucide-react';

function FeatureCell({ value }: { value: FeatureValue }) {
  if (typeof value === 'string') {
    return <span className="text-blue-300 font-semibold text-xs">{value}</span>;
  }
  if (value) {
    return (
      <Check className="h-3 w-3 text-emerald-400" aria-label="Included" />
    );
  }
  return (
    <XIcon className="h-3 w-3 text-zinc-500" aria-label="Not included" />
  );
}

export type PlanUpsellSidebarProps = {
  title?: string;
  description?: string;
};

export function PlanUpsellSidebar({
  description,
}: PlanUpsellSidebarProps) {
  const callback = useMemo(() => {
    const path = window.location.pathname + window.location.search;
    return encodeURIComponent(path);
  }, []);

  return (
    <div className="flex flex-col h-full px-5 pt-4 space-y-5">
      <p className="text-sm text-zinc-300">
        {description ??
          'Chat and other premium features are available on our paid plans. Choose a plan below to upgrade and support PFControl.'}
      </p>

      <div className="space-y-4 overflow-y-auto">
        {paidPlans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={[
                'relative border-2 rounded-3xl transition-transform duration-200',
                plan.id === 'ultimate'
                  ? 'bg-gradient-to-br from-blue-900 to-transparent'
                  : 'bg-gradient-to-br from-blue-900/25 to-transparent',
                plan.highlight ? 'border-blue-400' : 'border-blue-800',
              ].join(' ')}
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-700">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-white">
                        {plan.name}
                      </h3>
                      {plan.highlight && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-200 border border-blue-500/60">
                          Best value
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {plan.tagline}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">
                      {plan.price}
                      {plan.priceDetail && (
                        <span className="text-[11px] text-gray-300 ml-1">
                          {plan.priceDetail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs">
                  {features.map((f) => {
                    const val = f[plan.id];
                    const excluded = val === false;
                    return (
                      <li
                        key={f.label}
                        className={[
                          'flex items-center gap-2',
                          excluded ? 'opacity-40' : '',
                        ].join(' ')}
                      >
                        <FeatureCell value={val} />
                        <span
                          className={
                            excluded ? 'text-zinc-400' : 'text-gray-200'
                          }
                        >
                          {f.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Button
                  variant={plan.highlight ? 'primary' : 'outline'}
                  size="sm"
                  className="w-full justify-center text-sm font-semibold"
                  onClick={() => {
                    window.open(`/pricing?callback=${callback}`, '_blank');
                  }}
                >
                  View {plan.name} plan
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

