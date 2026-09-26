import { Link } from 'react-router';
import { useMemo } from 'react';
import { ChartLine, Hourglass, KeyRound, Layers, Loader2 } from 'lucide-react';
import {
  DeveloperRequestsAreaChart,
  DeveloperBreakdownDonutChart,
} from '../../components/developers/DeveloperUsageCharts';
import RecentApiCallsPanel from '../../components/developers/RecentApiCallsPanel';
import SettingsSection from '../../components/Settings/SettingsSection';
import SettingsGroup from '../../components/Settings/SettingsGroup';
import SettingsRow from '../../components/Settings/SettingsRow';
import { ADMIN_CHART_COLORS } from '../../components/admin/adminConstants';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  useDeveloperPortal,
  type DeveloperUsageChartWindow,
} from './developerPortalContext';

const CHART_HEIGHT = 300;

const RANGE_OPTIONS: { id: DeveloperUsageChartWindow; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: 7, label: '7d' },
  { id: 14, label: '14d' },
  { id: 30, label: '30d' },
];

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

  if (loading) {
    return (
      <div className="shadcn-scope flex justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profileActive) {
    return (
      <div className="shadcn-scope">
        <SettingsSection title="Usage dashboard" icon={ChartLine}>
          <SettingsGroup>
            <SettingsRow
              icon={<Hourglass className="text-muted-foreground" />}
              label="Not available yet"
              description="Charts and request logs appear here once your developer application is approved."
            >
              <Button asChild variant="outline" size="sm">
                <Link to="/developers">Back to overview</Link>
              </Button>
            </SettingsRow>
          </SettingsGroup>
        </SettingsSection>
      </div>
    );
  }

  const recent = summary?.recent ?? [];

  return (
    <div className="shadcn-scope flex flex-col gap-10">
      <SettingsSection
        title="Request volume"
        icon={ChartLine}
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(usageChartWindow)}
            onValueChange={(v) => {
              if (!v) return;
              setUsageChartWindow(
                v === '24h' ? '24h' : (Number(v) as 7 | 14 | 30)
              );
            }}
            aria-label="Request volume time range"
          >
            {RANGE_OPTIONS.map((r) => (
              <ToggleGroupItem
                key={String(r.id)}
                value={String(r.id)}
                className="px-3"
              >
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        <SettingsGroup>
          <div className="px-5 py-4">
            {dashLoading ? (
              <div
                className="flex items-center justify-center"
                style={{ height: CHART_HEIGHT }}
              >
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DeveloperRequestsAreaChart
                data={summary?.daily ?? []}
                height={CHART_HEIGHT}
              />
            )}
          </div>
          <p className="px-5 py-3 text-sm text-muted-foreground tabular-nums">
            {(summary?.totalInRange ?? 0).toLocaleString()} requests
            {summary?.granularity === 'hour'
              ? ' in the rolling window.'
              : ' in the selected calendar days.'}
          </p>
        </SettingsGroup>
      </SettingsSection>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
        <SettingsSection title="Scope mix" icon={Layers}>
          <SettingsGroup>
            <div className="px-5 py-4">
              <DeveloperBreakdownDonutChart
                rows={(summary?.byScope ?? []).map((r) => ({
                  id: r.scope_id,
                  count: r.count,
                }))}
                labelMap={scopeLabelMap}
                ariaLabel="Scope breakdown"
              />
            </div>
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection title="Usage by key" icon={KeyRound}>
          <SettingsGroup>
            <div className="px-5 py-4">
              <DeveloperBreakdownDonutChart
                rows={(summary?.byKey ?? []).map((r) => ({
                  id: r.key_id,
                  count: r.count,
                }))}
                labelMap={keyLabelMap}
                ariaLabel="Key breakdown"
                color={ADMIN_CHART_COLORS.green}
              />
            </div>
          </SettingsGroup>
        </SettingsSection>
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
