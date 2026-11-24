
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChefHat,
  ChevronDown,
  CirclePlay,
  Coffee,
  CreditCard,
  LayoutDashboard,
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

import heroCoffee from "@/assets/hero-coffee.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Little Cafe Command | إدارة كافيهك بذكاء" },
      {
        name: "description",
        content:
          "كل تفاصيل كافيهك تحت سيطرتك. أدر المبيعات والمخازن والموظفين والمصروفات من نظام واحد.",
      },
      { property: "og:title", content: "Little Cafe Command" },
      {
        property: "og:description",
        content: "نظام متكامل لإدارة وتشغيل الكافيهات.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ShoppingBag,
    title: "نقطة البيع والكاشير",
    description:
      "استقبل الطلبات وسجل المبيعات وتابع تفاصيل الفواتير من شاشة تشغيل منظمة.",
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    icon: Package,
    title: "إدارة المخازن",
    description:
      "تابع الخامات والمنتجات والكميات وحركة المخزون بشكل منظم.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: ChefHat,
    title: "الريسبيات والتكلفة",
    description:
      "نظم وصفات المشروبات واحسب تكلفة المكونات وتابع أسعار الخامات.",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: Users,
    title: "إدارة الموظفين",
    description:
      "أنشئ حسابات فريق العمل وحدد صلاحيات كل موظف حسب دوره.",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    icon: Wallet,
    title: "المصروفات والمشتريات",
    description:
      "سجل المصروفات والمشتريات وتابع العمليات المالية اليومية.",
    color: "bg-rose-500/10 text-rose-600",
  },
  {
    icon: BarChart3,
    title: "التقارير والتحليلات",
    description:
      "راجع بيانات التشغيل والمبيعات والتكاليف من مكان واحد.",
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    icon: CreditCard,
    title: "إدارة الموردين",
    description:
      "نظم بيانات الموردين وسجل عمليات الشراء والتعاملات.",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: LayoutDashboard,
    title: "لوحة تحكم موحدة",
    description:
      "تابع أقسام الكافيه من واجهة واحدة بدل التنقل بين أدوات مختلفة.",
    color: "bg-indigo-500/10 text-indigo-600",
  },
];

const steps = [
  {
    number: "01",
    title: "أنشئ حسابك",
    description: "سجل باستخدام Google وأضف البيانات الأساسية لكافيهك.",
  },
  {
    number: "02",
    title: "جهز فريقك",
    description: "أنشئ حسابات الموظفين وحدد صلاحيات كل شخص.",
  },
  {
    number: "03",
    title: "ابدأ التشغيل",
    description: "استخدم أدوات النظام لمتابعة وإدارة عمليات الكافيه.",
  },
];

const benefits = [
  "بيانات التشغيل في مكان واحد",
  "تنظيم صلاحيات الموظفين",
  "متابعة المبيعات والمخزون",
  "تنظيم المصروفات والمشتريات",
  "تقارير تساعدك على فهم نشاطك",
  "واجهة عربية سهلة الاستخدام",
];

function Landing() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "هل أحتاج إلى خبرة في الكمبيوتر؟",
      a: "تم تصميم واجهة النظام لتكون واضحة وسهلة الاستخدام، ويمكنك التعرف على الأقسام تدريجيًا.",
    },
    {
      q: "كيف أنشئ حساب الكافيه؟",
      a: "تبدأ بتسجيل الدخول باستخدام Google، ثم تدخل البيانات الأساسية للكافيه لإنشاء مساحة العمل الخاصة بك.",
    },
    {
      q: "هل يمكن إضافة موظفين؟",
      a: "يمكنك إدارة حسابات الموظفين وتحديد الصلاحيات المتاحة لكل دور من داخل النظام.",
    },
    {
      q: "هل يمكن استخدام النظام من الهاتف؟",
      a: "واجهة النظام مصممة لتتكيف مع أحجام الشاشات المختلفة. تختلف تفاصيل الاستخدام حسب القسم.",
    },
    {
      q: "هل أستطيع إدارة المخازن والمبيعات معًا؟",
      a: "النظام يحتوي على أقسام مستقلة للمبيعات والمخازن والمشتريات والتقارير.",
    },
  ];

  const closeMenu = () => setMobileMenu(false);

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-background text-foreground"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary"
          >
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
            <a href="#features" className="transition hover:text-primary">
              المميزات
            </a>
            <a href="#how" className="transition hover:text-primary">
              كيف يعمل؟
            </a>
            <a href="#benefits" className="transition hover:text-primary">
              لماذا النظام؟
            </a>
            <a href="#faq" className="transition hover:text-primary">
              الأسئلة الشائعة
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" asChild>
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
            <Button asChild className="gap-2">
              <Link to="/auth">
                ابدأ الآن
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </div>

          <button
            type="button"
            aria-label="فتح القائمة"
            onClick={() => setMobileMenu(!mobileMenu)}
            className="rounded-lg border p-2 lg:hidden"
          >
            {mobileMenu ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>

        {mobileMenu && (
          <div className="border-t bg-background px-5 py-5 lg:hidden">
            <nav className="flex flex-col gap-5 text-sm">
              <a href="#features" onClick={closeMenu}>المميزات</a>
              <a href="#how" onClick={closeMenu}>كيف يعمل؟</a>
              <a href="#benefits" onClick={closeMenu}>لماذا النظام؟</a>
              <a href="#faq" onClick={closeMenu}>الأسئلة الشائعة</a>
              <Link to="/auth" onClick={closeMenu} className="font-bold text-primary">
                تسجيل الدخول وإنشاء حساب
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] to-transparent" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-primary">
              <Zap className="size-4" />
              نظام متكامل لإدارة الكافيهات
            </div>

            <h1 className="max-w-2xl text-4xl font-bold leading-[1.5] tracking-tight md:text-6xl">
              كافيهك يستحق
              <span className="block text-primary">
                إدارة أذكى
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
              من أول طلب لآخر حساب، اجمع إدارة المبيعات والمخازن
              والموظفين والمشتريات والتقارير في نظام واحد.
              تحكم أفضل، وتنظيم أوضح، ومتابعة أسهل.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 gap-3 px-8 text-base"
              >
                <Link to="/auth">
                  أنشئ حساب كافيهك
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 gap-2 px-7 text-base"
              >
                <a href="#features">
                  <CirclePlay className="size-5" />
                  اكتشف النظام
                </a>
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                واجهة عربية
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                تنظيم الصلاحيات
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                مناسب للهاتف
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[35px] bg-primary/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-3xl border bg-card p-2 shadow-2xl">
              <img
                src={heroCoffee}
                alt="تجربة القهوة داخل الكافيه"
                className="aspect-[5/4] w-full rounded-2xl object-cover"
                width={1024}
                height={768}
              />

              <div className="absolute bottom-7 right-7 left-7 rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      إدارة كافيهك
                    </p>
                    <p className="mt-1 font-bold">
                      كل شيء في مكان واحد
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <LayoutDashboard className="size-6" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { icon: ShoppingBag, label: "المبيعات" },
                    { icon: Package, label: "المخازن" },
                    { icon: BarChart3, label: "التقارير" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-muted p-3 text-center"
                    >
                      <item.icon className="mx-auto size-5 text-primary" />
                      <p className="mt-2 text-[11px] font-semibold">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              تعرف على أقسام النظام وإمكانياته
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-24 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-sm font-bold text-primary">
              إمكانيات النظام
            </span>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">
              كل أقسام كافيهك تحت سيطرتك
            </h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              أدوات مترابطة تساعدك على تنظيم تفاصيل التشغيل ومتابعتها
              دون تشتت بين أكثر من مكان.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-xl ${feature.color}`}
                >
                  <feature.icon className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {feature.description}
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                  جزء من منظومة واحدة
                  <ArrowLeft className="size-3" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT VALUE */}
      <section className="bg-muted/40 py-20 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <span className="text-sm font-bold text-primary">
              رؤية أوضح لتشغيلك
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-relaxed md:text-4xl">
              مش مجرد تسجيل مبيعات...
              <span className="block text-primary">
                دي إدارة متكاملة
              </span>
            </h2>
            <p className="mt-5 leading-8 text-muted-foreground">
              لما تكون بيانات التشغيل منظمة ومترابطة، يصبح من الأسهل
              متابعة التفاصيل اليومية وفهم ما يحدث داخل الكافيه.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-4" />
                  </span>
                  <span className="text-sm font-medium leading-6">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-7 shadow-sm md:p-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  منظومة واحدة
                </p>
                <h3 className="mt-2 text-xl font-bold">
                  إدارة مترابطة
                </h3>
              </div>
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="size-6" />
              </span>
            </div>

            <div className="mt-8 space-y-3">
              {[
                { icon: ShoppingBag, title: "الطلبات والمبيعات", sub: "نقطة البيع" },
                { icon: Package, title: "الخامات والكميات", sub: "المخازن" },
                { icon: Users, title: "الفريق والصلاحيات", sub: "الموظفون" },
                { icon: Wallet, title: "الحركة المالية", sub: "المصروفات" },
                { icon: BarChart3, title: "متابعة الأداء", sub: "التقارير" },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="flex items-center gap-4 rounded-xl border bg-background p-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.sub}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
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
            <span className="text-sm font-bold text-primary">
              ابدأ بسهولة
            </span>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">
              من التسجيل إلى التشغيل
            </h2>
            <p className="mt-4 leading-8 text-muted-foreground">
              خطوات واضحة لتبدأ إدارة كافيهك.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-2xl border bg-card p-7"
              >
                <span className="text-4xl font-bold text-primary/25">
                  {step.number}
                </span>
                <h3 className="mt-5 text-xl font-bold">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section
        id="benefits"
        className="scroll-mt-24 bg-primary py-20 text-primary-foreground md:py-24"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <span className="text-sm font-semibold opacity-80">
              تحكم وتنظيم
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-relaxed md:text-5xl">
              وقت أقل في متابعة التفاصيل.
              <br />
              ورؤية أوضح للتشغيل.
            </h2>
            <p className="mt-5 leading-8 opacity-80">
              اجمع أدوات إدارة الكافيه في تجربة واحدة، وابدأ في تنظيم
              العمليات اليومية بطريقة أكثر وضوحًا.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="mt-8 h-14 gap-3 px-8"
            >
              <Link to="/auth">
                ابدأ باستخدام النظام
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Smartphone, title: "تجربة مرنة", body: "واجهة متجاوبة" },
              { icon: ShieldCheck, title: "صلاحيات منظمة", body: "لكل موظف دوره" },
              { icon: Zap, title: "خطوات واضحة", body: "تنظيم أسهل" },
              { icon: LayoutDashboard, title: "لوحة موحدة", body: "أقسام مترابطة" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur"
              >
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
            <span className="text-sm font-bold text-primary">
              هل لديك سؤال؟
            </span>
            <h2 className="mt-4 text-3xl font-bold">
              أسئلة شائعة
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={faq.q}
                className="overflow-hidden rounded-xl border bg-card"
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveFaq(activeFaq === index ? null : index)
                  }
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
            أنشئ حسابك، أضف بيانات الكافيه، واكتشف أدوات الإدارة
            المتاحة لك في Little Cafe Command.
          </p>

          <Button
            asChild
            size="lg"
            className="mt-8 h-14 gap-3 px-10 text-base"
          >
            <Link to="/auth">
              أنشئ حساب كافيهك الآن
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <p className="mt-4 text-xs text-muted-foreground">
            التسجيل يبدأ بحساب Google.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-8 md:flex-row md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-primary"
          >
            <Coffee className="size-5" />
            LITTLE CAFE COMMAND
          </Link>

          <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
            <a href="#features" className="hover:text-primary">المميزات</a>
            <a href="#how" className="hover:text-primary">طريقة العمل</a>
            <a href="#faq" className="hover:text-primary">الأسئلة الشائعة</a>
            <Link to="/auth" className="hover:text-primary">تسجيل الدخول</Link>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Little Cafe Command
          </p>
        </div>
      </footer>
    </main>
  );
}
