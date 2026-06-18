// Authored rivalry seeds for NPC pairs that should clash in dialogue.
// Consumed at startup (relationships, memories) and at interaction time (notes, ideas).

import type { NpcMood, NpcState, RelationshipType } from "./demo-state";

export interface ConflictPairConfig {
  ids: [string, string];
  relationship: RelationshipType;
  notes: string;
  memories: [string, string];
  shortHistory: [string, string];
  ideas: [string, string];
  mood: NpcMood;
}

export const CONFLICT_PAIRS: ConflictPairConfig[] = [
  {
    ids: ["npc_tom", "npc_henri"],
    relationship: "RIVAL",
    notes:
      "Tom and Henry have been fighting over the same market stall space for days. Prices, tool repairs, and who gets the better corner — everything is a contest.",
    memories: [
      "Henry called Tom's boutique prices a joke in front of a customer.",
      "Tom told Henry his repair bench is blocking the best foot traffic.",
    ],
    shortHistory: [
      "Still furious about Henry hogging the market corner.",
      "Still annoyed that Tom treats the stall like his personal kingdom.",
    ],
    ideas: ["defend my stall and my prices", "prove my repair work matters more than his sales"],
    mood: "BUSY",
  },
  {
    ids: ["npc_antoine", "npc_quentin"],
    relationship: "DISLIKED",
    notes:
      "Antoine has complained twice this week about Quinn's plaza music drifting into the library. Quinn thinks Antoine secretly enjoys the drama.",
    memories: [
      "Antoine shamed Quinn for 'assaulting the stacks with accordion noise.'",
      "Quinn played a love song aimed at the library window and Antoine closed every shutter.",
    ],
    shortHistory: [
      "Waiting for Quinn to play too loud again so he can make a scene.",
      "Planning a set loud enough that Antoine has to admit he heard it.",
    ],
    ideas: ["shame anyone disturbing the library", "find the perfect song to perform near the library"],
    mood: "BUSY",
  },
];

function pairKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join(":");
}

const CONFLICT_BY_KEY = new Map(
  CONFLICT_PAIRS.map((pair) => [pairKey(pair.ids[0], pair.ids[1]), pair]),
);

export function getConflictPair(
  firstId: string,
  secondId: string,
): ConflictPairConfig | undefined {
  return CONFLICT_BY_KEY.get(pairKey(firstId, secondId));
}

export function isConflictPair(firstId: string, secondId: string): boolean {
  return CONFLICT_BY_KEY.has(pairKey(firstId, secondId));
}

export function buildInteractionNotes(first: NpcState, second: NpcState): string | undefined {
  const pair = getConflictPair(first.profile.id, second.profile.id);
  if (!pair) {
    return undefined;
  }

  const weatherLine =
    first.runtime.mood === "BUSY" || second.runtime.mood === "BUSY"
      ? " Tension is high right now."
      : "";

  return `${pair.notes}${weatherLine}`;
}

export function conflictIdeaFor(npcId: string, otherId: string): string | undefined {
  const pair = getConflictPair(npcId, otherId);
  if (!pair) {
    return undefined;
  }

  const index = pair.ids[0] === npcId ? 0 : 1;
  return pair.ideas[index];
}

export function applyConflictSeeding(npcs: NpcState[]): NpcState[] {
  const byId = new Map(npcs.map((npc) => [npc.profile.id, npc]));

  for (const pair of CONFLICT_PAIRS) {
    const [firstId, secondId] = pair.ids;
    const first = byId.get(firstId);
    const second = byId.get(secondId);

    if (!first || !second) {
      continue;
    }

    byId.set(firstId, {
      ...first,
      relationships: { ...first.relationships, [secondId]: pair.relationship },
      memories: [pair.memories[0], ...first.memories],
      runtime: {
        ...first.runtime,
        mood: pair.mood,
        shortHistory: [pair.shortHistory[0], ...first.runtime.shortHistory],
      },
    });

    byId.set(secondId, {
      ...second,
      relationships: { ...second.relationships, [firstId]: pair.relationship },
      memories: [pair.memories[1], ...second.memories],
      runtime: {
        ...second.runtime,
        mood: pair.mood,
        shortHistory: [pair.shortHistory[1], ...second.runtime.shortHistory],
      },
    });
  }

  return npcs.map((npc) => byId.get(npc.profile.id) ?? npc);
}
