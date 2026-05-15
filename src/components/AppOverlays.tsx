import CanaryModal from './modals/CanaryModal';
import UpdateOverviewModal from './modals/UpdateOverviewModal';
import { useAuth } from '../hooks/auth/useAuth';
import { useActiveUpdateModal } from '../hooks/useActiveUpdateModal';

export default function AppOverlays() {
  const { user } = useAuth();
  const { activeModal, showUpdateModal, handleCloseModal } =
    useActiveUpdateModal(user);

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
    </>
  );
}
