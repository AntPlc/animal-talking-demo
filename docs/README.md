# Animal Talking Documentation

This folder consolidates the project docs so the repo has one place to read the
demo overview, the AI scope notes, and the asset notes.

## 1. Project Overview

Frontend demo for the Animal Talking sprint. The current implementation is a
fully client-side Next.js app with:

- a 2D NPC grid;
- deterministic movement and proximity-triggered interactions;
- a structured fake Animal Talking provider;
- conversation history persisted in `localStorage`;
- a read-only NPC database view.

## 2. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 3. Routes

- `/` - live simulation
- `/history` - saved conversations
- `/database` - NPC runtime snapshot

## 4. AI Scope

### Goal

Reduce the cost of authoring NPC dialogues by using a local LLM in the browser
to generate contextualized exchanges from each NPC's personality, hobbies, and
runtime state.

### Demo target

The jury demo should show a 2-3 minute flow:

1. NPCs move around the grid.
2. Two NPCs interact when they are close enough or when a rule triggers.
3. A local LLM generates a contextual conversation.
4. The UI displays the dialogue and updates the NPC history/state.
5. Different NPC profiles produce distinct exchanges.

### Scope

In scope:

- 2D grid simulation with minimal movement;
- NPC interactions without an LLM;
- NPC interactions with an LLM;
- local browser LLM execution via WebGPU;
- profile / state visualization;
- web demo with no install or account.

Out of scope:

- backend services;
- dedicated database;
- API design work;
- full game production;
- deep integration into InstantFPS.

### Technical direction

| Layer | Choice | Notes |
|------|--------|-------|
| Framework | Next.js + TypeScript | Static-friendly, React ecosystem |
| 2D rendering | Three.js or Canvas 2D | Keep the scene light |
| Local LLM | WebLLM (`@mlc-ai/web-llm`) | Browser-side inference |
| Model | `Qwen2.5-3B-Instruct-q4f16_1-MLC` | Good tradeoff for a 1660 Ti-class GPU |
| State | React store (Zustand or Context) | No server persistence |

### Design principles

- 100% frontend: state lives in memory or local JSON-like structures.
- LLM as an application layer: no model training, only prompts and validation.
- English-only LLM I/O: all prompts, dialogue lines, memories, and validation
  rules use English. No translation or locale conversion layer.
- Minimal UI: the grid exists to make the dialogue pipeline visible.
- AI Town inspiration: separate simulation from async LLM work; keep short-term
  memory small and focused.

### Runtime data model

```ts
interface NpcProfile {
  id: string;
  name: string;
  role: string;
  personality: string[];
  hobbies: string[];
  traits: Record<string, string | number>;
}

interface NpcRuntimeState {
  profileId: string;
  position: { x: number; y: number };
  status: "idle" | "moving" | "in_conversation";
  shortHistory: string[];
  conversationLog: DialogueLine[];
}

interface DialogueLine {
  speaker: string;
  text: string;
  timestamp: number;
}
```

### Dialogue pipeline

The intended dialogue pipeline is:

1. Build a constrained prompt in English.
2. Ask for short dialogue lines in `NAME: line` format.
3. Validate the output: turn count, voice count, anti-repetition.
4. Run a correction pass if the first answer is not compliant.

### No-LLM interaction rules

- Random or waypoint movement on the grid.
- Proximity detection for adjacent cells or a distance threshold.
- One active conversation at a time.
- Trigger when two NPCs are close enough and the cooldown is expired.

### Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM too slow | Medium | Smaller model, fewer tokens, preload early |
| Inconsistent output | High | Prompt constraints, validation, correction pass |
| WebGPU unavailable | High | Test on the demo machine, keep a fallback plan |
| Scope creep | High | Keep the demo focused: no full game, no backend |

### Recommended implementation order

1. Scope definition and repo structure.
2. Local LLM proof of concept.
3. NPC model and seeded data.
4. 2D scene and movement.
5. Dialogue pipeline with validation.
6. Wiring simulation -> LLM -> UI -> history.
7. Proofs, metrics, and capture material.

### Proofs expected for delivery

- Useful Git history.
- Scripted demo scenario.
- Metrics for load and generation time.
- Screenshots or short video.
- Architecture and limitations documentation.

## 5. Portrait Assets

See `docs/portraits/README.md` for the portrait asset conventions.

