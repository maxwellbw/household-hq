import type { Config } from 'tailwindcss';

// DESIGN.md tokens, exposed under two vocabularies pointed at the same CSS
// variables: the DESIGN.md names (bg/surface/ink/accent/owner/...) for
// hand-written components, and the standard shadcn/ui semantic names
// (background/foreground/primary/secondary/muted/destructive/border/
// input/ring) so generated shadcn primitives inherit the warm palette
// with zero per-component overrides. "primary" = DESIGN's brand accent
// (terracotta), matching "reserved for primary actions" (DESIGN.md).
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // DESIGN.md vocabulary
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-alt': 'var(--surface-alt)',
        border: 'var(--border)',
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        owner: {
          max: 'var(--owner-max)',
          'max-soft': 'var(--owner-max-soft)',
          jaz: 'var(--owner-jaz)',
          'jaz-soft': 'var(--owner-jaz-soft)',
          both: 'var(--owner-both)',
          'both-soft': 'var(--owner-both-soft)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        scrim: 'var(--scrim)',

        // shadcn/ui semantic vocabulary — same underlying tokens
        background: 'var(--bg)',
        foreground: 'var(--ink)',
        card: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--ink)',
        },
        popover: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--ink)',
        },
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--surface)',
        },
        secondary: {
          DEFAULT: 'var(--surface-alt)',
          foreground: 'var(--ink)',
        },
        muted: {
          DEFAULT: 'var(--surface-alt)',
          foreground: 'var(--ink-muted)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--surface)',
        },
        input: 'var(--border)',
        ring: 'var(--accent)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        lg: 'var(--radius-control)',
        md: 'calc(var(--radius-control) - 2px)',
        sm: 'calc(var(--radius-control) - 4px)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      fontFamily: {
        display: ['Fraunces', 'Source Serif 4', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
