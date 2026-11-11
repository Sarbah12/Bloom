# TabBar

The floating pill navigation for Bloom's five sections: Home, Calendar, Insights, Learn and Profile.

## Anatomy

- Floats above content, inset `space-lg` from the sides and `space-md` (or the safe area) from the bottom.
- Pill of `surface`, 1 px `border`, `shadow-raised`, padding 6.
- Inactive tabs: 46 × 52, icon only, 20 px, `ink-muted`.
- Active tab: grows to fill the remaining width, `primary` pill with the icon and label in `on-primary` (`headline`).

## Rules

- Exactly five tabs; labels are single words.
- Screens with the tab bar add bottom padding so the last card clears it.
- Sheets (check-in, journal) and pushed screens (relief, articles) hide it.

## Accessibility

Role `tablist`; each tab is a `tab` with `aria-selected` and an accessible label even when the label is hidden.
