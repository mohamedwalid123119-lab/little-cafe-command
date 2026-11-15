import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/purchasing")({
  head: () => ({
    meta: [
      { title: "المشتريات — CAFE OS" },
      { name: "description", content: "فواتير الشراء واستلام البضاعة." },
      { property: "og:title", content: "المشتريات — CAFE OS" },
      { property: "og:description", content: "فواتير الشراء واستلام البضاعة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="purchasing" />;
}
