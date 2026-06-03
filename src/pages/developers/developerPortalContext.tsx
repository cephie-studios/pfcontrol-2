/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  fetchDeveloperApplication,
  fetchDeveloperCatalog,
  fetchDeveloperDashboardSummary,
  fetchDeveloperKeys,
  submitDeveloperApplication,
  submitDeveloperScopeExpansionRequest,
  createDeveloperKey,
  deleteDeveloperKey,
  dismissDeveloperAdminNotice,
  patchDeveloperNotificationEmail,
  revokeDeveloperKey,
  rotateDeveloperKey,
  type DeveloperApplicationState,
  type DeveloperScopeCatalogEntry,
  type DeveloperDashboardSummary,
  type DeveloperKeyRow,
} from '../../utils/fetch/developer';
import { API_EXT_BASE } from './constants';
import {
  buildSampleCurlForScopes,
  type SampleCurlResult,
} from '../../utils/developerSampleCurl';

export type DeveloperUsageChartWindow = '24h' | 7 | 14 | 30;

type DeveloperPortalContextValue = {
  loading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  catalog: DeveloperScopeCatalogEntry[];
  appState: DeveloperApplicationState | null;
  profileActive: boolean;
  profileSuspended: boolean;
  pending: boolean;
  approvedScopes: string[];
  scopeLabelMap: Map<string, string>;
  usageChartWindow: DeveloperUsageChartWindow;
  setUsageChartWindow: (w: DeveloperUsageChartWindow) => void;
  summary: DeveloperDashboardSummary | null;
  keys: DeveloperKeyRow[];
  keyDefaultRateLimitPerMinute: number;
  dashLoading: boolean;
  who: string;
  setWho: (s: string) => void;
  why: string;
  setWhy: (s: string) => void;
  selectedScopes: Set<string>;
  setSelectedScopes: Dispatch<SetStateAction<Set<string>>>;
  submitting: boolean;
  newKeyName: string;
  setNewKeyName: (s: string) => void;
  newKeyScopes: Set<string>;
  setNewKeyScopes: Dispatch<SetStateAction<Set<string>>>;
  createdSecret: string | null;
  setCreatedSecret: (s: string | null) => void;
  keyBusy: boolean;
  secretCopied: boolean;
  curlCopied: boolean;
  loadApplication: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  refresh: () => void;
  toggleScope: (
    id: string,
    set: Set<string>,
    update: (s: Set<string>) => void
  ) => void;
  handleApply: () => Promise<void>;
  scopeExpansionSubmitting: boolean;
  submitScopeExpansionRequest: (input: {
    who: string;
    why: string;
    additionalScopes: string[];
  }) => Promise<boolean>;
  handleCreateKey: () => Promise<void>;
  handleRevoke: (id: string) => Promise<void>;
  handleDeleteKey: (id: string) => Promise<void>;
  handleRotateKey: (id: string) => Promise<void>;
  copySecret: () => Promise<void>;
  copyCurlExample: () => Promise<void>;
  curlSample: SampleCurlResult | null;
  showAdminNotice: boolean;
  adminNoticeDetail: string | null;
  dismissAdminNotice: () => Promise<void>;
  infoMessage: string | null;
  setInfoMessage: (s: string | null) => void;
  notificationEmail: string | null;
  notificationEmailSaving: boolean;
  saveNotificationEmail: (email: string | null) => Promise<void>;
};

const DeveloperPortalContext =
  createContext<DeveloperPortalContextValue | null>(null);

export function useDeveloperPortal() {
  const v = useContext(DeveloperPortalContext);
  if (!v) {
    throw new Error(
      'useDeveloperPortal must be used within DeveloperPortalProvider'
    );
  }
  return v;
}

export function DeveloperPortalProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<DeveloperScopeCatalogEntry[]>([]);
  const [appState, setAppState] = useState<DeveloperApplicationState | null>(
    null
  );

  const [who, setWho] = useState('');
  const [why, setWhy] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [scopeExpansionSubmitting, setScopeExpansionSubmitting] =
    useState(false);

  const [usageChartWindow, setUsageChartWindow] =
    useState<DeveloperUsageChartWindow>(14);
  const [summary, setSummary] = useState<DeveloperDashboardSummary | null>(
    null
  );
  const [keys, setKeys] = useState<DeveloperKeyRow[]>([]);
  const [keyDefaultRateLimitPerMinute, setKeyDefaultRateLimitPerMinute] =
    useState(120);
  const [dashLoading, setDashLoading] = useState(false);

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<Set<string>>(new Set());
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [curlExampleScopes, setCurlExampleScopes] = useState<string[]>([]);
  const [keyBusy, setKeyBusy] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [notificationEmailSaving, setNotificationEmailSaving] = useState(false);

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, app] = await Promise.all([
        fetchDeveloperCatalog(),
        fetchDeveloperApplication(),
      ]);
      setCatalog(cat);
      setAppState(app);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const [s, keysPayload] = await Promise.all([
        fetchDeveloperDashboardSummary(
          usageChartWindow === '24h'
            ? { hours: 24 }
            : { days: usageChartWindow }
        ),
        fetchDeveloperKeys(),
      ]);
      setSummary(s);
      setKeys(keysPayload.keys);
      setKeyDefaultRateLimitPerMinute(keysPayload.defaultRateLimitPerMinute);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setDashLoading(false);
    }
  }, [usageChartWindow]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  const profileActive = appState?.profile?.status === 'active';
  const profileSuspended = appState?.profile?.status === 'suspended';
  const pending = appState?.latestApplication?.status === 'pending';
  const approvedScopesKey = JSON.stringify(
    appState?.profile?.approvedScopes ?? []
  );
  const approvedScopes = useMemo(() => {
    try {
      const p = JSON.parse(approvedScopesKey) as unknown;
      return Array.isArray(p)
        ? p.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  }, [approvedScopesKey]);

  useEffect(() => {
    if (profileActive) {
      void loadDashboard();
    }
  }, [profileActive, usageChartWindow, loadDashboard]);

  useEffect(() => {
    if (profileActive && approvedScopes.length > 0 && newKeyScopes.size === 0) {
      setNewKeyScopes(new Set(approvedScopes));
    }
  }, [profileActive, approvedScopes, newKeyScopes.size]);

  const scopeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catalog) m.set(c.id, c.label);
    return m;
  }, [catalog]);

  const showAdminNotice = useMemo(() => {
    const p = appState?.profile;
    if (!p || p.status !== 'active') return false;
    const seq = p.adminNoticeSeq ?? 0;
    const dismissed = p.noticeDismissedSeq ?? 0;
    return seq > dismissed;
  }, [appState?.profile]);

  const adminNoticeDetail = useMemo(() => {
    if (!showAdminNotice) return null;
    const d = appState?.profile?.adminNoticeDetail;
    if (typeof d === 'string' && d.trim().length > 0) return d.trim();
    return null;
  }, [showAdminNotice, appState?.profile?.adminNoticeDetail]);

  const notificationEmail = useMemo(() => {
    const v = appState?.profile?.notificationEmail;
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  }, [appState?.profile?.notificationEmail]);

  const saveNotificationEmail = useCallback(
    async (email: string | null) => {
      setNotificationEmailSaving(true);
      setError(null);
      try {
        await patchDeveloperNotificationEmail(email);
        await loadApplication();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save email');
      } finally {
        setNotificationEmailSaving(false);
      }
    },
    [loadApplication]
  );

  const dismissAdminNotice = useCallback(async () => {
    setError(null);
    try {
      await dismissDeveloperAdminNotice();
      await loadApplication();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dismiss failed');
    }
  }, [loadApplication]);

  const toggleScope = useCallback(
    (id: string, set: Set<string>, update: (s: Set<string>) => void) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      update(next);
    },
    []
  );

  const handleApply = useCallback(async () => {
    if (selectedScopes.size === 0) {
      setError('Pick at least one scope to send your application.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitDeveloperApplication({
        who,
        why,
        requestedScopes: [...selectedScopes],
      });
      await loadApplication();
      setWho('');
      setWhy('');
      setSelectedScopes(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }, [who, why, selectedScopes, loadApplication]);

  const submitScopeExpansionRequest = useCallback(
    async (input: {
      who: string;
      why: string;
      additionalScopes: string[];
    }): Promise<boolean> => {
      if (input.additionalScopes.length === 0) {
        setError('Pick at least one new scope to include in your request.');
        return false;
      }
      setScopeExpansionSubmitting(true);
      setError(null);
      try {
        await submitDeveloperScopeExpansionRequest(input);
        await loadApplication();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Submit failed');
        return false;
      } finally {
        setScopeExpansionSubmitting(false);
      }
    },
    [loadApplication]
  );

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim() || newKeyScopes.size === 0) {
      setError('Key name and at least one scope are required.');
      return;
    }
    setKeyBusy(true);
    setError(null);
    try {
      const r = await createDeveloperKey({
        name: newKeyName.trim(),
        scopes: [...newKeyScopes],
      });
      setInfoMessage(null);
      if (r.kind === 'active') {
        setCreatedSecret(r.secret);
        setCurlExampleScopes(r.scopes);
      } else {
        setCreatedSecret(null);
        setCurlExampleScopes([]);
        setInfoMessage(r.message);
      }
      setNewKeyName('');
      await Promise.all([loadDashboard(), loadApplication()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create key failed');
    } finally {
      setKeyBusy(false);
    }
  }, [newKeyName, newKeyScopes, loadDashboard, loadApplication]);

  const handleRevoke = useCallback(
    async (id: string) => {
      if (!confirm('Revoke this API key? Clients using it will stop working.'))
        return;
      setKeyBusy(true);
      setError(null);
      try {
        await revokeDeveloperKey(id);
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Revoke failed');
      } finally {
        setKeyBusy(false);
      }
    },
    [loadDashboard]
  );

  const handleDeleteKey = useCallback(
    async (id: string) => {
      if (
        !confirm('Permanently delete this revoked key? This cannot be undone.')
      )
        return;
      setKeyBusy(true);
      setError(null);
      try {
        await deleteDeveloperKey(id);
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setKeyBusy(false);
      }
    },
    [loadDashboard]
  );

  const handleRotateKey = useCallback(
    async (id: string) => {
      if (
        !confirm(
          'Rotate this key? The old secret stops working immediately. Copy the new secret when it appears.'
        )
      )
        return;
      setKeyBusy(true);
      setError(null);
      try {
        const r = await rotateDeveloperKey(id);
        setCreatedSecret(r.secret);
        setCurlExampleScopes(Array.isArray(r.scopes) ? r.scopes : []);
        await loadDashboard();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Rotate failed');
      } finally {
        setKeyBusy(false);
      }
    },
    [loadDashboard]
  );

  const copySecret = useCallback(async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    setCurlCopied(false);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }, [createdSecret]);

  const curlSample = useMemo((): SampleCurlResult | null => {
    if (!createdSecret || curlExampleScopes.length === 0) return null;
    return buildSampleCurlForScopes(
      createdSecret,
      API_EXT_BASE,
      curlExampleScopes
    );
  }, [createdSecret, curlExampleScopes]);

  useEffect(() => {
    if (!createdSecret) {
      setCurlExampleScopes([]);
      setSecretCopied(false);
      setCurlCopied(false);
    }
  }, [createdSecret]);

  const copyCurlExample = useCallback(async () => {
    if (!createdSecret || !curlSample) return;
    await navigator.clipboard.writeText(curlSample.command);
    setSecretCopied(false);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  }, [createdSecret, curlSample]);

  const refresh = useCallback(() => {
    if (profileActive) void loadDashboard();
    else void loadApplication();
  }, [profileActive, loadDashboard, loadApplication]);

  const value = useMemo<DeveloperPortalContextValue>(
    () => ({
      loading,
      error,
      setError,
      catalog,
      appState,
      profileActive,
      profileSuspended,
      pending,
      approvedScopes,
      scopeLabelMap,
      usageChartWindow,
      setUsageChartWindow,
      summary,
      keys,
      keyDefaultRateLimitPerMinute,
      dashLoading,
      who,
      setWho,
      why,
      setWhy,
      selectedScopes,
      setSelectedScopes,
      submitting,
      newKeyName,
      setNewKeyName,
      newKeyScopes,
      setNewKeyScopes,
      createdSecret,
      setCreatedSecret,
      keyBusy,
      secretCopied,
      curlCopied,
      loadApplication,
      loadDashboard,
      refresh,
      toggleScope,
      handleApply,
      scopeExpansionSubmitting,
      submitScopeExpansionRequest,
      handleCreateKey,
      handleRevoke,
      handleDeleteKey,
      handleRotateKey,
      copySecret,
      copyCurlExample,
      curlSample,
      showAdminNotice,
      adminNoticeDetail,
      dismissAdminNotice,
      infoMessage,
      setInfoMessage,
      notificationEmail,
      notificationEmailSaving,
      saveNotificationEmail,
    }),
    [
      loading,
      error,
      catalog,
      appState,
      profileActive,
      profileSuspended,
      pending,
      approvedScopes,
      scopeLabelMap,
      usageChartWindow,
      summary,
      keys,
      keyDefaultRateLimitPerMinute,
      dashLoading,
      who,
      why,
      selectedScopes,
      submitting,
      scopeExpansionSubmitting,
      newKeyName,
      newKeyScopes,
      createdSecret,
      keyBusy,
      secretCopied,
      curlCopied,
      loadApplication,
      loadDashboard,
      refresh,
      toggleScope,
      handleApply,
      submitScopeExpansionRequest,
      handleCreateKey,
      handleRevoke,
      handleDeleteKey,
      handleRotateKey,
      copySecret,
      copyCurlExample,
      curlSample,
      showAdminNotice,
      adminNoticeDetail,
      dismissAdminNotice,
      infoMessage,
      notificationEmail,
      notificationEmailSaving,
      saveNotificationEmail,
    ]
  );

  return (
    <DeveloperPortalContext.Provider value={value}>
      {children}
    </DeveloperPortalContext.Provider>
  );
}
