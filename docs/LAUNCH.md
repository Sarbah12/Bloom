# Before launch

What the code can't settle on its own. Work top to bottom.

## Must do

- [ ] **Clinical review.** Every article in `lib/content/articles.ts`, the phase
      copy in `lib/content/phases.ts`, the cramp relief advice and "when to get
      help" lists in `lib/content/relief.ts`, and the notice, change and
      deviation wording in `lib/cycle/engine.ts` and `lib/cycle/changes.ts`
      (including the thresholds in `CHANGE_RULES`), the perimenopause notices
      in `lib/cycle/engine.ts` and articles, and the missed-pill screen
      (`lib/content/pill.ts`, `app/pill/[id].tsx`) need review by a qualified clinician. Record the
      reviewer and date in each article's `review` field — the app then shows
      "Clinically reviewed by …".
- [ ] **Test on real phones.** Keychain/Keystore storage, App Lock, the app
      switcher cover and local notifications only run natively. Build a dev
      client for iOS and Android and walk every screen.
- [x] **Privacy policy** live at `site/privacy.html` (Railway `website`
      service) — needs a legal review. Terms of use still to write.
- [ ] **Privacy policy and terms**, written for reproductive-health data (GDPR
      special-category data; US state laws such as Washington's My Health My
      Data Act). Link them in the app and the store listings.
- [ ] **Store privacy answers.** App Store privacy label and Google Play Data
      safety: health & fitness data, collected only with cloud backup,
      not linked to tracking, not shared, deletable in-app.
- [ ] **Name check.** Several apps already use "Bloom". Check trademarks and
      consider a store title such as "Bloom: Period & Cycle".
- [ ] **Export compliance.** `ITSAppUsesNonExemptEncryption` is `false`: the
      app uses standard AES for data at rest. Confirm that answer.

- [ ] **Android widget.** The home screen widget is iOS only so far
      (`targets/widget`). Android needs a native widget (for example
      `react-native-android-widget`) and a machine with Java and Android
      Studio to build and test it.
- [ ] **Minimum iOS is 16.4** (needed by the widget's shared storage). State
      it in the App Store listing.

## If cloud backup ships in v1

- [x] Supabase (self-hosted on Railway) deployed, 4 migrations applied and
      recorded, RLS tests passed against the live database, `.env` set.
- [ ] Email: add SMTP to the auth service (`GOTRUE_SMTP_HOST/PORT/USER/PASS`,
      `GOTRUE_SMTP_ADMIN_EMAIL`), then set `GOTRUE_MAILER_AUTOCONFIRM=false`.
      Until then sign-ups aren't email-verified and password reset can't send.
- [x] Backups: nightly encrypted `pg_dump` to the private bucket
      `bloom-backups` (30-day retention); restore tested 2026-11-12. See
      `docs/BACKUPS.md`. Copy `BACKUP_PASSPHRASE` into a password manager.
- [ ] Optional: a custom domain (e.g. `api.yourdomain`) on the kong service.
- [ ] Confirm `delete_my_account()` can delete from `auth.users` on the hosted
      project. If not, move deletion to an Edge Function that uses the admin API.
- [ ] Auth emails branded, redirect URLs registered.
- [ ] Consider end-to-end encrypting journal entries before upload.

## Later (roadmap)

- AI health assistant — server-side, explicit consent, medically reviewed sources.
- Shareable PDF report for appointments.
- Localisation (the catalog keys are already language-neutral).
