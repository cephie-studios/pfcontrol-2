import { useCallback, useEffect, useState } from 'react';
import {
  fetchActiveUpdateModal,
  type UpdateModal,
} from '../utils/fetch/updateModal';
import { getTesterSettings } from '../utils/fetch/data';

function shouldBypassTesterGate() {
  return window.location.hostname === 'pfcontrol.com';
}

export function useActiveUpdateModal(
  user: { isTester?: boolean; isAdmin?: boolean } | null
) {
  const [testerGateEnabled, setTesterGateEnabled] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [activeModal, setActiveModal] = useState<UpdateModal | null>(null);

  useEffect(() => {
    if (!user) {
      setActiveModal(null);
      setShowUpdateModal(false);
      return;
    }

    fetchActiveUpdateModal()
      .then((modal) => {
        if (!modal) return;

        try {
          const seenModals = JSON.parse(
            localStorage.getItem('seenUpdateModals') || '[]'
          );
          if (seenModals.includes(modal.id)) return;
        } catch (error) {
          console.warn('localStorage not available, showing modal:', error);
        }

        setActiveModal(modal);
        setShowUpdateModal(true);
      })
      .catch((error) => {
        console.error('Error fetching active update modal:', error);
      });
  }, [user]);

  useEffect(() => {
    const checkGateStatus = async () => {
      try {
        if (shouldBypassTesterGate()) {
          setTesterGateEnabled(false);
          return;
        }

        const settings = await getTesterSettings();
        if (settings) {
          setTesterGateEnabled(settings.tester_gate_enabled);
        } else {
          setTesterGateEnabled(true);
        }
      } catch (error) {
        console.error('Error fetching tester settings:', error);
        setTesterGateEnabled(true);
      }
    };

    void checkGateStatus();
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowUpdateModal(false);

    if (!activeModal) return;

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
  }, [activeModal]);

  const showModal =
    !!activeModal &&
    (!testerGateEnabled ||
      shouldBypassTesterGate() ||
      (testerGateEnabled && !!user?.isTester) ||
      !!user?.isAdmin);

  return {
    activeModal,
    showUpdateModal: showUpdateModal && showModal,
    handleCloseModal,
  };
}
