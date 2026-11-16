import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
import { dateOnly } from "@/lib/format";
import { ROLE_LABELS, type TenantRole } from "@/lib/permissions";
import { q } from "@/lib/queries";

const TENANT_STATUS_LABELS: Record<string, string> = {
  trial: "فترة تجريبية",
  active: "نشط",
  suspended: "موقوف",
  cancelled: "ملغي",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: "فترة تجريبية",
  active: "نشط",
  past_due: "متأخر السداد",
  suspended: "موقوف",
  cancelled: "ملغي",
  expired: "منتهي",
};

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — CAFE OS" },
      { name: "description", content: "ملخص مبيعات وأرباح ومصروفات ومخزون الكافيه." },
      { property: "og:title", content: "لوحة التحكم — CAFE OS" },
      { property: "og:description", content: "ملخص مبيعات وأرباح ومصروفات ومخزون الكافيه." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const memberships = await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
    const tenantId = memberships[0]?.tenant_id;
    if (!tenantId) return;
    await Promise.all([
      context.queryClient.ensureQueryData(q.tenant(tenantId)),
      context.queryClient.ensureQueryData(q.branches(tenantId)),
      context.queryClient.ensureQueryData(q.subscription(tenantId)),
    ]);
  },
  component: Page,
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto w-full max-w-5xl p-4 text-sm text-destructive md:p-6">
      تعذّر تحميل بيانات الكافيه: {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">لا توجد بيانات.</div>,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  return (
    <>
      <p className="mx-auto w-full max-w-5xl px-4 pt-4 text-sm text-muted-foreground md:px-6">
        تم تسجيل الدخول باسم <span dir="ltr">{user.email}</span>
      </p>
      <ModulePage module="dashboard">
        {membership && <CafeInfo tenantId={membership.tenant_id} role={membership.role as TenantRole} />}
      </ModulePage>
    </>
  );
}

function CafeInfo({ tenantId, role }: { tenantId: string; role: TenantRole }) {
  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));
  const { data: branches } = useSuspenseQuery(q.branches(tenantId));
  const { data: subscription } = useSuspenseQuery(q.subscription(tenantId));

  const mainBranch = branches.find((b) => b.is_main) ?? branches[0];
  const activeBranches = branches.filter((b) => b.is_active).length;
  const plan = (subscription?.plan as { name_ar?: string } | null) ?? null;

  const rows: { label: string; value: string; ltr?: boolean }[] = [
    { label: "الهاتف", value: tenant.phone || mainBranch?.phone || "—", ltr: true },
    { label: "العنوان", value: mainBranch?.address || tenant.city || "—" },
    { label: "العملة", value: tenant.currency },
    { label: "حالة الكافيه", value: TENANT_STATUS_LABELS[tenant.status] ?? tenant.status },
    { label: "دورك", value: ROLE_LABELS[role] ?? role },
    { label: "الفروع النشطة", value: String(activeBranches) },
    { label: "الفرع الرئيسي", value: mainBranch?.name ?? "—" },
    { label: "تاريخ الإنشاء", value: dateOnly(tenant.created_at) },
  ];
  if (subscription) {
    rows.push({ label: "الباقة", value: plan?.name_ar ?? "—" });
    rows.push({ label: "حالة الاشتراك", value: SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status });
    if (subscription.status === "trialing") rows.push({ label: "تنتهي التجربة في", value: dateOnly(subscription.trial_ends_at) });
  }

  return (
    <div className="text-foreground">
      <h2 className="text-xl font-bold">{tenant.name}</h2>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="mt-0.5 truncate font-medium" dir={r.ltr ? "ltr" : undefined} style={r.ltr ? { textAlign: "right" } : undefined}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
