
import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { friendlyError } from "@/lib/errors";

type OAuthProvider = "google" | "lovable";

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

  const [isRegister, setIsRegister] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleOAuth(provider: OAuthProvider) {
    setBusy(true);

    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });

      if (result.redirected) return;

      if (result.error) throw result.error;

      toast.success("تم تسجيل الدخول بنجاح");

      navigate({
        to: search.redirect ?? "/app",
        replace: true,
      });
    } catch (error) {
      toast.error(
        friendlyError(error as Parameters<typeof friendlyError>[0]),
      );
      setBusy(false);
    }
  }

  async function submitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
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

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          toast.error(
            "تم إنشاء الحساب، لكن تأكيد البريد لا يزال مفعلاً في إعدادات المصادقة.",
          );
          return;
        }

        toast.success("تم إنشاء حسابك بنجاح");
        navigate({ to: "/onboarding", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("تم تسجيل الدخول بنجاح");

      navigate({
        to: search.redirect ?? "/app",
        replace: true,
      });
    } catch (error) {
      toast.error(
        friendlyError(error as Parameters<typeof friendlyError>[0]),
      );
    } finally {
      setBusy(false);
    }
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
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#d6b45c]">
              {isRegister ? "إنشاء حساب كافيه جديد" : "أهلاً بك مجدداً"}
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              {isRegister
                ? "أنشئ حسابك وابدأ إدارة الكافيه"
                : "سجل دخولك للمتابعة"}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              disabled={busy}
              onClick={() => handleOAuth("google")}
              className="h-12 w-full bg-white font-bold text-black hover:bg-gray-200"
            >
              {busy ? (
                <Loader2 className="ml-2 size-4 animate-spin" />
              ) : (
                <span className="ml-2 text-lg font-black">G</span>
              )}
              المتابعة باستخدام Google
            </Button>

            <Button
              type="button"
              disabled={busy}
              onClick={() => handleOAuth("lovable")}
              variant="outline"
              className="h-12 w-full border-[#6d5525] bg-[#181818] font-bold text-white hover:bg-[#252525] hover:text-white"
            >
              المتابعة باستخدام Lovable
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-xs text-gray-500">أو بالبريد الإلكتروني</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <form onSubmit={submitEmail} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">
                البريد الإلكتروني Gmail
              </Label>

              <Input
                name="email"
                type="email"
                dir="ltr"
                required
                autoComplete="email"
                placeholder="example@gmail.com"
                className="bg-[#080808] text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">
                كلمة مرور CAFE OS
              </Label>

              <Input
                name="password"
                type="password"
                required
                minLength={isRegister ? 8 : undefined}
                autoComplete={
                  isRegister ? "new-password" : "current-password"
                }
                placeholder="********"
                className="bg-[#080808] text-white"
              />

              {isRegister && (
                <p className="text-xs text-gray-500">
                  أنشئ كلمة مرور خاصة بالنظام لا تقل عن 8 أحرف.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-14 w-full bg-[#d6b45c] text-base font-bold text-black hover:bg-[#bd9b43]"
            >
              {busy && <Loader2 className="ml-2 size-4 animate-spin" />}
              {isRegister ? "إنشاء الحساب والمتابعة" : "تسجيل الدخول"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            {isRegister
              ? "لديك حساب بالفعل؟"
              : "أول مرة تستخدم النظام؟"}

            <button
              type="button"
              disabled={busy}
              onClick={() => setIsRegister((value) => !value)}
              className="mr-2 font-bold text-[#d6b45c] hover:underline"
            >
              {isRegister ? "تسجيل الدخول" : "إنشاء حساب"}
            </button>
          </div>

          <div className="mt-7 border-t border-gray-800 pt-5 text-center text-xs text-gray-500">
            CAFE OS — نظام إدارة الكافيهات
          </div>
        </div>
      </div>
    </main>
  );
}
