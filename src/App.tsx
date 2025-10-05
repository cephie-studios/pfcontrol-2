import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/auth/useAuth';

import Home from './pages/Home';
import Create from './pages/Create';
import Sessions from './pages/Sessions';
import Submit from './pages/Submit';
import Flights from './pages/Flights';
import Settings from './pages/Settings';
import PFATCFlights from './pages/PFATCFlights';

import Login from './pages/Login';
import NotFound from './pages/NotFound';

import ProtectedRoute from './components/ProtectedRoute';
import AccessDenied from './components/AccessDenied';

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
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/submit/:sessionId" element={<Submit />} />
                    <Route path="/login" element={<Login />} />

                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute
                                requireAdmin={false}
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
