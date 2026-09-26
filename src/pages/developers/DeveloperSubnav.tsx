import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router';
import { LayoutDashboard, KeyRound, BookOpen, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAB_COUNT = 4;

export default function DeveloperSubnav() {
  const { pathname } = useLocation();

  const activeIndex = useMemo(() => {
    if (pathname.includes('/developers/docs')) return 3;
    if (pathname.includes('/developers/keys')) return 2;
    if (pathname.includes('/developers/console')) return 1;
    return 0;
  }, [pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
      isActive
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    );

  const iconClass = ({ isActive }: { isActive: boolean }) =>
    cn('size-4 shrink-0', isActive && 'text-blue-400');

  return (
    <nav
      className="relative mb-8 flex rounded-xl bg-muted p-1"
      aria-label="Developer sections"
    >
      <div
        className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-background shadow-sm transition-[left,width] duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${TAB_COUNT})`,
          left: `calc(0.25rem + ${activeIndex} * ((100% - 0.5rem) / ${TAB_COUNT}))`,
        }}
        aria-hidden
      />
      <NavLink to="/developers" end className={linkClass}>
        {({ isActive }) => (
          <>
            <Home className={iconClass({ isActive })} />
            Overview
          </>
        )}
      </NavLink>
      <NavLink to="/developers/console" className={linkClass}>
        {({ isActive }) => (
          <>
            <LayoutDashboard className={iconClass({ isActive })} />
            Usage
          </>
        )}
      </NavLink>
      <NavLink to="/developers/keys" className={linkClass}>
        {({ isActive }) => (
          <>
            <KeyRound className={iconClass({ isActive })} />
            <span className="hidden sm:inline">API keys</span>
            <span className="sm:hidden">Keys</span>
          </>
        )}
      </NavLink>
      <NavLink to="/developers/docs" className={linkClass}>
        {({ isActive }) => (
          <>
            <BookOpen className={iconClass({ isActive })} />
            <span className="hidden sm:inline">API reference</span>
            <span className="sm:hidden">Docs</span>
          </>
        )}
      </NavLink>
    </nav>
  );
}
