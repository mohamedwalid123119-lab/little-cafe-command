
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Coffee, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppPreferences } from "@/components/app-preferences";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { CURRENCIES, cafeSchema, type CafeInput } from "@/lib/onboarding";
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
        content: "سجّل بيانات الكافيه الخاص بك لتبدأ استخدام CAFE OS.",
      },
      { property: "og:title", content: "أنشئ الكافيه الخاص بك — CAFE OS" },
      {
        property: "og:description",
        content: "سجّل بيانات الكافيه الخاص بك لتبدأ استخدام CAFE OS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

type Errors = Partial<Record<keyof CafeInput, string>>;

function Onboarding() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { language } = useAppPreferences();

  const en = language === "en";
  const t = (ar: string, english: string) => en ? english : ar;
  const direction = en ? "ltr" : "rtl";

  const [currency, setCurrency] = useState<string>("EGP");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    const parsed = cafeSchema.safeParse({
      name: String(f.get("name") ?? ""),
      phone: String(f.get("phone") ?? ""),
      address: String(f.get("address") ?? ""),
      currency,
    });

    if (!parsed.success) {
      const errs: Errors = {};

      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as keyof CafeInput] ??= issue.message;
      }

      setErrors(errs);
      return;
    }

    setErrors({});
    setBusy(true);

    const v = parsed.data;

    const { error } = await supabase.rpc("create_cafe", {
      _name: v.name,
      _currency: v.currency,
      ...(v.phone ? { _phone: v.phone } : {}),
      ...(v.address ? { _address: v.address } : {}),
    });

    if (error) {
      setBusy(false);
      toast.error(friendlyError(error));
      return;
    }

    await queryClient.fetchQuery(q.myMemberships(user.id));

    toast.success(
      t("تم إنشاء الكافيه بنجاح", "Cafe created successfully"),
    );

    navigate({ to: "/app", replace: true });
  }

  return (
    <div
      dir={direction}
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2 font-display text-2xl font-bold text-primary">
          <Coffee className="size-7" />
          CAFE OS
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">
            {t("أنشئ الكافيه الخاص بك", "Create Your Cafe")}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "اكتب بيانات الكافيه للبدء. ستكون أنت المالك، ويمكنك تعديل الاسم والهاتف لاحقاً من الإعدادات.",
              "Enter your cafe details to get started. You will be the owner and can update the name and phone number later from settings.",
            )}
          </p>

          <form
            onSubmit={submit}
            noValidate
            className="mt-6 space-y-4"
          >
            <Field
              label={t("اسم الكافيه", "Cafe Name")}
              name="name"
              error={errors.name}
              required
            >
              <Input
                id="name"
                name="name"
                dir="auto"
                maxLength={120}
                autoComplete="organization"
                aria-invalid={!!errors.name}
                placeholder={t("اكتب اسم الكافيه", "Enter cafe name")}
              />
            </Field>

            <Field
              label={t("العنوان", "Address")}
              name="address"
              error={errors.address}
              hint={t(
                "اختياري — عنوان الفرع الرئيسي",
                "Optional — Main branch address",
              )}
            >
              <Input
                id="address"
                name="address"
                dir="auto"
                maxLength={200}
                autoComplete="street-address"
                aria-invalid={!!errors.address}
                placeholder={t("عنوان الكافيه", "Cafe address")}
              />
            </Field>

            <Field
              label={t("رقم الهاتف", "Phone Number")}
              name="phone"
              error={errors.phone}
              hint={t("اختياري", "Optional")}
            >
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
              />
            </Field>

            <Field
              label={t("العملة", "Currency")}
              name="currency"
              error={errors.currency}
              hint={t(
                "لا يمكن تغيير العملة بعد إنشاء الكافيه",
                "Currency cannot be changed after creating the cafe",
              )}
            >
              <Select
                value={currency}
                onValueChange={setCurrency}
              >
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={busy}
            >
              {busy && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {busy
                ? t("جارٍ إنشاء الكافيه...", "Creating Cafe...")
                : t("إنشاء الكافيه", "Create Cafe")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && (
          <span className="text-destructive"> *</span>
        )}
      </Label>

      {children}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
