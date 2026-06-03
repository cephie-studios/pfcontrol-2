import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, KeyRound, BookOpen, Home } from "lucide-react";

const TAB_COUNT = 4;

export default function DeveloperSubnav() {
  const { pathname } = useLocation();

  const activeIndex = useMemo(() => {
    if (pathname.includes("/developers/docs")) return 3;
    if (pathname.includes("/developers/keys")) return 2;
    if (pathname.includes("/developers/console")) return 1;
    return 0;
  }, [pathname]);

  const linkClass = (isActive: boolean) =>
    `relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${
      isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <nav
      className="relative flex rounded-full bg-zinc-800/95 p-1 shadow-inner ring-1 ring-zinc-700/60 mb-8"
      aria-label="Developer sections"
    >
      <div
        className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-linear-to-b from-blue-500 to-blue-700 shadow-md transition-[left,width] duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${TAB_COUNT})`,
          left: `calc(0.25rem + ${activeIndex} * ((100% - 0.5rem) / ${TAB_COUNT}))`,
        }}
        aria-hidden
      />
      <NavLink
        to="/developers"
        end
        className={({ isActive }) => linkClass(isActive)}
      >
        <Home className="w-4 h-4 shrink-0 opacity-90" />
        Overview
      </NavLink>
      <NavLink
        to="/developers/console"
        className={({ isActive }) => linkClass(isActive)}
      >
        <LayoutDashboard className="w-4 h-4 shrink-0 opacity-90" />
        Usage
      </NavLink>
      <NavLink
        to="/developers/keys"
        className={({ isActive }) => linkClass(isActive)}
      >
        <KeyRound className="w-4 h-4 shrink-0 opacity-90" />
        <span className="hidden sm:inline">API keys</span>
        <span className="sm:hidden">Keys</span>
      </NavLink>
      <NavLink
        to="/developers/docs"
        className={({ isActive }) => linkClass(isActive)}
      >
        <BookOpen className="w-4 h-4 shrink-0 opacity-90" />
        <span className="hidden sm:inline">API reference</span>
        <span className="sm:hidden">Docs</span>
      </NavLink>
    </nav>
  );
}
