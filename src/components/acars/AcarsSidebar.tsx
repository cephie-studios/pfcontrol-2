import { User, Radio } from 'lucide-react';
import type { OverviewSession } from '../../sockets/overviewSocket';
import { useAuth } from '../../hooks/auth/useAuth';

interface SidebarProps {
  activeSessions: OverviewSession[];
  onAtisClick: (session: OverviewSession) => void;
}

const getAvatarUrl = (avatar: string | null) => {
  if (!avatar) return '/assets/app/default/avatar.webp';
  return avatar;
};

export default function Sidebar({ activeSessions, onAtisClick }: SidebarProps) {
  const { user } = useAuth();
  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="p-3 border-b border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
          <User className="w-4 h-4" />
          CONTROLLERS
        </h3>
        <div className="space-y-3">
          {activeSessions.map((session) => (
            <div key={session.sessionId} className="text-zinc-300">
              <div className="font-semibold text-cyan-400 text-base mb-2">
                {session.airportIcao}
              </div>
              {session.controllers && session.controllers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {session.controllers.map((controller, idx) => (
                    <div
                      key={idx}
                      className="relative group flex items-center gap-2"
                    >
                      <img
                        src={
                          controller.username === user?.username
                            ? getAvatarUrl(user.avatar)
                            : getAvatarUrl(null)
                        }
                        alt={controller.username}
                        className="w-8 h-8 rounded-full shadow-md border-2 border-zinc-600"
                        onError={(e) => {
                          e.currentTarget.src =
                            '/assets/app/default/avatar.webp';
                        }}
                      />
                      <span className="text-sm text-zinc-300">
                        {controller.role}
                      </span>
                      <div className="absolute top-full mt-2 px-3 py-1 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                        <span className="text-sm font-medium text-white">
                          {controller.username}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  {session.activeUsers} controller(s)
                </div>
              )}
            </div>
          ))}
          {activeSessions.length === 0 && (
            <div className="text-zinc-500 text-sm">No active controllers</div>
          )}
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        <h3 className="text-base font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
          <Radio className="w-4 h-4" />
          ATIS
        </h3>
        <div className="space-y-3">
          {activeSessions
            .filter((session) => session.atis && session.atis.text)
            .map((session) => (
              <div
                key={session.sessionId}
                className="text-base cursor-pointer hover:bg-zinc-800 p-3 rounded-lg transition-colors border border-zinc-800 hover:border-zinc-700"
                onClick={() => onAtisClick(session)}
                title="Tap to send to terminal"
              >
                <div className="font-semibold text-blue-400 text-base">
                  {session.airportIcao} ATIS {session.atis?.letter}
                </div>
                <div className="text-zinc-300 text-sm whitespace-pre-wrap mt-1 line-clamp-2 overflow-hidden">
                  {session.atis?.text}
                </div>
              </div>
            ))}
          {activeSessions.filter((s) => s.atis && s.atis.text).length === 0 && (
            <div className="text-sm text-zinc-500">No ATIS available</div>
          )}
        </div>
      </div>
    </div>
  );
}
