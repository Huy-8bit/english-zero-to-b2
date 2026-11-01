import { memo, useContext, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Link } from "react-router-dom";
import { Mermaid } from "./Mermaid";
import { ExampleViContext, ViText } from "./ExampleVi";
import { cn, resolveDocPath } from "@/lib/utils";
import { fixIntrawordBold } from "@/lib/markdownSource";

export { fixIntrawordBold };

// Allow `language-*` classes on code so Mermaid blocks can be detected after sanitising.
const codeLanguageSchema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]] },
};

interface Props {
  children: string;
  /** Repository path of the source document, used to resolve relative links. */
  docPath?: string;
  className?: string;
  inline?: boolean;
}

/**
 * Renders curriculum Markdown. Raw HTML is not interpreted (react-markdown default) and the tree is
 * sanitised, so scripts embedded in Markdown can never run.
 */
type HastNode = { type: string; value?: string; children?: HastNode[] };
const hastText = (n?: HastNode): string => (n?.type === "text" ? n.value ?? "" : (n?.children ?? []).map(hastText).join(""));

function MarkdownImpl({ children, docPath, className, inline }: Props) {
  const vi = useContext(ExampleViContext);
  const components: Components = {
    // an English example of the lesson: its Vietnamese right under it (in tables and lists) or after it
    ...(vi ? {
      em({ children: c, node }) {
        const text = hastText(node as HastNode);
        return <><em>{c}</em><ViText text={text} /></>;
      },
    } : {}),
    a({ href, children: c }) {
      if (!href) return <span>{c}</span>;
      if (/^https?:/.test(href)) return <a href={href} target="_blank" rel="noreferrer noopener">{c}</a>;
      if (href.startsWith("#")) return docPath ? <Link to={`/reference?path=${encodeURIComponent(docPath)}${href}`}>{c}</Link> : <span>{c}</span>;
      const r = docPath ? resolveDocPath(docPath, href) : null;
      if (!r || !r.path.endsWith(".md")) return <span>{c}</span>;
      return <Link to={`/reference?path=${encodeURIComponent(r.path)}${r.hash ? `#${r.hash}` : ""}`}>{c}</Link>;
    },
    table({ children: c }) {
      return <div className="table-wrap"><table>{c}</table></div>;
    },
    code({ className: cls, children: c }) {
      const lang = /language-(\w+)/.exec(cls ?? "")?.[1];
      const text = String(c ?? "").replace(/\n$/, "");
      if (lang === "mermaid") return <Mermaid code={text} />;
      return <code className={cls}>{c as ReactNode}</code>;
    },
    pre({ children: c, node }) {
      const first = node?.children?.[0];
      const isMermaid = first && "properties" in first && Array.isArray((first.properties as { className?: string[] })?.className)
        && ((first.properties as { className: string[] }).className).includes("language-mermaid");
      return isMermaid ? <>{c}</> : <pre>{c}</pre>;
    },
    ...(inline ? { p: ({ children: c }) => <>{c}</> } : {}),
  };
  const md = (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, codeLanguageSchema]]} components={components}>
      {fixIntrawordBold(children)}
    </ReactMarkdown>
  );
  return inline ? <span className={className}>{md}</span> : <div className={cn("prose-em", className)}>{md}</div>;
}

export const Markdown = memo(MarkdownImpl);

export function InlineMd({ children, className }: { children: string; className?: string }) {
  return <Markdown inline className={className}>{children}</Markdown>;
}
