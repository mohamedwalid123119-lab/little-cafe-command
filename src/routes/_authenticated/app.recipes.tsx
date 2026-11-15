import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/recipes")({
  head: () => ({
    meta: [
      { title: "الريسبيات — CAFE OS" },
      { name: "description", content: "الريسبيات والتحضيرات ومكوناتها." },
      { property: "og:title", content: "الريسبيات — CAFE OS" },
      { property: "og:description", content: "الريسبيات والتحضيرات ومكوناتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="recipes" />;
}
