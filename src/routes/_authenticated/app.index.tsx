import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — CAFE OS" },
      { name: "description", content: "ملخص مبيعات وأرباح ومصروفات ومخزون الكافيه." },
      { property: "og:title", content: "لوحة التحكم — CAFE OS" },
      { property: "og:description", content: "ملخص مبيعات وأرباح ومصروفات ومخزون الكافيه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <p className="mx-auto w-full max-w-5xl px-4 pt-4 text-sm text-muted-foreground md:px-6">
        تم تسجيل الدخول باسم <span dir="ltr">{user.email}</span>
      </p>
      <ModulePage module="dashboard" />
    </>
  );
}
