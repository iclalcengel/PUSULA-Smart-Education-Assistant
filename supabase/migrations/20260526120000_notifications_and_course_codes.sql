-- In-app notifications and course codes / enrollments.

CREATE OR REPLACE FUNCTION public.generate_course_code(course_title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_code TEXT;
  suffix TEXT;
  candidate TEXT;
BEGIN
  base_code := upper(regexp_replace(coalesce(course_title, 'KURS'), '[^A-Za-z0-9]+', '', 'g'));
  base_code := left(base_code, 6);

  IF base_code = '' THEN
    base_code := 'KURS';
  END IF;

  LOOP
    suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    candidate := base_code || '-' || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.courses WHERE course_code = candidate);
  END LOOP;

  RETURN candidate;
END;
$$;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS course_code TEXT;

UPDATE public.courses
SET course_code = public.generate_course_code(title)
WHERE course_code IS NULL OR btrim(course_code) = '';

ALTER TABLE public.courses
ALTER COLUMN course_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_course_code_unique
ON public.courses(course_code);

CREATE OR REPLACE FUNCTION public.set_course_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.course_code IS NULL OR btrim(NEW.course_code) = '' THEN
    NEW.course_code := public.generate_course_code(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_course_code_before_insert ON public.courses;
CREATE TRIGGER set_course_code_before_insert
BEFORE INSERT ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.set_course_code();

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own enrollments" ON public.course_enrollments;
CREATE POLICY "Students view own enrollments"
ON public.course_enrollments
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students join courses" ON public.course_enrollments;
CREATE POLICY "Students join courses"
ON public.course_enrollments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student')
);

DROP POLICY IF EXISTS "Teachers view course enrollments" ON public.course_enrollments;
CREATE POLICY "Teachers view course enrollments"
ON public.course_enrollments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_id
      AND c.teacher_id = auth.uid()
  )
);

INSERT INTO public.course_enrollments (course_id, student_id)
SELECT DISTINCT q.course_id, qa.student_id
FROM public.quiz_attempts qa
JOIN public.quizzes q ON q.id = qa.quiz_id
ON CONFLICT (course_id, student_id) DO NOTHING;

INSERT INTO public.course_enrollments (course_id, student_id)
SELECT DISTINCT t.course_id, lp.student_id
FROM public.lesson_progress lp
JOIN public.lessons l ON l.id = lp.lesson_id
JOIN public.topics t ON t.id = l.topic_id
ON CONFLICT (course_id, student_id) DO NOTHING;

INSERT INTO public.course_enrollments (course_id, student_id)
SELECT DISTINCT cs.course_id, cs.student_id
FROM public.chat_sessions cs
WHERE cs.course_id IS NOT NULL
ON CONFLICT (course_id, student_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_reference_key
ON public.notifications(user_id, reference_key);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own notifications" ON public.notifications;
CREATE POLICY "Students view own notifications"
ON public.notifications
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own notifications" ON public.notifications;
CREATE POLICY "Students update own notifications"
ON public.notifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers view course notifications" ON public.notifications;
CREATE POLICY "Teachers view course notifications"
ON public.notifications
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = course_id
      AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone authenticated can view courses" ON public.courses;
CREATE POLICY "Teachers and enrolled students view courses"
ON public.courses
FOR SELECT TO authenticated
USING (
  auth.uid() = teacher_id
  OR EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    WHERE ce.course_id = courses.id
      AND ce.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "View topics" ON public.topics;
CREATE POLICY "Teachers and enrolled students view topics"
ON public.topics
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = topics.course_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "View lessons" ON public.lessons;
CREATE POLICY "Teachers and enrolled students view lessons"
ON public.lessons
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.topics t
    JOIN public.courses c ON c.id = t.course_id
    WHERE t.id = lessons.topic_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "View announcements" ON public.announcements;
CREATE POLICY "Teachers and enrolled students view announcements"
ON public.announcements
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = announcements.course_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "View quizzes" ON public.quizzes;
CREATE POLICY "Teachers and enrolled students view quizzes"
ON public.quizzes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = quizzes.course_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "View quiz questions" ON public.quiz_questions;
CREATE POLICY "Teachers and enrolled students view quiz questions"
ON public.quiz_questions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_questions.quiz_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Students view own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Course leaderboard attempts are visible" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Teachers view course quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Course members view attempts"
ON public.quiz_attempts
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.courses c ON c.id = q.course_id
    WHERE q.id = quiz_attempts.quiz_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Students view own progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Course leaderboard progress is visible" ON public.lesson_progress;
DROP POLICY IF EXISTS "Teachers view course lesson progress" ON public.lesson_progress;
CREATE POLICY "Course members view progress"
ON public.lesson_progress
FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.topics t ON t.id = l.topic_id
    JOIN public.courses c ON c.id = t.course_id
    WHERE l.id = lesson_progress.lesson_id
      AND (
        c.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.course_id = c.id
            AND ce.student_id = auth.uid()
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.join_course_by_code(input_code TEXT)
RETURNS public.courses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code TEXT;
  target_course public.courses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT public.has_role(auth.uid(), 'student') THEN
    RAISE EXCEPTION 'ONLY_STUDENTS_CAN_JOIN';
  END IF;

  normalized_code := upper(btrim(coalesce(input_code, '')));

  IF normalized_code = '' THEN
    RAISE EXCEPTION 'INVALID_COURSE_CODE';
  END IF;

  SELECT *
  INTO target_course
  FROM public.courses
  WHERE course_code = normalized_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    WHERE ce.course_id = target_course.id
      AND ce.student_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'ALREADY_ENROLLED';
  END IF;

  INSERT INTO public.course_enrollments (course_id, student_id)
  VALUES (target_course.id, auth.uid());

  INSERT INTO public.notifications (user_id, course_id, title, message, type, reference_key)
  VALUES (
    auth.uid(),
    target_course.id,
    'Kursa katıldın',
    target_course.title || ' kursuna başarıyla katıldın.',
    'success',
    'joined_' || target_course.id
  )
  ON CONFLICT (user_id, reference_key) DO NOTHING;

  RETURN target_course;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_quiz_reward_and_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_course_title TEXT;
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

  IF v_percent >= 80 THEN
    INSERT INTO public.notifications (user_id, course_id, title, message, type, reference_key)
    VALUES (
      NEW.student_id,
      v_course_id,
      'Tebrikler!',
      'Bugünkü quizde yüksek başarı gösterdin.',
      'success',
      'quiz_success_' || NEW.id
    )
    ON CONFLICT (user_id, reference_key) DO NOTHING;
  END IF;

  IF v_percent = 100 THEN
    INSERT INTO public.student_rewards (student_id, course_id, reward_key, title, description, points)
    VALUES (
      NEW.student_id,
      v_course_id,
      'perfect_quiz_' || NEW.quiz_id,
      'Tam Puan Rozeti',
      v_course_title || ' quizinde tam puan aldın.',
      100
    )
    ON CONFLICT DO NOTHING;
  ELSIF v_percent >= 80 THEN
    INSERT INTO public.student_rewards (student_id, course_id, reward_key, title, description, points)
    VALUES (
      NEW.student_id,
      v_course_id,
      'strong_quiz_' || NEW.quiz_id,
      'Güçlü Başarı Rozeti',
      v_course_title || ' quizinde yüksek başarı gösterdin.',
      60
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_reward_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, course_id, title, message, type, reference_key)
  VALUES (
    NEW.student_id,
    NEW.course_id,
    'Yeni bir rozet kazandın!',
    NEW.title || ' rozeti hesabına eklendi.',
    'reward',
    'reward_' || NEW.id
  )
  ON CONFLICT (user_id, reference_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_reward_unlock_trigger ON public.student_rewards;
CREATE TRIGGER notify_reward_unlock_trigger
AFTER INSERT ON public.student_rewards
FOR EACH ROW EXECUTE FUNCTION public.notify_reward_unlock();

CREATE OR REPLACE FUNCTION public.notify_weekly_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_week_count INT;
  v_week_key TEXT;
BEGIN
  SELECT t.course_id
  INTO v_course_id
  FROM public.lessons l
  JOIN public.topics t ON t.id = l.topic_id
  WHERE l.id = NEW.lesson_id;

  SELECT COUNT(*)
  INTO v_week_count
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.id = lp.lesson_id
  JOIN public.topics t ON t.id = l.topic_id
  WHERE lp.student_id = NEW.student_id
    AND t.course_id = v_course_id
    AND lp.created_at >= date_trunc('week', now());

  IF v_week_count = 3 THEN
    v_week_key := 'weekly_three_' || v_course_id || '_' || to_char(now(), 'IYYY-IW');
    INSERT INTO public.notifications (user_id, course_id, title, message, type, reference_key)
    VALUES (
      NEW.student_id,
      v_course_id,
      'Harika ilerliyorsun!',
      'Bu hafta 3 görevi tamamladın.',
      'milestone',
      v_week_key
    )
    ON CONFLICT (user_id, reference_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_weekly_progress_trigger ON public.lesson_progress;
CREATE TRIGGER notify_weekly_progress_trigger
AFTER INSERT ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.notify_weekly_progress();
