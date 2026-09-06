/** @type {import('tailwindcss').Config} */

/*
 * Colours resolve through CSS variables so the theme can be swapped at runtime.
 *
 * The app was written dark-only, and not merely in its palette: `text-white`,
 * `border-white/[0.06]` and `bg-white/[0.04]` are white-alpha idioms that only
 * read as elevation on a dark ground. There were ~2,400 such utilities, so
 * rewriting them into semantic names was never going to happen by hand.
 *
 * Redefining `white` and `gray` themselves is what makes a light theme
 * tractable: every one of those utilities keeps its class and changes meaning
 * with the variable. `white` is therefore a role — "the colour that contrasts
 * with the page" — not a literal. Where a literal white is genuinely wanted, on
 * a brand-coloured button, use `on-accent`.
 *
 * `<alpha-value>` is Tailwind's placeholder; it is what keeps the `/[0.06]`
 * opacity modifiers working against a variable.
 */
const withAlpha = (name) => `rgb(var(${name}) / <alpha-value>)`;

const gray = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
    step,
    withAlpha(`--c-gray-${step}`),
  ])
);

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        white: withAlpha('--c-white'),
        gray,

        /** Always a real white: legible on a saturated button in either theme. */
        'on-accent': withAlpha('--c-on-accent'),

        background: withAlpha('--c-canvas'),
        canvas: withAlpha('--c-canvas'),
        /** Recessed: code blocks, inset panels, wells inside a card. */
        well: withAlpha('--c-well'),
        /** Window chrome — tab strip, sidebar, toolbars. */
        shell: withAlpha('--c-shell'),

        surface: {
          50: withAlpha('--c-raised-2'),
          100: withAlpha('--c-raised'),
          200: withAlpha('--c-surface'),
          300: withAlpha('--c-shell'),
          raised: withAlpha('--c-raised'),
          high: withAlpha('--c-raised-2'),
          DEFAULT: withAlpha('--c-surface'),
        },

        // Derived from --c-white, so every hairline inverts with the theme.
        border: {
          subtle: 'rgb(var(--c-white) / 0.06)',
          DEFAULT: 'rgb(var(--c-white) / 0.10)',
          hover: 'rgb(var(--c-white) / 0.20)',
          accent: 'rgba(99, 102, 241, 0.3)',
        },

        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          DEFAULT: '#6366f1',
        },
        agent: {
          coder: '#38bdf8',
          reviewer: '#a855f7',
          qa: '#34d399',
          devops: '#f59e0b',
          researcher: '#ec4899',
          planner: '#6366f1',
        }
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
        md: '5px',
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
        '3xl': '12px',
      },
      boxShadow: {
        'glow-brand': 'none',
        'glow-emerald': 'none',
        'glow-cyan': 'none',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.25s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
