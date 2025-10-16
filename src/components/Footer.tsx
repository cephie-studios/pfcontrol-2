import {
  TowerControl,
  Settings,
  ExternalLink,
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

export default function Footer() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const [version, setVersion] = useState('2.0.0.3');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_URL || ''}/api/version`
        );
        if (response.ok) {
          const data = await response.json();
          setVersion(data.version || '2.0.0.3');
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
      }
    };

    fetchVersion();
  }, []);

  const quickLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/create', label: 'Create Session', icon: BookPlus },
    { href: '/sessions', label: 'My Sessions', icon: FolderOpen },
  ];

  const legalLinks = [
    {
      href: 'https://terms.pfconnect.online',
      label: 'Terms of Use',
      icon: ScrollText,
    },
    {
      href: 'https://privacy.pfconnect.online',
      label: 'Privacy Policy',
      icon: Shield,
    },
    {
      href: 'https://cookies.pfconnect.online',
      label: 'Cookies Policy',
      icon: Cookie,
    },
  ];

  return (
    <footer className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-t border-zinc-700/50 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-10">
          <div className="space-y-4 col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <TowerControl className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                PFControl
              </span>
            </div>
            <p className="text-gray-400 text-sm max-w-sm">
              The next-generation flight strip platform built for real-time
              coordination between air traffic controllers with enterprise-level
              reliability.
            </p>
            <div className="flex space-x-4 mt-6">
              <a
                href="https://github.com/pfconnect"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-all duration-200 transform hover:scale-110 p-2"
                title="GitHub"
              >
                <SiGithub className="h-5 w-5" />
              </a>
              <a
                href="https://pfconnect.online/discord"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-indigo-500 transition-all duration-200 transform hover:scale-110 p-2"
                title="Discord"
              >
                <FaDiscord className="h-5 w-5" />
              </a>
              <a
                href="https://www.youtube.com/@PFConnectStudios"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-red-600 transition-all duration-200 transform hover:scale-110 p-2"
                title="YouTube"
              >
                <FaYoutube className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-white text-lg mb-4">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="inline-flex items-center text-gray-400 hover:text-blue-400 transition-all duration-200 text-sm group"
                    >
                      <IconComponent className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
                      {link.label}
                    </a>
                  </li>
                );
              })}
              {user && (
                <li>
                  <a
                    href="/settings"
                    className="inline-flex items-center text-gray-400 hover:text-blue-400 transition-all duration-200 text-sm group"
                  >
                    <Settings className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
                    Settings
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-white text-lg mb-4">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-gray-400 hover:text-blue-400 transition-all duration-200 text-sm group"
                    >
                      <IconComponent className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-white text-lg mb-4">Contact Us</h3>
            <div className="space-y-3">
              <div className="flex items-center group">
                <Mail className="h-4 w-4 text-gray-400 mr-2 group-hover:text-blue-400 transition-colors" />
                <a
                  href="mailto:support@pfconnect.online"
                  className="text-gray-400 hover:text-blue-400 transition-all duration-200 text-sm"
                >
                  support@pfconnect.online
                </a>
              </div>
              <div className="flex items-center group">
                <FaDiscord className="h-4 w-4 text-gray-400 mr-2 group-hover:text-blue-400 transition-colors" />
                <a
                  href="https://pfconnect.online/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-400 transition-all duration-200 text-sm"
                >
                  Join our Discord
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-zinc-700/50 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            &copy; {year} PFControl by{' '}
            <a
              href="https://pfconnect.online"
              className="text-blue-400 hover:text-blue-300 transition-all duration-200 underline inline-flex items-center group"
              target="_blank"
              rel="noopener noreferrer"
            >
              PFConnect Studios.
            </a>{' '}
            <span>All rights reserved.</span>
          </p>
          <div className="flex flex-col md:items-end space-y-1 md:space-y-0 md:space-x-6 md:flex-row">
            <p className="text-gray-500 text-sm mt-4 md:mt-0">
              ATIS powered by{' '}
              <a
                href="https://atisgenerator.com"
                className="text-blue-400 hover:text-blue-300 transition-all duration-200 underline inline-flex items-center group"
                target="_blank"
                rel="noopener noreferrer"
              >
                atisgenerator.com
                <ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </p>
            <p className="text-gray-500 text-sm">
              METAR powered by{' '}
              <a
                href="https://aviationweather.gov"
                className="text-blue-400 hover:text-blue-300 transition-all duration-200 underline inline-flex items-center group"
                target="_blank"
                rel="noopener noreferrer"
              >
                aviationweather.gov
                <ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </p>
          </div>
          <div className="flex items-center space-x-2 text-gray-500 text-sm">
            <span>Version {version}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
