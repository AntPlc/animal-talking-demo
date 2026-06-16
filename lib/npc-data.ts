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
    portraitAlt: "Portrait de Tom, vendeur dans sa boutique",
    personality: ["welcoming", "business-minded", "calm"],
    goals: ["keep the boutique stocked", "help residents find the right item"],
    preferredZoneId: "market",
    lore:
      "Tom runs the local boutique with a steady hand, a sharp eye for value, and a habit of helping everyone feel like a regular.",
  },
  {
    id: "npc_ben",
    name: "Ben",
    role: "gardener",
    monogram: "BE",
    portraitSrc: "/portraits/ben.png",
    portraitAlt: "Portrait de Ben, le jardinier du parc",
    personality: ["calm", "patient", "practical"],
    goals: ["check the flower beds", "protect the park"],
    preferredZoneId: "park",
    lore:
      "Ben treats the park like a living map and can tell which flower needs help before it wilts.",
  },
  {
    id: "npc_celia",
    name: "Celia",
    role: "scout",
    monogram: "CE",
    portraitSrc: "/portraits/celia.png",
    portraitAlt: "Portrait de Celia, l'exploratrice de la place",
    personality: ["restless", "quick", "friendly"],
    goals: ["scan the town for useful news", "meet everyone once"],
    preferredZoneId: "plaza",
    lore:
      "Celia moves fast, collects rumors, and always returns with the first useful clue of the day.",
  },
  {
    id: "npc_henri",
    name: "Henri",
    role: "mechanic",
    monogram: "HE",
    portraitSrc: "/portraits/henri.png",
    portraitAlt: "Portrait de Henri, le mécanicien du marché",
    personality: ["precise", "dry", "focused"],
    goals: ["inspect broken tools", "help with repairs"],
    preferredZoneId: "market",  
    lore:
      "Henri repairs anything with moving parts and never trusts a machine until it has been tested twice.",
  },
  {
    id: "npc_rosie",
    name: "Rosie",
    role: "baker",
    monogram: "RS",
    portraitSrc: "/portraits/rosie.png",
    portraitAlt: "Portrait de Rosie, la boulangere du marché",
    personality: ["warm", "chatty", "generous"],
    goals: ["restock the morning shelves", "share a fresh recipe"],
    preferredZoneId: "market",
    lore:
      "Elia feeds the whole village before sunrise and remembers who came by for bread, tea, or comfort.",
  },
  {
    id: "npc_jeff",
    name: "Jeff",
    role: "lifeguard",
    monogram: "JE",
    portraitSrc: "/portraits/jeff.png",
    portraitAlt: "Portrait de Jeff, le garde du lac",
    personality: ["alert", "steady", "protective"],
    goals: ["check the pond path", "keep everyone safe"],
    preferredZoneId: "pond",
    lore:
      "Hugo watches the pond path like a sentry and knows every safe route around the water.",
  },
  {
    id: "npc_antoine",
    name: "Antoine",
    role: "librarian",
    monogram: "AN",
    portraitSrc: "/portraits/antoine.png",
    portraitAlt: "Portrait d'Antoine, le bibliothecaire",
    personality: ["thoughtful", "soft-spoken", "methodical"],
    goals: ["sort returned books", "collect local stories"],
    preferredZoneId: "library",
    lore:
      "Antoine prefers quiet rooms and careful notes, but he remembers almost every story the village has told him.",
  },
  {
    id: "npc_quentin",
    name: "Quentin",
    role: "musician",
    monogram: "QN",
    portraitSrc: "/portraits/quentin.png",
    portraitAlt: "Portrait de Quentin, le musicien de la place",
    personality: ["expressive", "playful", "improvising"],
    goals: ["find a place to perform", "lift the town mood"],
    preferredZoneId: "plaza",
    lore:
      "Quentin turns any empty corner into a stage and can change the mood of the plaza with one song.",
  },
];
