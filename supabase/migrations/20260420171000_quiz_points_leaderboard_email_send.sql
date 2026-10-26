-- Point-based quiz scoring, student leaderboard visibility, and real email queue sending support.

ALTER TABLE public.quiz_questions
ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 10 CHECK (points > 0);

DROP POLICY IF EXISTS "Course leaderboard attempts are visible" ON public.quiz_attempts;
CREATE POLICY "Course leaderboard attempts are visible"
ON public.quiz_attempts
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.quizzes q
    WHERE q.id = quiz_id
  )
);

DROP POLICY IF EXISTS "Course leaderboard progress is visible" ON public.lesson_progress;
CREATE POLICY "Course leaderboard progress is visible"
ON public.lesson_progress
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    WHERE l.id = lesson_id
  )
);

DROP POLICY IF EXISTS "Students view own email queue" ON public.motivation_email_queue;
CREATE POLICY "Students view own email queue"
ON public.motivation_email_queue
FOR SELECT TO authenticated
USING (auth.uid() = student_id);
