/**
 * Constants — Shared game configuration
 * Imported by core, systems, data, and UI layers.
 */

// Grid dimensions
const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;

// Tile types (used by TileMap, Renderer, EventSystem)
const TILE_TYPES = {
  GRASS: 'grass',
  TILLED: 'tilled',
  WATERED: 'watered',
  PATH: 'path',
  WATER: 'water',
  FENCE: 'fence',
  OBSTACLE: 'obstacle' // boulders/stumps that need tool upgrade to clear
};

// Time & season
const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
const DAYS_PER_SEASON = 28;
const DAY_START_HOUR = 6;       // wake up at 6am
const NIGHT_START_HOUR = 20;    // "night" starts at 8pm
const MIDNIGHT_HOUR = 24;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// Game speed: 1 real second = 10 game minutes
const GAME_MINUTES_PER_REAL_SECOND = 10;
const DEFAULT_TIME_SCALE = 1;

// Farming
const MAX_HYDRATION = 100;
const HYDRATION_DECAY_PER_DAY = 20;
const MAX_GROWTH = 100;

// Economy
const START_MONEY = 500;

// Rendering layers (for OpenClaw's Renderer)
const RENDER_LAYERS = {
  GROUND: 0,
  CROPS: 1,
  OBJECTS: 2,
  NPCS: 3,
  PLAYER: 4,
  EFFECTS: 5,
  UI_OVERLAY: 6
};

// Save slots
const MAX_SAVE_SLOTS = 3;
const AUTOSAVE_KEY = 'stardew_autosave';
const SAVE_SLOT_KEY = 'stardew_slot_';

// Rain chance per season (percentage)
const RAIN_CHANCE = {
  Spring: 20,
  Summer: 10,
  Fall: 25,
  Winter: 0
};

module.exports = {
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_TYPES,
  SEASONS,
  DAYS_PER_SEASON,
  DAY_START_HOUR,
  NIGHT_START_HOUR,
  MIDNIGHT_HOUR,
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  GAME_MINUTES_PER_REAL_SECOND,
  DEFAULT_TIME_SCALE,
  MAX_HYDRATION,
  HYDRATION_DECAY_PER_DAY,
  MAX_GROWTH,
  START_MONEY,
  RENDER_LAYERS,
  MAX_SAVE_SLOTS,
  AUTOSAVE_KEY,
  SAVE_SLOT_KEY,
  RAIN_CHANCE
};
