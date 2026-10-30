# Kavach: smart campus safety prototype

**Identify at the doors, anonymous in between.**

Kavach is a clickable prototype of a campus safety and asset protection app for Indian colleges. Students are verified at checkpoints with a rotating QR code. Between checkpoints, cameras only watch for dangerous behaviour, never names. At night, students can ask for an escort called **Saathi Walk**.

The whole app runs in the browser. There is no backend. All sensors, cameras and scans are simulated with buttons and timers, and all data is mock data.

## Run it

Open `index.html` in any modern browser (double-click it). That's it.

- The file is fully self-contained: React, styles and the QR library are all inlined, so **it works offline**. You don't need venue wifi.
- On a laptop it shows a phone frame with a 5-minute demo guide. On a wide screen (1200 px or more), **Side by side** shows the Student, Guard and Admin apps together so you can watch changes flow between them live.
- On a phone it runs full screen. Use the role switcher at the top.
- **Reset demo** restores all mock data.

## Demo script (about 5 minutes)

1. **Student → My ID.** Unlock with fingerprint. The QR changes every 10 seconds. Tap *Simulate gate scan* (logs IN), then *Scan IN again* to show anti-passback, then *Try screenshot QR* to show an expired code being rejected.
2. **Student → Saathi Walk.** *Help me get home* → Girls Hostel D → *Start walk*. Tap *Pass next checkpoint*, then *Go missing*. After the countdown, the *Are you OK?* screen appears. Let the 30 s timer run out (or tap *skip timer*).
3. **Guard.** The *Missed checkpoint C. Last seen at B* alert has the last photo. Tap *Accept and navigate*, *Turn on area lights* and *Play speaker warning*. Back in the Student app, the walk shows that the guard is on the way.
4. **Guard → Demo.** Trigger *Wall crossing* or *Oscilloscope leaving lab* (this raises alerts at both the lab door and the Main Gate). Tap *Skip 2 minutes* to watch unaccepted alerts escalate to the Security Head.
5. **Admin.** Look at the live stats, create a visitor pass (it gets a rotating QR), tap *Visitor seen near Hostel D*, generate the yearly stock report, and open the audit log and monthly transparency summary.

## What's inside

| Role | Features |
|---|---|
| Student | Home, My ID (fingerprint unlock, rotating QR with countdown, gate scan with 1:1 face match + liveness, anti-passback, expired-screenshot rejection, pass history), Saathi Walk (route stepper, checkpoint photos, pass / go missing / follower simulation, "Are you OK?" with 30 s timer, always-on SOS, share link, photos deleted on arrival), Lab (shelf QR, quantity steppers with weight sensor, issued items, tray-check returns with a "1 LED missing" case, instrument usage with Dispute), Profile and My data (what is stored, how long, privacy promise, who viewed my data) |
| Guard | Live campus map with pulsing alert dots, guards and the walk route; alert feed with 10 s clip player and last-seen photo; Accept and navigate, area lights, speaker warning, Resolve; auto-escalation after 2 minutes; active Saathi Walks; demo triggers |
| Admin | Live stats, visitor passes with rotating QR, lab inventory with low-stock warnings, yearly stock verification report, alert heatmap, audit log and monthly transparency summary, cross-module RFID rule demo |

All three apps read and write one shared in-memory state, so an action in one app shows up live in the others. Toasts from other roles show as tappable notifications.

## Editing the prototype

The source is in `src/`. `index.html` is generated from it.

```bash
npm install
```

```bash
npm run build
```

`npm run watch` rebuilds on every save.

| File | Contents |
|---|---|
| `src/data.js` | Mock data (student, checkpoints, guards, routes, inventory, alerts, audit log) and helpers |
| `src/store.js` | Shared state actions and timers (escalation, walk check-ins, live drift) |
| `src/ui.jsx` | Shared UI: icons, buttons, sheets, QR code, scan animation, toasts |
| `src/map.jsx` | Illustrated campus map used by Guard and Admin |
| `src/student.jsx`, `src/guard.jsx`, `src/admin.jsx` | The three apps |
| `src/main.jsx` | App shell: start screen, role switcher, phone frame, side-by-side view |

Built with React 18, Tailwind CSS 3, esbuild and qrcode-generator.
