import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

type AuthSearch = { mode?: "signin" | "signup" | "forgot"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signup" || s.mode === "forgot" ? s.mode : undefined,
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — CAFE OS" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً جديداً في CAFE OS لإدارة الكافيه." },
      { property: "og:title", content: "تسجيل الدخول — CAFE OS" },
      { property: "og:description", content: "سجّل الدخول أو أنشئ حساباً جديداً في CAFE OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>(search.mode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [sentConfirm, setSentConfirm] = useState<string | null>(null);
  const target = search.redirect ?? "/app";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: target, replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: target, replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) toast.error(friendlyError(error));
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    const email = String(f.get("email")).trim();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/app", data: { full_name: String(f.get("full_name")).trim() } },
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    if (!data.session) setSentConfirm(email);
  }

  async function forgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(f.get("email")).trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك");
  }

  async function oauth(provider: "google" | "lovable") {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    setBusy(false);
    if (res && "error" in res && res.error) toast.error(friendlyError(res.error));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-display text-2xl font-bold text-primary">
          <Coffee className="size-7" /> CAFE OS
        </Link>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {sentConfirm ? (
            <div className="space-y-3 text-center">
              <h1 className="text-xl font-semibold">راجع بريدك الإلكتروني</h1>
              <p className="text-sm text-muted-foreground">
                أرسلنا رابط تأكيد إلى <span className="font-medium text-foreground">{sentConfirm}</span>. اضغط على الرابط لتفعيل حسابك ثم سجّل الدخول.
              </p>
              <Button variant="outline" onClick={() => { setSentConfirm(null); setTab("signin"); }}>
                رجوع لتسجيل الدخول
              </Button>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>

              <div className="mt-5 grid gap-2">
                <Button variant="outline" disabled={busy} onClick={() => oauth("google")}>
                  المتابعة باستخدام Google
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => oauth("lovable")}>
                  المتابعة باستخدام Lovable
                </Button>
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> أو بالبريد الإلكتروني <div className="h-px flex-1 bg-border" />
              </div>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4">
                  <Field label="البريد الإلكتروني" name="email" type="email" autoComplete="email" />
                  <Field label="كلمة المرور" name="password" type="password" autoComplete="current-password" />
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />} دخول
                  </Button>
                  <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => setTab("forgot")}>
                    نسيت كلمة المرور؟
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4">
                  <Field label="الاسم" name="full_name" autoComplete="name" />
                  <Field label="البريد الإلكتروني" name="email" type="email" autoComplete="email" />
                  <Field label="كلمة المرور (8 أحرف على الأقل)" name="password" type="password" autoComplete="new-password" minLength={8} />
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />} إنشاء حساب
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="forgot">
                <form onSubmit={forgot} className="space-y-4">
                  <p className="text-sm text-muted-foreground">اكتب بريدك وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.</p>
                  <Field label="البريد الإلكتروني" name="email" type="email" autoComplete="email" />
                  <Button type="submit" className="w-full" disabled={busy}>
                    إرسال الرابط
                  </Button>
                  <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => setTab("signin")}>
                    رجوع لتسجيل الدخول
                  </button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required dir="auto" {...props} />
    </div>
  );
}
