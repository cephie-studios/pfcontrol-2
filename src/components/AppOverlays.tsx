import CanaryModal from './modals/CanaryModal';
import UpdateOverviewModal from './modals/UpdateOverviewModal';
import UserAlertsModal from './modals/UserAlertsModal';
import { useAuth } from '../hooks/auth/useAuth';
import { useActiveUpdateModal } from '../hooks/useActiveUpdateModal';
import { useUserAlerts } from '../hooks/useUserAlerts';

export default function AppOverlays() {
  const { user } = useAuth();
  const { activeModal, showUpdateModal, handleCloseModal } =
    useActiveUpdateModal(user);
  const { alerts, dismiss } = useUserAlerts(user);

  return (
    <>
      <CanaryModal />
      {activeModal && (
        <UpdateOverviewModal
          isOpen={showUpdateModal}
          onClose={handleCloseModal}
          title={activeModal.title}
          content={activeModal.content}
          bannerUrl={activeModal.banner_url}
        />
      )}
      <UserAlertsModal alerts={alerts} onDismiss={dismiss} />
    </>
  );
}
