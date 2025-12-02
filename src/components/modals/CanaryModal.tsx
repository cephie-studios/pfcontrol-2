import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

export default function CanaryModal() {
  const [showEarlyReleaseModal, setShowEarlyReleaseModal] = useState(false);

  const isEarlyReleaseVersion = () => {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === 'canary.pfconnect.online'
    );
  };

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const setCookie = (name: string, value: string, hours: number) => {
    const date = new Date();
    date.setTime(date.getTime() + hours * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
  };

  useEffect(() => {
    if (isEarlyReleaseVersion()) {
      const hasSeenEarlyReleaseModal = getCookie('seenEarlyReleaseModal');
      if (!hasSeenEarlyReleaseModal) {
        setShowEarlyReleaseModal(true);
      }
    }
  }, []);

  const handleEarlyReleaseModalClose = () => {
    setShowEarlyReleaseModal(false);
    setCookie('seenEarlyReleaseModal', 'true', 24);
  };

  if (!showEarlyReleaseModal) return null;

  return (
    <Modal
      isOpen={showEarlyReleaseModal}
      onClose={handleEarlyReleaseModalClose}
      title="Early Release Version"
      variant="primary"
      icon={<AlertTriangle className="h-5 w-5" />}
      footer={
        <div className="flex justify-between space-x-3 w-full">
          <Button
            size="sm"
            onClick={() =>
              (window.location.href = 'https://control.pfconnect.online')
            }
          >
            Go to Stable Version
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleEarlyReleaseModalClose}
          >
            Continue Here
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-gray-300">
          You're currently on the{' '}
          <span className="font-semibold text-blue-400">
            early release version
          </span>{' '}
          of PFControl, which may contain bugs and incomplete features.
        </p>
      </div>
    </Modal>
  );
}
