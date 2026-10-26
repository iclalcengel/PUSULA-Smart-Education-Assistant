import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PusulaLogo } from "@/components/brand/PusulaLogo";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { toast } from "sonner";
import { GraduationCap, BookOpen, ArrowRight, Languages, Moon, Sun } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";

const Auth = () => {
  const [params] = useSearchParams();
  const initialRole = (params.get("role") as AppRole) === "teacher" ? "teacher" : "student";
  const { user, role: existingRole, loading } = useAuth();
  const { language, setLanguage, theme, toggleTheme, t } = usePreferences();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [role, setRole] = useState<AppRole>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const schemas = useMemo(() => ({
    email: z.string().email(t("auth.emailInvalid")).max(255),
    password: z.string().min(8, t("auth.passwordMin")).max(72),
    name: z.string().trim().min(1, t("auth.nameRequired")).max(80),
  }), [t]);

  useEffect(() => { setRole(initialRole); }, [initialRole]);

  if (!loading && user) return <Navigate to={existingRole === "teacher" ? "/teacher" : "/student"} replace />;

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error(t("auth.emailRequired"));
      return;
    }
    const emailParsed = schemas.email.safeParse(email);
    if (!emailParsed.success) {
      toast.error(emailParsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("auth.passwordResetSent"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const emailParsed = schemas.email.safeParse(email);
      const pwParsed = schemas.password.safeParse(password);
      if (!emailParsed.success) { toast.error(emailParsed.error.issues[0].message); return; }
      if (!pwParsed.success) { toast.error(pwParsed.error.issues[0].message); return; }

      if (mode === "signup") {
        const nameParsed = schemas.name.safeParse(name);
        if (!nameParsed.success) { toast.error(nameParsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name, role },
          },
        });
        if (error) { toast.error(error.message); return; }
        toast.success(t("auth.welcome"));
        navigate(role === "teacher" ? "/teacher" : "/student");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); return; }
        toast.success(t("auth.welcomeBackToast"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-gradient-soft lg:grid-cols-2">
      <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-muted p-1 shadow-card">
          <Languages className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
          {(["tr", "en"] as const).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setLanguage(item)}
              className={cn(
                "h-7 rounded-full px-2.5 text-xs font-bold transition-all",
                language === item ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}
          title={theme === "dark" ? t("theme.light") : t("theme.dark")}
          className="rounded-full bg-muted shadow-card"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

      <div className="relative hidden items-center justify-center p-12 lg:flex">
        <div className="max-w-md">
          <Link to="/" className="mb-12 inline-flex items-center gap-2">
            <PusulaLogo className="h-10 w-10" />
            <span className="font-display text-2xl font-black">Pusula</span>
          </Link>
          <h2 className="mb-4 font-display text-5xl font-black leading-tight">
            {t("auth.heroTitle")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("auth.heroText")}</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6 pt-24 lg:p-12">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-pop">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <PusulaLogo />
            <span className="font-display text-xl font-black">Pusula</span>
          </div>

          <h1 className="mb-1 font-display text-3xl font-black">{mode === "signup" ? t("auth.signupTitle") : t("auth.signinTitle")}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {mode === "signup" ? t("auth.signupSubtitle") : t("auth.signinSubtitle")}
          </p>

          {mode === "signup" && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              {(["student", "teacher"] as AppRole[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    role === item ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`mb-2 grid h-9 w-9 place-items-center rounded-xl ${item === "teacher" ? "bg-gradient-violet" : "bg-gradient-teal"}`}>
                    {item === "teacher" ? <GraduationCap className="h-5 w-5 text-primary-foreground" /> : <BookOpen className="h-5 w-5 text-primary-foreground" />}
                  </div>
                  <div className="text-sm font-bold">{item === "teacher" ? t("role.teacher") : t("role.student")}</div>
                  <div className="text-xs text-muted-foreground">{item === "teacher" ? t("auth.teacherHint") : t("auth.studentHint")}</div>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ayse Yilmaz" className="mt-1 h-11 rounded-xl" />
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("auth.passwordPlaceholder")} className="mt-1 h-11 rounded-xl" />
            </div>

            {mode === "signin" && (
              <div className="text-right">
                <button type="button" onClick={handleForgotPassword} className="text-sm text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </button>
              </div>
            )}

            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl border-0 bg-gradient-hero text-base font-bold text-primary-foreground shadow-pop transition-transform hover:scale-[1.02]">
              {busy ? t("auth.wait") : mode === "signup" ? t("auth.createAccount") : t("auth.signIn")} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? t("auth.haveAccount") : t("auth.newHere")}{" "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-bold text-primary hover:underline">
              {mode === "signup" ? t("auth.signIn") : t("auth.createAccount")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
