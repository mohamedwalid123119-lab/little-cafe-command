
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coffee, Eye, EyeOff, LockKeyhole, ShieldCheck, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "دخول المالك — Little Cafe Command" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerLoginPage,
});

function OwnerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(false);

  async function verifyOwner(userId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (error) {
      setMessage("تعذر التحقق من صلاحيات الحساب. حاول مرة أخرى.");
      return false;
    }

    if (!data) {
      await supabase.auth.signOut();
      setMessage("هذا الحساب لا يملك صلاحية دخول لوحة المالك.");
      return false;
    }

    setAuthorized(true);
    setMessage("");
    return true;
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (data.user) await verifyOwner(data.user.id);
      if (active) setChecking(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      setLoading(false);
      return;
    }

    await verifyOwner(data.user.id);
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAuthorized(false);
    setPassword("");
    setMessage("");
  }

  return (
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1110] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <section className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300 shadow-lg">
            <Coffee className="size-8" />
          </div>
          <p className="text-xs font-semibold tracking-[0.28em] text-amber-300">
            LITTLE CAFE COMMAND
          </p>
          <h1 className="mt-3 text-2xl font-bold">بوابة المالك</h1>
          <p className="mt-2 text-sm text-white/55">
            منطقة إدارية خاصة — الدخول للمصرّح لهم فقط
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {checking ? (
            <div className="py-10 text-center text-sm text-white/60">
              جارٍ التحقق من الجلسة...
            </div>
          ) : authorized ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                <ShieldCheck className="size-7" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  تم التحقق من صلاحية المالك
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  تم تسجيل الدخول بنجاح. سنربط هذه البوابة بلوحة إدارة الكافيهات في الخطوة التالية.
                </p>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                تسجيل الخروج
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-amber-300">
                  <LockKeyhole className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold">تسجيل دخول المالك</h2>
                  <p className="mt-1 text-xs text-white/45">
                    استخدم بريدك وكلمة المرور المسجلين
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="owner-email" className="text-white/80">
                    البريد الإلكتروني
                  </Label>
                  <Input
                    id="owner-email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    dir="ltr"
                    className="h-12 border-white/10 bg-black/20 text-left text-white placeholder:text-white/25 focus-visible:ring-amber-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-password" className="text-white/80">
                    كلمة المرور
                  </Label>
                  <div className="relative">
                    <Input
                      id="owner-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="أدخل كلمة المرور"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      dir="ltr"
                      className="h-12 border-white/10 bg-black/20 pl-12 text-left text-white placeholder:text-white/25 focus-visible:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {message && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm leading-6 text-red-200"
                  >
                    {message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-amber-400 font-semibold text-[#17130a] hover:bg-amber-300 disabled:opacity-60"
                >
                  {loading ? "جارٍ تسجيل الدخول..." : "دخول لوحة المالك"}
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/35">
          <Store className="size-3.5" />
          <span>حساب المالك منفصل عن حسابات الكافيهات والموظفين</span>
        </div>
      </section>
    </main>
  );
}
