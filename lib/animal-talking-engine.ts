// Bridge between the demo simulation and the animal-talking-core package.
//
// All prompts, dialogue lines, and LLM JSON use English only — no translation layer.
//
// Flow://  1. Convert NpcState → TalkingCharacter (package input type).
//  2. Build a mock LlmProvider that returns template-generated dialogue in the
//     exact JSON shape the package validator expects.
//  3. Run AnimalTalkingEngine.runInteraction() so the real PromptBuilder fires,
//     the provider is called with the built prompt, and the response is validated.
//  4. Convert the validated InteractionResult back to the demo's CharacterUpdate /
//     DialogueTurn types and add CLASSIC_ENGINE objective updates.

import {
  AnimalTalkingEngine,
  RelationshipType,
  type LlmProvider,
  type Mood,
  type StartInteractionInput,
  type TalkingCharacter,
} from "animal-talking-core";

import {
  buildInteractionNotes,
  conflictIdeaFor,
  getConflictPair,
} from "./conflict-pairs";
import {
  buildConversation,
  formatTimestamp,
  formatWeather,
  getZoneById,
  objectiveForConversation,
  type CharacterUpdate,
  type DemoState,
  type DialogueTurn,
  type InteractionCandidate,
  type NpcMood,
  type NpcState,
  type RelationshipType as DemoRelationshipType,
} from "./demo-state";

// ─── Mood mapping ─────────────────────────────────────────────────────────────

function demoMoodToPackageMood(demoMood: NpcMood): Mood {
  switch (demoMood) {
    case "CALM":    return "NEUTRAL";
    case "CURIOUS": return "CURIOUS";
    case "BUSY":    return "ANXIOUS";
    case "EXCITED": return "HAPPY";
  }
}

function packageMoodToDemoMood(packageMood: string): NpcMood {
  switch (packageMood) {
    case "HAPPY":   return "EXCITED";
    case "CURIOUS": return "CURIOUS";
    case "ANXIOUS": return "BUSY";
    case "ANGRY":   return "BUSY";
    default:        return "CALM"; // NEUTRAL, SAD, unknown
  }
}

// ─── NPC → TalkingCharacter ───────────────────────────────────────────────────

function npcToTalkingCharacter(npc: NpcState, otherId: string): TalkingCharacter {
  const relString = npc.relationships[otherId] ?? "STRANGER";
  // The package RelationshipType enum values equal the demo string union values.
  const packageRel = relString as unknown as RelationshipType;
  const conflict = getConflictPair(npc.profile.id, otherId);
  const conflictIdea = conflictIdeaFor(npc.profile.id, otherId);
  const historyParts = [
    `Known for being ${npc.profile.personality.join(", ")}.`,
    ...npc.runtime.shortHistory.slice(0, 3),
    ...npc.memories.slice(0, 2),
  ];

  if (conflict) {
    historyParts.push(conflict.notes);
  }

  return {
    id: npc.profile.id,
    name: npc.profile.name,
    role: npc.profile.role,
    personalityTraits: npc.profile.personality,
    goals: npc.profile.hobbies,
    speakingStyle: npc.profile.personality.slice(0, 2).join(" and "),
    talkingState: {
      idea: conflictIdea ?? npc.profile.hobbies[0] ?? "explore",
      objective: null,
      history: historyParts.join(" "),
      mood: demoMoodToPackageMood(npc.runtime.mood),
      knowledge: {
        [otherId]: {
          targetCharacterId: otherId,
          memories: npc.memories.slice(0, 3).map((content, i) => ({
            id: `mem_${i}`,
            content,
            createdAt: new Date().toISOString(),
          })),
          relationship: packageRel,
        },
      },
      activeGoals: [],
    },
  };
}

// ─── Mock LLM response builder ────────────────────────────────────────────────
//
// The provider receives the real prompt built by PromptBuilder but ignores it —
// instead it returns a pre-built JSON based on the deterministic template engine.
// This keeps the demo self-contained while exercising the full package pipeline.

function buildMockLlmJson(
  first: NpcState,
  second: NpcState,
  state: DemoState,
  candidate: InteractionCandidate,
  wallTime: string,
): string {
  const dialogue = buildConversation(first, second, state, candidate, wallTime);

  // Turns: only index / speakerId / message / mood (exact keys the validator allows)
  const turns = dialogue.turns.map((t) => ({
    index: t.index,
    speakerId: t.speakerId,
    message: t.message,
    mood: demoMoodToPackageMood(t.mood ?? "CALM"),
  }));

  const pairTone = candidate.reason === "SAME_ZONE" ? "shared the same spot" : "met by chance";
  const location = candidate.zoneId
    ? (getZoneById(state.zones, candidate.zoneId)?.name ?? "the street")
    : "the street";
  const timeLabel = `${state.worldTime.hour.toString().padStart(2, "0")}:${state.worldTime.minute
    .toString()
    .padStart(2, "0")}`;

  const firstMemory = `${first.profile.name} and ${second.profile.name} ${pairTone} at ${location} around ${timeLabel}.`;
  const secondMemory = `${second.profile.name} and ${first.profile.name} ${pairTone} at ${location} around ${timeLabel}.`;

  // Extract mood and relationship from the demo's buildConversation result
  const firstMoodUp  = dialogue.updates.find((u) => u.type === "UPDATE_MOOD" && u.characterId === first.profile.id) as Extract<CharacterUpdate, { type: "UPDATE_MOOD" }> | undefined;
  const secondMoodUp = dialogue.updates.find((u) => u.type === "UPDATE_MOOD" && u.characterId === second.profile.id) as Extract<CharacterUpdate, { type: "UPDATE_MOOD" }> | undefined;
  const firstRelUp   = dialogue.updates.find((u) => u.type === "UPDATE_RELATIONSHIP" && u.characterId === first.profile.id) as Extract<CharacterUpdate, { type: "UPDATE_RELATIONSHIP" }> | undefined;
  const secondRelUp  = dialogue.updates.find((u) => u.type === "UPDATE_RELATIONSHIP" && u.characterId === second.profile.id) as Extract<CharacterUpdate, { type: "UPDATE_RELATIONSHIP" }> | undefined;

  const updates = [
    firstMoodUp  && { type: "UPDATE_MOOD", characterId: first.profile.id,  mood: demoMoodToPackageMood(firstMoodUp.mood) },
    secondMoodUp && { type: "UPDATE_MOOD", characterId: second.profile.id, mood: demoMoodToPackageMood(secondMoodUp.mood) },
    {
      type: "ADD_MEMORY",
      characterId: first.profile.id,
      targetCharacterId: second.profile.id,
      memory: { id: "", content: firstMemory, createdAt: "" },
    },
    {
      type: "ADD_MEMORY",
      characterId: second.profile.id,
      targetCharacterId: first.profile.id,
      memory: { id: "", content: secondMemory, createdAt: "" },
    },
    firstRelUp  && { type: "UPDATE_RELATIONSHIP", characterId: first.profile.id,  targetCharacterId: second.profile.id, relationship: firstRelUp.relationship },
    secondRelUp && { type: "UPDATE_RELATIONSHIP", characterId: second.profile.id, targetCharacterId: first.profile.id,  relationship: secondRelUp.relationship },
  ].filter(Boolean);

  return JSON.stringify({ turns, updates });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs one NPC interaction through the full animal-talking-core pipeline:
 * PromptBuilder → mock LlmProvider → validation → InteractionResult.
 *
 * Returns demo-compatible turns, updates, and a summary string.
 * Falls back to the deterministic template engine if the package call fails.
 */
export async function buildDemoDialogue(
  first: NpcState,
  second: NpcState,
  state: DemoState,
  candidate: InteractionCandidate,
  wallTime: string,
): Promise<{ turns: DialogueTurn[]; updates: CharacterUpdate[]; summary: string }> {
  const mockJson = buildMockLlmJson(first, second, state, candidate, wallTime);

  const mockProvider: LlmProvider = {
    async complete() {
      return { text: mockJson };
    },
  };

  const engine = new AnimalTalkingEngine({ llmProvider: mockProvider });

  const input: StartInteractionInput = {
    interactionId: `${candidate.participantIds[0]}-${candidate.participantIds[1]}-${state.tick}`,
    participants: [
      npcToTalkingCharacter(first, second.profile.id),
      npcToTalkingCharacter(second, first.profile.id),
    ],
    worldContext: {
      time: {
        day: state.worldTime.day,
        hour: state.worldTime.hour,
        minute: state.worldTime.minute,
      },
      weather: state.weather,
      zones: state.zones.map((z) => ({ id: z.id, name: z.name })),
    },
    interactionContext: {
      locationZoneId: candidate.zoneId,
      reason: candidate.reason,
      notes: buildInteractionNotes(first, second),
    },
    maxTurns: 4,
  };

  const result = await engine.runInteraction(input);

  if (result.status === "failed") {
    // Safety net: fall back to the template engine if validation fails.
    console.warn("[animal-talking-engine] Engine call failed, using template fallback.", result.error);
    return buildConversation(first, second, state, candidate, wallTime);
  }

  const location = candidate.zoneId
    ? (getZoneById(state.zones, candidate.zoneId)?.name ?? "the street")
    : "the street";
  const ts = wallTime;

  // Convert package DialogueTurn → demo DialogueTurn
  const turns: DialogueTurn[] = result.turns.map((t) => ({
    index: t.index,
    speakerId: t.speakerId,
    speakerName: t.speakerName,
    message: t.message,
    mood: t.mood ? packageMoodToDemoMood(t.mood) : "CALM",
    createdAt: t.createdAt,
  }));

  // Convert package CharacterUpdate → demo CharacterUpdate (add note / source / timestamp)
  const updates: CharacterUpdate[] = [];

  for (const update of result.updates) {
    if (update.type === "UPDATE_MOOD") {
      const demoMood = packageMoodToDemoMood(update.mood);
      const npcName = update.characterId === first.profile.id ? first.profile.name : second.profile.name;
      updates.push({
        type: "UPDATE_MOOD",
        characterId: update.characterId,
        mood: demoMood,
        note: `${npcName}: mood → ${demoMood}`,
        source: "LLM_PACKAGE",
        timestamp: ts,
      });
    } else if (update.type === "ADD_MEMORY") {
      const npcName = update.characterId === first.profile.id ? first.profile.name : second.profile.name;
      const content = update.memory.content;
      updates.push({
        type: "ADD_MEMORY",
        characterId: update.characterId,
        memory: content,
        note: `${npcName}: memory → "${content}"`,
        source: "LLM_PACKAGE",
        timestamp: ts,
      });
    } else if (update.type === "UPDATE_RELATIONSHIP") {
      const npcName   = update.characterId === first.profile.id ? first.profile.name : second.profile.name;
      const tgtName   = update.targetCharacterId === first.profile.id ? first.profile.name : second.profile.name;
      const rel       = update.relationship as unknown as DemoRelationshipType;
      updates.push({
        type: "UPDATE_RELATIONSHIP",
        characterId: update.characterId,
        targetCharacterId: update.targetCharacterId,
        relationship: rel,
        note: `${npcName} → ${tgtName}: relation → ${rel}`,
        source: "LLM_PACKAGE",
        timestamp: ts,
      });
    }
    // APPEND_HISTORY, ADD_GOAL, FULFILL_GOAL are not part of the demo's CharacterUpdate type.
  }

  // Objective updates are the demo's own logic (no label field in package's NpcObjective).
  const firstObjective  = objectiveForConversation(first, state, candidate.zoneId);
  const secondObjective = objectiveForConversation(second, state, candidate.zoneId);

  updates.push({
    type: "UPDATE_OBJECTIVE",
    characterId: first.profile.id,
    objective: firstObjective,
    note: `${first.profile.name}: goal → ${firstObjective.label}`,
    source: "CLASSIC_ENGINE",
    timestamp: ts,
  });

  updates.push({
    type: "UPDATE_OBJECTIVE",
    characterId: second.profile.id,
    objective: secondObjective,
    note: `${second.profile.name}: goal → ${secondObjective.label}`,
    source: "CLASSIC_ENGINE",
    timestamp: ts,
  });

  return {
    turns,
    updates,
    summary: `${first.profile.name} and ${second.profile.name} talked at ${location} under ${formatWeather(state.weather).toLowerCase()} weather.`,
  };
}
