
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChefHat,
  ChevronDown,
  Coffee,
  CreditCard,
  LayoutDashboard,
  Loader2,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { friendlyError } from "@/lib/errors";
import heroCoffee from "@/assets/hero-coffee.jpg";

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
      { title: "Little Cafe Command | إدارة كافيهك بذكاء" },
      {
        name: "description",
        content: "نظام متكامل لإدارة المبيعات والمخازن والموظفين والتكاليف والتقارير.",
      },
    ],
  }),
  component: AuthPage,
});

const features = [
  {
    icon: ShoppingBag,
    title: "نقطة البيع والكاشير",
    description: "استقبل الطلبات وسجل المبيعات وتابع الفواتير من شاشة تشغيل منظمة.",
  },
  {
    icon: Package,
    title: "إدارة المخازن",
    description: "تابع الخامات والمنتجات والكميات وحركة المخزون.",
  },
  {
    icon: ChefHat,
    title: "الريسبيات والتكلفة",
    description: "احسب تكلفة المكونات وتابع تكلفة كل منتج وهامش ربحه.",
  },
  {
    icon: Users,
    title: "إدارة الموظفين",
    description: "أنشئ حسابات فريق العمل وحدد صلاحيات كل موظف.",
  },
  {
    icon: Wallet,
    title: "المصروفات والمشتريات",
    description: "سجل المصروفات والمشتريات وتابع الحركة المالية.",
  },
  {
    icon: BarChart3,
    title: "التقارير والتحليلات",
    description: "راجع المبيعات والتكاليف والمصروفات ونتائج التشغيل.",
  },
  {
    icon: CreditCard,
    title: "إدارة الموردين",
    description: "نظم بيانات الموردين وسجل عمليات الشراء.",
  },
  {
    icon: LayoutDashboard,
    title: "لوحة تحكم موحدة",
    description: "تابع أقسام الكافيه من واجهة واحدة.",
  },
];

const faqs = [
  {
    q: "هل أحتاج إلى خبرة في الكمبيوتر؟",
    a: "واجهة النظام مصممة لتكون واضحة وسهلة الاستخدام، ويمكنك التعرف على الأقسام تدريجيًا.",
  },
  {
    q: "كيف أبدأ استخدام النظام؟",
    a: "أنشئ حسابك، ثم استكمل إعداد بيانات الكافيه وأضف المنتجات والخامات والموظفين.",
  },
  {
    q: "هل يمكن إضافة موظفين؟",
    a: "يمكنك إدارة حسابات الموظفين وتحديد الصلاحيات المتاحة لكل دور من داخل النظام.",
  },
  {
    q: "هل يمكن استخدام النظام من الهاتف؟",
    a: "واجهة النظام تتكيف مع أحجام الشاشات المختلفة.",
  },
  {
    q: "هل أستطيع متابعة المخزون والمبيعات معًا؟",
    a: "النظام يحتوي على أقسام للمبيعات والمخازن والمشتريات والتقارير.",
  },
];

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [isRegister, setIsRegister] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 260);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openRegistration = () => {
    document.getElementById("account")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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
    <main dir="rtl" className="min-h-screen overflow-hidden bg-background text-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 md:px-8">
          <Link to="/auth" className="flex items-center gap-2 text-xl font-bold text-primary">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Coffee className="size-6" />
            </span>
            <span>
              LITTLE CAFE
              <span className="block text-[10px] font-medium tracking-[3px] text-muted-foreground">
                COMMAND
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#features" className="hover:text-primary">المميزات</a>
            <a href="#how" className="hover:text-primary">كيف يعمل؟</a>
            <a href="#benefits" className="hover:text-primary">الفوائد</a>
            <a href="#faq" className="hover:text-primary">الأسئلة الشائعة</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button
              variant="ghost"
              onClick={() => {
                setIsRegister(false);
                openRegistration();
              }}
            >
              تسجيل الدخول
            </Button>
            <Button onClick={() => {
              setIsRegister(true);
              openRegistration();
            }}>
              ابدأ الآن <ArrowLeft className="mr-2 size-4" />
            </Button>
          </div>

          <button
            type="button"
            aria-label="القائمة"
            onClick={() => setMobileMenu(!mobileMenu)}
            className="rounded-lg border p-2 lg:hidden"
          >
            {mobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="border-t bg-background px-5 py-5 lg:hidden">
            <nav className="flex flex-col gap-5 text-sm">
              <a href="#features" onClick={() => setMobileMenu(false)}>المميزات</a>
              <a href="#how" onClick={() => setMobileMenu(false)}>كيف يعمل؟</a>
              <a href="#benefits" onClick={() => setMobileMenu(false)}>الفوائد</a>
              <a href="#faq" onClick={() => setMobileMenu(false)}>الأسئلة الشائعة</a>
              <button
                type="button"
                className="text-right font-bold text-primary"
                onClick={() => {
                  setMobileMenu(false);
                  setIsRegister(false);
                  openRegistration();
                }}
              >
                تسجيل الدخول
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* STICKY MINI REGISTRATION BAR */}
      <div
        className={`fixed inset-x-0 top-[72px] z-40 border-b bg-background/95 shadow-lg backdrop-blur-xl transition-all duration-300 ${
          scrolled
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={openRegistration}
          className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 text-right md:px-8"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Coffee className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">Little Cafe Command</span>
              <span className="block truncate text-xs text-muted-foreground">
                سجّل وابدأ إدارة كافيهك
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
            فتح التسجيل <ArrowLeft className="size-4" />
          </span>
        </button>
      </div>

      {/* REGISTRATION - LANDING PAGE START */}
      <section id="account" className="scroll-mt-24 border-b bg-[#10110f] px-4 py-10 text-white md:py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_440px]">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d6b45c]/30 bg-[#d6b45c]/10 px-4 py-2 text-xs font-semibold text-[#d6b45c]">
              <Zap className="size-4" />
              نظام متكامل لإدارة الكافيهات
            </span>

            <h1 className="mt-6 text-3xl font-bold leading-relaxed md:text-5xl">
              كل تفاصيل كافيهك
              <span className="block text-[#d6b45c]">في مكان واحد</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-8 text-gray-300 md:text-base">
              من المبيعات والمخازن إلى الموظفين والتكاليف والتقارير.
              اكتشف طريقة أكثر تنظيمًا لمتابعة تشغيل كافيهك واتخاذ قراراتك.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                "متابعة المبيعات والطلبات",
                "حساب تكلفة المنتجات",
                "إدارة المخزون والخامات",
                "تقارير الأداء والربحية",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-200">
                  <Check className="size-4 shrink-0 text-[#d6b45c]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#6d5525] bg-[#171715] p-5 shadow-2xl sm:p-7">
            <div className="mb-6 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#d6b45c]/10 text-[#d6b45c]">
                <Coffee className="size-6" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-[#d6b45c]">
                {isRegister ? "إنشاء حساب كافيه جديد" : "أهلاً بك مجدداً"}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {isRegister ? "أنشئ حسابك وابدأ إدارة الكافيه" : "سجل دخولك للمتابعة"}
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
                className="h-12 w-full border-[#6d5525] bg-[#20201e] font-bold text-white hover:bg-[#30302d] hover:text-white"
              >
                المتابعة باستخدام Lovable
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-700" />
              <span className="text-xs text-gray-500">أو بالبريد الإلكتروني</span>
              <div className="h-px flex-1 bg-gray-700" />
            </div>

            <form onSubmit={submitEmail} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">البريد الإلكتروني Gmail</Label>
                <Input
                  name="email"
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="email"
                  placeholder="example@gmail.com"
                  className="border-gray-700 bg-[#0d0e0c] text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">كلمة المرور</Label>
                <Input
                  name="password"
                  type="password"
                  required
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder="********"
                  className="border-gray-700 bg-[#0d0e0c] text-white"
                />
                {isRegister && (
                  <p className="text-xs text-gray-500">
                    كلمة المرور يجب ألا تقل عن 8 أحرف.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="h-12 w-full bg-[#d6b45c] text-base font-bold text-black hover:bg-[#bd9b43]"
              >
                {busy && <Loader2 className="ml-2 size-4 animate-spin" />}
                {isRegister ? "إنشاء الحساب والمتابعة" : "تسجيل الدخول"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-gray-400">
              {isRegister ? "لديك حساب بالفعل؟" : "أول مرة تستخدم النظام؟"}
              <button
                type="button"
                disabled={busy}
                onClick={() => setIsRegister((value) => !value)}
                className="mr-2 font-bold text-[#d6b45c] hover:underline"
              >
                {isRegister ? "تسجيل الدخول" : "إنشاء حساب"}
              </button>
            </div>

            <p className="mt-5 border-t border-gray-800 pt-4 text-center text-xs text-gray-500">
              Little Cafe Command — نظام إدارة الكافيهات
            </p>
          </div>
        </div>
      </section>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-primary">
              <Zap className="size-4" />
              تحكم أفضل في تفاصيل التشغيل
            </span>

            <h2 className="max-w-2xl text-4xl font-bold leading-[1.5] tracking-tight md:text-6xl">
              كافيهك يستحق
              <span className="block text-primary">إدارة أذكى</span>
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
              اجمع إدارة المبيعات والمخازن والموظفين والمشتريات والتقارير
              في نظام واحد. تحكم أفضل، وتنظيم أوضح، ومتابعة أسهل.
            </p>

            <Button size="lg" onClick={openRegistration} className="mt-8 h-14 gap-3 px-8 text-base">
              ابدأ الآن <ArrowLeft className="size-5" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[35px] bg-primary/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border bg-card p-2 shadow-2xl">
              <img
                src={heroCoffee}
                alt="القهوة داخل الكافيه"
                className="aspect-[5/4] w-full rounded-2xl object-cover"
              />
              <div className="absolute bottom-7 right-7 left-7 rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">إدارة كافيهك</p>
                    <p className="mt-1 font-bold">كل شيء في مكان واحد</p>
                  </div>
                  <LayoutDashboard className="size-7 text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { icon: ShoppingBag, label: "المبيعات" },
                    { icon: Package, label: "المخازن" },
                    { icon: BarChart3, label: "التقارير" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-muted p-3 text-center">
                      <item.icon className="mx-auto size-5 text-primary" />
                      <p className="mt-2 text-[11px] font-semibold">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-24 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-sm font-bold text-primary">إمكانيات النظام</span>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">
              كل أقسام كافيهك تحت سيطرتك
            </h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              أدوات مترابطة تساعدك على تنظيم تفاصيل التشغيل ومتابعتها دون تشتت.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="benefits" className="scroll-mt-24 bg-muted/40 py-20 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <span className="text-sm font-bold text-primary">رؤية أوضح لتشغيلك</span>
            <h2 className="mt-4 text-3xl font-bold leading-relaxed md:text-4xl">
              مش مجرد تسجيل مبيعات...
              <span className="block text-primary">دي إدارة متكاملة</span>
            </h2>
            <p className="mt-5 leading-8 text-muted-foreground">
              لما تكون بيانات التشغيل منظمة ومترابطة، يصبح من الأسهل متابعة
              التفاصيل اليومية وفهم ما يحدث داخل الكافيه.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "بيانات التشغيل في مكان واحد",
                "تنظيم صلاحيات الموظفين",
                "متابعة المبيعات والمخزون",
                "تنظيم المصروفات والمشتريات",
                "تقارير تساعدك على فهم نشاطك",
                "واجهة عربية سهلة الاستخدام",
              ].map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-4" />
                  </span>
                  <span className="text-sm font-medium leading-6">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-7 shadow-sm md:p-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">منظومة واحدة</p>
                <h3 className="mt-2 text-xl font-bold">إدارة مترابطة</h3>
              </div>
              <TrendingUp className="size-7 text-primary" />
            </div>

            <div className="mt-8 space-y-3">
              {[
                { icon: ShoppingBag, title: "الطلبات والمبيعات", sub: "نقطة البيع" },
                { icon: Package, title: "الخامات والكميات", sub: "المخازن" },
                { icon: Users, title: "الفريق والصلاحيات", sub: "الموظفون" },
                { icon: Wallet, title: "الحركة المالية", sub: "المصروفات" },
                { icon: BarChart3, title: "متابعة الأداء", sub: "التقارير" },
              ].map((item, index) => (
                <div key={item.title} className="flex items-center gap-4 rounded-xl border bg-background p-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">0{index + 1}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl bg-primary/5 p-4 text-center text-sm font-medium text-primary">
              تفاصيل التشغيل في مكان واحد
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-24 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <span className="text-sm font-bold text-primary">ابدأ بسهولة</span>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">من التسجيل إلى التشغيل</h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              خطوات واضحة لتبدأ إدارة كافيهك.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { number: "01", title: "أنشئ حسابك", description: "سجل حسابك وابدأ إعداد مساحة العمل الخاصة بك." },
              { number: "02", title: "جهز بيانات كافيهك", description: "أضف المنتجات والخامات والموظفين والبيانات الأساسية." },
              { number: "03", title: "ابدأ التشغيل", description: "استخدم أدوات النظام لمتابعة وإدارة عمليات الكافيه." },
            ].map((step) => (
              <div key={step.number} className="rounded-2xl border bg-card p-7">
                <span className="text-4xl font-bold text-primary/25">{step.number}</span>
                <h3 className="mt-5 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20 text-primary-foreground md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <span className="text-sm font-semibold opacity-80">تحكم وتنظيم</span>
            <h2 className="mt-4 text-3xl font-bold leading-relaxed md:text-5xl">
              وقت أقل في متابعة التفاصيل.
              <br />
              ورؤية أوضح للتشغيل.
            </h2>
            <p className="mt-5 leading-8 opacity-80">
              اجمع أدوات إدارة الكافيه في تجربة واحدة، وابدأ في تنظيم العمليات اليومية.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-8 h-14 gap-3 px-8"
              onClick={openRegistration}
            >
              ابدأ باستخدام النظام <ArrowLeft className="size-5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Smartphone, title: "تجربة مرنة", body: "واجهة متجاوبة" },
              { icon: ShieldCheck, title: "صلاحيات منظمة", body: "لكل موظف دوره" },
              { icon: Zap, title: "خطوات واضحة", body: "تنظيم أسهل" },
              { icon: LayoutDashboard, title: "لوحة موحدة", body: "أقسام مترابطة" },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                <item.icon className="size-7" />
                <h3 className="mt-5 font-bold">{item.title}</h3>
                <p className="mt-2 text-xs opacity-75">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-12 text-center">
            <span className="text-sm font-bold text-primary">هل لديك سؤال؟</span>
            <h2 className="mt-4 text-3xl font-bold">أسئلة شائعة</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div key={faq.q} className="overflow-hidden rounded-xl border bg-card">
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                  aria-expanded={activeFaq === index}
                  className="flex w-full items-center justify-between gap-4 p-5 text-right font-semibold"
                >
                  {faq.q}
                  <ChevronDown
                    className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                      activeFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {activeFaq === index && (
                  <div className="border-t px-5 py-4 text-sm leading-8 text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 pb-20 md:pb-28">
        <div className="mx-auto max-w-6xl rounded-3xl border bg-muted/40 px-6 py-14 text-center md:px-16">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Coffee className="size-7" />
          </div>
          <h2 className="mt-6 text-3xl font-bold md:text-4xl">
            ابدأ بتنظيم كافيهك اليوم
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-muted-foreground">
            أنشئ حسابك واكتشف أدوات الإدارة المتاحة لك في Little Cafe Command.
          </p>
          <Button size="lg" className="mt-8 h-14 gap-3 px-10 text-base" onClick={openRegistration}>
            أنشئ حساب كافيهك الآن <ArrowLeft className="size-5" />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-8 md:flex-row md:px-8">
          <Link to="/auth" className="flex items-center gap-2 font-bold text-primary">
            <Coffee className="size-5" />
            LITTLE CAFE COMMAND
          </Link>

          <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
            <a href="#features" className="hover:text-primary">المميزات</a>
            <a href="#how" className="hover:text-primary">طريقة العمل</a>
            <a href="#faq" className="hover:text-primary">الأسئلة الشائعة</a>
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                openRegistration();
              }}
              className="hover:text-primary"
            >
              تسجيل الدخول
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Little Cafe Command
          </p>
        </div>
      </footer>
    </main>
  );
}
