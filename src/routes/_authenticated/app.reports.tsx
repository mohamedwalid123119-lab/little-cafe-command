import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({
    meta: [
      { title: "التقارير — CAFE OS" },
      { name: "description", content: "تقارير المبيعات والأرباح." },
      { property: "og:title", content: "التقارير — CAFE OS" },
      { property: "og:description", content: "تقارير المبيعات والأرباح." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="reports" />;
}
