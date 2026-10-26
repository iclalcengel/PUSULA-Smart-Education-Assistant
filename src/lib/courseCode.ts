export const normalizeCourseCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

const titlePrefix = (title: string) => {
  const cleaned = title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.slice(0, 3))
    .join("");

  return (cleaned || "KURS").slice(0, 6);
};

const randomSuffix = () => Math.random().toString(36).slice(2, 6).toUpperCase();

export const buildCourseCodeCandidate = (title: string) =>
  `${titlePrefix(title)}-${randomSuffix()}`;

export const generateUniqueCourseCode = async (title: string) => {
  return `${buildCourseCodeCandidate(title)}${Date.now().toString().slice(-2)}`;
};

export const validateCourseCodeFormat = (value: string) =>
  /^(?:[A-Z0-9]{4,16}|[A-Z0-9]{2,10}-[A-Z0-9]{2,10})$/.test(value);
