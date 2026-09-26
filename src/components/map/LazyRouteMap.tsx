import { lazy, Suspense } from 'react';
import type { RouteMapProps } from './RouteMap';

const RouteMap = lazy(() => import('./RouteMap'));

export default function LazyRouteMap(props: RouteMapProps) {
  return (
    <Suspense
      fallback={
        <div
          className={props.className}
          style={{ width: '100%', height: '100%', background: '#101012' }}
        />
      }
    >
      <RouteMap {...props} />
    </Suspense>
  );
}
