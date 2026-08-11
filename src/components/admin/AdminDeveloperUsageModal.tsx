import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AdminModal from './AdminModal';
import {
  DeveloperRequestsAreaChart,
  DeveloperBreakdownDonutChart,
} from '../developers/DeveloperUsageCharts';
import RecentApiCallsPanel from '../developers/RecentApiCallsPanel';
import DeveloperPillSegmentedControl from '../../pages/developers/DeveloperPillSegmentedControl';
import { cardClass } from '../../pages/developers/constants';
import {
  fetchAdminDeveloperCatalog,
  fetchAdminDeveloperKeys,
  fetchAdminDeveloperUsage,
  type AdminDeveloperSummary,
  type AdminDeveloperUsageSummary,
  type AdminScopeCatalogEntry,
  type AdminDeveloperKeyRow,
} from '../../utils/fetch/adminDevelopers';

type UsageChartWindow = '24h' | 7 | 14 | 30;

type Props = {
  developer: AdminDeveloperSummary;
  onClose: () => void;
};

export default function AdminDeveloperUsageModal({
  developer,
  onClose,
}: Props) {
  const [chartWindow, setChartWindow] = useState<UsageChartWindow>(14);
  const [summary, setSummary] = useState<AdminDeveloperUsageSummary | null>(
    null
  );
  const [catalog, setCatalog] = useState<AdminScopeCatalogEntry[]>([]);
  const [keys, setKeys] = useState<AdminDeveloperKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, cat, keysPayload] = await Promise.all([
        fetchAdminDeveloperUsage(
          developer.userId,
          chartWindow === '24h' ? { hours: 24 } : { days: chartWindow }
        ),
        fetchAdminDeveloperCatalog(),
        fetchAdminDeveloperKeys(developer.userId),
      ]);
      setSummary(s);
      setCatalog(cat);
      setKeys(keysPayload.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }, [developer.userId, chartWindow]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catalog) m.set(c.id, c.label);
    return m;
  }, [catalog]);

  const keyLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of keys) m.set(k.id, k.name);
    return m;
  }, [keys]);

  const recent = summary?.recent ?? [];

  const rangeButtons: { id: UsageChartWindow; label: string }[] = [
    { id: '24h', label: '24h' },
    { id: 7, label: '7d' },
    { id: 14, label: '14d' },
    { id: 30, label: '30d' },
  ];

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`Usage — ${developer.username}`}
      size="full"
    >
      {loading && !summary ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm text-red-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Retry
          </button>
        </div>
      ) : (
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
                value={chartWindow}
                onChange={setChartWindow}
              />
            </div>
            <div className="h-64 sm:h-72">
              {loading ? (
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
              <div className="h-64 sm:h-72 flex flex-col">
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
              <div className="h-64 sm:h-72 flex flex-col">
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
            loading={loading}
            scopeLabelMap={scopeLabelMap}
            keyLabelMap={keyLabelMap}
          />
        </div>
      )}
    </AdminModal>
  );
}
