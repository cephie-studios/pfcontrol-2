import { useEffect, useState, useMemo } from 'react';
import { Loader, Info, RefreshCw, Copy } from 'lucide-react';
import { useData } from '../../hooks/data/useData';
import { fetchMetar } from '../../utils/fetch/metar';
import { generateATIS } from '../../utils/fetch/atis';
import { fetchSession } from '../../utils/fetch/sessions';
import type { Socket } from 'socket.io-client';
import Checkbox from '../common/Checkbox';
import Button from '../common/Button';
import {
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSection,
  SidePanel,
  panelCardClass,
  panelInputClass,
  panelTextareaClass,
} from '../common/SidePanel';

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

    loadPreviousATIS().then();
  }, [sessionId, accessId, icao, open, availableRunways]);

  useEffect(() => {
    if (icao && !fetchedAirports.has(icao)) {
      fetchAirportData(icao).then();
    }
  }, [icao, fetchedAirports, fetchAirportData]);

  useEffect(() => {
    if (icao && open) {
      fetchMetar(icao)
        .then((data) => {
          setMetar((prev) => {
            if (data?.rawOb) return data.rawOb;
            if (data && typeof data === 'string') return data;
            if (data) {
              console.warn('Unexpected METAR data structure:', data);
              return prev;
            }
            return prev;
          });
        })
        .catch((error) => {
          console.warn('Failed to fetch METAR data:', error);
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
          return `EXPECT SIMULTANEOUS ${selectedApproaches.join(' AND ')} APPROACH ${runwaysText}`;
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
      setMetar((prev) => {
        if (data?.rawOb) return data.rawOb;
        if (data && typeof data === 'string') return data;
        if (data) {
          console.warn('Unexpected METAR data structure:', data);
          return prev;
        }
        return prev;
      });
    } catch (error) {
      console.warn('Failed to refresh METAR data:', error);
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
    <SidePanel open={open}>
      <PanelHeader icon={Info} title="ATIS Generator" onClose={onClose}>
        {icao && (
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 font-mono text-xs text-zinc-300">
            {icao}
          </span>
        )}
      </PanelHeader>

      <PanelBody>
        {(isLoading || isLoadingPreviousATIS) && (
          <div className="flex items-center justify-center gap-2 p-4">
            <Loader
              className="h-6 w-6 shrink-0 animate-spin text-blue-400"
              aria-hidden
            />
            {isLoadingPreviousATIS && (
              <span className="text-sm text-zinc-400">
                Loading previous ATIS data...
              </span>
            )}
          </div>
        )}

        {error && !isLoading && !isLoadingPreviousATIS && (
          <div className="rounded-2xl border border-red-700 bg-red-900/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {atisText && (
          <PanelSection
            title="Generated ATIS"
            actions={
              <Button
                onClick={copyToClipboard}
                size="xs"
                variant={copied ? 'success' : 'outline'}
                className="h-8 gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            }
          >
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-black p-4 font-mono text-sm text-green-400">
              {atisText}
            </div>
          </PanelSection>
        )}

        <PanelSection title="ATIS Identifier">
          <div className="grid grid-cols-6 gap-2">
            {identOptions.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => setIdent(letter)}
                className={`h-9 rounded-full text-center text-sm font-medium transition-colors ${
                  letter === ident
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="Approach Types">
          <div className="flex flex-wrap gap-2">
            {approachOptions.map((approach) => (
              <button
                key={approach}
                type="button"
                onClick={() => toggleApproachType(approach)}
                className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                  selectedApproaches.includes(approach)
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {approach}
              </button>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="Active Runways">
          {availableRunways.length > 0 ? (
            <div className="space-y-2">
              {availableRunways.map((runway) => (
                <div
                  key={runway}
                  className={`flex items-center justify-between px-4 py-3 ${panelCardClass}`}
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
            <div className="flex items-center rounded-2xl border border-amber-700 bg-amber-900/20 p-3 text-sm text-amber-400">
              <Info className="mr-2 h-4 w-4" />
              No runways available for this airport
            </div>
          )}
        </PanelSection>

        <PanelSection
          title="METAR"
          actions={
            <Button
              onClick={refreshWeather}
              size="xs"
              variant="outline"
              disabled={isRefreshing}
              className="h-8 gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          }
        >
          <textarea
            value={metar}
            onChange={(e) => setMetar(e.target.value)}
            className={`${panelTextareaClass} font-mono`}
            rows={3}
            placeholder="METAR will be loaded automatically"
          />
        </PanelSection>

        <PanelSection title="Additional Remarks">
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter any additional remarks for the ATIS..."
            maxLength={200}
            className={panelInputClass}
          />
        </PanelSection>
      </PanelBody>

      <PanelFooter>
        <Button onClick={onClose} variant="outline" size="sm">
          Close
        </Button>
        <Button
          onClick={handleGenerateATIS}
          disabled={
            isLoading ||
            !sessionId ||
            !icao ||
            (landingRunways.length === 0 && departingRunways.length === 0)
          }
          size="sm"
          className="gap-2"
        >
          {isLoading && <Loader className="h-4 w-4 animate-spin" />}
          Generate ATIS
        </Button>
      </PanelFooter>
    </SidePanel>
  );
}
