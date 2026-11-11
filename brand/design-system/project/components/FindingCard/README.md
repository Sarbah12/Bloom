# FindingCard

One observation from the person's own logs — a change over recent cycles, or a deviation from their usual — with the numbers, context and a gentle next step.

## Levels

| Level | Background | Icon | Use |
| --- | --- | --- | --- |
| `info` | `surface`, 1 px `border` | trending-up or trending-down in `ink` | A shift worth knowing ("cycles getting shorter"). |
| `care` | `warning-soft`, text `on-warning-soft` | alert-circle | Something to mention to a professional (heavy days, bleeding between periods, severe pain). |
| `good` | `success-soft`, icon `success` | check-circle | Good news ("cramps have been easier"). |

## Anatomy

Title in `headline`; the numbers in `caption` ("21 days · your usual 28"); the explanation in `footnote`. Radius `radius-lg`, padding `space-lg`.

## Rules

- Changes compare the **median** of the last 3 cycles with the cycles before, so one unusual cycle never reads as a trend; single outliers appear as a deviation instead.
- Needs about 5 cycles before comparing; until then, say so rather than guess.
- Always give common everyday reasons first, never name a condition, and suggest a professional only when it persists or is a care-level finding.

## Accessibility

One accessible element reading title, numbers and explanation. Level is carried by the icon and words as well as colour.
