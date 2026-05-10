import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Code2, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import Navbar from "../../components/Navbar";
import DeveloperSubnav from "./DeveloperSubnav";
import { API_EXT_BASE } from "./constants";
import { DeveloperPortalProvider, useDeveloperPortal } from "./developerPortalContext";

function DeveloperShell() {
  const { error, loading, dashLoading, refresh } = useDeveloperPortal();
  const [refreshSpinOnce, setRefreshSpinOnce] = useState(false);

  const handleRefresh = () => {
    setRefreshSpinOnce(true);
    refresh();
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pt-24 pb-16">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Code2 className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  Developers <span className="text-md text-red-400 italic">BETA</span>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50">Developer API</h1>
              <p className="text-zinc-400 mt-2 text-sm sm:text-base max-w-6xl">
                Base URL:{" "}
                <code className="text-blue-300 text-xs sm:text-sm break-all">{API_EXT_BASE}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 text-sm transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  refreshSpinOnce ? "dev-refresh-spin-once" : ""
                } ${(dashLoading || loading) && !refreshSpinOnce ? "animate-spin" : ""}`}
                onAnimationEnd={() => setRefreshSpinOnce(false)}
              />
              Refresh
            </button>
          </div>

          <DeveloperSubnav />

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Suspense
            fallback={
              <div className="flex justify-center py-24">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function DeveloperLayout() {
  return (
    <DeveloperPortalProvider>
      <DeveloperShell />
    </DeveloperPortalProvider>
  );
}