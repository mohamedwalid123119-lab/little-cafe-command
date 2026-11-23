
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Coffee, Eye, EyeOff, LockKeyhole, ShieldCheck, Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const OWNER_EMAIL = "Mohamedwalid123119@gmail.com";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "بوابة المالك — Little Cafe Command" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerPage,
});

function OwnerPage() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");

  async function verifyOwner(userId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      setAuthorized(false);
      setMessage("الحساب لم يحصل على صلاحية المالك حتى الآن.");
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

    if (email.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      setMessage("التسجيل متاح لبريد المالك المحدد فقط.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: OWNER_EMAIL,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/owner`,
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("تم إنشاء الحساب. راجع بريدك الإلكتروني واضغط رابط التأكيد، ثم ارجع إلى هنا لتسجيل الدخول.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: OWNER_EMAIL,
        password,
      });

      if (error || !data.user) {
        setMessage("تعذر تسجيل الدخول. راجع البريد وكلمة المرور وتأكيد البريد.");
      } else {
        await verifyOwner(data.user.id);
      }
    }

    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setAuthorized(false);
    setPassword("");
    setMode("login");
    setMessage("");
  }

  return (
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1110] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <section className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
            <Coffee className="size-8" />
          </div>
          <p className="text-xs font-semibold tracking-[0.28em] text-amber-300">
            LITTLE CAFE COMMAND
          </p>
          <h1 className="mt-3 text-2xl font-bold">بوابة المالك</h1>
          <p className="mt-2 text-sm text-white/55">
            منطقة إدارية خاصة بالمالك
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl sm:p-8">
          {checking ? (
            <p className="py-10 text-center text-sm text-white/60">
              جارٍ التحقق...
            </p>
          ) : authorized ? (
            <div className="space-y-5 text-center">
              <ShieldCheck className="mx-auto size-12 text-emerald-300" />
              <h2 className="text-xl font-semibold">تم تسجيل دخول المالك</h2>
              <p className="text-sm text-white/55">
                تم التحقق من صلاحيات حسابك.
              </p>
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                تسجيل الخروج
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <LockKeyhole className="size-6 text-amber-300" />
                <div>
                  <h2 className="font-semibold">
                    {mode === "signup" ? "إنشاء حساب المالك" : "تسجيل دخول المالك"}
                  </h2>
                  <p className="mt-1 text-xs text-white/45">
                    {mode === "signup" ? "إنشاء الحساب لأول مرة" : "ادخل بيانات حسابك"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="owner-email">البريد الإلكتروني</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={email}
                    readOnly
                    dir="ltr"
                    className="h-12 border-white/10 bg-black/20 text-left text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-password">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="owner-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="8 أحرف على الأقل"
                      dir="ltr"
                      className="h-12 border-white/10 bg-black/20 pl-12 text-left text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {message && (
                  <p role="alert" className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-3 text-sm leading-6 text-amber-100">
                    {message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-amber-400 font-semibold text-black hover:bg-amber-300"
                >
                  {loading
                    ? "جارٍ التنفيذ..."
                    : mode === "signup"
                      ? "إنشاء حساب المالك"
                      : "تسجيل الدخول"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setMessage("");
                  setPassword("");
                }}
                className="mt-5 w-full text-center text-sm text-amber-300 hover:text-amber-200"
              >
                {mode === "signup"
                  ? "لدي حساب بالفعل — تسجيل الدخول"
                  : "إنشاء حساب المالك لأول مرة"}
              </button>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/35">
          <Store size={14} />
          <span>حساب المالك منفصل عن حسابات الكافيهات والموظفين</span>
        </div>
      </section>
    </main>
  );
}
