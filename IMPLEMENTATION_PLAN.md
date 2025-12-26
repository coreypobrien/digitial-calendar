# Wall-Mounted Calendar Display - Implementation Plan

## Goals
- Node.js local server with two routes: display (`/`) and admin (`/admin`).
- React front-end for both display and admin.
- Google Calendar integration (multiple calendars) with read-only access.
- Weather integration via OpenWeather API.
- Calendar-first UI with monthly, daily, and activity views.
- Local configuration and data stored as flat JSON files.
- Unit tests for critical components.

## Key Decisions
- Weather API: OpenWeather (API key required).
- Storage: Flat JSON files on disk (no database).
- Default view: calendar-first (monthly).

## Architecture Overview
- **Backend**: Node.js + Express.
  - Serves static React builds for `/` and `/admin`.
  - Provides REST API under `/api/*`.
  - Background jobs for calendar sync and weather refresh.
- **Frontend**: React + modern UI framework suitable for touchscreens (e.g., MUI).
  - Display app: full-screen kiosk UI.
  - Admin app: configuration panel and data management.

## Project Structure (Proposed)
- `server/`
  - `index.js` (Express app)
  - `routes/` (auth, config, events, notes, weather)
  - `services/` (google calendar, weather, storage)
  - `jobs/` (scheduled refresh)
  - `storage/` (read/write JSON helpers)
  - `config/` (schema validation)
- `client-display/` (React app for `/`)
- `client-admin/` (React app for `/admin`)
- `data/` (JSON files, gitignored)
- `docs/` (supporting docs, OAuth setup)

## Data Storage (Flat JSON)
- `data/config.json`
  - Admin user hash and settings (display, refresh intervals, theme).
- `data/calendar_sources.json`
  - Enabled calendars, colors, labels.
- `data/notes.json`
  - Custom notes/reminders.
- `data/event_cache.json`
  - Cached normalized events.
- `data/weather_cache.json`
  - Cached weather responses.

**Storage approach**
- Atomic writes (write temp + rename) to avoid corruption.
- Schema validation with Zod on read/write.
- Backup rotation (keep N prior copies).

## Backend API (Proposed)
- Auth:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Settings:
  - `GET /api/settings`
  - `PUT /api/settings`
- Calendars:
  - `GET /api/calendars`
  - `PUT /api/calendars`
- Events:
  - `GET /api/events?range=month|day|activity`
- Notes:
  - `GET /api/notes`
  - `POST /api/notes`
  - `PUT /api/notes/:id`
  - `DELETE /api/notes/:id`
- Weather:
  - `GET /api/weather`

## Google Calendar Integration
- OAuth 2.0 installed-app flow for a local device.
- Scopes: `calendar.readonly`.
- Periodic sync using `events.list` for each enabled calendar.
- Normalize event data across calendars.
- Cache results and only refresh at configured intervals.

**Policy/Quota Notes**
- Google Calendar API uses quota units per request (some endpoints are higher cost).
- Use read-only scopes and minimize polling by caching and scheduling refresh jobs.

## Weather Integration (OpenWeather)
- Store `OPENWEATHER_API_KEY` in `.env`.
- Use location settings (lat/lon or city) from admin config.
- Cache responses with TTL to reduce requests.

**Usage Notes**
- Requests must include `appid` (API key).
- Follow OpenWeather plan limits by caching and limiting refresh rate.

## Admin Panel Features
- Login with local username/password (no recovery flow).
- Configure:
  - Google Calendar sources (IDs, names, colors).
  - Refresh intervals (calendar and weather).
  - Theme colors, fonts, layout options.
  - Default view and view behavior.
  - Weather location.
- Manage custom notes/reminders.

## Display App Features
- Full-screen kiosk layout optimized for 1920x1080.
- Prominent date and time.
- Monthly view (default), daily view, activity view.
- Weather summary panel.
- Notes/reminders panel.
- Theme customization applied from config.

## Error Handling & Logging
- Centralized error handler with safe user-facing messages.
- Structured logging with levels (info/warn/error).
- Log files stored locally with simple rotation.

## Testing
- Unit tests for:
  - Event normalization and filtering.
  - Storage read/write and schema validation.
  - Auth and session handling.
  - Weather caching and retries.

## Deployment / Raspberry Pi
- `npm run build` for both React apps.
- Express serves static assets.
- Systemd service for Node server.
- Chromium kiosk auto-start for the display route.

## Milestones
1. Project scaffolding (server + two React apps).
2. JSON storage layer with schemas and safe write.
3. Admin auth + settings CRUD.
4. Google Calendar OAuth + sync + event cache.
5. OpenWeather integration + cache.
6. Display UI (monthly/day/activity).
7. Admin UI (settings, calendars, notes).
8. Tests + docs + RPi setup guide.

## Step-by-Step Delivery (Each Step Fully Testable)
Each step should end with a runnable app and a focused test/verification checklist so regressions are caught immediately.

1. **Scaffold + Smoke Test**
   - Deliverables: Express server, display/admin React apps, basic routing.
   - Verification: `GET /` and `GET /admin` render basic pages; `npm test` runs a placeholder test.
2. **JSON Storage Layer**
   - Deliverables: read/write helpers, schema validation, atomic writes.
   - Verification: unit tests cover read/write, invalid schema handling, and atomic write behavior.
3. **Admin Auth + Config CRUD**
   - Deliverables: login flow, session handling, config endpoints.
   - Verification: unit tests for auth, manual check of login and settings update from admin UI.
4. **Calendar Sync (Google API)**
   - Deliverables: OAuth flow, sync job, normalized event cache.
   - Verification: mocked API tests for normalization; manual smoke test pulls events.
5. **Weather Integration**
   - Deliverables: OpenWeather fetch, cache + TTL.
   - Verification: unit tests for caching, manual check for weather display.
6. **Display Views**
   - Deliverables: monthly/day/activity views wired to API.
   - Verification: UI renders with sample data; snapshot or component tests for key views.
7. **Admin Features**
   - Deliverables: calendar selection, theme edits, notes CRUD.
   - Verification: end-to-end checks for each admin setting impacting display.
8. **Hardening + Docs**
   - Deliverables: logging, error handling, README, RPi setup.
   - Verification: run all tests, dry-run setup steps on a fresh Pi or clean environment.

## MagicMirror Reference Patterns
MagicMirror² provides a proven large-scale modular layout and configuration approach. We can borrow these patterns:
- **Module config shape**: A top-level `modules` array where each entry has `module`, `position`, and `config`. We can mirror this with our JSON schema to keep settings modular and extensible.
- **Provider-style weather config**: MagicMirror lets a weather module select a provider (`openweathermap`, etc.) with shared base fields (location, lat/lon, apiKey) and provider-specific options. We'll adopt a similar pattern and normalize the output for UI use.
- **Calendar sources array**: Their calendar module config uses a list of calendar entries with display options. We'll apply this structure to Google Calendar IDs, labels, colors, and enabled flags.
- **Notification flow**: Their module notifications and node helpers show a clean separation between UI modules and data fetch. We'll mirror this separation with background jobs and a cache layer that the UI reads from.
