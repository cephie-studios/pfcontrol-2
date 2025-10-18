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
          {flightCallsign ? `${flightCallsign} Terminal` : 'ACARS Terminal'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 bg-black">
        {messages.map((msg) => (
          <div key={msg.id} className={getMessageColor(msg.type)}>
            {renderMessageText(msg)}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="bg-zinc-900 border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRequestPDC}
            disabled={pdcRequested}
          >
            {pdcRequested ? 'PDC REQUESTED' : 'REQUEST PDC'}
          </Button>
        </div>
      </div>
    </div>
  );
}
