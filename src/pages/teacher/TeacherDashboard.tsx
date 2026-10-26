import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, KeyRound, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateUniqueCourseCode, normalizeCourseCode, validateCourseCodeFormat } from "@/lib/courseCode";

const EMOJIS = ["📘", "🧪", "🎨", "🧮", "🌍", "🎼", "💻", "📚", "🔬", "⚙️", "🪐", "🧬"];

interface Course {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  course_code?: string | null;
}

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { t } = usePreferences();
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [courseCode, setCourseCode] = useState("");
  const [stats, setStats] = useState({ courses: 0, lessons: 0, students: 0 });

  const resetForm = () => {
    setTitle("");
    setDesc("");
    setEmoji("📘");
    setCourseCode("");
  };

  const load = async () => {
    if (!user) return;

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("id, title, description, emoji, course_code")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (courseError) {
      console.error("load courses error:", courseError);
    }

    setCourses(courseData ?? []);

    const { count: lessonCount } = await supabase
      .from("lessons")
      .select("id, topics!inner(courses!inner(teacher_id))", { count: "exact", head: true })
      .eq("topics.courses.teacher_id", user.id);

    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("student_id, courses!inner(teacher_id)")
      .eq("courses.teacher_id", user.id);

    const uniqueStudents = new Set((enrollments ?? []).map((row: any) => row.student_id)).size;

    setStats({
      courses: courseData?.length ?? 0,
      lessons: lessonCount ?? 0,
      students: uniqueStudents,
    });
  };

  useEffect(() => {
    load();
  }, [user]);

  const autofillCourseCode = async () => {
    try {
      const generatedCode = await generateUniqueCourseCode(title || "Kurs");
      setCourseCode(generatedCode);
    } catch (error) {
      console.error("autofill course code error:", error);
      toast.error("Kurs kodu üretilemedi. İstersen kendi kısa kodunu yaz.");
    }
  };

  const create = async () => {
    if (!title.trim()) {
      toast.error(t("teacher.titleRequired"));
      return;
    }

    if (!user) {
      toast.error("Oturum bulunamadı. Sayfayı yenileyip tekrar dene.");
      return;
    }

    setCreating(true);

    try {
      const manualCode = normalizeCourseCode(courseCode);

      if (manualCode && !validateCourseCodeFormat(manualCode)) {
        toast.error("Kurs kodu `MAT101-A7K9` ya da `NTP2026` biçiminde olmalı.");
        return;
      }

      const nextCode = manualCode || await generateUniqueCourseCode(title);

      const { error } = await supabase.from("courses").insert({
        teacher_id: user.id,
        title: title.trim(),
        description: desc.trim(),
        emoji,
        course_code: nextCode,
      });

      if (error) {
        if (error.message.toLowerCase().includes("idx_courses_course_code_unique") || error.message.toLowerCase().includes("duplicate key")) {
          toast.error("Bu kurs kodu zaten kullanılıyor. Farklı bir kod yaz ya da otomatik üret.");
          return;
        }

        if (error.message.toLowerCase().includes("course_code")) {
          toast.error("Veritabanında kurs kodu alanı henüz hazır değil. Migration SQL'ini çalıştır.");
          return;
        }

        toast.error(error.message);
        return;
      }

      setOpen(false);
      resetForm();
      toast.success(t("teacher.courseCreated"));
      await load();
    } catch (error) {
      console.error("create course error:", error);
      toast.error("Kurs oluşturulurken bir hata oluştu. Konsolda ayrıntısı var.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-sm font-semibold text-muted-foreground">{t("teacher.welcomeBack")}</p>
          <h1 className="font-display text-4xl font-black md:text-5xl">{t("teacher.classroom")}</h1>
        </div>

        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen && !creating) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="h-12 rounded-full border-0 bg-gradient-hero px-6 font-bold text-primary-foreground shadow-pop">
              <Plus className="mr-1 h-4 w-4" /> {t("teacher.newCourse")}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{t("teacher.createCourse")}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>{t("teacher.pickIcon")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EMOJIS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setEmoji(item)}
                      className={`grid h-11 w-11 place-items-center rounded-2xl text-2xl transition-all ${
                        emoji === item ? "scale-110 bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-muted/70"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>{t("teacher.title")}</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("teacher.courseTitlePlaceholder")}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <Label>{t("teacher.description")}</Label>
                <Textarea
                  value={desc}
                  onChange={(event) => setDesc(event.target.value)}
                  placeholder={t("teacher.courseDescriptionPlaceholder")}
                  className="mt-1 rounded-xl"
                  rows={3}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <Label>Kurs kodu</Label>
                  <button type="button" onClick={autofillCourseCode} className="text-xs font-bold text-primary hover:underline">
                    Otomatik üret
                  </button>
                </div>
                <Input
                  value={courseCode}
                  onChange={(event) => setCourseCode(normalizeCourseCode(event.target.value))}
                  placeholder="Boş bırakırsan otomatik atanır"
                  className="mt-1 rounded-xl font-semibold tracking-[0.08em]"
                />
                <p className="mt-2 text-xs text-muted-foreground">Örnek: MAT101-A7K9 veya NTP2026</p>
              </div>

              <Button
                onClick={create}
                disabled={creating}
                className="h-11 w-full rounded-xl border-0 bg-gradient-hero font-bold text-primary-foreground"
              >
                {creating ? "Oluşturuluyor..." : t("teacher.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          { label: t("teacher.courses"), value: stats.courses, icon: BookOpen, bg: "bg-gradient-hero" },
          { label: t("teacher.lessons"), value: stats.lessons, icon: FileText, bg: "bg-gradient-violet" },
          { label: t("teacher.activeStudents"), value: stats.students, icon: Users, bg: "bg-gradient-teal" },
        ].map((stat, index) => (
          <Card key={index} className="rounded-3xl border-0 p-6 shadow-card">
            <div className={`mb-3 grid h-12 w-12 place-items-center rounded-2xl ${stat.bg} shadow-soft`}>
              <stat.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="font-display text-4xl font-black">{stat.value}</div>
            <div className="text-sm font-semibold text-muted-foreground">{stat.label}</div>
          </Card>
        ))}
      </div>

      <h2 className="mb-4 font-display text-2xl font-black">{t("teacher.yourCourses")}</h2>
      {courses.length === 0 ? (
        <Card className="rounded-3xl border-2 border-dashed bg-card/50 p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="mb-1 font-display text-xl font-bold">{t("teacher.noCourses")}</p>
          <p className="text-muted-foreground">{t("teacher.noCoursesHint")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} to={`/teacher/courses/${course.id}`}>
              <Card className="group h-full rounded-3xl border-0 p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-pop">
                <div className="mb-3 inline-block text-5xl transition-transform group-hover:scale-110">{course.emoji || "📘"}</div>
                <h3 className="mb-1 font-display text-xl font-black">{course.title}</h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">{course.description || t("teacher.noDescription")}</p>
                <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <KeyRound className="h-3.5 w-3.5" /> {course.course_code || "Kod oluşturulmadı"}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default TeacherDashboard;
