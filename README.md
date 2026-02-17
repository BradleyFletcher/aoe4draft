# AOE4 Tournament Draft

A professional drafting tool for Age of Empires IV tournaments. This web application allows tournament organizers and players to manage civilization and map drafting with ban/pick phases.

## Features

- **Civilization Drafting**: All 16 AOE4 civilizations with descriptions
- **Map Drafting**: 26 official maps categorized by type (Open, Closed, Hybrid, Water)
- **Ban Phase**: Ban civilizations or maps before picking
- **Pick Phase**: Select civilizations for Player 1 and Player 2, or choose a map
- **Visual Feedback**: Clear indication of banned, picked, and available options
- **Modern UI**: Built with Next.js, React, TailwindCSS, and shadcn/ui components

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## How to Use

1. **Choose Mode**: Switch between Civilizations and Maps using the top buttons
2. **Ban Phase**: Click on items to ban/unban them (click again to toggle)
3. **Pick Phase**: 
   - For Civs: Select the current player (1 or 2) and click a civilization to pick
   - For Maps: Click a map to select it for the match
4. **Reset**: Use the Reset button to clear all selections and start over

## Civilizations Included

- Abbasid Dynasty
- Ayyubids
- Byzantines
- Chinese
- Delhi Sultanate
- English
- French
- Holy Roman Empire
- Japanese
- Jeanne d'Arc
- Malians
- Mongols
- Order of the Dragon
- Ottomans
- Rus
- Zhu Xi's Legacy

## Maps Included

All official AOE4 maps including Ancient Spires, Altai, Arabian, Archipelago, Baltic, Black Forest, Boulder Bay, and many more.

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
