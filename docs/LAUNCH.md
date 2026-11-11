# Before launch

What the code can't settle on its own. Work top to bottom.

## Must do

- [ ] **Clinical review.** Every article in `lib/content/articles.ts`, the phase
      copy in `lib/content/phases.ts`, the cramp relief advice and "when to get
      help" lists in `lib/content/relief.ts`, and the notice, change and
      deviation wording in `lib/cycle/engine.ts` and `lib/cycle/changes.ts`
      (including the thresholds in `CHANGE_RULES`) need review by a qualified clinician. Record the
      reviewer and date in each article's `review` field — the app then shows
      "Clinically reviewed by …".
- [ ] **Test on real phones.** Keychain/Keystore storage, App Lock, the app
      switcher cover and local notifications only run natively. Build a dev
      client for iOS and Android and walk every screen.
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

## If cloud backup ships in v1

- [ ] Supabase project created, migration applied, env vars set (see README).
- [ ] Confirm `delete_my_account()` can delete from `auth.users` on the hosted
      project. If not, move deletion to an Edge Function that uses the admin API.
- [ ] Auth emails branded, redirect URLs registered.
- [ ] Consider end-to-end encrypting journal entries before upload.

## Later (roadmap)

- AI health assistant — server-side, explicit consent, medically reviewed sources.
- Shareable PDF report for appointments.
- Localisation (the catalog keys are already language-neutral).
