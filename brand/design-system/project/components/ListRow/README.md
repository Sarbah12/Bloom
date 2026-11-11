# ListRow

A settings or navigation row inside a card: icon tile, title, optional subtitle, and a chevron, value or switch at the end.

## Anatomy

- Minimum height 56; padding `space-md` `space-lg`; rows separated by a hairline `border`; the card is `surface`, radius `radius-lg`, `shadow-card`.
- Icon tile: 32 × 32, radius 10, `primary-soft` with the icon in `on-primary-soft` at 17 px.
- Title in `headline`; subtitle in `footnote` `ink-muted`; chevron in `ink-subtle`.

## Toggle rows

The **whole row** is the switch: role `switch` with `aria-checked`, and the switch graphic is visual only. Track on: `primary`; off: `switch-off`; knob `surface`. This keeps the target large and avoids double announcements.

## Destructive rows

Title and icon use `danger` / `danger-soft`; the action always opens a confirmation that says what will be lost.

## What the consumer provides

Icon, title, optional subtitle, and either `onPress` (link), `value` (trailing text) or `checked` + `onChange` (toggle).
