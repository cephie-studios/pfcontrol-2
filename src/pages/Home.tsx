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
import Joyride, { type CallBackProps, STATUS } from 'react-joyride';
import Modal from '../components/common/Modal';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import Footer from '../components/Footer';
import Button from '../components/common/Button';
import Navbar from '../components/Navbar';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

export default function Home({
  globalHolidayEnabled = false,
}: { globalHolidayEnabled?: boolean } = {}) {
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

  const statTitles: Record<string, string> = {
    total_sessions_created: 'Sessions Created',
    'total_flights_submitted.total': 'Flights Submitted',
    total_time_controlling_minutes: 'Time Controlling',
    'total_flight_edits.total_edit_actions': 'Flight Edits',
  };

  useEffect(() => {
    if (user && !user.settings?.tutorialCompleted && !startTutorial) {
      setShowTutorialPrompt(true);
    }
  }, [user, startTutorial]);

  const handleTutorialChoice = (start: boolean) => {
    setShowTutorialPrompt(false);
    if (start) {
      window.location.href = '/?tutorial=true';
    } else {
      updateTutorialStatus(true);
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
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
    if (globalHolidayEnabled && settings?.holidayTheme?.enabled) {
      return 'url("/assets/app/backgrounds/HolidayBackground.webp")';
    }

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
    globalHolidayEnabled,
    settings?.holidayTheme?.enabled,
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
      <Navbar />
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
          <div className="flex-1 max-w-xl text-center md:text-left">
            <h1 className="text-5xl sm:text-6xl md:text-[5rem] lg:text-[7rem] font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent leading-tight mb-4">
              PFControl
            </h1>
            <p className="text-base sm:text-xl text-white max-w-lg mx-auto md:mx-0 mb-8 sm:mb-10">
              The next-generation flight strip platform built for real-time
              coordination between air traffic controllers with enterprise-level
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
                See PFATC Flights
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-36 px-2 sm:px-6 bg-black">
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

      <section className="relative py-36 px-2 sm:px-6 bg-black">
        <div className="max-w-4xl mx-auto px-2 sm:px-6 relative z-10">
          <h2
            className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
            style={{ lineHeight: 1.4 }}
          >
            Join our community
          </h2>
          <div className="w-16 h-1 bg-blue-500 mx-auto mb-6 -mt-4"></div>
          <p className="text-xl text-center text-gray-300 max-w-3xl mx-auto">
            Join thousands of controllers and pilots using PFControl worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 cursor-default mt-20 max-w-7xl mx-auto px-2 sm:px-6">
          {/* Card 1 */}
          <div className="relative bg-zinc-900 border-2 border-blue-800 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-900 p-3 rounded-full shadow-lg border-2 border-blue-800">
              <TowerControl className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mt-6 mb-4 text-blue-200">
              Sessions Created
            </h3>
            <div className="text-4xl font-bold text-white mb-3">
              {stats.sessionsCreated.toLocaleString('de-DE')}
            </div>
            <p className="text-gray-400">Last 30 days</p>
          </div>
          {/* Card 2 */}
          <div className="relative bg-zinc-900 border-2 border-blue-800 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-900 p-3 rounded-full shadow-lg border-2 border-blue-800">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mt-6 mb-4 text-blue-200">
              Registered Users
            </h3>
            <div className="text-4xl font-bold text-white mb-3">
              {stats.registeredUsers.toLocaleString('de-DE')}
            </div>
            <p className="text-gray-400">All time</p>
          </div>
          {/* Card 3 */}
          <div className="relative bg-zinc-900 border-2 border-blue-800 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-900 p-3 rounded-full shadow-lg border-2 border-blue-800">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mt-6 mb-4 text-blue-200">
              Flights Logged
            </h3>
            <div className="text-4xl font-bold text-white mb-3">
              {stats.flightsLogged.toLocaleString('de-DE')}
            </div>
            <p className="text-gray-400">Last 30 days</p>
          </div>
        </div>
      </section>

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
                  <div className="flex flex-col md:flex-row justify-center gap-12">
                    {users.slice(0, 3).map((user, idx) => (
                      <div
                        key={user.userId}
                        className="flex flex-col items-center"
                      >
                        <div className="relative">
                          <img
                            src={getDiscordAvatar(user.userId, user.avatar)}
                            alt={user.username}
                            className="w-28 h-28 rounded-full border-2 border-blue-400 cursor-pointer hover:border-blue-300 transition-colors"
                            onClick={() =>
                              (window.location.href = `/user/${user.username}`)
                            }
                          />
                          {idx <= 2 && (
                            <Crown
                              className="absolute -top-2 right-0 w-10 h-10 transform rotate-12 shadow-2xl"
                              style={{
                                color:
                                  idx === 0
                                    ? '#fbbf24'
                                    : idx === 1
                                      ? '#c0c0c0'
                                      : '#ad6823',
                                filter:
                                  'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                              }}
                            />
                          )}
                        </div>
                        <span className="text-gray-300 mt-4 mb-1 text-lg font-medium">
                          {user.username}
                        </span>
                        <span className="text-blue-400 font-mono font-bold text-lg">
                          {key === 'total_time_controlling_minutes'
                            ? (() => {
                                const mins = Math.floor(user.score);
                                if (mins >= 60) {
                                  const h = Math.floor(mins / 60);
                                  const rem = mins % 60;
                                  return rem === 0
                                    ? `${h}h.`
                                    : `${h}h.${rem}min.`;
                                }
                                return `${mins} min.`;
                              })()
                            : user.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="text-white py-24 text-center px-2 sm:px-6 relative bg-black">
        <div className="max-w-4xl mx-auto px-2 sm:px-6 relative z-10">
          <h2
            className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
            style={{ lineHeight: 1.4 }}
          >
            Technologies & Frameworks
          </h2>
          <div className="w-16 h-1 bg-blue-500 mx-auto mb-6 -mt-4"></div>
          <p className="text-xl text-center text-gray-300 max-w-3xl mx-auto">
            What technologies we use to develop PFControl.
          </p>
        </div>

        <div className="mt-20 max-w-7xl mx-auto px-2 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 space-y-12 font-medium">
            <div className="flex flex-col items-center">
              <img
                src="/assets/app/icons/tailwind.svg"
                alt="Tailwind CSS"
                className="h-24 w-24 mb-2"
              />
              <span className="text-gray-300 text-sm">Tailwind CSS</span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/assets/app/icons/react.svg"
                alt="React"
                className="h-24 w-24 mb-2"
              />
              <span className="text-gray-300 text-sm">React</span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/assets/app/icons/nodejs.svg"
                alt="Node.js"
                className="h-24 w-24 mb-2"
              />
              <span className="text-gray-300 text-sm">Node.js</span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/assets/app/icons/redis.svg"
                alt="Redis"
                className="h-24 w-24 mb-2"
              />
              <span className="text-gray-300 text-sm">Redis</span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/assets/app/icons/postgresql.svg"
                alt="PostgreSQL"
                className="h-24 w-24 mb-2"
              />
              <span className="text-gray-300 text-sm">PostgreSQL</span>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/assets/app/icons/git.svg"
                alt="Git"
                className="h-24 w-24 mb-2"
              />
              <span className="text-gray-300 text-sm">Git</span>
            </div>
          </div>
        </div>
      </section>

      <section className="text-white py-24 -mb-24 text-center px-2 sm:px-6 relative bg-black">
        <div className="max-w-4xl mx-auto px-2 sm:px-6 relative z-10">
          <h2
            className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
            style={{ lineHeight: 1.4 }}
          >
            Why Choose PFControl?
          </h2>
          <div className="w-16 h-1 bg-blue-500 mx-auto mb-6 -mt-4"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 cursor-default mt-20 max-w-7xl mx-auto px-2 sm:px-6">
          {/* Card 1 */}
          <div className="relative bg-zinc-900 border-2 border-blue-800 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-900 p-3 rounded-full shadow-lg border-2 border-blue-800">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mt-6 mb-4 text-blue-200">
              Secure & Reliable
            </h3>
            <p className="text-gray-400">
              Your sessions and data are protected with end-to-end encryption
              and regular backups.
            </p>
          </div>
          {/* Card 2 */}
          <div className="relative bg-zinc-900 border-2 border-blue-800 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-900 p-3 rounded-full shadow-lg border-2 border-blue-800">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mt-6 mb-4 text-blue-200">
              Real Time Updates
            </h3>
            <p className="text-gray-400">
              Instantly see changes and updates as they happen, keeping your
              controlling in sync at all times.
            </p>
          </div>
          {/* Card 3 */}
          <div className="relative bg-zinc-900 border-2 border-blue-800 rounded-2xl p-10 text-center shadow-xl transition-transform hover:-translate-y-2 hover:shadow-2xl hover:border-blue-400">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-900 p-3 rounded-full shadow-lg border-2 border-blue-800">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mt-6 mb-4 text-blue-200">
              Collaborative
            </h3>
            <p className="text-gray-400">
              Chat and collaborate with your controllers in our secure chats and
              voice channels across any device.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section - PFControl v2 */}
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
          <div className="flex-1 text-left">
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

      <Footer />
    </div>
  );
}
