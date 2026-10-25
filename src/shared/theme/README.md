# Appearance: MVVM and shared tokens

Alpha Violet is the default. The eight approved themes are Violet, Slate Blue, Forest, Ember, Pearl, Sand, Graphite and light-blue Mist. Appearance is personal to the current browser profile or desktop profile, applies across chats/workspaces, and does not alter session memory, permissions, agent configuration or preview websites.

## Where to change what

| Change | File |
| --- | --- |
| A theme's colors | `model/palettes/<theme-id>.json` |
| IDs, order, default and palette files | `model/manifest.json` |
| Shared status colors for dark/light themes | `model/modes.json` |
| Required roles, validation and derived colors | `model/types.ts`, `model/themeResolver.mjs` |
| Browser/native persistence | `model/preferenceStore.ts` |
| State, actions, ordered saves and errors | `viewmodel/createAppearanceViewModel.ts` |
| React connection and document theme | `viewmodel/ThemeProvider.tsx` |
| Picker presentation data | `viewmodel/useAppearanceViewModel.ts` |
| Pure picker markup | `view/AppearanceView.tsx` |
| Settings connection | `features/settings/AppearancePanel.tsx` |
| Font faces and shared typography | `typography.css`, `assets/fonts/` |

The model has no React, DOM, API or AppContext dependency. The view model receives a small persistence interface, owns observable state and commands, and never fetches application data. The view receives presentation data and callbacks only: no storage, theme parsing, permissions or Electron calls. ThemeProvider connects the view model to React and document styles; ordinary controls use CSS roles without hooks. The `useTheme` hook supplies resolved palettes to graphics and the appearance selector.

`themeResolver.mjs` is intentionally plain ESM with an adjacent TypeScript declaration: the same pure resolver runs in Vite and the existing Node generator without a runtime TS loader or extra package. Typography is independent of the palettes.

## Color vocabulary

Use `bg-canvas`, `bg-shell`, `bg-surface`, `bg-surface-raised`, `bg-well`, `text-content`, `text-content-secondary`, `text-content-muted`, `border-divider`, `border-control`, `bg-action`, `text-on-action`, `text-link`, `bg-selected`, `text-selected-content`, and `focus-visible:ring-focus`.

Use `text-status-success/warning/danger/info` for outcomes, with matching `bg-status-*-subtle` and `border-status-*-border` when needed. Diff/code roles are separate. Decorative separators use divider; control is a stronger boundary for inputs/interactive identification, not every grouping box. Focus rings belong to focus states.

Do not add raw purple/dark/white colors to feature markup. Literal white on a dark action is `on-action`; legacy `text-white` means contrasting page text and must not be used on an action or configured avatar fill. Preserve identity colors, image pixels and the neutral white glow alpha mask. Status meaning never depends on the accent. Existing numeric and color-family utilities are compatibility aliases resolved from the selected palette; new UI should use purpose names.

## Build and checks

Run `npm run theme:generate` after editing palette data. It validates role completeness, hex data, IDs, core text/action/focus contrasts and emits `generated/themes.css`, `public/theme-startup.js` and `public/theme-manifest.json`. `npm run theme:check` refuses stale generated files, compiles representative Tailwind roles (including the previously missing brand-300), and rejects new raw color literals in feature markup/styles. Dev/build generate automatically; tests check freshness. Commit generated files with their source changes; never hand-edit them.

`model/legacy-color-baseline.json` records existing intentional content/identity/public-branding colors and retained legacy exceptions. This is a text-based ratchet, not a CSS parser or an accessibility audit. Decreasing existing usage passes; new literals require semantic roles or an explicit reviewed baseline change. Do not automatically regenerate the baseline to silence failures. The generator/model owns its intentional color calculations separately.

The manifest discovers each palette through Vite glob imports; adding a palette and its manifest entry automatically adds the picker choice. Required fields and contrast checks still apply. The existing eight-choice acceptance test must be updated deliberately when approving another theme.

Vite inlines the generated classic startup script in the head before styles/React. It validates preferences, leaves public branded entries at their intended default, and restores appearance for internal/client workspace routes. ThemeProvider stays mounted across entry changes; body portals inherit the document root. No page reload, scene remount, camera reset or execution restart is used to change appearance.

The desktop build takes `dist/theme-manifest.json` from the same frontend source it stages. Main validates it, owns `userData/appearance.json`, resolves native caption colors and sends only allowlisted IDs across sender-checked IPC. Preload reads main's cached current ID before scripts, including reloads. The browser fallback uses `alpha.appearance.v1` on its own origin. Old bridges fall back safely; failed saves keep the current in-window choice and report the error. Serial saves avoid stale writes during rapid selection.

DM Sans 400/500/600/700 and IBM Plex Mono 400/500 are bundled locally. License notices ship in `public/fonts/`. Font sources and licenses: [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans), [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono). No runtime Google Fonts request is needed.

Pure model/view-model tests exercise invalid data, blocked storage, rapid selection, failed saves, cross-window changes and bootstrap routing. Graphics tests cover Canvas palette updates and paused WebGL redraws. Desktop tests cover native persistence, trust checks, staging consistency and reload startup. Real browser/desktop checks are required in addition to those tests before release.
