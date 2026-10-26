-- Fix recursive RLS dependency between courses and course_enrollments.

CREATE OR REPLACE FUNCTION public.user_teaches_course(target_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses
    WHERE id = target_course_id
      AND teacher_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Teachers view course enrollments" ON public.course_enrollments;
CREATE POLICY "Teachers view course enrollments"
ON public.course_enrollments
FOR SELECT TO authenticated
USING (public.user_teaches_course(course_id));
