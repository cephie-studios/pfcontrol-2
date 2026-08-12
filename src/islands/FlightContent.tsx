import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import Navbar from '../components/Navbar';
import AppOverlays from '../components/AppOverlays';
import PublicFlightView from '../pages/PublicFlightView';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface Props {
  flightId: string;
  pathname?: string;
}

export default function FlightContent({ flightId, pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <IsomorphicRouter pathname={pathname}>
              <Navbar />
              <AppOverlays />
              <PublicFlightView
                standalone={false}
                flightIdOverride={flightId}
              />
            </IsomorphicRouter>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
