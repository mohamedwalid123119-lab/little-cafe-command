import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/module-page";

export const Route = createFileRoute("/_authenticated/app/pos")({
  head: () => ({
    meta: [
      { title: "نقطة البيع — CAFE OS" },
      { name: "description", content: "تسجيل الطلبات والبيع خلال الوردية." },
      { property: "og:title", content: "نقطة البيع — CAFE OS" },
      { property: "og:description", content: "تسجيل الطلبات والبيع خلال الوردية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ModulePage module="pos" />;
}
