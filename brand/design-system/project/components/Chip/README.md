# Chip

A pill you tap to pick symptoms, moods, flow or what helped; used in groups that wrap.

## States

| State | Background | Border | Label |
| --- | --- | --- | --- |
| Off | `surface` | `border-strong` | `ink` |
| On | `primary` | `primary` | `on-primary` |
| On, tinted | a phase solid (e.g. `menstrual`) | same | its `-on-solid` |

When a chip with an icon is selected, the icon becomes a check, so the state never relies on colour.

## Anatomy

- 44 px tall inside a 48 px hit area; radius `radius-pill`; padding `space-lg`; label in `body`.
- Optional leading Feather icon at 18 px.
- Groups wrap with `space-sm` gaps. A horizontally scrolling group is used only for filters (Learn categories).

## Behaviour

- **Multi-select** (symptoms, moods, relief): role `checkbox`, `aria-checked`.
- **Single-select** (flow, filters): role `radio` in a `radiogroup`; tapping the selected chip again clears it where "none" is valid.

## What the consumer provides

The label, the selected state, an optional icon and tint, and the change handler.
