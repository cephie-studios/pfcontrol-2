import { X, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CallsignHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CallsignHelpModal({
  isOpen,
  onClose,
}: CallsignHelpModalProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        <div className="flex-shrink-0 p-6 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-blue-800 bg-clip-text text-transparent">
            Callsign Formatting Guide
          </h2>
          <button
            onClick={onClose}
            className="bg-zinc-800/80 hover:bg-zinc-700 p-2 rounded-full transition-colors backdrop-blur-sm"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-zinc-300" />
          </button>
        </div>

        <div
          className={`absolute top-[85px] left-0 right-0 h-20 bg-gradient-to-b from-black via-black/40 to-transparent pointer-events-none transition-opacity duration-300 z-10 ${
            isScrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className="overflow-y-auto flex-1 p-6 space-y-6"
          onScroll={(e) =>
            setIsScrolled((e.target as HTMLElement).scrollTop > 0)
          }
        >
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-200 text-sm leading-relaxed">
              <strong className="text-blue-100">Important:</strong> Enter your{' '}
              <strong>aircraft callsign</strong> only, not your spoken callsign.
            </p>
          </div>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Commercial Airlines
            </h3>
            <div className="space-y-3">
              <p className="text-zinc-300 text-sm leading-relaxed">
                Use the <strong>3-letter ICAO airline code</strong> followed by
                the <strong>flight number</strong>:
              </p>
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    UAL123
                  </code>
                  <span className="text-zinc-400 text-sm">
                    United Airlines Flight 123
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    DLH456
                  </code>
                  <span className="text-zinc-400 text-sm">
                    Lufthansa Flight 456
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    BAW789
                  </code>
                  <span className="text-zinc-400 text-sm">
                    British Airways Flight 789
                  </span>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-3 mt-3">
                <p className="text-zinc-300 text-xs font-semibold mb-2">
                  Radiotelephony: FAA vs ICAO Procedures
                </p>
                <div className="space-y-1 text-zinc-400 text-xs">
                  <p>
                    <strong className="text-zinc-300">FAA (US):</strong> Group
                    digits - "United Twenty-Three Fifty-Three" (UAL2353)
                  </p>
                  <p>
                    <strong className="text-zinc-300">
                      ICAO (International):
                    </strong>{' '}
                    Individual digits - "United Two Three Five Three" (UAL2353)
                  </p>
                  <p className="text-zinc-500 italic mt-2">
                    Your written callsign remains the same (UAL2353) regardless
                    of region.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              General Aviation (GA)
            </h3>
            <div className="space-y-3">
              <p className="text-zinc-300 text-sm leading-relaxed">
                Use your <strong>full tail number/registration</strong> without
                spaces or dashes:
              </p>
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    N978CP
                  </code>
                  <span className="text-zinc-400 text-sm">
                    U.S. registered aircraft
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    GBABC
                  </code>
                  <span className="text-zinc-400 text-sm">
                    UK registered aircraft
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    CFTCA
                  </code>
                  <span className="text-zinc-400 text-sm">
                    Canadian registered aircraft
                  </span>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                <p className="text-blue-200 text-sm leading-relaxed mb-2">
                  <strong className="text-blue-100">
                    Project Flight & PTFS:
                  </strong>{' '}
                  Due to limited registration numbers, append your flight number
                  after the registration:
                </p>
                <div className="flex items-center gap-3">
                  <code className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded font-mono text-sm">
                    N34S4P3212
                  </code>
                  <span className="text-blue-200 text-xs">
                    N34S4P (registration) + 3212 (flight number)
                  </span>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                <p className="text-yellow-200 text-sm leading-relaxed">
                  <strong className="text-yellow-100">Common Mistake:</strong>{' '}
                  Do NOT use your spoken callsign here!
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xs">❌</span>
                    <code className="bg-red-500/20 text-red-300 px-2 py-1 rounded font-mono text-xs">
                      Citation
                    </code>
                    <span className="text-zinc-400 text-xs">
                      (this is your aircraft type/spoken callsign)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs">✓</span>
                    <code className="bg-green-500/20 text-green-300 px-2 py-1 rounded font-mono text-xs">
                      N525TA
                    </code>
                    <span className="text-zinc-400 text-xs">
                      (correct - your tail number)
                    </span>
                  </div>
                </div>
                <p className="text-yellow-100 text-xs mt-3">
                  While you may say "Citation Five Two Five Tango Alpha" on the
                  radio, your callsign in the system should be{' '}
                  <strong>N525TA</strong>.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Weight Class Suffixes
            </h3>
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                <strong className="text-red-300">Do NOT</strong> include weight
                class suffixes in your callsign:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-xs">❌</span>
                  <code className="bg-red-500/20 text-red-300 px-2 py-1 rounded font-mono text-xs">
                    UAL123 HEAVY
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-xs">❌</span>
                  <code className="bg-red-500/20 text-red-300 px-2 py-1 rounded font-mono text-xs">
                    AFR447SUPER
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-xs">✓</span>
                  <code className="bg-green-500/20 text-green-300 px-2 py-1 rounded font-mono text-xs">
                    UAL123
                  </code>
                </div>
              </div>
              <p className="text-zinc-400 text-xs mt-3">
                You would append "Heavy" or "Super" when speaking on the radio
                (e.g., "United One Twenty-Three Heavy"), but not in the written
                callsign field.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Quick Reference
            </h3>
            <div className="bg-zinc-800 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-2 text-zinc-300 font-semibold">
                      Flight Type
                    </th>
                    <th className="text-left py-2 text-zinc-300 font-semibold">
                      Format
                    </th>
                    <th className="text-left py-2 text-zinc-300 font-semibold">
                      Example
                    </th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400">
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-2">Commercial</td>
                    <td className="py-2">
                      <code className="text-blue-300 font-mono text-xs">
                        [ICAO][Number]
                      </code>
                    </td>
                    <td className="py-2">
                      <code className="bg-zinc-700 px-2 py-1 rounded font-mono text-xs">
                        SWA1234
                      </code>
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-700/50">
                    <td className="py-2">General Aviation</td>
                    <td className="py-2">
                      <code className="text-blue-300 font-mono text-xs">
                        [Registration]
                      </code>
                    </td>
                    <td className="py-2">
                      <code className="bg-zinc-700 px-2 py-1 rounded font-mono text-xs">
                        N12345
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2">Cargo/Charter</td>
                    <td className="py-2">
                      <code className="text-blue-300 font-mono text-xs">
                        [ICAO][Number]
                      </code>
                    </td>
                    <td className="py-2">
                      <code className="bg-zinc-700 px-2 py-1 rounded font-mono text-xs">
                        FDX9876
                      </code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-zinc-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              Additional Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.faa.gov/air_traffic/publications/atpubs/atc_html/chap2_section_4.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  FAA Order JO 7110.65 - Aircraft Identification
                </a>
              </li>
              <li>
                <a
                  href="https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap_3.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  ICAO Airline Codes List (FAA)
                </a>
              </li>
              <li>
                <a
                  href="https://wiki.ivao.aero/en/home/training/documentation/Radio_telephony_Aircraft_callsign"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Radio Telephony Aircraft Callsign Guide (IVAO)
                </a>
              </li>
            </ul>
          </section>
        </div>

        <div className="flex-shrink-0 bg-zinc-900 border-t border-zinc-700 p-6">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
