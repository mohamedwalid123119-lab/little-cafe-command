import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { activeNavItem, NAV_ITEMS } from "@/lib/nav";
import { hasModule, type TenantRole } from "@/lib/permissions";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/app")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q.myMemberships(context.user.id)),
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
          <span className="truncate font-semibold">{current?.title ?? "CAFE OS"}</span>
          {tenantName && <span className="ms-auto truncate text-sm text-muted-foreground">{tenantName}</span>}
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
