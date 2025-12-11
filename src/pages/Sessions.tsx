import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  Workflow,
  Calendar,
  Plane,
  AlertTriangle,
  Pencil,
  Trash2,
  Info,
  X,
  PlaneTakeoff,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../hooks/auth/useAuth';
import { useSettings } from '../hooks/settings/useSettings';
import {
  fetchMySessions,
  updateSessionName,
  deleteSession,
} from '../utils/fetch/sessions';
import type { SessionInfo } from '../types/session';
import { fetchFlights } from '../utils/fetch/flights';
import { fetchBackgrounds } from '../utils/fetch/data';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import TextInput from '../components/common/TextInput';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

export default function Sessions() {
  const { user, isLoading } = useAuth();
  const { settings } = useSettings();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);

  const maxSessions = user?.isAdmin || user?.isTester ? 50 : 10;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchMySessions()
      .then(async (data) => {
        const sessionsWithCounts = await Promise.all(
          data.map(async (session) => {
            try {
              const flights = await fetchFlights(session.sessionId);
              return { ...session, flightCount: flights.length };
            } catch {
              return { ...session, flightCount: 0 };
            }
          })
        );
        setSessions(sessionsWithCounts);
      })
      .catch(() => setError('Failed to load sessions.'))
      .finally(() => setLoading(false));
  }, [user]);

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

  const startEditingName = (sessionId: string, currentName: string) => {
    setEditingName(sessionId);
    setEditNameValue(currentName || '');
  };

  const saveSessionName = async (sessionId: string) => {
    if (!editNameValue.trim()) {
      setEditingName(null);
      setEditNameValue('');
      return;
    }
    setSavingName(sessionId);
    try {
      const { customName } = await updateSessionName(
        sessionId,
        editNameValue.trim()
      );
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, customName } : s))
      );
      setEditingName(null);
      setEditNameValue('');
    } catch {
      setError('Failed to update session name.');
    } finally {
      setSavingName(null);
    }
  };

  const confirmDelete = (sessionId: string) => {
    setSessionToDelete(sessionId);
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeleteInProgress(sessionToDelete);
    try {
      await deleteSession(sessionToDelete);
      setSessions((prev) =>
        prev.filter((s) => s.sessionId !== sessionToDelete)
      );
      setSessionToDelete(null);
    } catch {
      setError('Failed to delete session.');
    } finally {
      setDeleteInProgress(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Navbar />
        <Loader />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Navbar />
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Not logged in</h2>
          <p className="text-gray-400 mb-6">
            Please log in to view your sessions.
          </p>
          <Link
            to="/"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-all"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      <Navbar />

      <div className="relative w-full h-80 md:h-96 overflow-hidden">
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
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: customLoaded ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950"></div>
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center mb-6">
            MY SESSIONS
          </h1>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-4">
            <div className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full shadow-lg h-12 sm:h-auto">
              <FolderOpen className="h-5 w-5 text-blue-400" />
              <span className="text-blue-400 text-sm font-semibold tracking-wider whitespace-nowrap">
                {sessions.length}/{maxSessions} SESSION
                {sessions.length === 1 ? '' : 'S'}
              </span>
            </div>

            <Button
              onClick={() => (window.location.href = '/create')}
              size="md"
              disabled={sessions.length >= maxSessions}
              className={`
                whitespace-nowrap w-full sm:w-auto
                ${sessions.length >= maxSessions ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              Create New Session
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
        <div className="bg-gray-900/70 backdrop-blur-md rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-900/40 border border-red-700 rounded-full flex items-center text-sm">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-400" />
                {error}
              </div>
            )}

            {sessions.length >= maxSessions && (
              <div className="p-4 bg-yellow-900/20 border-2 border-red-600/30 rounded-xl">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-400 font-medium">
                    Session limit reached
                  </span>
                </div>
                <p className="text-red-200 mt-1">
                  You have reached the maximum of {maxSessions} sessions.{' '}
                  <span className="italic">
                    Delete an old session to create a new one.
                  </span>
                </p>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-block p-4 bg-blue-600/20 rounded-full mb-4">
                  <Workflow className="h-12 w-12 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No sessions yet</h2>
                <p className="text-gray-400 mb-6">
                  You haven't created any sessions yet.
                </p>
                <Link
                  to="/create"
                  className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-all"
                >
                  Create Your First Session
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="bg-gray-800/50 border-2 border-gray-700 hover:border-blue-600/50 rounded-3xl p-5 transition-all hover:bg-gray-800/70 block relative"
                  >
                    <Link
                      to={`/view/${session.sessionId}/?accessId=${session.accessId}`}
                      className="block"
                    >
                      <div className="flex items-center mb-3">
                        <FolderOpen className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="font-medium truncate text-md">
                          {session.customName
                            ? session.customName
                            : `${session.airportIcao || 'Unknown'} Session`}
                        </span>
                        {session.isLegacy && (
                          <Info className="h-4 w-4 text-yellow-400 ml-2" />
                        )}
                      </div>
                      <div className="space-y-2 text-sm text-gray-300">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                          {session.createdAt
                            ? new Date(session.createdAt).toLocaleString()
                            : 'Date unavailable'}
                        </div>
                        {session.activeRunway && (
                          <div className="flex items-center">
                            <PlaneTakeoff className="h-4 w-4 mr-2 text-gray-500" />
                            Departure Runway: {session.activeRunway}
                          </div>
                        )}
                        <div className="flex items-center">
                          {session.isPFATC ? (
                            <>
                              <Workflow className="h-4 w-4 mr-2 text-blue-400" />
                              <span className="text-blue-400 font-medium">
                                PFATC Session
                              </span>
                            </>
                          ) : (
                            <>
                              <Workflow className="h-4 w-4 mr-2 text-green-400" />
                              <span className="text-green-400 font-medium">
                                Standard Session
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center">
                          <Plane className="h-4 w-4 mr-2 text-gray-500" />
                          Flights: {session.flightCount}
                        </div>
                      </div>
                    </Link>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startEditingName(
                            session.sessionId,
                            session.customName || ''
                          )
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => confirmDelete(session.sessionId)}
                        disabled={deleteInProgress === session.sessionId}
                      >
                        <Trash2 className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border-2 border-red-600 rounded-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-900/30 rounded-full mr-3">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <h3 className="text-xl font-semibold">Delete Session</h3>
              </div>
              <button
                onClick={() => setSessionToDelete(null)}
                className="p-1 rounded-full hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-6">
              {sessions.find((s) => s.sessionId === sessionToDelete)
                ?.isLegacy && (
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                    <span className="text-yellow-400 font-medium">
                      Legacy Session
                    </span>
                  </div>
                  <p className="text-sm text-yellow-200">
                    This session uses old encryption. Deleting it is recommended
                    for security.
                  </p>
                </div>
              )}
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete this session? This action cannot
                be undone.
              </p>
              <p className="text-sm text-gray-400">
                Session:{' '}
                <span className="font-medium">
                  {sessions.find((s) => s.sessionId === sessionToDelete)
                    ?.customName ||
                    `${
                      sessions.find((s) => s.sessionId === sessionToDelete)
                        ?.airportIcao || 'Unknown'
                    } Session`}
                </span>
              </p>
              <p className="text-sm text-gray-500 font-mono">
                ID: {sessionToDelete}
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteSession}
                disabled={!!deleteInProgress}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 border border-red-700 rounded transition-colors flex items-center"
              >
                {deleteInProgress ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Session'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingName && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border-2 border-blue-800 rounded-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-900/30 rounded-full mr-3">
                  <Pencil className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold">Edit Session Name</h3>
              </div>
              <button
                onClick={() => setEditingName(null)}
                className="p-1 rounded-full hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                Change the name for this session. This helps you identify it
                more easily.
              </p>
              <TextInput
                value={editNameValue}
                onChange={setEditNameValue}
                maxLength={50}
                disabled={savingName === editingName}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveSessionName(editingName);
                  if (e.key === 'Escape') setEditingName(null);
                }}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setEditingName(null)}
                className="px-4 py-2 rounded transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveSessionName(editingName)}
                disabled={savingName === editingName || !editNameValue.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center"
              >
                {savingName === editingName ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white"></div>
                    Saving...
                  </>
                ) : (
                  'Save Name'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
