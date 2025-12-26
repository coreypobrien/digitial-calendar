# Wall-Mounted Calendar Display

A local-first calendar display for a Raspberry Pi touchscreen. It serves a full-screen display at `/` and a protected admin panel at `/admin`.

## Requirements
- Node.js 20+
- npm
- Google Calendar API credentials (OAuth 2.0)

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

## Configuration Storage
Configuration is stored in JSON files under `data/` (gitignored). The main config file is:
- `data/config.json`

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

## Tests
```bash
npm test
```
