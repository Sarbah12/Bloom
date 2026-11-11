# CalendarDay

One day in the month calendar, showing whether it was a logged period day, a predicted one, or in the estimated fertile window.

## States

| State | Look |
| --- | --- |
| Logged period | filled `menstrual`, number in `menstrual-on-solid` |
| Predicted period | 2 px **dashed** `menstrual` outline |
| Fertile window (est.) | filled `ovulatory-soft`, number in `ovulatory-on-soft` |
| Ovulation (est.) | `ovulatory-soft` with a 2 px solid `ovulatory` ring |
| Today | 2 px `ink` ring (when not already a logged period day) |
| Selected | 2 px `primary` ring outside the day, 1 px gap |
| Has a check-in | 5 px `ink-muted` dot below the number |

## Anatomy

A 38 px circle inside a 48 px cell; number in `headline`. A legend under the month names every state in words, and the fertile entries are hidden when the person turns fertility estimates off.

## Accessibility

Each day is a button whose label reads the date and its state ("November 3, period day, check-in logged"). Predicted and fertile states differ by outline and fill as well as hue.
