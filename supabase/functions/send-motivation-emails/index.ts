import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("MOTIVATION_FROM_EMAIL") || "Pusula <onboarding@resend.dev>";
    if (!resendKey) throw new Error("RESEND_API_KEY secret tanımlı değil.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pending, error } = await supabase
      .from("motivation_email_queue")
      .select("id, recipient_email, subject, body")
      .eq("status", "pending")
      .not("recipient_email", "is", null)
      .limit(25);

    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const email of pending ?? []) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email.recipient_email,
            subject: email.subject,
            text: email.body,
          }),
        });

        if (!response.ok) throw new Error(await response.text());

        await supabase
          .from("motivation_email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", email.id);
        sent += 1;
      } catch (sendError) {
        console.error("send email failed", email.id, sendError);
        await supabase
          .from("motivation_email_queue")
          .update({ status: "failed" })
          .eq("id", email.id);
        failed += 1;
      }
    }

    return new Response(JSON.stringify({ sent, failed, pending: pending?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
