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

export default function AcarsSidebar({
  activeSessions,
  onAtisClick,
}: SidebarProps) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-700">
        <h3 className="text-sm font-mono text-zinc-300 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          Controllers
        </h3>
        <div className="space-y-3">
          {activeSessions.map((session) => (
            <div key={session.sessionId} className="text-zinc-200">
              <div className="font-semibold text-cyan-400 text-sm mb-2">
                {session.airportIcao}
              </div>
              {session.controllers && session.controllers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {session.controllers.map((controller, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg"
                    >
                      <img
                        src={
                          controller.username === user?.username
                            ? getAvatarUrl(user.avatar)
                            : getAvatarUrl(null)
                        }
                        alt={controller.username}
                        className="w-6 h-6 rounded-full border border-zinc-600"
                      />
                      <span className="text-xs text-zinc-300">
                        {controller.role}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-500">
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

      <div className="p-4 flex-1 overflow-y-auto">
        <h3 className="text-sm font-mono text-zinc-300 mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5 text-blue-500" />
          ATIS
        </h3>
        <div className="space-y-3">
          {activeSessions
            .filter((session) => session.atis && session.atis.text)
            .map((session) => (
              <div
                key={session.sessionId}
                className="cursor-pointer hover:bg-zinc-800 p-3 rounded-lg transition-colors border border-zinc-700 hover:border-zinc-600"
                onClick={() => onAtisClick(session)}
              >
                <div className="font-semibold text-blue-400 text-sm">
                  {session.airportIcao} ATIS {session.atis?.letter}
                </div>
                <div className="text-zinc-300 text-xs whitespace-pre-wrap mt-1 line-clamp-2">
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
