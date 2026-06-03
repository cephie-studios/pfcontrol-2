import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AppOverlays from '../components/AppOverlays';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';

export function PublicNavbar() {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <Navbar />
        <AppOverlays />
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}

export function PublicFooter() {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <Footer />
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
