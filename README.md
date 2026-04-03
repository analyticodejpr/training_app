# TrainingHub — Strava + WHOOP Performance Dashboard

A personal performance dashboard that unifies Strava training data and WHOOP recovery data in one dark-themed web app.

## Features

- **OAuth 2.0** login for both Strava and WHOOP (tokens stored locally in SQLite)
- **Overview** — today's recovery gauge, HRV, resting HR, strain, SpO₂, weekly distance
- **Activities** — recent Strava activities with pace, HR, elevation
- **Sleep** — 7-night sleep stage breakdown (deep / REM / light / awake)
- **Calendar** — 10-week grid overlaying recovery scores with training activity icons
- **Trends** — 30-day HRV, recovery, strain, and sleep performance chart + weekly load bar chart
- Auto token refresh for both APIs
- SQLite response cache (reduces redundant API calls)
- Rate limiting middleware (respects Strava 200 req/15 min and WHOOP limits)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |

---

## 1. Register Developer Apps

### Strava

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an app — set **Authorization Callback Domain** to `localhost`
3. Note your **Client ID** and **Client Secret**

### WHOOP

1. Go to [developer.whoop.com](https://developer.whoop.com) and create an account/app
2. Add `http://localhost:8080/api/auth/whoop/callback` as a **Redirect URI**
3. Request scopes: `read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout offline`
4. Note your **Client ID** and **Client Secret**

---

## 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your credentials:

```env
PORT=8080
FRONTEND_URL=http://localhost:3000

STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REDIRECT_URI=http://localhost:8080/api/auth/strava/callback

WHOOP_CLIENT_ID=your_whoop_client_id
WHOOP_CLIENT_SECRET=your_whoop_client_secret
WHOOP_REDIRECT_URI=http://localhost:8080/api/auth/whoop/callback
```

---

## 3. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

---

## 4. Run

Open two terminals:

```bash
# Terminal 1 — backend (port 8080)
cd backend && npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Connect Accounts

1. Click **Connect Strava** — you'll be redirected to Strava's OAuth page
2. Click **Connect WHOOP** — you'll be redirected to WHOOP's OAuth page
3. Once both are connected the dashboard opens automatically

Tokens are persisted in `backend/data/dashboard.db` (SQLite). They auto-refresh when they expire.

---

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js       # SQLite token store + response cache
│   │   ├── middleware/
│   │   │   └── rateLimiter.js    # express-rate-limit for Strava & WHOOP
│   │   ├── routes/
│   │   │   ├── auth.js           # OAuth flows + /api/auth/status
│   │   │   ├── strava.js         # Strava proxy endpoints
│   │   │   └── whoop.js          # WHOOP proxy endpoints
│   │   ├── services/
│   │   │   ├── stravaService.js  # Strava API client + weekly summary builder
│   │   │   └── whoopService.js   # WHOOP API client + daily summary builder
│   │   └── index.js              # Express server entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ActivityCalendar.jsx  # 10-week recovery + activity grid
    │   │   ├── ActivityList.jsx      # Recent Strava activities
    │   │   ├── Header.jsx            # Sticky header with connection pills
    │   │   ├── RecoveryGauge.jsx     # SVG arc gauge for WHOOP recovery
    │   │   ├── SleepPanel.jsx        # Sleep stage bars
    │   │   ├── StatCard.jsx          # Generic KPI card
    │   │   └── TrendChart.jsx        # Recharts trend + weekly load charts
    │   ├── pages/
    │   │   ├── DashboardPage.jsx     # Main tabbed dashboard
    │   │   └── LoginPage.jsx         # Connect accounts landing page
    │   ├── utils/
    │   │   ├── api.js                # Axios wrappers for all backend endpoints
    │   │   └── format.js             # Unit conversions, colors, icons
    │   └── App.jsx
    ├── vite.config.js                # Vite + /api proxy to :8080
    └── package.json
```

---

## API Rate Limits

| Platform | Limit | How it's handled |
|----------|-------|-----------------|
| Strava | 200 req / 15 min, 2 000 / day | express-rate-limit (100 req/15 min on backend) + SQLite cache |
| WHOOP | ~60 req / min | express-rate-limit (60 req/min) + 200 ms minimum interval between calls |

---

## Security Notes

- All secrets live in `backend/.env` — never commit this file
- The frontend never sees your client secrets; all API calls are proxied through the backend
- `backend/data/` (SQLite database) is gitignored — contains your access tokens
