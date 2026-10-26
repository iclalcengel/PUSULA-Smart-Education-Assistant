import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CheckCheck, KeyRound, MessageCircleHeart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fixTurkishText } from "@/lib/fixTurkishText";
import { cn } from "@/lib/utils";

const COURSE_CARD_TONES = [
  "course-card-tone-0",
  "course-card-tone-1",
  "course-card-tone-2",
  "course-card-tone-3",
  "course-card-tone-4",
  "course-card-tone-5",
];

const StudentDashboard = () => {
  const { user } = useAuth();
  const { t } = usePreferences();
  const [courses, setCourses] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const load = async () => {
    if (!user) return;

    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("student_id", user.id);

    const courseIds = (enrollments ?? []).map((item) => item.course_id);

    if (courseIds.length) {
      const { data: courseRows } = await supabase
        .from("courses")
        .select("*")
        .in("id", courseIds)
        .order("created_at", { ascending: false });

      const teacherIds = [...new Set((courseRows ?? []).map((course) => course.teacher_id).filter(Boolean))];
      const { data: profiles } = teacherIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", teacherIds)
        : { data: [] };
      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

      setCourses((courseRows ?? []).map((course) => ({ ...course, profiles: profilesById.get(course.teacher_id) })));

      const { data: announcementRows } = await supabase
        .from("announcements")
        .select("*, courses(title, emoji)")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentAnnouncements(announcementRows ?? []);
    } else {
      setCourses([]);
      setRecentAnnouncements([]);
    }

    const { data: lessonProgressRows } = await supabase
      .from("lesson_progress")
      .select("id")
      .eq("student_id", user.id);

    setProgress(lessonProgressRows?.length ?? 0);

    const { data: notificationRows } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    setNotifications(notificationRows ?? []);
  };

  useEffect(() => {
    load();
  }, [user]);

  const markRead = async (id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", user!.id);
  };

  return (
    <AppLayout>
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-pop md:p-10">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <p className="mb-1 font-semibold opacity-90">{t("student.heroHello")}</p>
          <h1 className="mb-3 font-display text-4xl font-black md:text-5xl">{t("student.heroTitle")}</h1>
          <p className="mb-5 max-w-xl opacity-90">{t("student.heroText")}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/student/chat">
              <Button className="h-12 rounded-full border-0 bg-card px-6 font-bold text-foreground shadow-soft hover:bg-card/90">
                <MessageCircleHeart className="mr-2 h-4 w-4" />
                {t("student.askAi")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/student/join">
              <Button variant="secondary" className="h-12 rounded-full border-0 bg-white/15 px-6 font-bold text-white backdrop-blur hover:bg-white/20">
                <KeyRound className="mr-2 h-4 w-4" /> Koda göre katıl
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-0 p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black">{t("student.courses")}</h2>
            <Link to="/student/join">
              <Button variant="outline" className="rounded-full">
                <KeyRound className="mr-1 h-4 w-4" /> Kursa katıl
              </Button>
            </Link>
          </div>
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
              Henüz katıldığın kurs yok. Öğretmeninin verdiği kod ile kursa katılabilirsin.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((course, index) => (
                <Link key={course.id} to={`/student/courses/${course.id}`}>
                  <div
                    className={cn(
                      "group h-full rounded-2xl border p-4 transition-all hover:-translate-y-0.5",
                      COURSE_CARD_TONES[index % COURSE_CARD_TONES.length]
                    )}
                  >
                    <div className="mb-1 inline-block text-3xl transition-transform group-hover:scale-110">{course.emoji}</div>
                    <h3 className="font-bold">{course.title}</h3>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{course.profiles?.display_name || t("role.teacher")}</p>
                    {course.course_code && (
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary/80">Kod: {course.course_code}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border-0 p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-black">Bildirimler</h3>
              <p className="text-sm text-muted-foreground">Okunmamış: {unreadCount}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-violet shadow-soft">
              <Bell className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">Henüz bildirimin yok.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => !notification.is_read && markRead(notification.id)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-all",
                    notification.is_read ? "bg-card" : "border-primary/20 bg-primary/5 shadow-soft"
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <p className="font-bold">{fixTurkishText(notification.title)}</p>
                    {!notification.is_read && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Yeni
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{fixTurkishText(notification.message)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString("tr-TR")}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl border-0 bg-gradient-violet p-6 text-primary-foreground shadow-card">
          <Sparkles className="mb-2 h-8 w-8" />
          <p className="text-sm font-semibold opacity-90">{t("student.completedLessons")}</p>
          <p className="font-display text-5xl font-black">{progress}</p>
        </Card>

        <Card className="rounded-3xl border-0 p-6 shadow-card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-black">{t("student.latestNews")}</h3>
            {unreadCount > 0 && (
              <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <CheckCheck className="h-3.5 w-3.5" /> {unreadCount} yeni bildirim
              </div>
            )}
          </div>
          {recentAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("student.noAnnouncements")}</p>
          ) : (
            <div className="space-y-3">
              {recentAnnouncements.slice(0, 4).map((announcement) => (
                <div key={announcement.id} className="text-sm">
                  <p className="font-semibold">
                    {announcement.courses?.emoji} {fixTurkishText(announcement.title)}
                  </p>
                  <p className="line-clamp-2 text-muted-foreground">{fixTurkishText(announcement.body)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default StudentDashboard;
