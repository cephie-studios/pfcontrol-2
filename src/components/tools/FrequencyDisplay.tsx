// src/components/tools/FrequencyDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchFrequencies } from '../../utils/fetch/data';

interface FrequencyDisplayProps {
  airportIcao: string;
  isMobile?: boolean;
  showExpandedTable?: boolean;
}

const FrequencyDisplay: React.FC<FrequencyDisplayProps> = ({
  airportIcao,
  isMobile = false,
  showExpandedTable = true,
}) => {
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [frequencies, setFrequencies] = useState<
    { type: string; freq: string }[]
  >([]);
  const [allFrequencies, setAllFrequencies] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    type Frequency = { type: string; freq: string };
    type Airport = { icao: string; frequencies?: Frequency[] };

    const loadFrequencies = async () => {
      const freqData: Airport[] = await fetchFrequencies();
      const airportFreq = freqData.find((f: Airport) => f.icao === airportIcao);
      setFrequencies(
        Array.isArray(airportFreq?.frequencies) ? airportFreq.frequencies : []
      );

      const allFrequenciesList: { label: string; value: string }[] = [];
      for (const airport of freqData) {
        if (Array.isArray(airport.frequencies)) {
          for (const f of airport.frequencies) {
            allFrequenciesList.push({
              label: `${airport.icao}_${f.type}`,
              value: f.freq,
            });
          }
        }
      }
      setAllFrequencies(allFrequenciesList);
    };
    if (airportIcao) loadFrequencies();
  }, [airportIcao]);

  if (frequencies.length === 0) return null;

  const hasMoreFrequencies = showExpandedTable && allFrequencies.length > 0;

  if (isMobile) {
    return (
      <div id="frequency-display" className="w-full">
        <div
          className={`w-full bg-gray-800 rounded border border-gray-700 p-3 ${
            hasMoreFrequencies
              ? 'cursor-pointer hover:bg-gray-700 transition-colors'
              : ''
          }`}
          onClick={
            hasMoreFrequencies ? () => setIsTableOpen(!isTableOpen) : undefined
          }
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300 font-medium">
                Frequencies
              </span>
            </div>
            {hasMoreFrequencies && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>+{allFrequencies.length - frequencies.length} more</span>
                {isTableOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {frequencies.map(({ type, freq }) => (
              <div
                key={type}
                className="flex items-center gap-1 bg-gray-700 rounded px-2 py-1"
              >
                <span className="text-xs text-gray-300 font-medium">
                  {type}
                </span>
                <span className="text-xs text-white font-mono">{freq}</span>
              </div>
            ))}
          </div>
        </div>

        {isTableOpen && hasMoreFrequencies && (
          <div className="mt-2 bg-gray-800 border border-gray-600 rounded overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs">Station</th>
                    <th className="text-right px-3 py-2 text-xs">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {allFrequencies.map(({ label, value }) => (
                    <tr
                      key={label}
                      className="odd:bg-gray-800 even:bg-gray-900"
                    >
                      <td className="px-3 py-2 text-xs break-all">{label}</td>
                      <td className="text-right px-3 py-2 text-xs font-mono">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="frequency-display" className="relative">
      <div
        className={`flex items-center gap-3 rounded border border-gray-700 px-4 py-3 bg-gray-800 ${
          hasMoreFrequencies
            ? 'cursor-pointer hover:bg-gray-900 transition-colors'
            : ''
        }`}
        onClick={
          hasMoreFrequencies ? () => setIsTableOpen(!isTableOpen) : undefined
        }
      >
        <Radio className="h-5 w-5 text-blue-400 flex-shrink-0" />

        <div className="flex gap-4 items-center">
          {frequencies.map(({ type, freq }) => (
            <div
              key={type}
              className="flex flex-col items-center justify-center"
            >
              <span className="text-xs text-gray-400 font-medium leading-tight">
                {type}
              </span>
              <span className="text-sm text-white font-mono leading-tight">
                {freq}
              </span>
            </div>
          ))}
        </div>

        {hasMoreFrequencies && (
          <div className="flex items-center gap-1 ml-auto text-sm text-gray-400 flex-shrink-0">
            {isTableOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        )}
      </div>

      {isTableOpen && hasMoreFrequencies && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-80 bg-gray-900 border border-gray-700 rounded shadow-lg z-50">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-400">Station</th>
                  <th className="text-right px-3 py-2 text-gray-400">
                    Frequency
                  </th>
                </tr>
              </thead>
              <tbody>
                {allFrequencies.map(({ label, value }) => (
                  <tr
                    key={label}
                    className="odd:bg-gray-900 even:bg-gray-950 hover:bg-gray-800"
                  >
                    <td className="px-3 py-2 break-all text-gray-300">
                      {label}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-white">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrequencyDisplay;
