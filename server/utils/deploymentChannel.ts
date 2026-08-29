import type { Request } from 'express';
import { DEPLOYMENT } from './cacheTtl.js';

export function resolveChannelFromHostname(host: string): string {
  const normalized = host.split(',')[0].trim().toLowerCase();

  if (normalized === 'pfcontrol.com' || normalized === 'www.pfcontrol.com') {
    return 'production';
  }
  if (normalized.startsWith('canary.')) {
    return 'canary';
  }

  return DEPLOYMENT;
}

export function resolveChannelFromHost(req: Request): string {
  return resolveChannelFromHostname(
    req.get('host') || req.get('x-forwarded-host') || ''
  );
}
