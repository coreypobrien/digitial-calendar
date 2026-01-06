# Wall-Mounted Calendar Display

A local-first calendar display for a Raspberry Pi touchscreen. It serves a full-screen display at `/` and a protected admin panel at `/admin`.

## Requirements
- Node.js 20+
- npm
- Google Calendar API credentials (OAuth 2.0, optional if using iCal feeds only)
- weather.gov is used for weather (no API key, U.S. only)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` in the project root:
   ```bash
   PORT=3000
   SESSION_SECRET=replace-me
   ```
3. Start the server and clients (in separate terminals):
   ```bash
   npm run dev:server
   npm run dev:display
   npm run dev:admin
   ```

## Docker (Dev Server)
Build and run the server in a container (compatible with Raspberry Pi/armv7):
```bash
docker build -t wall-calendar .
docker run --rm -p 3000:3000 --env-file .env wall-calendar
```
The container defaults to `npm run dev:server` and exposes port 3000.

To live-reload from local files, mount the repo and mask `node_modules` so the
container keeps its installed dependencies:
```bash
docker run --rm -p 3000:3000 \
  --env-file .env \
  -v "$(pwd):/app" \
  -v /app/node_modules \
  -v /app/server/node_modules \
  -v /app/client-display/node_modules \
  -v /app/client-admin/node_modules \
  wall-calendar
```

## First-Time Admin Setup
Call the setup endpoint once to create your admin user:
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change-me"}'
```

## Build for Production
```bash
npm run build
npm --workspace server run start
```

The server will serve the compiled display and admin apps from `/client-display/dist` and `/client-admin/dist`.

## Google Calendar OAuth
1. Create OAuth credentials in Google Cloud Console:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/google/callback`
     - `http://<pi-ip>:3000/api/google/callback`
2. Add to `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
   ADMIN_APP_URL=http://localhost:5174
   ```
3. Generate an auth URL and complete consent:
   ```bash
   curl http://localhost:3000/api/google/auth-url
   ```
   Open the returned URL in a browser, approve access, then the callback stores tokens.
4. Trigger a sync once connected:
   ```bash
   curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"change-me"}'

   curl -b cookies.txt -X POST http://localhost:3000/api/google/sync
   ```

Notes:
- The admin panel lists individual calendars so you can enable/disable sources.
- Month navigation can extend the sync window as you browse future months.

## iCal Feeds (Optional)
Add iCal feeds in the Admin panel under Calendars → iCal Feeds. The label field
overrides the calendar name shown in the UI; if left blank, the feed metadata or URL
hostname is used.

## Configuration Storage
Configuration is stored in JSON files under `data/` (gitignored). The main config file is:
- `data/config.json`

Key settings (editable in the admin panel):
- Display: default view (Month/Week/Upcoming), time format, theme colors, reset timer (minutes)
- Calendars: enable/disable individual Google calendars
- Refresh: calendar/weather refresh intervals
- Google: sync window (days)
- Weather: units + location (coords via browser geolocation)

Other data files:
- `data/event_cache.json` (synced events + range window)
- `data/weather_cache.json` (cached weather payload)

## Display Behavior
- Month navigation uses the arrow buttons next to the month label.
- Week navigation uses the arrow buttons next to the date range.
- The display auto-resets to the current day/week/month after the reset timer (minutes).
- Upcoming shows events for the next 30 days and scrolls when long.
- Weekly view shows expanded event cards within each day column.
- Weather includes a 7-day forecast strip (simple badges).

## Time Sync
The display keeps time locally and requests `/api/time` every 24 hours to correct drift.
Ensure the Raspberry Pi clock is synced with NTP for best accuracy.

## Weather Provider Notes
- **weather.gov**: No API key required, U.S. only. Requires a `User-Agent` header with contact info.

Optional for weather.gov in `.env`:
```bash
WEATHER_GOV_USER_AGENT="wall-calendar (you@example.com)"
```

## Raspberry Pi Setup (Systemd + Kiosk)
1. Create a systemd service to run the server:
   ```ini
   # /etc/systemd/system/wall-calendar.service
   [Unit]
   Description=Wall Calendar Server
   After=network.target

   [Service]
   WorkingDirectory=/home/pi/wall-calendar
   ExecStart=/usr/bin/npm --workspace server run start
   Restart=always
   Environment=NODE_ENV=production
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```
2. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable wall-calendar
   sudo systemctl start wall-calendar
   ```
3. Kiosk mode (Chromium) example:
   ```bash
   chromium-browser --kiosk http://localhost:3000
   ```

## Kiosk Mode Autostart (Recommended for Pi)
1. Install Chromium (if needed):
   ```bash
   sudo apt update
   sudo apt install -y chromium-browser
   ```
2. Create an autostart entry:
   ```bash
   mkdir -p ~/.config/autostart
   ```
   Create `~/.config/autostart/wall-calendar.desktop`:
   ```ini
   [Desktop Entry]
   Type=Application
   Name=Wall Calendar Kiosk
   Exec=chromium-browser --kiosk --incognito --disable-translate --noerrdialogs --disable-infobars --disable-session-crashed-bubble http://localhost:3000
   ```
3. (Optional) Hide the mouse cursor:
   ```bash
   sudo apt install -y unclutter
   ```
   Add another autostart entry or run:
   ```bash
   unclutter -idle 0.5 -root
   ```

## Tests
```bash
npm test
```

To run client tests:
```bash
npm --workspace client-display test
```
