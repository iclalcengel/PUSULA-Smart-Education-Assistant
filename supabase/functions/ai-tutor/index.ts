// Course-aware AI tutor edge function - streams responses from Google Gemini.
// Grounds answers in lesson content for the selected course when provided.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const encoder = new TextEncoder();

const toOpenAISseChunk = (content: string) => (
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, courseId } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    let context = "";
    if (courseId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: course } = await supabase
        .from("courses")
        .select("title, description")
        .eq("id", courseId)
        .maybeSingle();

      const { data: topics } = await supabase
        .from("topics")
        .select("id, title")
        .eq("course_id", courseId);

      const topicIds = (topics ?? []).map((topic: any) => topic.id);
      let lessons: any[] = [];

      if (topicIds.length) {
        const { data: lessonData } = await supabase
          .from("lessons")
          .select("title, content, topic_id")
          .in("topic_id", topicIds);
        lessons = lessonData ?? [];
      }

      if (course) {
        context =
          `\n\nCOURSE CONTEXT (use this material to ground your answers when relevant):\n` +
          `Course: ${course.title}\n${course.description}\n\nLessons:\n` +
          lessons
            .map((lesson: any) => `### ${lesson.title}\n${(lesson.content || "").slice(0, 2000)}`)
            .join("\n\n");

        if (context.length > 12000) context = context.slice(0, 12000) + "\n...(truncated)";
      }
    }

    const systemPrompt = `Sen Pusula'sın: öğrenciler için sıcakkanlı, cesaretlendirici bir yapay zeka öğretmeni.
Görevin: konuları meraklı bir öğrenciye anlatan nazik bir öğretmen gibi sade biçimde açıklamak.
Her zaman Türkçe yanıt ver.

Kurallar:
- Net, yeni başlayan dostu bir dil kullan. Jargondan kaçın; bir terim kullanman gerekiyorsa tanımla.
- Kısa paragraflar, madde imleri, basit örnekler ve benzetmeler kullan.
- Sıcak ve cesaretlendirici ol.
- Faydalı olduğunda öğrencinin keşfedebileceği 1-2 ilgili konu öner.
- Netlik için markdown kullan.
- Soru belirsizse dostça bir açıklayıcı soru sor.
- Asla bilgi uydurma. Emin değilsen söyle.${context}`;

    const lastMessages = (messages ?? []).slice(-12);
    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      ...lastMessages.map((message: any) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: String(message.content ?? "") }],
      })),
    ];

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1200,
          },
        }),
      },
    );

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Gemini kotası doldu veya çok fazla istek atıldı." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok || !response.body) {
      const text = await response.text();
      console.error("Gemini API:", response.status, text);
      return new Response(JSON.stringify({ error: "Gemini API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let index: number;

            while ((index = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, index);
              buffer = buffer.slice(index + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;

              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts
                  ?.map((part: any) => part.text ?? "")
                  .join("");

                if (text) controller.enqueue(encoder.encode(toOpenAISseChunk(text)));
              } catch (error) {
                console.error("Gemini stream parse error:", error);
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-tutor error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
