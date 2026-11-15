import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({
    meta: [
      { title: "الموظفين — CAFE OS" },
      { name: "description", content: "فريق العمل والصلاحيات والورديات." },
      { property: "og:title", content: "الموظفين — CAFE OS" },
      { property: "og:description", content: "فريق العمل والصلاحيات والورديات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="employees" />;
}
