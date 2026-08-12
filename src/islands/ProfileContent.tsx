import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import Navbar from '../components/Navbar';
import AppOverlays from '../components/AppOverlays';
import PilotProfile from '../pages/PilotProfile';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface Props {
  username: string;
  pathname?: string;
}

export default function ProfileContent({ username, pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <DataProvider>
          <IsomorphicRouter pathname={pathname}>
            <Navbar />
            <AppOverlays />
            <PilotProfile standalone={false} usernameOverride={username} />
          </IsomorphicRouter>
        </DataProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
