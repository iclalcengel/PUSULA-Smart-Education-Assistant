import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, MessageCircleHeart, Trash2, Plus, Clock3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string; }

interface ChatSession {
  id: string;
  title: string;
  course_id: string | null;
  updated_at: string;
}

const SUGGESTIONS = {
  tr: [
    "Fotosentezi basitçe anlat",
    "Pisagor teoremi nedir?",
    "Kesirleri anlamama yardım et",
    "Bana 3 çalışma ipucu ver",
  ],
  en: [
    "Explain photosynthesis simply",
    "What is the Pythagorean theorem?",
    "Help me understand fractions",
    "Give me 3 study tips",
  ],
};

const titleFromMessage = (content: string) => {
  const title = content.replace(/\s+/g, " ").trim();
  return title.length > 42 ? `${title.slice(0, 42)}...` : title || "New chat";
};

const normalize = (value: string) => value.toLocaleLowerCase("tr-TR");

const StudentChat = () => {
  const { user, session } = useAuth();
  const { language, t } = usePreferences();
  const [params] = useSearchParams();
  const [courseId, setCourseId] = useState<string>(params.get("course") || "all");
  const [courses, setCourses] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSessions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, title, course_id, updated_at")
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error(error.message);
      return;
    }
    setChatSessions((data ?? []) as ChatSession[]);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("course_id")
        .eq("student_id", user.id);
      const courseIds = (enrollments ?? []).map(item => item.course_id);
      const { data: c } = courseIds.length
        ? await supabase.from("courses").select("id, title, emoji").in("id", courseIds)
        : { data: [] };
      setCourses(c ?? []);
      setMessages([]);
      setActiveSessionId(null);
      loadSessions();
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const startNewChat = (nextCourseId = courseId) => {
    setCourseId(nextCourseId);
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  };

  const selectCourse = (nextCourseId: string) => {
    startNewChat(nextCourseId);
  };

  const loadChatSession = async (chatSession: ChatSession) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", chatSession.id)
      .order("created_at");

    if (error) {
      toast.error(error.message);
      return;
    }

    setActiveSessionId(chatSession.id);
    setCourseId(chatSession.course_id ?? "all");
    setMessages((data as Msg[]) ?? []);
    setInput("");
  };

  const ensureChatSession = async (firstMessage: string) => {
    if (activeSessionId) return activeSessionId;

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        student_id: user!.id,
        course_id: courseId === "all" ? null : courseId,
        title: titleFromMessage(firstMessage),
      })
      .select("id, title, course_id, updated_at")
      .single();

    if (error) throw error;

    const created = data as ChatSession;
    setActiveSessionId(created.id);
    setChatSessions(current => [created, ...current]);
    return created.id;
  };

  const buildLocalFallback = async (question: string) => {
    if (courseId === "all") {
      return [
        t("chat.localGeneralIntro"),
        "",
        `**${t("chat.localStudyTipLabel")}** ${t("chat.localStudyTip")}`,
        "",
        t("chat.localPickCourse"),
      ].join("\n");
    }

    const { data: topics } = await supabase.from("topics").select("id, title").eq("course_id", courseId);
    const topicIds = (topics ?? []).map(topic => topic.id);
    if (topicIds.length === 0) return t("chat.localNoTopics");

    const { data: lessons } = await supabase
      .from("lessons")
      .select("title, content, topic_id")
      .in("topic_id", topicIds);

    if (!lessons?.length) return t("chat.localNoLessons");

    const terms = normalize(question)
      .split(/[^a-zA-Z0-9]+/)
      .filter(term => term.length > 2);

    const ranked = lessons
      .map(lesson => {
        const haystack = normalize(`${lesson.title} ${lesson.content ?? ""}`);
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { lesson, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0]?.lesson ?? lessons[0];
    const excerpt = (best.content || "This lesson content is still short.")
      .replace(/\s+/g, " ")
      .slice(0, 650);

    return [
      t("chat.localCourseIntro"),
      "",
      `**${t("chat.relatedLesson")}** ${best.title}`,
      "",
      excerpt,
      "",
      `**${t("chat.howToStudy")}** ${t("chat.howToStudyText")}`,
    ].join("\n");
  };

  const persistMessage = async (sessionId: string, role: Msg["role"], content: string) => {
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      student_id: user!.id,
      course_id: courseId === "all" ? null : courseId,
      role,
      content,
    });
    await supabase.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setInput("");
    setLoading(true);

    let sessionId = activeSessionId;
    try {
      sessionId = await ensureChatSession(content);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const newMessages: Msg[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    await persistMessage(sessionId, "user", content);

    let assistant = "";
    setMessages(current => [...current, { role: "assistant", content: "" }]);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, courseId: courseId === "all" ? null : courseId, language }),
      });

      if (resp.status === 429) {
        assistant = await buildLocalFallback(content);
        setMessages(current => current.map((msg, i) => i === current.length - 1 ? { role: "assistant", content: assistant } : msg));
        toast.info(t("chat.tooManyRequestsFallbackToast"));
      } else if (!resp.ok || !resp.body) {
        let errorMessage = `${t("chat.aiRequestFailed")} ${resp.status}`;
        try {
          const responseText = await resp.text();
          try {
            const payload = JSON.parse(responseText);
            errorMessage = payload.error ? `${errorMessage}: ${payload.error}` : `${errorMessage}: ${responseText}`;
          } catch {
            if (responseText) errorMessage = `${errorMessage}: ${responseText.slice(0, 300)}`;
          }
        } catch {}
        throw new Error(errorMessage);
      } else {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { done: readerDone, value } = await reader.read();
          if (readerDone) break;

          buffer += decoder.decode(value, { stream: true });
          let idx: number;

          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;

            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistant += delta;
                setMessages(current => current.map((msg, i) => i === current.length - 1 ? { ...msg, content: assistant } : msg));
              }
            } catch {
              buffer = `${line}\n${buffer}`;
              break;
            }
          }
        }
      }

      if (!assistant.trim()) assistant = await buildLocalFallback(content);
      await persistMessage(sessionId, "assistant", assistant);
      loadSessions();
    } catch (error: any) {
      const message = error?.message || t("chat.aiFailed");
      setMessages(current => current.map((msg, i) => i === current.length - 1
        ? { role: "assistant", content: `${t("chat.errorPrefix")}\n\n**${t("chat.errorLabel")}** ${message}` }
        : msg
      ));
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteActiveChat = async () => {
    if (!activeSessionId) {
      startNewChat();
      return;
    }
    if (!confirm(t("chat.deleteConfirm"))) return;
    await supabase.from("chat_sessions").delete().eq("id", activeSessionId);
    setChatSessions(current => current.filter(chatSession => chatSession.id !== activeSessionId));
    startNewChat();
  };

  const courseLabel = (sessionCourseId: string | null) => {
    if (!sessionCourseId) return t("chat.generalHelp");
    const course = courses.find(item => item.id === sessionCourseId);
    return course ? `${course.emoji} ${course.title}` : t("chat.courseChat");
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-hero shadow-pop">
            <MessageCircleHeart className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black">{t("chat.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("chat.subtitle")}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={deleteActiveChat}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="flex h-[65vh] flex-col rounded-3xl border-0 p-4 shadow-card">
          <Button onClick={() => startNewChat()} className="mb-4 rounded-full bg-foreground text-background hover:bg-foreground/90">
            <Plus className="mr-1 h-4 w-4" /> {t("chat.newChat")}
          </Button>
          <h2 className="mb-3 font-display text-lg font-black">{t("chat.chats")}</h2>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {chatSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("chat.noOldChats")}</p>
            ) : (
              chatSessions.map(chatSession => (
                <button
                  key={chatSession.id}
                  onClick={() => loadChatSession(chatSession)}
                  className={`w-full rounded-2xl p-3 text-left transition-all ${activeSessionId === chatSession.id ? "bg-foreground text-background" : "bg-muted/60 hover:bg-muted"}`}
                >
                  <p className="line-clamp-2 text-sm font-semibold">{chatSession.title}</p>
                  <p className={`mt-1 line-clamp-1 text-xs ${activeSessionId === chatSession.id ? "text-background/70" : "text-muted-foreground"}`}>
                    {courseLabel(chatSession.course_id)}
                  </p>
                  <p className={`mt-1 inline-flex items-center gap-1 text-[11px] ${activeSessionId === chatSession.id ? "text-background/60" : "text-muted-foreground"}`}>
                    <Clock3 className="h-3 w-3" /> {new Date(chatSession.updated_at).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US")}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>

        <div>
          <div className="mb-4">
            <select
              value={courseId}
              onChange={event => selectCourse(event.target.value)}
              className="rounded-full border bg-card px-4 py-2 text-sm font-semibold shadow-card focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{t("chat.generalHelp")}</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.emoji} {course.title}</option>)}
            </select>
          </div>

          <Card className="flex h-[65vh] flex-col overflow-hidden rounded-3xl border-0 shadow-card">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
              {messages.length === 0 && (
                <div className="py-10 text-center">
                  <Sparkles className="mx-auto mb-3 h-10 w-10 animate-float text-primary" />
                  <p className="mb-1 font-display text-xl font-bold">{t("chat.emptyTitle")}</p>
                  <p className="mb-6 text-sm text-muted-foreground">{t("chat.emptyText")}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS[language].map(suggestion => (
                      <button key={suggestion} onClick={() => send(suggestion)} className="rounded-full bg-muted px-4 py-2 text-sm font-semibold transition-all hover:bg-muted/70">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message, index) => (
                <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-gradient-hero shadow-soft">
                      <Sparkles className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-3xl px-4 py-3 ${message.role === "user" ? "rounded-tr-md bg-foreground text-background" : "rounded-tl-md bg-muted"}`}>
                    {message.role === "assistant" ? (
                      <div className="prose-chat text-sm">
                        {message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : (
                          <span className="inline-flex gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "0.1s" }} />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "0.2s" }} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t bg-card p-4">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}
                  placeholder={t("chat.placeholder")}
                  className="max-h-32 min-h-[48px] resize-none rounded-2xl"
                  rows={1}
                  disabled={loading}
                />
                <Button onClick={() => send()} disabled={loading || !input.trim()} className="h-12 w-12 flex-shrink-0 rounded-2xl border-0 bg-gradient-hero p-0 text-primary-foreground shadow-pop">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default StudentChat;
