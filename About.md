# Vitalink — Emergency Blood Network

## The problem it addresses

Remote hospitals often manage blood inventory in isolation — each facility tracks its own stock and requests help only after a shortage is already critical. There's no shared visibility across nearby facilities, and no structured way to decide *where* to pull emergency blood from when a crisis hits (a postpartum haemorrhage case, a mass-casualty event, etc.).

Vitalink is a decision-support prototype for a **regional blood-sharing network**: instead of each hospital escalating straight to a distant blood bank, nearby hospitals with surplus stock become the first line of response, with external suppliers as a fallback.

## Network architecture

The system models three tiers:

1. **Remote hospital mesh** — four hospitals (Hospital 1–4) fully interconnected, so any hospital can receive a transfer from any other. This is the "local blood-sharing network" from the brief.
2. **External hospitals** — two larger hospitals sitting just outside the mesh, reachable when the mesh itself can't cover a shortage.
3. **Regional Blood Bank** — the upstream supplier of last resort, always assumed to have sufficient stock.

Escalation follows a strict order: **own inventory → nearest hospital with surplus → next-nearest → external hospital → regional blood bank.**

## Core features

**Live network map** — an SVG mesh diagram showing all four hospitals and their connections to external suppliers. Each hospital node is colour-coded by risk (stable / watch / at-risk) and shows live unit count and blood type.

**Hospital detail panel** — clicking any hospital shows:
- Current situation (patients, expected arrivals, maternity patients, active PPH cases)
- Blood inventory (available, current need, daily consumption)
- A 48-hour forecast (estimated requirement, projected shortage, time-to-shortage)
- A **"Why is this hospital at risk?"** explanation panel — not just a number, but the reasoning behind it (stock vs. demand, patient load vs. baseline, maternity share, whether a neighbor has surplus)
- A recommended action (which hospital to pull from, distance, ETA)

**Emergency simulation** — clicking "Simulate PPH emergency" runs the actual algorithm from the brief, live:
1. Recalculates total demand including the emergency component
2. Checks whether the hospital's own inventory can absorb it
3. If not, searches neighboring hospitals for surplus, nearest first
4. Dispatches a drone — animated flight path with a live ETA countdown, visible on the map
5. Updates both hospitals' inventory once the transfer "arrives"
6. Escalates to the Regional Blood Bank if the mesh can't fully cover the gap

Every step is narrated in an **Emergency Response Log**.

**Live telemetry feed** — independent of the simulation, hospital inventory and patient counts drift slightly every few seconds (routine draws, restocks, patient fluctuation), logged to a separate **Live Telemetry** tab. This is what makes the dashboard feel like a monitoring system rather than a static diagram — it's continuously "alive" even when you're not interacting with it.

**Network-wide KPIs** — hospitals at risk (X/4), total projected shortage across the network, and count of active emergencies, all recalculated live as data changes.

**Sidebar with sparklines** — a quick-scan list of all four facilities with a small inventory trend line per hospital, so you can spot a declining trend before it becomes a crisis.

## How the decision logic works

- **48-hour forecast** = current unmet need + one day's average consumption, plus emergency demand if a crisis is active.
- **Risk level**: stable (no shortage), watch (small shortage), at-risk (shortage > 6 units).
- **Neighbor search**: ranks other hospitals by surplus and distance (nearest first), covering the shortfall from as many nearby sources as needed before escalating externally.
- **Drone ETA**: distance is derived from map coordinates and converted to minutes at an assumed 80 km/h cruise speed — a placeholder for real GPS + routing data later.

## Tech stack

Delivered as a **React + Vite** codebase:

- `src/data/network.js` — hospital and supplier data, network topology (your integration point for a real data source)
- `src/lib/forecast.js` — pure, framework-free functions for forecasting, risk classification, and the escalation algorithm (easy to unit test)
- `src/components/` — Header (KPIs, vitals pulse), Sidebar (facility list + sparklines), NetworkMap (SVG mesh + drone animation), DetailPanel, Console (telemetry/log tabs)
- `src/App.jsx` — state management, the telemetry interval, and emergency simulation orchestration

No backend yet — all data is simulated client-side and resets on reload, by design, so you can wire in a real API without fighting existing state management.

## What it's not (yet)

It's a **decision-support prototype**, not a live operational system: no real hospital data feed, no persistence, no auth, and drone timing is simulated rather than GPS-based. The README in the project includes a "next steps to make this production-real" section covering exactly those gaps.
