export const API_EXT_BASE = `${import.meta.env.VITE_SERVER_URL}/api/ext/v1`;

export function cardClass(extra = "") {
  return `rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl p-5 shadow-xl ring-1 ring-zinc-700/50${extra ? ` ${extra}` : ""}`;
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "approved") {
    return "bg-emerald-950/55 text-emerald-300 ring-1 ring-emerald-800/40";
  }
  if (s === "pending") {
    return "bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35";
  }
  if (s === "revoked" || s === "rejected" || s === "suspended") {
    return "bg-red-950/40 text-red-300 ring-1 ring-red-900/40";
  }
  return "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50";
}