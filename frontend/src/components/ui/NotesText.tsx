import { linkify } from '@/lib/linkify'

interface NotesTextProps {
  text: string
  className?: string
}

/** Renders free text with http(s) URLs as tappable links (feature 019). Text is always
 *  rendered as React children — never dangerouslySetInnerHTML — so notes can never execute
 *  as markup (FR-021). */
export function NotesText({ text, className }: NotesTextProps) {
  const segments = linkify(text)
  return (
    <p className={className ?? 'whitespace-pre-wrap break-words text-sm text-ink'}>
      {segments.map((segment, i) =>
        segment.type === 'link' ? (
          <a
            key={i}
            href={segment.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent-hover underline hover:no-underline"
          >
            {segment.href}
          </a>
        ) : (
          <span key={i}>{segment.value}</span>
        ),
      )}
    </p>
  )
}
