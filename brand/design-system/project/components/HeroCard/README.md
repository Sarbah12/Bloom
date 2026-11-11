# HeroCard

The plum gradient card that states the single most important fact on a screen, such as "Day 1" of a period or days until the next one.

## Use

- Once per screen, at the top. Everything else is a plain or tint card.
- Background: a 135° gradient from `hero-start` to `hero-end`, radius `radius-xl`, padding `space-xxl`, `shadow-raised`.
- Text: a short lead in `callout` `on-hero-muted`, the fact in `hero` (Plus Jakarta Sans 56/800) `on-hero`, one supporting line in `callout` `on-hero`.
- Optional right-hand ring showing progress through the cycle: track in `on-hero` at 25 %, progress in `on-hero`.

## Content

- Lead with the number people check most: "Day 1", "In 5 days", "Period may be late".
- Estimates say so in the supporting line ("Estimated Nov 28").

## What the consumer provides

The lead, the fact and the supporting line; optionally the ring's day and total. Tapping the card opens Insights.

## Accessibility

The card is one accessible element whose label reads the lead, fact and supporting line as a sentence. The ring is decorative. `on-hero` on the gradient is at least 7:1 at its lightest point.
