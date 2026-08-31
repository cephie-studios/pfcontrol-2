import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const CATEGORIES = [
  { id: 'flight-planning', label: 'Flight Planning & Clearance' },
  { id: 'flight-strips', label: 'Flight Strips & ATC Operations' },
  { id: 'communications', label: 'Communications' },
  { id: 'network-and-sessions', label: 'Network & Sessions' },
  { id: 'flight-rules', label: 'Flight Rules & Aircraft' },
  { id: 'profiles-and-community', label: 'Profiles & Community' },
];

interface Term {
  id: string;
  name: string;
  children?: React.ReactNode;
}

function SidebarNav({
  className = '',
  activeSection,
}: {
  className?: string;
  activeSection: string;
}) {
  return (
    <nav aria-label="Glossary categories" className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 px-2.5 mb-2">
        Categories
      </p>
      <ul className="space-y-0.5">
        {CATEGORIES.map((c) => {
          const isActive = c.id === activeSection;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800/40 text-zinc-200'
                    : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'
                }`}
              >
                {c.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function useActiveSection(): string {
  const [activeSection, setActiveSection] = useState(CATEGORIES[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActiveSection(topMost.target.id);
      },
      { rootMargin: '-100px 0px -70% 0px', threshold: 0 }
    );

    const elements = CATEGORIES.map((c) =>
      document.getElementById(c.id)
    ).filter((el): el is HTMLElement => el !== null);
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return activeSection;
}

function TermEntry({ id, name, children }: Term) {
  return (
    <div
      id={id}
      className="scroll-mt-8 py-4 border-b border-zinc-800/70 last:border-0"
    >
      <dt className="font-mono text-base font-bold text-white mb-1.5">
        {name}
      </dt>
      <dd className="text-zinc-300 leading-relaxed">{children}</dd>
    </div>
  );
}

export default function Glossary() {
  const activeSection = useActiveSection();

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-32">
        <div className="mb-10 max-w-3xl">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wide mb-2">
            Reference
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            ATC &amp; Flight Glossary
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
            Definitions for the air traffic control and flight planning terms
            used throughout PFControl — flight strips, clearances, ACARS, and
            the PFATC network. For a walkthrough of the app itself, see the{' '}
            <a
              href="/howtousepfcontrol"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
            >
              How to Use PFControl guide
            </a>
            .
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
          <aside className="hidden lg:block sticky top-32 self-start max-h-[calc(100vh-4rem)] overflow-y-auto pb-10">
            <SidebarNav activeSection={activeSection} />
          </aside>

          <details className="lg:hidden mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
              Categories
            </summary>
            <SidebarNav className="mt-4" activeSection={activeSection} />
          </details>

          <article className="min-w-0 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-white [&_h2]:mt-12 [&_h2]:mb-2 [&_h2:first-of-type]:mt-0 [&_h2]:scroll-mt-8 [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-300 [&_dt]:scroll-mt-8">
            <section id="flight-planning">
              <h2>Flight Planning & Clearance</h2>
              <dl>
                <TermEntry id="flight-plan" name="Flight Plan">
                  The set of details a pilot submits for a flight — callsign,
                  aircraft type, flight rules, destination, cruising level, and
                  route — either through a session's{' '}
                  <a href="/create">submit link</a> or the guest-accessible
                  submission form. Submitting one creates a flight strip on the
                  controller's board.
                </TermEntry>
                <TermEntry id="callsign" name="Callsign">
                  The identifier a flight operates under, such as an airline
                  code followed by a flight number. PFControl parses recognized
                  airline prefixes and displays them alongside the raw callsign
                  on the strip board.
                </TermEntry>
                <TermEntry id="icao-code" name="ICAO Code">
                  The four-letter code identifying an airport, used when
                  creating a <a href="/create">session</a> and as the
                  departure/arrival fields on a flight plan.
                </TermEntry>
                <TermEntry id="route" name="Route">
                  The planned path of airways and waypoints a flight follows
                  between departure and arrival, entered as free text or built
                  automatically with the Generate button, which picks a SID,
                  STAR, and cruising altitude that respects altitude rules.
                </TermEntry>
                <TermEntry id="sid" name="SID (Standard Instrument Departure)">
                  A published departure procedure a flight follows out of an
                  airport. PFControl infers the SID from the first token of a
                  route string when it matches a procedure-like pattern, and
                  displays it in its own column on the departures table.
                </TermEntry>
                <TermEntry
                  id="star"
                  name="STAR (Standard Terminal Arrival Route)"
                >
                  A published arrival procedure a flight follows into an
                  airport, inferred from the route the same way as a SID and
                  shown on the arrivals table.
                </TermEntry>
                <TermEntry id="rfl" name="RFL (Requested Flight Level)">
                  The cruising altitude a pilot requests when submitting a
                  flight plan, shown alongside the CFL on the departures table.
                </TermEntry>
                <TermEntry id="cfl" name="CFL (Cleared Flight Level)">
                  The cruising altitude a controller has actually cleared the
                  flight to, which may differ from the pilot's requested level.
                </TermEntry>
                <TermEntry id="alternate-airport" name="Alternate Airport">
                  A backup destination a pilot may list on their flight plan in
                  case the primary arrival airport can't be used.
                </TermEntry>
                <TermEntry id="pdc" name="PDC (Pre-Departure Clearance)">
                  The clearance a pilot requests and receives over{' '}
                  <a href="/howtousepfcontrol#acars-and-pdc">ACARS</a> before
                  pushing back, confirming their route and cruising level are
                  approved by the controller working that airport.
                </TermEntry>
                <TermEntry id="clearance" name="Clearance">
                  Explicit permission from a controller for a pilot to take a
                  specific action — push back, taxi, take off, or proceed on a
                  route — tracked through a flight's status and PDC state.
                </TermEntry>
              </dl>
            </section>

            <section id="flight-strips">
              <h2>Flight Strips & ATC Operations</h2>
              <dl>
                <TermEntry id="flight-strip" name="Flight Strip">
                  The live, editable row representing a single flight on a
                  session's board — the digital equivalent of a paper strip,
                  updating in real time for every controller in the session.
                </TermEntry>
                <TermEntry id="squawk" name="Squawk Code">
                  A four-digit transponder code assigned to a flight so it can
                  be distinguished on radar. PFControl includes a one-click
                  button to generate a new random code for a strip.
                </TermEntry>
                <TermEntry id="stand" name="Stand">
                  The gate or parking position a departing flight is assigned
                  before pushback, tracked as its own column on the departures
                  table.
                </TermEntry>
                <TermEntry id="adep" name="ADEP (Aerodrome of Departure)">
                  The origin airport of an arriving flight, shown on the
                  arrivals table.
                </TermEntry>
                <TermEntry id="ades" name="ADES (Aerodrome of Destination)">
                  The destination airport of a departing flight, shown on the
                  departures table.
                </TermEntry>
                <TermEntry
                  id="wake-turbulence-category"
                  name="Wake Turbulence Category"
                >
                  A classification of an aircraft type based on the turbulence
                  it generates, used alongside aircraft type on the strip board
                  to help controllers apply appropriate spacing.
                </TermEntry>
                <TermEntry id="status-flow" name="Status Flow">
                  The sequence a flight strip's status moves through as a flight
                  progresses. Departures run{' '}
                  <strong>PENDING → STUP → PUSH → TAXI → RWY → DEPA</strong>;
                  arrivals run <strong>APP → RWY → TAXI → GATE</strong>.
                </TermEntry>
              </dl>
            </section>

            <section id="communications">
              <h2>Communications</h2>
              <dl>
                <TermEntry id="acars" name="ACARS">
                  PFControl's messaging terminal for a signed-in pilot's flight
                  — a log of the submitted flight plan, PDC requests and
                  clearances, and any messages a controller sends. Opening ACARS
                  requires being signed in, since it's tied to your account. See{' '}
                  <a href="/howtousepfcontrol#acars-and-pdc">
                    ACARS &amp; Requesting PDC
                  </a>{' '}
                  in the guide.
                </TermEntry>
                <TermEntry id="atis" name="ATIS">
                  Automated Terminal Information Service — a recorded broadcast
                  of current airport conditions and active runway. PFControl can
                  auto-generate an ATIS formatted for the PFATC ATIS channel
                  when you create a PFATC session.
                </TermEntry>
                <TermEntry id="contact-me" name="Contact Me Message">
                  A direct message a controller can send a pilot through ACARS —
                  for example asking them to switch to a specific frequency —
                  which appears in the pilot's terminal the same way a clearance
                  does.
                </TermEntry>
              </dl>
            </section>

            <section id="network-and-sessions">
              <h2>Network & Sessions</h2>
              <dl>
                <TermEntry id="session" name="Session">
                  A flight strip board for a single airport, created from{' '}
                  <a href="/create">Create Session</a>. A Standard session is
                  private to whoever has the link; a PFATC session publishes its
                  traffic to the Network Overview.
                </TermEntry>
                <TermEntry id="pfatc-network" name="PFATC Network">
                  An organized, network-wide mode for controlling: PFATC
                  sessions share departures and arrivals with each other and
                  appear together on the{' '}
                  <a href="/overview">Network Overview</a>, rather than staying
                  isolated to a single session.
                </TermEntry>
                <TermEntry id="network-overview" name="Network Overview">
                  A live, network-wide dashboard at{' '}
                  <a href="/overview">/overview</a> showing every open PFATC
                  session's active departures and arrivals at once.
                </TermEntry>
                <TermEntry id="sector" name="Sector">
                  An area of airspace or set of airports a controller is
                  assigned permissions for, determining which flights they can
                  edit from the Network Overview and which airports' charts
                  surface first in the Chart Drawer.
                </TermEntry>
              </dl>
            </section>

            <section id="flight-rules">
              <h2>Flight Rules & Aircraft</h2>
              <dl>
                <TermEntry id="ifr" name="IFR (Instrument Flight Rules)">
                  A flight plan type indicating the flight will operate under
                  instrument procedures, typically involving a full route,
                  assigned altitudes, and ATC clearances at each stage.
                </TermEntry>
                <TermEntry id="vfr" name="VFR (Visual Flight Rules)">
                  A flight plan type indicating the flight will operate visually
                  rather than on instrument procedures, generally with a simpler
                  clearance flow.
                </TermEntry>
              </dl>
            </section>

            <section id="profiles-and-community">
              <h2>Profiles & Community</h2>
              <dl>
                <TermEntry id="featured-flight" name="Featured Flight">
                  A flight a pilot has chosen to highlight on their{' '}
                  <a href="/howtousepfcontrol#public-profiles">
                    public profile
                  </a>
                  , capped at three per pilot.
                </TermEntry>
                <TermEntry id="controller-rating" name="Controller Rating">
                  Feedback a pilot can leave for a controller after a session,
                  contributing to that controller's average rating shown on
                  their public profile.
                </TermEntry>
                <TermEntry id="developer-api" name="Developer API">
                  PFControl's public REST API for reading session, flight, and
                  account data with a scoped key. See the full{' '}
                  <a href="/developers/docs">API reference</a>.
                </TermEntry>
              </dl>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
