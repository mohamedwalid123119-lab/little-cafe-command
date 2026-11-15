import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({
    meta: [
      { title: "المنتجات — CAFE OS" },
      { name: "description", content: "المنتجات والأقسام والأحجام والإضافات." },
      { property: "og:title", content: "المنتجات — CAFE OS" },
      { property: "og:description", content: "المنتجات والأقسام والأحجام والإضافات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="products" />;
}
