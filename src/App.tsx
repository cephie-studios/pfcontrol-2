import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './hooks/auth/useAuth';

import Home from './pages/Home';
import Create from './pages/Create';
import Sessions from './pages/Sessions';
import Submit from './pages/Submit';
import Flights from './pages/Flights';
import Settings from './pages/Settings';
import PFATCFlights from './pages/PFATCFlights';
import ACARS from './pages/ACARS';
import PilotProfile from './pages/PilotProfile';

import Login from './pages/Login';
import VatsimCallback from './pages/VatsimCallback';
import NotFound from './pages/NotFound';

import ProtectedRoute from './components/ProtectedRoute';
import AccessDenied from './components/AccessDenied';
import UpdateOverviewModal from './components/modals/UpdateOverviewModal';
import NotificationBanner from './components/NotificationBanner';

import Admin from './pages/Admin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';
import AdminBan from './pages/admin/AdminBan';
import AdminSessions from './pages/admin/AdminSessions';
import AdminTesters from './pages/admin/AdminTesters';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminRoles from './pages/admin/AdminRoles';
import AdminChatReports from './pages/admin/AdminChatReports';
import AdminFlightLogs from './pages/admin/AdminFlightLogs';

import {
  fetchActiveUpdateModal,
  type UpdateModal,
} from './utils/fetch/updateModal';

export default function App() {
  const { user } = useAuth();
  const [activeModal, setActiveModal] = useState<UpdateModal | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchActiveUpdateModal()
        .then((modal) => {
          if (modal) {
            try {
              const seenModals = JSON.parse(
                localStorage.getItem('seenUpdateModals') || '[]'
              );
              const hasSeenThisModal = seenModals.includes(modal.id);

              if (!hasSeenThisModal) {
                setActiveModal(modal);
                setShowUpdateModal(true);
              }
            } catch (error) {
              console.warn('localStorage not available, showing modal:', error);
              setActiveModal(modal);
              setShowUpdateModal(true);
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching active update modal:', error);
        });
    }
  }, [user]);

  const handleCloseModal = () => {
    setShowUpdateModal(false);

    if (activeModal) {
      try {
        const seenModals = JSON.parse(
          localStorage.getItem('seenUpdateModals') || '[]'
        );
        if (!seenModals.includes(activeModal.id)) {
          seenModals.push(activeModal.id);
          localStorage.setItem('seenUpdateModals', JSON.stringify(seenModals));
        }
      } catch (error) {
        console.warn('Could not save to localStorage:', error);
      }
    }
  };

  return (
    <Router>
      <NotificationBanner />
      
      {activeModal && (
        <UpdateOverviewModal
          isOpen={showUpdateModal}
          onClose={handleCloseModal}
          title={activeModal.title}
          content={activeModal.content}
          bannerUrl={activeModal.banner_url}
        />
      )}

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
                  <Route path="pfatc" element={<PFATCFlights />} />
                  <Route path="create" element={<Create />} />
                  <Route path="sessions" element={<Sessions />} />
                  <Route path="view/:sessionId" element={<Flights />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ProtectedRoute>
            }
          />

          <Route path="/login" element={<Login />} />
          <Route path="/login/vatsim/callback" element={<VatsimCallback />} />
          <Route path="/submit/:sessionId" element={<Submit />} />
          <Route path="acars/:sessionId/:flightId" element={<ACARS />} />
          <Route path="/user/:username" element={<PilotProfile />} />

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
