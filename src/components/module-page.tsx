
import { getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useAppPreferences } from "@/components/app-preferences";
import { navItem } from "@/lib/nav";
import { hasModule, type ModuleKey, type TenantRole } from "@/lib/permissions";
import { q } from "@/lib/queries";

const authRoute = getRouteApi("/_authenticated");

/** Standalone page frame for one sidebar section; checks the user's access to that module. */
export function ModulePage({
  module,
  children,
  wide,
}: {
  module: ModuleKey;
  children?: ReactNode;
  wide?: boolean;
}) {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const { language } = useAppPreferences();

  const isArabic = language === "ar";
  const membership = memberships[0];
  const item = navItem(module);

  const allowed =
    !membership ||
    hasModule(
      {
        role: membership.role as TenantRole,
        modules: membership.modules,
      },
      module,
    );

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={`mx-auto w-full p-4 md:p-6 ${wide ? "max-w-7xl" : "max-w-5xl"}`}
    >
      <div className="flex items-start gap-3">
        <item.icon className="mt-1 size-6 shrink-0 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isArabic ? item.title : item.titleEn}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isArabic ? item.description : item.descriptionEn}
          </p>
        </div>
      </div>

      {wide && allowed && membership ? (
        <div className="mt-6">{children}</div>
      ) : (
        <div className="mt-6 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {!allowed ? (
            <p>
              {isArabic
                ? "ليس لديك صلاحية لفتح هذا القسم. اطلب من مالك الكافيه تفعيله لحسابك."
                : "You do not have permission to access this section. Ask the cafe owner to enable it for your account."}
            </p>
          ) : !membership ? (
            <p>
              {isArabic
                ? "لا يوجد كافيه مرتبط بحسابك بعد، لذلك لا توجد بيانات لعرضها في هذا القسم."
                : "No cafe is linked to your account yet, so there is no data to display in this section."}
            </p>
          ) : (
            children ?? (
              <p>
                {isArabic
                  ? "شاشة هذا القسم قيد الإنشاء، وستعرض بيانات كافيهك الحقيقية فور تجهيزها."
                  : "This section is under construction and will display your cafe's actual data once ready."}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
