export type DeploymentChannel = 'production' | 'canary';

export function resolveChannelFromHostname(
  hostname: string
): DeploymentChannel | null {
  const normalized = hostname.trim().toLowerCase();

  if (normalized === 'pfcontrol.com' || normalized === 'www.pfcontrol.com') {
    return 'production';
  }
  if (normalized.startsWith('canary.')) {
    return 'canary';
  }

  return null;
}

export function getCurrentDeploymentChannel(): DeploymentChannel | null {
  if (typeof window === 'undefined') return null;
  return resolveChannelFromHostname(window.location.hostname);
}
