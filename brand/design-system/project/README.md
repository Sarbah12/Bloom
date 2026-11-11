# Bloom

Your cycle, understood. Bloom is a private, local-first period and cycle tracker for iOS and Android. This brand book is the source for how Bloom looks, sounds and behaves: colours, type, shape, logo, icons, components and the rules that keep health information safe and calm.

Built from the Bloom app's real theme (`theme/tokens.ts`), components (`components/ui`, `components/cycle`) and brand kit (`brand/`). Every value here is the value the app ships.

## Principles

1. **Calm, never alarming.** Health information is shown plainly, with context, and without urgency unless something genuinely needs attention.
2. **Private by design.** Nothing personal appears where others might see it — not in notifications, previews, analytics or share sheets.
3. **Honest about certainty.** Predictions are estimates and say so. Bloom never diagnoses and is never a method of contraception.
4. **Soft, rounded, warm.** Large radii, pill controls, plum and rose on a blush-white ground. Nothing sharp, nothing clinical.
5. **Readable by everyone.** WCAG AA contrast in both themes, 48 px touch targets, Dynamic Type, Reduce Motion, and colour never carries meaning alone.

## Voice and content

Bloom speaks like a well-informed friend: warm, plain and specific. Short sentences, everyday words, second person.

| Do | Don't |
| --- | --- |
| "Your period is due in about 3 days." | "Period incoming!! 🩸" |
| "Your last cycle was shorter than usual." | "Abnormal cycle detected." |
| "If it keeps happening, mention it to a healthcare professional." | "You may have PCOS." |
| "Fertile window (estimate)" | "Safe days" |
| "Saved as you go" | "Data persisted successfully" |

- **Sentence case** everywhere: titles, buttons, tabs.
- **Numbers as numerals:** "Day 14", "21 days", "3 cycles".
- **Typographic punctuation:** curly apostrophes (’), en dash for ranges (24–38), em dash for asides.
- **Buttons say what happens:** "Log today’s check-in", "Start period", "Export my data".
- **Every estimate is labelled** ("est.", "about", "estimate"). Every fertile-window view carries the contraception disclaimer.
- **Changes and deviations always offer context** (stress, illness, travel, new medicines) and a gentle next step, never a diagnosis.
- **No emoji** in the interface. No exclamation marks except in genuine celebration.
- **Notifications are discreet by default:** "A gentle reminder from Bloom." A period or a date appears in a preview only if the person turns detailed reminders on.

## Colour

The palette is plum and rose on a blush-white ground, with four phase hues. Every text pairing meets WCAG AA (4.5:1) in both themes; this is checked in CI.

### Core

- `background` is the page. `surface` is cards and sheets. `surface-muted` is a quieter card or a track.
- `ink` is primary text; `ink-muted` is secondary text and inactive icons; `ink-subtle` is tertiary metadata only, at 12 px or larger.
- `primary` is the one action colour: primary buttons, selected chips, the active tab, links. Text and icons on it use `on-primary`. Pressed state uses `primary-pressed`.
- `primary-soft` / `on-primary-soft` is the soft button, privacy notices, icon tiles and quick actions.
- `border` separates cards and rows (hairline). `border-strong` outlines chips and secondary buttons so their edge reaches 3:1.
- `focus` draws focus rings, 2 px, offset 2 px.

### Hero and tint

- The hero card is a diagonal gradient from `hero-start` to `hero-end`. Text on it is `on-hero` (primary) and `on-hero-muted` (secondary). Use it once per screen, for the most important fact.
- The tint card is a gradient from `tint-start` to `tint-end` with `ink` text: overviews and gentle prompts such as Cramp relief.

### Phases

Each phase has four tokens: a solid (`menstrual`), a soft background (`menstrual-soft`), text on the soft (`menstrual-on-soft`) and text on the solid (`menstrual-on-solid`).

| Phase | Solid | Means |
| --- | --- | --- |
| Menstrual | `menstrual` | Logged period days, the period arc of the ring |
| Follicular | `follicular` | After the period, before the fertile window |
| Ovulatory | `ovulatory` | Fertile window and estimated ovulation (always labelled "est.") |
| Luteal | `luteal` | The days before the next period; PMS heads-ups |

Phase colours always come with a word or a pattern (a dashed outline for predicted days, a ring for ovulation) — never colour alone.

### Status

- `success` / `success-soft`: good news ("Your cramps have been easier").
- `warning` / `warning-soft` / `on-warning-soft`: "worth a conversation with a professional" care notices. Bloom has no red alarm state for health information.
- `danger` / `danger-soft` / `on-danger-soft`: destructive actions only (delete my data).

### Brand accents

`rose`, `petal` and `cream` come from the logo. Use them in brand moments — the logo, splash, social images and the cover — not in the app interface, where `primary` and the phase colours do the work.

## Typography

Three families, each with one job:

- **Plus Jakarta Sans** (`--font-display`, 600–800): numbers and headings. `hero` (56/800) for the one big number on the hero card; `display`, `title1`–`title3` for screen and card titles.
- **Inter** (`--font-body`, 400–600): everything people read. `body` 16, `callout` 14 for supporting text, `footnote` 13, `caption` 12 for metadata, `headline` 15/600 for row titles and button labels, `eyebrow` 13/500 above a title.
- **Playfair Display** (`--font-wordmark`, 600): the Bloom wordmark only. Never for interface text.

Display styles use tight tracking (from −2 px on `hero` to −0.2 px on `title3`); body text uses none. Text scales with the system setting, capped per style so layouts never break: hero ×1.15, display and title1 ×1.25, title2 ×1.35, title3, caption and eyebrow ×1.4, everything else ×1.7. At 130 % and above, side-by-side stat tiles stack.

## Shape and space

- **Spacing** steps: `space-xs` 4 · `space-sm` 8 · `space-md` 12 · `space-lg` 16 · `space-xl` 20 · `space-xxl` 24 · `space-xxxl` 32 · `space-huge` 48. Screens have a 20 px `gutter`; cards pad 20–24; gaps between cards are `space-lg`.
- **Radii:** `radius-sm` 12 for small tiles · `radius-md` 18 for inputs and small cards · `radius-lg` 26 for cards · `radius-xl` 34 for hero and tint cards · `radius-pill` for every button, chip, segmented control and the tab bar.
- **Elevation:** `shadow-card` for resting cards, `shadow-raised` for the floating tab bar and sheets. Shadows are plum-tinted in light mode and never harsh.
- **Touch targets** are at least 48 × 48 (chips 44 tall inside a 48 hit area).

## Logo

The Bloom mark is a drop with a crescent cut-out, held by two leaves: a period, a cycle and growth in one shape. The wordmark pairs the mark with "Bloom" set in Playfair Display SemiBold, in `ink` with the mark in `primary` and `petal`.

- **Clear space:** at least the height of the mark's crescent on every side.
- **Minimum size:** mark 24 px; wordmark 80 px wide.
- **Colour:** full colour on `background` or `surface`; reversed on `hero-start` or darker; single-ink black or white where only one colour prints.
- **Don't** recolour it outside these versions, stretch it, add effects, put it on a busy photo, or set "Bloom" in any other face.

Files are in the Logos asset group; social templates are in Social.

## Iconography

Bloom uses Feather icons: 24 px grid, 2 px rounded stroke, no fills. Icons sit at 17–20 px in tiles and chips, 20 px in the tab bar and 15 px beside links. Inactive icons use `ink-muted`; active or on-colour icons use the matching `on-*` token. An icon always comes with a label, or with an accessibility label when it stands alone.

## Motion

Motion is slow and soft: short eased transitions, a 4-second in / 6-second out rhythm for the breathing exercise, and light haptics for confirmations and breathing cues. With Reduce Motion on, nothing scales or slides; words carry the change.

## Accessibility

- Text meets 4.5:1 (3:1 for 24 px and larger, control borders and focus rings) in light and dark. `npm run check` fails if a pairing drops below.
- Every control has a role, a label and a state (`checked`, `selected`), and toggles are whole-row targets.
- Meaning never relies on colour alone: phases have names, predicted days are dashed, care notices have an icon and a title.
- Charts carry a spoken summary (the cycle history chart reads its lengths and range aloud).

## Health and privacy rules for design

- Fertile windows and ovulation are always labelled as estimates and appear with "Bloom is not a method of contraception".
- Findings about changes and deviations describe what was logged, give common non-medical reasons, and suggest a professional when it persists. They never name a condition.
- Nothing personal in default notification text or in analytics events.
- App Lock covers the whole app; the lock screen says only "Bloom is locked" and that records stay private until you unlock.
