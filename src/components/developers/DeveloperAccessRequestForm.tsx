import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, X } from "lucide-react";
import ScopeTagSelector from "./ScopeTagSelector";
import type { ScopeCatalogEntry } from "./ScopeTagSelector";

const shellClass =
  "rounded-3xl border border-zinc-700/80 bg-linear-to-br from-zinc-900/95 via-zinc-900/90 to-sky-950/25 p-6 sm:p-8 shadow-xl ring-1 ring-zinc-700/45";

const inputClass =
  "w-full rounded-2xl border border-zinc-700 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 ring-1 ring-zinc-800/40 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-zinc-600 resize-none";

const labelClass = "block text-sm font-medium text-zinc-400 mb-1.5";

export type DeveloperAccessRequestMode = "initial" | "expansion";

type Props = {
  mode: DeveloperAccessRequestMode;
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
  onDismiss?: () => void;
};

export default function DeveloperAccessRequestForm({
  mode,
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
  onDismiss,
}: Props) {
  const isInitial = mode === "initial";
  const title = isInitial
    ? "Let’s get you API access"
    : "Request more API access";
  const subtitle = isInitial
    ? "A quick intro helps us approve you faster. Choose the scopes you need right now — you can always request more later from this same page once you’re approved."
    : "Share a bit of context and pick only the new scopes you need. Your existing access stays on while we review this.";

  const whoLabel = isInitial ? "About you" : "Still you?";
  const whoPlaceholder = isInitial
    ? "Your name, org, or Discord — whatever helps us know who’s asking"
    : "Name or org (a short reminder is fine)";

  const whyLabel = isInitial ? "What you’re building" : "What’s changing?";
  const whyPlaceholder = isInitial
    ? "e.g. a flight tracker, a community tool, integration with …"
    : "What will you use these new endpoints for?";

  const scopeLabel = isInitial ? "Scopes you need now" : "New scopes to add";

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValidationError(null);
  }, [who, why, selectedScopes]);

  const handleTrySubmit = () => {
    if (submitting) return;
    if (selectedScopes.size === 0) {
      setValidationError(
        "Choose at least one scope before sending your request."
      );
      return;
    }
    const whoLen = who.trim().length;
    if (whoLen < whoMinLen) {
      setValidationError(
        whoMinLen <= 1
          ? "Please tell us a little about yourself before sending."
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
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-start gap-3 mb-2 pr-10">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-zinc-50 tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>
      </div>

      {isInitial && (
        <p className="mt-4 mb-6 rounded-2xl border border-sky-800/35 bg-sky-950/30 px-4 py-3 text-sm text-sky-100/90 leading-relaxed">
          <span className="font-medium text-sky-200">Note:</span> you only have
          to pick what you need today. After you&apos;re approved, you can come
          back anytime and use this same flow to ask for additional scopes.
        </p>
      )}

      <div className="space-y-6 mt-2">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="dev-access-who" className={labelClass}>
              {whoLabel}
            </label>
            <textarea
              id="dev-access-who"
              value={who}
              onChange={(e) => onWhoChange(e.target.value)}
              rows={isInitial ? 4 : 3}
              placeholder={whoPlaceholder}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="dev-access-why" className={labelClass}>
              {whyLabel}
            </label>
            <textarea
              id="dev-access-why"
              value={why}
              onChange={(e) => onWhyChange(e.target.value)}
              rows={isInitial ? 4 : 4}
              placeholder={whyPlaceholder}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={`${labelClass} mb-3`}>
            {scopeLabel}
            {selectedScopes.size > 0 && (
              <span className="ml-2 font-normal text-sky-400">
                {selectedScopes.size} selected
              </span>
            )}
          </label>
          {catalog.length === 0 ? (
            <p className="text-sm text-zinc-500 py-2">
              {isInitial
                ? "No scopes are available to choose right now."
                : "You already have every scope we offer — nothing more to request."}
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
              ? "Choose at least one scope to send your request."
              : "We usually review within a few days. Thanks for your patience!"}
          </p>
          <div className="flex flex-wrap gap-2 justify-end order-1 sm:order-2">
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-800/90 hover:text-zinc-200 text-sm font-medium transition-colors border border-zinc-700/60"
              >
                Maybe later
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={handleTrySubmit}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-45 disabled:pointer-events-none text-white text-sm font-semibold shadow-lg shadow-sky-950/30 transition-colors"
            >
              {submitting
                ? "Sending…"
                : isInitial
                  ? "Send my application"
                  : "Send scope request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
