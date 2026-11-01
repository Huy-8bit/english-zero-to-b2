/** Example sentences that get a Vietnamese translation: the key used both by the extractor
 *  (scripts/example-sentences.ts) and by the lesson renderer, so they always agree. */

/** Same text → same key: quotes unified, spaces collapsed. */
export function exampleKey(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

// letters that only Vietnamese uses (é, à… also appear in English loanwords like café)
const VIETNAMESE = /[ạảãầấậẩẫăằắặẳẵẹẻẽềếệểễịỉĩọỏõồốộổỗơờớợởỡụủũưừứựửữỳỵỷỹđ]/i;

/** An English example worth translating: a sentence (ends with . ! ?) or a phrase of 3+ words; not a formula
 *  (S + V, have → had), not a gap-fill, not pronunciation marks (‿ ↘ |), not Vietnamese. */
export function isExample(text: string): boolean {
  const t = exampleKey(text);
  if (t.length < 4 || t.length > 300 || VIETNAMESE.test(t) || /[+=→←‿↘↗|]|_{2,}|\.\.\.\s*$/.test(t)) return false;
  const words = t.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (words.length < 2) return false;
  return words.length >= 3 || /[.!?]["')]?$/.test(t);
}
