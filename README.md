# IronLog

A personal, offline-first powerlifting tracker built around an 8-week strength block (Bench / Squat / Deadlift), with editable programming, auto-calculated working weights, PR detection, achievements, and full recovery/progress tracking.

No accounts, no ads, no server. Everything is stored locally on your device (IndexedDB), including exercise photos.

The previous "Finance AI Report Generator" that used to live in this repo has been moved to [`legacy-finance/`](legacy-finance/) rather than deleted.

## Try it right now (fastest option)

You don't need Android Studio to use this app today — it's a Progressive Web App:

1. Host the `www/` folder anywhere static (GitHub Pages, Netlify, Vercel, or just run it locally — see below).
2. Open the URL in Chrome on your Samsung phone.
3. Tap the menu (⋮) → **Add to Home screen**.
4. It now behaves like a real app: its own icon, full-screen, works completely offline after the first load.

### Run it locally to test

```bash
cd www
python3 -m http.server 8080
# then open http://localhost:8080 on the same network
```

## Building a real `.apk`

This repo is already wired up with [Capacitor](https://capacitorjs.com), so the Android project (`android/`) exists and points at `www/` as its web content. Building the actual `.apk` file requires the Android SDK + internet access to Google's Maven repo, which is **not available in this sandboxed session** — so this last step needs to happen on a machine with real internet access. Two ways to finish it, no coding required either way:

### Option A — PWABuilder (easiest, no Android Studio)
1. Host `www/` at a public URL (see above).
2. Go to [pwabuilder.com](https://www.pwabuilder.com), paste the URL.
3. Click **Package for Stores** → **Android**.
4. Download the signed `.apk`, transfer it to your phone, and install it (enable "Install unknown apps" for your file manager/browser once, in Android Settings).

### Option B — Android Studio (native build)
1. Install [Android Studio](https://developer.android.com/studio) on a PC.
2. Run once, locally, from the repo root:
   ```bash
   npm install
   npx cap sync android
   npx cap open android
   ```
3. Android Studio opens the `android/` project. Click **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
4. Grab the `.apk` from `android/app/build/outputs/apk/debug/` and install it on your phone.

Either way, after editing any file in `www/`, re-run `npx cap sync android` before rebuilding so the native project picks up the changes.

## Project structure

```
www/                  ← the actual app (this is all that runs on your phone)
  index.html
  manifest.json        PWA manifest (name, icons, colors)
  sw.js                 service worker — caches everything for offline use
  css/style.css
  js/
    app.js              screens, routing, workout engine, UI
    db.js               IndexedDB wrapper (settings/program/workouts/recovery/photos/achievements)
    defaults.js         your starting program + starting 1RMs — fully editable in-app afterward
    calc.js             % → weight math, rounding, Epley 1RM estimate, streaks
    achievements.js     badge definitions + unlock logic
    charts.js           dependency-free canvas line/bar charts
  icons/                generated app icons

android/               Capacitor-generated native Android project (build with Option B above)
capacitor.config.json  Capacitor config (app id, name, web dir)
scripts/make_icons.py  regenerates icons/ if you want a different design later
legacy-finance/        the old Finance AI Report Generator, preserved
```

## What's editable in-app

Everything the program is built from — 1RMs, the 8-week percentage schedule (with per-week deload flag), every exercise's sets/reps/category/day, which lift and mode (weekly % vs fixed %) it's based on, weight-increment suggestions, rounding increment, rest timer length, and theme accent color — is editable from the **Program** and **Settings** tabs. Nothing about the program is hard-coded into the app logic; `defaults.js` only supplies the values you start with.
