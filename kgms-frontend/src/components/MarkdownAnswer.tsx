import type { ReactNode } from 'react'

interface MarkdownAnswerProps {
  className?: string
  content: string
}

type MarkdownBlock =
  | { type: 'code'; code: string; language?: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'unordered-list'; items: string[] }

export function MarkdownAnswer({
  className = 'space-y-4 text-sm leading-7 text-slate-700',
  content,
}: MarkdownAnswerProps) {
  return (
    <div className={className}>
      {parseMarkdownBlocks(content).map((block, index) => renderBlock(block, index))}
    </div>
  )
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^```(\S*)\s*$/)
    if (fence) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      blocks.push({ type: 'code', code: codeLines.join('\n'), language: fence[1] || undefined })
      continue
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index])
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].trim() && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      index += 1
      continue
    }

    if (isUnorderedListItem(line)) {
      const items: string[] = []
      while (index < lines.length && isUnorderedListItem(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, '').trim())
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    if (isOrderedListItem(line)) {
      const items: string[] = []
      while (index < lines.length && isOrderedListItem(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, '').trim())
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines[index])
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines })
  }

  return blocks
}

function renderBlock(block: MarkdownBlock, index: number) {
  if (block.type === 'heading') {
    return renderHeading(block, index)
  }
  if (block.type === 'code') {
    return (
      <pre
        key={`code-${index}`}
        className="overflow-auto rounded-lg bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100"
      >
        <code>{block.code}</code>
      </pre>
    )
  }
  if (block.type === 'unordered-list') {
    return (
      <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={`${item.slice(0, 16)}-${itemIndex}`} className="break-words">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    )
  }
  if (block.type === 'ordered-list') {
    return (
      <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={`${item.slice(0, 16)}-${itemIndex}`} className="break-words">
            {renderInline(item)}
          </li>
        ))}
      </ol>
    )
  }
  if (block.type === 'table') {
    return (
      <div key={`table-${index}`} className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              {block.headers.map((header, headerIndex) => (
                <th
                  key={`${header.slice(0, 16)}-${headerIndex}`}
                  className="px-3 py-2 font-semibold"
                  scope="col"
                >
                  {renderInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {block.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {block.headers.map((_, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="px-3 py-2 align-top text-slate-700"
                  >
                    {renderInline(row[cellIndex] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <p key={`p-${index}`} className="break-words">
      {renderParagraphLines(block.lines)}
    </p>
  )
}

function renderHeading(block: Extract<MarkdownBlock, { type: 'heading' }>, index: number) {
  const className = headingClass(block.level)
  const children = renderInline(block.text)
  if (block.level === 1) {
    return <h1 key={`h-${index}`} className={className}>{children}</h1>
  }
  if (block.level === 2) {
    return <h2 key={`h-${index}`} className={className}>{children}</h2>
  }
  if (block.level === 3) {
    return <h3 key={`h-${index}`} className={className}>{children}</h3>
  }
  if (block.level === 4) {
    return <h4 key={`h-${index}`} className={className}>{children}</h4>
  }
  if (block.level === 5) {
    return <h5 key={`h-${index}`} className={className}>{children}</h5>
  }
  return <h6 key={`h-${index}`} className={className}>{children}</h6>
}

function renderParagraphLines(lines: string[]): ReactNode[] {
  return lines.flatMap((line, index) => {
    const nodes = renderInline(line)
    if (index === lines.length - 1) {
      return nodes
    }
    return [...nodes, <br key={`br-${index}`} />]
  })
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    nodes.push(renderInlineToken(match[0], nodes.length))
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

function renderInlineToken(token: string, key: number): ReactNode {
  if (token.startsWith('`')) {
    return (
      <code key={`code-${key}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.92em] text-slate-800">
        {token.slice(1, -1)}
      </code>
    )
  }
  if (token.startsWith('**')) {
    return <strong key={`strong-${key}`} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>
  }
  if (token.startsWith('*')) {
    return <em key={`em-${key}`} className="italic">{token.slice(1, -1)}</em>
  }

  const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
  if (!link) {
    return token
  }

  const href = safeHref(link[2])
  if (!href) {
    return link[1]
  }
  return (
    <a
      key={`link-${key}`}
      className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {link[1]}
    </a>
  )
}

function headingClass(level: number): string {
  if (level === 1) {
    return 'text-xl font-semibold leading-8 text-slate-950'
  }
  if (level === 2) {
    return 'text-lg font-semibold leading-7 text-slate-950'
  }
  return 'text-base font-semibold leading-7 text-slate-950'
}

function isBlockStart(line: string): boolean {
  return /^```/.test(line) || /^(#{1,6})\s+/.test(line) || isUnorderedListItem(line) || isOrderedListItem(line)
}

function isTableStart(lines: string[], index: number): boolean {
  return Boolean(
    lines[index + 1] &&
      isTableRow(lines[index]) &&
      isTableSeparator(lines[index + 1]),
  )
}

function isTableRow(line: string): boolean {
  return line.includes('|') && splitTableRow(line).length > 1
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function isUnorderedListItem(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line)
}

function isOrderedListItem(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line)
}

function safeHref(href: string): string | null {
  const trimmed = href.trim()
  if (/^(https?:|mailto:)/i.test(trimmed)) {
    return trimmed
  }
  return null
}
