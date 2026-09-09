import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

/**
 * An agent reply, rendered as the markdown it always was.
 *
 * The bubble used to be `<div className="whitespace-pre-wrap">{content}</div>`,
 * so every piece of syntax the model emitted was shown as literal characters:
 * `**bold**` kept its asterisks, `### Heading` its hashes, and a link kept the
 * whole `[label](target)` including the target. Measured on one real reply —
 * 1511 characters, six links, all of them absolute `file:///` paths — 552
 * characters, 37% of the message, were URL text inside parentheses that was
 * never meant to be read.
 *
 * That is the part worth noticing: the paths were not a separate problem. The
 * model had already written them correctly, a short label over a hidden target.
 * They were visible only because nothing parsed them. Parsing the markdown
 * removes them without touching the agent, the prompt, or the content.
 */

/**
 * Inline math, for the two or three tokens agents actually emit.
 *
 * `$\rightarrow$` appeared twice in the same reply, because a model asked for a
 * state transition reaches for LaTeX. Rendering real math would mean KaTeX and
 * a stylesheet, for arrows.
 *
 * Deliberately a short table rather than a general `$...$` strip: anything not
 * listed is left exactly as written. A regex broad enough to catch all maths is
 * also broad enough to eat a price, a shell variable, or a regex — and silently
 * rewriting an agent's words is worse than showing one ugly token.
 *
 * The prompt asks agents not to emit these at all (see toolPolicy on the
 * daemon). This is for the transcripts already in SQLite, which that cannot
 * reach.
 */
const MATH_TOKENS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\$\\rightarrow\$/g, '→'],
  [/\$\\to\$/g, '→'],
  [/\$\\leftarrow\$/g, '←'],
  [/\$\\Rightarrow\$/g, '⇒'],
  [/\$\\times\$/g, '×'],
  [/\$\\leq\$/g, '≤'],
  [/\$\\geq\$/g, '≥']
];

function normalise(content: string): string {
  return MATH_TOKENS.reduce((text, [pattern, glyph]) => text.replace(pattern, glyph), content);
}

/** The last segment of a path, however it was separated. */
function basename(target: string): string {
  const withoutFragment = target.split('#')[0];
  const segments = withoutFragment.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? target;
}

function decodeFileUrl(href: string): string {
  const raw = href.replace(/^file:\/\/\/?/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    // A stray % in a path is not worth losing the path over.
    return raw;
  }
}

/**
 * A local path, shown as a path and not as a link.
 *
 * These arrive as `file:///C:/Users/...`, and the app is served over http, so
 * the browser refuses to navigate to them — Chrome blocks file:// from an http
 * page and reports nothing. Rendered as an anchor it would look clickable,
 * do nothing when clicked, and say nothing about why. Copying the path is the
 * action that actually works from here, so that is the one offered.
 */
function PathChip({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  const full = decodeFileUrl(href);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is permission-gated and can simply refuse. The title
      // attribute still holds the full path, so there is another way through.
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : full}
      className="inline-flex items-center gap-1 align-baseline max-w-full rounded bg-surface-50 border border-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-300 hover:border-white/25 transition-colors"
    >
      <span className="truncate">{children ?? basename(full)}</span>
      {copied
        ? <Check className="w-3 h-3 shrink-0 text-emerald-400" />
        : <Copy className="w-3 h-3 shrink-0 opacity-40" />}
    </button>
  );
}

interface Props {
  content: string;
}

export function MessageMarkdown({ content }: Readonly<Props>) {
  return (
    /*
     * `break-words` is not decoration. The longest line in the measured reply
     * was 478 characters, most of it one unbroken path, which without this
     * pushes the bubble past the width of the pane.
     */
    <div className="text-sm leading-relaxed break-words space-y-2.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith('file:')) return <PathChip href={href}>{children}</PathChip>;
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand-400 underline underline-offset-2 hover:text-brand-300"
              >
                {children}
              </a>
            );
          },

          /*
           * Headings, kept small on purpose.
           *
           * An `###` inside a chat bubble is a paragraph label, not a document
           * title. At Tailwind's default `text-3xl` the reply would shout, and
           * a model that writes four of them per answer would produce something
           * harder to read than the raw hashes were.
           */
          h1: ({ children }) => <h4 className="text-sm font-semibold text-white pt-1">{children}</h4>,
          h2: ({ children }) => <h4 className="text-sm font-semibold text-white pt-1">{children}</h4>,
          h3: ({ children }) => <h4 className="text-sm font-semibold text-white pt-1">{children}</h4>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-white pt-1">{children}</h4>,

          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,

          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-white/15 pl-3 text-gray-400">{children}</blockquote>
          ),

          hr: () => <hr className="border-white/10" />,

          /*
           * Fenced blocks scroll rather than wrap.
           *
           * Code is the one thing in a reply where a soft wrap changes the
           * meaning of what is on screen, so the block gets its own horizontal
           * scroll and the bubble keeps its width.
           */
          pre: ({ children }) => (
            <pre className="bg-surface-50 border border-white/10 rounded-lg p-3 overflow-x-auto text-xs font-mono">
              {children}
            </pre>
          ),

          code: ({ className, children, ...rest }) => {
            // react-markdown gives a fenced block a `language-*` class and puts
            // it inside <pre>; an inline span has neither.
            const fenced = /language-/.test(className ?? '');
            if (fenced) return <code className={className} {...rest}>{children}</code>;
            return (
              <code className="bg-surface-50 border border-white/10 rounded px-1 py-0.5 font-mono text-[0.85em] text-cyan-300">
                {children}
              </code>
            );
          },

          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-white/10 px-2 py-1 text-left font-semibold text-white">{children}</th>
          ),
          td: ({ children }) => <td className="border border-white/10 px-2 py-1">{children}</td>
        }}
      >
        {normalise(content)}
      </ReactMarkdown>
    </div>
  );
}
