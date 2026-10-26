import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { PusulaLogo } from "@/components/brand/PusulaLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  KeyRound,
  GraduationCap,
  Languages,
  LayoutDashboard,
  LogOut,
  MessageCircleHeart,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { role, signOut, user } = useAuth();
  const { language, setLanguage, theme, toggleTheme, t } = usePreferences();
  const navigate = useNavigate();

  const teacherLinks = [
    { to: "/teacher", label: t("nav.dashboard"), icon: LayoutDashboard, end: true },
  ];
  const studentLinks = [
    { to: "/student", label: t("nav.discover"), icon: LayoutDashboard, end: true },
    { to: "/student/join", label: t("nav.joinCourse"), icon: KeyRound },
    { to: "/student/chat", label: t("nav.aiTeacher"), icon: MessageCircleHeart },
  ];
  const links = role === "teacher" ? teacherLinks : studentLinks;

  const languageToggle = (
    <div className="flex items-center gap-1 rounded-full bg-muted p-1">
      <Languages className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
      {(["tr", "en"] as const).map(item => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          aria-label={item === "tr" ? t("language.turkish") : t("language.english")}
          className={cn(
            "h-7 rounded-full px-2.5 text-xs font-bold transition-all",
            language === item ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to={role === "teacher" ? "/teacher" : "/student"} className="group flex items-center gap-2">
            <PusulaLogo className="transition-transform group-hover:scale-105" />
            <span className="font-display text-xl font-black">Pusula</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  isActive ? "bg-foreground text-background shadow-soft" : "text-foreground/80 hover:bg-muted"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">{languageToggle}</div>
            {role === "student" && user && <NotificationBell userId={user.id} />}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}
              title={theme === "dark" ? t("theme.light") : t("theme.dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold sm:inline-flex">
              {role === "teacher" ? <GraduationCap className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {role === "teacher" ? t("role.teacher") : t("role.student")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 px-4 pb-3 md:hidden">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold",
                  isActive ? "bg-foreground text-background" : "bg-muted"
                )}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="w-fit">{languageToggle}</div>
        </div>
      </header>
      <main className="container animate-fade-in py-8">{children}</main>
    </div>
  );
};
