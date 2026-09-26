import { Fragment, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { TowerControl, type LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

export type DashboardNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

export type DashboardNavSection = {
  title: string;
  items: DashboardNavItem[];
};

type DashboardSidebarProps = {
  product: ReactNode;
  homePath: string;
  sections: DashboardNavSection[];
};

export default function DashboardSidebar({
  product,
  homePath,
  sections,
}: DashboardSidebarProps) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const current = location.pathname.replace(/\/+$/, '') || homePath;

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          to={homePath}
          onClick={closeOnMobile}
          className="flex h-8 items-center gap-2 rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <TowerControl className="size-5 shrink-0 text-blue-400" />
          <span className="truncate bg-linear-to-r from-blue-400 to-blue-600 bg-clip-text text-lg font-bold text-transparent group-data-[collapsible=icon]:hidden">
            PFControl{' '}
            <span className="bg-linear-to-r from-blue-300 to-blue-500 bg-clip-text text-base text-transparent italic">
              {product}
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section, i) => (
          <Fragment key={section.title}>
            {i > 0 ? <SidebarSeparator className="mx-4" /> : null}
            <SidebarGroup aria-label={section.title}>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={current === item.path}
                        tooltip={item.label}
                        className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground data-[active=true]:[&>svg]:text-blue-400"
                      >
                        <Link to={item.path} onClick={closeOnMobile}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
