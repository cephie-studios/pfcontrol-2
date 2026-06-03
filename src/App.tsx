import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "./hooks/auth/useAuth";

import Home from "./pages/Home";
import Create from "./pages/Create";
import Sessions from "./pages/Sessions";
import Submit from "./pages/Submit";
import Flights from "./pages/Flights";
import MyFlights from "./pages/MyFlights";
import MyFlightDetail from "./pages/MyFlightDetail";
import Settings from "./pages/Settings";
import PFATCFlights from "./pages/PFATCFlights";
import ACARS from "./pages/ACARS";
import PilotProfile from "./pages/PilotProfile";
import PublicFlightView from "./pages/PublicFlightView";

import Login from "./pages/Login";
import VatsimCallback from "./pages/VatsimCallback";
import NotFound from "./pages/NotFound";

import ProtectedRoute from "./components/ProtectedRoute";
import AccessDenied from "./components/AccessDenied";
import Loader from "./components/common/Loader";
import AppOverlays from "./components/AppOverlays";
import PostHogPageView from "./components/PostHogPageView";

const Admin = lazy(() => import("./pages/Admin"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminBan = lazy(() => import("./pages/admin/AdminBan"));
const AdminSessions = lazy(() => import("./pages/admin/AdminSessions"));
const AdminTesters = lazy(() => import("./pages/admin/AdminTesters"));
const AdminNotifications = lazy(
  () => import("./pages/admin/AdminNotifications")
);
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminChatReports = lazy(() => import("./pages/admin/AdminChatReports"));
const AdminFlightLogs = lazy(() => import("./pages/admin/AdminFlightLogs"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback"));
const AdminApiLogs = lazy(() => import("./pages/admin/AdminApiLogs"));
const AdminRatings = lazy(() => import("./pages/admin/AdminRatings"));
const AdminAltDetection = lazy(() => import("./pages/admin/AdminAltDetection"));
const AdminDevelopers = lazy(() => import("./pages/admin/AdminDevelopers"));
const AdminWebsockets = lazy(() => import("./pages/admin/AdminWebsockets"));
const AdminDatabase = lazy(() => import("./pages/admin/AdminDatabase"));
const DeveloperLayout = lazy(
  () => import("./pages/developers/DeveloperLayout")
);
const DeveloperOverview = lazy(() => import("./pages/developers/Overview"));
const DeveloperConsole = lazy(() => import("./pages/developers/Console"));
const DeveloperKeys = lazy(() => import("./pages/developers/Keys"));
const DeveloperDocs = lazy(() => import("./pages/developers/Docs"));

export default function App() {
  const { user } = useAuth();

  return (
    <Router>
      <PostHogPageView />
      <AppOverlays />

      {user && user.isBanned ? (
        <AccessDenied errorType="banned" />
      ) : user && user.isVpnBlocked ? (
        <AccessDenied errorType="vpn-blocked" />
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pfatc" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<PFATCFlights />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/vatsim/callback" element={<VatsimCallback />} />
          <Route path="/submit/:sessionId" element={<Submit />} />
          <Route path="acars/:sessionId/:flightId" element={<ACARS />} />
          <Route path="flight/:flightId" element={<PublicFlightView />} />
          <Route path="/user/:username" element={<PilotProfile />} />

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
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                      <Loader />
                    </div>
                  }
                >
                  <DeveloperLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<DeveloperOverview />} />
            <Route path="console" element={<DeveloperConsole />} />
            <Route path="keys" element={<DeveloperKeys />} />
            <Route path="docs" element={<DeveloperDocs />} />
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
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
                      <Loader />
                    </div>
                  }
                >
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
                      path="feedback"
                      element={
                        <ProtectedRoute requirePermission="admin">
                          <AdminFeedback />
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
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </Router>
  );
}
