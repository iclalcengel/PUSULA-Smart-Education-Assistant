import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, ListChecks, Megaphone, CheckCircle2, Circle, MessageCircleHeart, Clock, Trophy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getQuizDurationMinutes, stripQuizDurationMarker } from "@/lib/quiz";

interface LeaderboardRow {
  studentId: string;
  name: string;
  score: number;
  total: number;
  average: number;
  attempts: number;
  completedLessons: number;
  points: number;
}

const StudentCourseDetail = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [lessonsByTopic, setLessonsByTopic] = useState<Record<string, any[]>>({});
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [progress, setProgress] = useState<Set<string>>(new Set());
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (!courseId || !user) return;
    const { data: c } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
    const { data: teacherProfile } = c?.teacher_id
      ? await supabase.from("profiles").select("display_name").eq("id", c.teacher_id).maybeSingle()
      : { data: null };
    setCourse(c ? { ...c, profiles: teacherProfile } : null);
    const { data: t } = await supabase.from("topics").select("*").eq("course_id", courseId).order("position");
    setTopics(t ?? []);
    let lessonIds: string[] = [];
    if (t?.length) {
      const { data: l } = await supabase.from("lessons").select("*").in("topic_id", t.map(x => x.id)).order("position");
      lessonIds = (l ?? []).map(lesson => lesson.id);
      const grouped: Record<string, any[]> = {};
      (l ?? []).forEach(ls => { (grouped[ls.topic_id] ||= []).push(ls); });
      setLessonsByTopic(grouped);
      const { data: lp } = await supabase.from("lesson_progress").select("lesson_id").eq("student_id", user.id).in("lesson_id", (l ?? []).map(x => x.id));
      setProgress(new Set((lp ?? []).map(x => x.lesson_id)));
    } else {
      setLessonsByTopic({});
      setProgress(new Set());
    }
    const { data: a } = await supabase.from("announcements").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
    setAnnouncements(a ?? []);
    const { data: q } = await supabase.from("quizzes").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
    const quizIds = (q ?? []).map(quiz => quiz.id);
    const { data: attempts } = quizIds.length
      ? await supabase.from("quiz_attempts").select("id, quiz_id, score, total, created_at").eq("student_id", user.id).in("quiz_id", quizIds)
      : { data: [] };
    const attemptsByQuizId = new Map((attempts ?? []).map(attempt => [attempt.quiz_id, attempt]));
    setQuizzes((q ?? []).map(quiz => ({ ...quiz, attempt: attemptsByQuizId.get(quiz.id) })));
    await loadLeaderboard(quizIds, lessonIds);
    setLoaded(true);
  };

  const loadLeaderboard = async (quizIds: string[], lessonIds: string[]) => {
    const [{ data: attempts }, { data: progressRows }] = await Promise.all([
      quizIds.length
        ? supabase.from("quiz_attempts").select("student_id, score, total, quiz_id, created_at").in("quiz_id", quizIds)
        : Promise.resolve({ data: [] as any[] }),
      lessonIds.length
        ? supabase.from("lesson_progress").select("student_id, lesson_id").in("lesson_id", lessonIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const studentIds = [...new Set([...(attempts ?? []).map(item => item.student_id), ...(progressRows ?? []).map(item => item.student_id)])];
    const { data: profiles } = studentIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", studentIds)
      : { data: [] };
    const profilesById = new Map((profiles ?? []).map(profile => [profile.id, profile.display_name]));
    const rows = new Map<string, LeaderboardRow>();
    const ensure = (studentId: string) => {
      if (!rows.has(studentId)) {
        rows.set(studentId, {
          studentId,
          name: profilesById.get(studentId) || "Öğrenci",
          score: 0,
          total: 0,
          average: 0,
          attempts: 0,
          completedLessons: 0,
          points: 0,
        });
      }
      return rows.get(studentId)!;
    };

    (attempts ?? []).forEach(attempt => {
      const row = ensure(attempt.student_id);
      row.score += attempt.score ?? 0;
      row.total += attempt.total ?? 0;
      row.attempts += 1;
    });
    (progressRows ?? []).forEach(item => {
      ensure(item.student_id).completedLessons += 1;
    });

    setLeaderboard([...rows.values()].map(row => ({
      ...row,
      average: row.total ? Math.round((row.score / row.total) * 100) : 0,
      points: row.score + row.completedLessons * 5,
    })).sort((a, b) => b.points - a.points || b.average - a.average));
  };
  useEffect(() => { load(); }, [courseId, user]);

  const toggleComplete = async (lessonId: string) => {
    if (progress.has(lessonId)) {
      await supabase.from("lesson_progress").delete().eq("lesson_id", lessonId).eq("student_id", user!.id);
    } else {
      await supabase.from("lesson_progress").insert({ lesson_id: lessonId, student_id: user!.id });
    }
    load();
  };

  if (!loaded) return <AppLayout><div className="h-64 grid place-items-center"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div></AppLayout>;
  if (!course) return <AppLayout><Card className="rounded-3xl border-0 p-8 shadow-card"><h2 className="font-display text-2xl font-black">Bu kursa erişemiyorsun</h2><p className="mt-2 text-muted-foreground">Önce kurs kodu ile katılman gerekiyor.</p></Card></AppLayout>;

  if (activeLesson) return <LessonView lesson={activeLesson} courseId={courseId!} onBack={() => setActiveLesson(null)} done={progress.has(activeLesson.id)} onToggle={() => toggleComplete(activeLesson.id)} />;
  if (activeQuiz) return <QuizView quiz={activeQuiz} onBack={() => { setActiveQuiz(null); load(); }} />;

  return (
    <AppLayout>
      <Link to="/student" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Geri
      </Link>
      <div className="flex items-start gap-4 mb-8">
        <div className="text-6xl">{course.emoji}</div>
        <div>
          <h1 className="font-display font-black text-4xl">{course.title}</h1>
          <p className="text-muted-foreground">{course.description}</p>
          <p className="text-xs text-muted-foreground mt-1">Eğitmen: {course.profiles?.display_name}</p>
        </div>
      </div>

      <Tabs defaultValue="lessons">
        <TabsList className="rounded-full bg-muted p-1 h-12">
          <TabsTrigger value="lessons" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft"><BookOpen className="w-4 h-4 mr-1.5" />Dersler</TabsTrigger>
          <TabsTrigger value="quizzes" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft"><ListChecks className="w-4 h-4 mr-1.5" />Quizler</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft"><Trophy className="w-4 h-4 mr-1.5" />Sıralama</TabsTrigger>
          <TabsTrigger value="news" className="rounded-full px-5 data-[state=active]:bg-card data-[state=active]:shadow-soft"><Megaphone className="w-4 h-4 mr-1.5" />Haberler</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="mt-6 space-y-4">
          {topics.length === 0 && <Card className="rounded-3xl p-10 text-center border-2 border-dashed bg-card/50"><p className="text-muted-foreground">Henüz ders yok.</p></Card>}
          {topics.map(t => (
            <Card key={t.id} className="rounded-3xl p-6 border-0 shadow-card">
              <h3 className="font-display font-black text-xl mb-1">{t.title}</h3>
              {t.description && <p className="text-muted-foreground text-sm mb-3">{t.description}</p>}
              <div className="space-y-2">
                {(lessonsByTopic[t.id] ?? []).map(l => (
                  <button key={l.id} onClick={() => setActiveLesson(l)} className="w-full flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted rounded-2xl transition-all text-left">
                    {progress.has(l.id) ? <CheckCircle2 className="w-5 h-5 text-secondary" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                    <span className="font-semibold flex-1">{l.title}</span>
                  </button>
                ))}
                {(lessonsByTopic[t.id] ?? []).length === 0 && <p className="text-sm text-muted-foreground">Bu konuda henüz ders yok.</p>}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6 space-y-4">
          {quizzes.length === 0 && <Card className="rounded-3xl p-10 text-center border-2 border-dashed bg-card/50"><p className="text-muted-foreground">Henüz quiz yok.</p></Card>}
          {quizzes.map(q => (
            <Card key={q.id} className="rounded-3xl p-5 border-0 shadow-card flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-black text-xl">{q.title}</h3>
                <p className="text-muted-foreground text-sm">{stripQuizDurationMarker(q.description)}</p>
                <p className="text-muted-foreground text-xs inline-flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5" /> {getQuizDurationMinutes(q)} dk
                  {q.attempt ? ` · Puan: ${q.attempt.score}/${q.attempt.total}` : ""}
                </p>
              </div>
              <Button
                onClick={() => setActiveQuiz(q)}
                disabled={Boolean(q.attempt)}
                className="rounded-full bg-gradient-hero text-primary-foreground border-0 shadow-soft disabled:opacity-60"
              >
                {q.attempt ? "Çözüldü" : "Başla"}
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <Card className="rounded-3xl p-6 border-0 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-black text-2xl">Liderlik tablosu</h2>
                <p className="text-sm text-muted-foreground">Quiz puanı ve tamamlanan derslere göre sıralama.</p>
              </div>
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            {leaderboard.length === 0 ? (
              <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Henüz sıralama verisi yok.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((row, index) => {
                  const isMe = row.studentId === user?.id;
                  return (
                    <div key={row.studentId} className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl p-3 ${isMe ? "bg-primary/15 ring-2 ring-primary/35" : "bg-muted/50"}`}>
                      <div className={`grid h-9 w-9 place-items-center rounded-full font-black ${index === 0 ? "bg-gradient-sunny text-primary-foreground" : "bg-card"}`}>{index + 1}</div>
                      <div>
                        <p className="font-bold">{row.name}{isMe ? " (Sen)" : ""}</p>
                        <p className="text-xs text-muted-foreground">{row.attempts} quiz · {row.completedLessons} ders · başarı %{row.average}</p>
                      </div>
                      <p className="font-display text-2xl font-black">{row.points}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="news" className="mt-6 space-y-3">
          {announcements.length === 0 && <Card className="rounded-3xl p-10 text-center border-2 border-dashed bg-card/50"><p className="text-muted-foreground">Duyuru yok.</p></Card>}
          {announcements.map(a => (
            <Card key={a.id} className="rounded-3xl p-5 border-0 shadow-card">
              <h3 className="font-bold text-lg">{a.title}</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{a.body}</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString("tr-TR")}</p>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

const LessonView = ({ lesson, courseId, onBack, done, onToggle }: any) => (
  <AppLayout>
    <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground mb-4">
      <ArrowLeft className="w-4 h-4" /> Kursa dön
    </button>
    <Card className="rounded-3xl p-8 border-0 shadow-card max-w-3xl">
      <h1 className="font-display font-black text-4xl mb-4">{lesson.title}</h1>
      <div className="prose-chat text-foreground/90 leading-relaxed">
        <ReactMarkdown>{lesson.content || "_İçerik henüz yok._"}</ReactMarkdown>
      </div>
      <div className="flex items-center gap-3 mt-8 pt-6 border-t">
        <Button onClick={onToggle} variant={done ? "secondary" : "default"} className="rounded-full">
          {done ? <><CheckCircle2 className="w-4 h-4 mr-1" />Tamamlandı</> : "Tamamlandı olarak işaretle"}
        </Button>
        <Link to={`/student/chat?course=${courseId}`}>
          <Button variant="outline" className="rounded-full"><MessageCircleHeart className="w-4 h-4 mr-1" />Bunu AI'ya sor</Button>
        </Link>
      </div>
    </Card>
  </AppLayout>
);

const formatQuizTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const QuizView = ({ quiz, onBack }: any) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<{ score: number; total: number; timedOut?: boolean } | null>(null);
  const [existingAttempt, setExistingAttempt] = useState<any>(quiz.attempt ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const durationSeconds = getQuizDurationMinutes(quiz) * 60;
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => { (async () => {
    setAnswers({});
    setSubmitted(null);
    setExistingAttempt(quiz.attempt ?? null);
    setTimeLeft(durationSeconds);
    const [{ data: questionData }, { data: attemptData }] = await Promise.all([
      supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position"),
      supabase.from("quiz_attempts").select("id, quiz_id, score, total, created_at").eq("quiz_id", quiz.id).eq("student_id", user!.id).maybeSingle(),
    ]);
    setQuestions(questionData ?? []);
    if (attemptData) setExistingAttempt(attemptData);
  })(); }, [quiz.id, user]);

  const submit = async (timedOut = false) => {
    if (isSubmitting || submitted || existingAttempt) return;
    setIsSubmitting(true);
    let score = 0;
    const totalPoints = questions.reduce((sum, question) => sum + Number(question.points ?? 10), 0);
    questions.forEach(q => { if (answers[q.id] === q.correct_index) score += Number(q.points ?? 10); });
    const { data, error } = await supabase
      .from("quiz_attempts")
      .insert({ quiz_id: quiz.id, student_id: user!.id, score, total: totalPoints, answers })
      .select("id, quiz_id, score, total, created_at")
      .single();
    setIsSubmitting(false);
    if (error) {
      toast.error(error.code === "23505" ? "Bu quizi zaten çözdün." : error.message);
      if (error.code === "23505") onBack();
      return;
    }
    setExistingAttempt(data);
    setSubmitted({ score, total: totalPoints, timedOut });
  };

  useEffect(() => {
    if (existingAttempt || submitted || questions.length === 0) return;
    if (timeLeft <= 0) {
      submit(true);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft(current => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, existingAttempt, submitted, questions.length]);

  return (
    <AppLayout>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>
      <Card className="rounded-3xl p-8 border-0 shadow-card max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="font-display font-black text-3xl">{quiz.title}</h1>
          {!existingAttempt && !submitted && questions.length > 0 && (
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold ${timeLeft <= 60 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
              <Clock className="w-4 h-4" /> {formatQuizTime(timeLeft)}
            </div>
          )}
        </div>
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-3">{submitted.score === submitted.total ? "🎉" : submitted.score >= submitted.total / 2 ? "👍" : "💪"}</div>
            <h2 className="font-display font-black text-4xl mb-2">{submitted.score} / {submitted.total}</h2>
            <p className="text-muted-foreground mb-6">{submitted.timedOut ? "Süre doldu, cevapların gönderildi." : submitted.score === submitted.total ? "Tam puan!" : "Devam et!"}</p>
            <Button onClick={onBack} className="rounded-full bg-gradient-hero text-primary-foreground border-0">Tamam</Button>
          </div>
        ) : existingAttempt ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto text-secondary mb-3" />
            <h2 className="font-display font-black text-3xl mb-2">Bu quizi çözdün</h2>
            <p className="text-muted-foreground mb-6">Puan: {existingAttempt.score} / {existingAttempt.total}</p>
            <Button onClick={onBack} className="rounded-full bg-gradient-hero text-primary-foreground border-0">Tamam</Button>
          </div>
        ) : questions.length === 0 ? (
          <p className="text-muted-foreground">Bu quizde henüz soru yok.</p>
        ) : (
          <div className="space-y-6">
            {questions.map((q, i) => (
              <div key={q.id}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="font-bold">{i + 1}. {q.question}</p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{q.points ?? 10} puan</span>
                </div>
                <div className="space-y-2">
                  {(q.options as string[]).map((o: string, idx: number) => (
                    <label key={idx} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${answers[q.id] === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers({ ...answers, [q.id]: idx })} disabled={isSubmitting || timeLeft <= 0} className="w-4 h-4 accent-primary" />
                      <span className="text-sm">{o}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={() => submit(false)} disabled={Object.keys(answers).length !== questions.length || isSubmitting || timeLeft <= 0} className="w-full rounded-full bg-gradient-hero text-primary-foreground border-0 h-12 font-bold">
              {isSubmitting ? "Gönderiliyor..." : "Cevapları gönder"}
            </Button>
          </div>
        )}
      </Card>
    </AppLayout>
  );
};

export default StudentCourseDetail;
