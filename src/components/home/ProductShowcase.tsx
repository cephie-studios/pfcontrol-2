import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Check, Copy, GripHorizontal, GripVertical, HelpCircle, Info, Loader2, Map, MessageCircle, MoreHorizontal, Pause, Play, Radio, RefreshCw, Route, Settings, TowerControl, Wand2, X } from 'lucide-react';
import { fetchRoute } from '../../utils/fetch/data';
import Dropdown from '../common/Dropdown';
import Checkbox from '../common/Checkbox';
import StatusDropdown from '../dropdowns/StatusDropdown';
import Button from '../common/Button';
import WindDisplay from '../tools/WindDisplay';
import FrequencyDisplay from '../tools/FrequencyDisplay';
import RouteMap from '../map/RouteMap';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const ALL_FLIGHTS = [
  { id: 1, time: '14:32', callsign: 'BAW123',  aircraft: 'B738', stand: '205', dest: 'LCLK', rwy: '26L', sid: 'BOGNA1X', rfl: '070', sqk: 2341 },
  { id: 2, time: '14:35', callsign: 'EZY456',  aircraft: 'A320', stand: '122', dest: 'LEMH', rwy: '26L', sid: 'BOGNA1X', rfl: '060', sqk: 5342 },
  { id: 3, time: '14:41', callsign: 'AAL2314', aircraft: 'B77W', stand: '437', dest: 'MDPC', rwy: '26L', sid: 'NOVMA1X', rfl: '080', sqk: 3614 },
] as const;

const PHASES: { duration: number; caption: string }[] = [
  { duration: 4000, caption: 'Open a session for your airport.' },
  { duration: 5000, caption: 'Share the view link to bring in another controller.' },
  { duration: 4000, caption: 'Share the submit link so pilots can file their plans.' },
  { duration: 7000, caption: 'Strips appear as pilots submit, without having to reload.' },
  { duration: 8000, caption: 'Pilots call all at once. REQ logs the order they requested clearance so nothing gets missed.' },
  { duration: 7000, caption: 'C and STS update instantly for all controllers in the session without having to reload.' },
  { duration: 5000, caption: 'Squawk codes are assigned automatically and can be regenerated at any time.' },
  { duration: 8000, caption: 'Generate or edit routes for any strip and preview them on the map.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reqColor(elapsed: number) {
  return `hsl(${Math.round(48 * (1 - Math.min(1, elapsed / 300)))}, 90%, 58%)`;
}

function fmtReq(elapsed: number) {
  return `${Math.floor(elapsed / 60)}:${Math.floor(elapsed % 60).toString().padStart(2, '0')}`;
}

type ReqData = { label: string; elapsed: number } | null;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReqCell({ req }: { req: ReqData }) {
  if (!req) return <div className="flex items-center justify-center opacity-25"><span className="text-xs text-zinc-400">REQ</span></div>;
  const color = reqColor(req.elapsed);
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-xs font-bold" style={{ color }}>{req.label}</span>
      <span className="text-xs tabular-nums" style={{ color }}>{fmtReq(req.elapsed)}</span>
    </div>
  );
}

function SqkCell({ value, highlight }: { value: number; highlight: boolean }) {
  return (
    <div className={`flex items-center gap-0.5 transition-all duration-300 ${highlight ? 'ring-1 ring-blue-400 rounded px-0.5' : ''}`}>
      <span className="text-sm text-white tabular-nums w-10">
        {value > 0 ? String(value).padStart(4, '0') : ''}
      </span>
      {highlight && <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-pulse shrink-0" />}
    </div>
  );
}

function CopyBtn({ label, variant, copied, highlight }: {
  label: string; variant: 'submit' | 'view'; copied: boolean; highlight: boolean;
}) {
  const base   = variant === 'submit' ? 'bg-blue-600 border-blue-600' : 'bg-red-600 border-red-600';
  const active = copied ? 'bg-emerald-600 border-emerald-600' : base;
  const ring   = highlight && !copied ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-black/50' : '';
  return (
    <div className={`relative overflow-hidden flex items-center gap-1.5 border-2 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 select-none cursor-default ${active} ${ring}`}>
      <Copy className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${copied ? 'rotate-12' : ''}`} />
      <span className={`transition-transform duration-300 ${copied ? 'scale-105' : ''}`}>
        {copied ? 'Copied!' : label}
      </span>
      {copied && <div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-full pointer-events-none" />}
    </div>
  );
}

function MockNavbar({ viewCopied, viewHighlight, submitCopied, submitHighlight }: {
  viewCopied: boolean; viewHighlight: boolean;
  submitCopied: boolean; submitHighlight: boolean;
}) {
  const [utc, setUtc] = useState(() => {
    const n = new Date();
    return `${String(n.getUTCHours()).padStart(2, '0')}:${String(n.getUTCMinutes()).padStart(2, '0')}:${String(n.getUTCSeconds()).padStart(2, '0')} UTC`;
  });
  useEffect(() => {
    const iv = setInterval(() => {
      const n = new Date();
      setUtc(`${String(n.getUTCHours()).padStart(2, '0')}:${String(n.getUTCMinutes()).padStart(2, '0')}:${String(n.getUTCSeconds()).padStart(2, '0')} UTC`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="relative flex items-center px-6 h-16 border-b border-white/10 select-none" style={{ background: 'rgba(9,9,11,0.5)', backdropFilter: 'blur(3px)' }}>
      {/* Logo — left */}
      <div className="flex items-center gap-2">
        <TowerControl className="h-7 w-7 text-blue-400" />
        <span className="text-xl font-bold bg-linear-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">PFControl</span>
      </div>
      {/* Center: session controls — absolutely centered */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 bg-yellow-600 border-2 border-yellow-600 rounded-full px-3 py-1.5 text-xs font-medium text-white select-none cursor-default">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Support</span>
        </div>
        <span className="text-white font-mono text-xs tabular-nums">{utc}</span>
        <CopyBtn label="Submit Link" variant="submit" copied={submitCopied} highlight={submitHighlight} />
        <CopyBtn label="View Link"   variant="view"   copied={viewCopied}   highlight={viewHighlight}   />
      </div>
    </div>
  );
}

function MockToolbar({ avatarCount }: { avatarCount: number }) {
  return (
    <div className="showcase-toolbar toolbar flex items-center justify-between px-4 py-2 border-b border-white/10 select-none">
      {/* Left: live wind + frequency */}
      <div className="flex items-center gap-4">
        <WindDisplay icao="EGKK" size="small" />
        <FrequencyDisplay airportIcao="EGKK" showExpandedTable={false} />
      </div>

      {/* Center: avatars + EGKK */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center">
          <img
            src="/assets/app/team/iceit.webp"
            alt="iceit"
            className="w-8 h-8 rounded-full shadow-md object-cover shrink-0"
            style={{ border: '2px solid #3b82f6' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <img
            src="/assets/app/team/devbanane.webp"
            alt="devbanane"
            className="w-8 h-8 rounded-full shadow-md object-cover shrink-0 transition-all duration-500"
            style={{
              marginLeft: '-10px',
              border: '2px solid #3b82f6',
              opacity: avatarCount >= 2 ? 1 : 0,
              transform: avatarCount >= 2 ? 'scale(1)' : 'scale(0.6)',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <span className="text-md text-gray-300 font-bold leading-none">EGKK</span>
      </div>

      {/* Right: toolbar controls copied from Toolbar.tsx */}
      <div className="flex items-center gap-4">
        <Dropdown
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'DEL', label: 'Delivery' },
            { value: 'GND', label: 'Ground' },
            { value: 'TWR', label: 'Tower' },
            { value: 'APP', label: 'Approach' },
          ]}
          value="ALL"
          onChange={() => {}}
          placeholder="Select Position"
          size="sm"
          className="min-w-[100px]"
        />
        <Dropdown
          options={[{ value: '26L', label: '26L' }, { value: '26R', label: '26R' }, { value: '08L', label: '08L' }, { value: '08R', label: '08R' }]}
          value="26L"
          onChange={() => {}}
          size="sm"
        />
        <Button className="flex items-center gap-2 px-4 py-2" size="sm" variant="outline">
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
  onRouteGenerated,
}: {
  visible: boolean;
  resetKey: number;
  onRouteGenerated: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generatePulse, setGeneratePulse] = useState(false);
  const [route, setRoute] = useState('');
  const [sid, setSid] = useState<string | undefined>();
  const [star, setStar] = useState<string | undefined>();

  // Reset + auto-generate when phase becomes visible
  useEffect(() => {
    setGenerating(false);
    setGeneratePulse(false);
    setRoute('');
    setSid(undefined);
    setStar(undefined);
    if (!visible) return;

    const t1 = setTimeout(() => setGeneratePulse(true), 1200);
    const t2 = setTimeout(() => {
      setGeneratePulse(false);
      setGenerating(true);
      fetchRoute('EGKK', 'MDPC', '26L').then((result) => {
        if (result.success && result.route) {
          setRoute(result.route);
          setSid(result.sid);
          setStar(result.star);
          onRouteGenerated();
        } else {
          // fallback static route if API unavailable
          setRoute('EGKK NOVMA1X NOVMA MADAS BETIR BETIR1W MDPC');
          setSid('NOVMA1X');
          onRouteGenerated();
        }
        setGenerating(false);
      });
    }, 2400);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, resetKey]);

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-10 select-none pointer-events-none shadow-2xl"
      style={{
        top: '8px',
        width: '520px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.97)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <div className="bg-zinc-900 border-2 border-blue-600 rounded-xl overflow-hidden">
        {/* Header — matches RouteModal */}
        <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <GripHorizontal className="h-5 w-5 text-zinc-400" />
            <h3 className="text-lg font-semibold text-white">AAL2314 &mdash; B77W</h3>
          </div>
          <div className="p-1 rounded-full text-zinc-400"><X className="h-5 w-5" /></div>
        </div>

        {/* Body — matches RouteModal layout */}
        <div className="px-5 pt-4 pb-5">
          {/* Dep / Arr / SID / STAR */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <div className="text-xs font-medium text-green-400 mb-0.5">Departure</div>
              <div className="text-white font-mono text-sm">EGKK</div>
            </div>
            <div>
              <div className="text-xs font-medium text-red-400 mb-0.5">Arrival</div>
              <div className="text-white font-mono text-sm">MDPC</div>
            </div>
            <div>
              <div className="text-xs font-medium text-blue-400 mb-0.5">SID</div>
              <div className="text-white font-mono text-sm">{sid || 'NOVMA1X'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-purple-400 mb-0.5">STAR</div>
              <div className="text-white font-mono text-sm">{star || '—'}</div>
            </div>
          </div>

          {/* Route label + buttons */}
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Route</label>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-zinc-700 text-white transition-all duration-200 ${generatePulse ? 'ring-2 ring-white/60 scale-105' : ''}`}
              >
                {generating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Wand2 className="w-3.5 h-3.5" />}
                {generating ? 'Generating…' : 'Generate'}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-blue-600 text-white opacity-40">
                <Check className="w-3.5 h-3.5" />
                Amend
              </div>
            </div>
          </div>

          {/* Route textarea — div replica */}
          <div
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 font-mono text-sm leading-relaxed min-h-[72px]"
            style={{ wordBreak: 'break-all' }}
          >
            {generating
              ? <span className="text-zinc-400">Generating route…</span>
              : route
                ? <span className="text-white">{route}</span>
                : <span className="text-zinc-500">Enter route…</span>}
          </div>

          {/* Map — shown once route is ready */}
          {route && !generating && (
            <div className="mt-3 rounded-lg overflow-hidden border border-zinc-700" style={{ height: 220 }}>
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function ProductShowcase() {
  const [slide,  setSlide]  = useState(0);
  const [seq,    setSeq]    = useState(0);
  const [paused, setPaused] = useState(false);

  const [viewHighlight,   setViewHighlight]   = useState(false);
  const [viewCopied,      setViewCopied]      = useState(false);
  const [submitHighlight, setSubmitHighlight] = useState(false);
  const [submitCopied,    setSubmitCopied]    = useState(false);
  const [avatarCount,     setAvatarCount]     = useState(1);

  // 0=none, 1=BAW only, 2=BAW+EZY, 3=all three
  const [stripsShown, setStripsShown] = useState(0);

  const [bawReq,       setBawReq]       = useState(0);
  const [ezyReq,       setEzyReq]       = useState(0);
  const [aalReq,       setAalReq]       = useState(0);
  const [bawReqActive, setBawReqActive] = useState(false);
  const [ezyReqActive, setEzyReqActive] = useState(false);
  const [aalReqActive, setAalReqActive] = useState(false);

  const [bawCleared, setBawCleared] = useState(false);
  const [bawStatus,  setBawStatus]  = useState<'PENDING' | 'STUP' | 'PUSH'>('PENDING');

  const [squawkHighlight, setSquawkHighlight] = useState(false);

  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [routeGenerated,    setRouteGenerated]    = useState(false);

  const elapsedAtPauseRef = useRef(0);
  const runStartRef       = useRef(Date.now());

  const goTo = (i: number) => {
    elapsedAtPauseRef.current = 0;
    setSlide(i);
    setSeq(s => s + 1);
    setPaused(false);
  };

  // Slide timer
  useEffect(() => {
    if (paused) {
      elapsedAtPauseRef.current += Date.now() - runStartRef.current;
      return;
    }
    runStartRef.current = Date.now();
    const remaining = PHASES[slide].duration - elapsedAtPauseRef.current;
    const t = setTimeout(() => {
      elapsedAtPauseRef.current = 0;
      setSlide(s => (s + 1) % PHASES.length);
      setSeq(s => s + 1);
    }, Math.max(0, remaining));
    return () => clearTimeout(t);
  }, [slide, seq, paused]);

  // Synchronous resets before paint — prevents any flash on navigation
  useLayoutEffect(() => {
    setViewHighlight(false);
    setViewCopied(false);
    setSubmitHighlight(false);
    setSubmitCopied(false);
    setSquawkHighlight(false);
    setRouteModalVisible(false);
    setRouteGenerated(false);
    // Avatar: 1 for slides 0-1 (slide 1 effect animates it in), 2 for slides 2+
    setAvatarCount(slide >= 2 ? 2 : 1);
    // Strips: phase 3 effect animates them in; phase 4+ they persist as all-shown
    setStripsShown(slide >= 4 ? 3 : 0);
    // REQ: reset on slides up to and including phase 4 entry
    if (slide <= 4) {
      setBawReq(0); setEzyReq(0); setAalReq(0);
      setBawReqActive(false); setEzyReqActive(false); setAalReqActive(false);
    }
    // Clearance/status: reset before phase 5
    if (slide < 5) { setBawCleared(false); setBawStatus('PENDING'); }
  }, [slide, seq]);

  // Phase 1: view link highlight + second avatar
  useEffect(() => {
    if (slide !== 1 || paused) return;
    const t1 = setTimeout(() => setViewHighlight(true), 400);
    const t2 = setTimeout(() => { setViewCopied(true); setViewHighlight(false); }, 1200);
    const t3 = setTimeout(() => setViewCopied(false), 3200);
    const t4 = setTimeout(() => setAvatarCount(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [slide, seq, paused]);

  // Phase 2: submit link highlight
  useEffect(() => {
    if (slide !== 2 || paused) return;
    const t1 = setTimeout(() => setSubmitHighlight(true), 400);
    const t2 = setTimeout(() => { setSubmitCopied(true); setSubmitHighlight(false); }, 1200);
    const t3 = setTimeout(() => setSubmitCopied(false), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [slide, seq, paused]);

  // Phase 3: strips arrive one by one
  useEffect(() => {
    if (slide !== 3 || paused) return;
    const t1 = setTimeout(() => setStripsShown(1), 200);
    const t2 = setTimeout(() => setStripsShown(2), 2000);
    const t3 = setTimeout(() => setStripsShown(3), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [slide, seq, paused]);

  // Phase 4: REQ appears in sequence, then timers count
  useEffect(() => {
    if (slide !== 4 || paused) return;
    const t1 = setTimeout(() => setBawReqActive(true), 500);
    const t2 = setTimeout(() => setEzyReqActive(true), 1200);
    const t3 = setTimeout(() => setAalReqActive(true), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [slide, seq, paused]);
  useEffect(() => {
    if (!bawReqActive || paused) return;
    const iv = setInterval(() => setBawReq(e => e + 1.5), 100);
    return () => clearInterval(iv);
  }, [bawReqActive, paused]);
  useEffect(() => {
    if (!ezyReqActive || paused) return;
    const iv = setInterval(() => setEzyReq(e => e + 1.5), 100);
    return () => clearInterval(iv);
  }, [ezyReqActive, paused]);
  useEffect(() => {
    if (!aalReqActive || paused) return;
    const iv = setInterval(() => setAalReq(e => e + 1.5), 100);
    return () => clearInterval(iv);
  }, [aalReqActive, paused]);

  // Phase 5: BAW123 gets cleared, status steps
  useEffect(() => {
    if (slide !== 5 || paused) return;
    const t1 = setTimeout(() => setBawCleared(true), 800);
    const t2 = setTimeout(() => setBawStatus('STUP'), 3000);
    const t3 = setTimeout(() => setBawStatus('PUSH'), 5500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [slide, seq, paused]);

  // Phase 6: AAL2314 squawk counts up
  // Phase 6: highlight AAL2314 squawk cell + pulse regenerate button
  useEffect(() => {
    if (slide !== 6 || paused) return;
    const t = setTimeout(() => setSquawkHighlight(true), 400);
    return () => clearTimeout(t);
  }, [slide, seq, paused]);

  // Phase 7: route modal fades in
  useEffect(() => {
    if (slide !== 7 || paused) return;
    const t = setTimeout(() => setRouteModalVisible(true), 1000);
    return () => clearTimeout(t);
  }, [slide, seq, paused]);

  const animKey = `${slide}-${seq}`;

  // REQ derivations
  const bawReqData: ReqData = (slide === 4 && bawReqActive) || (slide === 5 && !bawCleared)
    ? { label: 'R1C', elapsed: bawReq } : null;
  const ezyReqData: ReqData = slide >= 4 && ezyReqActive ? { label: 'R2C', elapsed: ezyReq } : null;
  const aalReqData: ReqData = slide >= 4 && aalReqActive ? { label: 'R3C', elapsed: aalReq } : null;

  return (
    <section className="hidden lg:block relative overflow-hidden bg-black">
      <div className="pt-36 pb-14 max-w-4xl mx-auto px-6 text-center">
        <h2
          className="text-4xl sm:text-6xl font-extrabold bg-linear-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent"
          style={{ lineHeight: 1.4 }}
        >
          How it works
        </h2>
      </div>

      <div className="mx-auto pb-36" style={{ width: '70vw' }}>
        <div
          className="relative rounded-2xl overflow-hidden pointer-events-none flex flex-col"
          style={{
            backgroundImage: 'url(/assets/app/backgrounds/vowray__002.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.85)',
            minHeight: '700px',
          }}
        >
          <MockNavbar
            viewCopied={viewCopied}
            viewHighlight={viewHighlight}
            submitCopied={submitCopied}
            submitHighlight={submitHighlight}
          />
          <MockToolbar avatarCount={avatarCount} />

          {/* Strip table + floating route modal */}
          <div className="relative flex-1">
            <div className="px-5 pt-3" style={{ minHeight: '220px' }}>
              <div className="rounded-xl overflow-hidden">
                <table className="min-w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-blue-950 text-blue-200 select-none">
                      <th className="py-2.5 px-2 text-left w-8"></th>
                      <th className="py-2.5 px-4 text-left text-sm column-time">TIME</th>
                      <th className="py-2.5 px-4 text-left text-sm column-callsign">CALLSIGN</th>
                      <th className="py-2.5 px-2 text-left text-sm w-16 column-req">REQ</th>
                      <th className="py-2.5 px-4 text-left text-sm column-stand">STAND</th>
                      <th className="py-2.5 px-4 text-left text-sm column-atyp">ATYP</th>
                      <th className="py-2.5 px-4 text-left text-sm column-ades">ADES</th>
                      <th className="py-2.5 px-4 text-left text-sm column-rwy">RWY</th>
                      <th className="py-2.5 px-4 text-left text-sm column-sid">SID</th>
                      <th className="py-2.5 px-4 text-left text-sm column-rfl">RFL</th>
                      <th className="py-2.5 px-4 text-left text-sm column-cfl">CFL</th>
                      <th className="py-2.5 px-4 text-left text-sm column-route">RTE</th>
                      <th className="py-2.5 px-4 text-center text-sm w-28">ASSR</th>
                      <th className="py-2.5 px-4 text-left text-sm column-clearance">C</th>
                      <th className="py-2.5 px-4 text-left text-sm column-sts">STS</th>
                      <th className="py-2.5 pr-4 pl-2 text-center text-sm column-more"><MoreHorizontal className="w-3.5 h-3.5 mx-auto text-gray-400" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stripsShown === 0 && (
                      <tr>
                        <td colSpan={16}>
                          <div className="mt-24 px-4 py-6 text-center text-gray-400">
                            No departures found.
                          </div>
                        </td>
                      </tr>
                    )}
                    {ALL_FLIGHTS.map((f) => {
                      const visible = stripsShown >= f.id;
                      const req     = f.id === 1 ? bawReqData : f.id === 2 ? ezyReqData : aalReqData;
                      const status  = f.id === 1 ? bawStatus : 'PENDING';
                      const cleared = f.id === 1 && bawCleared;
                      const sqk     = visible ? f.sqk : 0;
                      const sqkHL   = f.id === 3 && squawkHighlight;

                      return (
                        <tr
                          key={f.id}
                          className="select-none"
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            opacity:   visible ? 1 : 0,
                            transform: visible ? 'translateY(0)' : 'translateY(-5px)',
                            transition: visible
                              ? 'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)'
                              : 'none',
                          }}
                        >
                          <td className="py-2 px-2 text-sm text-zinc-600"><GripVertical className="w-4 h-4" /></td>
                          <td className="py-2 px-4 text-sm text-white tabular-nums column-time">{f.time}</td>
                          <td className="py-2 px-4 text-sm font-medium text-white column-callsign">{f.callsign}</td>
                          <td className="py-2 px-2 text-sm column-req"><ReqCell req={req} /></td>
                          <td className="py-2 px-4 text-sm text-white column-stand">{f.stand}</td>
                          <td className="py-2 px-3 text-sm column-atyp"><Dropdown options={[{value:f.aircraft,label:f.aircraft}]} value={f.aircraft} onChange={() => {}} size="xs" /></td>
                          <td className="py-2 px-3 text-sm column-ades"><Dropdown options={[{value:f.dest,label:f.dest}]} value={f.dest} onChange={() => {}} size="xs" /></td>
                          <td className="py-2 px-3 text-sm column-rwy"><Dropdown options={[{value:f.rwy,label:f.rwy}]} value={f.rwy} onChange={() => {}} size="xs" /></td>
                          <td className="py-2 px-3 text-sm column-sid"><Dropdown options={[{value:f.sid,label:f.sid}]} value={f.sid} onChange={() => {}} size="xs" /></td>
                          <td className="py-2 px-3 text-sm column-rfl"><Dropdown options={[{value:f.rfl,label:f.rfl}]} value={f.rfl} onChange={() => {}} size="xs" /></td>
                          <td className="py-2 px-3 text-sm column-cfl"><Dropdown options={[]} value="" onChange={() => {}} size="xs" placeholder="-" /></td>
                          <td className="py-2 px-3 text-sm column-route">
                            <div className={`px-2 py-1 rounded transition-colors ${
                              f.id === 3
                                ? routeGenerated ? 'text-gray-400' : routeModalVisible ? 'text-blue-400' : 'text-red-500'
                                : 'text-red-500'
                            }`}>
                              <Route className="w-4 h-4" />
                            </div>
                          </td>
                          <td className="py-2 px-4 text-sm"><SqkCell value={sqk} highlight={sqkHL} /></td>
                          <td className="py-2 px-4 text-sm column-clearance"><Checkbox checked={cleared} onChange={() => {}} label="" checkedClass="bg-green-600 border-green-600" /></td>
                          <td className="py-2 px-3 text-sm column-sts"><StatusDropdown value={status} onChange={() => {}} size="xs" controllerType="departure" /></td>
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
              onRouteGenerated={() => setRouteGenerated(true)}
            />
          </div>

          {/* Caption */}
          <div className="px-6 py-6" style={{ minHeight: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p
              key={animKey}
              className="text-white font-bold text-xl text-center leading-snug"
              style={{ animation: 'capIn 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
            >
              {PHASES[slide].caption}
            </p>
          </div>
        </div>

        {/* Progress controls */}
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-4 rounded-full px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
            >
              {PHASES.map((p, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  style={{ border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
                >
                  <div style={{
                    width: i === slide ? '40px' : '9px',
                    height: '9px',
                    borderRadius: 9999,
                    background: 'rgba(255,255,255,0.2)',
                    transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
                    overflow: 'hidden',
                  }}>
                    {i === slide && (
                      <div key={animKey} style={{
                        height: '100%',
                        width: '100%',
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: 9999,
                        transformOrigin: 'left center',
                        animation: `carouselFill ${p.duration}ms linear forwards`,
                        animationPlayState: paused ? 'paused' : 'running',
                      }} />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setPaused(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              style={{ border: 'none' }}
            >
              {paused
                ? <Play  className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" stroke="none" />
                : <Pause className="w-3.5 h-3.5 text-white"        fill="currentColor" stroke="none" />
              }
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes carouselFill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes capIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .showcase-toolbar #frequency-display > div {
          padding-top: 6px;
          padding-bottom: 6px;
        }
      `}</style>
    </section>
  );
}
