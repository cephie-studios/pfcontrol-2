import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import HowToUsePFControl from '../pages/HowToUsePFControl';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface Props {
  pathname?: string;
}

export default function HowToUsePFControlContent({ pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <IsomorphicRouter pathname={pathname}>
          <HowToUsePFControl />
        </IsomorphicRouter>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
