# Kavach: campus safety for KLE Technological University

**Identify at the doors, anonymous in between.**

Kavach is a campus safety and asset protection prototype for KLE Technological University, Hubballi (B.V. Bhoomaraddi Campus, Vidyanagar). Students are verified at checkpoints with a rotating QR code. Between checkpoints, CCTV only watches for dangerous behaviour and never identifies anyone. At night, students can ask for an escort called **Saathi Walk**.

It comes in two editions:

| Edition | Who uses it | What it has | Runs on |
|---|---|---|---|
| **Phone** | Students and guards | Student app, Guard app | Android app (APK), or any phone browser |
| **Laptop** | Security office | **Admin console** (3D digital twin, CCTV, alerts, visitors, lab stock, audit, Setup) and the **campus hub** that links the phones | Windows, macOS or Linux with Node.js 18+ |

The Admin view exists only in the laptop edition. The hub serves the console only to the laptop itself (`http://localhost:8787`); phones that open the hub get the phone edition, and admin-only actions are refused from phones.

The app **starts empty**: every alert, scan, walk, visitor, statistic and audit entry comes from what people do in it. Cameras show video only when a real webcam or phone camera is connected; demo buttons simulate the parts that need hardware (gate turnstile, RFID, weight sensors).

## Set up on campus

### 1. Laptop (security office)

1. Download the **kavach-laptop** artifact from the latest run in the repository's **Actions** tab, and unzip it anywhere (e.g. `Documents\Kavach`).
2. Install **Node.js LTS** (18 or newer) from [nodejs.org](https://nodejs.org). Nothing else is needed.
3. Start Kavach:
   - **Windows:** double-click `start-windows.bat`. When Windows Defender Firewall asks about Node.js, allow it on **private networks**.
   - **macOS:** double-click `start-mac.command` (the first time: right-click → Open). Allow incoming connections when asked.
   - **Linux:** run `./start-linux.sh`.

   A window shows the hub's Wi-Fi address and pairing code, and the Admin console opens at `http://localhost:8787`. Keep that window open while Kavach is in use.
4. The console opens on **Setup** the first time:
   - **Cameras:** plug in USB webcams, open **Cameras → Find cameras** and assign each one to a campus camera (e.g. `CAM-G1` at the Main Gate). Use Chrome or Edge. The AI runs on the laptop.
   - **Pair phones:** see below.
   - Click **Finish setup**.

Campus data is saved in the `data` folder next to `hub.mjs` (`state.json`, `config.json`). Copy that folder to back it up or to move Kavach to another laptop. **Setup → Export** downloads it as JSON, and **Erase all campus data** starts fresh.

### 2. Phones (guards and students)

1. Download the **kavach-debug-apk** artifact from the same Actions run, unzip it, copy `app-debug.apk` to the phone (Android 6+) and install it.
2. Connect the phone to the **same Wi-Fi** as the laptop.
3. In the app tap **Connect to the campus hub → Scan pairing QR** and scan the QR on the laptop's Setup page, or type the address and 6-digit code.

No app? Scan the Setup QR with the phone's camera: it opens Kavach in the browser and pairs automatically (cameras and the face check need the app, because browsers only allow cameras on secure pages).

Each phone gets its own token, so the laptop can **unpair** one phone without affecting the others, and a **new code** only applies to phones pairing from then on. If the Wi-Fi drops, the phone keeps working and sends its actions (SOS, check-ins, scans) when the hub is back. Without a hub, a phone works on its own as a stand-alone demo.

## How the editions work together

```
 Student phone ─┐                       ┌─ Admin console (browser on the laptop)
 Guard phone  ──┼── Wi-Fi ── Kavach hub ┤
 Guard phone  ──┘   (long-poll sync)    └─ data/state.json
```

- The **hub** (`hub/server.js`, bundled to `hub.mjs`) keeps the one shared copy of the campus state, runs the timers (alert escalation, missed-checkpoint prompts) and saves to disk.
- Every change is a **named action** (`src/actions.js`), such as `passNext`, `acceptAlert` or `createVisitor`. A device applies it locally at once, then sends it to the hub, which runs the same code and pushes the new state to every device. A retried action never runs twice.
- Which demo student a phone is signed in as (Priya or Aarav) stays on that phone, so two students can use Kavach at the same time. Student notifications reach only that student, and a Saathi Walk can only be driven from the phone that started it.
- A camera connected on the laptop shows as **live** on guard phones ("Live on Security laptop"). Video and AI stay on the device with the camera; only alerts, anonymised alert frames and checkpoint photos are shared. When a student passes a checkpoint, the device with that checkpoint's camera adds the photo.

## Demo script (about 6 minutes)

Start the laptop edition (`npm start` from source, or the start script), then open the phone edition on a phone or in a second browser window and pair it.

0. **Phone → start screen.** Pick Female (pink) or Male (blue), then open the student app.
1. **Student → My ID.** Unlock with fingerprint. The QR changes every 10 seconds. *Simulate gate scan*, then *Scan IN again* (anti-passback), then *Try screenshot QR* (rejected). The console's **Entries today** goes up.
2. **Student → Saathi Walk.** *Help me get home* → *Start walk*. With a webcam on the laptop assigned to `CAM-A1`, the checkpoint A photo is a real, anonymised frame. Tap *Go missing* and let the timer run out.
3. **Guard phone → Alerts.** The *Missed checkpoint* alert has the last photo. Accept it, turn on lights, play the speaker warning. The console shows it as accepted.
4. **Laptop → Cameras.** Walk past the webcam, run, or stand still to trigger the AI rules. Guard phones get the alert with the anonymised frame.
5. **Laptop → Digital twin / Command centre.** The 3D campus with camera cones, live alert beams, guards, the walk route and the heatmap.
6. **Laptop → Visitors, Lab stock, Audit.** Visitor passes (guards are told), the yearly stock report, and the audit log of every camera view, snapshot and unblur request.

## Features

| Where | Features |
|---|---|
| Student (phone) | Rotating QR ID with gate scan, Saathi Walk (checkpoint photos tagged with the camera, camera coverage per stretch, "Are you OK?", SOS, follower alert, share link, photos deleted on arrival), report a dark spot or broken camera, LabLedger, My data (what a camera sees, retention, privacy promise), campus hub pairing |
| Guard (phone) | Alert feed linked to cameras, live map with camera coverage, Cameras tab (camera wall, viewer with PTZ, talk-down, snapshot, flag incident, unblur request, lend the phone's camera), active walks, demo triggers |
| Admin (laptop) | Overview with live stats and the twin, **CesiumJS digital twin** and full-screen command centre, laptop webcams with on-device AI, all alerts on the map, visitor passes, lab inventory and yearly report, audit log and transparency report, **Setup** (pairing QR and code, paired phones, data export and erase) |

## On-device intelligence

All AI runs on the phone or laptop that has the camera, with bundled models ([Human](https://github.com/vladmandic/human): CenterNet, BlazeFace, FaceRes, anti-spoof, liveness). No video, face or embedding leaves that device, and it works offline.

| What | How it works |
|---|---|
| Privacy in the pixels | Until the AI is ready the whole view is pixelated. After that, every face box **and** the head area of every person is pixelated in each frame, so a missed face does not leak. Alert snapshots come from this anonymised view. |
| No face search, by design | Campus cameras never compute a face embedding. Only a gate does, to compare **1:1** with the one student whose pass was shown. |
| Behaviour rules | An anonymous tracker (people get short numbers like `#12`) feeds explainable rules: **following, running, loitering, fall, crowding, unattended bag, perimeter line crossing, tailgating** (more people crossing the gate line than QR scans), **asset exit** and **camera tamper** (image statistics only). Each alert says why, with the measured values and the threshold. |
| Coverage to compute | Cameras near an open alert switch from WATCH (model runs only when the picture changes) to INVESTIGATE (several frames per second). |
| Real gate check | A camera assigned to `CAM-G1` reads the student's rotating QR, checks its signature and age (screenshots stop working within 20 s, each code works once), applies anti-passback, then runs the 1:1 face check if the student enrolled on that device. |
| Face enrolment | Student → Profile → **Face check at gates**. The template (numbers, no photo) stays on that phone. My ID → **Live gate check** tests it. |
| Thresholds | Match at 65% or more. From 50% to 65% the gate asks a guard to check the ID card instead of deciding. Calibrated on only 55 faces from sample photos, so **re-calibrate with consented campus data before real use**. |

Each rule can be switched off and its sensitivity changed per camera (Cameras → Rules).

## Theme

Dark tactical theme from the CAMIQ design: obsidian background, telemetry cyan for Guard and Admin, coral for emergencies, emerald for safe and amber for warnings. Fonts are Space Grotesk (headings), Plus Jakarta Sans (text) and JetBrains Mono (data), bundled so they work offline. **Students: pink for female (Priya), blue for male (Aarav).** Saathi Walk offers a **female guard** preference (on by default for female students), and guards see a pink or blue tag on every walk alert.

## Campus layout

The campus boundary and the 15 building footprints come from **OpenStreetMap** (© OpenStreetMap contributors, ODbL), via the CAMIQ project. Checkpoints, guard posts, walkways and the 15 cameras (with direction and range) are placed on that real layout; roads and camera positions are approximate. Everything lives in `src/campus.js`, in metres from the campus origin. Edit that one file and the 2D map, the 3D twin and camera coverage all update.

## Develop

```bash
npm install
```

```bash
npm start
```

`npm start` builds both editions and starts the hub: the console opens at `http://localhost:8787`, and phones on the same network use the address it prints. Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Builds the phone edition into `www/` and the laptop edition into `dist/kavach-laptop/` |
| `npm run watch` | Rebuilds on save |
| `npm run hub` | Starts the already-built hub (`PORT=8788` and `KAVACH_DATA=/path` to change port or data folder) |
| `npm run serve` | Serves the phone edition alone on `http://localhost:8080` (stand-alone, no hub) |
| `npm test` | Behaviour rules, gate pass verification, and the hub (pairing, sync, permissions, unpairing, saving) |
| `npm run android:apk` | Builds the APK (needs JDK 21 and the Android SDK); `npm run android:open` opens Android Studio |

Every push builds both editions in GitHub Actions (`.github/workflows/android.yml`) and uploads **kavach-debug-apk** and **kavach-laptop**.

The Android app allows plain `http` to the hub on the local network (`usesCleartextTraffic`, `allowMixedContent`), because the hub runs on a laptop without a certificate. Pairing tokens protect the API; keep the hub on a trusted campus network.

## Project layout

| Path | Contents |
|---|---|
| `src/phone.jsx` | Phone edition shell: start screen, Student/Guard switch, pairing |
| `src/laptop.jsx` | Laptop edition: Admin console with sidebar, Cameras, Alerts and Setup pages |
| `src/student.jsx`, `src/guard.jsx`, `src/admin.jsx` | The apps and admin panels |
| `src/actions.js` | Named actions (the only way state changes), shared by the apps and the hub |
| `src/store.js` | The action implementations and timers |
| `src/useKavach.js`, `src/sync.js`, `src/pair.jsx` | State on the device, hub sync with an outbox, pairing UI |
| `hub/server.js` | The campus hub (Node, no dependencies) |
| `laptop/` | Start scripts and README copied into the laptop package |
| `src/campus.js` | Campus model: OSM boundary and buildings, checkpoints, guard posts, cameras |
| `src/data.js` | Constants, students, routes, inventory, stats helpers |
| `src/cctv.jsx` | Camera feeds, camera wall tiles, camera viewer |
| `src/vision/` | On-device AI: models, live cameras and anonymised rendering, tracker, rules, gate face check, and their UI |
| `src/twin.js`, `src/twinview.jsx` | CesiumJS digital twin (laptop only, loaded on demand) and its React wrapper |
| `test/` | `npm test` |
| `www/` | Built phone edition (what the Android app loads) |
| `android/` | Capacitor Android project |

Built with React 18, Tailwind CSS 3, CesiumJS (`@cesium/engine`), Human (on-device AI), jsQR, Capacitor 7, esbuild and qrcode-generator. The 3D twin runs fully offline: no globe imagery, terrain or Cesium Ion token.
