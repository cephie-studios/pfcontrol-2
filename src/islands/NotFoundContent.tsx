import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import NotFound from '../pages/NotFound';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface Props {
  pathname?: string;
}

export default function NotFoundContent({ pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <IsomorphicRouter pathname={pathname}>
          <NotFound />
        </IsomorphicRouter>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
