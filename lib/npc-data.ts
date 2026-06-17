// Static profiles for all hardcoded NPCs.
// These are immutable character definitions — loaded once at startup and never mutated at runtime.
// The runtime state (position, mood, relationships…) lives in NpcRuntimeState inside demo-state.ts.

// Immutable descriptor for a single NPC character.
// Everything here is authored content: name, role, personality, lore text, and portrait assets.
export interface NpcProfile {
  id: string;
  name: string;
  role: string;
  // Two-letter initials shown when the portrait image fails to load.
  monogram: string;
  portraitSrc: string;
  portraitAlt: string;
  // Ordered list of personality adjectives used to generate conversational cues.
  personality: string[];
  // High-level objectives that drive dialogue lines and post-conversation objective updates.
  goals: string[];
  // The zone this NPC gravitates toward when idle; used for initial placement and objective defaults.
  preferredZoneId: string;
  // Long-form background text displayed in the database view and referenced by the dialogue generator.
  lore: string;
}

// The eight characters that populate the demo world.
// Each entry maps to a unique zone, set of personality traits, and lore text
// used by the deterministic dialogue builder in demo-state.ts.
export const NPC_PROFILES: NpcProfile[] = [
  {
    id: "npc_tom",
    name: "Tom",
    role: "shopkeeper",
    monogram: "TM",
    portraitSrc: "/portraits/tom.png",
    portraitAlt: "Portrait of Tom, the market shopkeeper",
    personality: ["welcoming", "business-minded", "calm"],
    goals: ["keep the boutique stocked", "help residents find the right item"],
    preferredZoneId: "market",
    lore:
      "Tom runs the local boutique with a steady hand and a sharp eye for value. He remembers every regular by name, knows what they need before they ask, and treats a fair deal like a small act of friendship.",
  },
  {
    id: "npc_ben",
    name: "Ben",
    role: "gardener",
    monogram: "BE",
    portraitSrc: "/portraits/ben.png",
    portraitAlt: "Portrait of Ben, the park gardener",
    personality: ["calm", "patient", "practical"],
    goals: ["check the flower beds", "protect the park"],
    preferredZoneId: "park",
    lore:
      "Ben treats the park like a living map. He can tell which flower needs help before it wilts, which path gets muddy after rain, and which bench deserves a little extra shade.",
  },
  {
    id: "npc_celia",
    name: "Celia",
    role: "scout",
    monogram: "CE",
    portraitSrc: "/portraits/celia.png",
    portraitAlt: "Portrait of Celia, the plaza scout",
    personality: ["restless", "quick", "friendly"],
    goals: ["scan the town for useful news", "meet everyone once"],
    preferredZoneId: "plaza",
    lore:
      "Celia moves fast, collects rumors, and always comes back with the first useful clue of the day. The plaza is her beat, and she treats every overheard conversation like a lead worth following.",
  },
  {
    id: "npc_henri",
    name: "Henry",
    role: "mechanic",
    monogram: "HE",
    portraitSrc: "/portraits/henri.png",
    portraitAlt: "Portrait of Henry, the market mechanic",
    personality: ["precise", "dry", "focused"],
    goals: ["inspect broken tools", "help with repairs"],
    preferredZoneId: "market",
    lore:
      "Henry repairs anything with moving parts and never trusts a machine until it has been tested twice. He speaks in short sentences, fixes problems before people finish explaining them, and considers sloppy craftsmanship a personal insult.",
  },
  {
    id: "npc_rosie",
    name: "Rosie",
    role: "baker",
    monogram: "RS",
    portraitSrc: "/portraits/rosie.png",
    portraitAlt: "Portrait of Rosie, the market baker",
    personality: ["warm", "chatty", "generous", "welcoming"],
    goals: ["restock the morning shelves", "share a fresh recipe", "make every newcomer feel at home"],
    preferredZoneId: "market",
    lore:
      "Rosie spent a decade moving from town to town before settling here, and that life taught her that connections can disappear overnight. Now she treats every person at her stall like a long-lost neighbor — she asks your name, remembers it, and always saves the best loaf for someone who looks like they need it. Her warmth is not naive; it is earned, deliberate, and utterly disarming.",
  },
  {
    id: "npc_jeff",
    name: "Jeff",
    role: "lifeguard",
    monogram: "JE",
    portraitSrc: "/portraits/jeff.png",
    portraitAlt: "Portrait of Jeff, the pond lifeguard",
    personality: ["alert", "protective", "anxious", "determined"],
    goals: ["check the pond path", "keep everyone safe", "not let his fear show"],
    preferredZoneId: "pond",
    lore:
      "Jeff almost drowned in a lake at age twelve — not dramatically, just quietly, before anyone noticed — and he has never fully made peace with deep water since. He became a lifeguard anyway, because he could not stand the idea of someone else going through it alone. He does the job with real skill and calm authority, but standing at the edge of the pond some mornings still costs him something. He will never tell you that.",
  },
  {
    id: "npc_antoine",
    name: "Antoine",
    role: "librarian",
    monogram: "AN",
    portraitSrc: "/portraits/antoine.png",
    portraitAlt: "Portrait of Antoine, the library's famously sharp-tongued keeper",
    personality: ["blunt", "theatrical", "judgmental"],
    goals: ["shame anyone talking too loud in the stacks", "correct bad takes about books in public"],
    preferredZoneId: "library",
    lore:
      "Antoine runs the library like a stage and himself like the star. He is mean on purpose, loud about it, and weirdly beloved for it — he will roast your reading taste, your posture, and your life choices in the same breath, then recommend the perfect book anyway. Silence is not a rule in his building; it is a dare.",
  },
  {
    id: "npc_quentin",
    name: "Quinn",
    role: "musician",
    monogram: "QN",
    portraitSrc: "/portraits/quentin.png",
    portraitAlt: "Portrait of Quinn, the plaza musician",
    personality: ["expressive", "playful", "charming", "sincere"],
    goals: ["find a place to perform", "lift the town mood", "make someone's day a little more interesting"],
    preferredZoneId: "plaza",
    lore:
      "Quinn has busked in eleven different towns and somewhere along the way realized that a song is really just a very polite invitation. He flirts with everyone — the baker, the mechanic, the grumpy librarian — but always gently, always with a wink and a graceful exit if the answer is not interested. He has been in love with this town for two weeks and he will tell you so, completely sincerely, without a trace of pressure. Somewhere underneath the charm is someone who knows connections do not last forever and wants to make the most of them anyway.",
  },
];
