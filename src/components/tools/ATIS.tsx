import { useEffect, useState, useMemo } from 'react';
import { X, Loader, Info, RefreshCw, Copy } from 'lucide-react';
import { useData } from '../../hooks/data/useData';
import { fetchMetar } from '../../utils/fetch/metar';
import { generateATIS } from '../../utils/fetch/atis';
import { fetchSession } from '../../utils/fetch/sessions';
import type { Socket } from 'socket.io-client';
import Checkbox from '../common/Checkbox';
import TextInput from '../common/TextInput';
import Button from '../common/Button';

interface ATISData {
  letter: string;
  text: string;
  timestamp?: number;
}

interface ATISProps {
  icao: string;
  sessionId?: string;
  accessId?: string;
  activeRunway?: string;
  open: boolean;
  onClose: () => void;
  socket?: Socket | undefined;
  onAtisUpdate?: (atis: ATISData) => void;
}

export default function ATIS({
  icao,
  sessionId,
  accessId,
  activeRunway,
  open,
  onClose,
  socket,
  onAtisUpdate,
}: ATISProps) {
  const { airportRunways, fetchAirportData, fetchedAirports } = useData();
  const [ident, setIdent] = useState<string>('A');
  const [selectedApproaches, setSelectedApproaches] = useState<string[]>([
    'ILS',
  ]);
  const [landingRunways, setLandingRunways] = useState<string[]>([]);
  const [departingRunways, setDepartingRunways] = useState<string[]>([]);
  const [remarks, setRemarks] = useState<string>('');
  const [metar, setMetar] = useState<string>('');
  const [atisText, setAtisText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPreviousATIS, setIsLoadingPreviousATIS] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const identOptions = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const approachOptions = ['ILS', 'VISUAL', 'RNAV'];
  const availableRunways = useMemo(
    () => airportRunways[icao] || [],
    [airportRunways, icao]
  );

  useEffect(() => {
    if (!socket) return;

    const handleAtisUpdate = (data: { atis: ATISData }) => {
      if (data.atis) {
        setAtisText(data.atis.text);
        setIdent(data.atis.letter);
        if (onAtisUpdate) {
          onAtisUpdate(data.atis);
        }
      }
    };

    socket.on('atisUpdate', handleAtisUpdate);

    return () => {
      socket.off('atisUpdate', handleAtisUpdate);
    };
  }, [socket, onAtisUpdate]);

  useEffect(() => {
    const loadPreviousATIS = async () => {
      if (!sessionId || !accessId || !icao || !open) return;

      setIsLoadingPreviousATIS(true);
      try {
        const sessionData = await fetchSession(sessionId, accessId);

        if (sessionData?.atis) {
          let atisData = null;
          if (
            typeof sessionData.atis === 'object' &&
            sessionData.atis !== null &&
            icao in sessionData.atis
          ) {
            // @ts-expect-error: dynamic key access
            atisData = sessionData.atis[icao];
          } else if (sessionData.atis.letter && sessionData.atis.text) {
            atisData = sessionData.atis;
          }

          if (atisData) {
            const atisText = atisData.text.toUpperCase();

            const extractedLandingRunways: string[] = [];
            const extractedDepartingRunways: string[] = [];
            const extractedApproaches: string[] = [];

            const landingPatterns = [
              /LANDING RUNWAYS? ([0-9LRC, ]+)/g,
              /ARRIVALS? RUNWAYS? ([0-9LRC, ]+)/g,
              /APPROACH RUNWAY ([0-9LRC]+)/g,
            ];

            const departurePatterns = [
              /DEPARTING RUNWAYS? ([0-9LRC, ]+)/g,
              /DEPARTURE RUNWAYS? ([0-9LRC, ]+)/g,
            ];

            landingPatterns.forEach((pattern) => {
              let match;
              while ((match = pattern.exec(atisText)) !== null) {
                const runwayString = match[1];
                const runways = runwayString
                  .split(',')
                  .map((r) => r.trim().replace(/[^0-9LRC]/g, ''))
                  .filter((r) => r.length >= 2);

                runways.forEach((runway) => {
                  if (
                    availableRunways.includes(runway) &&
                    !extractedLandingRunways.includes(runway)
                  ) {
                    extractedLandingRunways.push(runway);
                  }
                });
              }
            });

            departurePatterns.forEach((pattern) => {
              let match;
              while ((match = pattern.exec(atisText)) !== null) {
                const runwayString = match[1];
                const runways = runwayString
                  .split(',')
                  .map((r) => r.trim().replace(/[^0-9LRC]/g, ''))
                  .filter((r) => r.length >= 2);

                runways.forEach((runway) => {
                  if (
                    availableRunways.includes(runway) &&
                    !extractedDepartingRunways.includes(runway)
                  ) {
                    extractedDepartingRunways.push(runway);
                  }
                });
              }
            });

            if (
              atisText.includes('SIMULTANEOUS ILS AND VISUAL') ||
              atisText.includes('ILS AND VISUAL')
            ) {
              extractedApproaches.push('ILS', 'VISUAL');
            } else if (
              atisText.includes('SIMULTANEOUS VISUAL AND ILS') ||
              atisText.includes('VISUAL AND ILS')
            ) {
              extractedApproaches.push('ILS', 'VISUAL');
            } else if (atisText.includes('SIMULTANEOUS')) {
              if (atisText.includes('ILS')) extractedApproaches.push('ILS');
              if (atisText.includes('VISUAL'))
                extractedApproaches.push('VISUAL');
              if (atisText.includes('RNAV')) extractedApproaches.push('RNAV');
            } else {
              if (atisText.includes('ILS APPROACH'))
                extractedApproaches.push('ILS');
              if (atisText.includes('VISUAL APPROACH'))
                extractedApproaches.push('VISUAL');
              if (atisText.includes('RNAV APPROACH'))
                extractedApproaches.push('RNAV');
            }

            if (extractedLandingRunways.length > 0) {
              setLandingRunways(extractedLandingRunways);
            }

            if (extractedDepartingRunways.length > 0) {
              setDepartingRunways(extractedDepartingRunways);
            }

            if (extractedApproaches.length > 0) {
              setSelectedApproaches(extractedApproaches);
            }

            setAtisText(atisData.text);
            setIdent(atisData.letter || 'A');
          }
        }
      } catch (error) {
        console.error('Error loading previous ATIS:', error);
      } finally {
        setIsLoadingPreviousATIS(false);
      }
    };

    loadPreviousATIS();
  }, [sessionId, accessId, icao, open, availableRunways]);

  useEffect(() => {
    if (icao && !fetchedAirports.has(icao)) {
      fetchAirportData(icao);
    }
  }, [icao, fetchedAirports, fetchAirportData]);

  useEffect(() => {
    if (icao && open) {
      fetchMetar(icao)
        .then((data) => {
          if (data && data.rawOb) {
            setMetar(data.rawOb);
          } else if (data && typeof data === 'string') {
            setMetar(data);
          } else {
            console.warn('Unexpected METAR data structure:', data);
            setMetar('');
          }
        })
        .catch((error) => {
          console.warn('Failed to fetch METAR data:', error);
          setMetar('');
        });
    }
  }, [icao, open]);

  useEffect(() => {
    if (
      activeRunway &&
      open &&
      landingRunways.length === 0 &&
      departingRunways.length === 0
    ) {
      setLandingRunways([activeRunway]);
      setDepartingRunways([activeRunway]);
    }
  }, [activeRunway, open, landingRunways.length, departingRunways.length]);

  const toggleApproachType = (approach: string) => {
    setSelectedApproaches((prev) => {
      if (prev.includes(approach)) {
        return prev.filter((a) => a !== approach);
      }
      return [...prev, approach];
    });
  };

  const toggleRunway = (runway: string, type: 'landing' | 'departing') => {
    if (type === 'landing') {
      setLandingRunways((prev) =>
        prev.includes(runway)
          ? prev.filter((r) => r !== runway)
          : [...prev, runway]
      );
    } else {
      setDepartingRunways((prev) =>
        prev.includes(runway)
          ? prev.filter((r) => r !== runway)
          : [...prev, runway]
      );
    }
  };

  const handleGenerateATIS = async () => {
    if (!icao || !sessionId) {
      setError('Airport ICAO and Session ID are required');
      return;
    }

    if (landingRunways.length === 0 && departingRunways.length === 0) {
      setError('At least one runway must be selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formatApproaches = () => {
        if (selectedApproaches.length === 0) return '';

        const approachRunways =
          landingRunways.length > 0 ? landingRunways : departingRunways;
        const runwaysText =
          approachRunways.length === 1
            ? `RUNWAY ${approachRunways[0]}`
            : `RUNWAYS ${approachRunways.join(',')}`;

        if (selectedApproaches.length === 1) {
          return `EXPECT ${selectedApproaches[0]} APPROACH ${runwaysText}`;
        }

        if (selectedApproaches.length === 2) {
          return `EXPECT SIMULTANEOUS ${selectedApproaches.join(
            ' AND '
          )} APPROACH ${runwaysText}`;
        }

        const lastApproach = selectedApproaches[selectedApproaches.length - 1];
        const otherApproaches = selectedApproaches.slice(0, -1);
        return `EXPECT SIMULTANEOUS ${otherApproaches.join(
          ', '
        )} AND ${lastApproach} APPROACH ${runwaysText}`;
      };

      const approachText = formatApproaches();
      const combinedRemarks = approachText
        ? remarks
          ? `${approachText}... ${remarks}`
          : approachText
        : remarks;

      const requestData = {
        sessionId,
        ident,
        icao,
        remarks1: combinedRemarks,
        remarks2: {},
        landing_runways: landingRunways,
        departing_runways: departingRunways,
        metar: metar || undefined,
      };

      const data = await generateATIS(requestData);
      setAtisText(data.atisText);

      if (socket) {
        socket.emit('atisGenerated', {
          atis: {
            letter: data.ident,
            text: data.atisText,
            timestamp: data.timestamp,
          },
          icao,
          landingRunways,
          departingRunways,
          selectedApproaches,
          remarks,
        });
      }

      if (onAtisUpdate) {
        onAtisUpdate({
          letter: data.ident,
          text: data.atisText,
          timestamp:
            typeof data.timestamp === 'string'
              ? Number(data.timestamp)
              : data.timestamp,
        });
      }
    } catch (error) {
      console.error('Error generating ATIS:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to generate ATIS'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWeather = async () => {
    setIsRefreshing(true);
    const start = Date.now();
    try {
      const data = await fetchMetar(icao);
      if (data && data.rawOb) {
        setMetar(data.rawOb);
      } else if (data && typeof data === 'string') {
        setMetar(data);
      } else {
        console.warn('Unexpected METAR data structure:', data);
        setMetar('');
      }
    } catch (error) {
      console.warn('Failed to refresh METAR data:', error);
      setMetar('');
    } finally {
      const elapsed = Date.now() - start;
      const minDelay = 500;
      setTimeout(() => setIsRefreshing(false), Math.max(0, minDelay - elapsed));
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(atisText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    // Z-Index: 10000 - Always-on-top sidebars (see Z_INDEX_GUIDE.md)
    <div
      className={`fixed top-0 right-0 h-full w-100 bg-zinc-900 text-white transition-transform duration-300 ${
        open ? 'translate-x-0 shadow-2xl' : 'translate-x-full'
      } rounded-l-3xl border-l-2 border-blue-800 flex flex-col`}
      style={{ zIndex: 10000 }}
    >
      <div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-tl-3xl">
        <span className="font-extrabold text-xl text-blue-300">
          ATIS Generator - {icao}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-700 transition-colors"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {(isLoading || isLoadingPreviousATIS) && (
          <div className="flex items-center justify-center p-4">
            <Loader />
            {isLoadingPreviousATIS && (
              <span className="ml-2 text-sm text-gray-400">
                Loading previous ATIS data...
              </span>
            )}
          </div>
        )}

        {error && !isLoading && !isLoadingPreviousATIS && (
          <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg border border-red-700">
            {error}
          </div>
        )}

        {atisText && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-blue-300">
                Generated ATIS
              </h3>
              <Button
                onClick={copyToClipboard}
                size="sm"
                variant="outline"
                className={`flex items-center gap-1 relative overflow-hidden transition-all duration-300 ${
                  copied
                    ? 'bg-emerald-600 hover:bg-emerald-600 border-emerald-600 text-white'
                    : ''
                }`}
              >
                <div
                  className={`flex items-center space-x-2 transition-transform duration-300 ${
                    copied ? 'scale-105' : ''
                  }`}
                >
                  <Copy
                    className={`h-4 w-4 transition-transform duration-300 ${
                      copied ? 'rotate-12' : ''
                    }`}
                  />
                  <span className="font-medium">
                    {copied ? 'Copied!' : 'Copy'}
                  </span>
                </div>
                {copied && (
                  <div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-lg"></div>
                )}
              </Button>
            </div>
            <div className="bg-black p-4 rounded-lg border border-zinc-700 font-mono text-sm text-green-400 whitespace-pre-wrap">
              {atisText}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-blue-300">
            ATIS Identifier
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {identOptions.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => setIdent(letter)}
                className={`p-2 rounded-lg text-center text-sm font-medium transition-colors ${
                  letter === ident
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-blue-300">
            Approach Types
          </h3>
          <div className="flex flex-wrap gap-2">
            {approachOptions.map((approach) => (
              <button
                key={approach}
                type="button"
                onClick={() => toggleApproachType(approach)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedApproaches.includes(approach)
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {approach}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-blue-300">
            Active Runways
          </h3>
          {availableRunways.length > 0 ? (
            <div className="space-y-3">
              {availableRunways.map((runway) => (
                <div
                  key={runway}
                  className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700"
                >
                  <span className="font-mono text-lg font-semibold">
                    {runway}
                  </span>
                  <div className="flex gap-2">
                    <Checkbox
                      checked={landingRunways.includes(runway)}
                      onChange={() => toggleRunway(runway, 'landing')}
                      label="ARR"
                      checkedClass="bg-green-600 border-green-600"
                    />
                    <Checkbox
                      checked={departingRunways.includes(runway)}
                      onChange={() => toggleRunway(runway, 'departing')}
                      label="DEP"
                      checkedClass="bg-blue-600 border-blue-600"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-amber-400 text-sm flex items-center p-3 bg-amber-900/20 rounded-lg border border-amber-700">
              <Info className="h-4 w-4 mr-2" />
              No runways available for this airport
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-blue-300">METAR</h3>
            <Button
              onClick={refreshWeather}
              size="sm"
              variant="outline"
              disabled={isRefreshing}
              className="flex items-center gap-1"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
          <textarea
            value={metar}
            onChange={(e) => setMetar(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={3}
            placeholder="METAR will be loaded automatically"
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-blue-300">
            Additional Remarks
          </h3>
          <TextInput
            value={remarks}
            onChange={setRemarks}
            placeholder="Enter any additional remarks for the ATIS..."
            maxLength={200}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3"
          />
        </div>
      </div>

      <div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-bl-3xl">
        <div className="flex justify-start gap-3">
          <Button
            onClick={handleGenerateATIS}
            disabled={
              isLoading ||
              !sessionId ||
              !icao ||
              (landingRunways.length === 0 && departingRunways.length === 0)
            }
            size="sm"
            className="flex items-center gap-2"
          >
            {isLoading && <Loader className="animate-spin h-4 w-4" />}
            Generate ATIS
          </Button>
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
