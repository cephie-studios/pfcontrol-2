import './loadIslandStyles';
import { Route, Routes } from 'react-router';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import Navbar from '../components/Navbar';
import AppOverlays from '../components/AppOverlays';
import Submit from '../pages/Submit';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface SubmitSessionContentProps {
  airportIcao?: string;
  pathname?: string;
}

export default function SubmitSessionContent({
  airportIcao,
  pathname,
}: SubmitSessionContentProps) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <DataProvider>
          <SettingsProvider>
            <IsomorphicRouter pathname={pathname}>
              <Navbar />
              <AppOverlays />
              <Routes>
                <Route
                  path="/submit/:sessionId"
                  element={
                    <Submit
                      standalone={false}
                      initialAirportIcao={airportIcao}
                    />
                  }
                />
              </Routes>
            </IsomorphicRouter>
          </SettingsProvider>
        </DataProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
