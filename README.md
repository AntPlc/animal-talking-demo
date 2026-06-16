# Animal Talking Demo

Frontend demo for the Animal Talking sprint. The current implementation is a
fully client-side Next.js app with:

- a 2D NPC grid;
- deterministic movement and proximity-triggered interactions;
- a structured fake Animal Talking provider;
- conversation history persisted in `localStorage`;
- a read-only NPC database view.

## Prerequisites

- Node.js 20+
- a modern Chromium browser for local development

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

- `/` - live simulation
- `/history` - saved conversations
- `/database` - NPC runtime snapshot

## Notes

- The docs mention `volet-168h/`, but this checkout already is the demo root.
- The WebLLM/WebGPU integration is intentionally left for the next iteration; the
  current demo focuses on the simulation and structured dialogue pipeline.
