# Submitting Bloom to the App Store

Team: **Accra Resource Center LBG** (`3FPZL5YV7Z`, set as `ios.appleTeamId`).
Bundle IDs: `com.sarbah.bloom` (app), `com.sarbah.bloom.widget` (widget).
App Group: `group.com.sarbah.bloom`. iPhone only. Minimum iOS 16.4.

## Before the first upload — blockers

- [ ] **App name.** “Bloom” is almost certainly taken on the App Store. Pick a
      unique store name, e.g. “Bloom: Period & Cycle Tracker” (the home-screen
      name can stay “Bloom”).
- [x] **Privacy policy URL:** https://website-production-cc3c0a16.up.railway.app/privacy
      (version 2026-11, also linked in the app: Profile → Privacy policy).
      Have it reviewed by someone qualified in data-protection law before
      launch — especially sections 6 (legal basis), 7 (transfers) and 11.
- [x] **Support URL:** https://website-production-cc3c0a16.up.railway.app/support
- [ ] Optional: a custom domain for the site (e.g. bloomapp.com) — then
      update `lib/content/links.ts` and the URLs in App Store Connect.
- [ ] **Clinical review** of health content (see `docs/LAUNCH.md`).
- [ ] **Account emails.** No email provider is set up yet: sign-ups aren't
      verified and password reset can't send. Fine for review, but fix before
      real users rely on cloud backup.

## 1. Build the archive (Xcode)

```
npx expo prebuild -p ios --clean
open ios/Bloom.xcworkspace
```

1. Xcode → Settings → Accounts: sign in with an Apple ID on the Accra Resource
   Center LBG team.
2. Select the **Bloom** target → Signing & Capabilities: “Automatically manage
   signing” on, Team = Accra Resource Center LBG. Repeat for **BloomWidget**.
   Xcode registers both App IDs and the App Group the first time.
3. Bump the build number for every upload (`ios.buildNumber` in `app.json`,
   then prebuild again) — App Store Connect rejects a repeated number.
4. Scheme **Bloom**, destination **Any iOS Device (arm64)** → Product →
   **Archive**.
5. Organizer → **Distribute App** → App Store Connect → Upload.

## 2. App Store Connect — create the app

- Platform iOS, bundle ID `com.sarbah.bloom`, SKU e.g. `bloom-ios`, primary
  language English.
- **Category:** Health & Fitness (secondary: Medical is *not* recommended —
  Bloom doesn't diagnose).
- **Age rating:** answer “Medical/Treatment Information: Infrequent/Mild”;
  everything else None. Expect 12+.

## 3. App Privacy (“nutrition label”)

Matches the privacy manifest in `app.json` (`ios.privacyManifests`).

| Data | Collected? | Linked to user | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Health (periods, symptoms, moods, notes, medications, body data) | Yes — only if cloud backup is turned on | Yes | No | App Functionality |
| Email address | Yes — cloud backup account | Yes | No | App Functionality |
| Name (optional display name) | Yes — if backup is on | Yes | No | App Functionality |
| Everything else (location, contacts, identifiers, usage data, diagnostics) | No | | | |

Data stored only on the phone (the encrypted vault) is **not** “collected” in
Apple's sense — Apple counts data sent off the device.

## 4. Export compliance

`ITSAppUsesNonExemptEncryption` is currently `false`. Bloom uses standard
encryption (AES-256-GCM to protect data on the phone, HTTPS to the backup
server) and no proprietary algorithms. Confirm the answer in App Store
Connect's encryption questions before release — this is listed in
`docs/LAUNCH.md` too.

## 5. Review notes (paste into App Review Information)

> Bloom is a private, on-device period and cycle tracker. No account is
> needed — tap through onboarding to use every feature. Cloud backup is
> optional (Profile → Account & backup); you can create an account with any
> email to test it. Fertile-window estimates are labelled as estimates and
> the app states it is not a method of contraception. Health information is
> educational and sourced (NHS, ACOG, NICE); the app does not diagnose.
> Notifications are local only. Account and all data can be deleted in
> Profile → Delete all my data.

## 6. Screenshots

iPhone 6.9″ (1320 × 2868) is required; Apple scales it for smaller phones.
Suggested set: Home (hero card), Calendar, Insights (cycle history + What's
changed), Check-in, Cramp relief, Doctor visit report, the widget on the home
screen. Use the sample data, not a real person's.
