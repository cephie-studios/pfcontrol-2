import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Button from '../common/Button';

interface AtisReminderModalProps {
  onContinue: () => void;
  atisText: string;
  accessId: string;
  userId: string;
  sessionId: string;
  airportIcao: string;
  airportName: string;
  airportControlName: string;
  airportAppFrequency: string;
  airportFrequencyType: string;
}

export default function AtisReminderModal({
  onContinue,
  atisText,
  sessionId,
  userId,
  airportIcao,
  airportName,
  airportControlName,
  airportAppFrequency,
  airportFrequencyType,
}: AtisReminderModalProps) {
  const submitLink = `${window.location?.origin}/submit/${sessionId}`;
  const [copied, setCopied] = useState(false);

  const getFormattedControlName = () => {
    if (!airportControlName) return null;
    if (airportFrequencyType === 'APP') {
      if (airportIcao === 'EGKK') {
        return `${airportControlName} Director`;
      }
      return `${airportControlName} Approach`;
    } else if (airportFrequencyType === 'TWR') {
      return `${airportControlName} Tower`;
    } else if (airportFrequencyType === 'GND') {
      return `${airportControlName} Ground`;
    } else if (airportFrequencyType === 'DEL') {
      return `${airportControlName} Delivery`;
    }
    return null;
  };

  const formattedControlName = getFormattedControlName();

  const formattedAtis = formattedControlName
    ? `${airportIcao}_${airportFrequencyType} "${formattedControlName}" (${airportAppFrequency}): <@${userId}>\n\n${atisText}\n\n${submitLink}`
    : `${airportIcao}_${airportFrequencyType} (${airportAppFrequency}): <@${userId}>\n\n${atisText}\n\n${submitLink}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${airportName}\n\n${formattedAtis}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-zinc-500/50 rounded-2xl p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold text-blue-400 mb-4">
          PFATC Network ATIS Format Reminder
        </h2>

        <p className="text-gray-300 mb-6">
          If you want to use this on the PFATC Network, please make sure to use
          the correct ATIS format as shown below:
        </p>

        <div className="relative bg-zinc-950 border border-zinc-700 rounded-lg p-4 mb-6 font-mono text-sm text-gray-300 overflow-x-auto">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            title="Copy ATIS"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <div className="text-blue-400 font-bold mb-3">{airportName}</div>
          <pre className="whitespace-pre-wrap break-words pr-10">
            {formattedAtis}
          </pre>
        </div>

        <Button
          onClick={onContinue}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Continue to Session
        </Button>
      </div>
    </div>
  );
}
