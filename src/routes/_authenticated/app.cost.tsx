import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/cost")({
  head: () => ({
    meta: [
      { title: "التكلفة والأرباح — CAFE OS" },
      { name: "description", content: "تكلفة كل منتج وهامش الربح والسعر المقترح." },
      { property: "og:title", content: "التكلفة والأرباح — CAFE OS" },
      { property: "og:description", content: "تكلفة كل منتج وهامش الربح والسعر المقترح." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="cost" />;
}
