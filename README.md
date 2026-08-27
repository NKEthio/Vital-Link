# Vitalink — Emergency Blood Network

A decision-support prototype for a remote hospital blood-sharing mesh network,
built with React + Vite.

## Getting started

```bash
npm install
npm run dev       # local dev server, hot reload
npm run build     # production build -> dist/
npm run preview   # preview the production build
```

Requires Node 18+.

## Project structure

```
src/
  data/
    network.js       # hospital + supplier data, network topology (edit this
                      # to point at a real API instead of hardcoded state)
  lib/
    forecast.js       # pure functions: 48h forecasting, risk classification,
                       # "why is this hospital at risk" reasoning, neighbor
                       # search for the emergency algorithm — no React/DOM
                       # dependencies, easy to unit test
  components/
    Header.jsx        # brand, vitals pulse line, KPI bar
    Sidebar.jsx        # facility list with inventory sparklines
    NetworkMap.jsx      # SVG mesh map; exposes animateDrone() via ref for
                        # the emergency-dispatch flight sequence
    DetailPanel.jsx     # per-hospital forecast, reasoning, simulate button
    Console.jsx         # tabbed live telemetry feed / emergency response log
  App.jsx              # top-level state, telemetry interval, emergency
                        # simulation orchestration
  index.css            # design tokens + all component styles
```

## How the simulation works

- **Live telemetry**: every ~3.2s, one or two random hospitals get a small
  inventory/patient-count adjustment, logged to the "Live telemetry" console
  tab. This stands in for a real hospital data feed — swap `useEffect`'s
  `tick()` in `App.jsx` for a WebSocket subscription or polling call when you
  have one.
- **Forecasting**: `computeForecast()` in `lib/forecast.js` projects 48-hour
  blood requirement from current need + one day's average consumption, plus
  emergency demand if a PPH case is active. Risk is `stable` / `watch` /
  `at-risk` based on the resulting shortage.
- **Emergency algorithm**: `simulateEmergency()` in `App.jsx` follows the
  brief's escalation order — recalculate demand, check local inventory,
  search neighboring hospitals for surplus (nearest first), dispatch a drone
  (animated on the map with a live ETA countdown), and escalate to the
  Regional Blood Bank if the mesh can't cover the gap.

## Next steps to make this production-real

- Replace `freshHospitals()` in `data/network.js` with a real data source.
- Persist state (currently everything resets on page reload).
- Replace simulated drone timing/positions with real GPS + routing data.
- Add auth / role-based access if this will be used by hospital staff.
- Add tests around `lib/forecast.js` — it's pure functions, so this is
  straightforward with Vitest.
