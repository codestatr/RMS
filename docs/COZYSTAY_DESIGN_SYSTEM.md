# CozyStay Design System

## Intent

CozyStay should feel like a thoughtful hospitality business: calm, practical, and welcoming. The interface favors clear information, natural photography, and confident typography over decoration. Web, admin, and POS share the same visual language while retaining layouts suited to their work.

## Core tokens

| Token | Light value | Use |
| --- | --- | --- |
| `--cozystay-canvas` | `#F9F9F8` | Main page canvas; target roughly 60% of a typical screen |
| `--cozystay-surface` | `#FFFFFF` | Reading and form surfaces |
| `--cozystay-surface-muted` | `#F0F0ED` | Table headings, filters, quiet controls |
| `--cozystay-ink` | `#20211F` | Primary text |
| `--cozystay-muted` | `#696D68` | Supporting text and labels |
| `--cozystay-line` | `#DEDFDB` | Fine separators and input edges |
| `--cozystay-accent` | Backend supplied; default `#176B52` | Primary actions, active navigation, focus, and confirmed state |
| `--cozystay-space-page` | `24px` | Page inset |
| `--cozystay-space-section` | `32px` | Separation between content groups |
| `--cozystay-radius-control` | `4px` | Inputs and small interactive controls |
| `--cozystay-shadow-soft` | `0 2px 8px rgb(32 33 31 / 5%)` | Rare surface separation |

Dark-mode-ready tokens use `#121212` canvas, `#1C1C1B` surface, `#252524` quiet surface, `#F2F2EF` ink, `#AAA9A4` muted text, and `#373735` dividers. Components should read semantic tokens rather than hard-code light values when dark mode is enabled.

### Accent contract

The branding setting is injected into `--cozystay-accent` by the web and Electron clients. The WPF client receives the same value through `SystemBranding.AccentColor` and `AccentBrush`. Use the accent on primary CTAs, active navigation, keyboard focus, and critical positive status. Use neutral surfaces for decoration and structural emphasis. Keep errors, warnings, and informational states semantically distinct; they are not brand accents.

Legacy `--brand-*`, `--primary-*`, and WPF `AmberBrush` tokens remain compatibility aliases. New work should use the CozyStay token names.

## Layout and surfaces

- Prefer left alignment and deliberate editorial imbalance. Center only compact confirmation or authentication tasks where it improves focus.
- Use 24px page insets and 32px between major groups; allow denser spacing inside POS forms and tabular records.
- Use flat surfaces and thin separators. Avoid gradients, luminous outlines, oversized shadows, stacked cards, and decorative borders.
- Use a single clear title, a short explanatory line when needed, then the task content. Keep labels concrete and operational.
- Let property photography carry the emotional tone. Preserve natural image crops and provide contextual names, locations, and nightly prices.

## Type and content

Use a sans-serif family throughout: DM Sans with system sans fallbacks on the customer web; Inter with system UI fallbacks in Electron; Segoe UI in WPF. Use regular body weights, medium labels, and semibold section titles. Headings use restrained negative tracking and natural line heights. Use tabular numerals for prices, dates, and reconciliation values. Write real product language such as “Cozy Mountain Cabin”, “KES 15,000 / night”, “Awaiting payment”, and “Pending sync”; avoid placeholder copy.

## Customer web

Use an editorial, asymmetric photo-and-copy hero, with a quiet location/date/guest search row. Listing cards should prioritize the image, property name, location, guest capacity, and nightly price. Keep booking details borderless where grouping remains clear; date selection should use flat fields with strong labels and visible keyboard focus. The booking CTA is the primary accent moment on the page.

## Admin Electron

Use a neutral canvas, a compact charcoal navigation rail, and a light content header. Keep management tables readable through alignment, whitespace, and row hover rather than boxes around every cell. KPI views should foreground a small number of operational measures and avoid chart decoration that does not help a decision. Use the accent for the active navigation item and the main action only.

## WPF POS

Optimize for fast, accurate walk-in entry and cash handling. Keep guest/property/date inputs grouped in a stable left-to-right order; keep amount due and payment action in a distinct summary area. Use minimum window dimensions and resizable proportional columns so the amount summary does not stretch into unused space. Use 46px minimum data rows, clear labels, right-aligned money, and high-contrast focus states. Use KES consistently.

## Interaction and accessibility

All controls have a visible keyboard-focus outline derived from `--cozystay-accent`. Status must include readable text and must not rely on color alone. Keep button labels action-oriented (“Confirm booking”, “Mark room ready”, “Record cash payment”). Respect reduced-motion preferences; transitions should be short and nonessential. Maintain contrast for body text and action labels against every allowed accent color.

## Implementation map

- Web tokens: `frontend/src/index.css`; backend color injection: `frontend/src/utils/brandTheme.js`.
- Electron tokens and shell: `admin-client/src/styles/app.css`; backend color injection: `admin-client/src/renderer/utils/brandTheme.js`.
- WPF palette and control defaults: `pos-system/POSSystem/App.xaml`; dynamic accent bridge: `pos-system/POSSystem/Services/SystemBranding.cs`.
- `--brand-*` and `--primary-*` are retained temporarily because existing screen styles still use them. Migrate component styles to semantic CozyStay tokens when each screen is next revised.
