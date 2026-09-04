# Walkthrough: Thermal Behavior, Abnormality Modeler & 0–100 Risk Engine

## Overview & Architecture

We have transformed Thermal Watch into an advanced risk intelligence platform. The core output is no longer just *"what is this heat?"*, but:
1. **How abnormal is this heat relative to its own baseline?**
2. **How persistent is it over time?**
3. **Is it spreading or escalating?**
4. **Who and what is exposed to the threat?**
5. **What is the current 0–100 Risk Score and Investigation Priority?**

```
FIRMS DETECTION
      ↓
THERMAL SIGNAL ANALYSIS
      ↓
HISTORICAL BEHAVIOR (24h, 3d, 7d, 14d, 30d, 90d)
      ↓
PERSISTENCE ANALYSIS (Persistence ≠ Danger)
      ↓
ABNORMALITY ANALYSIS (Current FRP vs Own Baseline)
      ↓
SPATIAL / MAP CONTEXT (Forest, Industry, Road, Settlement)
      ↓
SOURCE CLASSIFICATION
      ↓
PROXIMITY / EXPOSURE ANALYSIS
      ↓
ESCALATION & SPATIAL EXPANSION ANALYSIS
      ↓
RISK SCORE 0–100 (Independent Components)
      ↓
RISK LEVEL + EXPLAINABLE DRIVERS & REDUCERS
      ↓
INVESTIGATION PRIORITY (0–100)
```

---

## 1. Decoupling Thermal Intensity, Confidence, and Risk (Requirements 2, 17, 18)

A critical principle implemented throughout the system:
- **Thermal Intensity ≠ Risk**:
  A steady 8.5 MW industrial blast furnace running inside a licensed complex far from settlements is **LOW/MODERATE Risk** ($32/100$), despite its high thermal intensity.
  Conversely, a 3.5 MW new fire front spreading into dry forest 800m from a village is **CRITICAL Risk** ($88/100$), despite modest initial thermal intensity.
- **Classification Confidence ≠ Risk**:
  A source can be classified as `Likely Industrial Heat` with **$92\%$ Confidence** and **$28/100$ (LOW) Risk**.
  An unclassified hotspot can have **$32\%$ Confidence** (`Unknown / Needs Verification`) but **$81/100$ (CRITICAL) Risk**, driving an **$87/100$ (URGENT) Investigation Priority**.

---

## 2. Multi-Window Historical Persistence & Abnormality Engine (`backend/thermal_behavior.py`)

- **Multi-Temporal Windows**:
  Computes historical behavior across $24\,\text{h}$, $3\,\text{d}$, $7\,\text{d}$, $14\,\text{d}$, $30\,\text{d}$, and $90\,\text{d}$ to calculate observation count, active days, average FRP, maximum FRP, and location consistency.
- **Hotspot-Specific Baseline Modeling (Requirement 6)**:
  Measures deviation from the detection's **own historical baseline** rather than a blunt global threshold:
  $$\text{Ratio} = \frac{\text{Current FRP}}{\text{Baseline FRP}}$$
  - A furnace operating at $6\,\text{MW}$ against a baseline of $5.5\,\text{MW}$ produces a **LOW** abnormality score ($1.09\times$).
  - An unexpected surge of $11.5\,\text{MW}$ against a baseline of $2.2\,\text{MW}$ produces a **SEVERE** abnormality score ($5.2\times$).

---

## 3. The 0–100 Risk Model & Explainable Breakdown (Requirements 13, 14, 15)

The 0–100 Risk Score evaluates independent components (normalized without double-counting):
1. **Thermal Intensity** (0–20): Radiative power and brightness temperature.
2. **Abnormality** (0–20): Deviation from hotspot's historical baseline.
3. **Escalation / Persistence Trend** (0–15): FRP trajectory over recent passes.
4. **Spatial Expansion** (0–15): Growth of affected area and multi-pixel spread.
5. **Exposure / Proximity** (0–15): Proximity to settlements, transport, and infrastructure.
6. **Source Hazard** (0–10): Source-specific threat profile (wildfire vs. routine industrial process).
7. **Detection Confidence** (0–5): Telemetry reliability.

### Risk Levels & Formatting:
- $0\text{--}19$: **`MINIMAL`**
- $20\text{--}39$: **`LOW`**
- $40\text{--}59$: **`MODERATE`**
- $60\text{--}79$: **`HIGH`**
- $80\text{--}100$: **`CRITICAL`**

### Explainable Drivers & Reducers:
- **Primary Risk Drivers (`↑`)**:
  - `↑ FRP is 4.2× historical baseline`
  - `↑ Thermal footprint expanding rapidly into surrounding vegetation`
  - `↑ Active wildfire front within 1.2km of settlement`
  - `↑ Settlement within 600m`
- **Risk Reducers (`↓`)**:
  - `↓ Stationary continuous industrial process within complex boundary`
  - `↓ Stable thermal load consistent with 30-day baseline`
  - `↓ No expansion into surrounding community`

---

## 4. Operational Risk Dashboard & Frontend Integration

1. **Compact Triage Card Header (`frontend/src/components/TriageCard.tsx`)**:
   - Four primary intelligence badges prominently displayed:
     - **Risk Badge**: `32/100 LOW RISK` (color-coded meter)
     - **Nature Badge**: `NATURE: PERSISTENT / STABLE`
     - **Confidence Badge**: `CONFIDENCE: HIGH` (decoupled from risk)
     - **Priority Badge**: `PRIORITY: 38/100`
   - **Baseline Trend Pill**: `📊 Baseline: Consistent with historical passes`
   - **Interactive 0–100 Risk Score Breakdown Card** with component scores and Drivers/Reducers list.
2. **Sidebar Operational Risk Grid (`frontend/src/components/Sidebar.tsx`)**:
   - Real-time clickable risk pills:
     - `CRITICAL (0)` · `HIGH (5)` · `MODERATE (54)` · `LOW (109)` · `MINIMAL (2)`
   - Operators can click any risk pill to filter the entire view to hotspots matching that risk level.
3. **Hotspot List Item Tags (`frontend/src/components/HotspotList.tsx`)**:
   - Each item in the list shows its Risk Score + Level, Thermal Nature, Confidence, and Settlement/Trend subtitle.

---

## 5. Automated Verification & Test Results

### 1. The 10 Behavior & Risk Test Cases (`backend/test_risk_engine_suite.py`)
```
==================================================
TEST SUITE: THERMAL BEHAVIOR & 0-100 RISK MODEL (10 CASES)
==================================================
[Case 1] Persistent Industrial Heat:
  Risk: 32/100 (LOW) | Nature: PERSISTENT / STABLE | Conf: 92%
  [PASS] High FRP industrial heat confirmed as LOW/MODERATE risk (stable within facility)

[Case 2] New Industrial Heat:
  Risk: 29/100 (LOW) | Nature: PERSISTENT / STABLE
  [PASS] New industrial heat classified with appropriate baseline uncertainty

[Case 3] Abnormal Industrial Heat Spike:
  Risk: 90/100 (CRITICAL) | Nature: ABNORMAL / ESCALATING
  [PASS] Sudden abnormal industrial spike elevated to HIGH/CRITICAL risk

[Case 4] Stable Agricultural Burning:
  Risk: 31/100 (LOW)
  [PASS] Typical agricultural burn has manageable LOW/MODERATE risk

[Case 5] New Agricultural Burning:
  Risk: 39/100 (LOW) | Nature: NEW / FIRST OBSERVED
  [PASS] New agricultural burning evaluated with exposure proximity

[Case 6] Expanding Wildfire:
  Risk: 88/100 (CRITICAL) | Nature: ABNORMAL / ESCALATING
  [PASS] Expanding wildfire correctly categorized as CRITICAL risk

[Case 7] Persistent Landfill Heat:
  Risk: 33/100 (LOW)
  [PASS] Persistent landfill smoldering evaluated as MODERATE/LOW

[Case 8] Isolated Sensor Anomaly:
  Risk: 18/100 (MINIMAL) | Nature: SENSOR-SUSPECTED
  [PASS] Sensor anomaly correctly treated as MINIMAL fire risk

[Case 9] High-Risk Unknown Source:
  Risk: 81/100 (CRITICAL) | Conf: 32% | Priority: 87/100 (URGENT)
  [PASS] High-risk unknown source triggers URGENT investigation priority despite low classification confidence

[Case 10] Low-Risk Persistent Source:
  Risk: 19/100 (MINIMAL)
  [PASS] Low-risk persistent source verified
==================================================
ALL 10 THERMAL BEHAVIOR & RISK TEST CASES PASSED!
==================================================
```

### 2. Comprehensive Test Suites
- **`backend/test_risk_engine_suite.py`**: 10/10 passed (100%).
- **`backend/test_industrial_evidence_suite.py`**: 7/7 passed (100%).
- **`backend/test_thermal_analysis.py`**: 10/10 passed (100%).
- **`backend/test_india_suite.py`**: 7/7 passed (100%).
- **Frontend Build (`npm.cmd run build`)**: 0 errors, built in 3.63s.

### 3. Live Production Telemetry (India Viewport)
```
Total Active Detections: 170
Classified: 170 / 170 (100%)

Operational Risk Breakdown:
  CRITICAL : 0
  HIGH     : 5
  MODERATE : 54
  LOW      : 109
  MINIMAL  : 2
```
