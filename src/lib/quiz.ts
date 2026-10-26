const DURATION_MARKER = /\n?\s*<!--\s*duration_minutes:(\d+)\s*-->\s*$/;

export const DEFAULT_QUIZ_DURATION_MINUTES = 10;

export const getQuizDurationMinutes = (quiz: { duration_minutes?: number | null; description?: string | null }) => {
  const duration = Number(quiz.duration_minutes);
  if (Number.isFinite(duration) && duration > 0) return Math.floor(duration);

  const marker = quiz.description?.match(DURATION_MARKER);
  const fallbackDuration = Number(marker?.[1]);
  return Number.isFinite(fallbackDuration) && fallbackDuration > 0
    ? Math.floor(fallbackDuration)
    : DEFAULT_QUIZ_DURATION_MINUTES;
};

export const stripQuizDurationMarker = (description?: string | null) => (
  description ?? ""
).replace(DURATION_MARKER, "").trim();

export const withQuizDurationMarker = (description: string, durationMinutes: number) => {
  const cleanDescription = stripQuizDurationMarker(description);
  return `${cleanDescription}${cleanDescription ? "\n\n" : ""}<!-- duration_minutes:${Math.max(1, Math.floor(durationMinutes))} -->`;
};
