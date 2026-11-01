/**
 * Lists the English example sentences of every lesson, keyed as the lesson renderer looks them up.
 *
 *   node scripts/example-sentences.ts LESSONS.json OUT.json
 *
 * LESSONS.json comes from `python -m app.content.example_vi dump` ({unit: {md: [...], lines: [...]}}).
 * OUT.json: {unit: [key, ...]}, the input of `python -m app.content.example_vi translate`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { lessonExamples } from "../src/lib/exampleExtract.ts";

const [dumpPath, outPath] = process.argv.slice(2);
const dump: Record<string, { md: string[]; lines: string[] }> = JSON.parse(readFileSync(dumpPath, "utf8"));
const result: Record<string, string[]> = {};
for (const [unit, { md, lines }] of Object.entries(dump)) {
  const keys = lessonExamples(md, lines);
  if (keys.length) result[unit] = keys;
}
writeFileSync(outPath, JSON.stringify(result, null, 1));
const all = Object.values(result).flat();
console.log(`${Object.keys(result).length} lessons, ${all.length} examples, ${new Set(all).size} distinct`);
