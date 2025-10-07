# PFConnect Logbook System - Context Document

## Overview
The PFConnect Logbook is a flight tracking system that automatically logs flights from the Project Flight Roblox game. It tracks real-time telemetry, calculates landing rates, and provides detailed flight statistics.

## System Architecture

### Flight Tracking Flow
1. User links their Roblox account in Settings (`/settings`)
2. User submits a flight plan with "Log with PFConnect Logbook" checkbox enabled
3. System creates a flight entry in `logbook_flights` table with status `pending`
4. System creates an active tracking entry in `logbook_active_flights` table
5. Flight Tracker WebSocket connects to Project Flight API and monitors the user's Roblox username
6. When telemetry is received, flight status changes from `pending` to `active`
7. Telemetry is stored every 5 seconds in `logbook_telemetry` table
8. When landing is detected, flight completes and stats are calculated
9. User stats cache is updated in `logbook_stats_cache` table

### Flight Not Found Detection
**Location:** `server/services/flightTracker.js`

**How it works:**
- Monitoring interval: Every **15 seconds** (`startFlightMonitoring()` at line 792)
- Timeout: **30 seconds** without telemetry (`flightNotFoundTimeout = 30000` at line 80)
- Tracks both `pending` and `active` flights
- Uses `lastTelemetryTime` Map to track when each user's flight last received data
- If no telemetry received for 30+ seconds, the flight is deleted and user receives notification

**Key Functions:**
- `startFlightMonitoring()` - Starts the 15-second interval check
- `checkForMissingFlights()` - Checks all tracked flights for timeout
- `processPlane()` - Updates `lastTelemetryTime` when telemetry received

**Important:** The tracker matches by **Roblox username**, not callsign. This allows users to file with ICAO callsigns like "AAL123" while still being tracked by their Roblox account.

## Database Schema

### Tables
1. **logbook_flights** - Main flight records
   - Stores: callsign, departure, arrival, aircraft, status, duration, distance, landing rate, etc.
   - Status values: `pending`, `active`, `completed`, `cancelled`, `aborted`

2. **logbook_active_flights** - Active flight tracking state
   - Stores: roblox_username, flight_id, current position, phase, landing detection
   - Used for real-time tracking

3. **logbook_telemetry** - Telemetry points (sampled every 5 seconds)
   - Stores: x, y, altitude, speed, heading, phase, vertical_speed, timestamp

4. **logbook_stats_cache** - User statistics cache
   - Stores: total_flights, total_time, distance, favorite_aircraft, best_landing, etc.
   - Updated after each completed flight

5. **user_notifications** - Per-user notifications
   - Stores: user_id, type, title, message, read status, created_at
   - Types: `info`, `warning`, `success`, `error`

## Key Files and Locations

### Backend

**Flight Tracker:**
- `server/services/flightTracker.js` - Main flight tracking service
  - WebSocket connection to Project Flight API
  - Telemetry processing and storage
  - Flight phase detection (hybrid: controller status + telemetry)
  - Landing detection
  - Flight not found monitoring (line 792-837)

**Database Functions:**
- `server/db/logbook.js` - All logbook database operations
  - `getUserFlights()` - Get user's flight history with pagination
  - `getFlightById()` - Get single flight details
  - `getActiveFlightData()` - Get real-time flight data
  - `getUserStats()` - Get user statistics from cache
  - `createFlight()` - Create new flight entry
  - `startActiveFlightTracking()` - Start tracking a flight
  - `deleteFlightById()` - Delete a flight (users can only delete pending, admins can delete any)

**User Notifications:**
- `server/db/userNotifications.js` - User notification system
  - `getUserNotifications(userId, unreadOnly)` - Fetch notifications
  - `markNotificationAsRead(notificationId, userId)` - Mark as read
  - `markAllNotificationsAsRead(userId)` - Mark all as read
  - `deleteNotification(notificationId, userId)` - Delete notification

**API Routes:**
- `server/routes/logbook.js` - Logbook API endpoints
  - `GET /api/logbook/flights` - Get flights with pagination and filters
  - `GET /api/logbook/flights/:id` - Get single flight with real-time data
  - `GET /api/logbook/flights/:id/telemetry` - Get flight telemetry for graphs
  - `GET /api/logbook/stats` - Get user statistics
  - `POST /api/logbook/stats/refresh` - Refresh stats cache
  - `POST /api/logbook/flights/start` - Start tracking a flight
  - `DELETE /api/logbook/flights/:id` - Delete a flight
  - `GET /api/logbook/notifications` - Get user notifications
  - `POST /api/logbook/notifications/:id/read` - Mark notification as read
  - `POST /api/logbook/notifications/read-all` - Mark all as read
  - `DELETE /api/logbook/notifications/:id` - Delete notification

**Roblox OAuth:**
- `server/routes/auth.js` - Roblox account linking
  - `GET /api/auth/roblox` - Initiate Roblox OAuth flow
  - `GET /api/auth/roblox/callback` - OAuth callback handler
  - `POST /api/auth/roblox/unlink` - Unlink Roblox account

**Flight Status Handler:**
- `server/services/logbookStatusHandler.js` - Handles controller status changes
  - `handleFlightStatusChange(callsign, status, controllerAirport)` - Updates flight status from controller interface
  - Determines origin vs destination for TAXI/RWY based on controller airport

**WebSocket Integration:**
- `server/websockets/flightsWebsocket.js` - Flight strip updates
  - Imports `handleFlightStatusChange` from logbookStatusHandler
  - Updates `controller_status` field in logbook_flights when controller changes flight status

### Frontend

**Pages:**
- `src/pages/Logbook.tsx` - Main logbook page
  - Displays user stats cards
  - Shows live flights (pending/active) with real-time updates
  - Shows flight history (completed flights)
  - Displays user notifications at top of page (line 540-602)
  - Auto-refreshes live flights every 5 seconds
  - Admin debug panel for troubleshooting

- `src/pages/FlightDetail.tsx` - Individual flight details
  - Shows real-time telemetry for active flights
  - Displays flight phases, altitude, speed, landing rate
  - Telemetry graphs

- `src/pages/Submit.tsx` - Flight plan submission
  - Custom checkbox for "Log with PFConnect Logbook" (line ~200-250)
  - Disabled if test gate is on and user is not tester/admin
  - Disabled if user hasn't linked Roblox account
  - Shows warning messages for restrictions
  - On submit, calls `/api/logbook/flights/start` if checkbox checked
  - Shows post-submission notification with "View Live Flight" button

**Components:**
- `src/components/Settings/AccountSettings.tsx` - Roblox account linking UI
  - Link/unlink buttons
  - Connection status display
  - Roblox icon from react-icons (`SiRoblox`)

**Types:**
- `src/types/user.ts` - User interface includes:
  - `robloxUserId?: string | null`
  - `robloxUsername?: string | null`

**Navigation:**
- `src/components/buttons/UserButton.tsx` - User dropdown menu
  - "Logbook" menu item with BookOpen icon
  - Links to `/logbook`

- `src/App.tsx` - Routes
  - `/logbook` - Main logbook page
  - `/logbook/:flightId` - Flight detail page

## Flight Phase Detection

**Hybrid System:** Combines controller status + telemetry for accurate phase detection

**Controller-Only Phases:**
- PUSH/STUP - Controller sets push & start
- ORIGIN_TAXI/DESTINATION_TAXI - Controller determines based on their airport
- ORIGIN_RUNWAY/DESTINATION_RUNWAY - Controller determines based on their airport
- GATE - Controller sets when aircraft at gate

**Telemetry-Based Phases:**
- CLIMB - Vertical speed > 300 fpm
- CRUISE - Vertical speed between -300 and +300 fpm, altitude > 1000ft
- DESCENT - Vertical speed < -300 fpm, altitude > 3000ft
- APPROACH - Altitude < 3000ft and descending
- LANDING - Altitude < 100ft and descending

**Hybrid Logic:**
- Controller status takes priority when available
- Falls back to telemetry when no controller (e.g., in cruise)
- Controller status is cleared when aircraft reaches cruise (prevents stale "DEPA" status)

## Important Technical Decisions

### 1. Roblox Username vs Callsign
- **Decision:** Track flights by Roblox username, NOT callsign
- **Reason:** Users can file with ICAO callsigns (e.g., "AAL123") which don't match their Roblox username
- **Implementation:** `processPlane()` matches by `plane.roblox_username` field from Project Flight API

### 2. Test Gate
- **Decision:** Test gate is a global setting, not per-session
- **Implementation:** Fetched from `/api/data/settings` endpoint
- **Bypass:** Testers AND admins can use logbook during test gate

### 3. Flight Status Flow
- **pending** → User submitted but hasn't spawned/moved yet
- **active** → Aircraft is moving or airborne (triggered by movement or altitude)
- **completed** → Landed and stationary for 2 minutes
- **cancelled** → Pending flight never departed (30 min timeout)
- **aborted** → Active flight lost tracking after landing (10 min timeout)

### 4. Telemetry Sampling
- **Rate:** Every 5 seconds (not every message)
- **Reason:** Reduces database load while maintaining accuracy
- **Implementation:** `lastTelemetryTime` Map tracks when to store next point

### 5. User Notifications
- **Separate from global notifications:** User notifications are per-user, not broadcast
- **Auto-fetch:** Logbook page fetches unread notifications on load
- **Dismissible:** Users can dismiss with X button (marks as read)
- **Types:** info, warning, success, error (color-coded in UI)

## Common Issues and Solutions

### Flight Not Deleting After 30 Seconds
**Check:**
1. Is flight monitoring started? Look for `🔍 [Flight Tracker] Flight monitoring started` in logs
2. Is WebSocket connected? Look for `[Flight Tracker] WebSocket connected to PFATC server` in logs
3. Is flight being checked? Look for `🔍 [Flight Tracker] Checking X tracked flight(s)` every 15 seconds
4. Is timer starting? Look for `⏱️ [Flight Tracker] Starting timer for...` when flight created

**Common causes:**
- WebSocket connection failed (403 Forbidden, IP blocked, proxy issues)
- Flight monitoring not initialized (check `constructor()` calls `startFlightMonitoring()`)
- Flight status is not 'pending' or 'active' (monitoring only checks these statuses)

### Controller Status Updates Not Working
**Check:**
1. Is `handleFlightStatusChange` imported in `flightsWebsocket.js`?
2. Are status changes being logged? Look for `[FlightWS] Detected status change:` in logs
3. Is flight callsign correct in database?

### Telemetry Not Storing
**Check:**
1. Is flight in `logbook_active_flights` table?
2. Is Roblox username correct?
3. Is user actually in Project Flight game on PFATC server?
4. Check `lastTelemetryTime` - might be rate-limited to 5 seconds

## Environment Variables

Required for logbook to work:
- `ROBLOX_CLIENT_ID` - Roblox OAuth app client ID
- `ROBLOX_CLIENT_SECRET` - Roblox OAuth app client secret
- `ROBLOX_REDIRECT_URI` - OAuth callback URL (e.g., `http://localhost:9901/api/auth/roblox/callback`)

Optional:
- `PROXY_URL` - Comma-separated list of proxy URLs for Project Flight API
- `PROXY_URL_1`, `PROXY_URL_2`, etc. - Individual proxy URLs

## Landing Rate Calculation

**System:** Uses separate WebSocket connection per user to collect high-frequency waypoint data

**Flow:**
1. Landing detected (altitude at ground level, speed < 100kts, was previously airborne)
2. `startLandingDataCollection(robloxUsername, proxyUrl)` called
3. Connects to user-specific WebSocket: `wss://v3api.project-flight.com/v3/traffic/player/ws/{username}`
4. Collects waypoints for ~60 seconds after landing
5. `stopLandingDataCollection(robloxUsername)` called
6. Selects waypoints closest to landing time
7. Calculates vertical speed from altitude change between waypoints
8. Landing rate stored as FPM (feet per minute)

**Landing Score:**
- < 100 fpm = 100 (Butter)
- 100-300 fpm = Good
- 300-600 fpm = Acceptable
- 600-1000 fpm = Hard
- > 1000 fpm = Very hard

## Admin Debug Tools

**Location:** Bottom of Logbook page (only visible to admins)

**Available Tools:**
- View Raw Stats - Shows raw `logbook_stats_cache` data
- View All Flights - Shows all flights with full database data
- Active Tracking - Shows all `logbook_active_flights` entries
- Database Info - Shows table sizes and row counts
- Reset Stats Cache - Deletes and recalculates user stats
- Export Data - Downloads all user's logbook data as JSON

## Future Improvements to Consider

1. **Real-time notifications:** Use WebSocket to push notifications instead of polling
2. **Flight replay:** Animate flight path on map using stored telemetry
3. **Multiplayer features:** Compare stats with other pilots, leaderboards
4. **Advanced analytics:** Flight efficiency scores, fuel consumption estimates
5. **Export formats:** PDF logbook, CSV export for external analysis
6. **Mobile app:** Native mobile app for viewing logbook on-the-go
