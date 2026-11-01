/** The English examples of a lesson, parsed exactly as the lesson renderer parses them (remark + GFM, same
 *  pre-processing). Used by scripts/example-sentences.ts; not part of the app bundle. */
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { toString } from "mdast-util-to-string";
import { exampleKey, isExample } from "./exampleKey.ts";
import { fixIntrawordBold } from "./markdownSource.ts";

type Node = { type: string; children?: Node[] };

/** Keys of the italic examples in a Markdown text, plus the dialogue lines that are examples. */
export function lessonExamples(md: string[], lines: string[] = []): string[] {
  const found = new Set<string>();
  const walk = (node: Node) => {
    if (node.type === "emphasis") {
      const t = toString(node);
      if (isExample(t)) found.add(exampleKey(t));
    }
    node.children?.forEach(walk);
  };
  for (const m of md) walk(fromMarkdown(fixIntrawordBold(m), { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }) as Node);
  for (const l of lines) if (isExample(l)) found.add(exampleKey(l));
  return [...found];
}
