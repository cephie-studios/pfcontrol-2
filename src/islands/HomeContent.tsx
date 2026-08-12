import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import { SettingsProvider } from '../hooks/settings/SettingsProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AppOverlays from '../components/AppOverlays';
import Home from '../pages/Home';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface Props {
  pathname?: string;
}

export default function HomeContent({ pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <SettingsProvider>
          <IsomorphicRouter pathname={pathname}>
            <Navbar />
            <AppOverlays />
            <Home standalone={false} />
            <Footer />
          </IsomorphicRouter>
        </SettingsProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
