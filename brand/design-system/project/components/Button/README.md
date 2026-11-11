# Button

A pill-shaped button with a single, plainly worded action; primary is the one main action on a screen.

## Variants

| Variant | Background | Label | Use |
| --- | --- | --- | --- |
| `primary` | `primary` (pressed `primary-pressed`) | `on-primary` | The main action. One per screen. |
| `secondary` | `surface`, 1 px `border-strong` | `ink` | A real alternative ("Not now"). |
| `soft` | `primary-soft` | `on-primary-soft` | Helpful extras inside cards ("Cramp relief ideas"). |
| `ghost` | none | `primary` | Low-emphasis inline actions ("Edit"). |
| `danger` | `danger-soft` | `on-danger-soft` | Destructive actions only, always confirmed. |
| `inverse` | `on-hero` | `hero-start` | On the hero gradient (breathing exercise "Start"). |

**Arrow:** a primary button that leads somewhere ("Log today’s check-in") puts the label left and an arrow in a 40 px `on-primary` circle at the right, 56 px tall, full width.

## Anatomy and spacing

- Height 48 (`lg` 56); radius `radius-pill`; horizontal padding `space-xl` (`lg`: `space-xxl`).
- Label in `headline` (Inter 15/600), sentence case, says what happens.
- Optional leading Feather icon at 18 px, `space-sm` before the label.
- Loading replaces the label with a spinner in the label colour; the button keeps its width.

## Accessibility

- Role `button`; the label is the accessible name. Disabled buttons are announced as disabled and drop to 50 % opacity.
- Focus ring: 2 px `focus`, offset 2 px. Hit area at least 48 × 48.
