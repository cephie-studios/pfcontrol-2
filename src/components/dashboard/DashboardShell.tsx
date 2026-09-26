import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import Toast from '../common/Toast';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export type DashboardCrumb = {
  label: string;
  to?: string;
  mobileHidden?: boolean;
};

export type DashboardToast = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

type DashboardShellProps = {
  sidebar: ReactNode;
  crumbs: DashboardCrumb[];
  storageKey: string;
  headerActions?: ReactNode;
  children: ReactNode;
  toast?: DashboardToast;
  onToastClose?: () => void;
};

function readSidebarOpen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== 'true';
  } catch {
    return true;
  }
}

export default function DashboardShell({
  sidebar,
  crumbs,
  storageKey,
  headerActions,
  children,
  toast,
  onToastClose,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    readSidebarOpen(storageKey)
  );

  const handleOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(storageKey, String(!open));
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={handleOpenChange}
        className="shadcn-scope bg-background text-foreground"
      >
        {sidebar}
        <SidebarInset className="min-w-0 bg-background">
          <header className="pointer-events-none sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 px-4 md:px-6">
            <div className="pointer-events-auto flex h-9 max-w-full min-w-0 items-center gap-2 rounded-full bg-background/85 px-3 backdrop-blur-md -ml-3">
              <SidebarTrigger className="-ml-1.5 size-7 md:hidden" />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4 md:hidden"
              />
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-nowrap">
                  {crumbs.map((crumb, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                      <Fragment key={`${crumb.label}-${i}`}>
                        {i > 0 ? (
                          <BreadcrumbSeparator
                            className={
                              crumb.mobileHidden ? 'hidden md:block' : undefined
                            }
                          />
                        ) : null}
                        <BreadcrumbItem
                          className={
                            crumb.mobileHidden
                              ? 'hidden md:inline-flex'
                              : 'min-w-0'
                          }
                        >
                          {last || !crumb.to ? (
                            <BreadcrumbPage className="truncate">
                              {crumb.label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={crumb.to}>{crumb.label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            {headerActions ? (
              <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full bg-background/85 backdrop-blur-md">
                {headerActions}
              </div>
            ) : null}
          </header>

          <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={onToastClose ?? (() => {})}
          />
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
}
