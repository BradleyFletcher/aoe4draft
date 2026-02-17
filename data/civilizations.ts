export interface Civilization {
  id: string;
  name: string;
  description: string;
  variant?: boolean;
  expansion?: string;
  flag?: string;
}

export const civilizations: Civilization[] = [
  // Base Game (Anniversary Edition)
  {
    id: "abbasid",
    name: "Abbasid Dynasty",
    description: "Economic and technological powerhouse",
    expansion: "Base Game",
    flag: "/flags/Abbasid_Dynasty_AoE4.webp",
  },
  {
    id: "chinese",
    name: "Chinese",
    description: "Dynasty-based civilization",
    expansion: "Base Game",
    flag: "/flags/Chinese_AoE4.webp",
  },
  {
    id: "delhi",
    name: "Delhi Sultanate",
    description: "Research and elephant civilization",
    expansion: "Base Game",
    flag: "/flags/Delhi_Sultanate_AoE4.webp",
  },
  {
    id: "english",
    name: "English",
    description: "Defensive longbow civilization",
    expansion: "Base Game",
    flag: "/flags/English_AoE4.webp",
  },
  {
    id: "french",
    name: "French",
    description: "Cavalry and trade civilization",
    expansion: "Base Game",
    flag: "/flags/French_AoE4.webp",
  },
  {
    id: "hre",
    name: "Holy Roman Empire",
    description: "Religious and infantry civilization",
    expansion: "Base Game",
    flag: "/flags/HRE_AoE4.webp",
  },
  {
    id: "malians",
    name: "Malians",
    description: "Gold and cattle civilization",
    expansion: "Base Game",
    flag: "/flags/Malians_AoE4.webp",
  },
  {
    id: "mongols",
    name: "Mongols",
    description: "Mobile and aggressive civilization",
    expansion: "Base Game",
    flag: "/flags/Mongols_AoE4.webp",
  },
  {
    id: "ottomans",
    name: "Ottomans",
    description: "Gunpowder and military school civilization",
    expansion: "Base Game",
    flag: "/flags/Ottomans_AoE4.webp",
  },
  {
    id: "rus",
    name: "Rus",
    description: "Hunting and expansion civilization",
    expansion: "Base Game",
    flag: "/flags/Rus_AoE4.webp",
  },

  // The Sultans Ascend
  {
    id: "byzantines",
    name: "Byzantines",
    description: "Defensive and religious civilization",
    expansion: "The Sultans Ascend",
    flag: "/flags/Byzantines_AoE4.webp",
  },
  {
    id: "japanese",
    name: "Japanese",
    description: "Versatile feudal civilization",
    expansion: "The Sultans Ascend",
    flag: "/flags/Japanese_AoE4.webp",
  },

  // The Sultans Ascend - Variants
  {
    id: "ayyubids",
    name: "Ayyubids",
    description: "Adaptive military civilization",
    variant: true,
    expansion: "The Sultans Ascend",
    flag: "/flags/Ayyubids_AoE4.webp",
  },
  {
    id: "jeannedarc",
    name: "Jeanne d'Arc",
    description: "Hero-based French variant",
    variant: true,
    expansion: "The Sultans Ascend",
    flag: "/flags/Jeanne_d_Arc_AoE4.webp",
  },
  {
    id: "orderofthedragon",
    name: "Order of the Dragon",
    description: "Gilded units HRE variant",
    variant: true,
    expansion: "The Sultans Ascend",
    flag: "/flags/Order_of_the_Dragon_AoE4.webp",
  },
  {
    id: "zhuxi",
    name: "Zhu Xi's Legacy",
    description: "Song Dynasty Chinese variant",
    variant: true,
    expansion: "The Sultans Ascend",
    flag: "/flags/Zhu_Xis_Legacy_AoE4.webp",
  },

  // Knights of Cross and Rose DLC - Variants
  {
    id: "houseoflancaster",
    name: "House of Lancaster",
    description: "English variant with unique mechanics",
    variant: true,
    expansion: "Knights of Cross and Rose",
    flag: "/flags/House_of_Lancaster_AoE4.webp",
  },
  {
    id: "knightstemplar",
    name: "The Knights Templar",
    description: "Crusader-themed variant civilization",
    variant: true,
    expansion: "Knights of Cross and Rose",
    flag: "/flags/Knights_Templar_AoE4.webp",
  },

  // Dynasties of the East - Variants
  {
    id: "goldenhorde",
    name: "Golden Horde",
    description: "Mongol variant with horde mechanics",
    variant: true,
    expansion: "Dynasties of the East",
    flag: "/flags/Golden_Horde_AoE4.webp",
  },
  {
    id: "macedoniandynasty",
    name: "Macedonian Dynasty",
    description: "Byzantine variant civilization",
    variant: true,
    expansion: "Dynasties of the East",
    flag: "/flags/Macedonian_Dynasty_AoE4.webp",
  },
  {
    id: "sengokudaimyo",
    name: "Sengoku Daimyo",
    description: "Japanese variant with warlord mechanics",
    variant: true,
    expansion: "Dynasties of the East",
    flag: "/flags/Sengoku_Daimyo_AoE4.webp",
  },
  {
    id: "tughlaqdynasty",
    name: "Tughlaq Dynasty",
    description: "Delhi Sultanate variant civilization",
    variant: true,
    expansion: "Dynasties of the East",
    flag: "/flags/Tughlaq_Dynasty_AoE4.webp",
  },
];
