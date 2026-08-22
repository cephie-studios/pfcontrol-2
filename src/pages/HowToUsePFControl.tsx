import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const SECTIONS = [
  { id: 'what-is-pfcontrol', label: 'What is PFControl?' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'creating-a-session', label: 'Creating a Session' },
  { id: 'flight-strips', label: 'Managing Flight Strips' },
  { id: 'submitting-a-flight-plan', label: 'Submitting a Flight Plan' },
  { id: 'acars-and-pdc', label: 'ACARS & Requesting PDC' },
  { id: 'charts', label: 'Charts & Airport Diagrams' },
  { id: 'network-overview', label: 'The Network Overview' },
  { id: 'public-profiles', label: 'Public Profiles' },
  { id: 'ratings-and-feedback', label: 'Ratings & Feedback' },
  { id: 'settings', label: 'Settings & Personalization' },
  { id: 'faq', label: 'FAQ' },
];

function GuideImage({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="my-8">
      {failed ? (
        <div className="aspect-video flex items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900 text-zinc-500 text-sm">
          <span>Screenshot: {caption}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full aspect-video object-cover rounded-xl border border-zinc-700"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="mt-2 text-xs text-zinc-500 text-center">{caption}</figcaption>
    </figure>
  );
}

function SidebarNav({
  className = '',
  activeSection,
}: {
  className?: string;
  activeSection: string;
}) {
  return (
    <nav aria-label="Guide sections" className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 px-2.5 mb-2">
        On this page
      </p>
      <ul className="space-y-0.5">
        {SECTIONS.map((s) => {
          const isActive = s.id === activeSection;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800/40 text-zinc-200'
                    : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Tracks which section's heading is nearest the top of the viewport, so the
 * sidebar can highlight it — the detection line sits near the top (not the
 * literal viewport top) so a section activates as soon as it's the one
 * actually being read, not only once fully scrolled past.
 */
function useActiveSection(): string {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

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

    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return activeSection;
}

export default function HowToUsePFControl() {
  const activeSection = useActiveSection();

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-32">
        <div className="mb-10 max-w-3xl">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-wide mb-2">
            Guide
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            How to Use PFControl
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
            PFControl is a free, real-time flight strip and ATC coordination platform built for
            Project Flight. This guide walks through
            everything a controller or pilot needs to know — from creating your first session to
            requesting a pre-departure clearance over ACARS.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
          <aside className="hidden lg:block sticky top-32 self-start max-h-[calc(100vh-4rem)] overflow-y-auto pb-10">
            <SidebarNav activeSection={activeSection} />
          </aside>

          <details className="lg:hidden mb-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
              On this page
            </summary>
            <SidebarNav className="mt-32" activeSection={activeSection} />
          </details>

          <article className="min-w-0 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-white [&_h2]:mt-12 [&_h2]:mb-4 [&_h2:first-of-type]:mt-0 [&_h2]:scroll-mt-8 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:scroll-mt-8 [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-zinc-300 [&_ul]:leading-relaxed [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:mb-1.5 [&_strong]:text-zinc-100 [&_strong]:font-semibold [&_code]:bg-zinc-800 [&_code]:text-blue-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.875em] [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-300">
            <section id="what-is-pfcontrol">
              <h2>What is PFControl?</h2>
              <p>
                PFControl is a browser-based air traffic control platform built specifically for
                Project Flight. Instead of coordinating departures and arrivals over voice
                chat with no record of what was cleared, controllers get a live, shared flight
                strip board that every controller in the session can see update in real
                time — clearances, runway assignments, squawk codes, route changes, and status
                all sync across everyone connected.
              </p>
              <p>
                The platform is built around two roles that often overlap:{' '}
                <strong>controllers</strong>, who create sessions and manage the flight strip
                board for an airport, and <strong>pilots</strong>, who submit flight plans into a
                session and receive clearances back through the ACARS terminal. Everything
                is free and does not require an account to submit a flight plan as a pilot,
                though signing in unlocks saved flight history, a profile, and access to
                ACARS.
              </p>
              <GuideImage
                src="/assets/guide/overview.webp"
                alt="The PFControl homepage showing the hero section, live leaderboard, and community statistics"
                caption="The PFControl homepage; session tools, live leaderboard, and community stats."
              />
            </section>

            <section id="getting-started">
              <h2>Getting Started</h2>
              <p>
                Open <a href="/">pfcontrol.com</a> and click <a href="/login">Sign In with Discord</a>{' '}
                in the top navigation bar. PFControl uses Discord OAuth for authentication that way there's no separate password to create or remember. Once you authorize the app,
                you're taken back to PFControl already signed in, with your Discord username attached to your account.
              </p>
              <p>
                You don't need an account to submit a flight plan as a pilot; a guest can submit to
                any session without signing in first. Signing in
                unlocks a few things that guests don't get: your submitted flights are saved to{' '}
                <a href="/my-flights">My Flights</a> so you can look back at past legs, you get a
                profile page other pilots and controllers can view, and you're able to open the
                ACARS terminal to receive pre-departure clearances and messages from controllers
                directly. If you submit a flight plan as a guest and later decide you want it
                saved, PFControl will offer to attach that flight to your account the moment you
                sign in.
              </p>
            </section>

            <section id="creating-a-session">
              <h2>Creating a Session</h2>
              <p>
                Controllers start from <a href="/create">Create Session</a> in the navigation bar. The
                form asks for an airport by ICAO code, a departure runway, and arrival runway. If you leave the arrival
                runway blank, it defaults to match the departure runway.
              </p>
              <p>
                Below the runway selection is a <strong>PFATC Network</strong> checkbox. Leaving
                it unchecked creates a <strong>Standard</strong> session (a private flight strip
                board just for you and anyone you share the session link with.) Checking it
                creates a <strong>PFATC</strong> session instead: every flight submitted becomes
                publicly visible on the <a href="/overview">Network Overview</a> page,
                departures from your session will be shared with other PFATC sessions, creating arrivals. PFATC sessions are the right choice for
                controllers who are controlling on the PFATC network.
              </p>
              <p>
                After creating a PFATC session, PFControl can prompt you with an auto-generated
                ATIS based on the airport and runway you selected, the atis is formatted for the PFATC ATIS channel and can be directly copied and pasted. Once the session is created, you land
                directly on the flight strip board for that airport, ready to receive flight
                plans.
              </p>
              <GuideImage
                src="/assets/guide/create-session.webp"
                alt="The Create Session form with an airport ICAO search field, runway selectors, and the PFATC Network checkbox"
                caption="Creating a new session — pick an airport, runways, and whether it's a PFATC session."
              />
              <p>
                Every session you create shows up under <a href="/sessions">My Sessions</a>, listed as a
                card with the airport, creation date, departure runway, current flight count, and
                a color-coded badge — green for Standard, blue for PFATC. From there you can
                rename a session, jump back into it, or delete it once you're done.
              </p>
            </section>

            <section id="flight-strips">
              <h2>Managing Flight Strips</h2>
              <p>
                Once you're in a session, the main view is the flight strip board — a live,
                editable table for departures and a separate one for arrivals, both updating for everyone. If another
                controller is editing the same field you're looking at, you'll see a small
                indicator showing who's currently working on it, so two controllers don't
                overwrite each other's changes.
              </p>
              <p>Both tables share a core set of columns:</p>
              <ul>
                <li>
                  <strong>Time</strong> — when the strip was created or last updated.
                </li>
                <li>
                  <strong>Callsign</strong> — the flight's callsign, shown with its parsed airline
                  where recognized.
                </li>
                <li>
                  <strong>Aircraft type</strong> and <strong>wake turbulence category</strong>.
                </li>
                <li>
                  <strong>Flight type</strong> — IFR or VFR.
                </li>
                <li>
                  <strong>Runway</strong> in use.
                </li>
                <li>
                  <strong>RFL / CFL</strong> — requested and cleared flight level.
                </li>
                <li>
                  <strong>Squawk</strong> — with a one-click button to generate a new random code.
                </li>
                <li>
                  <strong>Status</strong>, shown as a color-coded dropdown.
                </li>
                <li>
                  <strong>Remarks</strong>, plus per-row hide and delete actions.
                </li>
              </ul>
              <p>
                The <strong>departures</strong> table additionally tracks the stand, destination
                airport (ADES), SID, route, a clearance checkbox, and a PDC column for
                pre-departure clearance status. A departure's status flow runs{' '}
                <strong>PENDING &rarr; STUP &rarr; PUSH &rarr; TAXI &rarr; RWY &rarr; DEPA</strong>
                . The <strong>arrivals</strong> table instead tracks the origin airport (ADEP),
                gate, and STAR, with a status flow of{' '}
                <strong>APP &rarr; RWY &rarr; TAXI &rarr; GATE</strong>.
              </p>
              <GuideImage
                src="/assets/guide/flight-strips.webp"
                alt="The departures flight strip table showing callsign, aircraft, runway, squawk, and status columns for several active flights"
                caption="The departures table during an active session — every field updates live for all controllers."
              />
            </section>

            <section id="submitting-a-flight-plan">
              <h2>Submitting a Flight Plan</h2>
              <p>
                Pilots submit into a specific session using that session's submit link. The form
                asks for a callsign (must include a number), aircraft type from a searchable
                list, flight type (IFR or VFR), an optional stand, the arrival airport, a
                cruising flight level, and an optional route and remarks field. The departure
                airport is locked to whatever airport the session is for.
              </p>
              <p>
                If you leave the route blank, a <strong>Generate</strong> button will build one
                for you automatically — picking a SID, STAR, and cruising altitude that
                respects altitude rules.
              </p>
              <p>
                Submitting doesn't require an account. Once you submit, the flight appears on the
                controller's strip board with a <strong>PENDING</strong> status. If you're not
                signed in, PFControl will offer to create an account and attach the flight to it
                (if you want it to show up later in <a href="/my-flights">My Flights</a>.) For
                PFATC sessions, after submitting you'll see a prompt to open ACARS, where you can
                request your clearance directly. Opening ACARS does require being signed in,
                since clearances and messages are tied to your account.
              </p>
            </section>

            <section id="acars-and-pdc">
              <h2>ACARS &amp; Requesting PDC</h2>
              <p>
                ACARS is PFControl's messaging terminal. Once you've
                submitted a flight plan and signed in, you can open your flight's ACARS terminal
                to see a log of everything relevant to your flight: your
                submitted flight plan details, clearances, and any messages a controller sends
                you.
              </p>
              <p>
                The most common thing pilots use ACARS for is requesting a{' '}
                <strong>pre-departure clearance (PDC)</strong>. Press <strong>Request PDC</strong>{' '}
                and the request is sent to the controller working that airport, with a
                system message logged confirming it was sent. Once a controller issues your
                clearance, it appears in your ACARS log.
              </p>
              <GuideImage
                src="/assets/guide/acars-terminal.webp"
                alt="The ACARS terminal showing a flight plan submission message, a PDC request confirmation, and an issued clearance from the controller"
                caption="An ACARS terminal after requesting and receiving a pre-departure clearance."
              />
              <p>
                Controllers can also send a pilot a direct <strong>contact me</strong> message
                through ACARS — for example asking them to switch to a specific frequency — which
                shows up in the pilot's terminal the same way. The ACARS panel sits alongside
                notes and airport charts, so a pilot can reference their clearance, take notes,
                and pull up the relevant SID chart all from the same screen while taxiing out.
              </p>
            </section>

            <section id="charts">
              <h2>Charts &amp; Airport Diagrams</h2>
              <p>
                The Chart Drawer is a library of airport charts 
                available from the toolbar on any
                session's flight strip board or in the acars page. Opening it
                automatically groups charts by whichever airports are relevant to what you're
                working: the current session's departure and arrival airports first, followed by
                any airports tied to your assigned sector, with a full "all airports" list
                underneath for anything else.
              </p>
              <p>
                Charts can be searched by name, type, author, or procedure. If you prefer a simpler layout, there's a card-grid view
                available as an alternative to the default split sidebar-and-viewer layout,
                switchable from <a href="/settings">Settings</a>.
              </p>
            </section>

            <section id="network-overview">
              <h2>The Network Overview</h2>
              <p>
                <a href="/overview">Network Overview</a> is a live, network-wide dashboard of every open PFATC session at once, showing every active departure
                and arrival across the whole network.
              </p>
              <p>
                Controllers with the right sector permissions can edit flights
                directly from this view.
              </p>
            </section>

            <section id="public-profiles">
              <h2>Profiles</h2>
              <p>
                Every signed-in user gets a public profile page at{' '}
                <code>pfcontrol.com/user/&lt;username&gt;</code>, showing role badges, a bio,
                controlling and flying statistics, and up to a few featured flights they've
                chosen to highlight. Profile owners can customize their own page directly from
                the profile page.
              </p>
            </section>

            <section id="ratings-and-feedback">
              <h2>Ratings &amp; Feedback</h2>
              <p>
                After a session, pilots can leave a controller rating with a short comment, which
                contributes to that controller's average rating shown on their public profile.
                Ratings are meant as constructive feedback for controllers rather than a public
                callout tool — reports on inappropriate comments are reviewed by moderators, and
                automated checks flag reported or clearly inappropriate comments for review as
                well.
              </p>
            </section>

            <section id="settings">
              <h2>Settings &amp; Personalization</h2>
              <p>
                The Settings page covers account linking (Roblox and VATSIM), sound preferences
                for new strips, chat notifications, and ACARS alerts, layout options including
                combined departures/arrivals view and flight row opacity, background image
                selection for your session view, and which columns show up in your departure and
                arrival tables.
              </p>
            </section>

            <section id="faq">
              <h2>Frequently Asked Questions</h2>

              <h3>Do I need an account to use PFControl?</h3>
              <p>
                Not to submit a flight plan as a pilot — guests can submit flight plans to any open session. You do need an account to create sessions as a
                controller, open ACARS, or get a profile.
              </p>

              <h3>What's the difference between a Standard and a PFATC session?</h3>
              <p>
                A Standard session is private to you and anyone you share the link with and doesn't feature arrivals. A PFATC
                session publishes its traffic to the Network Overview so it's meant for organized,
                network-wide controlling rather than solo practice.
              </p>

              <h3>How do I get a pre-departure clearance?</h3>
              <p>
                Submit your flight plan, sign in if you haven't already, open ACARS from the
                prompt shown after submitting, and press Request PDC. The controller working that
                airport will see your request and can issue your clearance directly back into
                your ACARS terminal.
              </p>

              <h3>Is PFControl affiliated with Project Flight?</h3>
              <p>
                PFControl is an independent platform created by Cephie Studios and is not
                affiliated with Project Flight. It's built to work alongside Project Flight.
              </p>

              <h3>Is PFControl free?</h3>
              <p>
                Yes — creating sessions, submitting flight plans, and using ACARS are all free.
              </p>
            </section>

            <div className="mt-14 pt-8 border-t border-zinc-800 text-sm text-zinc-500">
              <p>
                Questions this guide didn't answer? Reach out at{' '}
                <a href="mailto:support@cephie.app">support@cephie.app</a> or join the{' '}
                <a href="https://cephie.app/discord" target="_blank" rel="noopener noreferrer">
                  Discord
                </a>
                .
              </p>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
