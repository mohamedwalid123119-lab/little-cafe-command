import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Coffee } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — CAFE OS" },
      { name: "description", content: "لوحة تحكم الكافيه في CAFE OS." },
      { property: "og:title", content: "لوحة التحكم — CAFE OS" },
      { property: "og:description", content: "لوحة تحكم الكافيه في CAFE OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppHome,
});

function AppHome() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
        <Coffee className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">أهلاً بك في CAFE OS</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          تم تسجيل الدخول باسم <span dir="ltr">{user.email}</span>. شاشات إدارة الكافيه قيد الإنشاء.
        </p>
        <Button variant="outline" className="mt-5" onClick={signOut}>
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
