// Shared demo state, simulation rules, and the fake Animal Talking provider.

import { NPC_PROFILES, type NpcProfile } from "./npc-data";

export type DemoView = "simulation" | "history" | "database";

export type Weather = "SUNNY" | "CLOUDY" | "RAINY" | "STORMY";

export type NpcMood = "CALM" | "CURIOUS" | "BUSY" | "EXCITED";

export type RelationshipType =
  | "STRANGER"
  | "FRIEND"
  | "RIVAL"
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
    }
  | {
      type: "UPDATE_OBJECTIVE";
      characterId: string;
      objective: NpcObjective;
      note: string;
    }
  | {
      type: "ADD_MEMORY";
      characterId: string;
      memory: string;
      note: string;
    }
  | {
      type: "UPDATE_RELATIONSHIP";
      characterId: string;
      targetCharacterId: string;
      relationship: RelationshipType;
      note: string;
    };

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
}

export interface PlayerState {
  id: "player";
  name: string;
  monogram: string;
  position: Position;
  lastInteractionTick: number;
}

export interface DemoState {
  tick: number;
  worldTime: WorldTime;
  weather: Weather;
  zones: WorldZone[];
  player: PlayerState;
  npcs: NpcState[];
  conversations: ConversationRecord[];
  activeConversationId: string | null;
  logs: string[];
}

export interface InteractionCandidate {
  participantIds: [string, string];
  reason: InteractionReason;
  zoneId: string | null;
}

export interface PlayerInteractionCandidate {
  npcId: string;
  reason: InteractionReason;
  zoneId: string | null;
}

const GRID_WIDTH = 12;
const GRID_HEIGHT = 8;
const PLAYER_ID = "player";

const WEATHER_SEQUENCE: Weather[] = ["SUNNY", "CLOUDY", "RAINY", "SUNNY", "STORMY"];

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

const INITIAL_POSITIONS: Record<string, Position> = {
  npc_tom: { x: 9, y: 1 },
  npc_ben: { x: 2, y: 5 },
  npc_celia: { x: 1, y: 1 },
  npc_dorian: { x: 6, y: 1 },
  npc_elia: { x: 5, y: 0 },
  npc_hugo: { x: 8, y: 6 },
  npc_iris: { x: 10, y: 0 },
  npc_jules: { x: 3, y: 4 },
};

const OBJECTIVE_BY_ROLE: Record<string, NpcObjective> = {
  curator: { type: "GO_TO_LOCATION", targetZoneId: "library", label: "Review the archive" },
  gardener: { type: "GO_TO_LOCATION", targetZoneId: "park", label: "Check the garden beds" },
  scout: { type: "GO_TO_LOCATION", targetZoneId: "plaza", label: "Gather town news" },
  mechanic: { type: "GO_TO_LOCATION", targetZoneId: "market", label: "Inspect the repair stall" },
  baker: { type: "GO_TO_LOCATION", targetZoneId: "market", label: "Restock the counter" },
  lifeguard: { type: "GO_TO_LOCATION", targetZoneId: "pond", label: "Patrol the pond path" },
  librarian: { type: "GO_TO_LOCATION", targetZoneId: "library", label: "Sort returned books" },
  musician: { type: "GO_TO_LOCATION", targetZoneId: "plaza", label: "Prepare a short set" },
};

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
        position: INITIAL_POSITIONS[profile.id],
        destination: null,
        targetZoneId: null,
        status: "idle" as const,
        mood: "CALM" as const,
        objective: OBJECTIVE_BY_ROLE[profile.role] ?? {
          type: "IDLE",
          label: "Take a quiet moment",
        },
        shortHistory: [
          `Started the day in ${profile.preferredZoneId}.`,
          `Current goal: ${profile.goals[0]}.`,
        ],
        lastInteractionTick: -100,
      },
      relationships,
      memories: [
        `Lives a quiet routine around the ${profile.preferredZoneId}.`,
        `Known for being ${profile.personality[0]}.`,
      ],
    };
  });

  return {
    tick: 0,
    worldTime: { day: 1, hour: 9, minute: 0 },
    weather: "SUNNY",
    zones: BASE_ZONES,
    player: {
      id: "player",
      name: "You",
      monogram: "YOU",
      position: { x: 1, y: 6 },
      lastInteractionTick: -100,
    },
    npcs,
    conversations: [],
    activeConversationId: null,
    logs: [
      "Demo initialized with 8 hardcoded NPCs.",
      "No LLM needed yet: the fake provider can already generate structured dialogue.",
    ],
  };
}

export function advanceDemoState(state: DemoState): DemoState {
  const nextTick = state.tick + 1;
  const nextWorldTime = advanceWorldTime(state.worldTime, 10);
  const nextWeather = WEATHER_SEQUENCE[nextTick % WEATHER_SEQUENCE.length];

  const nextNpcs = state.npcs.map((npc, index) => {
    if (npc.runtime.status === "in_conversation") {
      return npc;
    }

    const currentZone = getZoneForPosition(npc.runtime.position, state.zones);
    const destination =
      npc.runtime.destination ?? chooseDestination(npc, index, nextTick, state.zones, currentZone);

    if (!destination) {
      return {
        ...npc,
        runtime: {
          ...npc.runtime,
          status: "idle" as const,
        },
      };
    }

    const nextPosition = stepToward(npc.runtime.position, destination);
    const arrived = positionsEqual(nextPosition, destination);
    const targetZoneId = arrived ? null : getZoneForPosition(destination, state.zones)?.id ?? null;
    const nextStatus: NpcRuntimeState["status"] = arrived ? "idle" : "moving";

    return {
      ...npc,
      runtime: {
        ...npc.runtime,
        position: nextPosition,
        destination: arrived ? null : destination,
        targetZoneId,
        status: nextStatus,
      },
    };
  });

  const logs = [
    ...state.logs,
    `Tick ${nextTick}: ${nextWorldTime.hour.toString().padStart(2, "0")}:${nextWorldTime.minute
      .toString()
      .padStart(2, "0")} - weather ${nextWeather}.`,
  ].slice(-20);

  return {
    ...state,
    tick: nextTick,
    worldTime: nextWorldTime,
    weather: nextWeather,
    npcs: nextNpcs,
    logs,
  };
}

export function movePlayer(state: DemoState, direction: "up" | "down" | "left" | "right"): DemoState {
  if (state.activeConversationId) {
    return state;
  }

  const delta = playerDelta(direction);
  const nextPosition = clampPosition({
    x: state.player.position.x + delta.x,
    y: state.player.position.y + delta.y,
  });

  if (positionsEqual(nextPosition, state.player.position)) {
    return state;
  }

  return {
    ...state,
    player: {
      ...state.player,
      position: nextPosition,
    },
    logs: [`Player moved ${direction} to ${nextPosition.x},${nextPosition.y}.`, ...state.logs].slice(0, 20),
  };
}

export function findPlayerInteractionCandidate(state: DemoState): PlayerInteractionCandidate | null {
  if (state.activeConversationId) {
    return null;
  }

  const nearbyNpc = state.npcs.find((npc) => {
    if (npc.runtime.status === "in_conversation") {
      return false;
    }

    return distance(state.player.position, npc.runtime.position) <= 1;
  });

  if (!nearbyNpc) {
    return null;
  }

  if (state.tick - Math.max(state.player.lastInteractionTick, nearbyNpc.runtime.lastInteractionTick) < 4) {
    return null;
  }

  return {
    npcId: nearbyNpc.profile.id,
    reason: "PROXIMITY",
    zoneId: getZoneForPosition(state.player.position, state.zones)?.id ?? null,
  };
}

export function startPlayerInteraction(state: DemoState, candidate: PlayerInteractionCandidate): DemoState {
  const npc = getNpcById(state, candidate.npcId);

  if (!npc || state.activeConversationId) {
    return state;
  }

  const conversationId = `conv_${state.tick}_${PLAYER_ID}_${npc.profile.id}`;
  const startedAt = toIsoTimestamp(state.worldTime);
  const pendingRecord: ConversationRecord = {
    id: conversationId,
    participantIds: [PLAYER_ID, npc.profile.id],
    participantNames: ["You", npc.profile.name],
    reason: candidate.reason,
    zoneId: candidate.zoneId,
    status: "generating",
    generatedTurnCount: 0,
    turns: [],
    updates: [],
    summary: `You started a conversation with ${npc.profile.name}.`,
    startedAt,
  };

  return {
    ...state,
    activeConversationId: conversationId,
    conversations: [pendingRecord, ...state.conversations].slice(0, 20),
    npcs: state.npcs.map((nextNpc) => {
      if (nextNpc.profile.id !== candidate.npcId) {
        return nextNpc;
      }

      return {
        ...nextNpc,
        runtime: {
          ...nextNpc.runtime,
          status: "in_conversation",
        },
      };
    }),
    logs: [`Conversation ${conversationId} started with ${npc.profile.name}.`, ...state.logs].slice(0, 20),
  };
}

export function finishPlayerInteraction(state: DemoState, candidate: PlayerInteractionCandidate): DemoState {
  const npc = getNpcById(state, candidate.npcId);

  if (!npc || !state.activeConversationId) {
    return state;
  }

  const completedAt = toIsoTimestamp(state.worldTime);
  const dialogue = buildPlayerConversation(state, npc, candidate);

  return {
    ...state,
    activeConversationId: null,
    player: {
      ...state.player,
      lastInteractionTick: state.tick,
    },
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
      };
    }),
    npcs: applyConversationUpdates(state.npcs, dialogue.updates, state.tick, state.zones),
    logs: [`Conversation ${state.activeConversationId} completed.`, ...state.logs].slice(0, 20),
  };
}

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
        state.tick - Math.max(first.runtime.lastInteractionTick, second.runtime.lastInteractionTick) >= 8;

      if ((sameZone || closeEnough) && cooldownExpired) {
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

export function createScriptedInteraction(state: DemoState, reason: InteractionReason): InteractionCandidate | null {
  const first = state.npcs.find((npc) => npc.profile.id === "npc_tom");
  const second = state.npcs.find((npc) => npc.profile.id === "npc_iris");

  if (!first || !second) {
    return null;
  }

  return {
    participantIds: [first.profile.id, second.profile.id],
    reason,
    zoneId: getZoneForPosition(first.runtime.position, state.zones)?.id ?? null,
  };
}

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
    logs: [`Conversation ${conversationId} started for ${candidate.reason}.`, ...state.logs].slice(0, 20),
  };
}

export function finishInteraction(
  state: DemoState,
  candidate: InteractionCandidate,
): DemoState {
  const [firstId, secondId] = candidate.participantIds;
  const first = getNpcById(state, firstId);
  const second = getNpcById(state, secondId);

  if (!first || !second || !state.activeConversationId) {
    return state;
  }

  const dialogue = buildConversation(first, second, state, candidate);
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
      };
    }),
    npcs: applyConversationUpdates(state.npcs, dialogue.updates, state.tick, state.zones),
    logs: [`Conversation ${state.activeConversationId} completed.`, ...state.logs].slice(0, 20),
  };
}

export function buildConversation(
  first: NpcState,
  second: NpcState,
  state: DemoState,
  candidate: InteractionCandidate,
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
  const weatherText = weatherLabel(state.weather);
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

  const updates: CharacterUpdate[] = [
    {
      type: "UPDATE_MOOD",
      characterId: first.profile.id,
      mood: firstMood,
      note: `${first.profile.name} felt more ${firstMood.toLowerCase()} after the exchange.`,
    },
    {
      type: "UPDATE_MOOD",
      characterId: second.profile.id,
      mood: secondMood,
      note: `${second.profile.name} adjusted their mood after the exchange.`,
    },
    {
      type: "ADD_MEMORY",
      characterId: first.profile.id,
      memory: `${first.profile.name} and ${second.profile.name} ${pairTone} at ${location} around ${timeLabel}.`,
      note: "A new conversational memory was stored.",
    },
    {
      type: "ADD_MEMORY",
      characterId: second.profile.id,
      memory: `${second.profile.name} and ${first.profile.name} ${pairTone} at ${location} around ${timeLabel}.`,
      note: "A mirrored memory was stored.",
    },
    {
      type: "UPDATE_RELATIONSHIP",
      characterId: first.profile.id,
      targetCharacterId: second.profile.id,
      relationship: relationAfterConversation(first, second, candidate.reason),
      note: "The social relationship was adjusted.",
    },
    {
      type: "UPDATE_RELATIONSHIP",
      characterId: second.profile.id,
      targetCharacterId: first.profile.id,
      relationship: relationAfterConversation(second, first, candidate.reason),
      note: "The social relationship was adjusted symmetrically.",
    },
    {
      type: "UPDATE_OBJECTIVE",
      characterId: first.profile.id,
      objective: firstObjective,
      note: "The first participant received a new short-term objective.",
    },
    {
      type: "UPDATE_OBJECTIVE",
      characterId: second.profile.id,
      objective: secondObjective,
      note: "The second participant received a new short-term objective.",
    },
  ];

  return {
    turns,
    updates,
    summary: `${first.profile.name} and ${second.profile.name} talked at ${location} under ${weatherText.toLowerCase()} weather.`,
  };
}

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
          destination:
            update.objective.type === "GO_TO_LOCATION"
              ? zoneCenter(getZoneById(zones, update.objective.targetZoneId) ?? zones[0])
              : null,
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
  return `Day ${time.day}, ${time.hour.toString().padStart(2, "0")}:${time.minute.toString().padStart(2, "0")}`;
}

export function formatWeather(weather: Weather): string {
  return weatherLabel(weather);
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

export function hydrateNpcProfile(savedNpc: NpcState): NpcState {
  const profile = NPC_PROFILES.find((entry) => entry.id === savedNpc.profile.id) ?? savedNpc.profile;

  return {
    ...savedNpc,
    profile,
  };
}

function buildPlayerConversation(
  state: DemoState,
  npc: NpcState,
  candidate: PlayerInteractionCandidate,
): {
  turns: DialogueTurn[];
  updates: CharacterUpdate[];
  summary: string;
} {
  const location = candidate.zoneId ? getZoneById(state.zones, candidate.zoneId)?.name ?? "the town" : "the town";
  const mood = moodFromContext(npc.profile.role, state.weather, state.worldTime.hour);
  const nextObjective = objectiveForConversation(npc, state, candidate.zoneId);
  const now = toIsoTimestamp(state.worldTime);
  const seed = `${npc.profile.id}:${location}:${state.weather}:${state.worldTime.hour}`;
  const opening = pickTemplate(seed, [
    `Hi ${npc.profile.name}, got a minute near ${location}?`,
    `Hey ${npc.profile.name}, I caught you at a good time, right?`,
    `${npc.profile.name}, I was hoping to find you around ${location}.`,
    `Quick question, ${npc.profile.name}: how are things looking over here?`,
  ]);
  const response = pickTemplate(seed, [
    `Sure. I am feeling ${mood.toLowerCase()}, and I should ${nextObjective.label.toLowerCase()} soon.`,
    `Absolutely. This is one of those moments where I can slow down and focus on ${nextObjective.label.toLowerCase()}.`,
    `I can spare a minute. The day has me feeling ${mood.toLowerCase()}, which is not a bad fit for this conversation.`,
    `Of course. I was already thinking about ${nextObjective.label.toLowerCase()}, so this lines up nicely.`,
  ]);
  const closing = pickTemplate(seed, [
    "Thanks, I will keep that in mind.",
    "Good to know. I will circle back if anything changes.",
    "That helps a lot. I will leave you to it.",
    "Perfect, that gives me a better read on the day.",
  ]);

  const turns: DialogueTurn[] = [
    {
      index: 0,
      speakerId: PLAYER_ID,
      speakerName: "You",
      message: opening,
      createdAt: now,
    },
    {
      index: 1,
      speakerId: npc.profile.id,
      speakerName: npc.profile.name,
      message: response,
      mood,
      createdAt: now,
    },
    {
      index: 2,
      speakerId: PLAYER_ID,
      speakerName: "You",
      message: closing,
      createdAt: now,
    },
  ];

  const updates: CharacterUpdate[] = [
    {
      type: "UPDATE_MOOD",
      characterId: npc.profile.id,
      mood,
      note: `${npc.profile.name} adjusted mood after talking with the player.`,
    },
    {
      type: "UPDATE_OBJECTIVE",
      characterId: npc.profile.id,
      objective: nextObjective,
      note: `${npc.profile.name} refreshed their short-term objective.`,
    },
    {
      type: "ADD_MEMORY",
      characterId: npc.profile.id,
      memory: `${npc.profile.name} spoke with the player near ${location}.`,
      note: "Player conversation stored as runtime memory.",
    },
  ];

  return {
    turns,
    updates,
    summary: `You talked with ${npc.profile.name} at ${location}.`,
  };
}

function chooseDestination(
  npc: NpcState,
  index: number,
  tick: number,
  zones: WorldZone[],
  currentZone: WorldZone | undefined,
): Position | null {
  const preferredZone = getZoneById(zones, npc.profile.preferredZoneId) ?? zones[0];
  const targetZones = [preferredZone, ...zones.filter((zone) => zone.id !== preferredZone.id)];
  const targetZone = targetZones[(tick + index) % targetZones.length];

  if (currentZone?.id === targetZone.id && tick % 2 === 0) {
    return null;
  }

  return zoneCenter(targetZone);
}

function playerDelta(direction: "up" | "down" | "left" | "right"): Position {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

function clampPosition(position: Position): Position {
  return {
    x: Math.max(0, Math.min(GRID_WIDTH - 1, position.x)),
    y: Math.max(0, Math.min(GRID_HEIGHT - 1, position.y)),
  };
}

function stepToward(current: Position, destination: Position): Position {
  const nextX = moveAxis(current.x, destination.x);
  const nextY = moveAxis(current.y, destination.y);

  return {
    x: nextX,
    y: nextY,
  };
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

function distance(first: Position, second: Position): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function advanceWorldTime(time: WorldTime, minutes: number): WorldTime {
  const totalMinutes = time.day * 24 * 60 + time.hour * 60 + time.minute + minutes;
  const day = Math.floor(totalMinutes / (24 * 60));
  const remainder = totalMinutes % (24 * 60);

  return {
    day,
    hour: Math.floor(remainder / 60),
    minute: remainder % 60,
  };
}

function weatherLabel(weather: Weather): string {
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

function toIsoTimestamp(time: WorldTime): string {
  const day = time.day.toString().padStart(2, "0");
  const hour = time.hour.toString().padStart(2, "0");
  const minute = time.minute.toString().padStart(2, "0");

  return `2026-06-${day}T${hour}:${minute}:00.000Z`;
}

function pickTemplate<T>(seed: string, templates: T[]): T {
  return templates[hashString(seed) % templates.length];
}

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

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
    default:
      return "staying in character";
  }
}

function openingLine(
  first: NpcState,
  second: NpcState,
  location: string,
  weather: string,
  timeLabel: string,
): string {
  const idea = first.profile.goals[0];
  const seed = `${first.profile.id}:${second.profile.id}:${location}:${weather}:${timeLabel}`;
  return pickTemplate(seed, [
    `Funny running into you here. ${location} has a completely different mood at ${timeLabel}, especially with ${weather.toLowerCase()} skies overhead.`,
    `I was not expecting a detour like this. ${location} tends to reveal a different side of people when the day turns ${weather.toLowerCase()}.`,
    `You always seem to show up at the interesting moment. I was just thinking about ${idea}, and then ${location} felt a lot less ordinary.`,
    `This is a better place for a conversation than I expected. ${location} feels unusually alive for ${timeLabel}.`,
    `Well, this is a pleasant surprise. The ${weather.toLowerCase()} weather makes ${location} feel a bit like a secret meeting spot.`,
  ]);
}

function responseLine(
  speaker: NpcState,
  other: NpcState,
  location: string,
  weather: string,
): string {
  const seed = `${speaker.profile.id}:${other.profile.id}:${location}:${weather}`;
  const personality = personalityCue(speaker.profile);
  return pickTemplate(seed, [
    `That works for me. I am ${personality}, and ${location} gives me enough room to think clearly.`,
    `I can stay a while. ${other.profile.name} usually has something worth hearing, and today feels like one of those days.`,
    `Sure. The ${weather.toLowerCase()} weather changes the pace, but it also makes this corner of ${location} easier to read.`,
    `I like this better than the usual routine. ${personality} is easier when the day is this quiet.`,
    `You picked the right moment. I was already halfway into my own thoughts, so ${location} feels almost intentional.`,
  ]);
}

function followUpLine(
  speaker: NpcState,
  other: NpcState,
  time: WorldTime,
  zoneId: string | null,
): string {
  const zoneText = zoneId ?? "town";
  const hourHint = time.hour < 12 ? "morning" : "afternoon";
  const seed = `${speaker.profile.id}:${other.profile.id}:${time.hour}:${zoneText}`;
  return pickTemplate(seed, [
    `If we keep talking, I can reshuffle my ${hourHint} plans around ${zoneText}.`,
    `I should probably make room for this in my ${hourHint}. ${other.profile.name}'s schedule matters more than mine right now.`,
    `Maybe this is the useful part of the day. I can adjust what comes next if we stay near ${zoneText}.`,
    `That gives me something to work with. I will bend my ${hourHint} around ${zoneText} and see what changes.`,
    `I am fine with that. A small pause here could save us both a longer detour later.`,
  ]);
}

function closingLine(
  speaker: NpcState,
  other: NpcState,
  firstObjective: NpcObjective,
  secondObjective: NpcObjective,
): string {
  const speakerObjective = firstObjective.label;
  const otherObjective = secondObjective.label;
  const seed = `${speaker.profile.id}:${other.profile.id}:${speakerObjective}:${otherObjective}`;
  return pickTemplate(seed, [
    `That sounds fair. I will keep ${speakerObjective} in mind, and I will remember how ${other.profile.name} is handling ${otherObjective}.`,
    `Good enough for now. ${speakerObjective} is still on my list, but this conversation changed the order a little.`,
    `I can work with that. ${other.profile.name} balancing ${otherObjective} tells me more than a long speech would have.`,
    `Agreed. I will take ${speakerObjective} seriously, and I will not forget this little exchange with ${other.profile.name}.`,
    `Then we are set. I have ${speakerObjective} to return to, and you have ${otherObjective} waiting for you.`,
  ]);
}

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

  return "CURIOUS";
}

function objectiveForConversation(
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

function relationAfterConversation(
  source: NpcState,
  target: NpcState,
  reason: InteractionReason,
): RelationshipType {
  if (reason === "SAME_ZONE") {
    return "FRIEND";
  }

  if (source.profile.role === "scout" && target.profile.role === "mechanic") {
    return "FRIEND";
  }

  return source.relationships[target.profile.id] === "STRANGER"
    ? "FRIEND"
    : source.relationships[target.profile.id];
}

