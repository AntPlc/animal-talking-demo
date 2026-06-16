export interface NpcProfile {
  id: string;
  name: string;
  role: string;
  monogram: string;
  portraitSrc: string;
  portraitAlt: string;
  personality: string[];
  goals: string[];
  preferredZoneId: string;
  lore: string;
}

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
    personality: ["warm", "chatty", "generous"],
    goals: ["restock the morning shelves", "share a fresh recipe"],
    preferredZoneId: "market",
    lore:
      "Rosie feeds the whole village before sunrise and remembers who came by for bread, tea, or comfort. Her stall is part kitchen, part gossip hub, and she believes a warm loaf can settle almost any argument.",
  },
  {
    id: "npc_jeff",
    name: "Jeff",
    role: "lifeguard",
    monogram: "JE",
    portraitSrc: "/portraits/jeff.png",
    portraitAlt: "Portrait of Jeff, the pond lifeguard",
    personality: ["alert", "steady", "protective"],
    goals: ["check the pond path", "keep everyone safe"],
    preferredZoneId: "pond",
    lore:
      "Jeff watches the pond path like a sentry and knows every safe route around the water. He has stopped more accidents with a look than most people manage with a lecture, and he takes that responsibility seriously.",
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
    personality: ["expressive", "playful", "improvising"],
    goals: ["find a place to perform", "lift the town mood"],
    preferredZoneId: "plaza",
    lore:
      "Quinn turns any empty corner into a stage and can change the mood of the plaza with one song. He lives for the moment the crowd stops walking, starts listening, and forgets they were in a hurry.",
  },
];
