import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import RouteMap from "../components/map/RouteMap";
import AircraftPhotoCard from "../components/flight/AircraftPhotoCard";
import FlightTimingBlock from "../components/flight/FlightTimingBlock";
import FlightTabs, { type FlightTab } from "../components/flight/FlightTabs";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  X,
  Check,
  Share2,
  Pencil,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Loader from "../components/common/Loader";
import { fetchPublicFlight, type FlightLogItem } from "../utils/fetch/flights";
import { fetchBackgrounds } from "../utils/fetch/data";
import { useSettings } from "../hooks/settings/useSettings";
import { useData } from "../hooks/data/useData";
import type { Flight } from "../types/flight";
import { parseCallsign } from "../utils/callsignParser";
import { useAuth } from "../hooks/auth/useAuth";

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

interface PublicFlightViewProps {
  standalone?: boolean;
  flightIdOverride?: string;
  initialFlight?: Flight | null;
}

export default function PublicFlightView({
  standalone = true,
  flightIdOverride,
  initialFlight,
}: PublicFlightViewProps) {
  const navigate = useNavigate();
  const params = useParams<{ flightId: string }>();
  const flightId = flightIdOverride ?? params.flightId;
  const { settings } = useSettings();
  const { airlines } = useData();

  const { user } = useAuth();
  const [flight, setFlight] = useState<Flight | null>(initialFlight ?? null);
  const [loading, setLoading] = useState(!initialFlight);
  const [error, setError] = useState("");
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [isPFATC, setIsPFATC] = useState(false);
  const [isAdvancedATC, setIsAdvancedATC] = useState(false);
  const [activeTab, setActiveTab] = useState<FlightTab>("overview");
  const [logs, setLogs] = useState<FlightLogItem[]>([]);
  const [logsAvailable, setLogsAvailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [pilot, setPilot] = useState<{
    username: string;
    avatar_url: string | null;
    user_id: string;
  } | null>(null);
  const initialFlightConsumedRef = useRef(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    fetchBackgrounds()
      .then(setAvailableImages)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!flightId) {
      setError("Invalid link.");
      setLoading(false);
      return;
    }

    const loadFollowUpData = (data: Flight) => {
      fetch(`${API_BASE_URL}/api/sessions/${data.session_id}/submit`)
        .then((r) => (r.ok ? r.json() : null))
        .then((info) => {
          if (info?.isPFATC) setIsPFATC(true);
          if (info?.isAdvancedATC) setIsAdvancedATC(true);
        })
        .catch(() => {});

      fetch(`${API_BASE_URL}/api/flights/me/${flightId}/logs`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((logsData) => {
          if (!logsData?.logs) return;
          setLogs(logsData.logs);
          setLogsAvailable(true);

          fetch(`${API_BASE_URL}/api/pilot/${data.user_id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((userData) => {
              if (userData.user.username && userData.user.avatar) {
                setPilot({
                  username: userData.user.username,
                  avatar_url: userData.user.avatar,
                  user_id: userData.user.id,
                });
              } else {
                setError("User not found.");
              }
            });

          const pilotUserId: string | undefined = logsData.pilotUserId;
          const seen = new Set<string>();
          const ctrlList: {
            user_id: string;
            username: string;
            avatar_url: string | null;
          }[] = [];
          for (const log of logsData.logs as FlightLogItem[]) {
            if (
              log.action === "update" &&
              log.user_id !== pilotUserId &&
              !seen.has(log.user_id)
            ) {
              seen.add(log.user_id);
              ctrlList.push({
                user_id: log.user_id,
                username: log.username,
                avatar_url: log.avatar_url,
              });
            }
          }
        })
        .catch(() => {});
    };

    if (
      !initialFlightConsumedRef.current &&
      initialFlight &&
      String(initialFlight.id) === String(flightId)
    ) {
      initialFlightConsumedRef.current = true;
      setLoading(false);
      loadFollowUpData(initialFlight);
      return;
    }
    initialFlightConsumedRef.current = true;

    fetchPublicFlight(flightId)
      .then((data) => {
        setFlight(data);
        loadFollowUpData(data);
      })
      .catch(() => setError("This flight is not available or does not exist."))
      .finally(() => setLoading(false));
  }, [flightId, initialFlight]);

  const statusTimeline = useMemo(() => {
    return logs
      .map((log) => {
        const oldStatus = (log.old_data?.status as string | undefined) ?? null;
        const newStatus = (log.new_data?.status as string | undefined) ?? null;
        if (log.action === "add" && newStatus) {
          return {
            id: log.id,
            label: `Created as ${newStatus}`,
            at: log.created_at,
          };
        }
        if (log.action === "update" && oldStatus !== newStatus && newStatus) {
          return {
            id: log.id,
            label: (
              <span className="flex items-center gap-1.5">
                <span>{oldStatus || "N/A"}</span>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span className="text-blue-400">{newStatus}</span>
              </span>
            ),
            at: log.created_at,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .reverse();
  }, [logs]);

  const publicFlightUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/flight/${flightId}`
      : null;

  const handleShare = async () => {
    if (!publicFlightUrl) return;
    await navigator.clipboard.writeText(publicFlightUrl || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const snaps = useMemo(() => flight?.snap_images ?? [], [flight?.snap_images]);

  const backgroundImage = useMemo(() => {
    if (snaps.length > 0) return `url(${snaps[0].url})`;
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';
    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === "random" || filename === "favorites")
        return filename;
      if (filename.startsWith("https://api.cephie.app/")) return filename;
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };
    if (selectedImage === "random") {
      if (availableImages.length > 0) {
        const i = Math.floor(Math.random() * availableImages.length);
        bgImage = `url(${API_BASE_URL}${availableImages[i].path})`;
      }
    } else if (selectedImage === "favorites") {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length > 0) {
        const fav = favorites[Math.floor(Math.random() * favorites.length)];
        const url = getImageUrl(fav);
        if (url && url !== "random" && url !== "favorites")
          bgImage = `url(${url})`;
      }
    } else if (selectedImage) {
      const url = getImageUrl(selectedImage);
      if (url && url !== "random" && url !== "favorites")
        bgImage = `url(${url})`;
    }
    return bgImage;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
    snaps,
  ]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")')
      setCustomLoaded(true);
  }, [backgroundImage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        {standalone && <Navbar />}
        <Loader />
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white">
        {standalone && <Navbar />}
        <div className="max-w-4xl mx-auto px-4 pt-24">
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error || "Flight not found."}
          </div>
        </div>
      </div>
    );
  }

  const formattedCallsign = parseCallsign(flight.callsign || "", airlines);
  const hasSpokenName =
    formattedCallsign !== (flight.callsign || "").toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {standalone && <Navbar />}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-10000 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700/80 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Snap"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Hero */}
      <div className="relative w-full h-80 md:h-[400px] overflow-hidden flex flex-col">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt="Banner"
            className="object-cover w-full h-full scale-110"
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: customLoaded || snaps.length > 0 ? 1 : 0,
              transition: "opacity 0.5s ease-in-out",
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/15 to-zinc-950" />
        </div>

        <div className="relative z-20 flex items-center justify-between container mx-auto max-w-4xl px-4 pt-20">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-zinc-200 hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            {publicFlightUrl && (
              <>
                <button
                  onClick={handleShare}
                  aria-label="Copy public share link"
                  title={copied ? "Copied" : "Share"}
                  className={`h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center transition-colors ${
                    copied
                      ? "text-emerald-400"
                      : "text-zinc-200 hover:bg-black/60"
                  }`}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </button>
                {pilot?.user_id === user?.userId && (
                  <a
                    href={`/my-flights/${flight.id}`}
                    aria-label="Edit Flight"
                    title="Edit Flight"
                    className="h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-zinc-200 hover:bg-black/60 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 gap-1.5">
          {hasSpokenName ? (
            <>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                {formattedCallsign}
              </h1>
              <p className="text-sm font-mono text-zinc-400">
                ({flight.callsign?.toUpperCase()})
              </p>
            </>
          ) : (
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
              {flight.callsign || "Unknown Callsign"}
            </h1>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 pb-10 relative z-10">
        <FlightTimingBlock flight={flight} logs={logs} />

        <div className="mt-5">
          <FlightTabs active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="mt-4 pb-2">
          {activeTab === "overview" && (
            <div>
              <AircraftPhotoCard flight={flight} />

              {flight.route && (
                <>
                  <div
                    className="rounded-2xl overflow-hidden mb-2"
                    style={{ height: "300px" }}
                  >
                    {hasMounted && (
                      <RouteMap
                        route={flight.route}
                        departure={flight.departure}
                        arrival={flight.arrival}
                        sid={flight.sid}
                        star={flight.star}
                      />
                    )}
                  </div>
                  <p className="text-xs font-mono text-zinc-500 mb-5 break-words">
                    {flight.route}
                  </p>
                </>
              )}

              <div className="grid grid-cols-3 items-start">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    SID
                  </p>
                  <p
                    className={`font-mono text-base font-bold ${flight.sid ? "text-zinc-100" : "text-zinc-600"}`}
                  >
                    {flight.sid || "N/A"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Cruising FL
                  </p>
                  <p
                    className={`font-mono text-base font-bold ${flight.cruisingFL ? "text-zinc-100" : "text-zinc-600"}`}
                  >
                    {flight.cruisingFL || "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    STAR
                  </p>
                  <p
                    className={`font-mono text-base font-bold ${flight.star ? "text-zinc-100" : "text-zinc-600"}`}
                  >
                    {flight.star || "N/A"}
                  </p>
                </div>
              </div>

              {flight.remark && (
                <div className="flex items-start gap-3 mt-5 p-4 bg-blue-600/10 border border-blue-600/20 rounded-2xl">
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Remarks</p>
                    <p className="text-sm text-zinc-200">{flight.remark}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "photos" && (
            <div>
              {snaps.length === 0 ? (
                <p className="text-zinc-500 text-sm">
                  No photos have been added to this flight.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {snaps.map((snap) => (
                    <div
                      key={snap.cephie_id}
                      className="rounded-xl overflow-hidden aspect-video bg-zinc-800/40 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setLightboxSrc(snap.url)}
                    >
                      <img
                        src={snap.url}
                        alt="Snap"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div>
              {flight.notes ? (
                <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed font-mono">
                  {flight.notes}
                </p>
              ) : (
                <p className="text-zinc-500 text-sm">
                  No notes have been added to this flight.
                </p>
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div>
              {statusTimeline.length === 0 ? (
                <p className="text-zinc-500 text-sm">
                  {logsAvailable
                    ? "No status-change logs available for this flight."
                    : "Sign in to view this flight’s status history."}
                </p>
              ) : (
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-center gap-2 min-w-max">
                    {statusTimeline.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <div className="p-3 bg-zinc-800/40 border border-zinc-800 rounded-2xl text-sm min-w-44">
                          <div className="text-zinc-200 font-medium mb-1">
                            {item.label}
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            {new Date(item.at).toLocaleString()}
                          </div>
                        </div>
                        {index !== statusTimeline.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-zinc-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {pilot && (
          <div className="mt-6 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Submitted by</span>
            <a className="group flex gap-1" href={`/user/${pilot.username}`}>
              {pilot.avatar_url ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${pilot.user_id}/${pilot.avatar_url}.png`}
                  alt={pilot.username}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300">
                  {pilot.username.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-sm text-zinc-400 group-hover:text-blue-400 group-hover:cursor-pointer transition-colors">
                {pilot.username}
              </p>
            </a>
          </div>
        )}

        <p className="text-xs text-zinc-700 font-mono px-1 mt-6">
          Shared via PFControl
        </p>
      </div>
    </div>
  );
}
