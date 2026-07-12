import { describe, expect, it } from 'vitest'
import { linkify } from './linkify'

describe('linkify', () => {
  it('returns a single text segment for plain text with no URL', () => {
    expect(linkify('Buy the good brand')).toEqual([{ type: 'text', value: 'Buy the good brand' }])
  })

  it('linkifies a single https URL', () => {
    expect(linkify('Buy: https://www.amazon.com/dp/XXXX please')).toEqual([
      { type: 'text', value: 'Buy: ' },
      { type: 'link', href: 'https://www.amazon.com/dp/XXXX' },
      { type: 'text', value: ' please' },
    ])
  })

  it('linkifies multiple URLs in the same note', () => {
    const result = linkify('a http://one.example b https://two.example c')
    expect(result).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'link', href: 'http://one.example' },
      { type: 'text', value: ' b ' },
      { type: 'link', href: 'https://two.example' },
      { type: 'text', value: ' c' },
    ])
  })

  it('trims trailing punctuation off a linked URL', () => {
    expect(linkify('see https://ex.com/page.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', href: 'https://ex.com/page' },
      { type: 'text', value: '.' },
    ])
  })

  it('trims trailing closing punctuation like parens', () => {
    expect(linkify('(https://ex.com/page)')).toEqual([
      { type: 'text', value: '(' },
      { type: 'link', href: 'https://ex.com/page' },
      { type: 'text', value: ')' },
    ])
  })

  it('does not linkify a bare www./domain string without a scheme', () => {
    expect(linkify('visit www.example.com for info')).toEqual([
      { type: 'text', value: 'visit www.example.com for info' },
    ])
  })

  it('returns an empty array for an empty string', () => {
    expect(linkify('')).toEqual([])
  })

  it('handles a note that is only a URL', () => {
    expect(linkify('https://ex.com')).toEqual([{ type: 'link', href: 'https://ex.com' }])
  })
})
