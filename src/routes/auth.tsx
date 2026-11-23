
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: search.redirect ?? "/app", replace: true });
      }
    });
  }, [navigate, search.redirect]);

  async function continueWithGoogle() {
    setBusy(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${search.redirect ?? "/app"}`,
      },
    });

    if (error) {
      setBusy(false);
      toast.error(friendlyError(error));
    }
  }

  async function submitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      toast.error("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    if (isRegister && password.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }

    setBusy(true);

    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      setBusy(false);

      if (error) {
        toast.error(friendlyError(error));
        return;
      }

      if (!data.session) {
        toast.error(
          "الحساب اتسجل، لكن Supabase ما زال يطلب تأكيد البريد. راجع إعداد Confirm Email."
        );
        return;
      }

      toast.success("تم إنشاء الحساب. أكمل بيانات الكافيه.");
      navigate({ to: "/app", replace: true });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);

    if (error) {
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
          {!showEmailForm ? (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-[#d6b45c]">
                  أهلاً بك في CAFE OS
                </h1>

                <p className="mt-2 text-sm text-gray-400">
                  سجل دخولك أو أنشئ حسابك للمتابعة
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={continueWithGoogle}
                  disabled={busy}
                  className="h-14 w-full bg-[#d6b45c] text-base font-bold text-black hover:bg-[#bd9b43]"
                >
                  {busy && (
                    <Loader2 className="ml-2 size-4 animate-spin" />
                  )}
                  المتابعة باستخدام Google
                </Button>

                <Button
                  onClick={() => setShowEmailForm(true)}
                  variant="outline"
                  className="h-14 w-full border-[#6d5525] bg-transparent text-base font-bold text-[#d6b45c] hover:bg-[#242018]"
                >
                  المتابعة باستخدام Gmail وكلمة مرور
                </Button>
              </div>

              <p className="mt-5 text-center text-xs text-gray-500">
                لن نطلب منك كلمة مرور Gmail؛ استخدم كلمة مرور خاصة بنظام CAFE OS.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(false);
                  setIsRegister(false);
                }}
                className="mb-5 flex items-center gap-2 text-sm text-gray-400 hover:text-[#d6b45c]"
              >
                <ArrowRight className="size-4" />
                رجوع
              </button>

              <h1 className="text-2xl font-bold text-[#d6b45c]">
                {isRegister ? "إنشاء حساب جديد" : "تسجيل الدخول"}
              </h1>

              <p className="mb-6 mt-2 text-sm text-gray-400">
                {isRegister
                  ? "اكتب بريدك وأنشئ كلمة مرور خاصة بالنظام"
                  : "أدخل بريدك وكلمة مرور CAFE OS"}
              </p>

              <form onSubmit={submitEmail} className="space-y-4">
                <Field label="البريد الإلكتروني Gmail" name="email">
                  <Input
                    name="email"
                    type="email"
                    dir="ltr"
                    required
                    autoComplete="email"
                  />
                </Field>

                <Field label="كلمة مرور CAFE OS" name="password">
                  <Input
                    name="password"
                    type="password"
                    required
                    minLength={isRegister ? 8 : undefined}
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={busy}
                  className="h-12 w-full bg-[#d6b45c] font-bold text-black hover:bg-[#bd9b43]"
                >
                  {busy && (
                    <Loader2 className="ml-2 size-4 animate-spin" />
                  )}
                  {isRegister
                    ? "إنشاء الحساب والمتابعة"
                    : "تسجيل الدخول"}
                </Button>
              </form>

              <div className="mt-5 text-center text-sm text-gray-400">
                {isRegister
                  ? "لديك حساب بالفعل؟"
                  : "أول مرة تستخدم النظام؟"}

                <button
                  type="button"
                  onClick={() => setIsRegister((value) => !value)}
                  className="mr-2 font-bold text-[#d6b45c] hover:underline"
                >
                  {isRegister ? "تسجيل الدخول" : "إنشاء حساب"}
                </button>
              </div>
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
