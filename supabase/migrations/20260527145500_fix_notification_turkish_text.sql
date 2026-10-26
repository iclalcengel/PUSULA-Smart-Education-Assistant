-- Fix Turkish notification text and update the join-course function.

UPDATE public.notifications
SET
  title = U&'Kursa kat\0131ld\0131n',
  message = regexp_replace(
    message,
    '^.* kursuna .*$', 
    split_part(message, ' kursuna ', 1) || U&' kursuna ba\015Far\0131yla kat\0131ld\0131n.'
  )
WHERE reference_key LIKE 'joined_%';

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
    U&'Kursa kat\0131ld\0131n',
    target_course.title || U&' kursuna ba\015Far\0131yla kat\0131ld\0131n.',
    'success',
    'joined_' || target_course.id
  )
  ON CONFLICT (user_id, reference_key) DO NOTHING;

  RETURN target_course;
END;
$$;
