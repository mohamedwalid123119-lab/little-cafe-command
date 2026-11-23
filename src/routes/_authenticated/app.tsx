
import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Languages, Moon, Sun } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { useAppPreferences } from "@/components/app-preferences";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { activeNavItem, NAV_ITEMS } from "@/lib/nav";
import { hasModule, type TenantRole } from "@/lib/permissions";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async ({ context }) => {
    const memberships = await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
    if (memberships.length === 0) throw redirect({ to: "/onboarding", replace: true });
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { language, theme, toggleLanguage, toggleTheme } = useAppPreferences();
  const isArabic = language === "ar";

  const membership = memberships[0];
  const items = membership
    ? NAV_ITEMS.filter((i) => hasModule({ role: membership.role as TenantRole, modules: membership.modules }, i.module))
    : NAV_ITEMS;
  const current = activeNavItem(pathname);
  const tenantName = (membership?.tenant as { name?: string } | null)?.name;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <AppSidebar items={items} onSignOut={signOut} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger />

          <span className="truncate font-semibold">
            {current?.title ?? "CAFE OS"}
          </span>

          {tenantName && (
            <span className="ms-auto truncate text-sm text-muted-foreground">
              {tenantName}
            </span>
          )}

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              title={isArabic ? "Switch to English" : "التغيير إلى العربية"}
              aria-label={isArabic ? "Switch to English" : "التغيير إلى العربية"}
              className="gap-1"
            >
              <Languages className="h-4 w-4" />
              <span>{isArabic ? "EN" : "عربي"}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={
                isArabic
                  ? theme === "light" ? "الوضع الليلي" : "الوضع النهاري"
                  : theme === "light" ? "Dark mode" : "Light mode"
              }
              aria-label={
                isArabic
                  ? theme === "light" ? "الوضع الليلي" : "الوضع النهاري"
                  : theme === "light" ? "Dark mode" : "Light mode"
              }
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
