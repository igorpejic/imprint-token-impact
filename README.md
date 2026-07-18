# Imprint

A local Electron dashboard for the environmental footprint of Codex use.

## Run locally

```bash
npm install
npm run dev
```

The app reads `~/.codex/sessions` and `~/.codex/archived_sessions` locally. It never stores transcript text, prompts, or tool output—only derived token/model/project events and environmental estimates in the app's local SQLite database.

## What is implemented

- Live Codex JSONL monitoring with duplicate cumulative-token suppression.
- Historical backfill, newest first, with persisted file offsets.
- Pinned-first, recency-ordered Codex projects from `~/.codex/.codex-global-state.json`.
- Searchable project selector, date ranges, multi-model attribution, and a five-project comparison flow.
- Separate carbon, water, and energy measures, with operational inference estimates and visible model-confidence status.
- Literal London-route, bottle, house-energy, and embedded forest visualisations.

## Estimation note

Impact is calculated from recorded token activity and a versioned model coefficient range. Cached input receives a lower prefill weight; reasoning output is already part of output tokens and is not counted twice. Carbon uses a U.S. baseline of 0.3844 kgCO2e/kWh; water includes on-site plus off-site grid water. These are operational estimates, not measured data-centre telemetry.
