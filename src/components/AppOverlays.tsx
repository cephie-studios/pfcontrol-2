import { lazy, Suspense } from 'react';
import CanaryModal from './modals/CanaryModal';
import UserAlertsModal from './modals/UserAlertsModal';
import { useAuth } from '../hooks/auth/useAuth';
import { useActiveUpdateModal } from '../hooks/useActiveUpdateModal';
import { useUserAlerts } from '../hooks/useUserAlerts';

const UpdateOverviewModal = lazy(() => import('./modals/UpdateOverviewModal'));

export default function AppOverlays() {
  const { user } = useAuth();
  const { activeModal, showUpdateModal, handleCloseModal } =
    useActiveUpdateModal(user);
  const { alerts, dismiss } = useUserAlerts(user);

  return (
    <>
      <CanaryModal />
      {activeModal && (
        <Suspense fallback={null}>
          <UpdateOverviewModal
            isOpen={showUpdateModal}
            onClose={handleCloseModal}
            title={activeModal.title}
            content={activeModal.content}
            bannerUrl={activeModal.banner_url}
          />
        </Suspense>
      )}
      <UserAlertsModal alerts={alerts} onDismiss={dismiss} />
    </>
  );
}
