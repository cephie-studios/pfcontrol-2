import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { ToastProvider } from '../components/common/ToastProvider';
import Navbar from '../components/Navbar';
import AppOverlays from '../components/AppOverlays';
import PilotProfile from '../pages/PilotProfile';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';
import type { PilotProfile as PilotProfileType } from '../types/pilot';

interface Props {
  username: string;
  pathname?: string;
  initialProfile?: PilotProfileType | null;
  initialRanks?: Record<string, number | string | null>;
}

export default function ProfileContent({
  username,
  pathname,
  initialProfile,
  initialRanks,
}: Props) {
  return (
    <PostHogProviderWrapper>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <IsomorphicRouter pathname={pathname}>
              <Navbar />
              <AppOverlays />
              <PilotProfile
                standalone={false}
                usernameOverride={username}
                initialProfile={initialProfile}
                initialRanks={initialRanks}
              />
            </IsomorphicRouter>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </PostHogProviderWrapper>
  );
}
