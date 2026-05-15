import './loadIslandStyles';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import Submit from '../pages/Submit';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';

export default function SubmitSessionContent() {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <DataProvider>
          <SettingsProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/submit/:sessionId"
                  element={<Submit standalone={false} />}
                />
              </Routes>
            </BrowserRouter>
          </SettingsProvider>
        </DataProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}