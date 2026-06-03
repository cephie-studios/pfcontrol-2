import { useState, useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { usePostHog } from "posthog-js/react";
import {
  Check,
  Copy,
  GripHorizontal,
  GripVertical,
  HelpCircle,
  Info,
  Loader2,
  Map,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Route,
  Settings,
  TowerControl,
  Wand2,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/auth/useAuth";
import { fetchRoute } from "../../utils/fetch/data";
import Dropdown from "../common/Dropdown";
import Checkbox from "../common/Checkbox";
import StatusDropdown from "../dropdowns/StatusDropdown";
import Button from "../common/Button";
import WindDisplay from "../tools/WindDisplay";
import FrequencyDisplay from "../tools/FrequencyDisplay";
import RouteMap from "../map/RouteMap";
//To those trying to maintain this component: Only god and claude knows what's going on in here, good luck and godspeed
const ALL_FLIGHTS = [
  {
    id: 1,
    time: "14:32",
    callsign: "BAW123",
    aircraft: "B738",
    stand: "205",
    dest: "LCLK",
    rwy: "26L",
    sid: "BOGNA1X",
    rfl: "070",
    sqk: 2341,
  },
  {
    id: 2,
    time: "14:35",
    callsign: "EZY456",
    aircraft: "A320",
    stand: "122",
    dest: "LEMH",
    rwy: "26L",
    sid: "BOGNA1X",
    rfl: "060",
    sqk: 5342,
  },
  {
    id: 3,
    time: "14:41",
    callsign: "AAL2314",
    aircraft: "B77W",
    stand: "437",
    dest: "MDPC",
    rwy: "26L",
    sid: "NOVMA1X",
    rfl: "080",
    sqk: 3614,
  },
] as const;

const PHASES: { duration: number; caption: string }[] = [
  { duration: 4000, caption: "Open a session for your airport." },
  {
    duration: 5000,
    caption: "Share the view link to bring in another controller.",
  },
  {
    duration: 4000,
    caption: "Share the submit link so pilots can file their flight plans.",
  },
  {
    duration: 7000,
    caption:
      "Strips appear as pilots submit, without controllers needing to reload.",
  },
  {
    duration: 8000,
    caption:
      "When pilots call and you can't accommodate them immediately. You can mark strips as on Request.",
  },
  {
    duration: 7000,
    caption:
      "Once cleared, strips can be given a status so other controllers know exactly where each flight is at.",
  },
  {
    duration: 5000,
    caption:
      "Squawk codes are assigned automatically and can be regenerated at any time.",
  },
  {
    duration: 8000,
    caption:
      "Generate or edit routes for any strip and preview them on the map.",
  },
];

function reqColor(elapsed: number) {
  return `hsl(${Math.round(48 * (1 - Math.min(1, elapsed / 300)))}, 90%, 58%)`;
}

function fmtReq(elapsed: number) {
  return `${Math.floor(elapsed / 60)}:${Math.floor(elapsed % 60)
    .toString()
    .padStart(2, "0")}`;
}

type ReqData = { label: string; elapsed: number } | null;

function ReqCell({ req }: { req: ReqData }) {
  if (!req)
    return (
      <div className="flex items-center justify-center opacity-25">
        <span className="text-xs text-zinc-400">REQ</span>
      </div>
    );
  const color = reqColor(req.elapsed);
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-xs font-bold" style={{ color }}>
        {req.label}
      </span>
      <span className="text-xs tabular-nums" style={{ color }}>
        {fmtReq(req.elapsed)}
      </span>
    </div>
  );
}

function SqkCell({
  value,
  highlight,
  spinning,
}: {
  value: number;
  highlight: boolean;
  spinning?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 transition-all duration-300 ${highlight ? "ring-1 ring-blue-400 rounded px-0.5" : ""}`}
    >
      <span className="text-sm text-white tabular-nums w-10">
        {value > 0 ? String(value).padStart(4, "0") : ""}
      </span>
      <RefreshCw
        className={`w-2.5 h-2.5 shrink-0 transition-all duration-300 ${
          spinning
            ? "text-blue-400 animate-spin"
            : highlight
              ? "text-blue-400 animate-pulse"
              : "text-zinc-600"
        }`}
      />
    </div>
  );
}

function CopyBtn({
  label,
  variant,
  copied,
  highlight,
}: {
  label: string;
  variant: "submit" | "view";
  copied: boolean;
  highlight: boolean;
}) {
  const base =
    variant === "submit"
      ? "bg-blue-600 border-blue-600"
      : "bg-red-600 border-red-600";
  const active = copied ? "bg-emerald-600 border-emerald-600" : base;
  const ring =
    highlight && !copied
      ? "ring-2 ring-white/50 ring-offset-1 ring-offset-black/50"
      : "";
  return (
    <div
      className={`relative overflow-hidden flex items-center gap-1.5 border-2 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 select-none cursor-default ${active} ${ring}`}
    >
      <Copy
        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${copied ? "rotate-12" : ""}`}
      />
      <span
        className={`transition-transform duration-300 ${copied ? "scale-105" : ""}`}
      >
        {copied ? "Copied!" : label}
      </span>
      {copied && (
        <div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-full pointer-events-none" />
      )}
    </div>
  );
}

function MockNavbar({
  viewCopied,
  viewHighlight,
  submitCopied,
  submitHighlight,
}: {
  viewCopied: boolean;
  viewHighlight: boolean;
  submitCopied: boolean;
  submitHighlight: boolean;
}) {
  const [utc, setUtc] = useState(() => {
    const n = new Date();
    return `${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")}:${String(n.getUTCSeconds()).padStart(2, "0")} UTC`;
  });
  useEffect(() => {
    const iv = setInterval(() => {
      const n = new Date();
      setUtc(
        `${String(n.getUTCHours()).padStart(2, "0")}:${String(n.getUTCMinutes()).padStart(2, "0")}:${String(n.getUTCSeconds()).padStart(2, "0")} UTC`
      );
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      className="relative flex items-center px-6 h-16 select-none"
      style={{ background: "rgba(9,9,11,0.5)", backdropFilter: "blur(3px)" }}
    >
      <div className="flex items-center gap-2">
        <TowerControl className="h-7 w-7 text-blue-400" />
        <span className="text-xl font-bold bg-linear-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          PFControl
        </span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 bg-yellow-600 border-2 border-yellow-600 rounded-full px-3 py-1.5 text-xs font-medium text-white select-none cursor-default">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Support</span>
        </div>
        <span className="text-white font-mono text-xs tabular-nums">{utc}</span>
        <CopyBtn
          label="Submit Link"
          variant="submit"
          copied={submitCopied}
          highlight={submitHighlight}
        />
        <CopyBtn
          label="View Link"
          variant="view"
          copied={viewCopied}
          highlight={viewHighlight}
        />
      </div>
    </div>
  );
}

function MockToolbar({ avatarCount }: { avatarCount: number }) {
  return (
    <div className="showcase-toolbar toolbar flex items-center justify-between px-4 py-2 select-none">
      <div className="flex items-center gap-4">
        <WindDisplay icao="EGKK" size="small" />
        <FrequencyDisplay airportIcao="EGKK" showExpandedTable={false} />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center">
          <img
            src="/assets/app/team/iceit.webp"
            alt="iceit"
            className="w-8 h-8 rounded-full shadow-md object-cover shrink-0"
            style={{ border: "2px solid #3b82f6" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <img
            src="/assets/app/team/devbanane.webp"
            alt="devbanane"
            className="w-8 h-8 rounded-full shadow-md object-cover shrink-0 transition-all duration-500"
            style={{
              marginLeft: avatarCount >= 2 ? "-10px" : "-32px",
              border: "2px solid #3b82f6",
              opacity: avatarCount >= 2 ? 1 : 0,
              transform: avatarCount >= 2 ? "scale(1)" : "scale(0.6)",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <span className="text-md text-gray-300 font-bold leading-none">
          EGKK
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Dropdown
          options={[
            { value: "ALL", label: "All" },
            { value: "DEL", label: "Delivery" },
            { value: "GND", label: "Ground" },
            { value: "TWR", label: "Tower" },
            { value: "APP", label: "Approach" },
          ]}
          value="ALL"
          onChange={() => {}}
          placeholder="Select Position"
          size="sm"
          className="min-w-[100px]"
        />
        <Dropdown
          options={[
            { value: "26L", label: "26L" },
            { value: "26R", label: "26R" },
            { value: "08L", label: "08L" },
            { value: "08R", label: "08R" },
          ]}
          value="26L"
          onChange={() => {}}
          size="sm"
        />
        <Button
          className="flex items-center gap-2 px-4 py-2"
          size="sm"
          variant="outline"
        >
          <Info className="w-5 h-5" />
          <span className="font-medium">ATIS A</span>
        </Button>
        <Button className="flex items-center gap-2 px-4 py-2" size="sm">
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">Chat</span>
        </Button>
        <Button className="flex items-center gap-2 px-4 py-2" size="sm">
          <Map className="w-5 h-5" />
          <span className="font-medium">Charts</span>
        </Button>
        <Button className="flex items-center gap-2 px-4 py-2" size="sm">
          <Radio className="w-5 h-5" />
          <span className="font-medium">Contact</span>
        </Button>
        <Button className="flex items-center gap-2 px-4 py-2" size="sm">
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </Button>
      </div>
    </div>
  );
}

function DemoRouteModal({
  visible,
  resetKey,
  paused,
  onRouteGenerated,
}: {
  visible: boolean;
  resetKey: number;
  paused: boolean;
  onRouteGenerated: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generatePulse, setGeneratePulse] = useState(false);
  const [route, setRoute] = useState("");
  const [sid, setSid] = useState<string | undefined>();
  const [star, setStar] = useState<string | undefined>();
  const triggeredRef = useRef(false);

  useEffect(() => {
    triggeredRef.current = false;
    setGenerating(false);
    setGeneratePulse(false);
    setRoute("");
    setSid(undefined);
    setStar(undefined);
  }, [visible, resetKey]);

  useEffect(() => {
    if (!visible || paused || triggeredRef.current) return;
    triggeredRef.current = true;

    const t1 = setTimeout(() => setGeneratePulse(true), 1200);
    const t2 = setTimeout(() => {
      setGeneratePulse(false);
      setGenerating(true);
      fetchRoute("EGKK", "MDPC", "26L").then((result) => {
        if (result.success && result.route) {
          setRoute(result.route);
          setSid(result.sid);
          setStar(result.star);
          onRouteGenerated();
        } else {
          setRoute("EGKK NOVMA1X NOVMA MADAS BETIR BETIR1W MDPC");
          setSid("NOVMA1X");
          onRouteGenerated();
        }
        setGenerating(false);
      });
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, resetKey, paused]);

  return (
    <div
      className="absolute z-10 select-none pointer-events-none shadow-2xl"
      style={{
        top: "-4px",
        left: "44%",
        width: "520px",
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateX(-50%) translateY(-110px) scale(1)"
          : "translateX(-50%) translateY(-10px) scale(0.97)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      <div className="bg-zinc-900 border-2 border-blue-600 rounded-xl overflow-hidden">
        <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <GripHorizontal className="h-5 w-5 text-zinc-400" />
            <h3 className="text-lg font-semibold text-white">
              AAL2314 &mdash; B77W
            </h3>
          </div>
          <div className="p-1 rounded-full text-zinc-400">
            <X className="h-5 w-5" />
          </div>
        </div>

        <div className="px-5 pt-4 pb-5">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <div className="text-xs font-medium text-green-400 mb-0.5">
                Departure
              </div>
              <div className="text-white font-mono text-sm">EGKK</div>
            </div>
            <div>
              <div className="text-xs font-medium text-red-400 mb-0.5">
                Arrival
              </div>
              <div className="text-white font-mono text-sm">MDPC</div>
            </div>
            <div>
              <div className="text-xs font-medium text-blue-400 mb-0.5">
                SID
              </div>
              <div className="text-white font-mono text-sm">
                {sid || "NOVMA1X"}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-purple-400 mb-0.5">
                STAR
              </div>
              <div className="text-white font-mono text-sm">{star || "—"}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Route</label>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-zinc-700 text-white transition-all duration-200 ${generatePulse ? "ring-2 ring-white/60 scale-105" : ""}`}
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                {generating ? "Generating…" : "Generate"}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-blue-600 text-white opacity-40">
                <Check className="w-3.5 h-3.5" />
                Amend
              </div>
            </div>
          </div>

          <div
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 font-mono text-sm leading-relaxed min-h-[72px]"
            style={{ wordBreak: "break-all" }}
          >
            {generating ? (
              <span className="text-zinc-400">Generating route…</span>
            ) : route ? (
              <span className="text-white">{route}</span>
            ) : (
              <span className="text-zinc-500">Enter route…</span>
            )}
          </div>

          {route && !generating && (
            <div
              className="mt-3 rounded-lg overflow-hidden border border-zinc-700"
              style={{ height: 220 }}
            >
              <RouteMap
                route={route}
                departure="EGKK"
                arrival="MDPC"
                sid={sid}
                star={star}
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductShowcase() {
  const { user } = useAuth();
  const posthog = usePostHog();
  const [slide, setSlide] = useState(0);
  const [seq, setSeq] = useState(0);
  const [paused, setPaused] = useState(true);
  const [done, setDone] = useState(false);
  const hasEnteredRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dotsPillRef = useRef<HTMLDivElement>(null);
  const dotsContentRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLDivElement>(null);

  const [viewHighlight, setViewHighlight] = useState(false);
  const [viewCopied, setViewCopied] = useState(false);
  const [submitHighlight, setSubmitHighlight] = useState(false);
  const [submitCopied, setSubmitCopied] = useState(false);
  const [avatarCount, setAvatarCount] = useState(1);
  const [stripsShown, setStripsShown] = useState(0);

  const [bawReq, setBawReq] = useState(0);
  const [ezyReq, setEzyReq] = useState(0);
  const [aalReq, setAalReq] = useState(0);
  const [bawReqActive, setBawReqActive] = useState(false);
  const [ezyReqActive, setEzyReqActive] = useState(false);
  const [aalReqActive, setAalReqActive] = useState(false);

  const [bawCleared, setBawCleared] = useState(false);
  const [bawStatus, setBawStatus] = useState<"PENDING" | "STUP" | "PUSH">(
    "PENDING"
  );

  const [squawkHighlight, setSquawkHighlight] = useState(false);
  const [squawkSpinning, setSquawkSpinning] = useState(false);
  const [aalSqkNew, setAalSqkNew] = useState<number | null>(null);

  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [routeGenerated, setRouteGenerated] = useState(false);

  const elapsedAtPauseRef = useRef(0);
  const runStartRef = useRef(Date.now());
  const captionRef = useRef<HTMLParagraphElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const ctaContentRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);

  const goTo = (i: number, source: "dot" | "restart" = "dot") => {
    elapsedAtPauseRef.current = 0;
    setDone(false);
    setSlide(i);
    setSeq((s) => s + 1);
    setPaused(false);
    posthog?.capture("showcase_navigate", { slide: i, source });
  };

  useLayoutEffect(() => {
    if (cardRef.current)
      gsap.set(cardRef.current, { opacity: 0, scale: 0.96, y: 24 });
    if (dotsPillRef.current)
      gsap.set(dotsPillRef.current, {
        scaleX: 0.15,
        transformOrigin: "center",
      });
    if (dotsContentRef.current)
      gsap.set(dotsContentRef.current, { opacity: 0 });
    if (playBtnRef.current)
      gsap.set(playBtnRef.current, {
        scale: 0,
        opacity: 0,
        transformOrigin: "center",
      });
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!hasEnteredRef.current) {
            hasEnteredRef.current = true;
            posthog?.capture("showcase_viewed");
            gsap.to(card, {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.7,
              ease: "circ.out",
            });
            const pill = dotsPillRef.current;
            const btn = playBtnRef.current;
            if (pill) {
              gsap
                .timeline()
                .to(pill, { scaleX: 1.06, duration: 0.35, ease: "power3.out" })
                .to(pill, { scaleX: 0.97, duration: 0.1, ease: "power1.inOut" })
                .to(pill, { scaleX: 1, duration: 0.1, ease: "power1.inOut" });
            }
            const dotsContent = dotsContentRef.current;
            if (dotsContent) {
              gsap.to(dotsContent, {
                opacity: 1,
                duration: 0.12,
                delay: 0.35 + 0.1 + 0.1,
              });
            }
            if (btn) {
              gsap.to(btn, {
                scale: 1,
                opacity: 1,
                duration: 0.4,
                ease: "back.out(2)",
                delay: 0.35 + 0.1 + 0.1,
              });
            }
          }
          setPaused((p) => (p ? false : p));
        } else {
          if (hasEnteredRef.current) setPaused(true);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [posthog]);

  useEffect(() => {
    if (done) return;
    if (paused) {
      elapsedAtPauseRef.current += Date.now() - runStartRef.current;
      return;
    }
    runStartRef.current = Date.now();
    const remaining = PHASES[slide].duration - elapsedAtPauseRef.current;
    const t = setTimeout(
      () => {
        elapsedAtPauseRef.current = 0;
        if (slide === PHASES.length - 1) {
          setDone(true);
          setPaused(true);
          posthog?.capture("showcase_completed");
        } else {
          setSlide((s) => {
            posthog?.capture("showcase_slide_view", {
              slide: s + 1,
              caption: PHASES[s + 1]?.caption,
            });
            return s + 1;
          });
          setSeq((s) => s + 1);
        }
      },
      Math.max(0, remaining)
    );
    return () => clearTimeout(t);
  }, [slide, seq, paused, done, posthog]);

  useLayoutEffect(() => {
    setViewHighlight(false);
    setViewCopied(false);
    setSubmitHighlight(false);
    setSubmitCopied(false);
    setSquawkHighlight(false);
    setSquawkSpinning(false);
    if (slide < 7) setAalSqkNew(null);
    setRouteModalVisible(false);
    setRouteGenerated(false);
    // slide 1 effect animates the second avatar in; slides 2+ start with both visible
    setAvatarCount(slide >= 2 ? 2 : 1);
    // phase 3 animates strips in one by one; phase 4+ they persist at full count
    const newStripsShown = slide >= 4 ? 3 : 0;
    setStripsShown(newStripsShown);
    rowRefs.current.forEach((row, i) => {
      if (!row) return;
      gsap.killTweensOf(row);
      gsap.set(row, { opacity: newStripsShown >= i + 1 ? 1 : 0, y: 0 });
    });
    if (slide <= 4) {
      setBawReq(0);
      setEzyReq(0);
      setAalReq(0);
      setBawReqActive(false);
      setEzyReqActive(false);
      setAalReqActive(false);
    }
    if (slide < 5) {
      setBawCleared(false);
      setBawStatus("PENDING");
    }
  }, [slide, seq]);

  useEffect(() => {
    if (!captionRef.current) return;
    gsap.fromTo(
      captionRef.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }
    );
  }, [slide, seq]);

  // Guards against firing with stale stripsShown when slide changes — only animate on genuine increases
  const prevStripsShownRef = useRef(0);
  useEffect(() => {
    const prev = prevStripsShownRef.current;
    prevStripsShownRef.current = stripsShown;
    if (slide !== 3 || stripsShown === 0 || stripsShown <= prev) return;
    const row = rowRefs.current[stripsShown - 1];
    if (!row) return;
    gsap.fromTo(
      row,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
    );
  }, [stripsShown, slide]);

  useEffect(() => {
    if (!done || !ctaContentRef.current) return;
    gsap.fromTo(
      ctaContentRef.current,
      { opacity: 0, scale: 0.9, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" }
    );
  }, [done]);

  // Dot transition — old + new animate simultaneously; intermediates ripple
  const prevDotIdxRef = useRef(-1);
  const dotTlRef = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
    const curr = done ? PHASES.length : slide;
    const prev = prevDotIdxRef.current;

    if (prev === -1) {
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        gsap.set(dot, { width: i === curr ? 36 : 11 });
      });
      prevDotIdxRef.current = curr;
      return;
    }

    dotTlRef.current?.kill();
    prevDotIdxRef.current = curr;

    // Snap any dot that's neither prev nor curr — clears dots stuck mid-shrink from previous animations
    dotRefs.current.forEach((dot, i) => {
      if (!dot || i === prev || i === curr) return;
      gsap.killTweensOf(dot);
      gsap.set(dot, { width: 11, background: "rgba(255,255,255,0.25)" });
    });

    const direction = curr > prev ? 1 : -1;
    const steps = Math.abs(curr - prev);
    const totalDur = 0.5;
    const isSkip = steps > 1;

    const tl = gsap.timeline();
    dotTlRef.current = tl;

    const prevDot = dotRefs.current[prev];
    const destDot = dotRefs.current[curr];
    const collapseDur = isSkip ? totalDur * 0.25 : totalDur;
    const collapseEase = isSkip ? "power3.in" : "circ.out";
    const expandEase = isSkip ? "power4.in" : "circ.out";
    if (prevDot)
      tl.to(
        prevDot,
        { width: 11, duration: collapseDur, ease: collapseEase },
        0
      );
    if (destDot)
      tl.to(destDot, { width: 36, duration: totalDur, ease: expandEase }, 0);

    for (let s = 1; s < steps; s++) {
      const dot = dotRefs.current[prev + direction * s];
      if (!dot) continue;
      const t = (s / (steps + 1)) * totalDur * 0.8;
      const pulseDur = Math.min(0.14, totalDur / steps);
      tl.to(
        dot,
        {
          width: 20,
          background: "rgba(255,255,255,0.3)",
          duration: pulseDur * 0.5,
          ease: "power1.out",
        },
        t
      );
      tl.to(
        dot,
        {
          width: 11,
          background: "rgba(255,255,255,0.25)",
          duration: pulseDur * 0.5,
          ease: "power1.in",
        },
        t + pulseDur * 0.5
      );
    }
  }, [slide, done, seq]);

  // Phase 1: view link highlight + second avatar
  useEffect(() => {
    if (slide !== 1 || paused) return;
    const t1 = setTimeout(() => setViewHighlight(true), 400);
    const t2 = setTimeout(() => {
      setViewCopied(true);
      setViewHighlight(false);
    }, 1200);
    const t3 = setTimeout(() => setViewCopied(false), 3200);
    const t4 = setTimeout(() => setAvatarCount(2), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [slide, seq, paused]);

  // Phase 2: submit link highlight
  useEffect(() => {
    if (slide !== 2 || paused) return;
    const t1 = setTimeout(() => setSubmitHighlight(true), 400);
    const t2 = setTimeout(() => {
      setSubmitCopied(true);
      setSubmitHighlight(false);
    }, 1200);
    const t3 = setTimeout(() => setSubmitCopied(false), 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [slide, seq, paused]);

  // Phase 3: strips arrive one by one
  useEffect(() => {
    if (slide !== 3 || paused) return;
    const t1 = setTimeout(() => setStripsShown(1), 200);
    const t2 = setTimeout(() => setStripsShown(2), 2000);
    const t3 = setTimeout(() => setStripsShown(3), 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [slide, seq, paused]);

  // Phase 4: REQ appears in sequence, then timers count
  useEffect(() => {
    if (slide !== 4 || paused) return;
    const t1 = setTimeout(() => setBawReqActive(true), 500);
    const t2 = setTimeout(() => setEzyReqActive(true), 1200);
    const t3 = setTimeout(() => setAalReqActive(true), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [slide, seq, paused]);
  useEffect(() => {
    if (!bawReqActive || paused) return;
    const iv = setInterval(() => setBawReq((e) => e + 1.5), 100);
    return () => clearInterval(iv);
  }, [bawReqActive, paused]);
  useEffect(() => {
    if (!ezyReqActive || paused) return;
    const iv = setInterval(() => setEzyReq((e) => e + 1.5), 100);
    return () => clearInterval(iv);
  }, [ezyReqActive, paused]);
  useEffect(() => {
    if (!aalReqActive || paused) return;
    const iv = setInterval(() => setAalReq((e) => e + 1.5), 100);
    return () => clearInterval(iv);
  }, [aalReqActive, paused]);

  // Phase 5: BAW123 gets cleared, status steps
  useEffect(() => {
    if (slide !== 5 || paused) return;
    const t1 = setTimeout(() => setBawCleared(true), 800);
    const t2 = setTimeout(() => setBawStatus("STUP"), 3000);
    const t3 = setTimeout(() => setBawStatus("PUSH"), 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [slide, seq, paused]);

  // Phase 6: highlight squawk cell, then spin + regenerate to new code
  useEffect(() => {
    if (slide !== 6 || paused) return;
    const t1 = setTimeout(() => setSquawkHighlight(true), 400);
    const t2 = setTimeout(() => setSquawkSpinning(true), 1800);
    const t3 = setTimeout(() => {
      setSquawkSpinning(false);
      setAalSqkNew(4721);
    }, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [slide, seq, paused]);

  // Phase 7: route modal fades in
  useEffect(() => {
    if (slide !== 7 || paused) return;
    const t = setTimeout(() => setRouteModalVisible(true), 1000);
    return () => clearTimeout(t);
  }, [slide, seq, paused]);

  const animKey = `${slide}-${seq}`;

  const bawReqData: ReqData =
    (slide === 4 && bawReqActive) || (slide === 5 && !bawCleared)
      ? { label: "R1C", elapsed: bawReq }
      : null;
  const ezyReqData: ReqData =
    slide >= 4 && ezyReqActive ? { label: "R2C", elapsed: ezyReq } : null;
  const aalReqData: ReqData =
    slide >= 4 && aalReqActive ? { label: "R3C", elapsed: aalReq } : null;

  return (
    <section className="hidden min-[1338px]:block relative overflow-hidden bg-black">
      <div className="pt-36 pb-14 max-w-4xl mx-auto px-6 text-center">
        <h2
          className="text-4xl sm:text-6xl font-extrabold bg-linear-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent"
          style={{ lineHeight: 1.4 }}
        >
          How it works
        </h2>
      </div>

      <div className="mx-auto pb-36" style={{ width: "70vw" }}>
        <div
          ref={cardRef}
          className="relative rounded-2xl overflow-hidden pointer-events-none flex flex-col"
          style={{
            backgroundImage: "url(/assets/app/backgrounds/vowray__002.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.85)",
            minHeight: "700px",
          }}
        >
          <MockNavbar
            viewCopied={viewCopied}
            viewHighlight={viewHighlight}
            submitCopied={submitCopied}
            submitHighlight={submitHighlight}
          />
          <MockToolbar avatarCount={avatarCount} />

          <div className="relative flex-1">
            <div className="px-5 pt-3" style={{ minHeight: "220px" }}>
              <div className="rounded-xl overflow-hidden">
                <table
                  className="min-w-full showcase-table"
                  style={{ borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr className="bg-blue-950 text-blue-200 select-none">
                      <th className="py-2.5 px-2 text-left w-8 column-drag"></th>
                      <th className="py-2.5 px-4 text-left text-sm column-time">
                        TIME
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-callsign">
                        CALLSIGN
                      </th>
                      <th className="py-2.5 px-2 text-left text-sm w-16 column-req">
                        REQ
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-stand">
                        STAND
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-atyp">
                        ATYP
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-ades">
                        ADES
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-rwy">
                        RWY
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-sid">
                        SID
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-rfl">
                        RFL
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-cfl">
                        CFL
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-route">
                        RTE
                      </th>
                      <th className="py-2.5 px-4 text-center text-sm w-28">
                        ASSR
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-clearance">
                        C
                      </th>
                      <th className="py-2.5 px-4 text-left text-sm column-sts">
                        STS
                      </th>
                      <th className="py-2.5 pr-4 pl-2 text-center text-sm column-more">
                        <MoreHorizontal className="w-3.5 h-3.5 mx-auto text-gray-400" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stripsShown === 0 && (
                      <tr>
                        <td colSpan={16}>
                          <div className="mt-24 px-4 py-6 text-center text-gray-400 select-none pointer-events-none">
                            No departures found.
                          </div>
                        </td>
                      </tr>
                    )}
                    {ALL_FLIGHTS.map((f) => {
                      const visible = stripsShown >= f.id;
                      const req =
                        f.id === 1
                          ? bawReqData
                          : f.id === 2
                            ? ezyReqData
                            : aalReqData;
                      const status = f.id === 1 ? bawStatus : "PENDING";
                      const cleared = f.id === 1 && bawCleared;
                      const sqk = visible
                        ? f.id === 3
                          ? (aalSqkNew ?? (slide >= 6 ? 4721 : f.sqk))
                          : f.sqk
                        : 0;
                      const sqkHL = f.id === 3 && squawkHighlight;
                      const sqkSpin = f.id === 3 && squawkSpinning;

                      return (
                        <tr
                          key={f.id}
                          ref={(el) => {
                            rowRefs.current[f.id - 1] = el;
                          }}
                          className="select-none"
                          style={{
                            backgroundColor: "rgba(0,0,0,0.5)",
                            opacity: 0,
                          }}
                        >
                          <td className="py-2 px-2 text-sm text-zinc-600 column-drag">
                            <GripVertical className="w-4 h-4" />
                          </td>
                          <td className="py-2 px-4 text-sm text-white tabular-nums column-time">
                            {f.time}
                          </td>
                          <td className="py-2 px-4 text-sm font-medium text-white column-callsign">
                            {f.callsign}
                          </td>
                          <td className="py-2 px-2 text-sm column-req">
                            <ReqCell req={req} />
                          </td>
                          <td className="py-2 px-4 text-sm text-white column-stand">
                            {f.stand}
                          </td>
                          <td className="py-2 px-3 text-sm column-atyp">
                            <Dropdown
                              options={[
                                { value: f.aircraft, label: f.aircraft },
                              ]}
                              value={f.aircraft}
                              onChange={() => {}}
                              size="xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-ades">
                            <Dropdown
                              options={[{ value: f.dest, label: f.dest }]}
                              value={f.dest}
                              onChange={() => {}}
                              size="xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-rwy">
                            <Dropdown
                              options={[{ value: f.rwy, label: f.rwy }]}
                              value={f.rwy}
                              onChange={() => {}}
                              size="xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-sid">
                            <Dropdown
                              options={[{ value: f.sid, label: f.sid }]}
                              value={f.sid}
                              onChange={() => {}}
                              size="xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-rfl">
                            <Dropdown
                              options={[{ value: f.rfl, label: f.rfl }]}
                              value={f.rfl}
                              onChange={() => {}}
                              size="xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-cfl">
                            <Dropdown
                              options={[]}
                              value=""
                              onChange={() => {}}
                              size="xs"
                              placeholder="-"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-route">
                            <div
                              className={`px-2 py-1 rounded transition-colors ${
                                f.id === 3
                                  ? routeGenerated
                                    ? "text-gray-400"
                                    : routeModalVisible
                                      ? "text-blue-400"
                                      : "text-red-500"
                                  : "text-red-500"
                              }`}
                            >
                              <Route className="w-4 h-4" />
                            </div>
                          </td>
                          <td className="py-2 px-4 text-sm">
                            <SqkCell
                              value={sqk}
                              highlight={sqkHL}
                              spinning={sqkSpin}
                            />
                          </td>
                          <td className="py-2 px-4 text-sm column-clearance">
                            <Checkbox
                              checked={cleared}
                              onChange={() => {}}
                              label=""
                              checkedClass="bg-green-600 border-green-600"
                            />
                          </td>
                          <td className="py-2 px-3 text-sm column-sts">
                            <StatusDropdown
                              value={status}
                              onChange={() => {}}
                              size="xs"
                              controllerType="departure"
                            />
                          </td>
                          <td className="py-2 pr-4 pl-2 text-sm text-center column-more">
                            <div className="p-1 rounded text-gray-600">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <DemoRouteModal
              visible={routeModalVisible}
              resetKey={seq}
              paused={paused}
              onRouteGenerated={() => setRouteGenerated(true)}
            />
          </div>

          {done && (
            <div
              className="absolute inset-0 flex items-center justify-center z-20 select-auto pointer-events-none"
              style={{
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                ref={ctaContentRef}
                className="flex flex-col items-center gap-5 text-center pointer-events-auto"
                style={{ opacity: 0 }}
              >
                <p className="text-white text-3xl font-extrabold">
                  Ready to get started?
                </p>
                <a
                  href={
                    user ? "/?tutorial=true" : "/login?callback=/?tutorial=true"
                  }
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
                >
                  Start Tutorial
                </a>
              </div>
            </div>
          )}

          <div
            className="px-6 py-6"
            style={{
              minHeight: "96px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              key={animKey}
              ref={captionRef}
              className="text-white font-bold text-xl text-center leading-snug"
              style={{ opacity: 0 }}
            >
              {PHASES[slide].caption}
            </p>
          </div>
        </div>

        {/* Progress controls */}
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-3">
            <div
              ref={dotsPillRef}
              className="flex items-center rounded-full gap-1 px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div ref={dotsContentRef} className="flex items-center">
                {PHASES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    style={{
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      background: "none",
                      flexShrink: 0,
                      width: "36px",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      ref={(el) => {
                        dotRefs.current[i] = el;
                      }}
                      style={{
                        width: 11,
                        height: "11px",
                        borderRadius: 9999,
                        background: "rgba(255,255,255,0.25)",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {i === slide && !done && (
                        <div
                          key={animKey}
                          style={{
                            height: "100%",
                            width: "100%",
                            background: "rgba(255,255,255,0.95)",
                            borderRadius: 9999,
                            transformOrigin: "left center",
                            animation: `carouselFill ${p.duration}ms linear forwards`,
                            animationPlayState: paused ? "paused" : "running",
                          }}
                        />
                      )}
                    </div>
                  </button>
                ))}
                {/* Done dot */}
                <button
                  onClick={() => {
                    setSlide(PHASES.length - 1);
                    setDone(true);
                    setPaused(true);
                  }}
                  style={{
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    background: "none",
                    flexShrink: 0,
                    width: "36px",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div
                    ref={(el) => {
                      dotRefs.current[PHASES.length] = el;
                    }}
                    style={{
                      width: 11,
                      height: "11px",
                      borderRadius: 9999,
                      background: done
                        ? "rgba(255,255,255,0.95)"
                        : "rgba(255,255,255,0.25)",
                      transition: "background 0.3s",
                      flexShrink: 0,
                    }}
                  />
                </button>
              </div>
            </div>

            <div ref={playBtnRef} style={{ opacity: 0 }}>
              {done ? (
                <button
                  onClick={() => goTo(0, "restart")}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                    border: "none",
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setPaused((v) => {
                      posthog?.capture("showcase_playback", {
                        action: v ? "play" : "pause",
                        slide,
                      });
                      return !v;
                    });
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                    border: "none",
                  }}
                >
                  {paused ? (
                    <Play
                      className="w-3.5 h-3.5 text-white ml-0.5"
                      fill="currentColor"
                      stroke="none"
                    />
                  ) : (
                    <Pause
                      className="w-3.5 h-3.5 text-white"
                      fill="currentColor"
                      stroke="none"
                    />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes carouselFill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .showcase-toolbar #frequency-display > div {
          padding-top: 6px;
          padding-bottom: 6px;
        }
        @media (max-width: 1550px) {
          .showcase-toolbar.toolbar {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 0;
          }
        }
        @media (max-width: 2145px) {
          .showcase-toolbar.toolbar {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
          }
          .showcase-table .column-cfl {
            display: none;
          }
        }
        @media (max-width: 1600px) {
          .showcase-table .column-route {
            display: table-cell;
          }
          .showcase-table .column-stand {
            display: none;
          }
        }
        @media (max-width: 1400px) {
          .showcase-table .column-drag {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
