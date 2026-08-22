import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import Glossary from '../pages/Glossary';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';

interface Props {
  pathname?: string;
}

export default function GlossaryContent({ pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <IsomorphicRouter pathname={pathname}>
          <Glossary />
        </IsomorphicRouter>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
