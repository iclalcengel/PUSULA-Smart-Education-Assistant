CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Yeni sohbet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own chat sessions" ON public.chat_sessions FOR SELECT TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students create own chat sessions" ON public.chat_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update own chat sessions" ON public.chat_sessions FOR UPDATE TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students delete own chat sessions" ON public.chat_sessions FOR DELETE TO authenticated
USING (auth.uid() = student_id);

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_student ON public.chat_sessions(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at);

DROP TRIGGER IF EXISTS chat_sessions_updated ON public.chat_sessions;
CREATE TRIGGER chat_sessions_updated BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
