/**
 * items.js — Centralized item catalog
 * All item definitions in one place. Imported by Inventory, Shop, GameState.
 */

const ITEM_TYPES = {
  SEED: 'seed',
  CROP: 'crop',
  TOOL: 'tool',
  ARTIFACT: 'artifact',
  FISH: 'fish',
  FORAGE: 'forage',
  FERTILIZER: 'fertilizer'
};

const ITEMS = {
  // ==================== SEEDS ====================
  parsnip_seed:    { name: 'Parsnip Seeds',     type: ITEM_TYPES.SEED, price: 20,  season: 'Spring', growDays: 4 },
  carrot_seed:     { name: 'Carrot Seeds',      type: ITEM_TYPES.SEED, price: 30,  season: 'Spring', growDays: 3 },
  potato_seed:     { name: 'Potato Seeds',      type: ITEM_TYPES.SEED, price: 25,  season: 'Spring', growDays: 6 },
  cabbage_seed:    { name: 'Cabbage Seeds',     type: ITEM_TYPES.SEED, price: 40,  season: 'Spring', growDays: 5 },

  tomato_seed:     { name: 'Tomato Seeds',      type: ITEM_TYPES.SEED, price: 50,  season: 'Summer', growDays: 11 },
  corn_seed:       { name: 'Corn Seeds',        type: ITEM_TYPES.SEED, price: 45,  season: 'Summer', growDays: 14, regrows: true },
  pepper_seed:     { name: 'Pepper Seeds',      type: ITEM_TYPES.SEED, price: 40,  season: 'Summer', growDays: 5,  regrows: true },
  watermelon_seed: { name: 'Watermelon Seeds',  type: ITEM_TYPES.SEED, price: 80,  season: 'Summer', growDays: 12 },

  pumpkin_seed:    { name: 'Pumpkin Seeds',     type: ITEM_TYPES.SEED, price: 80,  season: 'Fall', growDays: 15 },
  eggplant_seed:   { name: 'Eggplant Seeds',    type: ITEM_TYPES.SEED, price: 35,  season: 'Fall', growDays: 7,  regrows: true },
  cranberries_seed:{ name: 'Cranberry Seeds',   type: ITEM_TYPES.SEED, price: 60,  season: 'Fall', growDays: 10, regrows: true },
  yam_seed:        { name: 'Yam Seeds',         type: ITEM_TYPES.SEED, price: 50,  season: 'Fall', growDays: 8 },

  // ==================== CROPS (harvested) ====================
  parsnip:    { name: 'Parsnip',    type: ITEM_TYPES.CROP, price: 35 },
  carrot:     { name: 'Carrot',     type: ITEM_TYPES.CROP, price: 45 },
  potato:     { name: 'Potato',     type: ITEM_TYPES.CROP, price: 40 },
  cabbage:    { name: 'Cabbage',    type: ITEM_TYPES.CROP, price: 60 },
  tomato:     { name: 'Tomato',     type: ITEM_TYPES.CROP, price: 60 },
  corn:       { name: 'Corn',       type: ITEM_TYPES.CROP, price: 55 },
  pepper:     { name: 'Pepper',     type: ITEM_TYPES.CROP, price: 50 },
  watermelon: { name: 'Watermelon', type: ITEM_TYPES.CROP, price: 120 },
  pumpkin:    { name: 'Pumpkin',    type: ITEM_TYPES.CROP, price: 120 },
  eggplant:   { name: 'Eggplant',   type: ITEM_TYPES.CROP, price: 50 },
  cranberries:{ name: 'Cranberries',type: ITEM_TYPES.CROP, price: 80 },
  yam:        { name: 'Yam',        type: ITEM_TYPES.CROP, price: 70 },

  // ==================== TOOLS ====================
  hoe:          { name: 'Hoe',          type: ITEM_TYPES.TOOL, icon: 'hoe',   tier: 1 },
  watering_can: { name: 'Watering Can', type: ITEM_TYPES.TOOL, icon: 'water', tier: 1 },
  pickaxe:      { name: 'Pickaxe',      type: ITEM_TYPES.TOOL, icon: 'pick',  tier: 1 },
  scythe:       { name: 'Scythe',       type: ITEM_TYPES.TOOL, icon: 'scythe',tier: 1 },

  // ==================== FERTILIZER ====================
  basic_fertilizer:    { name: 'Basic Fertilizer',    type: ITEM_TYPES.FERTILIZER, price: 100 },
  quality_fertilizer:  { name: 'Quality Fertilizer',  type: ITEM_TYPES.FERTILIZER, price: 150 },

  // ==================== ARTIFACTS ====================
  ancient_seed: { name: 'Ancient Seed', type: ITEM_TYPES.ARTIFACT, price: 100 },

  // ==================== FISH ====================
  sardine:  { name: 'Sardine',  type: ITEM_TYPES.FISH, price: 40 },
  trout:    { name: 'Trout',    type: ITEM_TYPES.FISH, price: 65 },
  salmon:   { name: 'Salmon',   type: ITEM_TYPES.FISH, price: 75 },

  // ==================== FORAGE ====================
  wild_horseradish: { name: 'Wild Horseradish', type: ITEM_TYPES.FORAGE, price: 50, season: 'Spring' },
  leek:             { name: 'Leek',             type: ITEM_TYPES.FORAGE, price: 60, season: 'Spring' },
  salmonberry:      { name: 'Salmonberry',      type: ITEM_TYPES.FORAGE, price: 5,  season: 'Spring' },
  grape:            { name: 'Grape',            type: ITEM_TYPES.FORAGE, price: 80, season: 'Summer' },
  common_mushroom:  { name: 'Common Mushroom',  type: ITEM_TYPES.FORAGE, price: 40, season: 'Fall' },
  hazelnut:         { name: 'Hazelnut',         type: ITEM_TYPES.FORAGE, price: 90, season: 'Fall' },
  winter_root:      { name: 'Winter Root',      type: ITEM_TYPES.FORAGE, price: 70, season: 'Winter' }
};

module.exports = { ITEMS, ITEM_TYPES };
