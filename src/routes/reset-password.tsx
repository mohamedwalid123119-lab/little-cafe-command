import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — CAFE OS" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في CAFE OS." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — CAFE OS" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك في CAFE OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && isRecovery) setReady(true);
      else if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== String(f.get("confirm"))) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("تم تغيير كلمة المرور");
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">تعيين كلمة مرور جديدة</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور الجديدة</Label>
              <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
              <Input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <Button className="w-full" disabled={busy}>حفظ</Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            افتح هذه الصفحة من الرابط المرسل إلى بريدك الإلكتروني. إذا انتهت صلاحية الرابط، اطلب رابطاً جديداً من صفحة تسجيل الدخول.
          </p>
        )}
      </div>
    </div>
  );
}
