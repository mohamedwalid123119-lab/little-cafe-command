import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, ChefHat, Coffee, Layers, ShieldCheck, TrendingUp } from "lucide-react";

import heroCoffee from "@/assets/hero-coffee.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAFE OS — إدارة تكلفة وريسبيات الكافيه" },
      { name: "description", content: "احسب تكلفة كل مشروب بدقة، تابع أرباحك، وأدر منتجاتك وريسبياتك في مكان واحد. مصمم للكافيهات في مصر." },
      { property: "og:title", content: "CAFE OS — إدارة تكلفة وريسبيات الكافيه" },
      { property: "og:description", content: "احسب تكلفة كل مشروب بدقة وتابع أرباحك. مصمم للكافيهات في مصر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Calculator, title: "تكلفة دقيقة لكل كوب", body: "اشترِ بالكيلو أو اللتر أو الدستة، والنظام يحسب تكلفة كل جرام ومللي تلقائياً." },
  { icon: ChefHat, title: "ريسبيات وتحضيرات", body: "ريسبيات بأحجام ساخن ومثلج، تحضيرات مسبقة مثل شوت الإسبريسو، تغليف ونسبة هالك." },
  { icon: TrendingUp, title: "تحديث تلقائي للأسعار", body: "غيّر سعر اللبن مرة واحدة، فتتحدث تكلفة وأرباح كل المشروبات التي تستخدمه فوراً." },
  { icon: Layers, title: "منتجات وإضافات", body: "أحجام، ساخن ومثلج، إضافات بسعر وتكلفة، وأقسام منظمة لقائمتك." },
  { icon: ShieldCheck, title: "صلاحيات للموظفين", body: "المالك والمدير والكاشير والباريستا، كل واحد يرى ما يخصه فقط." },
  { icon: Coffee, title: "مصمم للكافيهات", body: "بالعربي، بالجنيه المصري، ويدعم الضريبة ونسبة تكلفة مستهدفة." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-primary">
          <Coffee className="size-6" /> CAFE OS
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">تسجيل الدخول</Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
        <div>
          <h1 className="text-4xl font-bold leading-tight text-foreground md:text-5xl">
            اعرف تكلفة كل كوب
            <br />
            <span className="text-primary">وربحك الحقيقي</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            CAFE OS يحسب تكلفة الريسبيات تلقائياً من أسعار الخامات، ويوضح لك هامش الربح والسعر المقترح لكل منتج.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>ابدأ تجربة مجانية 14 يوم</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">لدي حساب</Link>
            </Button>
          </div>
        </div>
        <img
          src={heroCoffee}
          alt="بار قهوة في كافيه"
          className="aspect-[4/3] w-full rounded-xl object-cover shadow-lg"
          width={1024}
          height={768}
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} CAFE OS</footer>
    </div>
  );
}
