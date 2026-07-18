# Quiet Garden

A real-time WebGL world for visualising the environmental impact of LLM work. Water grows grass, energy feeds a living fire, and carbon grows a tree canopy while remaining visible as atmospheric motes.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use **Run live task** for the full cinematic sequence, then **Run lighter route** to show the absolute resource savings.

Two visual concepts are available:

- `/` — Quiet Garden
- `/foundry` — Token Foundry

## Production check

```bash
npm run build
npm run preview
```

## Stack

- React and TypeScript
- Three.js through React Three Fiber
- Procedural grass, water, fire, trees, particles, and companion animation
- Deterministic demo telemetry using `mL`, `Wh`, and `gCO₂e`

The OpenAI mark in the header is an unmodified official asset. Quiet Garden remains the primary product identity.
