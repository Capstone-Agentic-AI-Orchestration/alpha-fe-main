/** @type {import('tailwindcss').Config} */

/*
 * Colours resolve through CSS variables so the dark canvas stays consistent
 * across every surface and component.
 *
 * The app was written dark-only, and not merely in its palette: `text-white`,
 * `border-white/[0.06]` and `bg-white/[0.04]` are white-alpha idioms that only
 * read as elevation on a dark ground. There were ~2,400 such utilities, so
 * rewriting them into semantic names was never going to happen by hand.
 *
 * Redefining `white` and `gray` keeps the existing utility vocabulary legible
 * on the dark ground. `white` is therefore a role — "the colour that contrasts
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
// Semantic roles are preferred. Numeric families are transitional palette-aware aliases.
const steps = [50,100,200,300,400,500,600,700,800,900,950];
const families = Object.fromEntries(['slate','zinc','neutral','stone','brand','violet','purple','indigo','blue','sky','cyan','teal','emerald','green','lime','amber','yellow','orange','red','rose','pink','fuchsia'].map(family => [family,{
  ...Object.fromEntries(steps.map(step => [step,withAlpha(`--c-${family}-${step}`)])),
  DEFAULT:withAlpha(`--c-${family}-500`),
}]));
const ui = role => withAlpha(`--ui-${role}`);
const status = Object.fromEntries(['success','warning','danger','info'].map(role => [role,{DEFAULT:ui(`status-${role}`),subtle:ui(`status-${role}-subtle`),border:ui(`status-${role}-border`)}]));

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...families,
        white: withAlpha('--c-white'),
        gray,
        content: { DEFAULT:ui('text-primary'),secondary:ui('text-secondary'),muted:ui('text-muted') },
        action: {DEFAULT:ui('action'),hover:ui('action-hover')},
        'on-action':ui('on-action'),
        link:{DEFAULT:ui('link'),hover:ui('link-hover')},
        /** The theme's second accent: tags, outline buttons, bars and charts. Never status meaning. */
        secondary:{DEFAULT:ui('secondary'),subtle:ui('secondary-subtle'),border:ui('secondary-border')},
        selected:{DEFAULT:ui('selected'),content:ui('selected-content')},
        divider:ui('divider'),control:ui('control'),focus:ui('focus'),
        overlay:ui('overlay'),status,
        code:{DEFAULT:ui('code'),content:ui('code-content')},
        diff:{added:{DEFAULT:ui('diff-added'),content:ui('diff-added-content')},removed:{DEFAULT:ui('diff-removed'),content:ui('diff-removed-content')},hunk:ui('diff-hunk')},

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
          accent: ui('accent'),
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

        /*
         * Sign-in screen (features/onboarding/SignIn.tsx). Decorative only and
         * always applied through `motion-safe:`, so reduced motion gets the
         * static layout. SignIn advances the role, detail pane and rail
         * together; this short pulse plays as each node receives the handoff.
         */
        'signin-rise': 'signinRise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'signin-flash': 'signinFlash 0.48s ease-out both',
        'signin-role-change': 'signinRoleChange 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        signinRise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        signinFlash: {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '30%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '0', transform: 'scale(1.5)' },
        },
        signinRoleChange: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
