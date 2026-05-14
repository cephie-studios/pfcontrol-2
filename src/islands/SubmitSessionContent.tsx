import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { DataProvider } from '../hooks/data/DataProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import Submit from '../pages/Submit';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';

interface Props {
  sessionId: string;
}

export default function SubmitSessionContent({ sessionId }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <MemoryRouter initialEntries={[`/submit/${sessionId}`]}>
              <Routes>
                <Route path="/submit/:sessionId" element={<Submit />} />
              </Routes>
            </MemoryRouter>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}