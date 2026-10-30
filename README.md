# Kavach: campus safety for KLE Technological University

**Identify at the doors, anonymous in between.**

Kavach is a clickable prototype of a campus safety and asset protection app for KLE Technological University, Hubballi (B.V. Bhoomaraddi Campus, Vidyanagar). Students are verified at checkpoints with a rotating QR code. Between checkpoints, CCTV only watches for dangerous behaviour and never identifies anyone. At night, students can ask for an escort called **Saathi Walk**.

It ships as an **Android app** (and the same build runs in a browser). There is no backend: sensors, cameras and scans are simulated with buttons and timers, and all data is mock data.

## Get the Android app

Every push to GitHub builds a debug APK in GitHub Actions (`.github/workflows/android.yml`).

1. Open the repository's **Actions** tab, then the latest **Android APK** run.
2. Download the **kavach-debug-apk** artifact and unzip it.
3. Copy `app-debug.apk` to an Android phone (Android 6 or newer), open it and allow installing from this source.

To build it yourself you need Node 22, JDK 21 and the Android SDK (Android Studio installs it):

```bash
npm install
```

```bash
npm run android:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. `npm run android:open` opens the project in Android Studio instead.

## Run it in a browser

Open `www/index.html` in Chrome or Edge (double-click it). It works offline. On a laptop it shows a phone frame with a demo guide, and on wide screens **Side by side** shows the Student, Guard and Admin apps together.

## Demo script (about 6 minutes)

1. **Student → My ID.** Unlock with fingerprint. The QR changes every 10 seconds. *Simulate gate scan*, then *Scan IN again* (anti-passback), then *Try screenshot QR* (rejected).
2. **Student → Saathi Walk.** *Help me get home* → Girls Hostel → *Start walk*. Each checkpoint shows how many cameras cover it. Tap *Pass next checkpoint*, then *Go missing* and let the 30 s timer run out.
3. **Guard → Alerts.** The *Missed checkpoint* alert has the last photo and a **Live CAM** button that opens the camera. Accept, turn on lights, play the speaker warning.
4. **Guard → Cameras.** The camera wall shows every feed (faces blurred, anonymous behaviour boxes). Open one to zoom, pan (PTZ cameras), use the talk-down speaker, take a snapshot, flag an incident or request an unblur (goes to the student committee). In **Demo**, tamper a camera or take one offline.
5. **Admin → Twin.** The 3D digital twin (CesiumJS) shows buildings, camera coverage cones, live alerts as beams, guards, the Saathi Walk route and an alert heatmap. Tap a camera to see its feed. **Open command centre** (on Overview) gives a full-screen twin with a camera wall; turn the phone sideways.
6. **Admin.** CCTV health, visitor passes, lab stock report, and the audit log, which records every camera view, snapshot and unblur request.

## What's inside

| Role | Features |
|---|---|
| Student | Rotating QR ID with gate scan, Saathi Walk (checkpoint photos tagged with the camera, camera coverage per stretch, "Are you OK?", SOS, follower alert, share link, photos deleted on arrival), report a dark spot or broken camera, LabLedger, My data (what a camera actually sees, camera coverage map, retention, privacy promise) |
| Guard | Alert feed linked to cameras, live map with camera coverage layer, **Cameras** tab (camera wall, viewer with PTZ, talk-down, snapshot, flag incident, unblur request), active walks, demo triggers including camera tamper and camera offline |
| Admin | Live stats, CCTV health, **CesiumJS digital twin** with layer toggles and full-screen command centre, visitor passes, lab inventory and yearly report, audit log and monthly transparency summary |

All three roles share one in-memory state, so an action in one shows up live in the others.

## Brand

Colours and type follow the KLE Tech brand guidebook: Deep Red `#6B170D` as the primary colour, Nutmeg `#BFA682` for calls to action, KLE Red `#BF383C` only as a sparing accent, warm Ivory/Sand/Quicksand/Slate neutrals, **Lora** for headings and **Outfit** for everything else (both bundled, so they work offline). The official KLE Tech logo is used unaltered, on light backgrounds only.

## Campus layout

The map and the 3D twin are an **approximate, schematic** layout of the KLE Tech Hubballi campus, not a survey. Everything (buildings, roads, checkpoints, guard posts and the 14 cameras with their direction and range) lives in `src/campus.js`, in metres from the campus centre. Edit that one file to match the real campus; the 2D map, the 3D twin and camera coverage all update.

## Project layout

| Path | Contents |
|---|---|
| `src/campus.js` | Campus model: buildings, roads, checkpoints, guard posts, cameras |
| `src/data.js` | Mock data (student, routes, inventory, alerts, audit log) and helpers |
| `src/store.js` | Shared state actions and timers (escalation, walk check-ins, CCTV actions) |
| `src/cctv.jsx` | Simulated camera feeds, camera wall tiles, camera viewer |
| `src/twin.js` | CesiumJS digital twin, bundled separately into `www/twin.js` and loaded on demand |
| `src/twinview.jsx` | React wrapper for the twin, layer toggles, command centre |
| `src/student.jsx`, `src/guard.jsx`, `src/admin.jsx` | The three apps |
| `src/main.jsx` | App shell: start screen, role switcher, phone frame, side-by-side view |
| `www/` | Built web app (also what the Android app loads) |
| `android/` | Capacitor Android project |

`npm run build` rebuilds `www/`; `npm run watch` rebuilds on save.

Built with React 18, Tailwind CSS 3, CesiumJS (`@cesium/engine`), Capacitor 7, esbuild and qrcode-generator.

The 3D twin runs fully offline: it has no globe imagery or terrain and needs no Cesium Ion token. The ground is painted from `src/campus.js`.
