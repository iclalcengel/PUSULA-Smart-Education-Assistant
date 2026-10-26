import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  Copy,
  Edit3,
  KeyRound,
  ListChecks,
  Megaphone,
  Plus,
  Trash2,
  Trophy,
  Wand2,
} from "lucide-react";
import { generateUniqueCourseCode } from "@/lib/courseCode";
import { DEFAULT_QUIZ_DURATION_MINUTES, getQuizDurationMinutes, withQuizDurationMarker } from "@/lib/quiz";

interface AnalyticsRow {
  studentId: string;
  name: string;
  attempts: number;
  score: number;
  total: number;
  average: number;
  completedLessons: number;
  points: number;
}

interface Analytics {
  averageScore: number;
  attempts: number;
  completedLessons: number;
  leaderboard: AnalyticsRow[];
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
}

const emptyAnalytics: Analytics = {
  averageScore: 0,
  attempts: 0,
  completedLessons: 0,
  leaderboard: [],
};

const TeacherCourseDetail = () => {
  const { courseId } = useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [lessonsByTopic, setLessonsByTopic] = useState<Record<string, any[]>>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  const [notificationStats, setNotificationStats] = useState<NotificationStats>({ total: 0, unread: 0, read: 0 });
  const [generatingCode, setGeneratingCode] = useState(false);

  const load = async () => {
    if (!courseId) return;

    const { data: courseRow } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
    setCourse(courseRow);

    const { data: topicRows } = await supabase.from("topics").select("*").eq("course_id", courseId).order("position");
    setTopics(topicRows ?? []);

    let lessonIds: string[] = [];
    if ((topicRows ?? []).length) {
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("*")
        .in("topic_id", (topicRows ?? []).map(topic => topic.id))
        .order("position");
      lessonIds = (lessonRows ?? []).map(lesson => lesson.id);
      const grouped: Record<string, any[]> = {};
      (lessonRows ?? []).forEach(lesson => {
        (grouped[lesson.topic_id] ||= []).push(lesson);
      });
      setLessonsByTopic(grouped);
    } else {
      setLessonsByTopic({});
    }

    const { data: announcementRows } = await supabase
      .from("announcements")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    setAnnouncements(announcementRows ?? []);

    const { data: quizRows } = await supabase
      .from("quizzes")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    const nextQuizzes = quizRows ?? [];
    setQuizzes(nextQuizzes);

    await Promise.all([
      loadAnalytics(nextQuizzes, lessonIds),
      loadNotificationStats(),
    ]);
  };

  const loadNotificationStats = async () => {
    if (!courseId) return;
    const { data } = await supabase
      .from("notifications")
      .select("is_read")
      .eq("course_id", courseId);

    const nextStats = { total: data?.length ?? 0, unread: 0, read: 0 };
    (data ?? []).forEach(item => {
      if (item.is_read) nextStats.read += 1;
      else nextStats.unread += 1;
    });
    setNotificationStats(nextStats);
  };

  const loadAnalytics = async (quizData: any[], lessonIds: string[]) => {
    const quizIds = quizData.map(quiz => quiz.id);
    const [{ data: attempts }, { data: progressRows }] = await Promise.all([
      quizIds.length
        ? supabase.from("quiz_attempts").select("student_id, score, total, quiz_id").in("quiz_id", quizIds)
        : Promise.resolve({ data: [] as any[] }),
      lessonIds.length
        ? supabase.from("lesson_progress").select("student_id, lesson_id").in("lesson_id", lessonIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const studentIds = [...new Set([
      ...(attempts ?? []).map(item => item.student_id),
      ...(progressRows ?? []).map(item => item.student_id),
    ])];

    const { data: profiles } = studentIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", studentIds)
      : { data: [] };
    const profilesById = new Map((profiles ?? []).map(profile => [profile.id, profile.display_name]));

    const rowsByStudent = new Map<string, AnalyticsRow>();
    const ensureRow = (studentId: string) => {
      if (!rowsByStudent.has(studentId)) {
        rowsByStudent.set(studentId, {
          studentId,
          name: profilesById.get(studentId) || "Öğrenci",
          attempts: 0,
          score: 0,
          total: 0,
          average: 0,
          completedLessons: 0,
          points: 0,
        });
      }
      return rowsByStudent.get(studentId)!;
    };

    (attempts ?? []).forEach(attempt => {
      const row = ensureRow(attempt.student_id);
      row.attempts += 1;
      row.score += attempt.score ?? 0;
      row.total += attempt.total ?? 0;
    });

    (progressRows ?? []).forEach(progress => {
      ensureRow(progress.student_id).completedLessons += 1;
    });

    const leaderboard = [...rowsByStudent.values()]
      .map(row => ({
        ...row,
        average: row.total ? Math.round((row.score / row.total) * 100) : 0,
        points: row.score + row.completedLessons * 5,
      }))
      .sort((a, b) => b.points - a.points || b.average - a.average);

    const totalScore = leaderboard.reduce((sum, row) => sum + row.score, 0);
    const totalPossible = leaderboard.reduce((sum, row) => sum + row.total, 0);

    setAnalytics({
      averageScore: totalPossible ? Math.round((totalScore / totalPossible) * 100) : 0,
      attempts: (attempts ?? []).length,
      completedLessons: (progressRows ?? []).length,
      leaderboard,
    });
  };

  useEffect(() => {
    load();
  }, [courseId]);

  const ensureCourseCode = async () => {
    if (!course || course.course_code || generatingCode) return;
    setGeneratingCode(true);
    try {
      const nextCode = await generateUniqueCourseCode(course.title || "Kurs");
      const { data, error } = await supabase
        .from("courses")
        .update({ course_code: nextCode })
        .eq("id", course.id)
        .select("*")
        .single();

      if (error) throw error;
      setCourse(data);
      toast.success("Kurs kodu oluşturuldu");
    } catch (error: any) {
      toast.error(error.message?.toLowerCase().includes("course_code")
        ? "Kurs kodu alanı veritabanında hazır değil. Migration SQL'ini çalıştır."
        : "Kurs kodu oluşturulamadı");
    } finally {
      setGeneratingCode(false);
    }
  };

  useEffect(() => {
    if (course && !course.course_code) ensureCourseCode();
  }, [course?.id, course?.course_code]);

  const deleteCourse = async () => {
    if (!confirm("Bu kursu ve tüm içeriğini silmek istiyor musun?")) return;
    await supabase.from("courses").delete().eq("id", courseId!);
    toast.success("Kurs silindi");
    nav("/teacher");
  };

  if (!course) {
    return (
      <AppLayout>
        <div className="grid h-64 place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link to="/teacher" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Geri
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="text-6xl">{course.emoji}</div>
          <div>
            <h1 className="font-display text-4xl font-black">{course.title}</h1>
            <p className="mt-1 max-w-xl text-muted-foreground">{course.description}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
              <KeyRound className="h-4 w-4" /> Kurs kodu: {course.course_code || "hazırlanıyor"}
              {course.course_code ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(course.course_code);
                    toast.success("Kurs kodu kopyalandı");
                  }}
                  className="rounded-full bg-white/70 p-1 transition hover:bg-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={ensureCourseCode}
                  disabled={generatingCode}
                  className="h-7 rounded-full px-2 text-xs"
                >
                  {generatingCode ? "Oluşturuluyor..." : "Kod oluştur"}
                </Button>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={deleteCourse} className="text-destructive">
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <Tabs defaultValue="stats">
        <TabsList className="h-12 rounded-full bg-muted p-1">
          <TabsTrigger value="stats" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft">
            <BarChart3 className="mr-1.5 h-4 w-4" /> İstatistikler
          </TabsTrigger>
          <TabsTrigger value="content" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft">
            <BookOpen className="mr-1.5 h-4 w-4" /> İçerik
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft">
            <ListChecks className="mr-1.5 h-4 w-4" /> Quizler
          </TabsTrigger>
          <TabsTrigger value="news" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft">
            <Megaphone className="mr-1.5 h-4 w-4" /> Duyurular
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6">
          <CourseAnalytics analytics={analytics} notificationStats={notificationStats} />
        </TabsContent>

        <TabsContent value="content" className="mt-6 space-y-4">
          <NewTopic courseId={courseId!} onCreated={load} />
          {topics.map(topic => (
            <Card key={topic.id} className="rounded-3xl border-0 p-6 shadow-card">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-black">{topic.title}</h3>
                  {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Konuyu sil?")) return;
                    await supabase.from("topics").delete().eq("id", topic.id);
                    load();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mb-3 space-y-2">
                {(lessonsByTopic[topic.id] ?? []).map(lesson => (
                  <LessonRow key={lesson.id} lesson={lesson} onChange={load} />
                ))}
              </div>
              <NewLesson topicId={topic.id} onCreated={load} />
            </Card>
          ))}
          {topics.length === 0 && (
            <Card className="rounded-3xl border-2 border-dashed bg-card/50 p-10 text-center">
              <p className="text-muted-foreground">Dersleri düzenlemeye başlamak için yukarıdan ilk konuyu ekleyin.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6 space-y-4">
          <NewQuiz courseId={courseId!} onCreated={load} />
          {quizzes.map(quiz => (
            <QuizRow key={quiz.id} quiz={quiz} onChange={load} />
          ))}
        </TabsContent>

        <TabsContent value="news" className="mt-6 space-y-4">
          <NewAnnouncement courseId={courseId!} onCreated={load} />
          {announcements.map(announcement => (
            <Card key={announcement.id} className="flex items-start justify-between gap-3 rounded-3xl border-0 p-5 shadow-card">
              <div>
                <h3 className="text-lg font-bold">{announcement.title}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{announcement.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(announcement.created_at).toLocaleString("tr-TR")}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await supabase.from("announcements").delete().eq("id", announcement.id);
                  load();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

const CourseAnalytics = ({
  analytics,
  notificationStats,
}: {
  analytics: Analytics;
  notificationStats: NotificationStats;
}) => {
  const statCards = [
    { label: "Genel quiz başarı puanı", value: `${analytics.averageScore}/100`, icon: BarChart3, tone: "bg-gradient-teal" },
    { label: "Quiz denemesi", value: analytics.attempts, icon: ListChecks, tone: "bg-gradient-violet" },
    { label: "Tamamlanan ders", value: analytics.completedLessons, icon: BookOpen, tone: "bg-gradient-hero" },
    { label: "Aktif öğrenci", value: analytics.leaderboard.length, icon: Trophy, tone: "bg-gradient-sunny" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(card => (
          <Card key={card.label} className="rounded-3xl border-0 p-5 shadow-card">
            <div className={`mb-3 grid h-11 w-11 place-items-center rounded-2xl ${card.tone} shadow-soft`}>
              <card.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="font-display text-3xl font-black">{card.value}</p>
            <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-0 p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-black">Liderlik tablosu</h2>
              <p className="text-sm text-muted-foreground">Puan = quiz doğru puanı + tamamlanan ders katkısı.</p>
            </div>
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          {analytics.leaderboard.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Henüz öğrenci verisi yok.</p>
          ) : (
            <div className="space-y-2">
              {analytics.leaderboard.map((row, index) => (
                <div key={row.studentId} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl bg-muted/50 p-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full font-black ${index === 0 ? "bg-gradient-sunny text-primary-foreground" : "bg-card"}`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-bold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.attempts} quiz · {row.completedLessons} ders · ortalama %{row.average}</p>
                  </div>
                  <p className="font-display text-2xl font-black">{row.points}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border-0 p-6 shadow-card">
          <h2 className="mb-4 font-display text-2xl font-black">Ödül ve bildirim akışı</h2>
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl bg-muted/50 p-4">
              <Award className="mb-2 h-5 w-5 text-primary" />
              <p className="font-bold">Gerçek ödül kayıtları</p>
              <p className="text-muted-foreground">Öğrenci 80+ veya 100 puan aldığında rozet kazanır. Bu rozetler öğrencinin hesabında saklanır.</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4">
              <Bell className="mb-2 h-5 w-5 text-primary" />
              <p className="font-bold">Uygulama içi motivasyon bildirimleri</p>
              <p className="text-muted-foreground">Toplam: {notificationStats.total} · Okunmamış: {notificationStats.unread} · Okunmuş: {notificationStats.read}</p>
              <p className="mt-2 text-muted-foreground">Quiz başarısı, haftalık görev ilerlemesi ve rozet kazanımları öğrencinin bildirim alanına düşer.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const NewTopic = ({ courseId, onCreated }: { courseId: string; onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">
          <Plus className="mr-1 h-4 w-4" /> Konu ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">Yeni konu</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Başlık</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 rounded-xl" /></div>
          <div><Label>Açıklama</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} className="mt-1 rounded-xl" rows={2} /></div>
          <Button
            onClick={async () => {
              if (!title.trim()) return toast.error("Başlık gerekli");
              const { error } = await supabase.from("topics").insert({ course_id: courseId, title, description: desc });
              if (error) return toast.error(error.message);
              setOpen(false);
              setTitle("");
              setDesc("");
              onCreated();
            }}
            className="w-full rounded-xl border-0 bg-gradient-hero text-primary-foreground"
          >
            Oluştur
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LessonRow = ({ lesson, onChange }: { lesson: any; onChange: () => void }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content);

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/50 p-3">
        <button onClick={() => setOpen(true)} className="flex-1 text-left text-sm font-semibold hover:text-primary">
          📄 {lesson.title}
        </button>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            if (!confirm("Dersi sil?")) return;
            await supabase.from("lessons").delete().eq("id", lesson.id);
            onChange();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle className="font-display text-2xl">Dersi düzenle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Başlık</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 rounded-xl" /></div>
            <div><Label>İçerik</Label><Textarea value={content} onChange={e => setContent(e.target.value)} className="mt-1 min-h-[300px] rounded-xl font-mono text-sm" /></div>
            <Button
              onClick={async () => {
                const { error } = await supabase.from("lessons").update({ title, content }).eq("id", lesson.id);
                if (error) return toast.error(error.message);
                toast.success("Kaydedildi");
                setOpen(false);
                onChange();
              }}
              className="w-full rounded-xl border-0 bg-gradient-hero text-primary-foreground"
            >
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const NewLesson = ({ topicId, onCreated }: { topicId: string; onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Plus className="mr-1 h-3.5 w-3.5" /> Ders ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">Yeni ders</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Başlık</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 rounded-xl" /></div>
          <div><Label>İçerik</Label><Textarea value={content} onChange={e => setContent(e.target.value)} className="mt-1 min-h-[300px] rounded-xl font-mono text-sm" placeholder="# Ders içeriği..." /></div>
          <Button
            onClick={async () => {
              if (!title.trim()) return toast.error("Başlık gerekli");
              const { error } = await supabase.from("lessons").insert({ topic_id: topicId, title, content });
              if (error) return toast.error(error.message);
              setOpen(false);
              setTitle("");
              setContent("");
              onCreated();
            }}
            className="w-full rounded-xl border-0 bg-gradient-hero text-primary-foreground"
          >
            Oluştur
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const NewAnnouncement = ({ courseId, onCreated }: { courseId: string; onCreated: () => void }) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <Card className="space-y-3 rounded-3xl border-0 p-5 shadow-card">
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Duyuru başlığı" className="rounded-xl" />
      <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Yeni neler var?" className="rounded-xl" rows={3} />
      <Button
        onClick={async () => {
          if (!title.trim()) return toast.error("Başlık gerekli");
          const { error } = await supabase.from("announcements").insert({ course_id: courseId, title, body });
          if (error) return toast.error(error.message);
          setTitle("");
          setBody("");
          onCreated();
          toast.success("Yayınlandı");
        }}
        className="rounded-full border-0 bg-gradient-hero text-primary-foreground"
      >
        <Megaphone className="mr-1 h-4 w-4" /> Duyuru paylaş
      </Button>
    </Card>
  );
};

const fallbackQuestions = (topic: string, count: number, points: number) =>
  Array.from({ length: count }, (_, index) => ({
    question: `${topic} konusu ile ilgili ${index + 1}. temel bilgi hangisidir?`,
    options: [
      `${topic} konusunun ana kavramlarından biridir.`,
      "Konu ile ilgisiz bir ifadedir.",
      "Her zaman yanlış kabul edilir.",
      "Sadece ezbere dayalı bir ayrıntıdır.",
    ],
    correct_index: 0,
    points,
  }));

const parseGeneratedQuestions = (text: string, topic: string, count: number, points: number) => {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("AI geçerli JSON soru listesi döndürmedi.");
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) throw new Error("AI soru listesini JSON array olarak döndürmedi.");
    const questions = parsed
      .slice(0, count)
      .map((item: any) => ({
        question: String(item.question ?? item.soru ?? ""),
        options: Array.isArray(item.options) ? item.options.map(String).slice(0, 4) : [],
        correct_index: Number.isInteger(item.correct_index) ? item.correct_index : Number(item.correctIndex ?? 0),
        points,
      }))
      .filter(item => item.question && item.options.length >= 2 && item.correct_index >= 0 && item.correct_index < item.options.length);
    if (!questions.length) throw new Error("AI soruları eksik veya hatalı formatta döndürdü.");
    return questions;
  } catch (error) {
    throw error instanceof Error ? error : new Error("AI soru JSON'u okunamadı.");
  }
};

const readSseText = async (response: Response) => {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        output += parsed.choices?.[0]?.delta?.content ?? "";
      } catch {}
    }
  }

  return output;
};

const NewQuiz = ({ courseId, onCreated }: { courseId: string; onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState(DEFAULT_QUIZ_DURATION_MINUTES);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [questionPoints, setQuestionPoints] = useState(20);
  const [generating, setGenerating] = useState(false);

  const insertQuiz = async (quizTitle: string, quizDescription: string) => {
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ course_id: courseId, title: quizTitle, description: quizDescription, duration_minutes: duration })
      .select("id")
      .single();
    if (!error) return data;
    if (!error.message.includes("duration_minutes")) throw error;

    const fallback = await supabase
      .from("quizzes")
      .insert({ course_id: courseId, title: quizTitle, description: withQuizDurationMarker(quizDescription, duration) })
      .select("id")
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  };

  const generateWithAi = async () => {
    const topic = topicPrompt.trim();
    if (!topic) return toast.error("Konu başlığı gerekli");

    setGenerating(true);
    try {
      let generatedText = "";
      const { data: authData } = await supabase.auth.getSession();
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${authData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            courseId,
            messages: [{
              role: "user",
              content: [
                `${topic} konusunda ${questionCount} adet çoktan seçmeli quiz sorusu üret.`,
                "Sadece geçerli JSON array döndür, markdown veya açıklama ekleme.",
                'Format: [{"question":"...","options":["A","B","C","D"],"correct_index":0}]',
                "Her soru konuya özgü, ölçücü ve birbirinden farklı olsun.",
                "Seçenekler gerçekçi çeldiriciler içersin; doğru cevap correct_index ile gösterilsin.",
              ].join("\n"),
            }],
          }),
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(errorText || "AI servisi yanıt vermedi.");
        }
        generatedText = await readSseText(resp);
      } catch (error) {
        throw error instanceof Error ? error : new Error("AI servisine ulaşılamadı.");
      }

      const questions = parseGeneratedQuestions(generatedText, topic, questionCount, questionPoints);
      const quiz = await insertQuiz(`${topic} Quiz`, `AI ile otomatik oluşturuldu. Konu: ${topic}`);
      await supabase.from("quiz_questions").insert(questions.map((question, index) => ({
        quiz_id: quiz.id,
        question: question.question,
        options: question.options,
        correct_index: question.correct_index,
        points: question.points,
        position: index,
      })));
      toast.success("AI quiz oluşturuldu");
      setOpen(false);
      setTopicPrompt("");
      onCreated();
    } catch (error: any) {
      toast.error(error.message ?? "Quiz oluşturulamadı");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">
          <Plus className="mr-1 h-4 w-4" /> Yeni quiz
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">Yeni quiz</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/40 p-4">
            <Label>AI ile hızlı quiz</Label>
            <div className="mt-2 flex gap-2">
              <Input value={topicPrompt} onChange={e => setTopicPrompt(e.target.value)} placeholder="Örn. Fotosentez, sınıflar, kalıtım..." className="rounded-xl" />
              <Button onClick={generateWithAi} disabled={generating} className="rounded-xl border-0 bg-gradient-hero text-primary-foreground">
                <Wand2 className="mr-1 h-4 w-4" /> {generating ? "Üretiyor" : "Üret"}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Soru sayısı</Label>
                <Input type="number" min={1} max={20} value={questionCount} onChange={e => setQuestionCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label>Soru puanı</Label>
                <Input type="number" min={1} value={questionPoints} onChange={e => setQuestionPoints(Math.max(1, Number(e.target.value) || 1))} className="mt-1 rounded-xl" />
              </div>
            </div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">Toplam: {questionCount * questionPoints} puan.</p>
          </div>

          <div><Label>Başlık</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 rounded-xl" /></div>
          <div><Label>Açıklama</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} className="mt-1 rounded-xl" rows={2} /></div>
          <div><Label>Süre (dakika)</Label><Input type="number" min={1} value={duration} onChange={e => setDuration(Math.max(1, Number(e.target.value) || 1))} className="mt-1 rounded-xl" /></div>
          <Button
            onClick={async () => {
              if (!title.trim()) return toast.error("Başlık gerekli");
              try {
                await insertQuiz(title, desc);
                setOpen(false);
                setTitle("");
                setDesc("");
                setDuration(DEFAULT_QUIZ_DURATION_MINUTES);
                onCreated();
              } catch (error: any) {
                toast.error(error.message);
              }
            }}
            className="w-full rounded-xl border-0 bg-gradient-hero text-primary-foreground"
          >
            Oluştur
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const QuizRow = ({ quiz, onChange }: { quiz: any; onChange: () => void }) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [points, setPoints] = useState(20);

  const load = async () => {
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position");
    setQuestions(data ?? []);
  };

  useEffect(() => {
    load();
  }, [quiz.id]);

  const addQuestion = async () => {
    if (!q.trim()) return toast.error("Soru gerekli");
    const filled = opts.filter(option => option.trim());
    if (filled.length < 2) return toast.error("En az 2 seçenek");
    await supabase.from("quiz_questions").insert({
      quiz_id: quiz.id,
      question: q,
      options: filled,
      correct_index: correct,
      points,
      position: questions.length,
    });
    setQ("");
    setOpts(["", "", "", ""]);
    setCorrect(0);
    setPoints(20);
    load();
  };

  return (
    <Card className="rounded-3xl border-0 p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-black">{quiz.title}</h3>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {getQuizDurationMinutes(quiz)} dk · {questions.length} soru
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? "Gizle" : "Soruları düzenle"}</Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!confirm("Quizi sil?")) return;
              await supabase.from("quizzes").delete().eq("id", quiz.id);
              onChange();
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {questions.map((question, index) => (
            <div key={question.id} className="flex items-start justify-between gap-2 rounded-2xl bg-muted/50 p-3">
              <div className="text-sm">
                <p className="font-semibold">{index + 1}. {question.question}</p>
                <p className="text-xs font-semibold text-primary">{question.points ?? 10} puan</p>
                <ul className="mt-1 space-y-0.5">
                  {(question.options as string[]).map((option: string, optionIndex: number) => (
                    <li key={optionIndex} className={optionIndex === question.correct_index ? "font-semibold text-secondary" : "text-muted-foreground"}>
                      {optionIndex === question.correct_index ? "✓" : "•"} {option}
                    </li>
                  ))}
                </ul>
              </div>
              <Button variant="ghost" size="icon" onClick={async () => { await supabase.from("quiz_questions").delete().eq("id", question.id); load(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="space-y-2 rounded-2xl border bg-card p-3">
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Soru..." className="rounded-xl" />
            <div>
              <Label>Soru puanı</Label>
              <Input type="number" min={1} value={points} onChange={e => setPoints(Math.max(1, Number(e.target.value) || 1))} className="mt-1 rounded-xl" />
            </div>
            {opts.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input type="radio" checked={correct === index} onChange={() => setCorrect(index)} className="h-4 w-4 accent-primary" />
                <Input value={option} onChange={e => {
                  const next = [...opts];
                  next[index] = e.target.value;
                  setOpts(next);
                }} placeholder={`Seçenek ${index + 1}${index === 0 ? " (doğruyu işaretle)" : ""}`} className="rounded-xl" />
              </div>
            ))}
            <Button onClick={addQuestion} size="sm" className="rounded-full border-0 bg-gradient-hero text-primary-foreground">
              <Plus className="mr-1 h-3.5 w-3.5" /> Soru ekle
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default TeacherCourseDetail;
