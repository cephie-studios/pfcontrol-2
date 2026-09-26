import { Fragment, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import AdminSidebar from './AdminSidebar';
import { findAdminNavItem } from './adminNav';
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

export type AdminToast = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

export type AdminBreadcrumb = { label: string; to?: string };

type AdminLayoutProps = {
  children: ReactNode;
  toast?: AdminToast;
  onToastClose?: () => void;
  breadcrumbs?: AdminBreadcrumb[];
};

const SIDEBAR_STORAGE_KEY = 'admin-sidebar-collapsed';

function readSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export default function AdminLayout({
  children,
  toast,
  onToastClose,
  breadcrumbs = [],
}: AdminLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const page = findAdminNavItem(location.pathname);
  const isOverview = page?.path === '/admin';
  const crumbs: (AdminBreadcrumb & { mobileHidden?: boolean })[] = [
    { label: 'PFControl', to: '/' },
    { label: 'Admin', to: '/admin', mobileHidden: true },
    ...(page && !isOverview
      ? [{ label: page.label, to: breadcrumbs.length ? page.path : undefined }]
      : [{ label: 'Overview', to: breadcrumbs.length ? '/admin' : undefined }]),
    ...breadcrumbs,
  ];

  const handleOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!open));
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
        <AdminSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <header className="pointer-events-none sticky top-0 z-20 flex h-14 shrink-0 items-center px-4 md:px-6">
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
