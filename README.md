# Stardew-like WeChat Mini Program

A farming simulation game inspired by Stardew Valley, built for WeChat Mini Program platform.

## Tech Stack

- **Platform:** WeChat Mini Program
- **Game Engine:** Custom (lightweight, pixel-art friendly)
- **Rendering:** Canvas 2D

## Project Structure

```
stardew-wechat/
├── src/
│   ├── core/           # Game loop, renderer, input
│   ├── systems/        # Farming, inventory, time, NPC
│   ├── data/          # Item definitions, tile configs
│   └── utils/         # Helpers
├── assets/
│   ├── tiles/         # Environment sprites
│   ├── characters/    # Player & NPC sprites
│   ├── items/        # Tools, seeds, crops
│   └── ui/           # Menus, icons
├── pages/
│   └── game/         # Main game page
├── app.js
├── app.json
└── project.config.json
```

## Core Systems

- [x] Grid-based tile map
- [x] Day/season time system
- [ ] Inventory management
- [ ] Farming mechanics (till → plant → water → harvest)
- [ ] Save/load

## Getting Started

1. Clone repo
2. Open in WeChat DevTools
3. Run in simulator

## Assets

Place pixel art sprites in `assets/` folder. Target: 32x32 tiles, character sprites 16x32.
