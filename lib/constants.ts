// Central registry of all tunable constants for the Animal Talking demo.
// Grouped by concern so callers import only the slice they need.

// ---------------------------------------------------------------------------
// World grid
// ---------------------------------------------------------------------------

// Dimensions of the walkable tile grid.
export const GRID_WIDTH = 12;
export const GRID_HEIGHT = 8;

// Row 0 is reserved — NPCs cannot walk there so speech bubbles are never clipped.
export const BLOCKED_ROW_TOP = 0;

// ---------------------------------------------------------------------------
// Simulation rules
// ---------------------------------------------------------------------------

// Minimum ticks between two NPCs interacting (or being directed toward each other).
// At TICK_INTERVAL_MS=1800 ms this equals ~7.2 s — short enough to allow chaining,
// long enough to prevent instant re-trigger.
export const INTERACTION_COOLDOWN_TICKS = 4;

// How many ticks between each weather transition.
export const WEATHER_CHANGE_INTERVAL_TICKS = 30;

// Every WANDER_INTERVAL ticks an idle-in-zone NPC picks a random free adjacent
// cell still inside the zone, so the map looks alive even when nobody is
// approaching each other.
export const WANDER_INTERVAL = 4;

// ---------------------------------------------------------------------------
// Simulation timing  (UI / runtime)
// ---------------------------------------------------------------------------

// Real-time interval between two simulation ticks, in milliseconds.
export const TICK_INTERVAL_MS = 1800;

// Simulated generation delay before the dialogue is resolved.
// Can be overridden via NEXT_PUBLIC_GENERATION_DELAY_MS for faster demos.
export const GENERATION_DELAY_MS =
  Number(process.env.NEXT_PUBLIC_GENERATION_DELAY_MS) || 20_000;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

// localStorage key — bump the version suffix whenever the DemoState schema changes.
export const STORAGE_KEY = "animal-talking-demo-state-v8";
export const STORAGE_VERSION = 8;

// sessionStorage keys used to distinguish a hard refresh from a normal reload.
export const SESSION_KEY = "animal-talking-session-v4";
export const SESSION_START_KEY = "animal-talking-session-start-v5";

// ---------------------------------------------------------------------------
// UI pagination
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 10;
export const CONV_PAGE_SIZE = 10;
