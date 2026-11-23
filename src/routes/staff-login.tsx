
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coffee, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

export const Route = createFileRoute("/staff-login")({
  component: StaffLoginPage,
});

function StaffLoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !password) {
      toast.error("اكتب اسم المستخدم وكلمة المرور");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: `${cleanUsername}@staff.cafeos.invalid`,
      password,
    });

    setBusy(false);

    if (error) {
      toast.error("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }

    navigate({ to: "/app", replace: true });
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#080808] px-4 py-10 text-white"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-3xl font-bold text-[#d6b45c]">
          <Coffee className="size-9" />
          CAFE OS
        </div>

        <div className="rounded-2xl border border-[#6d5525] bg-[#111111] p-7 shadow-2xl">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold text-[#d6b45c]">
              دخول الموظفين
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              سجّل الدخول باستخدام بيانات حسابك
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اكتب اسم المستخدم"
                required
                autoComplete="username"
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
                placeholder="اكتب كلمة المرور"
                required
                autoComplete="current-password"
                className="border-gray-700 bg-[#080808] text-white"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full bg-[#d6b45c] font-bold text-black hover:bg-[#bd9b43]"
            >
              {busy ? (
                <Loader2 className="ml-2 size-4 animate-spin" />
              ) : null}
              تسجيل الدخول
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
