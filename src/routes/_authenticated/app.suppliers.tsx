import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردين — CAFE OS" },
      { name: "description", content: "بيانات موردي الكافيه." },
      { property: "og:title", content: "الموردين — CAFE OS" },
      { property: "og:description", content: "بيانات موردي الكافيه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="suppliers" />;
}
