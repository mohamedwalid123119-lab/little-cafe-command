import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/inventory")({
  head: () => ({
    meta: [
      { title: "المخزون — CAFE OS" },
      { name: "description", content: "الخامات والكميات المتاحة وتنبيهات النقص." },
      { property: "og:title", content: "المخزون — CAFE OS" },
      { property: "og:description", content: "الخامات والكميات المتاحة وتنبيهات النقص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="inventory" />;
}
