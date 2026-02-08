import {
  TowerControl,
  Settings,
  Mail,
  Home,
  FolderOpen,
  ScrollText,
  Shield,
  Cookie,
  BookPlus,
} from 'lucide-react';
import { FaDiscord, FaYoutube } from 'react-icons/fa';
import { SiGithub } from 'react-icons/si';
import { useAuth } from '../hooks/auth/useAuth';
import { useState, useEffect } from 'react';

interface VersionData {
  version: string;
  updated_at: string | null;
  updated_by: string;
}

export default function Footer() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const [versionData, setVersionData] = useState<VersionData>({
    version: '2.0.0.3',
    updated_at: null,
    updated_by: 'system',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL || ''}/api/version`
        );
        if (response.ok) {
          const data: VersionData = await response.json();
          setVersionData(data);
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersion();
  }, []);

  const quickLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/create', label: 'Create Session', icon: BookPlus },
    { href: '/sessions', label: 'My Sessions', icon: FolderOpen },
    { href: '/pfatc', label: 'PFATC Overview', icon: TowerControl },
  ];

  const legalLinks = [
    {
      href: 'https://cephie.app/legal/terms',
      label: 'Terms of Use',
      icon: ScrollText,
    },
    {
      href: 'https://cephie.app/legal/privacy',
      label: 'Privacy Policy',
      icon: Shield,
    },
    {
      href: 'https://cephie.app/legal/cookies',
      label: 'Cookies Policy',
      icon: Cookie,
    },
  ];

  return (
    <footer className="bg-black border-t-2 border-zinc-800 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <TowerControl className="h-8 w-8 text-blue-400" />
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  PFControl
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm max-w-xs">
              The next-generation flight strip platform built for real-time
              coordination between air traffic controllers with enterprise-level
              reliability.
            </p>

            <div className="flex items-center space-x-5 pt-2 flex-wrap">
              <a
                href="https://cephie.app/github"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <SiGithub className="h-5 w-5 md:h-6 md:w-6" />
              </a>
              <a
                href="https://cephie.app/discord"
                target="_blank"
                rel="noopener noreferrer"
                title="Discord"
                className="text-gray-400 hover:text-indigo-500 transition-colors"
              >
                <FaDiscord className="h-5 w-5 md:h-6 md:w-6" />
              </a>
              <a
                href="https://www.youtube.com/@PFConnectStudios"
                target="_blank"
                rel="noopener noreferrer"
                title="YouTube"
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <FaYoutube className="h-5 w-5 md:h-6 md:w-6" />
              </a>
            </div>
          </div>

          {/* Spacer only on md+ to avoid awkward mobile gaps */}
          <div className="hidden md:block md:col-span-2" />

          {/* Quick links */}
          <div className="md:col-span-3 col-span-1 w-full">
            <div className="bg-zinc-900/40 p-4 w-full">
              <h3 className="text-white font-medium mb-3">Quick Links</h3>
              <ul className="space-y-2">
                {quickLinks.map((link) => {
                  const IconComponent = link.icon;
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="inline-flex items-center text-gray-300 hover:text-blue-400 transition-colors text-sm"
                      >
                        <IconComponent className="h-4 w-4 mr-2" />
                        {link.label}
                      </a>
                    </li>
                  );
                })}
                {user && (
                  <li>
                    <a
                      href="/settings"
                      className="inline-flex items-center text-gray-300 hover:text-blue-400 transition-colors text-sm"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Legal & Contact */}
          <div className="md:col-span-3 col-span-1 w-full">
            <div className="bg-zinc-900/40 p-4 w-full">
              <h3 className="text-white font-medium mb-3">Legal</h3>
              <ul className="space-y-2 mb-3">
                {legalLinks.map((link) => {
                  const IconComponent = link.icon;
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-gray-300 hover:text-blue-400 transition-colors text-sm"
                      >
                        <IconComponent className="h-4 w-4 mr-2" />
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>

              <h3 className="text-white font-medium mb-2">Contact</h3>
              <div className="space-y-2">
                <a
                  href="mailto:support@pfconnect.online"
                  className="flex items-center text-gray-300 text-sm hover:text-blue-400 transition-colors"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  support@pfconnect.online
                </a>
                <a
                  href="https://pfconnect.online/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-gray-300 text-sm hover:text-blue-400 transition-colors"
                >
                  <FaDiscord className="h-4 w-4 mr-2" />
                  Join our Discord
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 border-t border-zinc-700/50 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="text-gray-500 text-sm text-center md:text-left space-x-2">
            METAR by{' '}
            <a
              href="https://aviationweather.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              aviationweather.gov
            </a>{' '}
            ATIS by{' '}
            <a
              href="https://atisgenerator.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
              title="ATIS provider"
            >
              atisgenerator.com
            </a>
            Charts by{' '}
            <a
              href="https://discord.gg/pfatc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              PFATC
            </a>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-end gap-4 w-full">
            <div className="text-gray-400 text-sm">
              &copy; {year} PFControl by{' '}
              <a
                href="https://pfconnect.online"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                PFConnect Studios
              </a>
            </div>

            <div className="bg-zinc-900/40 p-3 flex items-center gap-4 whitespace-nowrap">
              <div className="text-gray-400 text-sm">Version</div>
              <div className="text-white font-mono text-sm truncate">
                {isLoading ? '...' : versionData.version}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
