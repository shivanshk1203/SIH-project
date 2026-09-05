# Agni Netra — Industrial Fire & Thermal Anomaly Detection

A satellite-thermal intelligence platform for India. It pulls active thermal
hotspots (NASA FIRMS), cross-references them against real-world land use
(OpenStreetMap), runs an explainable multi-signal risk engine on top, and
presents everything in a "mission control" style operational dashboard.

This is a **hackathon prototype**, not a production system. The
classification and risk-scoring logic is a set of transparent, tunable rules
— not a trained ML model — so every decision can be explained and audited.

---

## 1. What it does

1. Fetches active thermal hotspots (from NASA FIRMS, or bundled demo data if
   no API key is set).
2. Fetches nearby land-use context from **OpenStreetMap's Overpass API**,
   categorized as industrial, farm, mine/quarry, power plant, landfill,
   oil/gas, forest, or residential.
3. Runs a **0–100 explainable risk engine** (`backend/thermal_analysis.py` +
   `backend/thermal_behavior.py`) that separates thermal intensity,
   classification confidence, and risk into independent, explainable scores
   — see `walkthrough.md` for the full model.
4. Classifies each hotspot (industrial fire, agricultural burning,
   mining/landfill fire, wildfire, normal source, gas flare, or unknown) with
   a plain-English list of supporting evidence.
5. Surfaces all of this through a multi-page operational dashboard: live
   Dashboard, Thermal Map, AI Classification, Incident Investigation,
   Monitoring & Alerts, and Reports & Analytics.

---

## 2. Project structure

```text
SIH-project-master/
│
├── frontend/                       # React + Vite operational dashboard
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx                     # Fetches hotspot data, owns app state, routes pages
│   │   ├── main.tsx                    # React entry point
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx           # Catches render errors per-section
│   │   │   ├── TriageCard.tsx              # Risk/priority/confidence badge cluster
│   │   │   ├── common/                     # Shared chart widgets, status badges
│   │   │   ├── layout/                     # SidebarNav, AppHeader
│   │   │   └── map/                        # Live Leaflet map components:
│   │   │       ├── ThermalHotspotMap.tsx       # Main clustered hotspot map (Thermal Map page)
│   │   │       ├── AnalystContextMap.tsx       # Context map (AI Classification page)
│   │   │       ├── AnalystSatelliteTile.tsx    # Satellite tile viewer
│   │   │       └── IncidentMapView.tsx         # Single-incident map (Incident page)
│   │   ├── pages/                      # One file per sidebar tab (Dashboard, Map, etc.)
│   │   ├── data/mockData.ts            # Fallback/demo data shown before live data loads
│   │   ├── types/thermal.ts            # Shared TypeScript types for the dashboard
│   │   └── styles/                     # mission-control.css (dashboard) + style.css (shared widget classes)
│   └── package.json
│
├── backend/                         # FastAPI service — all data fetching + analysis
│   ├── server.py                        # API entry point: /api/hotspots, /api/facilities
│   ├── firms_api.py                     # NASA FIRMS client (falls back to demo data)
│   ├── osm_api.py                       # OpenStreetMap Overpass client + spatial cache
│   ├── detection.py                     # Distance math + baseline classification rules
│   ├── thermal_analysis.py              # Evidence pipeline orchestration
│   ├── thermal_behavior.py              # Multi-window persistence & abnormality engine
│   ├── india_boundary.py, india_places.py, india_industrial_zones.py
│   │                                     # India-specific geo reference data
│   ├── sample_hotspots.json             # Demo data, used if no FIRMS key is set
│   ├── requirements.txt                 # Runtime dependencies
│   ├── requirements-dev.txt             # + httpx, needed only to run the test suites
│   └── test_*.py                        # Automated test suites (see walkthrough.md)
│
├── .env.example                     # Backend config template (API key + optional CORS)
├── walkthrough.md                   # Deep dive into the risk/behavior model
└── README.md
```

**Where things live:**
- Frontend UI → `frontend/`
- Backend logic → `backend/`
- External API calls → `backend/firms_api.py` (NASA FIRMS) and `backend/osm_api.py` (OpenStreetMap)
- Classification & risk logic → `backend/detection.py`, `backend/thermal_analysis.py`, `backend/thermal_behavior.py`
- Map code → `frontend/src/components/map/`
- Config/API keys → `backend/.env` (you create this, based on `.env.example`)

---

## 3. Install the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

To also run the automated test suites, install the extra test-only dependency:

```bash
pip install -r requirements-dev.txt
```

## 4. Install the frontend

```bash
cd frontend
npm install
```

---

## 5. Configure your API key (optional)

1. Copy the example env file into the `backend/` folder and rename it:

   ```bash
   cp .env.example backend/.env
   ```

2. Open `backend/.env` and add your real NASA FIRMS key:

   ```text
   FIRMS_MAP_KEY=your_real_key_here
   ```

   Get a free key here: https://firms.modaps.eosdis.nasa.gov/api/map_key/

   **If you skip this step, the app still works** — it automatically falls
   back to the demo dataset in `backend/sample_hotspots.json` and clearly
   labels it "Demo Data" in the dashboard.

   The frontend never sees this key — only the backend uses it.

3. Only needed if you deploy the frontend and backend on **different
   domains**: set `CORS_ALLOWED_ORIGINS` in `backend/.env` to your frontend's
   URL (comma-separated for multiple). Local development with the Vite dev
   proxy doesn't need this.

4. Only needed if you deploy the frontend and backend **separately**: copy
   `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL` to
   your backend's URL. During local development the Vite dev server proxies
   `/api/*` straight to `http://127.0.0.1:8000`, so this isn't required.

---

## 6. Run the project

**Start the backend** (in one terminal):

```bash
cd backend
uvicorn server:app --reload
```

This runs on `http://localhost:8000`.

**Start the frontend** (in another terminal):

```bash
cd frontend
npm run dev
```

This runs on `http://localhost:5173`. Open that URL in your browser.

---

## 7. How the detection & risk engine works

For each hotspot, the backend:

1. **Looks up nearby land use via OpenStreetMap's Overpass API**
   (`osm_api.py` → `get_nearby_facilities`), tagging every feature with a
   category: `industrial`, `farm`, `mine`, `power_plant`, `landfill`,
   `oil_gas`, `forest`, or `residential`.
2. **Calculates distance** to the nearest of those features
   (`detection.py` → `calculate_distance`, Haversine formula).
3. **Builds a historical behavior profile** across 24h/3d/7d/14d/30d/90d
   windows (`thermal_behavior.py`) to measure persistence and deviation from
   the hotspot's own baseline — not a single global threshold.
4. **Computes a 0–100 explainable risk score** from independent components:
   thermal intensity, abnormality vs. baseline, escalation trend, spatial
   expansion, exposure/proximity, source hazard, and detection confidence —
   see `walkthrough.md` for the full breakdown and worked examples.
5. **Classifies the hotspot** (industrial fire, agricultural burning,
   mining/landfill fire, wildfire, normal source, gas flare, or unknown) and
   explains itself with a short list of plain-English reasons.

The exact distance/brightness thresholds are prototype values, defined at the
top of `detection.py`, and can be tuned easily. The list of recognized OSM
tags per category lives in `osm_api.py` → `CATEGORY_TAGS`.

### API endpoints

- `GET /api/hotspots` — full pipeline: hotspots (classified, risk-scored) +
  a deduplicated `facilities` list for the map's land-use layer. Accepts
  optional `west`, `south`, `east`, `north` viewport bounds and `days` (1–5).
- `GET /api/facilities?lat=&lon=&radius=` — standalone OSM lookup: "what's
  near this point?", independent of any hotspot.
- `POST/GET /api/hotspots/analyze-all` — triggers a full-India batch analysis.
- `GET /` — health check.

---

## 8. The dashboard

The sidebar has seven sections, all driven by the same live (or demo)
hotspot dataset fetched once in `App.tsx`:

- **Dashboard** — headline stats, recent high-severity events, quick nav.
- **Thermal Map** — clustered map of every classified hotspot with filters.
- **AI Classification** — per-hotspot classification breakdown + context map.
- **Incidents** — detailed investigation view for a single event.
- **Monitoring & Alerts** — derived alerts for CRITICAL/HIGH severity events.
- **Reports & Analytics** — aggregate charts and exportable summaries.
- **Settings** — app-level configuration.

---

## 9. Automated tests

```bash
cd backend
pip install -r requirements-dev.txt   # only needed once, for httpx
python test_risk_engine_suite.py
python test_industrial_evidence_suite.py
python test_thermal_analysis.py
python test_india_suite.py
```

See `walkthrough.md` for sample output and what each suite verifies.

---

## 10. Notes on demo data

If NASA FIRMS is unreachable or no API key is configured, the app uses
`backend/sample_hotspots.json` — a small, realistic-looking dataset — so you
can demo the full pipeline without needing real credentials. Whenever demo
data is used, the UI shows a clear **"Demo Data"** badge so it's never
mistaken for a live feed.
