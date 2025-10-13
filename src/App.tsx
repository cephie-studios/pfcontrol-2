import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/auth/useAuth';

import Home from './pages/Home';
import Create from './pages/Create';
import Sessions from './pages/Sessions';
import Submit from './pages/Submit';
import Flights from './pages/Flights';
import Settings from './pages/Settings';
import PFATCFlights from './pages/PFATCFlights';
import Logbook from './pages/Logbook';
import FlightDetail from './pages/FlightDetail';
import PublicFlightView from './pages/PublicFlightView';
import PilotProfile from './pages/PilotProfile';

import Login from './pages/Login';
import VatsimCallback from './pages/VatsimCallback';
import NotFound from './pages/NotFound';

import ProtectedRoute from './components/ProtectedRoute';
import AccessDenied from './components/AccessDenied';
import ACARS from './pages/ACARS';
import Admin from './pages/Admin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';
import AdminBan from './pages/admin/AdminBan';
import AdminSessions from './pages/admin/AdminSessions';
import AdminTesters from './pages/admin/AdminTesters';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminRoles from './pages/admin/AdminRoles';

export default function App() {
    const { user } = useAuth();

    return (
        <Router>
            {user && user.isBanned ? (
                <AccessDenied errorType="banned" />
            ) : (
                <Routes>
                    <Route
                        path="/*"
                        element={
                            <ProtectedRoute>
                                <Routes>
                                    <Route index element={<Home />} />
                                    <Route
                                        path="pfatc"
                                        element={<PFATCFlights />}
                                    />
                                    <Route path="create" element={<Create />} />
                                    <Route
                                        path="sessions"
                                        element={<Sessions />}
                                    />
                                    <Route
                                        path="view/:sessionId"
                                        element={<Flights />}
                                    />
                                    <Route
                                        path="settings"
                                        element={<Settings />}
                                    />
                                    <Route
                                        path="logbook"
                                        element={<Logbook />}
                                    />
                                    <Route
                                        path="logbook/:flightId"
                                        element={<FlightDetail />}
                                    />
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/login" element={<Login />} />
                    <Route path="/login/vatsim/callback" element={<VatsimCallback />} />
                    <Route path="/submit/:sessionId" element={<Submit />} />
                    <Route
                        path="acars/:sessionId/:flightId"
                        element={<ACARS />}
                    />
                    <Route
                        path="/flight/:shareToken"
                        element={<PublicFlightView />}
                    />
                    <Route
                        path="/pilots/:username"
                        element={<PilotProfile />}
                    />

                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute
                                requireTester={false}
                                requirePermission="admin"
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
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<NotFound />} />
                </Routes>
            )}
        </Router>
    );
}
