import {
  Bell,
  ChevronDown,
  ChevronUp,
  LayoutList,
  PanelTop,
  Smartphone,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

interface NotificationSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function NotificationSettings({
  settings,
  onChange,
}: NotificationSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleViewModeChange = (mode: 'legacy' | 'list') => {
    if (!settings || isMobile) return; // Prevent changing on mobile
    const updatedSettings = {
      ...settings,
      notificationViewMode: mode,
    };
    onChange(updatedSettings);
  };

  if (!settings) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="w-full p-4 sm:p-6 border-b border-zinc-700/50">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center flex-1 min-w-0 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-2 bg-yellow-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
            </div>
            <div className="text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                Notification Settings
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mt-1 hidden sm:block">
                Choose how notifications are displayed
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
            size="sm"
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 p-2 flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded
            ? 'max-h-[2000px] opacity-100'
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="p-6">
          <div className="space-y-6">
            {/* Notification View Mode */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-start mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-4 mt-0.5">
                  <Bell className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">
                    Notification Display Mode
                  </h4>
                  <p className="text-zinc-400 text-sm">
                    Choose between the legacy banner at the top or the modern list view at the bottom
                  </p>
                </div>
              </div>
              {isMobile && (
                <div className="mb-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg flex items-start gap-2">
                  <Smartphone className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    Only List View is available on mobile devices. Legacy Banner is a desktop-only feature.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewModeChange('list')}
                  disabled={isMobile}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    isMobile
                      ? 'bg-blue-600 text-white cursor-default'
                      : (settings.notificationViewMode || 'list') === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <LayoutList className="h-4 w-4" />
                  List View {isMobile && '(Active)'}
                </button>
                <button
                  onClick={() => handleViewModeChange('legacy')}
                  disabled={isMobile}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    isMobile
                      ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed opacity-50'
                      : (settings.notificationViewMode || 'list') === 'legacy'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <PanelTop className="h-4 w-4" />
                  Legacy Banner
                </button>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <h4 className="text-yellow-300 font-medium text-sm mb-1">
                  Notification Information
                </h4>
                <p className="text-yellow-200/80 text-xs sm:text-sm leading-relaxed">
                <strong>List View (Default):</strong> Shows notifications at the bottom of the page in a modern, expandable list format.
                <br />
                  <strong>Legacy Banner:</strong> Displays notifications at the top of the page, similar to PFControl v1.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
