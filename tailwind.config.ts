import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

/**
 * The design tokens are the accessibility requirements, expressed once.
 *
 * The league PRD's §7 is normative for this site: 20px base type in rem,
 * body-text contrast >= 7:1, 48px touch targets, nothing below 16px. Those
 * are enforceable here — as a type scale whose smallest step is 1rem and a
 * palette whose every text/background pair is checked — rather than left to
 * whoever writes the next component.
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
        canvas: "var(--c-canvas)",
        surface: "var(--c-surface)",
        "surface-sunken": "var(--c-surface-sunken)",
        ink: "var(--c-ink)",
        "ink-muted": "var(--c-ink-muted)",
        line: "var(--c-line)",
        brand: {
          DEFAULT: "var(--c-brand)",
          strong: "var(--c-brand-strong)",
          soft: "var(--c-brand-soft)",
          ink: "var(--c-brand-ink)",
        },
        accent: {
          DEFAULT: "var(--c-accent)",
          soft: "var(--c-accent-soft)",
        },
        positive: "var(--c-positive)",
        negative: "var(--c-negative)",
        focus: "var(--c-focus)",
      },
      fontFamily: {
        sans: ["Atkinson Hyperlegible", "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        // Nothing below 1rem (20px at the 125% root) exists in this scale.
        // A caption that needs to be smaller than body text is a caption
        // that needs to be shorter instead.
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.15rem", { lineHeight: "1.5" }],
        xl: ["1.35rem", { lineHeight: "1.4" }],
        "2xl": ["1.6rem", { lineHeight: "1.3" }],
        "3xl": ["2rem", { lineHeight: "1.25" }],
        "4xl": ["2.5rem", { lineHeight: "1.2" }],
      },
      spacing: {
        // The WCAG 2.2 AAA target size, available as a named step so a
        // button can say what it is rather than carrying a magic number.
        touch: "3rem",
      },
      maxWidth: {
        // ~70 characters at the base size.
        prose: "38rem",
        page: "70rem",
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
