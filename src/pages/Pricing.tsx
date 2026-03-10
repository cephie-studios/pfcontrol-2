import {
  Check,
  X,
  Coins,
  TicketsPlane,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Button from '../components/common/Button';
import { BiSolidBalloon } from 'react-icons/bi';

type FeatureValue = boolean | string;

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
    id: 'free',
    name: 'Free',
    price: 'Free',
    tagline: 'Get started with the basics.',
    icon: Coins,
    highlight: false,
    topBadge: null,
    ctaLabel: 'Get started free',
    ctaVariant: 'outline' as const,
    ctaAction: () => { window.location.href = '/create'; },
    featureKey: 'free' as const,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$2.99',
    priceDetail: '/month',
    tagline: 'For active controllers & small teams.',
    icon: TicketsPlane,
    highlight: false,
    topBadge: null,
    ctaLabel: 'Get Basic',
    ctaVariant: 'outline' as const,
    ctaAction: () => {
      window.location.href =
        'mailto:support@pfconnect.online?subject=PFControl%20Basic%20plan';
    },
    featureKey: 'basic' as const,
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: '$5.99',
    priceDetail: '/month',
    tagline: 'Everything, for the serious controller.',
    icon: BiSolidBalloon,
    highlight: false,
    topBadge: null,
    ctaLabel: 'Get Ultimate',
    ctaVariant: 'outline' as const,
    ctaAction: () => {
      window.location.href =
        'mailto:support@pfconnect.online?subject=PFControl%20Ultimate%20plan';
    },
    featureKey: 'ultimate' as const,
  },
];

const paidPlans = plans.filter((plan) => plan.id !== 'free');
const freePlan = plans.find((plan) => plan.id === 'free');

function FeatureCell({ value }: { value: FeatureValue }) {
  if (typeof value === 'string') {
    return <span className="text-blue-300 font-semibold text-sm">{value}</span>;
  }
  if (value) {
    return <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
  }
  return <X className="h-4 w-4 text-zinc-400 flex-shrink-0" />;
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      <div className="relative w-full h-64 md:h-72 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt="Banner"
            className="object-cover w-full h-full scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
        </div>
        <div className="relative h-full flex flex-col items-center justify-center px-6 gap-3 pt-16">
          <h1 className="text-2xl sm:text-3xl md:text-[4rem] lg:text-[6rem] font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent leading-tight mb-4" style={{ lineHeight: 1.4 }}>
            Pricing
          </h1>
        </div>
      </div>

      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-950 mb-24">
        <div className="max-w-5xl mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-10 items-start">
            {paidPlans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={[
                    plan.id === 'free'
                      ? 'relative border-2 rounded-4xl transition-transform duration-200 bg-gray-950'
                      : plan.id === 'ultimate'
                        ? 'relative border-2 rounded-4xl transition-transform duration-200 bg-gradient-to-br from-indigo-400/30 via-violet-900/25 to-transparent'
                        : 'relative border-2 rounded-4xl transition-transform duration-200 bg-gradient-to-br from-blue-900/30 to-transparent',
                    plan.highlight
                      ? 'border-blue-400'
                      : 'border-blue-800',
                  ].join(' ')}
                >
                  <div className="p-5 sm:p-7">
                    <div className="flex items-start gap-3 mb-6">
                      <div className="p-3 rounded-full bg-blue-700">
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3
                          className="text-2xl sm:text-3xl font-extrabold text-white"
                        >
                          {plan.name}
                        </h3>
                        <p className="text-gray-400 text-xs mt-1">
                          {plan.tagline}
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-2.5 mb-6">
                      {features.map((f) => {
                        const val = f[plan.featureKey];
                        const excluded = val === false;
                        const isActiveSessions = f.label === 'Active sessions' && typeof val === 'string';

                        return (
                          <li
                            key={f.label}
                            className={[
                              'flex items-center gap-2.5 text-sm',
                              excluded ? 'opacity-35' : '',
                            ].join(' ')}
                          >
                            {isActiveSessions ? (
                              <span className="text-white font-semibold text-lg sm:text-xl italic">
                                {val}
                              </span>
                            ) : (
                              <FeatureCell value={val} />
                            )}
                            <span className={excluded ? 'text-zinc-400' : 'text-gray-200'}>
                              {f.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    <Button
                      onClick={plan.ctaAction}
                      variant={plan.ctaVariant}
                      className='w-full justify-center font-semibold'
                      >
                      <div className="flex flex-row items-center leading-tight text-xl text">
                        {plan.price}
                        <span className='text-sm mt-1 ml-0.5'>{plan.priceDetail}</span>
                      </div>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {freePlan && (
            <div className="mt-10">
              {(() => {
                const plan = freePlan;
                const Icon = plan.icon;
                return (
                  <div
                    className={[
                      'relative border-2 rounded-4xl transition-transform duration-200 bg-gray-950',
                      plan.highlight
                        ? 'border-blue-400'
                        : 'border-blue-800',
                    ].join(' ')}
                  >
                    <div className="p-5 sm:p-7">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div className="flex flex-col gap-4 md:w-1/3">
                          <div className="flex items-start gap-3">
                            <div className="p-3 rounded-full bg-blue-700">
                              <Icon className="h-7 w-7 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                                {plan.name}
                              </h3>
                              <p className="text-gray-400 text-xs mt-1">
                                {plan.tagline}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="md:w-2/3">
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                            {features.map((f) => {
                              const val = f[plan.featureKey];
                              const excluded = val === false;
                              const isActiveSessions =
                                f.label === 'Active sessions' &&
                                typeof val === 'string';

                              return (
                                <li
                                  key={f.label}
                                  className={[
                                    'flex items-center gap-2.5 text-sm',
                                    excluded ? 'opacity-35' : '',
                                  ].join(' ')}
                                >
                                  {isActiveSessions ? (
                                    <span className="text-white font-semibold text-lg sm:text-xl italic">
                                      {val}
                                    </span>
                                  ) : (
                                    <FeatureCell value={val} />
                                  )}
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
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
