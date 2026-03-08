export interface GameMap {
  id: string;
  name: string;
  type: string;
  image?: string;
}

export const maps: GameMap[] = [
  // A
  {
    id: "african-waters",
    name: "African Waters",
    type: "Water",
    image: "/maps/african-waters.png",
  },
  { id: "altai", name: "Altai", type: "Open", image: "/maps/altai.png" },
  {
    id: "ancient-spires",
    name: "Ancient Spires",
    type: "Hybrid",
    image: "/maps/ancient-spires.png",
  },
  {
    id: "archipelago",
    name: "Archipelago",
    type: "Water",
    image: "/maps/archipelago.png",
  },
  {
    id: "atacama",
    name: "Atacama",
    type: "Hybrid",
    image: "/maps/atacama.png",
  },

  // B
  { id: "baltic", name: "Baltic", type: "Hybrid", image: "/maps/baltic.png" },
  {
    id: "black-forest",
    name: "Black Forest",
    type: "Closed",
    image: "/maps/black-forest.png",
  },
  {
    id: "boulder-bay",
    name: "Boulder Bay",
    type: "Hybrid",
    image: "/maps/boulder-bay.png",
  },

  // C
  { id: "canal", name: "Canal", type: "Hybrid", image: "/maps/canal.png" },
  { id: "canyon", name: "Canyon", type: "Closed", image: "/maps/canyon.png" },
  { id: "carmel", name: "Carmel", type: "Open", image: "/maps/carmel.png" },
  {
    id: "cliffsanity",
    name: "Cliffsanity",
    type: "Closed",
    image: "/maps/cliffsanity.png",
  },
  {
    id: "cliffside",
    name: "Cliffside",
    type: "Closed",
    image: "/maps/cliffside.png",
  },
  {
    id: "confluence",
    name: "Confluence",
    type: "Hybrid",
    image: "/maps/confluence.png",
  },
  {
    id: "continental",
    name: "Continental",
    type: "Hybrid",
    image: "/maps/continental.png",
  },
  { id: "craters", name: "Craters", type: "Open", image: "/maps/craters.png" },

  // D
  {
    id: "danube-river",
    name: "Danube River",
    type: "Hybrid",
    image: "/maps/danube-river.png",
  },
  {
    id: "dry-arabia",
    name: "Dry Arabia",
    type: "Open",
    image: "/maps/dry-arabia.png",
  },
  {
    id: "dungeon",
    name: "Dungeon",
    type: "Closed",
    image: "/maps/dungeon.png",
  },

  // E
  {
    id: "enlightened-horizon",
    name: "Enlightened Horizon",
    type: "Hybrid",
    image: "/maps/enlightened-horizon.png",
  },

  // F
  {
    id: "flankwoods",
    name: "Flankwoods",
    type: "Closed",
    image: "/maps/flankwoods.png",
  },
  {
    id: "forest-ponds",
    name: "Forest Ponds",
    type: "Closed",
    image: "/maps/forest-ponds.png",
  },
  { id: "forts", name: "Forts", type: "Closed", image: "/maps/forts.png" },
  {
    id: "four-lakes",
    name: "Four Lakes",
    type: "Hybrid",
    image: "/maps/four-lakes.png",
  },
  {
    id: "french-pass",
    name: "French Pass",
    type: "Closed",
    image: "/maps/french-pass.png",
  },

  // G
  { id: "glade", name: "Glade", type: "Open", image: "/maps/glade.png" },
  {
    id: "golden-heights",
    name: "Golden Heights",
    type: "Open",
    image: "/maps/golden-heights.png",
  },
  {
    id: "golden-pit",
    name: "Golden Pit",
    type: "Hybrid",
    image: "/maps/golden-pit.png",
  },
  { id: "gorge", name: "Gorge", type: "Closed", image: "/maps/gorge.png" },

  // H
  { id: "haywire", name: "Haywire", type: "Open", image: "/maps/haywire.png" },
  {
    id: "hedgemaze",
    name: "Hedgemaze",
    type: "Closed",
    image: "/maps/hedgemaze.png",
  },
  {
    id: "hidden-valley",
    name: "Hidden Valley",
    type: "Closed",
    image: "/maps/hidden-valley.png",
  },
  {
    id: "hideout",
    name: "Hideout",
    type: "Closed",
    image: "/maps/hideout.png",
  },
  {
    id: "high-view",
    name: "High View",
    type: "Open",
    image: "/maps/high-view.png",
  },
  {
    id: "highwoods",
    name: "Highwoods",
    type: "Closed",
    image: "/maps/highwoods.png",
  },
  {
    id: "hill-and-dale",
    name: "Hill and Dale",
    type: "Open",
    image: "/maps/hill-and-dale.png",
  },
  {
    id: "himeyama",
    name: "Himeyama",
    type: "Closed",
    image: "/maps/himeyama.png",
  },

  // K
  {
    id: "king-of-the-hill",
    name: "King of the Hill",
    type: "Open",
    image: "/maps/king-of-the-hill.png",
  },

  // L
  {
    id: "lakeside",
    name: "Lakeside",
    type: "Hybrid",
    image: "/maps/lakeside.png",
  },
  {
    id: "land-megarandom",
    name: "Land MegaRandom",
    type: "Random",
    image: "/maps/land-megarandom.png",
  },
  { id: "lipany", name: "Lipany", type: "Open", image: "/maps/lipany.png" },

  // M
  {
    id: "marshland",
    name: "Marshland",
    type: "Hybrid",
    image: "/maps/marshland.png",
  },
  {
    id: "megarandom",
    name: "MegaRandom",
    type: "Random",
    image: "/maps/megarandom.png",
  },
  { id: "michi", name: "Michi", type: "Closed", image: "/maps/michi.png" },
  {
    id: "migration",
    name: "Migration",
    type: "Water",
    image: "/maps/migration.png",
  },
  {
    id: "mongolian-heights",
    name: "Mongolian Heights",
    type: "Hybrid",
    image: "/maps/mongolian-heights.png",
  },
  {
    id: "mountain-clearing",
    name: "Mountain Clearing",
    type: "Closed",
    image: "/maps/mountain-clearing.png",
  },
  {
    id: "mountain-lakes",
    name: "Mountain Lakes",
    type: "Hybrid",
    image: "/maps/mountain-lakes.png",
  },
  {
    id: "mountain-pass",
    name: "Mountain Pass",
    type: "Closed",
    image: "/maps/mountain-pass.png",
  },

  // N
  { id: "nagari", name: "Nagari", type: "Open", image: "/maps/nagari.png" },

  // O
  {
    id: "ocean-gateway",
    name: "Ocean Gateway",
    type: "Water",
    image: "/maps/ocean-gateway.png",
  },

  // P
  { id: "prairie", name: "Prairie", type: "Open", image: "/maps/prairie.png" },

  // R
  {
    id: "relic-river",
    name: "Relic River",
    type: "Hybrid",
    image: "/maps/relic-river.png",
  },
  {
    id: "rocky-river",
    name: "Rocky River",
    type: "Hybrid",
    image: "/maps/rocky-river.png",
  },
  { id: "rugged", name: "Rugged", type: "Open", image: "/maps/rugged.png" },

  // S
  {
    id: "shadow-lake",
    name: "Shadow Lake",
    type: "Hybrid",
    image: "/maps/shadow-lake.png",
  },
  { id: "socotra", name: "Socotra", type: "Open", image: "/maps/socotra.png" },
  {
    id: "sunkenlands",
    name: "Sunkenlands",
    type: "Hybrid",
    image: "/maps/sunkenlands.png",
  },

  // T
  { id: "the-pit", name: "The Pit", type: "Open", image: "/maps/the-pit.png" },
  {
    id: "thickets",
    name: "Thickets",
    type: "Closed",
    image: "/maps/thickets.png",
  },
  {
    id: "turtle-ridge",
    name: "Turtle Ridge",
    type: "Closed",
    image: "/maps/turtle-ridge.png",
  },

  // V
  {
    id: "volcanic-island",
    name: "Volcanic Island",
    type: "Water",
    image: "/maps/volcanic-island.png",
  },

  // W
  {
    id: "wasteland",
    name: "Wasteland",
    type: "Open",
    image: "/maps/wasteland.png",
  },
  {
    id: "waterholes",
    name: "Waterholes",
    type: "Hybrid",
    image: "/maps/waterholes.png",
  },
  {
    id: "waterlanes",
    name: "Waterlanes",
    type: "Hybrid",
    image: "/maps/waterlanes.png",
  },
  {
    id: "wetlands",
    name: "Wetlands",
    type: "Hybrid",
    image: "/maps/wetlands.png",
  },
];
