import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { PusulaLogo } from "@/components/brand/PusulaLogo";
import { BookOpen, MessageCircleHeart, GraduationCap, ArrowRight, Stars } from "lucide-react";

const Landing = () => {
  const { user, role, loading } = useAuth();
  if (!loading && user) return <Navigate to={role === "teacher" ? "/teacher" : "/student"} replace />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-soft">
      <div className="absolute -right-32 -top-32 h-96 w-96 animate-blob rounded-full bg-primary/30 blur-3xl" />
      <div className="absolute -left-32 top-1/3 h-96 w-96 animate-blob rounded-full bg-secondary/25 blur-3xl" style={{ animationDelay: "3s" }} />
      <div className="absolute bottom-0 right-1/4 h-80 w-80 animate-blob rounded-full bg-accent/25 blur-3xl" style={{ animationDelay: "6s" }} />

      <header className="container relative flex h-20 items-center justify-between">
        <div className="flex items-center gap-2">
          <PusulaLogo className="h-10 w-10" />
          <span className="font-display text-2xl font-black">Pusula</span>
        </div>
        <Link to="/auth"><Button variant="ghost" className="rounded-full font-semibold">Giriş yap</Button></Link>
      </header>

      <section className="container relative pb-24 pt-12 text-center">
        <div className="mb-8 inline-flex animate-float items-center gap-2 rounded-full border bg-card px-4 py-1.5 shadow-card">
          <Stars className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Yapay zekâ destekli, keyifli öğrenme</span>
        </div>

        <h1 className="mx-auto mb-6 max-w-5xl font-display text-5xl font-black leading-[0.95] md:text-7xl lg:text-8xl">
          Her şeyi <span className="bg-gradient-hero bg-clip-text text-transparent">dost canlısı bir yapay zekâ öğretmenle</span> öğren.
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Pusula öğretmenlerin güzel dersler hazırlamasına, öğrencilerin de her an yanlarında bir çalışma arkadaşı bulmasına yardımcı olur.
        </p>

        <div className="mb-20 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth?role=student">
            <Button size="lg" className="h-14 rounded-full border-0 bg-gradient-hero px-8 text-base text-primary-foreground shadow-pop transition-transform hover:scale-105">
              Ben öğrenciyim <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auth?role=teacher">
            <Button size="lg" variant="outline" className="h-14 rounded-full border-2 px-8 text-base hover:bg-card">
              Ben öğretmenim
            </Button>
          </Link>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 text-left md:grid-cols-3">
          {[
            { icon: BookOpen, color: "bg-gradient-violet", title: "Düzenli dersler", desc: "Öğretmenler dakikalar içinde kurs, konu ve ders oluşturur." },
            { icon: MessageCircleHeart, color: "bg-gradient-hero", title: "Derse özel asistan", desc: "Yapay zekâ, öğretmenin derslerine göre sade biçimde açıklar." },
            { icon: GraduationCap, color: "bg-gradient-teal", title: "Quiz ve ilerleme", desc: "Quizlerle pratik yap, öğrendiklerini kolayca takip et." },
          ].map((feature, index) => (
            <div key={index} className="rounded-3xl border bg-card p-6 shadow-card transition-shadow hover:shadow-pop">
              <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${feature.color} shadow-soft`}>
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mb-1 font-display text-xl font-bold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Landing;
