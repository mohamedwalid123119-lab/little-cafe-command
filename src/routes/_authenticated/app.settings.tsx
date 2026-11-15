import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — CAFE OS" },
      { name: "description", content: "إعدادات الكافيه والفروع والاشتراك." },
      { property: "og:title", content: "الإعدادات — CAFE OS" },
      { property: "og:description", content: "إعدادات الكافيه والفروع والاشتراك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="settings" />;
}
