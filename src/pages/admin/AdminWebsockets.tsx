import { useCallback, useEffect, useState } from "react";
import { MdCable } from "react-icons/md";
import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import { adminSectionClass } from "../../components/admin/adminConstants";
import { AdminSparkline } from "../../components/admin/AdminChart";
import Loader from "../../components/common/Loader";
import ErrorScreen from "../../components/common/ErrorScreen";
import {
  fetchAdminWebsocketStats,
  type AdminWebsocketStatsResponse,
} from "../../utils/fetch/admin";

const NS_COLORS: Record<string, string> = {
  flights: "#60a5fa",
  chat: "#34d399",
  "global-chat": "#a78bfa",
  overview: "#fbbf24",
  arrivals: "#f472b6",
  "session-users": "#2dd4bf",
  "sector-controller": "#fb7185",
  "voice-chat": "#94a3b8",
  notifications: "#38bdf8",
};

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
        err instanceof Error ? err.message : "Failed to load websocket stats"
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

  const maxConnected = Math.max(
    1,
    ...(data?.namespaces.map((n) => n.connected) ?? [1])
  );

  return (
    <AdminLayout>
      <AdminPageHeader
        title="WebSocket Monitor"
        icon={MdCable}
        accent="cyan"
        actions={
          <AdminRefreshButton
            onClick={() => {
              setLoading(true);
              void load();
            }}
            loading={loading}
          />
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Failed to load"
          message={error}
          onRetry={() => void load()}
        />
      ) : data ? (
        <>
          <AdminStatStrip
            items={[
              { label: "Total connections", value: data.totalConnected },
              { label: "Namespaces", value: data.namespaces.length },
              {
                label: "Last updated",
                value: new Date(data.polledAt).toLocaleTimeString(),
              },
            ]}
            columns={3}
          />

          <div
            className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5 ${adminSectionClass("!mt-0 !pt-0 !border-t-0")}`}
          >
            {data.namespaces.map((ns) => {
              const color = NS_COLORS[ns.id] ?? "#60a5fa";
              const pct = Math.min(100, (ns.connected / maxConnected) * 100);
              return (
                <div key={ns.id} className="border-b border-zinc-800/60 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-white">
                        {ns.label}
                      </h3>
                      <p className="text-xs text-zinc-500 font-mono truncate">
                        {ns.path}
                      </p>
                    </div>
                    <span
                      className="text-xl font-semibold tabular-nums shrink-0"
                      style={{ color }}
                    >
                      {ns.connected}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800/80 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <AdminSparkline
                    data={
                      ns.history24h.some((v) => v > 0)
                        ? ns.history24h
                        : ns.history
                    }
                    color={color}
                    height={40}
                  />
                  {ns.history24h.some((v) => v > 0) ? (
                    <p className="text-[10px] text-zinc-600 mt-1">
                      24h avg (logged)
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Last 5 min (live)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}