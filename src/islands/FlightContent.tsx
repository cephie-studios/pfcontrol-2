import './loadIslandStyles';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import PublicFlightView from '../pages/PublicFlightView';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';

interface Props {
  flightId: string;
}

export default function FlightContent({ flightId }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <BrowserRouter>
              <PublicFlightView
                standalone={false}
                flightIdOverride={flightId}
              />
            </BrowserRouter>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
