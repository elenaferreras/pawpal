# PawPal — Project Context

## What it is
A mobile-first PWA dog care app. React 19 single-page app compiled into one
self-contained HTML file, deployed to GitHub Pages and added to the iOS home
screen from Safari.
Live at: https://elenaferreras.github.io/pawpal/

## Tech stack
- React 19 + TypeScript (strict), built with Vite (`vite-plugin-singlefile`)
- `@astryxdesign/core` design system (Theme, Stack, Grid, Card, Icon, Slider, …)
  with `@astryxdesign/theme-butter` / `theme-neutral`
- `@stylexjs/stylex` + custom CSS (`src/ui/styles/global.css`, CSS vars: --amber
  #e8920a, --green, --brown, --sand)
- `motion` (framer-motion successor) for transitions
- `qrcode.react` for sitter invite codes
- LocalStorage for data persistence; Supabase for optional cloud sync + sitter
  edge functions
- Service worker (`src/code.ts` → `code.js`) for offline app-shell cache + push

## Project layout
- `app/` — the real project (Vite + React). Everything below is under `app/`:
  - `src/ui/App.tsx` — root shell: onboarding gate, tab routing, quick-log
    modals, sitter/claim modes
  - `src/ui/screens/` — Dashboard (home), WalksStats/Walks, Food, Bathroom, Vet,
    Notifications, OnboardingProposal, SitterApp, SitterClaim, `settings/*`
  - `src/ui/components/` — BottomNav, GooeyFab, WalkTrackSheet, MotionSheet,
    RouteMap, LiveWalk, form modals, etc.
  - `src/ui/avatar/` — sticker-based dog avatar (presets, stickers, DogAvatar)
  - `src/ui/lib/` — store (DB context), auth, supabase, notifications, push,
    sitter, geo, date, export, theme
  - `src/code.ts` — service worker source
  - `public/manifest.json`, `public/onboarding/` — PWA manifest + doodle assets
  - `supabase/` — RLS/SQL + edge functions (`sitter-claim`, `sitter-log`,
    `sitter-owner`, `_shared`)
- Repo root — **deployed build artifacts** (`index.html`, `code.js`,
  `manifest.json`, icons, `onboarding/`) produced by `npm run deploy`. Do not
  hand-edit; they are overwritten on each deploy.

## Build & deploy (from `app/`)
- `npm run dev` — Vite dev server
- `npm run build` — tsc typecheck → `dist/ui.html` (single file) + esbuild SW →
  `dist/code.js` + copy manifest
- `npm run deploy` — build, copy `dist/*` to repo root, commit, and push
- Local static preview: Python `http.server` serving `app/dist/` (no HMR;
  rebuild after editing `src/**`)

## Features
- **Onboarding** — `OnboardingProposal`: warm one-question-per-screen flow
  (auth gate → find-your-pup sticker picker → name/breed/birthday/weight/food/
  meals/vet → review → notifications → celebration)
- **Avatar** — sticker-based dog avatar with background-colour picker
- **Dashboard (home)** — greeting header, avatar → Settings circular reveal,
  bell → Notifications reveal, stat cards, walks bar chart, vet notes checklist
- **Walks** — `WalksStats` with bar chart + route maps; live GPS tracker +
  step counter (`LiveWalk`); Track-walk sheet for manual/edited logs
- **Food** — daily portion goal, meals checklist widget
- **Bathroom** — pee/poop log with photos
- **Vet & Health** — editable reminders, notes checklist synced from walk notes
- **Settings** — profile, notifications, account (auth), dog-sitting, cloud
  sync, data export (JSON/CSV)
- **Dog sitting** — owner generates an invite code; a sitter claims it and logs
  activities into the owner's cloud data (Supabase edge functions + push)
- **Notifications** — walk/feed/vet reminders via Web Notifications API

## Data structure (localStorage key: 'pawpal')
```ts
{
  profile: {
    name, breed, birthday, weight, foodGoal, mealsPerDay,
    vet, vetPhone, emoji,
    avatar: { head, body, colour, eyes, nose, sticker, bg },
    onboarded: true
  },
  walks: [{ date, time, duration, steps, distance, pipi, popo, friends, weather, notes, gpsRoute, sentToVet, created }],
  meals: [{ date, time, type, amount, notes, created }],
  bathroom: [{ date, time, type, consistency, notes, photos, created }],
  vetRecords: {
    checkups: [{ reason, date, clinic, notes, hasFile, fileName }],
    vaccines: [{ name, date, nextDue }],
    reminders: [{ title, date, priority }],
    medications: [{ name, dose, freq, start, end, notes }],
    noteItems: [{ text, done }]
  }
}
```

## Supabase setup
- Cloud sync stores the whole DB as one JSON blob per account
- Auth via Supabase (email + password) in `src/ui/lib/auth.ts`
- Sitter flow uses edge functions under `app/supabase/functions/`
- Web push registration in `src/ui/lib/push.ts`

## Design
- Single "new" design (the old design toggle and classic welcome flow were
  removed — `Dashboard`/`WalksStats`/`OnboardingProposal` are the only UI)
- App icon / manifest theme: yellow Pawpal mark, `#FFFF83`
- Mobile-first, max-width ~430px; desktop shows `DesktopGate`

## Known issues / TODO
- GPS route tracking only works when installed to home screen (iOS PWA)
- Step counter uses DeviceMotion API, requires permission prompt on iOS
- localStorage limit ~5MB — bathroom photos eat into this fastest
- `global.css` still carries some legacy heavy heading weights (harmless)

## Dog name
The owner's dog is called **Zipi** 🐕
