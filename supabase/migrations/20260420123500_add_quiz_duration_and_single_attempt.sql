ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 10 CHECK (duration_minutes > 0);

DELETE FROM public.quiz_attempts
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (PARTITION BY quiz_id, student_id ORDER BY created_at ASC, id ASC) AS attempt_order
    FROM public.quiz_attempts
  ) duplicate_attempts
  WHERE attempt_order > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_per_student
ON public.quiz_attempts (quiz_id, student_id);
