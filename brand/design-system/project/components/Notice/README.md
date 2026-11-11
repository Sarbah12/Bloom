# Notice

A soft, rounded message block for context that matters: disclaimers, care prompts and privacy reassurance.

## Tones

| Tone | Background | Text and icon | Default icon | Use |
| --- | --- | --- | --- | --- |
| `info` | `surface-muted` | `ink` (icon `ink-muted`) | info | Disclaimers and neutral context. |
| `care` | `warning-soft` | `on-warning-soft` | heart | "Worth mentioning to a professional." Never an alarm. |
| `privacy` | `primary-soft` | `on-primary-soft` | shield | Where data lives and who can see it. |

The icon can be overridden when another fits the message better (the Cramp relief tip uses a heart).

## Anatomy

Radius `radius-lg`, padding `space-lg`, icon 18 px with `space-md` gap; optional title in `headline`, body in `footnote`. No border, no left stripe.

## Content

- Title states the situation in plain words; body gives context and one next step.
- Care notices name common, non-medical reasons first and never name a condition.

## Accessibility

Role `note`. Meaning is carried by the title and icon as well as colour.
