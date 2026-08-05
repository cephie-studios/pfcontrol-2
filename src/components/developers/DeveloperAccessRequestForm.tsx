import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertCircle } from 'lucide-react';
import ScopeTagSelector from './ScopeTagSelector';
import type { ScopeCatalogEntry } from './ScopeTagSelector';

const shellClass =
  'rounded-3xl border border-zinc-700/80 bg-linear-to-br from-zinc-900/95 via-zinc-900/90 to-sky-950/25 p-6 sm:p-8 shadow-xl ring-1 ring-zinc-700/45';

const inputClass =
  'w-full rounded-2xl border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 ring-1 ring-zinc-800/40 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-zinc-600 resize-none';

const labelClass = 'block text-sm font-medium text-zinc-400 mb-1.5';

type Props = {
  who: string;
  why: string;
  onWhoChange: (v: string) => void;
  onWhyChange: (v: string) => void;
  catalog: ScopeCatalogEntry[];
  selectedScopes: Set<string>;
  onScopesChange: Dispatch<SetStateAction<Set<string>>>;
  onSubmit: () => void;
  submitting: boolean;
  whoMinLen?: number;
  whyMinLen?: number;
};

export default function DeveloperAccessRequestForm({
  who,
  why,
  onWhoChange,
  onWhyChange,
  catalog,
  selectedScopes,
  onScopesChange,
  onSubmit,
  submitting,
  whoMinLen = 2,
  whyMinLen = 10,
}: Props) {
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValidationError(null);
  }, [who, why, selectedScopes]);

  const handleTrySubmit = () => {
    if (submitting) return;
    if (selectedScopes.size === 0) {
      setValidationError(
        'Choose at least one scope before sending your request.'
      );
      return;
    }
    const whoLen = who.trim().length;
    if (whoLen < whoMinLen) {
      setValidationError(
        whoMinLen <= 1
          ? 'Please tell us a little about yourself before sending.'
          : `The “about you” field is too short — add at least ${whoMinLen} characters (you have ${whoLen}).`
      );
      return;
    }
    const whyLen = why.trim().length;
    if (whyLen < whyMinLen) {
      setValidationError(
        `The project description is too short — write at least ${whyMinLen} characters so we can review your request (you have ${whyLen}).`
      );
      return;
    }
    setValidationError(null);
    onSubmit();
  };

  return (
    <div className={`${shellClass} relative text-zinc-200`}>
      <div className="flex items-start gap-3 mb-2 pr-10">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-zinc-50 tracking-tight">
            Let’s get you API access
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-2xl">
            A quick intro helps us approve you faster. Choose the scopes you
            need right now — you can always request more later.
          </p>
        </div>
      </div>

      <p className="mt-4 mb-6 rounded-2xl border border-sky-800/35 bg-sky-950/30 px-4 py-3 text-sm text-sky-100/90 leading-relaxed">
        <span className="font-medium text-sky-200">Note:</span> you only have
        to pick what you need today. Extra scopes on a key request later go
        through admin approval same as this one.
      </p>

      <div className="space-y-6 mt-2">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="dev-access-who" className={labelClass}>
              About you
            </label>
            <textarea
              id="dev-access-who"
              value={who}
              onChange={(e) => onWhoChange(e.target.value)}
              rows={4}
              placeholder="Your name, org, or Discord — whatever helps us know who’s asking"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="dev-access-why" className={labelClass}>
              What you’re building
            </label>
            <textarea
              id="dev-access-why"
              value={why}
              onChange={(e) => onWhyChange(e.target.value)}
              rows={4}
              placeholder="e.g. a flight tracker, a community tool, integration with …"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={`${labelClass} mb-3`}>
            Scopes you need now
            {selectedScopes.size > 0 && (
              <span className="ml-2 font-normal text-sky-400">
                {selectedScopes.size} selected
              </span>
            )}
          </label>
          {catalog.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">
              No scopes are available to choose right now.
            </p>
          ) : (
            <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950/50 p-4 sm:p-5 ring-1 ring-zinc-800/30">
              <ScopeTagSelector
                catalog={catalog}
                selected={selectedScopes}
                onChange={onScopesChange}
                appearance="dark"
              />
            </div>
          )}
        </div>

        {validationError && (
          <div
            className="flex items-start gap-2 rounded-xl border border-red-900/55 bg-red-950/50 px-3.5 py-3 text-sm text-red-100 ring-1 ring-red-900/30"
            role="alert"
          >
            <AlertCircle
              className="w-4 h-4 shrink-0 text-red-400 mt-0.5"
              aria-hidden
            />
            <span>{validationError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <p className="text-sm text-zinc-400 order-2 sm:order-1">
            {selectedScopes.size === 0
              ? 'Choose at least one scope to send your request.'
              : 'We usually review within a few days. Thanks for your patience!'}
          </p>
          <div className="flex flex-wrap gap-2 justify-end order-1 sm:order-2">
            <button
              type="button"
              disabled={submitting}
              onClick={handleTrySubmit}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-45 disabled:pointer-events-none text-white text-sm font-semibold shadow-lg shadow-sky-950/30 transition-colors"
            >
              {submitting ? 'Sending…' : 'Send my application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
