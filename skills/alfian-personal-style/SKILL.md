---
name: alfian-personal-style
description: Styles and reviews user interfaces in Alfian's personal visual language. Use when designing, building, restyling, or visually reviewing a UI for Alfian.
disable-model-invocation: true
---

# Personal Style

Apply this reference as the default visual direction unless project requirements or explicit user instructions override it. Preserve an established product design system when changing a small existing feature; adapt these principles rather than creating a mismatched island.

## Direction

Design for a software engineer who is comfortable in a terminal: **quiet, dense, keyboard-first, and information-rich**. Prefer a tool-like interface over a marketing-like interface. Minimalism means removing ceremony while retaining useful context, labels, state, and affordances.

Avoid ornamental gradients, glassmorphism, oversized headings, excessive whitespace, floating card grids, pill-shaped containers everywhere, and decorative animation. Use borders, spacing, typography, and restrained color before shadows. Keep motion brief and functional; respect reduced-motion preferences.

## Color

Use **Catppuccin Macchiato**. Define semantic tokens from this palette rather than scattering literal colors through components.

```css
:root {
  color-scheme: dark;
  --rosewater: #f4dbd6;
  --flamingo: #f0c6c6;
  --pink: #f5bde6;
  --mauve: #c6a0f6;
  --red: #ed8796;
  --maroon: #ee99a0;
  --peach: #f5a97f;
  --yellow: #eed49f;
  --green: #a6da95;
  --teal: #8bd5ca;
  --sky: #91d7e3;
  --sapphire: #7dc4e4;
  --blue: #8aadf4;
  --lavender: #b7bdf8;
  --text: #cad3f5;
  --subtext-1: #b8c0e0;
  --subtext-0: #a5adcb;
  --overlay-2: #939ab7;
  --overlay-1: #8087a2;
  --overlay-0: #6e738d;
  --surface-2: #5b6078;
  --surface-1: #494d64;
  --surface-0: #363a4f;
  --base: #24273a;
  --mantle: #1e2030;
  --crust: #181926;
}
```

Default semantic mapping:

- App background: `crust` or `mantle`; primary work surface: `base`.
- Elevated or selected surfaces: `surface-0`; borders: `surface-0` or `surface-1`.
- Primary text: `text`; secondary text: `subtext-0`; disabled text: `overlay-0`.
- Primary action, links, and focus: `blue`; selection or special emphasis: `mauve`.
- Success: `green`; warning: `yellow` or `peach`; destructive/error: `red`; informational: `sapphire`.
- Use accent colors sparingly. Never use color as the only carrier of meaning, and verify readable contrast for actual foreground/background pairs.

## Typography

Use **JetBrains Mono** throughout the interface, including controls and prose. Load it explicitly when the platform permits and retain a practical monospace fallback:

```css
font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

Favor regular and medium weights. Use size, weight, and spacing—not multiple font families—to establish hierarchy. Keep body text compact but readable (typically 14–16px with 1.45–1.6 line height); reserve smaller text for metadata. Use tabular numerals for metrics and tables.

## Layout and Components

- Use a compact spacing rhythm based on 4px; common gaps are 4, 8, 12, 16, and 24px.
- Keep content aligned to a clear grid. Prefer split panes, sidebars, tables, lists, tabs, and inline inspectors when they fit the task.
- Use modest corner radii, generally 4–8px. Controls should look precise rather than bubbly.
- Use thin, visible borders. Reserve shadows for overlays that genuinely need depth.
- Keep navigation stable and state visible. Surface paths, timestamps, IDs, statuses, and keyboard shortcuts when useful.
- Make tables compact, scannable, sortable where appropriate, and aligned by data type.
- Give every screen intentional loading, empty, error, disabled, hover, active, selected, and focus states.

## Interaction

Favor keyboard operation: logical tab order, visible `:focus-visible` rings, conventional shortcuts, command palettes for broad action sets, and escape-to-close for transient overlays. Show shortcuts beside actions instead of hiding them in documentation. Do not sacrifice pointer usability or accessibility to achieve terminal flavor.

Prefer direct manipulation and inline actions over multi-step modal flows. Use confirmation only for destructive or difficult-to-reverse operations. Keep feedback close to the action and errors specific enough to resolve.

## Review Bar

Before declaring a styled UI complete, verify that every visible region follows the Catppuccin semantic mapping, JetBrains Mono is actually loaded or has a valid fallback, spacing and hierarchy remain minimal and coherent, all interaction states are present, and the primary workflow is efficient by keyboard and pointer. Remove any decoration that does not improve hierarchy, state, or usability.
