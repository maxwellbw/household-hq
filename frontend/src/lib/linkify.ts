// Splits free text into plain-text and http(s) link segments (feature 019, research R1).
// Only an explicit http:// or https:// scheme is linkified — bare "www." / domain strings
// stay plain text to avoid false positives (emails, filenames, version numbers).

export type LinkifySegment = { type: 'text'; value: string } | { type: 'link'; href: string }

const URL_PATTERN = /\bhttps?:\/\/[^\s<]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/

export function linkify(text: string): LinkifySegment[] {
  const segments: LinkifySegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    let url = match[0]
    const trailingMatch = url.match(TRAILING_PUNCTUATION)
    if (trailingMatch) {
      url = url.slice(0, url.length - trailingMatch[0].length)
    }
    if (url.length === 0) continue

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) })
    }
    segments.push({ type: 'link', href: url })
    lastIndex = start + url.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}
