import {
  ArrowRight,
  Plane,
  Shield,
  TowerControl,
  Users,
  Crown,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import {
  fetchStatistics,
  fetchLeaderboard,
  fetchBackgrounds,
} from '../utils/fetch/data';
import { useSearchParams } from 'react-router-dom';
import { updateTutorialStatus } from '../utils/fetch/auth';
import { useAuth } from '../hooks/auth/useAuth';
import { useSettings } from '../hooks/settings/useSettings';
import { steps } from '../components/tutorial/TutorialStepsHome';
import Joyride, {
  type CallBackProps,
  STATUS,
} from 'react-joyride-react19-compat';
import { trackTutorialEvent } from '../utils/tutorialTracking';
import { posthog } from '../utils/posthog';
import Modal from '../components/common/Modal';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import Footer from '../components/Footer';
import Button from '../components/common/Button';
import Navbar from '../components/Navbar';
import ProductShowcase from '../components/home/ProductShowcase';
import { useCountUp } from '../hooks/useCountUp';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface HomeProps {
  standalone?: boolean;
}

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

export default function Home({ standalone = true }: HomeProps) {
  const [stats, setStats] = useState({
    sessionsCreated: 0,
    registeredUsers: 0,
    flightsLogged: 0,
  });
  const [leaderboard, setLeaderboard] = useState<
    Record<
      string,
      Array<{
        userId: string;
        username: string;
        score: number;
        avatar: string | null;
      }>
    >
  >({});
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);

  const [searchParams] = useSearchParams();
  const startTutorial = searchParams.get('tutorial') === 'true';
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();

  const [sessionsCount, sessionsRef] = useCountUp(stats.sessionsCreated);
  const [usersCount, usersRef] = useCountUp(stats.registeredUsers);
  const [flightsCount, flightsRef] = useCountUp(stats.flightsLogged);

  const statTitles: Record<string, string> = {
    total_sessions_created: 'Sessions Created',
    'total_flights_submitted.total': 'Flights Submitted',
    total_time_controlling_minutes: 'Time Controlling',
    'total_flight_edits.total_edit_actions': 'Flight Edits',
  };

  useEffect(() => {
    if (user && !user.settings?.tutorialCompleted && !startTutorial) {
      setShowTutorialPrompt(true);
      posthog.capture('tutorial_prompt_shown');
    }
  }, [user, startTutorial]);

  const handleTutorialChoice = (start: boolean) => {
    setShowTutorialPrompt(false);
    if (start) {
      posthog.capture('tutorial_prompt_accepted');
      window.location.href = '/?tutorial=true';
    } else {
      posthog.capture('tutorial_prompt_declined');
      updateTutorialStatus(true);
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    trackTutorialEvent('home', data);
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      updateTutorialStatus(true);
    }
  };

  useEffect(() => {
    fetchStatistics().then((data) => {
      if (Array.isArray(data)) {
        setStats({
          sessionsCreated: Number(data[0]) || 0,
          registeredUsers: Number(data[1]) || 0,
          flightsLogged: Number(data[2]) || 0,
        });
      } else {
        setStats(data);
      }
    });

    fetchLeaderboard().then(setLeaderboard).catch(console.error);
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (error) {
        console.error('Error loading available images:', error);
      }
    };
    loadImages();
  }, []);

  const backgroundImage = useMemo(() => {
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';

    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') {
        return filename;
      }
      if (filename.startsWith('https://api.cephie.app/')) {
        return filename;
      }
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };

    if (selectedImage === 'random') {
      if (availableImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        bgImage = `url(${API_BASE_URL}${availableImages[randomIndex].path})`;
      }
    } else if (selectedImage === 'favorites') {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length > 0) {
        const randomFav =
          favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (
          favImageUrl &&
          favImageUrl !== 'random' &&
          favImageUrl !== 'favorites'
        ) {
          bgImage = `url(${favImageUrl})`;
        }
      }
    } else if (selectedImage) {
      const imageUrl = getImageUrl(selectedImage);
      if (imageUrl && imageUrl !== 'random' && imageUrl !== 'favorites') {
        bgImage = `url(${imageUrl})`;
      }
    }

    return bgImage;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
  ]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")') {
      setCustomLoaded(true);
    }
  }, [backgroundImage]);

  const getDiscordAvatar = (userId: string, avatarHash: string | null) => {
    if (!avatarHash) {
      return '/assets/app/default/avatar.webp';
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`;
  };

  return (
    <div>
      {standalone && <Navbar />}
      {/* Hero Section */}
      <section className="relative bg-[url('/assets/images/hero.webp')] bg-cover bg-center text-white min-h-[90vh] flex items-center px-4">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: customLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[5px]"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-7xl mx-auto mt-16 md:mt-24 gap-10 md:gap-0 relative z-10">
          <div className="flex-1 max-w-xl text-center md:text-left md:ml-12">
            <h1 className="text-5xl sm:text-6xl md:text-[5rem] lg:text-[7rem] font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent leading-tight mb-4">
              PFControl
            </h1>
            <p className="text-base sm:text-xl text-white max-w-lg mx-auto md:mx-0 mb-8 sm:mb-10">
              The next-generation flight strip platform built for real-time
              coordination between air traffic controllers with outstanding
              reliability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Button
                onClick={() =>
                  (window.location.href = startTutorial
                    ? '/create?tutorial=true'
                    : '/create')
                }
                variant="outline"
                className="flex items-center justify-center px-8 py-4 text-base sm:text-lg font-semibold transition-all w-full sm:w-auto"
                id="start-session-btn"
              >
                Start Session Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => (window.location.href = '/pfatc')}
                variant="ghost"
                className="flex items-center justify-center px-8 py-4 text-base sm:text-lg font-semibold transition-all w-full sm:w-auto"
                id="pfatc-flights-btn"
              >
                <TowerControl className="mr-2 h-5 w-5" />
                See Network Flights
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: simple 3-step layout */}
      <section className="block min-[1338px]:hidden relative py-36 px-2 sm:px-6 bg-black">
        <div className="max-w-5xl mx-auto px-2 sm:px-6 relative z-10">
          <h2
            className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
            style={{ lineHeight: 1.4 }}
          >
            How it works
          </h2>
          <div className="w-16 h-1 bg-blue-500 mx-auto mb-6 -mt-4"></div>
          <p className="text-xl text-center text-gray-300 max-w-3xl mx-auto">
            Get started with PFControl in three simple steps.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mt-20">
            <div className="flex flex-col items-center flex-1">
              <div className="bg-blue-800 rounded-full p-6 mb-3">
                <TowerControl className="h-12 w-12 text-white" />
              </div>
              <span className="text-white font-semibold mb-2 text-xl">
                Create Session
              </span>
              <p className="text-gray-400 text-md text-center max-w-[220px]">
                Start a new session and get your control session ready.
              </p>
            </div>
            <div className="hidden md:block h-1 w-12 bg-zinc-700 rounded-full"></div>
            <div className="flex flex-col items-center flex-1">
              <div className="bg-blue-800 rounded-full p-6 mb-3">
                <Users className="h-12 w-12 text-white" />
              </div>
              <span className="text-white font-semibold mb-2 text-xl">
                Share Link
              </span>
              <p className="text-gray-400 text-md text-center max-w-[220px]">
                Send the link to pilots to receive flight plans.
              </p>
            </div>
            <div className="hidden md:block h-1 w-12 bg-zinc-700 rounded-full"></div>
            <div className="flex flex-col items-center flex-1">
              <div className="bg-blue-800 rounded-full p-6 mb-3">
                <Plane className="h-12 w-12 text-white" />
              </div>
              <span className="text-white font-semibold mb-2 text-xl">
                Manage Strips
              </span>
              <p className="text-gray-400 text-md text-center max-w-[220px]">
                Update status and track departures in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop: interactive scroll showcase */}
      <ProductShowcase />

      <section className="relative py-36 px-2 sm:px-6 bg-black">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 relative z-10">
          <h2 className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center">
            Leaderboard
          </h2>
          <div className="w-16 h-1 bg-blue-500 mx-auto mb-6 mt-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-28 pt-24">
            {' '}
            {Object.entries(leaderboard)
              .filter(([key]) => !/chat|message/i.test(key))
              .map(([key, users]) => (
                <div key={key} className="text-center">
                  <h3
                    className="text-3xl font-medium bg-gradient-to-r from-blue-200 to-blue-700 bg-clip-text text-transparent mb-12 capitalize"
                    style={{ lineHeight: 1.4 }}
                  >
                    {statTitles[key] ||
                      key
                        .replace(/total_|_/g, ' ')
                        .replace('submitted total', 'Flights Submitted')
                        .trim()}
                  </h3>
                  {/* Podium — order: 2nd | 1st | 3rd */}
                  <div className="flex items-end justify-center gap-4">
                    {[1, 0, 2].map((rank) => {
                      const u = users[rank];
                      if (!u) return null;
                      const podiumHeights = [80, 52, 36]; // 1st, 2nd, 3rd bar heights (px)
                      const podiumColors = ['#fbbf24', '#c0c0c0', '#ad6823'];
                      const avatarSizes = [
                        'w-24 h-24',
                        'w-20 h-20',
                        'w-16 h-16',
                      ];
                      const barHeight = podiumHeights[rank];
                      const barColor = podiumColors[rank];
                      return (
                        <div
                          key={u.userId}
                          className="flex flex-col items-center"
                        >
                          <div className="relative mb-3">
                            <img
                              src={getDiscordAvatar(u.userId, u.avatar)}
                              alt={u.username}
                              className={`${avatarSizes[rank]} rounded-full border-2 cursor-pointer hover:opacity-90 transition-opacity`}
                              style={{ borderColor: barColor }}
                              onClick={() =>
                                (window.location.href = `/user/${u.username}`)
                              }
                            />
                            <Crown
                              className="absolute -top-2 -right-1 w-6 h-6 rotate-12"
                              style={{
                                color: barColor,
                                filter:
                                  'drop-shadow(0 1px 3px rgba(0,0,0,0.6))',
                              }}
                            />
                          </div>
                          <span className="text-gray-300 text-sm font-medium mb-1 max-w-[90px] truncate text-center">
                            {u.username}
                          </span>
                          <span
                            className="font-mono font-bold text-sm mb-2"
                            style={{ color: barColor }}
                          >
                            {key === 'total_time_controlling_minutes'
                              ? (() => {
                                  const mins = Math.floor(u.score);
                                  if (mins >= 60) {
                                    const h = Math.floor(mins / 60);
                                    const rem = mins % 60;
                                    return rem === 0
                                      ? `${h}h`
                                      : `${h}h ${rem}m`;
                                  }
                                  return `${mins}m`;
                                })()
                              : u.score}
                          </span>
                          {/* Podium bar */}
                          <div
                            className="w-24 rounded-t-lg flex items-center justify-center"
                            style={{
                              height: barHeight,
                              background: `${barColor}22`,
                              borderTop: `2px solid ${barColor}55`,
                            }}
                          >
                            <span
                              className="text-2xl font-black"
                              style={{ color: `${barColor}99` }}
                            >
                              {rank + 1}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="relative py-36 px-2 sm:px-6 bg-black">
        <div className="max-w-4xl mx-auto px-2 sm:px-6 text-center mb-24">
          <h2
            className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6"
            style={{ lineHeight: 1.4 }}
          >
            Join the community
          </h2>
          <div className="w-16 h-1 bg-blue-500 mx-auto -mt-4"></div>
        </div>

        <div className="max-w-5xl mx-auto px-2 sm:px-6 flex flex-col md:flex-row items-stretch divide-y md:divide-y-0 md:divide-x divide-zinc-800 cursor-default">
          <div
            ref={sessionsRef}
            className="flex-1 flex flex-col items-center justify-center py-10 md:py-0 gap-2"
          >
            <span className="text-5xl sm:text-6xl font-black text-white tabular-nums tracking-tight">
              {sessionsCount.toLocaleString()}
            </span>
            <span className="text-base text-zinc-400 uppercase tracking-widest font-medium">
              Sessions Created
            </span>
            <span className="text-xs text-zinc-600 uppercase tracking-wider">
              Last 30 days
            </span>
          </div>
          <div
            ref={usersRef}
            className="flex-1 flex flex-col items-center justify-center py-10 md:py-0 gap-2"
          >
            <span className="text-5xl sm:text-6xl font-black text-white tabular-nums tracking-tight">
              {usersCount.toLocaleString()}
            </span>
            <span className="text-base text-zinc-400 uppercase tracking-widest font-medium">
              Registered Users
            </span>
            <span className="text-xs text-zinc-600 uppercase tracking-wider">
              All time
            </span>
          </div>
          <div
            ref={flightsRef}
            className="flex-1 flex flex-col items-center justify-center py-10 md:py-0 gap-2"
          >
            <span className="text-5xl sm:text-6xl font-black text-white tabular-nums tracking-tight">
              {flightsCount.toLocaleString()}
            </span>
            <span className="text-base text-zinc-400 uppercase tracking-widest font-medium">
              Flights Logged
            </span>
            <span className="text-xs text-zinc-600 uppercase tracking-wider">
              Last 30 days
            </span>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative bg-[url('/assets/images/hero.webp')] bg-cover bg-center text-white min-h-[90vh] flex items-center px-4 sm:px-6">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: customLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[5px]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black to-transparent"></div>
        <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-7xl mx-auto mt-16 md:mt-24 gap-10 md:gap-0 relative z-10">
          <div className="flex-1 text-left md:ml-12">
            <h2 className="text-5xl sm:text-6xl md:text-[5rem] lg:text-[7rem] font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent leading-tight mb-4">
              PFControl
            </h2>
            <p className="text-base sm:text-xl text-gray-300 max-w-2xl">
              The next-generation flight strip platform built for real-time
              coordination between air traffic controllers.
            </p>
            <ul className="space-y-4 text-gray-300 mt-6 text-left max-w-lg text-lg">
              <li className="flex items-start">
                <ArrowRight className="mr-3 h-5 w-5 text-blue-400 flex-shrink-0 mt-1" />
                <span>
                  Enhanced real-time collaboration between controllers
                </span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="mr-3 h-5 w-5 text-blue-400 flex-shrink-0 mt-1" />
                <span>Redesigned interface for improved usability</span>
              </li>
              <li className="flex items-start">
                <ArrowRight className="mr-3 h-5 w-5 text-blue-400 flex-shrink-0 mt-1" />
                <span>Advanced flight strip management system</span>
              </li>
            </ul>
            <div className="pt-8">
              <Button
                onClick={() => {
                  window.location.href = startTutorial
                    ? '/create?tutorial=true'
                    : '/create';
                }}
                variant="outline"
                className="px-8 py-4 text-base sm:text-lg font-semibold"
              >
                Try the Latest Version Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Joyride
        steps={steps}
        run={startTutorial}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        disableScrolling={true}
        tooltipComponent={CustomTooltip}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            textColor: '#ffffff',
            backgroundColor: '#1f2937',
            zIndex: 1000,
          },
          spotlight: {
            border: '2px solid #fbbf24',
            borderRadius: '24px',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
          },
        }}
      />

      {showTutorialPrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <Modal
            isOpen={showTutorialPrompt}
            onClose={() => handleTutorialChoice(false)}
            title="Welcome to PFControl!"
            variant="primary"
            footer={
              <div className="flex justify-start space-x-3">
                <Button size="sm" onClick={() => handleTutorialChoice(true)}>
                  Yes, start tutorial
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTutorialChoice(false)}
                >
                  Skip
                </Button>
              </div>
            }
          >
            <p className="text-gray-300">
              Would you like a quick tutorial to get started?
            </p>
          </Modal>
        </div>
      )}

      {standalone && <Footer />}
    </div>
  );
}
