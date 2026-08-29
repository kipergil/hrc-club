import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

/**
 * The design tokens are the accessibility requirements, expressed once.
 *
 * The league PRD's §7 is normative for this site: 20px base type in rem,
 * body-text contrast >= 7:1, 48px touch targets, nothing below 16px. Those
 * are enforceable here — as a type scale whose smallest step is 1rem and a
 * palette whose every text/background pair is checked by
 * `scripts/contrast.test.ts` — rather than left to whoever writes the next
 * component.
 *
 * The 20px base comes from `html { font-size: 125% }` in index.css, so
 * Tailwind's own rem-based scale lands on 20px for `text-base` without
 * every size needing an override, and browser zoom and OS text-size
 * settings keep working.
 */
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-sunken": "rgb(var(--c-surface-sunken) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--c-ink-muted) / <alpha-value>)",
        line: {
          DEFAULT: "rgb(var(--c-line) / <alpha-value>)",
          strong: "rgb(var(--c-line-strong) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--c-brand) / <alpha-value>)",
          strong: "rgb(var(--c-brand-strong) / <alpha-value>)",
          soft: "rgb(var(--c-brand-soft) / <alpha-value>)",
          ink: "rgb(var(--c-brand-ink) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          soft: "rgb(var(--c-accent-soft) / <alpha-value>)",
          ink: "rgb(var(--c-accent-ink) / <alpha-value>)",
        },
        positive: {
          DEFAULT: "rgb(var(--c-positive) / <alpha-value>)",
          soft: "rgb(var(--c-positive-soft) / <alpha-value>)",
        },
        negative: {
          DEFAULT: "rgb(var(--c-negative) / <alpha-value>)",
          soft: "rgb(var(--c-negative-soft) / <alpha-value>)",
        },
        focus: "rgb(var(--c-focus) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Atkinson Hyperlegible", "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        /*
         * Nothing below 1rem (20px at the 125% root) exists in this scale.
         * A caption that needs to be smaller than body text is a caption
         * that needs to be shorter instead.
         *
         * The steps above `lg` are spaced more widely than they were, and
         * their line-heights tighten as they grow. The old scale ran
         * 1.35 / 1.6 / 2 / 2.5 with a near-constant leading, so a page
         * title and a section heading sat a hair apart and the page read
         * as one flat texture.
         */
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.15rem", { lineHeight: "1.5" }],
        xl: ["1.4rem", { lineHeight: "1.35" }],
        "2xl": ["1.75rem", { lineHeight: "1.25" }],
        "3xl": ["2.25rem", { lineHeight: "1.15" }],
        "4xl": ["2.9rem", { lineHeight: "1.08" }],
      },
      spacing: {
        // The WCAG 2.2 AAA target size, available as a named step so a
        // button can say what it is rather than carrying a magic number.
        touch: "3rem",
      },
      maxWidth: {
        // ~70 characters at the base size.
        prose: "38rem",
        // The reading column for long editorial pages, a little wider than
        // `prose` because these carry headings and lists rather than only
        // paragraphs.
        readable: "46rem",
        page: "72rem",
      },
      borderRadius: {
        card: "0.75rem",
        panel: "1rem",
      },
      boxShadow: {
        raised: "var(--shadow-raised)",
        card: "var(--shadow-card)",
        lifted: "var(--shadow-lifted)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(0.375rem)" },
          to: { opacity: "1", transform: "none" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 180ms ease-out",
        "accordion-down": "accordion-down 180ms ease-out",
        "accordion-up": "accordion-up 150ms ease-out",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
