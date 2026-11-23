
import { Link, useRouterState } from "@tanstack/react-router";
import { Coffee, LogOut } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppPreferences } from "@/components/app-preferences";
import { activeNavItem, type NavItem } from "@/lib/nav";

export function AppSidebar({ items, onSignOut }: { items: NavItem[]; onSignOut: () => void }) {
  const { setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeNavItem(pathname);
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  const signOutLabel = isArabic ? "تسجيل الخروج" : "Sign out";

  return (
    <Sidebar side={isArabic ? "right" : "left"} collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 font-display text-lg font-bold text-sidebar-primary">
          <Coffee className="size-5 shrink-0" />
          <span className="truncate group-data-[collapsible=icon]:hidden">CAFE OS</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.module}>
                  <SidebarMenuButton
                    asChild
                    isActive={active?.module === item.module}
                    tooltip={item.title}
                  >
                    <Link
                      to={item.path}
                      onClick={() => setOpenMobile(false)}
                      aria-current={active?.module === item.module ? "page" : undefined}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} tooltip={signOutLabel}>
              <LogOut />
              <span>{signOutLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
