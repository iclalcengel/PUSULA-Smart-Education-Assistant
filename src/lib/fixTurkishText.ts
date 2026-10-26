const REPLACEMENTS: Array<[string, string]> = [
  ["Ã¼", "ü"],
  ["Ãœ", "Ü"],
  ["Ã¶", "ö"],
  ["Ã–", "Ö"],
  ["Ã§", "ç"],
  ["Ã‡", "Ç"],
  ["Ä±", "ı"],
  ["Ä°", "İ"],
  ["ÅŸ", "ş"],
  ["Åž", "Ş"],
  ["ÄŸ", "ğ"],
  ["Äž", "Ğ"],
];

export const fixTurkishText = (value?: string | null) => {
  if (!value) return value ?? "";

  return REPLACEMENTS.reduce((text, [broken, fixed]) => text.replaceAll(broken, fixed), value);
};
