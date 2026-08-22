import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import Navbar from '../components/Navbar';
import AppOverlays from '../components/AppOverlays';
import PublicFlightView from '../pages/PublicFlightView';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';
import type { Flight } from '../types/flight';

interface Props {
  flightId: string;
  pathname?: string;
  initialFlight?: Flight | null;
}

export default function FlightContent({
  flightId,
  pathname,
  initialFlight,
}: Props) {
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
                initialFlight={initialFlight}
              />
            </IsomorphicRouter>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
