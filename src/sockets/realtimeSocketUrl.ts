function resolveSocketUrl(
  dedicated: string | undefined,
  fallback: string | undefined
): string | undefined {
  if (dedicated === '' || dedicated === 'same-origin') {
    return undefined;
  }
  if (dedicated) {
    return dedicated;
  }
  return fallback || undefined;
}

export function usesViteSocketProxy(): boolean {
  const v = import.meta.env.VITE_REALTIME_URL as string | undefined;
  return v === '' || v === 'same-origin';
}

export function getRealtimeSocketUrl(): string | undefined {
  return resolveSocketUrl(
    import.meta.env.VITE_REALTIME_URL as string | undefined,
    import.meta.env.VITE_SERVER_URL as string | undefined
  );
}

export function getNodeSocketUrl(): string | undefined {
  const dedicated = import.meta.env.VITE_NODE_SOCKET_URL as string | undefined;
  if (dedicated !== undefined) {
    return resolveSocketUrl(
      dedicated,
      import.meta.env.VITE_SERVER_URL as string | undefined
    );
  }
  if (usesViteSocketProxy()) {
    return undefined;
  }
  return import.meta.env.VITE_SERVER_URL as string | undefined;
}
