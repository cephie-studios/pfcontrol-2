import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  AlertCircle,
  Hammer,
  KeyRound,
  Loader2,
  Send,
  Tags,
  UserRound,
} from 'lucide-react';
import SettingsSection from '../Settings/SettingsSection';
import SettingsGroup from '../Settings/SettingsGroup';
import SettingsRow from '../Settings/SettingsRow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ScopeTagSelector from './ScopeTagSelector';
import type { ScopeCatalogEntry } from './ScopeTagSelector';

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
          : `The “about you” field is too short. Add at least ${whoMinLen} characters (you have ${whoLen}).`
      );
      return;
    }
    const whyLen = why.trim().length;
    if (whyLen < whyMinLen) {
      setValidationError(
        `The project description is too short. Write at least ${whyMinLen} characters so we can review your request (you have ${whyLen}).`
      );
      return;
    }
    setValidationError(null);
    onSubmit();
  };

  return (
    <SettingsSection title="Request API access" icon={KeyRound}>
      <SettingsGroup>
        <SettingsRow
          stacked
          icon={<UserRound className="text-blue-400" />}
          label="About you"
          description="A quick intro helps us approve you faster."
          htmlFor="dev-access-who"
        >
          <Textarea
            id="dev-access-who"
            value={who}
            onChange={(e) => onWhoChange(e.target.value)}
            rows={4}
            placeholder="Your name, org, or Discord, whatever helps us know who’s asking"
            className="min-h-24 resize-none"
          />
        </SettingsRow>
        <SettingsRow
          stacked
          icon={<Hammer className="text-blue-400" />}
          label="What you’re building"
          htmlFor="dev-access-why"
        >
          <Textarea
            id="dev-access-why"
            value={why}
            onChange={(e) => onWhyChange(e.target.value)}
            rows={4}
            placeholder="e.g. a flight tracker, a community tool, integration with …"
            className="min-h-24 resize-none"
          />
        </SettingsRow>
        <SettingsRow
          stacked
          icon={<Tags className="text-blue-400" />}
          label={
            <>
              Scopes you need now
              {selectedScopes.size > 0 && (
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  {selectedScopes.size} selected
                </span>
              )}
            </>
          }
          description="Pick only what you need today. Extra scopes later go through the same admin approval."
        >
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scopes are available to choose right now.
            </p>
          ) : (
            <div className="w-full">
              <ScopeTagSelector
                catalog={catalog}
                selected={selectedScopes}
                onChange={onScopesChange}
                appearance="dark"
              />
            </div>
          )}
        </SettingsRow>
        <div className="flex flex-col gap-3 px-5 py-4">
          {validationError && (
            <div
              className="flex items-start gap-2 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{validationError}</span>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p className="text-sm text-muted-foreground">
              {selectedScopes.size === 0
                ? 'Choose at least one scope to send your request.'
                : 'We usually review within a few days. Thanks for your patience!'}
            </p>
            <Button
              type="button"
              disabled={submitting}
              onClick={handleTrySubmit}
              className="self-end sm:shrink-0 sm:self-auto"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              {submitting ? 'Sending…' : 'Send my application'}
            </Button>
          </div>
        </div>
      </SettingsGroup>
    </SettingsSection>
  );
}
