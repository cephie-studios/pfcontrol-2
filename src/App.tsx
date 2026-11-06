import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router';
import { lazy, Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './hooks/auth/useAuth';

import Home from './pages/Home';
import Login from './pages/Login';
import VatsimCallback from './pages/VatsimCallback';
import NotFound from './pages/NotFound';

import ProtectedRoute from './components/ProtectedRoute';
import AccessDenied from './components/AccessDenied';
import Navbar from './components/Navbar';
import AppOverlays from './components/AppOverlays';
import PostHogPageView from './components/PostHogPageView';

const loadCreate = () => import('./pages/Create');
const loadSessions = () => import('./pages/Sessions');
const loadSubmit = () => import('./pages/Submit');
const loadFlights = () => import('./pages/Flights');
const loadMyFlights = () => import('./pages/MyFlights');
const loadMyFlightDetail = () => import('./pages/MyFlightDetail');
const loadSettings = () => import('./pages/Settings');
const loadPFATCFlights = () => import('./pages/PFATCFlights');
const loadAcarsRoute = () => import('./pages/AcarsRoute');
const loadPilotProfile = () => import('./pages/PilotProfile');
const loadCharts = () => import('./pages/Charts');
const loadPricing = () => import('./pages/Pricing');

const PRELOADED_PAGES = [
  loadSessions,
  loadMyFlights,
  loadSubmit,
  loadAcarsRoute,
  loadPFATCFlights,
  loadCreate,
  loadFlights,
  loadMyFlightDetail,
  loadSettings,
  loadPilotProfile,
  loadCharts,
  loadPricing,
];

const Create = lazy(loadCreate);
const Sessions = lazy(loadSessions);
const Submit = lazy(loadSubmit);
const Flights = lazy(loadFlights);
const MyFlights = lazy(loadMyFlights);
const MyFeedback = lazy(() => import('./pages/MyFeedback'));
const MyFlightDetail = lazy(loadMyFlightDetail);
const Settings = lazy(loadSettings);
const PFATCFlights = lazy(loadPFATCFlights);
const AcarsRoute = lazy(loadAcarsRoute);
const PilotProfile = lazy(loadPilotProfile);
const PublicFlightView = lazy(() => import('./pages/PublicFlightView'));
const ChartfoxLinked = lazy(() => import('./pages/ChartfoxLinked'));
const Charts = lazy(loadCharts);
const Pricing = lazy(loadPricing);
const Gift = lazy(() => import('./pages/Gift'));

function usePreloadPages() {
  useEffect(() => {
    let cancelled = false;
    let handle: number | undefined;
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(cb, { timeout: 3000 })
        : window.setTimeout(cb, 1500);
    const next = (index: number) => {
      if (cancelled || index >= PRELOADED_PAGES.length) return;
      handle = idle(() => {
        PRELOADED_PAGES[index]()
          .catch(() => undefined)
          .finally(() => next(index + 1));
      });
    };
    next(0);
    return () => {
      cancelled = true;
      if (handle === undefined) return;
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, []);
}

function RouteFallback() {
  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="flex justify-center pt-40">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    </div>
  );
}

const HowToUsePFControl = lazy(() => import('./pages/HowToUsePFControl'));
const Glossary = lazy(() => import('./pages/Glossary'));
const DeveloperDocsPage = lazy(() => import('./pages/DeveloperDocsPage'));

const Admin = lazy(() => import('./pages/Admin'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'));
const AdminBan = lazy(() => import('./pages/admin/AdminBan'));
const AdminSessions = lazy(() => import('./pages/admin/AdminSessions'));
const AdminTesters = lazy(() => import('./pages/admin/AdminTesters'));
const AdminNotifications = lazy(
  () => import('./pages/admin/AdminNotifications')
);
const AdminRoles = lazy(() => import('./pages/admin/AdminRoles'));
const AdminChatReports = lazy(() => import('./pages/admin/AdminChatReports'));
const AdminFlightLogs = lazy(() => import('./pages/admin/AdminFlightLogs'));
const AdminFeaturedFlights = lazy(
  () => import('./pages/admin/AdminFeaturedFlights')
);
const AdminProfileContent = lazy(
  () => import('./pages/admin/AdminProfileContent')
);
const AdminUserAlerts = lazy(() => import('./pages/admin/AdminUserAlerts'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminSurveys = lazy(() => import('./pages/admin/AdminSurveys'));
const AdminApiLogs = lazy(() => import('./pages/admin/AdminApiLogs'));
const AdminRatings = lazy(() => import('./pages/admin/AdminRatings'));
const AdminAltDetection = lazy(() => import('./pages/admin/AdminAltDetection'));
const AdminDevelopers = lazy(() => import('./pages/admin/AdminDevelopers'));
const AdminWebsockets = lazy(() => import('./pages/admin/AdminWebsockets'));
const AdminDatabase = lazy(() => import('./pages/admin/AdminDatabase'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));
const AdminChartForensics = lazy(
  () => import('./pages/admin/AdminChartForensics')
);
const AdminExternalAcars = lazy(
  () => import('./pages/admin/AdminExternalAcars')
);
const DeveloperLayout = lazy(
  () => import('./pages/developers/DeveloperLayout')
);
const DeveloperOverview = lazy(() => import('./pages/developers/Overview'));
const DeveloperConsole = lazy(() => import('./pages/developers/Console'));
const DeveloperKeys = lazy(() => import('./pages/developers/Keys'));

export default function App() {
  const { user } = useAuth();
  usePreloadPages();

  return (
    <Router>
      <PostHogPageView />
      <AppOverlays />

      {user && user.isBanned ? (
        <AccessDenied errorType="banned" />
      ) : user && user.isVpnBlocked ? (
        <AccessDenied errorType="vpn-blocked" />
      ) : (
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/pfatc"
              element={<Navigate to="/overview" replace />}
            />
            <Route path="/overview" element={<PFATCFlights />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/vatsim/callback" element={<VatsimCallback />} />
            <Route
              path="/charts/chartfox/linked"
              element={<ChartfoxLinked />}
            />
            <Route path="/submit/:sessionId" element={<Submit />} />
            <Route path="acars/:sessionId/:flightId" element={<AcarsRoute />} />
            <Route path="flight/:flightId" element={<PublicFlightView />} />
            <Route path="/user/:username" element={<PilotProfile />} />
            <Route path="/howtousepfcontrol" element={<HowToUsePFControl />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/gift/:username" element={<Gift />} />
            <Route path="/developers/docs" element={<DeveloperDocsPage />} />

            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <Create />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <ProtectedRoute>
                  <Sessions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/view/:sessionId"
              element={
                <ProtectedRoute>
                  <Flights />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/developers"
              element={
                <ProtectedRoute requireTester={false}>
                  <DeveloperLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DeveloperOverview />} />
              <Route path="console" element={<DeveloperConsole />} />
              <Route path="keys" element={<DeveloperKeys />} />
            </Route>
            <Route
              path="/my-flights"
              element={
                <ProtectedRoute>
                  <MyFlights />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-feedback"
              element={
                <ProtectedRoute>
                  <MyFeedback />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-flights/:id"
              element={
                <ProtectedRoute>
                  <MyFlightDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requireTester={false} requirePermission="admin">
                  <Routes>
                    <Route
                      index
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <Admin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="users"
                      element={
                        <ProtectedRoute requirePermission="users">
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="audit"
                      element={
                        <ProtectedRoute requirePermission="audit">
                          <AdminAudit />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="bans"
                      element={
                        <ProtectedRoute requirePermission="bans">
                          <AdminBan />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="sessions"
                      element={
                        <ProtectedRoute requirePermission="sessions">
                          <AdminSessions />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="testers"
                      element={
                        <ProtectedRoute requirePermission="testers">
                          <AdminTesters />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="notifications"
                      element={
                        <ProtectedRoute requirePermission="notifications">
                          <AdminNotifications />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="roles"
                      element={
                        <ProtectedRoute requirePermission="roles">
                          <AdminRoles />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="chat-reports"
                      element={
                        <ProtectedRoute requirePermission="chat_reports">
                          <AdminChatReports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="flight-logs"
                      element={
                        <ProtectedRoute requirePermission="audit">
                          <AdminFlightLogs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="featured-flights"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminFeaturedFlights />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="profile-content"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminProfileContent />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="user-alerts"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminUserAlerts />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="feedback"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminFeedback />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="surveys"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminSurveys />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="api-logs"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminApiLogs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="ratings"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminRatings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="alts"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminAltDetection />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="developers"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminDevelopers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="websockets"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminWebsockets />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="database"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminDatabase />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="billing"
                      element={
                        <ProtectedRoute requirePermission="billing">
                          <AdminBilling />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="external-acars"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminExternalAcars />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="chart-forensics"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminChartForensics />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      )}
    </Router>
  );
}
