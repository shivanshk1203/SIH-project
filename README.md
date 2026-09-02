# Industrial Fire & Thermal Anomaly Detection (Prototype)

A simple prototype that looks at satellite thermal hotspot data, checks whether
each hotspot is near an industrial facility, and gives an explainable guess at
what it is: an industrial fire, a wildfire, a normal heat source, or unknown.

This is a **prototype**, not a production system. The classification logic is
a small set of clear, readable rules — not a trained AI model — so you can see
exactly why each decision was made.

---

## 1. What it does

1. Fetches active thermal hotspots (from NASA FIRMS, or demo data if no API key is set)
2. Fetches nearby land-use context from **OpenStreetMap's Overpass API** — not just
   "industrial", but categorized as **industrial, farm, mine/quarry, power plant,
   landfill, oil/gas, forest, or residential**
3. Calculates the distance between each hotspot and the nearest recognized site
4. Applies simple rules to classify the hotspot (industrial fire, agricultural
   burning, mining/landfill fire, wildfire, normal source, or unknown) and tags
   it with a **location type** (what kind of place it's actually in/near)
5. Shows everything on one interactive map: thermal hotspots **and** a
   toggleable OSM land-use layer (🏭 industry, 🌾 farms, ⛏️ mines, ⚡ power
   plants, 🗑️ landfills, 🛢️ oil/gas, 🌲 forest, 🏘️ residential) plotted together
6. Lets you **filter** hotspots by classification, date range, and free-text search
7. Lets you **switch the map's base layer** (Dark / Light / Satellite), toggle
   the land-use layer on/off, and shows a **legend** for both hotspot colors
   and facility types

---

## 2. Project structure

```text
industrial-fire-detection/
│
├── frontend/              # Everything the user sees (React + map)
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx            # Main layout, fetches data from backend
│   │   ├── components/
│   │   │   ├── Map.tsx            # Leaflet map, markers, legend, base layer switcher
│   │   │   ├── Sidebar.tsx        # Stat counters (total, industrial, etc.)
│   │   │   ├── Filters.tsx        # Classification/date/search filter controls
│   │   │   ├── HotspotList.tsx    # Clickable list of hotspots
│   │   │   └── AlertCard.tsx      # Detail panel: classification + "Why?"
│   │   └── styles/
│   │       └── style.css
│   └── package.json
│
├── backend/                # Everything that fetches/processes data
│   ├── server.py               # FastAPI app — /api/hotspots and /api/facilities
│   ├── firms_api.py            # Gets hotspot data (real or demo)
│   ├── osm_api.py              # Gets & categorizes nearby land use via OSM Overpass
│   ├── detection.py            # Distance math + classification rules
│   ├── sample_hotspots.json    # Demo data, used if no FIRMS key is set
│   └── requirements.txt
│
├── .env.example             # Template for your API key
└── README.md
```

**Where things live:**
- Frontend UI → `frontend/`
- Backend logic → `backend/`
- API calls → `backend/firms_api.py` and `backend/osm_api.py`
- AI/classification logic → `backend/detection.py`
- Map code → `frontend/src/components/Map.tsx`
- Config/API keys → `.env` (you create this, based on `.env.example`)

---

## 3. Install the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 4. Install the frontend

```bash
cd frontend
npm install
```

---

## 5. Add your API key

1. Copy the example env file into the `backend/` folder and rename it:

   ```bash
   cp .env.example backend/.env
   ```

2. Open `backend/.env` and add your real NASA FIRMS key:

   ```text
   FIRMS_MAP_KEY=your_real_key_here
   ```

   Get a free key here: https://firms.modaps.eosdis.nasa.gov/api/map_key/

   **If you skip this step, the app still works** — it will automatically use
   the demo data in `backend/sample_hotspots.json` and clearly label it as
   "Demo Data" in the sidebar.

The frontend never sees this key. Only the backend uses it.

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

## 7. How the detection works

For each hotspot, the backend:

1. **Looks up nearby land use via OpenStreetMap's Overpass API** (`osm_api.py` →
   `get_nearby_facilities`), tagging every feature it finds with a category:
   `industrial`, `farm`, `mine`, `power_plant`, `landfill`, `oil_gas`, `forest`,
   or `residential`.
2. **Calculates distance** to the nearest of those features (`detection.py` →
   `calculate_distance`, using the Haversine formula for real-world distance
   on a sphere).
3. **Applies simple rules** (`detection.py` → `classify_hotspot`), which now
   branch on *what kind* of place is nearby, not just "is something nearby":
   - **Very close to an industrial site + strong heat** → `Possible Industrial Fire`
   - **Very close to farmland + strong heat** → `Possible Agricultural Burning`
   - **Very close to a mine/quarry/landfill + strong heat** → `Possible Mining/Landfill Fire`
   - **Near a site + moderate heat** → `Normal Thermal Source`
   - **Far from any recognized site** → `Possible Wildfire`
   - **Anything unclear** → `Unknown / Needs Investigation`
4. **Tags a `location_type`** on every hotspot — what OSM says is actually
   there (e.g. "Farm / agricultural land"), independent of the fire
   classification, so you always know *where* a hotspot is, not just *what it
   looks like*.
5. **Explains itself** — every classification comes with a short list of plain-English reasons (e.g. "Hotspot is 350 m from Facility X (Industrial facility)", "High thermal intensity detected").

The exact distance/brightness thresholds are prototype values, defined at the
top of `detection.py`, and can be tuned easily. The list of recognized OSM
tags per category lives in `osm_api.py` → `CATEGORY_TAGS`, and is easy to
extend (e.g. add more `power=*` sub-types, or split "farm" into livestock vs.
crop land).

### API endpoints

- `GET /api/hotspots` — full pipeline: hotspots (classified, with
  `location_type`) + a deduplicated `facilities` list for the map's land-use layer.
- `GET /api/facilities?lat=&lon=&radius=` — standalone OSM lookup: "what's
  near this point?", independent of any hotspot.

---

## 8. Filters and map controls

**Filters** (left sidebar, below the stat cards):
- Checkboxes to show/hide each classification type
- A search box that matches against facility name or classification
- A date range (from/to) that filters by detection date

All filtering happens on the frontend, in `App.tsx`, so it applies instantly
without re-calling the backend. The stat counters and hotspot list update to
match whatever is currently filtered.

**Map controls** (bottom corners of the map):
- Bottom-left: switch the base map between Dark, Light, and Satellite, and
  toggle the "🗺️ Land use" OSM layer (industry/farm/mine/power plant/landfill/
  oil-gas/forest/residential markers) on or off
- Bottom-right: a legend showing what each hotspot marker color means, plus
  the icon for each land-use type currently on the map

Click any hotspot to open its detail card, which now shows a **Location
Type** row (e.g. "🌾 Farm / agricultural land") in addition to the
classification and reasons.

---

## 9. Notes on demo data

If NASA FIRMS is unreachable or no API key is configured, the app uses
`backend/sample_hotspots.json` — a small, realistic-looking dataset — so you
can demo the full pipeline without needing real credentials. Whenever demo
data is used, the UI shows a clear **"Demo Data"** badge so it's never
mistaken for a live feed.
