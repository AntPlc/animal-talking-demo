// Shared demo state, simulation rules, and the fake Animal Talking provider.

import {
  BLOCKED_ROW_TOP,
  GRID_HEIGHT,
  GRID_WIDTH,
  INTERACTION_COOLDOWN_TICKS,
  WANDER_INTERVAL,
  WEATHER_CHANGE_INTERVAL_TICKS,
} from "./constants";
import { applyConflictSeeding, isConflictPair } from "./conflict-pairs";
import { NPC_PROFILES, type NpcProfile } from "./npc-data";
import { findPathToGoal, nextPathStep } from "./pathfinder";

export type { NpcProfile } from "./npc-data";

export type DemoView = "simulation" | "data";

export type Weather = "SUNNY" | "CLOUDY" | "RAINY" | "STORMY";

export type NpcMood = "CALM" | "CURIOUS" | "BUSY" | "EXCITED";

export type RelationshipType =
  | "STRANGER"
  | "DISLIKED"
  | "FRIEND"
  | "RIVAL"
  | "ENEMY"
  | "FAMILY"
  | "ROMANTIC_INTEREST";

export type InteractionReason = "PROXIMITY" | "SAME_ZONE" | "SCRIPTED_EVENT";

export type NpcObjective =
  | {
      type: "GO_TO_LOCATION";
      targetZoneId: string;
      label: string;
    }
  | {
      type: "IDLE";
      label: string;
    };

export interface Position {
  x: number;
  y: number;
}

export interface WorldZone {
  id: string;
  name: string;
  topLeft: Position;
  bottomRight: Position;
}

export interface WorldTime {
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface NpcRuntimeState {
  position: Position;
  destination: Position | null;
  targetZoneId: string | null;
  status: "idle" | "moving" | "in_conversation";
  mood: NpcMood;
  objective: NpcObjective | null;
  shortHistory: string[];
  lastInteractionTick: number;
  blockedTicks: number;
}

export interface NpcState {
  profile: NpcProfile;
  runtime: NpcRuntimeState;
  relationships: Record<string, RelationshipType>;
  memories: string[];
}

export interface DialogueTurn {
  index: number;
  speakerId: string;
  speakerName: string;
  message: string;
  mood?: NpcMood;
  createdAt: string;
}

export type CharacterUpdate =
  | {
      type: "UPDATE_MOOD";
      characterId: string;
      mood: NpcMood;
      note: string;
      source: "CLASSIC_ENGINE" | "LLM_PACKAGE";
      timestamp: string;
    }
  | {
      type: "UPDATE_OBJECTIVE";
      characterId: string;
      objective: NpcObjective;
      note: string;
      source: "CLASSIC_ENGINE" | "LLM_PACKAGE";
      timestamp: string;
    }
  | {
      type: "ADD_MEMORY";
      characterId: string;
      memory: string;
      note: string;
      source: "CLASSIC_ENGINE" | "LLM_PACKAGE";
      timestamp: string;
    }
  | {
      type: "UPDATE_RELATIONSHIP";
      characterId: string;
      targetCharacterId: string;
      relationship: RelationshipType;
      note: string;
      source: "CLASSIC_ENGINE" | "LLM_PACKAGE";
      timestamp: string;
    };

export interface OverrideEvent {
  id: string;
  tick: number;
  characterId: string;
  type: CharacterUpdate["type"];
  source: "CLASSIC_ENGINE" | "LLM_PACKAGE";
  note: string;
  timestamp: string;
}

export interface ConversationRecord {
  id: string;
  participantIds: [string, string];
  participantNames: [string, string];
  reason: InteractionReason;
  zoneId: string | null;
  status: "generating" | "completed" | "failed";
  generatedTurnCount: number;
  turns: DialogueTurn[];
  updates: CharacterUpdate[];
  summary: string;
  startedAt: string;
  endedAt?: string;
  startedAtMs?: number;
  endedAtMs?: number;
}

export type UpdateSource = "CLASSIC_ENGINE" | "LLM_PACKAGE";

export interface NpcFieldSources {
  mood: UpdateSource | null;
  objective: UpdateSource | null;
  memories: Record<string, UpdateSource>;
  relationships: Record<string, UpdateSource>;
}

export interface DemoState {
  tick: number;
  worldTime: WorldTime;
  weather: Weather;
  zones: WorldZone[];
  npcs: NpcState[];
  conversations: ConversationRecord[];
  recentOverrides: OverrideEvent[];
  activeConversationId: string | null;
}

export interface InteractionCandidate {
  participantIds: [string, string];
  reason: InteractionReason;
  zoneId: string | null;
}


const WEATHER_SEQUENCE: Weather[] = ["SUNNY", "CLOUDY", "RAINY", "STORMY"];

const BASE_ZONES: WorldZone[] = [
  {
    id: "plaza",
    name: "Central Plaza",
    topLeft: { x: 0, y: 0 },
    bottomRight: { x: 3, y: 2 },
  },
  {
    id: "market",
    name: "Market",
    topLeft: { x: 4, y: 0 },
    bottomRight: { x: 7, y: 2 },
  },
  {
    id: "library",
    name: "Library",
    topLeft: { x: 8, y: 0 },
    bottomRight: { x: 11, y: 2 },
  },
  {
    id: "park",
    name: "Park",
    topLeft: { x: 0, y: 3 },
    bottomRight: { x: 5, y: 7 },
  },
  {
    id: "pond",
    name: "Pond",
    topLeft: { x: 6, y: 3 },
    bottomRight: { x: 11, y: 7 },
  },
];

const OBJECTIVE_BY_ROLE: Record<string, NpcObjective> = {
  shopkeeper: { type: "GO_TO_LOCATION", targetZoneId: "market", label: "Open the boutique" },
  gardener: { type: "GO_TO_LOCATION", targetZoneId: "park", label: "Check the garden beds" },
  scout: { type: "GO_TO_LOCATION", targetZoneId: "plaza", label: "Gather town news" },
  mechanic: { type: "GO_TO_LOCATION", targetZoneId: "market", label: "Inspect the repair stall" },
  baker: { type: "GO_TO_LOCATION", targetZoneId: "market", label: "Restock the counter" },
  lifeguard: { type: "GO_TO_LOCATION", targetZoneId: "pond", label: "Patrol the pond path" },
  librarian: { type: "GO_TO_LOCATION", targetZoneId: "library", label: "Sort returned books" },
  musician: { type: "GO_TO_LOCATION", targetZoneId: "plaza", label: "Prepare a short set" },
};

// Minimal seeded LCG so randomization is deterministic per call-site seed.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pickRandomFreeCell(
  zone: WorldZone,
  occupied: Set<string>,
  rand: () => number,
): Position {
  const xs = zone.bottomRight.x - zone.topLeft.x + 1;
  const ys = zone.bottomRight.y - zone.topLeft.y + 1;
  const total = xs * ys;
  const start = Math.floor(rand() * total);

  for (let i = 0; i < total; i += 1) {
    const idx = (start + i) % total;
    const pos: Position = {
      x: zone.topLeft.x + (idx % xs),
      y: zone.topLeft.y + Math.floor(idx / xs),
    };
    if (pos.y <= BLOCKED_ROW_TOP) continue;
    const key = positionKey(pos);
    if (!occupied.has(key)) {
      return pos;
    }
  }

  // Zone is full — scan the entire walkable grid for any free cell.
  for (let y = BLOCKED_ROW_TOP + 1; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const pos: Position = { x, y };
      if (!occupied.has(positionKey(pos))) {
        return pos;
      }
    }
  }

  // Grid is completely full (should never happen with 8 NPCs on a 12×8 grid).
  return { x: 0, y: BLOCKED_ROW_TOP + 1 };
}

// Place every NPC at a random free cell within their preferred zone.
// Uses Date.now() as seed so each hard-refresh produces a different layout.
export function randomizeNpcPositions(state: DemoState, seed: number): DemoState {
  const rand = lcg(seed);
  const occupied = new Set<string>();

  for (let x = 0; x < GRID_WIDTH; x += 1) {
    occupied.add(positionKey({ x, y: BLOCKED_ROW_TOP }));
  }

  const npcs = state.npcs.map((npc) => {
    const zone =
      getZoneById(state.zones, npc.profile.preferredZoneId) ?? state.zones[0];
    const position = pickRandomFreeCell(zone, occupied, rand);
    occupied.add(positionKey(position));

    return {
      ...npc,
      runtime: {
        ...npc.runtime,
        position,
        destination: null,
        status: "idle" as const,
        blockedTicks: 0,
      },
    };
  });

  return { ...state, npcs };
}

// Builds the canonical starting DemoState: 8 NPCs with all relationships set to
// STRANGER, default role-based objectives, and two seed memories each.
// Uses a fixed seed (42) for NPC placement so server and client render the same layout on SSR.
export function createInitialDemoState(): DemoState {
  const npcs = NPC_PROFILES.map((profile) => {
    const relationships: Record<string, RelationshipType> = {};

    for (const other of NPC_PROFILES) {
      if (other.id !== profile.id) {
        relationships[other.id] = "STRANGER";
      }
    }

    return {
      profile,
      runtime: {
        position: { x: 0, y: 1 },
        destination: null,
        targetZoneId: null,
        status: "idle" as const,
        mood: "CALM" as const,
        objective: OBJECTIVE_BY_ROLE[profile.role] ?? {
          type: "IDLE",
          label: "Take a quiet moment",
        },
        shortHistory: [],
        lastInteractionTick: -100,
        blockedTicks: 0,
      },
      relationships,
      memories: [],
    };
  });

  const baseState: DemoState = {
    tick: 0,
    worldTime: { day: 1, hour: 9, minute: 0, second: 0 },
    weather: "SUNNY",
    zones: BASE_ZONES,
    npcs,
    conversations: [],
    recentOverrides: [],
    activeConversationId: null,
  };

  const seededState: DemoState = {
    ...baseState,
    npcs: applyConflictSeeding(
      baseState.npcs.map((npc) => ({
        ...npc,
        memories: [
          `Lives a quiet routine around the ${npc.profile.preferredZoneId}.`,
          `Known for being ${npc.profile.personality[0]}.`,
        ],
      })),
    ),
  };

  // Use a fixed seed so server and client render identical initial positions.
  return randomizeNpcPositions(seededState, 42);
}

// Moves every NPC currently frozen in "in_conversation" back to "idle".
// When stampCooldown is true, records the current tick as their last interaction
// so the cooldown timer starts from now rather than from whenever the conversation began.
function releaseInConversationNpcs(
  npcs: NpcState[],
  tick: number,
  stampCooldown: boolean,
): NpcState[] {
  return npcs.map((npc) => {
    if (npc.runtime.status !== "in_conversation") {
      return npc;
    }

    return {
      ...npc,
      runtime: {
        ...npc.runtime,
        status: "idle" as const,
        destination: null,
        ...(stampCooldown ? { lastInteractionTick: tick } : {}),
      },
    };
  });
}

// Heal inconsistent runtime state: NPCs frozen in_conversation without an
// active generating session, or an orphaned activeConversationId pointer.
export function reconcileConversationRuntime(
  state: DemoState,
  options?: { stampCooldownOnRelease?: boolean },
): DemoState {
  const stampCooldown = options?.stampCooldownOnRelease ?? false;
  const activeId = state.activeConversationId;

  if (!activeId) {
    const hasStuckNpcs = state.npcs.some((npc) => npc.runtime.status === "in_conversation");
    if (!hasStuckNpcs) {
      return state;
    }

    return {
      ...state,
      npcs: releaseInConversationNpcs(state.npcs, state.tick, stampCooldown),
    };
  }

  const activeConversation = state.conversations.find((conversation) => conversation.id === activeId);
  if (activeConversation?.status === "generating") {
    return state;
  }

  return {
    ...state,
    activeConversationId: null,
    npcs: releaseInConversationNpcs(state.npcs, state.tick, stampCooldown),
  };
}

// Extracts the minimal InteractionCandidate descriptor from an existing ConversationRecord.
// Used after a page restore to re-attach the generation timer to an interrupted conversation.
export function interactionCandidateFromConversation(
  conversation: ConversationRecord,
): InteractionCandidate {
  return {
    participantIds: conversation.participantIds,
    reason: conversation.reason,
    zoneId: conversation.zoneId,
  };
}

// Produces the next DemoState from the current one.
// Advances tick, world time, and weather, then moves every non-frozen NPC one cell
// toward its current destination (or wanders it within its zone if no destination is set).
// Also calls findApproachTarget to direct pairs of same-zone NPCs toward each other.
export function advanceDemoState(rawState: DemoState): DemoState {
  const state = reconcileConversationRuntime(rawState);

  const nextTick = state.tick + 1;
  const nextWorldTime = advanceWorldTime(state.worldTime, 2);
  const weatherIndex = Math.floor(nextTick / WEATHER_CHANGE_INTERVAL_TICKS) % WEATHER_SEQUENCE.length;
  const nextWeather = WEATHER_SEQUENCE[weatherIndex];

  const occupied = new Set<string>();

  // Hard-block the top row so NPCs never walk there.
  for (let x = 0; x < GRID_WIDTH; x += 1) {
    occupied.add(positionKey({ x, y: BLOCKED_ROW_TOP }));
  }

  for (const npc of state.npcs) {
    occupied.add(positionKey(npc.runtime.position));
  }

  // Cells adjacent to each non-conversation NPC: moving into these is soft-blocked
  // to prevent card visual overlap. Bypassed when the NPC is explicitly approaching
  // another NPC (destination is that NPC's occupied cell).
  const softBlocked = new Set<string>();
  for (const npc of state.npcs) {
    if (npc.runtime.status === "in_conversation") continue;
    const { x, y } = npc.runtime.position;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
        softBlocked.add(positionKey({ x: nx, y: ny }));
      }
    }
  }

  const nextNpcs: NpcState[] = [];

  for (const npc of state.npcs) {

    if (npc.runtime.status === "in_conversation") {
      nextNpcs.push(npc);
      continue;
    }

    const currentKey = positionKey(npc.runtime.position);
    occupied.delete(currentKey);

    const currentZone = getZoneForPosition(npc.runtime.position, state.zones);
    const explicitDestination = npc.runtime.destination;
    const destination = explicitDestination ?? resolveObjectiveDestination(npc, state.zones, currentZone);

    if (!destination) {
      const wanderTarget = pickWanderCell(npc, currentZone, occupied, nextTick, state.npcs.indexOf(npc));

      if (wanderTarget) {
        const wanderKey = positionKey(wanderTarget);
        occupied.add(wanderKey);
        nextNpcs.push({
          ...npc,
          runtime: {
            ...npc.runtime,
            position: wanderTarget,
            status: "moving" as const,
            targetZoneId:
              npc.runtime.objective?.type === "GO_TO_LOCATION" ? npc.runtime.objective.targetZoneId : null,
            blockedTicks: 0,
          },
        });
      } else {
        occupied.add(currentKey);
        nextNpcs.push({
          ...npc,
          runtime: {
            ...npc.runtime,
            status: "idle" as const,
            targetZoneId:
              npc.runtime.objective?.type === "GO_TO_LOCATION" ? npc.runtime.objective.targetZoneId : null,
          },
        });
      }
      continue;
    }

    const destinationIsOccupied = occupied.has(positionKey(destination));
    const path = findPathToGoal(
      npc.runtime.position,
      destination,
      GRID_WIDTH,
      GRID_HEIGHT,
      occupied,
      softBlocked,
      destinationIsOccupied,
    );

    const nextPosition = nextPathStep(path) ?? stepToward(npc.runtime.position, destination);
    const arrived = hasReachedDestination(
      nextPosition,
      destination,
      destinationIsOccupied,
      npc.runtime.objective,
      explicitDestination,
      state.zones,
    );
    const nextKey = positionKey(nextPosition);
    const blockedByProximity = softBlocked.has(nextKey) && !destinationIsOccupied;
    const stuckInPlace = positionsEqual(nextPosition, npc.runtime.position) && !arrived;

    if (stuckInPlace || occupied.has(nextKey) || blockedByProximity) {
      const unblockPosition = chooseUnblockMove(
        npc.runtime.position,
        nextPosition,
        occupied,
        softBlocked,
        destinationIsOccupied,
        npc.runtime.blockedTicks ?? 0,
      );

      if (unblockPosition) {
        occupied.add(positionKey(unblockPosition));
        nextNpcs.push({
          ...npc,
          runtime: {
            ...npc.runtime,
            position: unblockPosition,
            destination: explicitDestination,
            targetZoneId: resolveTargetZoneId(npc, explicitDestination, destination, state.zones),
            status: "moving" as const,
            blockedTicks: 0,
          },
        });
        continue;
      }

      const newBlockedTicks = (npc.runtime.blockedTicks ?? 0) + 1;
      const shouldReroute = newBlockedTicks >= 2 && Boolean(explicitDestination);
      occupied.add(currentKey);
      nextNpcs.push({
        ...npc,
        runtime: {
          ...npc.runtime,
          status: "idle" as const,
          blockedTicks: newBlockedTicks,
          destination: shouldReroute ? null : explicitDestination,
        },
      });
      continue;
    }

    occupied.add(nextKey);
    const nextStatus: NpcRuntimeState["status"] = arrived ? "idle" : "moving";

    nextNpcs.push({
      ...npc,
      runtime: {
        ...npc.runtime,
        position: nextPosition,
        destination: explicitDestination && !arrived ? explicitDestination : null,
        targetZoneId: resolveTargetZoneId(npc, explicitDestination, destination, state.zones),
        status: nextStatus,
        blockedTicks: 0,
      },
    });
  }

  return {
    ...state,
    tick: nextTick,
    worldTime: nextWorldTime,
    weather: nextWeather,
    npcs: state.activeConversationId
      ? nextNpcs
      : findApproachTarget(state, nextNpcs, nextTick),
  };
}

// Scans all free NPC pairs for two that are physically adjacent (distance ≤ 1)
// and whose interaction cooldown has expired. Returns the first match as an
// InteractionCandidate, or null if no pair qualifies.
export function findInteractionCandidate(state: DemoState): InteractionCandidate | null {
  const available = state.npcs.filter((npc) => npc.runtime.status !== "in_conversation");

  for (let i = 0; i < available.length; i += 1) {
    for (let j = i + 1; j < available.length; j += 1) {
      const first = available[i];
      const second = available[j];
      const sameZone = getZoneForPosition(first.runtime.position, state.zones)?.id ===
        getZoneForPosition(second.runtime.position, state.zones)?.id;
      const closeEnough = distance(first.runtime.position, second.runtime.position) <= 1;
      const cooldownExpired =
        state.tick - Math.max(first.runtime.lastInteractionTick, second.runtime.lastInteractionTick) >= INTERACTION_COOLDOWN_TICKS;

      // Only trigger when physically adjacent — NPCs must have walked up to each other first.
      if (closeEnough && cooldownExpired) {
        return {
          participantIds: [first.profile.id, second.profile.id],
          reason: sameZone ? "SAME_ZONE" : "PROXIMITY",
          zoneId: getZoneForPosition(first.runtime.position, state.zones)?.id ?? null,
        };
      }
    }
  }

  return null;
}

// Redirects one NPC from an eligible same-zone pair to walk toward the other so
// they end up adjacent and can trigger a conversation.
function findApproachTarget(state: DemoState, nextNpcs: NpcState[], tick: number): NpcState[] {
  const available = nextNpcs.filter((npc) => npc.runtime.status !== "in_conversation");

  for (let i = 0; i < available.length; i += 1) {
    for (let j = i + 1; j < available.length; j += 1) {
      const first = available[i];
      const second = available[j];

      const firstZone = getZoneForPosition(first.runtime.position, state.zones);
      const secondZone = getZoneForPosition(second.runtime.position, state.zones);

      if (!firstZone || firstZone.id !== secondZone?.id) continue;

      const dist = distance(first.runtime.position, second.runtime.position);
      if (dist <= 1) continue;

      const cooldownExpired =
        tick - Math.max(first.runtime.lastInteractionTick, second.runtime.lastInteractionTick) >= INTERACTION_COOLDOWN_TICKS;

      if (!cooldownExpired) continue;

      // Don't redirect an NPC that recently finished a conversation — it should
      // stay near its current partner long enough for a follow-up to trigger.
      const firstRecentlyTalked = tick - first.runtime.lastInteractionTick < INTERACTION_COOLDOWN_TICKS;
      const secondRecentlyTalked = tick - second.runtime.lastInteractionTick < INTERACTION_COOLDOWN_TICKS;
      if (firstRecentlyTalked || secondRecentlyTalked) continue;

      // Direct the first NPC toward the second's current position.
      // The soft-block bypass in advanceDemoState lets the NPC reach distance=1,
      // where it gets hard-blocked until findInteractionCandidate picks them up.
      return nextNpcs.map((npc) => {
        if (npc.profile.id !== first.profile.id) return npc;
        return {
          ...npc,
          runtime: {
            ...npc.runtime,
            destination: second.runtime.position,
            blockedTicks: 0,
          },
        };
      });
    }
  }

  return nextNpcs;
}

// Hardcoded demo trigger: forces Tom and Henry into a market rivalry conversation
// regardless of their positions or cooldown state. Used for scripted demos.
export function createScriptedInteraction(state: DemoState, reason: InteractionReason): InteractionCandidate | null {
  const first = state.npcs.find((npc) => npc.profile.id === "npc_tom");
  const second = state.npcs.find((npc) => npc.profile.id === "npc_henri");

  if (!first || !second) {
    return null;
  }

  return {
    participantIds: [first.profile.id, second.profile.id],
    reason,
    zoneId: getZoneForPosition(first.runtime.position, state.zones)?.id ?? null,
  };
}

// Opens a new conversation: creates a "generating" ConversationRecord, sets both
// participant NPCs to "in_conversation" status, and stores the conversation ID as active.
export function startInteraction(state: DemoState, candidate: InteractionCandidate): DemoState {
  const [firstId, secondId] = candidate.participantIds;
  const first = getNpcById(state, firstId);
  const second = getNpcById(state, secondId);

  if (!first || !second) {
    return state;
  }

  const conversationId = `conv_${state.tick}_${firstId}_${secondId}`;
  const startedAt = toIsoTimestamp(state.worldTime);

  const pendingRecord: ConversationRecord = {
    id: conversationId,
    participantIds: candidate.participantIds,
    participantNames: [first.profile.name, second.profile.name],
    reason: candidate.reason,
    zoneId: candidate.zoneId,
    status: "generating",
    generatedTurnCount: 0,
    turns: [],
    updates: [],
    summary: `${first.profile.name} and ${second.profile.name} started a conversation.`,
    startedAt,
    startedAtMs: Date.now(),
  };

  return {
    ...state,
    activeConversationId: conversationId,
    conversations: [pendingRecord, ...state.conversations].slice(0, 20),
    npcs: state.npcs.map((npc) => {
      if (candidate.participantIds.includes(npc.profile.id)) {
        return {
          ...npc,
          runtime: {
            ...npc.runtime,
            status: "in_conversation",
          },
        };
      }

      return npc;
    }),
  };
}

// Completes the active conversation: generates dialogue via buildConversation,
// stamps the record as "completed", applies all character updates to the NPC states,
// and appends a summary log line with timing and LLM update counts.
export function finishInteraction(
  state: DemoState,
  candidate: InteractionCandidate,
): DemoState {
  const [firstId, secondId] = candidate.participantIds;
  const first = getNpcById(state, firstId);
  const second = getNpcById(state, secondId);

  if (!first || !second) {
    return reconcileConversationRuntime(state);
  }

  if (!state.activeConversationId) {
    return reconcileConversationRuntime(state);
  }

  const endedAtMs = Date.now();
  const wallTime = formatTimestamp(new Date(endedAtMs));
  const dialogue = buildConversation(first, second, state, candidate, wallTime);
  const completedAt = toIsoTimestamp(state.worldTime);

  return {
    ...state,
    activeConversationId: null,
    conversations: state.conversations.map((conversation) => {
      if (conversation.id !== state.activeConversationId) {
        return conversation;
      }

      return {
        ...conversation,
        status: "completed",
        generatedTurnCount: dialogue.turns.length,
        turns: dialogue.turns,
        updates: dialogue.updates,
        summary: dialogue.summary,
        endedAt: completedAt,
        endedAtMs,
      };
    }),
    npcs: applyConversationUpdates(state.npcs, dialogue.updates, state.tick, state.zones),
    recentOverrides: registerOverrideEvents(state.recentOverrides, dialogue.updates, state.tick),
  };
}

// Stamps an active conversation as completed using pre-computed dialogue (e.g. from the
// AnimalTalkingEngine), applies all character updates, and appends override events.
// Use this in async flows where dialogue is built outside of the setState updater.
export function finishInteractionWithDialogue(
  state: DemoState,
  candidate: InteractionCandidate,
  dialogue: { turns: DialogueTurn[]; updates: CharacterUpdate[]; summary: string },
): DemoState {
  if (!state.activeConversationId) {
    return reconcileConversationRuntime(state);
  }

  const endedAtMs = Date.now();
  const completedAt = toIsoTimestamp(state.worldTime);

  return {
    ...state,
    activeConversationId: null,
    conversations: state.conversations.map((conversation) => {
      if (conversation.id !== state.activeConversationId) {
        return conversation;
      }
      return {
        ...conversation,
        status: "completed" as const,
        generatedTurnCount: dialogue.turns.length,
        turns: dialogue.turns,
        updates: dialogue.updates,
        summary: dialogue.summary,
        endedAt: completedAt,
        endedAtMs,
      };
    }),
    npcs: applyConversationUpdates(state.npcs, dialogue.updates, state.tick, state.zones),
    recentOverrides: registerOverrideEvents(state.recentOverrides, dialogue.updates, state.tick),
  };
}

// Deterministically generates four dialogue turns and all associated CharacterUpdates
// for a pair of NPCs. The fake "LLM" provider picks lines from per-character template
// pools selected by a hashed seed (same inputs → same output, no real LLM call).
export function buildConversation(
  first: NpcState,
  second: NpcState,
  state: DemoState,
  candidate: InteractionCandidate,
  wallTime: string,
): {
  turns: DialogueTurn[];
  updates: CharacterUpdate[];
  summary: string;
} {
  const pairTone = candidate.reason === "SAME_ZONE" ? "shared the same spot" : "met by chance";
  const location = candidate.zoneId ? getZoneById(state.zones, candidate.zoneId)?.name ?? "the street" : "the street";
  const timeLabel = `${state.worldTime.hour.toString().padStart(2, "0")}:${state.worldTime.minute
    .toString()
    .padStart(2, "0")}`;
  const weatherText = formatWeather(state.weather);
  const firstMood = moodFromContext(first.profile.role, state.weather, state.worldTime.hour);
  const secondMood = moodFromContext(second.profile.role, state.weather, state.worldTime.hour);
  const firstObjective = objectiveForConversation(first, state, candidate.zoneId);
  const secondObjective = objectiveForConversation(second, state, candidate.zoneId);
  const lines = [
    `${first.profile.name}: ${openingLine(first, second, location, weatherText, timeLabel)}`,
    `${second.profile.name}: ${responseLine(second, first, location, weatherText)}`,
    `${first.profile.name}: ${followUpLine(first, second, state.worldTime, candidate.zoneId)}`,
    `${second.profile.name}: ${closingLine(second, first, firstObjective, secondObjective)}`,
  ];

  const now = toIsoTimestamp(state.worldTime);
  const ts = wallTime;

  const turns: DialogueTurn[] = lines.map((line, index) => {
    const [speakerName, message] = line.split(": ", 2);
    const speaker = index % 2 === 0 ? first : second;

    return {
      index,
      speakerId: speaker.profile.id,
      speakerName,
      message,
      mood: index % 2 === 0 ? firstMood : secondMood,
      createdAt: now,
    };
  });

  const firstRelationship = relationAfterConversation(first, second, candidate.reason);
  const secondRelationship = relationAfterConversation(second, first, candidate.reason);
  const firstMemory = `${first.profile.name} and ${second.profile.name} ${pairTone} at ${location} around ${timeLabel}.`;
  const secondMemory = `${second.profile.name} and ${first.profile.name} ${pairTone} at ${location} around ${timeLabel}.`;

  const updates: CharacterUpdate[] = [
    {
      type: "UPDATE_MOOD",
      characterId: first.profile.id,
      mood: firstMood,
      note: `${first.profile.name}: mood → ${firstMood}`,
      source: "LLM_PACKAGE",
      timestamp: ts,
    },
    {
      type: "UPDATE_MOOD",
      characterId: second.profile.id,
      mood: secondMood,
      note: `${second.profile.name}: mood → ${secondMood}`,
      source: "LLM_PACKAGE",
      timestamp: ts,
    },
    {
      type: "ADD_MEMORY",
      characterId: first.profile.id,
      memory: firstMemory,
      note: `${first.profile.name}: memory → "${firstMemory}"`,
      source: "LLM_PACKAGE",
      timestamp: ts,
    },
    {
      type: "ADD_MEMORY",
      characterId: second.profile.id,
      memory: secondMemory,
      note: `${second.profile.name}: memory → "${secondMemory}"`,
      source: "LLM_PACKAGE",
      timestamp: ts,
    },
    {
      type: "UPDATE_RELATIONSHIP",
      characterId: first.profile.id,
      targetCharacterId: second.profile.id,
      relationship: firstRelationship,
      note: `${first.profile.name} → ${second.profile.name}: relation → ${firstRelationship}`,
      source: "CLASSIC_ENGINE",
      timestamp: ts,
    },
    {
      type: "UPDATE_RELATIONSHIP",
      characterId: second.profile.id,
      targetCharacterId: first.profile.id,
      relationship: secondRelationship,
      note: `${second.profile.name} → ${first.profile.name}: relation → ${secondRelationship}`,
      source: "CLASSIC_ENGINE",
      timestamp: ts,
    },
    {
      type: "UPDATE_OBJECTIVE",
      characterId: first.profile.id,
      objective: firstObjective,
      note: `${first.profile.name}: goal → ${firstObjective.label}`,
      source: "CLASSIC_ENGINE",
      timestamp: ts,
    },
    {
      type: "UPDATE_OBJECTIVE",
      characterId: second.profile.id,
      objective: secondObjective,
      note: `${second.profile.name}: goal → ${secondObjective.label}`,
      source: "CLASSIC_ENGINE",
      timestamp: ts,
    },
  ];

  return {
    turns,
    updates,
    summary: `${first.profile.name} and ${second.profile.name} talked at ${location} under ${weatherText.toLowerCase()} weather.`,
  };
}

// Applies a batch of CharacterUpdates (mood, objective, memory, relationship) to the
// matching NPCs and returns the updated array. NPCs not referenced by any update are
// returned unchanged. Also releases any NPC still marked in_conversation.
export function applyConversationUpdates(
  npcs: NpcState[],
  updates: CharacterUpdate[],
  tick: number,
  zones: WorldZone[],
): NpcState[] {
  return npcs.map((npc) => {
    const npcUpdates = updates.filter((update) => update.characterId === npc.profile.id);

    if (npcUpdates.length === 0) {
      return npc;
    }

    let nextRuntime = { ...npc.runtime };
    let nextRelationships = { ...npc.relationships };
    const nextMemories = [...npc.memories];

    for (const update of npcUpdates) {
      if (update.type === "UPDATE_MOOD") {
        nextRuntime = { ...nextRuntime, mood: update.mood };
      }

      if (update.type === "UPDATE_OBJECTIVE") {
        nextRuntime = {
          ...nextRuntime,
          objective: update.objective,
          destination: null,
          targetZoneId:
            update.objective.type === "GO_TO_LOCATION" ? update.objective.targetZoneId : null,
          status: "idle",
        };
      }

      if (update.type === "ADD_MEMORY") {
        nextMemories.unshift(update.memory);
        nextRuntime = {
          ...nextRuntime,
          shortHistory: [update.memory, ...nextRuntime.shortHistory].slice(0, 5),
          lastInteractionTick: tick,
        };
      }

      if (update.type === "UPDATE_RELATIONSHIP") {
        nextRelationships = {
          ...nextRelationships,
          [update.targetCharacterId]: update.relationship,
        };
      }
    }

    if (npcUpdates.length > 0 && nextRuntime.status === "in_conversation") {
      nextRuntime = {
        ...nextRuntime,
        status: "idle",
        destination: null,
      };
    }

    return {
      ...npc,
      runtime: nextRuntime,
      relationships: nextRelationships,
      memories: nextMemories.slice(0, 10),
    };
  });
}

export function formatObjective(objective: NpcObjective | null): string {
  if (!objective) {
    return "None";
  }

  return objective.type === "GO_TO_LOCATION" ? `${objective.label} (${objective.targetZoneId})` : objective.label;
}

export function formatWorldTime(time: WorldTime): string {
  return `Day ${time.day}, ${time.hour.toString().padStart(2, "0")}:${time.minute
    .toString()
    .padStart(2, "0")}:${time.second.toString().padStart(2, "0")}`;
}

export function formatRelationship(value: RelationshipType): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function getNpcById(state: DemoState, id: string): NpcState | undefined {
  return state.npcs.find((npc) => npc.profile.id === id);
}

export function getZoneById(zones: WorldZone[], id: string): WorldZone | undefined {
  return zones.find((zone) => zone.id === id);
}

export function getZoneForPosition(position: Position, zones: WorldZone[]): WorldZone | undefined {
  return zones.find((zone) => isPositionInsideZone(position, zone));
}

export function isPositionInsideZone(position: Position, zone: WorldZone): boolean {
  return (
    position.x >= zone.topLeft.x &&
    position.x <= zone.bottomRight.x &&
    position.y >= zone.topLeft.y &&
    position.y <= zone.bottomRight.y
  );
}

// Returns the center cell of a zone, used as the pathfinding target when an NPC
// needs to navigate toward that zone.
export function zoneCenter(zone: WorldZone): Position {
  return {
    x: Math.floor((zone.topLeft.x + zone.bottomRight.x) / 2),
    y: Math.floor((zone.topLeft.y + zone.bottomRight.y) / 2),
  };
}

export function getGridWidth(): number {
  return GRID_WIDTH;
}

export function getGridHeight(): number {
  return GRID_HEIGHT;
}

export function getDemoProfiles(): NpcProfile[] {
  return NPC_PROFILES;
}

// Merges a persisted NPC snapshot with the latest static profile from NPC_PROFILES.
// Prevents stale lore, goal text, or missing fields from a previous localStorage version
// from carrying over into the running simulation.
export function hydrateNpcProfile(savedNpc: NpcState): NpcState {
  const profile = NPC_PROFILES.find((entry) => entry.id === savedNpc.profile.id) ?? savedNpc.profile;
  const seedMemories = [
    `Lives a quiet routine around the ${profile.preferredZoneId}.`,
    `Known for being ${profile.personality[0]}.`,
  ];
  const conversationMemories = savedNpc.memories.filter(
    (memory) => !memory.startsWith("Lives a quiet routine around the ") && !memory.startsWith("Known for being "),
  );

  return {
    ...savedNpc,
    profile,
    memories: [...seedMemories, ...conversationMemories].slice(0, 10),
    runtime: {
      ...savedNpc.runtime,
      blockedTicks: savedNpc.runtime.blockedTicks ?? 0,
      shortHistory: savedNpc.runtime.shortHistory.map((entry) =>
        entry.startsWith("Current goal: ") || entry.startsWith("Current hobby: ")
          ? `Current hobby: ${profile.hobbies[0]}.`
          : entry.startsWith("Started the day in ")
            ? `Started the day in ${profile.preferredZoneId}.`
            : entry,
      ),
    },
  };
}

// Returns the center of the NPC's target zone as a pathfinding destination.
// Returns null if the NPC is already in the target zone or has no GO_TO_LOCATION objective.
function resolveObjectiveDestination(
  npc: NpcState,
  zones: WorldZone[],
  currentZone: WorldZone | undefined,
): Position | null {
  const objective = npc.runtime.objective;

  if (!objective || objective.type === "IDLE") {
    return null;
  }

  if (currentZone?.id === objective.targetZoneId) {
    return null;
  }

  const targetZone = getZoneById(zones, objective.targetZoneId);
  if (!targetZone) {
    return null;
  }

  return zoneCenter(targetZone);
}

// Determines the zone ID the NPC is currently heading toward, used to display
// the target zone indicator in the UI. Prefers the NPC's own objective zone;
// falls back to whichever zone contains the explicit destination cell.
function resolveTargetZoneId(
  npc: NpcState,
  explicitDestination: Position | null,
  destination: Position,
  zones: WorldZone[],
): string | null {
  if (npc.runtime.objective?.type === "GO_TO_LOCATION") {
    return npc.runtime.objective.targetZoneId;
  }

  if (explicitDestination) {
    return getZoneForPosition(destination, zones)?.id ?? null;
  }

  return null;
}

// Returns true when the NPC has "arrived" at its destination.
// For explicit destinations (approaching another NPC): adjacency (distance ≤ 1) counts as arrival
// when the cell is occupied, exact match otherwise.
// For zone objectives: arrival is confirmed when the NPC steps inside the target zone.
function hasReachedDestination(
  position: Position,
  destination: Position,
  destinationIsOccupied: boolean,
  objective: NpcObjective | null,
  explicitDestination: Position | null,
  zones: WorldZone[],
): boolean {
  if (explicitDestination) {
    return destinationIsOccupied
      ? distance(position, destination) <= 1
      : positionsEqual(position, destination);
  }

  if (objective?.type === "GO_TO_LOCATION") {
    return getZoneForPosition(position, zones)?.id === objective.targetZoneId;
  }

  return positionsEqual(position, destination);
}

function chooseUnblockMove(
  current: Position,
  blockedStep: Position,
  occupied: Set<string>,
  softBlocked: Set<string>,
  destinationIsOccupied: boolean,
  blockedTicks: number,
): Position | null {
  const forward = {
    x: blockedStep.x - current.x,
    y: blockedStep.y - current.y,
  };

  // Lateral candidates only — no "back" here.  Going back resets blockedTicks
  // to 0 and causes the NPC to try the same blocked route again next tick,
  // producing an infinite oscillation.  Staying put (returning null) is safer:
  // blockedTicks keeps climbing until the reroute threshold is reached.
  const laterals: Position[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  const tryOrder: Position[] = [];
  for (const delta of laterals) {
    if (delta.x === forward.x && delta.y === forward.y) {
      continue;
    }

    tryOrder.push(delta);
  }

  const start = blockedTicks % tryOrder.length;
  const ordered = [...tryOrder.slice(start), ...tryOrder.slice(0, start)];

  for (const delta of ordered) {
    const next = { x: current.x + delta.x, y: current.y + delta.y };

    if (next.x < 0 || next.x >= GRID_WIDTH || next.y < 0 || next.y >= GRID_HEIGHT) {
      continue;
    }

    const key = positionKey(next);
    if (occupied.has(key)) {
      continue;
    }

    if (softBlocked.has(key) && !destinationIsOccupied) {
      continue;
    }

    return next;
  }

  return null;
}

function pickWanderCell(
  npc: NpcState,
  zone: WorldZone | undefined,
  occupied: Set<string>,
  tick: number,
  npcIndex: number,
): Position | null {
  if (!zone) return null;
  if ((tick + npcIndex) % WANDER_INTERVAL !== 0) return null;

  const { x, y } = npc.runtime.position;
  const seed = hashString(`${npc.profile.id}:${tick}`);

  const candidates: Position[] = [];
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    const inside =
      nx >= zone.topLeft.x &&
      nx <= zone.bottomRight.x &&
      ny >= zone.topLeft.y &&
      ny <= zone.bottomRight.y;
    const key = positionKey({ x: nx, y: ny });

    if (inside && !occupied.has(key)) {
      candidates.push({ x: nx, y: ny });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[seed % candidates.length];
}

function stepToward(current: Position, destination: Position): Position {
  if (current.x !== destination.x) {
    return { x: moveAxis(current.x, destination.x), y: current.y };
  }

  if (current.y !== destination.y) {
    return { x: current.x, y: moveAxis(current.y, destination.y) };
  }

  return current;
}

function moveAxis(current: number, destination: number): number {
  if (current < destination) {
    return current + 1;
  }

  if (current > destination) {
    return current - 1;
  }

  return current;
}

function positionsEqual(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

function distance(first: Position, second: Position): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

// Advances the in-world clock by a fixed number of seconds, correctly wrapping
// seconds → minutes → hours → days.
function advanceWorldTime(time: WorldTime, seconds: number): WorldTime {
  const totalSeconds =
    time.day * 24 * 60 * 60 + time.hour * 60 * 60 + time.minute * 60 + time.second + seconds;
  const day = Math.floor(totalSeconds / (24 * 60 * 60));
  const remainder = totalSeconds % (24 * 60 * 60);

  return {
    day,
    hour: Math.floor(remainder / 3600),
    minute: Math.floor((remainder % 3600) / 60),
    second: remainder % 60,
  };
}

export function formatWeather(weather: Weather): string {
  switch (weather) {
    case "SUNNY":
      return "Sunny";
    case "CLOUDY":
      return "Cloudy";
    case "RAINY":
      return "Rainy";
    case "STORMY":
      return "Stormy";
  }
}

// Converts a WorldTime into an ISO 8601 string anchored on a hardcoded date.
// Used as the createdAt / startedAt / endedAt value in conversation records.
function toIsoTimestamp(time: WorldTime): string {
  const day = time.day.toString().padStart(2, "0");
  const hour = time.hour.toString().padStart(2, "0");
  const minute = time.minute.toString().padStart(2, "0");
  const second = time.second.toString().padStart(2, "0");

  return `2026-06-${day}T${hour}:${minute}:${second}.000Z`;
}

// Formats a real wall-clock Date as DDMMYY:HHMMSS (e.g. 170626:155800).
export function formatTimestamp(date: Date): string {
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const yy = date.getFullYear().toString().slice(-2);
  const hh = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${mm}/${dd}/${yy} ${hh}:${min}:${ss}`;
}

// Deterministically picks one entry from a template array using a string-hashed seed.
// Same seed → same pick every time, making dialogue fully reproducible.
function pickTemplate<T>(seed: string, templates: T[]): T {
  return templates[hashString(seed) % templates.length];
}

// Simple polynomial rolling hash (djb2-like) producing a stable 32-bit unsigned integer.
// Used exclusively for deterministic template selection — not suitable for cryptographic use.
function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

// Maps a raw personality trait adjective (e.g. "observant") into a first-person
// conversational phrase (e.g. "noticing the details") for use inside dialogue lines.
function personalityCue(profile: NpcProfile): string {
  const cue = profile.personality[hashString(profile.id) % profile.personality.length];

  switch (cue) {
    case "observant":
      return "noticing the details";
    case "polite":
      return "keeping the conversation gentle";
    case "curious":
      return "asking better questions";
    case "calm":
      return "taking things slowly";
    case "patient":
      return "giving the moment room to breathe";
    case "practical":
      return "getting to the useful part";
    case "restless":
      return "moving before the moment goes stale";
    case "quick":
      return "cutting straight to the point";
    case "friendly":
      return "making room for a warm exchange";
    case "precise":
      return "keeping the facts straight";
    case "dry":
      return "adding a sharp edge";
    case "focused":
      return "staying on task";
    case "warm":
      return "making it feel welcoming";
    case "chatty":
      return "filling the silence easily";
    case "generous":
      return "offering more than asked";
    case "alert":
      return "watching for what might matter";
    case "steady":
      return "keeping the pace even";
    case "protective":
      return "keeping an eye on everyone";
    case "thoughtful":
      return "thinking before speaking";
    case "soft-spoken":
      return "keeping the tone low";
    case "methodical":
      return "sorting ideas one by one";
    case "expressive":
      return "letting the feeling show";
    case "playful":
      return "keeping things light";
    case "improvising":
      return "letting the moment decide";
    case "welcoming":
      return "making people feel at home";
    case "business-minded":
      return "always closing the loop";
    case "blunt":
      return "saying exactly what I think";
    case "theatrical":
      return "turning every sentence into a performance";
    case "judgmental":
      return "weighing everything and finding it lacking";
    default:
      return "staying in character";
  }
}

// Generates the first line of the conversation (speaker = first NPC).
// Delegates to a per-character template pool and picks deterministically via seed.
function openingLine(
  first: NpcState,
  second: NpcState,
  location: string,
  weather: string,
  timeLabel: string,
): string {
  const idea = first.profile.hobbies[0];
  const seed = `${first.profile.id}:${second.profile.id}:${location}:${weather}:${timeLabel}`;
  const templates = openingTemplatesFor(first, second, location, weather, timeLabel, idea);
  return pickTemplate(seed, templates);
}

// Generates the second line of the conversation (speaker = second NPC replying).
function responseLine(
  speaker: NpcState,
  other: NpcState,
  location: string,
  weather: string,
): string {
  const seed = `${speaker.profile.id}:${other.profile.id}:${location}:${weather}`;
  const templates = responseTemplatesFor(speaker, other, location, weather);
  return pickTemplate(seed, templates);
}

// Generates the third line of the conversation (first NPC follows up).
// Takes the time of day (morning/afternoon hint) and current zone into account.
function followUpLine(
  speaker: NpcState,
  other: NpcState,
  time: WorldTime,
  zoneId: string | null,
): string {
  const zoneText = zoneId ?? "town";
  const hourHint = time.hour < 12 ? "morning" : "afternoon";
  const seed = `${speaker.profile.id}:${other.profile.id}:${time.hour}:${zoneText}`;
  const templates = followUpTemplatesFor(speaker, other, zoneText, hourHint);
  return pickTemplate(seed, templates);
}

// Generates the fourth and final line of the conversation (second NPC wraps up).
// References both NPCs' next objectives to tie the dialogue back to their goals.
function closingLine(
  speaker: NpcState,
  other: NpcState,
  firstObjective: NpcObjective,
  secondObjective: NpcObjective,
): string {
  const speakerObjective = firstObjective.label;
  const otherObjective = secondObjective.label;
  const seed = `${speaker.profile.id}:${other.profile.id}:${speakerObjective}:${otherObjective}`;
  const templates = closingTemplatesFor(speaker, other, speakerObjective, otherObjective);
  return pickTemplate(seed, templates);
}

// Returns the pool of opening-line templates for the given speaker.
// Each NPC has unique character-specific lines; all others fall back to defaultOpeningTemplates.
function openingTemplatesFor(
  speaker: NpcState,
  other: NpcState,
  location: string,
  weather: string,
  timeLabel: string,
  idea: string,
): string[] {
  switch (speaker.profile.id) {
    case "npc_antoine":
      return [
        `Oh, splendid. ${other.profile.name} in ${location}. The day was going perfectly until now.`,
        `Do you mind? I was mid-monologue. ${location} at ${timeLabel} is barely tolerable without visitors.`,
        `Let me guess — you need something. Everyone who finds me at ${timeLabel} needs something.`,
        `I was about to ${idea.toLowerCase()}, and then you appeared like a plot twist nobody asked for.`,
        `Congratulations. You have ruined my favorite corner of ${location} simply by standing in it.`,
      ];
    case "npc_rosie":
      return [
        `Oh, ${other.profile.name}! What a lovely surprise here in ${location}. The ${weather.toLowerCase()} weather makes everything feel warmer.`,
        `Perfect timing — I was just thinking about ${idea.toLowerCase()} and you always bring good news.`,
        `Look who wandered into ${location}! Come closer, I saved you a spot and probably a story.`,
      ];
    case "npc_henri":
      return [
        `You're blocking the light. ...Fine. What broke this time?`,
        `${location} at ${timeLabel}. Not my favorite place to talk, but the machine can wait.`,
        `If this is about ${idea.toLowerCase()}, make it quick. I have tools that need judging.`,
      ];
    case "npc_tom":
      return [
        `Good timing — ${location} is busy at ${timeLabel} and I could use a familiar face.`,
        `I was restocking mentally and physically. ${other.profile.name} showing up here feels like good business.`,
      ];
    case "npc_ben":
      return [
        `Quiet morning in ${location}. I was checking on things — ${idea.toLowerCase()} can wait a minute.`,
        `${other.profile.name}, nice to see you. The ${weather.toLowerCase()} weather keeps the park honest.`,
      ];
    case "npc_celia":
      return [
        `Ha! ${other.profile.name}! I was just sweeping ${location} for news and you walked right into the story.`,
        `You picked the best moment — ${location} always gets interesting around ${timeLabel}.`,
      ];
    case "npc_jeff":
      return [
        `Heads up — stay on the safe side in ${location}. What brings you through here at ${timeLabel}?`,
        `Good to see a friendly face. I was on patrol, but ${other.profile.name} is worth a pause.`,
      ];
    case "npc_quentin":
      return [
        `Perfect acoustics in ${location} today! ${other.profile.name}, you have stage timing.`,
        `I was hunting for a crowd and found you instead. Honestly? Better material.`,
      ];
    default:
      return defaultOpeningTemplates(speaker, other, location, weather, timeLabel, idea);
  }
}

// Returns the pool of response-line templates for the given speaker.
function responseTemplatesFor(
  speaker: NpcState,
  other: NpcState,
  location: string,
  weather: string,
): string[] {
  const personality = personalityCue(speaker.profile);

  switch (speaker.profile.id) {
    case "npc_antoine":
      return [
        `Fine. Talk. But if this gets boring, I am walking away and you can explain yourself to the shelves.`,
        `I am ${personality}, which means I will remember every ridiculous thing you say and quote it later.`,
        `${other.profile.name}, your timing is awful and your weather small talk is worse. I am still listening. Barely.`,
        `Don't flatter yourself — ${location} is not improved by your presence. I am simply too dramatic to ignore you.`,
        `Keep going. I already dislike this conversation, and that usually means it will be memorable.`,
      ];
    case "npc_rosie":
      return [
        `Oh, I love that! ${location} feels cozier already. Stay a while — I am ${personality} when the day allows it.`,
        `You always make ${other.profile.name} sound interesting. The ${weather.toLowerCase()} weather is no match for good company.`,
        `Absolutely. I was hoping for exactly this kind of chat near ${location}.`,
      ];
    case "npc_henri":
      return [
        `Mm. Acceptable. I am ${personality}, so say what you mean and skip the poetry.`,
        `Fine. ${location} is as good a place as any. Just don't touch anything that looks important.`,
        `${other.profile.name} usually makes sense. That already puts this above most conversations.`,
      ];
    case "npc_quentin":
      return [
        `Yes! That has rhythm. I am ${personality}, so let's turn this corner of ${location} into something worth hearing.`,
        `Say that again — it might be the hook for my next set.`,
      ];
    default:
      return [
        `That works for me. I am ${personality}, and ${location} gives me enough room to think clearly.`,
        `I can stay a while. ${other.profile.name} usually has something worth hearing, and today feels like one of those days.`,
        `Sure. The ${weather.toLowerCase()} weather changes the pace, but it also makes this corner of ${location} easier to read.`,
        `I like this better than the usual routine. ${personality} is easier when the day is this quiet.`,
        `You picked the right moment. I was already halfway into my own thoughts, so ${location} feels almost intentional.`,
      ];
  }
}

// Returns the pool of follow-up-line templates for the given speaker.
function followUpTemplatesFor(
  speaker: NpcState,
  other: NpcState,
  zoneText: string,
  hourHint: string,
): string[] {
  const idea = speaker.profile.hobbies[0];

  switch (speaker.profile.id) {
    case "npc_antoine":
      return [
        `Keep going. I was going to ${idea.toLowerCase()} anyway, and your presence is already ruining it beautifully.`,
        `If we continue, I will miss my ${hourHint} plans around ${zoneText}. Worth it, if only to judge you more thoroughly.`,
        `Fine. Bend my schedule around ${zoneText}. I am too petty to walk away mid-insult.`,
      ];
    case "npc_rosie":
      return [
        `I can shuffle my ${hourHint} baking around ${zoneText}. Good talk beats a perfect schedule.`,
        `Stay near ${zoneText} a little longer — ${other.profile.name} always leaves me in a better mood.`,
      ];
    case "npc_celia":
      return [
        `Wait — that detail matters. I can delay my ${hourHint} sweep around ${zoneText} for this.`,
        `If we keep talking, I might actually get a headline out of ${zoneText} today.`,
      ];
    default:
      return [
        `If we keep talking, I can reshuffle my ${hourHint} plans around ${zoneText}.`,
        `I should probably make room for this in my ${hourHint}. ${other.profile.name}'s schedule matters more than mine right now.`,
        `Maybe this is the useful part of the day. I can adjust what comes next if we stay near ${zoneText}.`,
        `That gives me something to work with. I will bend my ${hourHint} around ${zoneText} and see what changes.`,
        `I am fine with that. A small pause here could save us both a longer detour later.`,
      ];
  }
}

// Returns the pool of closing-line templates for the given speaker.
function closingTemplatesFor(
  speaker: NpcState,
  other: NpcState,
  speakerObjective: string,
  otherObjective: string,
): string[] {
  switch (speaker.profile.id) {
    case "npc_antoine":
      return [
        `Good. Go handle ${otherObjective}. I have ${speakerObjective} and a reputation for cruelty to maintain.`,
        `Agreed, if only to end this before you get sentimental. Do not make me regret tolerating you.`,
        `Fine. ${other.profile.name} can chase ${otherObjective}. I will return to ${speakerObjective} and pretend this never happened.`,
      ];
    case "npc_rosie":
      return [
        `That sounds lovely. I will keep ${speakerObjective} in mind — and save something sweet for ${other.profile.name} next time.`,
        `Deal! ${otherObjective} for you, ${speakerObjective} for me, and maybe another chat soon.`,
      ];
    case "npc_henri":
      return [
        `Acceptable. ${speakerObjective} is waiting, and ${other.profile.name} can manage ${otherObjective} without my supervision.`,
        `Right. Back to work. Try not to break anything before I see you again.`,
      ];
    case "npc_quentin":
      return [
        `Perfect ending note! I am off to ${speakerObjective}, and ${other.profile.name} can chase ${otherObjective} on beat.`,
        `That gave me a chorus. Go do ${otherObjective} — I have ${speakerObjective} and a crowd to find.`,
      ];
    default:
      return [
        `That sounds fair. I will keep ${speakerObjective} in mind, and I will remember how ${other.profile.name} is handling ${otherObjective}.`,
        `Good enough for now. ${speakerObjective} is still on my list, but this conversation changed the order a little.`,
        `I can work with that. ${other.profile.name} balancing ${otherObjective} tells me more than a long speech would have.`,
        `Agreed. I will take ${speakerObjective} seriously, and I will not forget this little exchange with ${other.profile.name}.`,
        `Then we are set. I have ${speakerObjective} to return to, and you have ${otherObjective} waiting for you.`,
      ];
  }
}

// Generic opening-line templates used for any NPC that doesn't have dedicated lines.
function defaultOpeningTemplates(
  speaker: NpcState,
  other: NpcState,
  location: string,
  weather: string,
  timeLabel: string,
  idea: string,
): string[] {
  return [
    `Funny running into you here. ${location} has a completely different mood at ${timeLabel}, especially with ${weather.toLowerCase()} skies overhead.`,
    `I was not expecting a detour like this. ${location} tends to reveal a different side of people when the day turns ${weather.toLowerCase()}.`,
    `You always seem to show up at the interesting moment. I was just thinking about ${idea}, and then ${location} felt a lot less ordinary.`,
    `This is a better place for a conversation than I expected. ${location} feels unusually alive for ${timeLabel}.`,
    `Well, this is a pleasant surprise. The ${weather.toLowerCase()} weather makes ${location} feel a bit like a secret meeting spot.`,
  ];
}

// Derives an NPC mood from weather conditions and the current in-world hour.
// Stormy weather always produces BUSY; early/late hours produce CALM.
// Musician and scout roles skew EXCITED; librarian skews BUSY.
function moodFromContext(role: string, weather: Weather, hour: number): NpcMood {
  if (weather === "STORMY") {
    return "BUSY";
  }

  if (hour < 10 || hour > 18) {
    return "CALM";
  }

  if (role === "musician" || role === "scout") {
    return "EXCITED";
  }

  if (role === "librarian") {
    return "BUSY";
  }

  return "CURIOUS";
}

// Picks the post-conversation objective for an NPC.
// Prefers the zone where the conversation happened; falls back to the NPC's role default.
export function objectiveForConversation(
  npc: NpcState,
  state: DemoState,
  zoneId: string | null,
): NpcObjective {
  const base = OBJECTIVE_BY_ROLE[npc.profile.role];
  const chosenZoneId =
    zoneId ?? (base?.type === "GO_TO_LOCATION" ? base.targetZoneId : npc.profile.preferredZoneId);
  const zone = getZoneById(state.zones, chosenZoneId) ?? getZoneById(state.zones, npc.profile.preferredZoneId);

  if (!zone) {
    return {
      type: "IDLE",
      label: "Take a break",
    };
  }

  return {
    type: "GO_TO_LOCATION",
    targetZoneId: zone.id,
    label: `Head to ${zone.name}`,
  };
}

// Determines the relationship to assign after a conversation ends.
// Conflict pairs keep (or worsen) negative arcs; friendly pairs still warm up over time.
function relationAfterConversation(
  source: NpcState,
  target: NpcState,
  reason: InteractionReason,
): RelationshipType {
  const current = source.relationships[target.profile.id] ?? "STRANGER";

  if (isConflictPair(source.profile.id, target.profile.id)) {
    if (current === "DISLIKED" && reason === "SAME_ZONE") {
      return "RIVAL";
    }

    if (current === "RIVAL" && reason === "SAME_ZONE") {
      return "RIVAL";
    }

    return current;
  }

  if (reason === "SAME_ZONE") {
    return "FRIEND";
  }

  if (source.profile.role === "scout" && target.profile.role === "mechanic") {
    return "FRIEND";
  }

  return current === "STRANGER" ? "FRIEND" : current;
}

// Converts the CharacterUpdates from a finished conversation into OverrideEvent records
// and prepends them to the recent overrides list (capped at 40 entries) for the debug UI.
function registerOverrideEvents(
  existing: OverrideEvent[],
  updates: CharacterUpdate[],
  tick: number,
): OverrideEvent[] {
  const nextEvents = updates.map((update, index) => ({
    id: `${tick}-${update.characterId}-${update.type}-${index}`,
    tick,
    characterId: update.characterId,
    type: update.type,
    source: update.source,
    note: update.note,
    timestamp: update.timestamp,
  }));

  return [...nextEvents, ...existing].slice(0, 40);
}

// Derives the latest update source per NPC field from completed conversations.
// Used by the data-page profile cards to colour runtime fields blue (Classic) or violet (LLM).
export function buildNpcFieldSources(
  npcId: string,
  conversations: ConversationRecord[],
): NpcFieldSources {
  const result: NpcFieldSources = {
    mood: null,
    objective: null,
    memories: {},
    relationships: {},
  };

  for (const conversation of conversations) {
    if (conversation.status !== "completed") {
      continue;
    }

    for (const update of conversation.updates) {
      if (update.characterId !== npcId) {
        continue;
      }

      switch (update.type) {
        case "UPDATE_MOOD":
          result.mood = update.source;
          break;
        case "UPDATE_OBJECTIVE":
          result.objective = update.source;
          break;
        case "ADD_MEMORY":
          result.memories[update.memory] = update.source;
          break;
        case "UPDATE_RELATIONSHIP":
          result.relationships[update.targetCharacterId] = update.source;
          break;
      }
    }
  }

  return result;
}

