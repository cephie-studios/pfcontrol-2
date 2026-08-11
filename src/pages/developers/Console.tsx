import { Link } from 'react-router';
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  DeveloperRequestsAreaChart,
  DeveloperBreakdownDonutChart,
} from '../../components/developers/DeveloperUsageCharts';
import RecentApiCallsPanel from '../../components/developers/RecentApiCallsPanel';
import DeveloperPillSegmentedControl from './DeveloperPillSegmentedControl';
import { cardClass } from './constants';
import {
  useDeveloperPortal,
  type DeveloperUsageChartWindow,
} from './developerPortalContext';

export default function DeveloperConsole() {
  const {
    loading,
    profileActive,
    usageChartWindow,
    setUsageChartWindow,
    summary,
    dashLoading,
    scopeLabelMap,
    keys,
  } = useDeveloperPortal();

  const keyLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of keys) m.set(k.id, k.name);
    return m;
  }, [keys]);

  const rangeButtons: { id: DeveloperUsageChartWindow; label: string }[] = [
    { id: '24h', label: '24h' },
    { id: 7, label: '7d' },
    { id: 14, label: '14d' },
    { id: 30, label: '30d' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!profileActive) {
    return (
      <div className={`${cardClass()} max-w-lg`}>
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">
          Usage dashboard
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Charts and request logs appear here once your developer application is
          approved.
        </p>
        <Link
          to="/developers"
          className="inline-flex text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Back to overview
        </Link>
      </div>
    );
  }

  const recent = summary?.recent ?? [];

  return (
    <div className="space-y-6">
      <div className={cardClass()}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Request volume
          </h2>
          <DeveloperPillSegmentedControl
            aria-label="Request volume time range"
            className="w-full max-w-[min(100%,22rem)] sm:w-auto sm:min-w-[20rem]"
            tabs={rangeButtons}
            value={usageChartWindow}
            onChange={setUsageChartWindow}
          />
        </div>
        <div className="h-72 sm:h-80">
          {dashLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : (
            <DeveloperRequestsAreaChart data={summary?.daily ?? []} />
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          {summary?.totalInRange ?? 0} requests
          {summary?.granularity === 'hour'
            ? ' in the rolling window.'
            : ' in the selected calendar days.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cardClass()}>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Scope mix
          </h2>
          <div className="h-72 sm:h-80 flex flex-col">
            {!summary?.byScope.length ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-zinc-500">
                  No usage in this period yet.
                </p>
              </div>
            ) : (
              <DeveloperBreakdownDonutChart
                rows={summary.byScope.map((r) => ({
                  id: r.scope_id,
                  count: r.count,
                }))}
                labelMap={scopeLabelMap}
                ariaLabel="Scope breakdown"
              />
            )}
          </div>
        </div>

        <div className={cardClass()}>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Usage by key
          </h2>
          <div className="h-72 sm:h-80 flex flex-col">
            {!summary?.byKey.length ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-zinc-500">
                  No usage in this period yet.
                </p>
              </div>
            ) : (
              <DeveloperBreakdownDonutChart
                rows={summary.byKey.map((r) => ({
                  id: r.key_id,
                  count: r.count,
                }))}
                labelMap={keyLabelMap}
                ariaLabel="Key breakdown"
              />
            )}
          </div>
        </div>
      </div>

      <RecentApiCallsPanel
        recent={recent}
        recentErrors={summary?.recentErrors ?? []}
        loading={dashLoading}
        scopeLabelMap={scopeLabelMap}
        keyLabelMap={keyLabelMap}
      />
    </div>
  );
}
