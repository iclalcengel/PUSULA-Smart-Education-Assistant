-- Teacher analytics visibility, rewards, leaderboard support and motivation email queue.

DROP POLICY IF EXISTS "Teachers view course lesson progress" ON public.lesson_progress;
CREATE POLICY "Teachers view course lesson progress"
ON public.lesson_progress
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.topics t ON t.id = l.topic_id
    JOIN public.courses c ON c.id = t.course_id
    WHERE l.id = lesson_id
      AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers view course quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Teachers view course quiz attempts"
ON public.quiz_attempts
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_id
      AND c.teacher_id = auth.uid()
  )
);

CREATE TABLE IF NOT EXISTS public.student_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  reward_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id, reward_key)
);

ALTER TABLE public.student_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own rewards" ON public.student_rewards;
CREATE POLICY "Students view own rewards"
ON public.student_rewards
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers view course rewards" ON public.student_rewards;
CREATE POLICY "Teachers view course rewards"
ON public.student_rewards
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_id
      AND c.teacher_id = auth.uid()
  )
);

CREATE TABLE IF NOT EXISTS public.motivation_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  recipient_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE public.motivation_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view course email queue" ON public.motivation_email_queue;
CREATE POLICY "Teachers view course email queue"
ON public.motivation_email_queue
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_id
      AND c.teacher_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.queue_quiz_reward_and_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_course_title TEXT;
  v_email TEXT;
  v_percent INT;
BEGIN
  SELECT q.course_id, c.title
  INTO v_course_id, v_course_title
  FROM public.quizzes q
  JOIN public.courses c ON c.id = q.course_id
  WHERE q.id = NEW.quiz_id;

  IF NEW.total > 0 THEN
    v_percent := ROUND((NEW.score::numeric / NEW.total::numeric) * 100);
  ELSE
    v_percent := 0;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = NEW.student_id;

  IF v_percent = 100 THEN
    INSERT INTO public.student_rewards (student_id, course_id, reward_key, title, description, points)
    VALUES (NEW.student_id, v_course_id, 'perfect_quiz_' || NEW.quiz_id, 'Tam Puan Rozeti', v_course_title || ' quizinde tam puan aldın.', 100)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.motivation_email_queue (student_id, course_id, recipient_email, subject, body)
    VALUES (
      NEW.student_id,
      v_course_id,
      v_email,
      'Harika iş çıkardın!',
      'Tebrikler! ' || v_course_title || ' kursundaki quizde tam puan aldın. Böyle devam!'
    );
  ELSIF v_percent >= 80 THEN
    INSERT INTO public.student_rewards (student_id, course_id, reward_key, title, description, points)
    VALUES (NEW.student_id, v_course_id, 'strong_quiz_' || NEW.quiz_id, 'Güçlü Başarı Rozeti', v_course_title || ' quizinde yüksek başarı gösterdin.', 60)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.motivation_email_queue (student_id, course_id, recipient_email, subject, body)
    VALUES (
      NEW.student_id,
      v_course_id,
      v_email,
      'Başarın yükseliyor!',
      'Güzel ilerliyorsun. ' || v_course_title || ' quizindeki başarın çok iyi. Bir sonraki hedef tam puan!'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_attempt_reward_email ON public.quiz_attempts;
CREATE TRIGGER quiz_attempt_reward_email
AFTER INSERT ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.queue_quiz_reward_and_email();
