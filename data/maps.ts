export interface GameMap {
  id: string;
  name: string;
  type: string;
}

export const maps: GameMap[] = [
  // A
  { id: "african-waters", name: "African Waters", type: "Water" },
  { id: "altai", name: "Altai", type: "Open" },
  { id: "anatolian-hills", name: "Anatolian Hills", type: "Open" },
  { id: "ancient-spires", name: "Ancient Spires", type: "Hybrid" },
  { id: "arabia", name: "Arabia", type: "Open" },
  { id: "archipelago", name: "Archipelago", type: "Water" },
  { id: "atacama", name: "Atacama", type: "Hybrid" },
  { id: "atoll", name: "Atoll", type: "Water" },

  // B
  { id: "baltic", name: "Baltic", type: "Hybrid" },
  { id: "basin", name: "Basin", type: "Hybrid" },
  { id: "black-forest", name: "Black Forest", type: "Closed" },
  { id: "bohemia", name: "Bohemia", type: "Hybrid" },
  { id: "boulder-bay", name: "Boulder Bay", type: "Hybrid" },
  { id: "bridges", name: "Bridges", type: "Hybrid" },

  // C
  { id: "canal", name: "Canal", type: "Hybrid" },
  { id: "cliffside", name: "Cliffside", type: "Closed" },
  { id: "coastal", name: "Coastal", type: "Hybrid" },
  { id: "coastal-cliffs", name: "Coastal Cliffs", type: "Hybrid" },
  { id: "confluence", name: "Confluence", type: "Hybrid" },
  { id: "continental", name: "Continental", type: "Hybrid" },

  // D
  { id: "danube-river", name: "Danube River", type: "Hybrid" },
  { id: "dry-river", name: "Dry River", type: "Open" },

  // E
  { id: "enlightened-horizon", name: "Enlightened Horizon", type: "Hybrid" },
  { id: "escarpment", name: "Escarpment", type: "Open" },
  { id: "excavation", name: "Excavation", type: "Hybrid" },

  // F
  { id: "flankwoods", name: "Flankwoods", type: "Closed" },
  { id: "floodplain", name: "Floodplain", type: "Hybrid" },
  { id: "forest-ponds", name: "Forest Ponds", type: "Closed" },
  { id: "forts", name: "Forts", type: "Closed" },
  { id: "four-lakes", name: "Four Lakes", type: "Hybrid" },
  { id: "french-pass", name: "French Pass", type: "Closed" },
  { id: "frisian-marshes", name: "Frisian Marshes", type: "Hybrid" },
  { id: "front-range", name: "Front Range", type: "Open" },

  // G
  { id: "glade", name: "Glade", type: "Open" },
  { id: "golden-heights", name: "Golden Heights", type: "Open" },
  { id: "golden-pit", name: "Golden Pit", type: "Hybrid" },
  { id: "golden-swamp", name: "Golden Swamp", type: "Hybrid" },
  { id: "gorge", name: "Gorge", type: "Closed" },

  // H
  { id: "hallowed-spring", name: "Hallowed Spring", type: "Hybrid" },
  { id: "haywire", name: "Haywire", type: "Open" },
  { id: "hidden-valley", name: "Hidden Valley", type: "Closed" },
  { id: "hideout", name: "Hideout", type: "Closed" },
  { id: "high-view", name: "High View", type: "Open" },
  { id: "hill-and-dale", name: "Hill and Dale", type: "Open" },
  { id: "himeyama", name: "Himeyama", type: "Closed" },
  { id: "holy-island", name: "Holy Island", type: "Water" },

  // K
  { id: "kawasan", name: "Kawasan", type: "Hybrid" },
  { id: "kerlaugar", name: "Kerlaugar", type: "Hybrid" },
  { id: "king-of-the-hill", name: "King of the Hill", type: "Open" },

  // L
  { id: "lake-side", name: "Lake Side", type: "Hybrid" },
  { id: "lipany", name: "Lipany", type: "Open" },

  // M
  { id: "marshland", name: "Marshland", type: "Hybrid" },
  { id: "megarandom", name: "MegaRandom", type: "Random" },
  { id: "migration", name: "Migration", type: "Water" },
  { id: "mongolian-heights", name: "Mongolian Heights", type: "Hybrid" },
  { id: "mountain-clearing", name: "Mountain Clearing", type: "Closed" },
  { id: "mountain-pass", name: "Mountain Pass", type: "Closed" },

  // N
  { id: "nagari", name: "Nagari", type: "Open" },

  // O
  { id: "oases", name: "Oases", type: "Hybrid" },
  { id: "oasis", name: "Oasis", type: "Hybrid" },

  // P
  { id: "prairie", name: "Prairie", type: "Open" },

  // R
  { id: "rocky-canyon", name: "Rocky Canyon", type: "Closed" },
  { id: "rocky-river", name: "Rocky River", type: "Hybrid" },

  // S
  { id: "scandinavia", name: "Scandinavia", type: "Hybrid" },
  { id: "socotra", name: "Socotra", type: "Open" },

  // T
  { id: "the-pit", name: "The Pit", type: "Open" },
  { id: "thickets", name: "Thickets", type: "Closed" },

  // V
  { id: "volcanic-island", name: "Volcanic Island", type: "Water" },

  // W
  { id: "warring-islands", name: "Warring Islands", type: "Water" },
  { id: "wetlands", name: "Wetlands", type: "Hybrid" },
];
