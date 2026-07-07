# PawPal — Project Context

## What it is
A mobile-first PWA dog care app built as a single HTML file. 
Designed to be added to the iOS home screen from Safari.
Live at: https://elenaferreras.github.io/pawpal/pawpal.html

## Tech stack
- Vanilla HTML/CSS/JS — no framework
- LocalStorage for data persistence
- Supabase (REST API via fetch) for optional cloud sync
- Phosphor Icons (CSS CDN)
- Service worker (sw.js) for notifications

## Features built
- **Onboarding** — 4-step flow with dog profile creation
- **Avatar creator** — visual tabbed UI (Colour/Head/Eyes/Nose/Body)
  - SVGs from Figma: heads (12 variants), bodies (6), eyes (9), noses (13)
  - 8 colour palettes, recoloured by replacing hex values in SVGs
  - Head/body images stored as base64 data URIs in JS constants
  - Eyes/nose overlaid with pixel-perfect positioning from original Figma coords
- **Home screen** — bold greeting header with dog face avatar + bell icon
  - Stats cards: walks today, food %, steps chart (canvas bar chart by hour)
  - Notification panel (bell) showing today's status
- **Walks** — live GPS tracker + step counter (DeviceMotion API)
  - Manual log option, weather picker, pipi/popo/friends toggles
  - Edit existing walks
- **Food tracker** — daily portion goal with progress bar
- **Vet & Health** — checkups (PDF upload), vaccines, medications, reminders
- **Bathroom log** — with photo upload for popo
- **Profile** — dog info, avatar editor, data export (JSON/CSV), Supabase sync
- **Notifications** — walk/feed/vet reminders via Web Notifications API

## Design system
- Font: SF Pro Display (system)
- Palette: --amber #E8920A, --green #3D8B6E, --brown #6B3A2A
- Background: #F5F5F3, Surface: #FFFFFF
- Border radius: --radius 20px, --radius-pill 100px
- No borders on cards, box-shadow: 0 1px 3px rgba(0,0,0,0.05)
- Bold heavy headings (font-weight: 900, letter-spacing: -1px)
- Nav active colour: amber

## Data structure (localStorage key: 'pawpal')
```js
{
  profile: {
    name, breed, birthday, weight, foodGoal,
    vet, vetPhone, emoji,
    avatar: { head, body, colour, eyes, nose },
    onboarded: true
  },
  walks: [{ date, time, duration, steps, distance, pipi, popo, friends, weather, notes, gpsRoute, created }],
  meals: [{ date, time, type, amount, notes, created }],
  bathroom: [{ date, time, type, consistency, notes, photos, created }],
  vetRecords: {
    checkups: [{ reason, date, clinic, notes, hasFile, fileName }],
    vaccines: [{ name, date, nextDue }],
    reminders: [{ title, date, priority }],
    medications: [{ name, dose, freq, start, end, notes }]
  }
}
```

## Supabase setup
- Table: `pawpal_data` (id text PK, payload jsonb, updated_at timestamptz)
- Uses anon key stored in localStorage key `pawpal_sb`
- Syncs entire DB as one JSON blob per device

## Files
- `pawpal.html` — entire app (~517kb, includes all base64 SVG assets)
- `sw.js` — service worker for notifications and offline cache

## Known issues / TODO
- Body "Wide/Chunky" variant SVG was missing, uses placeholder
- Supabase connection test fails with "Failed to fetch" on some setups
  (credentials save anyway, actual sync works fine)
- GPS route tracking only works when installed to home screen (iOS PWA)
- Step counter uses DeviceMotion API, requires permission prompt on iOS
- localStorage limit ~5MB — popo photos eat into this fastest

## Dog name
The owner's dog is called **Zipi** 🐕
