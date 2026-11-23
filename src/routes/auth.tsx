import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

type Mode = "choose" | "signup" | "login";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect:
      typeof s.redirect === "string" &&
      s.redirect.startsWith("/") &&
      !s.redirect.startsWith("//")
        ? s.redirect
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — CAFE OS" },
      { name: "description", content: "تسجيل وإدارة الكافيهات" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({
          to: search.redirect ?? "/app",
          replace: true,
        });
      }
    });
  }, [navigate, search.redirect]);

  async function registerCafe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const cafeName = String(form.get("cafeName") ?? "").trim();
    const ownerName = String(form.get("ownerName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const address = String(form.get("address") ?? "").trim();

    if (!cafeName || !ownerName || !phone || !email || !password || !address) {
      toast.error("من فضلك أكمل جميع البيانات");
      return;
    }

    if (password.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }

    setBusy(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          owner_name: ownerName,
          cafe_name: cafeName,
          phone,
          address,
        },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(friendlyError(error));
      return;
    }

    if (!data.session) {
      setBusy(false);
      toast.error(
        "تم إنشاء حساب البريد، لكن تأكيد البريد الإلكتروني ما زال مطلوبًا. لم يتم إنشاء الكافيه."
      );
      return;
    }

    const { error: cafeError } = await supabase.rpc("create_cafe", {
      _name: cafeName,
      _phone: phone,
      _address: address,
      _currency: "EGP",
    });

    if (cafeError) {
      setBusy(false);
      toast.error(friendlyError(cafeError));
      return;
    }

    toast.success("تم إنشاء حساب الكافيه بنجاح");
    navigate({ to: "/app", replace: true });
  }

  async function loginCafe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      toast.error("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setBusy(false);
      toast.error(friendlyError(error));
      return;
    }

    navigate({
      to: search.redirect ?? "/app",
      replace: true,
    });
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#080808] px-4 py-10 text-white"
    >
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-3 text-3xl font-bold text-[#d6b45c]"
        >
          <Coffee className="size-9" />
          CAFE OS
        </Link>

        <div className="rounded-2xl border border-[#6d5525] bg-[#111111] p-6 shadow-2xl sm:p-8">
          {mode === "choose" && (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-[#d6b45c]">
                  أهلاً بك في CAFE OS
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  اختر طريقة المتابعة
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => setMode("signup")}
                  className="h-14 w-full bg-[#d6b45c] text-base font-bold text-black hover:bg-[#bd9b43]"
                >
                  إنشاء كافيه جديد
                </Button>

                <Button
                  onClick={() => setMode("login")}
                  variant="outline"
                  className="h-14 w-full border-[#6d5525] bg-transparent text-base font-bold text-[#d6b45c] hover:bg-[#242018]"
                >
                  لديّ حساب كافيه بالفعل
                </Button>
              </div>
            </>
          )}

          {mode === "signup" && (
            <>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="mb-5 flex items-center gap-2 text-sm text-gray-400 hover:text-[#d6b45c]"
              >
                <ArrowRight className="size-4" />
                رجوع
              </button>

              <h1 className="text-2xl font-bold text-[#d6b45c]">
                تسجيل كافيه جديد
              </h1>
              <p className="mb-6 mt-2 text-sm text-gray-400">
                أدخل بيانات الكافيه والمالك لإنشاء حسابك
              </p>

              <form onSubmit={registerCafe} className="space-y-4">
                <Field label="اسم الكافيه" name="cafeName">
                  <Input name="cafeName" required maxLength={120} />
                </Field>

                <Field label="اسم المالك" name="ownerName">
                  <Input name="ownerName" required maxLength={120} />
                </Field>

                <Field label="رقم الهاتف" name="phone">
                  <Input
                    name="phone"
                    type="tel"
                    dir="ltr"
                    required
                    maxLength={30}
                    placeholder="01xxxxxxxxx"
                  />
                </Field>

                <Field label="البريد الإلكتروني Gmail" name="email">
                  <Input
                    name="email"
                    type="email"
                    dir="ltr"
                    required
                    autoComplete="email"
                  />
                </Field>

                <Field label="كلمة المرور" name="password">
                  <Input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field>

                <Field label="عنوان الكافيه" name="address">
                  <Input name="address" required maxLength={200} />
                </Field>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-12 w-full bg-[#d6b45c] font-bold text-black hover:bg-[#bd9b43]"
                >
                  {busy && <Loader2 className="ml-2 size-4 animate-spin" />}
                  إنشاء حساب الكافيه
                </Button>
              </form>
            </>
          )}

          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="mb-5 flex items-center gap-2 text-sm text-gray-400 hover:text-[#d6b45c]"
              >
                <ArrowRight className="size-4" />
                رجوع
              </button>

              <h1 className="text-2xl font-bold text-[#d6b45c]">
                دخول الكافيه
              </h1>
              <p className="mb-6 mt-2 text-sm text-gray-400">
                سجل الدخول بالبريد الإلكتروني وكلمة المرور
              </p>

              <form onSubmit={loginCafe} className="space-y-4">
                <Field label="البريد الإلكتروني" name="email">
                  <Input
                    name="email"
                    type="email"
                    dir="ltr"
                    required
                    autoComplete="email"
                  />
                </Field>

                <Field label="كلمة المرور" name="password">
                  <Input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-12 w-full bg-[#d6b45c] font-bold text-black hover:bg-[#bd9b43]"
                >
                  {busy && <Loader2 className="ml-2 size-4 animate-spin" />}
                  تسجيل الدخول
                </Button>
              </form>
            </>
          )}

          <div className="mt-7 border-t border-gray-800 pt-5 text-center text-xs text-gray-500">
            CAFE OS — نظام إدارة الكافيهات
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-gray-300">
        {label}
      </Label>
      {children}
    </div>
  );
}