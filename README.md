# Bloom

A privacy-first menstrual health app for iOS and Android: period tracking, cycle
predictions with honest confidence, symptom and mood logging, pattern insights,
cycle-change and deviation alerts, cramp relief, symptom trend charts, body and
lifestyle tracking, medication reminders, a contraceptive pill pack tracker,
perimenopause support, a discreet iOS home screen widget, a doctor visit
report (PDF), a private journal and sourced health education.

Built with Expo SDK 54 (React Native 0.81, expo-router). One codebase for both
platforms; a browser build exists only for previewing during development.

## Run it

```bash
npm install
npx expo start            # press i / a for a simulator, or scan with a dev build
npx expo start --web      # quick preview in a browser (not for real data)
```

### On the iPhone simulator

```bash
npx expo run:ios          # generates ios/, installs pods, builds, launches, starts Metro
```

Two config plugins keep the native build healthy (both are applied on every
`prebuild`, so nothing in the generated `ios/` folder needs hand edits):

- `plugins/with-min-pod-deployment-target.js` — Xcode 27 refuses pods that
  target iOS < 15; this raises them to 15.1.
- `ios.entitlements.keychain-access-groups` in `app.json` — without it the
  simulator denies Keychain access and the encrypted vault can't store its key.

Optional cloud backup needs a Supabase project — see **Backend** below. Without
it the app is fully functional and everything stays on the phone.

## Formatting

```bash
npm run format            # Prettier, using .prettierrc
```

## Checks

```bash
npm run check
```

Runs, offline:

| Check | What it proves |
| --- | --- |
| types | `tsc --noEmit` |
| lint | `expo lint`, zero warnings |
| unit tests | cycle engine, dates, patterns, encryption, sync merge (Node test runner) |
| contrast | every colour pairing in both themes meets WCAG AA |
| health copy | no "safe days"/contraception/certainty claims; every fertile-window screen shows the disclaimer |
| database | applies the migrations to a throwaway Postgres and runs the row-level-security tests (skipped if Postgres isn't installed) |

## How it's built

```
app/                 screens (expo-router): onboarding, (tabs)/home·calendar·insights·learn·profile,
                     log/[date], journal, relief, medications, report, settings, account,
                     design (dev-only design system gallery)
components/ui/       design-system components (Text, Button, Card, GradientCard, Chip, ListRow, TabBar…)
components/cycle/    CycleRing, HeroRing, MonthCalendar, CycleHistoryChart, PhaseBadge
components/insights/ FindingCard, TrendChart
components/relief/   BreathingExercise, StretchCard
components/brand/    Bloom mark, badge, wordmark — geometry in logo-paths.ts
theme/tokens.ts      every colour, type size, radius and shadow
lib/cycle/           the cycle engine (pure, fully tested) — predictions, phases, notices, patterns,
                     changes and deviations, symptom trends, lifestyle across the cycle
lib/report/          doctor visit report: facts (pure, tested) → HTML → PDF on the phone
targets/widget/      iOS widget (SwiftUI/WidgetKit); reads cycle numbers shared via the App Group
lib/data/            app state, persisted to the encrypted vault
lib/storage/         AES-256-GCM vault; key in iOS Keychain / Android Keystore
lib/supabase/        optional auth + backup sync (last-write-wins with tombstones)
lib/content/         articles, phase copy, disclaimers
supabase/            migrations + RLS tests
scripts/             checks and icon generation
```

### Cycle engine

`lib/cycle/engine.ts` turns period records into everything the app shows. Rules
are cited in the file (FIGO 2018 for normal ranges, Wilcox 1995 for the fertile
window). Highlights:

- Dates are calendar days (`YYYY-MM-DD`), never instants, so time zones and
  daylight saving can't shift a logged period.
- Averages use the last six cycles; with fewer than three, the length the person
  entered still carries weight.
- Confidence (low / medium / high) depends on how many cycles exist and how much
  they vary; prediction windows widen with variation.
- Gaps that look like missed logging aren't counted.
- Notices (irregular, long or short cycles, long periods, 90+ days without a
  period) suggest talking to a professional — never a diagnosis.

### Privacy

- Health data lives on the phone, encrypted with AES-256-GCM. The key is kept in
  the secure keychain marked *this device only*, so it never travels in backups.
  Android auto-backup is disabled.
- No analytics, no advertising SDKs, no AD_ID permission.
- Notifications are local and discreet by default (no period/fertility wording
  on the lock screen).
- Optional App Lock (Face ID / fingerprint / passcode); content is covered in
  the app switcher.
- Cloud backup is off until the person signs in *and* opts in; each consent
  decision is appended to an audit log.
- Export everything as JSON and restore it on a new phone (Profile → Restore
  from a backup, or "New phone? Restore a backup" on the welcome screen). The
  file is validated record by record and nothing changes until you confirm.
- "Delete all my data" wipes the phone and, if signed in, the cloud account
  (cascade delete).

## Backend (optional cloud backup)

Cloud backup runs on **self-hosted Supabase on Railway** (project `bloom`,
template “Supabase (Self-Hosted, Full Stack)”: Postgres, Auth, PostgREST,
Storage, Meta, Studio and a Kong gateway). Only the gateway is public:

- API: `https://kong-production-2f400206.up.railway.app`
- Studio (dashboard): same URL at `/`, behind basic auth —
  `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` in the kong service's Variables.
- Keys: `ANON_KEY` (public, goes in the app) and `SERVICE_ROLE_KEY` (admin,
  never in the app or git) are in the kong service's Variables.

**App:** `.env` holds `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). Rebuild after changing it.

**Migrations:** `supabase/migrations/*.sql`, applied once each and recorded in
`supabase_migrations.schema_migrations`:

```
SUPABASE_URL=https://kong-production-2f400206.up.railway.app \
SUPABASE_SERVICE_ROLE_KEY=<from Railway> npm run migrate:remote
```

**Auth settings** (auth service Variables): `GOTRUE_SITE_URL=bloom://account`,
`GOTRUE_URI_ALLOW_LIST` includes `bloom://account` and `bloom://account/reset`.
Before launch, add SMTP (`GOTRUE_SMTP_*`) and set
`GOTRUE_MAILER_AUTOCONFIRM=false` so emails are confirmed and password resets
can be sent.

Do not change `JWT_SECRET`, `POSTGRES_PASSWORD` or the keys after launch
without following Supabase's rotation guide — every signed-in phone would be
signed out and the app's key would stop working.

## Brand

The mark is a drop with a crescent, cradled by two leaves. Change the shapes in
`components/brand/logo-paths.ts`, then regenerate every icon:

```bash
npm run build:icons
```

See [docs/LAUNCH.md](docs/LAUNCH.md) for what remains before store submission.
