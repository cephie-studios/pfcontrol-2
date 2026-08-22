import { Code2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import DeveloperDocs from './developers/Docs';
import DeveloperSubnav from './developers/DeveloperSubnav';
import { API_EXT_BASE } from './developers/constants';
import { useAuth } from '../hooks/auth/useAuth';
import type { DeveloperApiPublicSpec } from '../types/developerApiSpec';

interface DeveloperDocsPageProps {
  initialSpec?: DeveloperApiPublicSpec | null;
}

export default function DeveloperDocsPage({
  initialSpec,
}: DeveloperDocsPageProps = {}) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />
      <main className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Code2 className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Developers <span className="text-md text-red-400 italic">BETA</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50">
            Developer API Reference
          </h1>
          <p className="text-zinc-400 mt-2 text-sm sm:text-base max-w-6xl">
            Base URL:{' '}
            <code className="text-blue-300 text-xs sm:text-sm break-all">
              {API_EXT_BASE}
            </code>
          </p>
        </div>
        {user && <DeveloperSubnav />}
        <DeveloperDocs initialSpec={initialSpec} />
      </main>
      <Footer />
    </div>
  );
}
