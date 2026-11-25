
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Coffee, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { cafeSchema, type CafeInput } from "@/lib/onboarding";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: async ({ context }) => {
    const memberships = await context.queryClient.fetchQuery(
      q.myMemberships(context.user.id),
    );

    if (memberships.length > 0) {
      throw redirect({ to: "/app", replace: true });
    }
  },

  head: () => ({
    meta: [
      { title: "أنشئ الكافيه الخاص بك — CAFE OS" },
      {
        name: "description",
        content: "أنشئ مساحة العمل الخاصة بك وابدأ إدارة الكافيه.",
      },
    ],
  }),

  component: Onboarding,
});

type Errors = Partial<Record<keyof CafeInput, string>>;

function Onboarding() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    const form = new FormData(e.currentTarget);

    const parsed = cafeSchema.safeParse({
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      currency: "EGP",
    });

    if (!parsed.success) {
      const validationErrors: Errors = {};

      for (const issue of parsed.error.issues) {
        validationErrors[issue.path[0] as keyof CafeInput] ??= issue.message;
      }

      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const values = parsed.data;

      const { error } = await supabase.rpc("create_cafe", {
        _name: values.name,
        _currency: "EGP",
        _phone: values.phone,
      });

      if (error) {
        throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ["my-memberships", user.id],
      });

      toast.success("تم إنشاء الكافيه بنجاح");

      await navigate({
        to: "/app",
        replace: true,
      });
    } catch (error) {
      console.error("[Onboarding] Cafe creation failed:", error);
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 font-display text-2xl font-bold text-primary">
          <Coffee className="size-7" />
          CAFE OS
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">
            ابدأ بكافيهك
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            خطوتين فقط وتكون جاهز تبدأ إدارة الكافيه.
          </p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">
                اسم الكافيه <span className="text-destructive">*</span>
              </Label>

              <Input
                id="name"
                name="name"
                dir="auto"
                maxLength={120}
                autoComplete="organization"
                placeholder="مثال: Little Cafe"
                aria-invalid={!!errors.name}
                disabled={busy}
              />

              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                رقم الهاتف أو واتساب{" "}
                <span className="text-destructive">*</span>
              </Label>

              <Input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                maxLength={30}
                autoComplete="tel"
                inputMode="tel"
                placeholder="01xxxxxxxxx"
                aria-invalid={!!errors.phone}
                disabled={busy}
              />

              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}

              <p className="text-xs text-muted-foreground">
                استخدم رقمًا يمكننا التواصل معك من خلاله.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={busy}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "جارٍ إنشاء الكافيه..." : "إنشاء الكافيه"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
