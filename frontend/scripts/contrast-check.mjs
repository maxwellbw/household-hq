/*
 * Feature 032 T002 — WCAG contrast gate for the token system (contract C1).
 *
 * Reads the light (`:root`) and dark (`[data-theme="dark"]`) token blocks from
 * src/index.css, resolves var() references, and checks every documented
 * token pair in both themes. Normal-text pairs gate at 4.5:1; pairs used only
 * as large/semibold text or UI components gate at 3:1 and are flagged as such
 * in the output. Exits non-zero on any failure.
 *
 * Run: npm run check:contrast
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const cssPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.css')
const css = readFileSync(cssPath, 'utf8')

function extractBlock(selectorRe) {
  const m = css.match(selectorRe)
  if (!m) throw new Error(`Token block not found: ${selectorRe}`)
  const vars = {}
  for (const decl of m[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    vars[decl[1]] = decl[2].trim()
  }
  return vars
}

const rootVars = extractBlock(/:root\s*\{([\s\S]*?)\n\}/)
const darkVars = extractBlock(/\[data-theme=["']dark["']\]\s*\{([\s\S]*?)\n\}/)

function resolve(vars, name, depth = 0) {
  if (depth > 5) throw new Error(`var() cycle at --${name}`)
  const value = vars[name]
  if (value === undefined) throw new Error(`Missing token --${name}`)
  const ref = value.match(/^var\(--([\w-]+)\)$/)
  return ref ? resolve(vars, ref[1], depth + 1) : value
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex color: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

function luminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function ratio(fgHex, bgHex) {
  const l1 = luminance(hexToRgb(fgHex))
  const l2 = luminance(hexToRgb(bgHex))
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/*
 * The C1 pair list. `large: true` = the pair is only ever rendered as
 * large/semibold text or a non-text UI component (3:1); everything else is
 * body/label text (4.5:1). Keep in sync with DESIGN.md's contrast table.
 */
const PAIRS = [
  // Ink on every surface
  { fg: 'ink', bg: 'bg' },
  { fg: 'ink', bg: 'surface' },
  { fg: 'ink', bg: 'surface-alt' },
  { fg: 'ink-muted', bg: 'bg' },
  { fg: 'ink-muted', bg: 'surface' },
  { fg: 'ink-muted', bg: 'surface-alt' },
  // Placeholders / section labels (never rendered in wells)
  { fg: 'ink-faint', bg: 'bg' },
  { fg: 'ink-faint', bg: 'surface' },
  // Owner identity as text + on own soft tint (chip text, calendar pills)
  { fg: 'owner-max', bg: 'bg' },
  { fg: 'owner-max', bg: 'surface' },
  { fg: 'owner-max', bg: 'owner-max-soft' },
  { fg: 'owner-jaz', bg: 'bg' },
  { fg: 'owner-jaz', bg: 'surface' },
  { fg: 'owner-jaz', bg: 'owner-jaz-soft' },
  // Avatar initials: surface-colored text on solid owner color
  { fg: 'surface', bg: 'owner-max' },
  { fg: 'surface', bg: 'owner-jaz' },
  // Semantic text on page + cards
  { fg: 'danger', bg: 'bg' },
  { fg: 'danger', bg: 'surface' },
  { fg: 'success', bg: 'bg' },
  { fg: 'success', bg: 'surface' },
  // Accent/terracotta: primary buttons, links, "Both" chip, warning badges —
  // all semibold/large or UI-component usage (audit F-20; full text-usage
  // restyle is T033's a11y sweep)
  { fg: 'accent', bg: 'bg', large: true },
  { fg: 'accent', bg: 'surface', large: true },
  { fg: 'accent', bg: 'accent-soft', large: true },
  { fg: 'accent-hover', bg: 'accent-soft', large: true },
  { fg: 'surface', bg: 'accent', large: true },
  { fg: 'surface', bg: 'danger', large: true },
  { fg: 'warning', bg: 'bg', large: true },
  { fg: 'warning', bg: 'surface', large: true },
]

const themes = [
  ['light', rootVars],
  ['dark', { ...rootVars, ...darkVars }],
]

// C1: every color/shadow token must have a dark value.
const COLOR_TOKENS = [
  'bg', 'surface', 'surface-alt', 'border', 'ink', 'ink-muted', 'ink-faint',
  'accent', 'accent-hover', 'accent-soft', 'owner-max', 'owner-max-soft',
  'owner-jaz', 'owner-jaz-soft', 'owner-both', 'owner-both-soft',
  'success', 'warning', 'danger', 'shadow-card', 'scrim',
]
const missingDark = COLOR_TOKENS.filter((t) => darkVars[t] === undefined)

let failures = 0
for (const [themeName, vars] of themes) {
  console.log(`\n${themeName} theme`)
  console.log('  pair'.padEnd(38) + 'ratio   need   result')
  for (const pair of PAIRS) {
    const fg = resolve(vars, pair.fg)
    const bg = resolve(vars, pair.bg)
    const r = ratio(fg, bg)
    const need = pair.large ? 3 : 4.5
    const ok = r >= need
    if (!ok) failures++
    const label = `${pair.fg} on ${pair.bg}${pair.large ? ' [large/UI]' : ''}`
    console.log(
      `  ${label.padEnd(36)}${r.toFixed(2).padStart(5)}   ${need.toFixed(1).padStart(4)}   ${ok ? 'pass' : 'FAIL'}`,
    )
  }
}

if (missingDark.length > 0) {
  console.error(`\nFAIL: color tokens missing a dark value: ${missingDark.join(', ')}`)
  process.exit(1)
}
if (failures > 0) {
  console.error(`\nFAIL: ${failures} pair(s) below the bar`)
  process.exit(1)
}
console.log('\nAll pairs pass in both themes.')
