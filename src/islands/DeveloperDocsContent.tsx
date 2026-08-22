import './loadIslandStyles';
import { AuthProvider } from '../hooks/auth/AuthProvider';
import DeveloperDocsPage from '../pages/DeveloperDocsPage';
import { PostHogProviderWrapper } from './PostHogProviderWrapper';
import { IsomorphicRouter } from './IsomorphicRouter';
import type { DeveloperApiPublicSpec } from '../types/developerApiSpec';

interface Props {
  spec: DeveloperApiPublicSpec | null;
  pathname?: string;
}

export default function DeveloperDocsContent({ spec, pathname }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <IsomorphicRouter pathname={pathname}>
          <DeveloperDocsPage initialSpec={spec} />
        </IsomorphicRouter>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
