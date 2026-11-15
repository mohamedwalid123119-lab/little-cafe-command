import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({
    meta: [
      { title: "المصروفات — CAFE OS" },
      { name: "description", content: "مصروفات الكافيه حسب النوع." },
      { property: "og:title", content: "المصروفات — CAFE OS" },
      { property: "og:description", content: "مصروفات الكافيه حسب النوع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="expenses" />;
}
