import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

/**
 * Renders assistant replies with GFM (tables, lists). Tables use explicit RTL so
 * header row and data rows share one direction — plain text + bidi would flip rows
 * that start with digits/Latin while Hebrew headers stayed RTL.
 */
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pr-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pr-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="text-blue-700 underline underline-offset-2 hover:text-blue-900" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const inline = !className
    if (inline) {
      return (
        <code className="rounded bg-gray-200/90 px-1 py-0.5 font-mono text-[0.85em]" {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-gray-900/90 p-3 font-mono text-xs text-gray-100" dir="ltr">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div
      className="my-3 w-full max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-950/[0.06]"
      dir="rtl"
    >
      <table
        className="w-full min-w-[18rem] border-collapse text-[13px] leading-snug text-gray-800 [&_tbody>tr:nth-child(even)]:bg-slate-50/95 [&_th]:border [&_td]:border [&_th]:border-gray-200 [&_td]:border-gray-200 [&_th]:px-3 [&_td]:px-3 [&_th]:py-2.5 [&_td]:py-2 [&_th]:bg-slate-100 [&_th]:font-semibold [&_th]:text-gray-900 [&_th]:text-start [&_td]:text-start [&_th]:align-top [&_td]:align-top [&_th]:border-b-2 [&_th]:border-b-slate-300"
        dir="rtl"
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th>{children}</th>,
  td: ({ children }) => <td>{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-r-2 border-gray-400 pr-3 text-gray-700">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-300" />,
}

export function ChatAssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="break-words" dir="auto">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
