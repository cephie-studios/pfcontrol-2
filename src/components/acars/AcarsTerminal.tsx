import { Terminal as TerminalIcon } from 'lucide-react';
import Button from '../../components/common/Button';
import type { AcarsMessage } from '../../types/acars';

interface TerminalProps {
  flightCallsign?: string;
  messages: AcarsMessage[];
  getMessageColor: (type: AcarsMessage['type']) => string;
  renderMessageText: (msg: AcarsMessage) => React.ReactNode;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleRequestPDC: () => void;
  pdcRequested: boolean;
}

export default function AcarsTerminal({
  flightCallsign,
  messages,
  getMessageColor,
  renderMessageText,
  messagesEndRef,
  handleRequestPDC,
  pdcRequested,
}: TerminalProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
        <TerminalIcon className="w-5 h-5 text-green-500" />
        <span className="text-sm font-mono text-zinc-300">
          {flightCallsign ? `${flightCallsign} ACARS` : 'ACARS Terminal'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-black">
        {messages.map((msg) => (
          <div key={msg.id} className={getMessageColor(msg.type)}>
            <div className="flex gap-2 mb-0.5">
              <span className="text-zinc-500">
                {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC'
                })}Z
              </span>
              <span className="text-zinc-400">[{msg.station}]:</span>
              <div>{renderMessageText(msg)}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-zinc-900 border-t border-zinc-800 p-3">
        <div className="flex gap-2">
            <Button
            size="sm"
            variant="outline"
            onClick={pdcRequested ? undefined : handleRequestPDC}
            className={`text-left py-2 px-3 transition-colors items-start rounded-xl border-[0.5px] ${
              pdcRequested
              ? 'bg-purple-600/20 border-purple-500 text-purple-200 hover:bg-purple-600/20 hover:border-purple-500 hover:text-purple-200 pointer-events-none'
              : 'text-purple-600 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border-purple-700 hover:bg-purple-800/90 hover:border-purple-600 hover:text-purple-200'
            }`}
            disabled={pdcRequested}
            >
            {pdcRequested ? 'PDC REQUESTED' : 'REQUEST PDC'}
          </Button>
        </div>
      </div>
    </div>
  );
}
