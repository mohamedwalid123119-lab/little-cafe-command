
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

type AuthSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: safeRedirect(s["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — CAFE OS" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة الكافيهات",
      },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : undefined;
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const target = search.redirect ?? "/app";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: target, replace: true });
      }
    });

    const { data } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          navigate({ to: target, replace: true });
        }
      }
    );

    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function signInWithGoogle() {
    setBusy(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + target,
      },
    });

    if (error) {
      setBusy(false);
      toast.error(friendlyError(error));
    }
  }

  async function signInWithEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      toast.error(friendlyError(error));
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

        <div className="rounded-2xl border border-[#6d5525] bg-[#111111] p-7 shadow-2xl">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold text-[#d6b45c]">
              تسجيل الدخول
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              نظام إدارة الكافيهات
            </p>
          </div>

          <Button
            type="button"
            disabled={busy}
            onClick={signInWithGoogle}
            className="h-12 w-full bg-[#d6b45c] font-bold text-black hover:bg-[#bd9b43]"
          >
            {busy ? (
              <Loader2 className="ml-2 size-4 animate-spin" />
            ) : null}
            المتابعة باستخدام Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-gray-500">
            <div className="h-px flex-1 bg-gray-700" />
            أو تسجيل الدخول بالبريد الإلكتروني
            <div className="h-px flex-1 bg-gray-700" />
          </div>

          <form onSubmit={signInWithEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="border-gray-700 bg-[#080808] text-white"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="border-gray-700 bg-[#080808] text-white"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-11 w-full border border-[#6d5525] bg-transparent text-[#d6b45c] hover:bg-[#242018]"
            >
              دخول
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            CAFE OS — نظام إدارة الكافيهات
          </p>
        </div>
      </div>
    </main>
  );
}
