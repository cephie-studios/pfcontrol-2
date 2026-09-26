import { Code2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import DeveloperDocs from './developers/Docs';
import DeveloperSubnav from './developers/DeveloperSubnav';
import { API_EXT_BASE } from './developers/constants';
import { useAuth } from '../hooks/auth/useAuth';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { DeveloperApiPublicSpec } from '../types/developerApiSpec';

interface DeveloperDocsPageProps {
  initialSpec?: DeveloperApiPublicSpec | null;
}

export default function DeveloperDocsPage({
  initialSpec,
}: DeveloperDocsPageProps = {}) {
  const { user } = useAuth();

  return (
    <TooltipProvider>
      <div className="shadcn-scope min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6">
          <div className="mb-6">
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Code2 className="size-4 text-blue-400" />
              <span>
                Developers <span className="text-red-400">Beta</span>
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Developer API Reference
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Base URL:{' '}
              <code className="font-mono text-xs break-all text-foreground sm:text-sm">
                {API_EXT_BASE}
              </code>
            </p>
          </div>
          {user ? <DeveloperSubnav /> : null}
          <DeveloperDocs initialSpec={initialSpec} />
        </main>
        <Footer />
      </div>
    </TooltipProvider>
  );
}
