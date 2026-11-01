/** Curriculum Markdown as the renderer reads it (shared with scripts/example-sentences.ts, which has no React). */

/**
 * The curriculum bolds the apostrophe part of a word: "sister**'s**", "I**'m**". By CommonMark rules a "**" between a
 * letter and punctuation cannot open emphasis, so the asterisks showed up literally. Move the apostrophe outside the
 * bold ("sister'**s**", "I'**ve found**"); a bold apostrophe alone ("students**'**") becomes a plain apostrophe. The
 * source is unchanged.
 */
export function fixIntrawordBold(md: string): string {
  return md.replace(/([A-Za-z])\*\*(['’])([^*\n]*?)\*\*/g, (_, before: string, apo: string, rest: string) => (rest ? `${before}${apo}**${rest}**` : `${before}${apo}`));
}
