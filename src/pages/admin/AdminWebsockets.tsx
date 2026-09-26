import { useCallback, useEffect, useState } from 'react';
import { Cable } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminStatCards from '../../components/admin/AdminStatCards';
import {
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { AdminSparkline } from '../../components/admin/AdminChart';
import {
  fetchAdminWebsocketStats,
  type AdminWebsocketStatsResponse,
} from '../../utils/fetch/admin';

const NS_COLORS: Record<string, string> = {
  flights: '#60a5fa',
  chat: '#34d399',
  'global-chat': '#a78bfa',
  overview: '#fbbf24',
  arrivals: '#f472b6',
  'session-users': '#2dd4bf',
  'sector-controller': '#fb7185',
  'voice-chat': '#94a3b8',
  notifications: '#38bdf8',
};

function historyLabels(length: number, polledAt: string, hourly: boolean) {
  const end = new Date(polledAt).getTime();
  const step = hourly ? 3_600_000 : 5_000;
  return Array.from({ length }, (_, i) => {
    const t = new Date(end - (length - 1 - i) * step);
    return hourly
      ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : t.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
  });
}

export default function AdminWebsockets() {
  const [data, setData] = useState<AdminWebsocketStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await fetchAdminWebsocketStats());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load websocket stats'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <AdminLayout>
      <AdminPage
        title="WebSockets"
        icon={Cable}
        actions={
          <AdminRefreshButton
            onClick={() => {
              setLoading(true);
              void load();
            }}
            loading={loading}
          />
        }
      >
        {loading && !data ? (
          <AdminLoading />
        ) : error ? (
          <AdminErrorState
            title="Failed to load websocket stats"
            message={error}
            onRetry={() => void load()}
          />
        ) : data ? (
          <>
            <AdminStatCards
              columns={2}
              items={[
                {
                  label: 'Total connections',
                  value: data.totalConnected,
                },
                {
                  label: 'Last updated',
                  value: new Date(data.polledAt).toLocaleTimeString(),
                },
              ]}
            />

            <div className="divide-y overflow-hidden rounded-2xl border">
              {data.namespaces.map((ns) => {
                const color = NS_COLORS[ns.id] ?? '#60a5fa';
                const logged = ns.history24h.some((v) => v > 0);
                const series = logged ? ns.history24h : ns.history;
                return (
                  <div
                    key={ns.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3rem]"
                  >
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="truncate">{ns.label}</span>
                      </h3>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {ns.path}
                      </p>
                    </div>
                    <div
                      className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1"
                      title={
                        logged ? '24h average (logged)' : 'Last 5 min (live)'
                      }
                    >
                      <AdminSparkline
                        data={series}
                        labels={historyLabels(
                          series.length,
                          data.polledAt,
                          logged
                        )}
                        color={color}
                      />
                    </div>
                    <span className="text-right text-xl font-semibold tabular-nums">
                      {ns.connected}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </AdminPage>
    </AdminLayout>
  );
}
