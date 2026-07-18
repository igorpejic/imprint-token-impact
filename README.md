# Imprint

An Electron dashboard for the environmental footprint of local Codex use, with interactive Quiet Garden and Token Foundry visualisations.

## Run locally

```bash
npm install
npm run dev
```

This opens the Electron app. The **Monitor** tab shows derived Codex usage estimates; **Animations** contains the Garden and Foundry scenes, with route, pause, and restart controls. For browser-only development, run `npm run dev:web` and open the local Vite URL.

## Data handling

The app reads `~/.codex/sessions` and `~/.codex/archived_sessions` locally. It never stores transcript text, prompts, or tool output—only derived token/model/project events and environmental estimates in the app's local SQLite database.

## Production check

```bash
npm run build
npm run preview
```

## Estimation note

Impact is calculated from recorded token activity and a versioned model coefficient range. Cached input receives a lower prefill weight; reasoning output is already part of output tokens and is not counted twice. Carbon uses a U.S. baseline of 0.3844 kgCO2e/kWh; water includes on-site plus off-site grid water. These are operational estimates, not measured data-centre telemetry.
