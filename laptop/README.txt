KAVACH - LAPTOP EDITION (Admin console + campus hub)
=====================================================

This laptop runs the Kavach hub. It keeps the campus data, shows the Admin
console (3D digital twin, CCTV, alerts, visitors, lab stock, audit), runs the
AI for webcams plugged into this laptop, and links the guard and student
phones over Wi-Fi. Nothing goes to the internet.

1. INSTALL NODE.JS (once)
   Download the "LTS" version from https://nodejs.org and install it.
   Kavach needs Node.js 18 or newer. Nothing else to install.

2. START KAVACH
   Windows : double-click  start-windows.bat
   macOS   : double-click  start-mac.command
             (first time: right-click > Open, then Open, because it was downloaded)
   Linux   : run  ./start-linux.sh

   A window shows the hub's addresses and pairing code, and the Admin console
   opens in your browser at  http://localhost:8787
   Keep that window open while Kavach is in use. Close it (or Ctrl+C) to stop.

   Windows: when Windows Defender Firewall asks about Node.js, allow it on
   PRIVATE networks, or phones cannot connect.
   macOS: click "Allow" when asked about incoming network connections.

3. SET UP (the console opens on Setup the first time)
   - Cameras: plug in USB webcams, open Cameras and assign each one to a
     campus camera (e.g. CAM-G1 at the Main Gate). Use Chrome or Edge.
   - Phones: connect each phone to the SAME Wi-Fi as this laptop. In the
     Kavach Android app tap "Connect to the campus hub" > "Scan pairing QR"
     and scan the QR on the Setup page (or type the address and 6-digit code).
   - Click "Finish setup".

THE ADMIN CONSOLE IS ONLY ON THIS LAPTOP
   http://localhost:8787 shows the Admin console only when opened on this
   laptop. Phones that open the hub address get the phone app (Student and
   Guard). Admin-only actions (visitor passes, stock report, erasing data) are
   refused from phones.

DATA
   Saved in the "data" folder next to this file (state.json, config.json).
   Back it up by copying that folder, or use Setup > Export.
   To move Kavach to another laptop, copy this whole folder.

OPTIONS (advanced)
   PORT=8788 node hub.mjs        use another port
   KAVACH_DATA=/path node hub.mjs keep data somewhere else

TROUBLESHOOTING
   "Port 8787 is already in use": Kavach is already running (check other
   windows), or start with another port.
   Phone says "No Kavach hub at ...": check both devices are on the same
   Wi-Fi (guest Wi-Fi often isolates devices), the firewall allows Node.js,
   and the address matches the one on the Setup page.
