import type { ReactNode } from 'react';
import { BrowserRouter, StaticRouter } from 'react-router';

interface IsomorphicRouterProps {
  pathname?: string;
  children: ReactNode;
}

export function IsomorphicRouter({
  pathname = '/',
  children,
}: IsomorphicRouterProps) {
  if (import.meta.env.SSR) {
    return <StaticRouter location={pathname}>{children}</StaticRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}
