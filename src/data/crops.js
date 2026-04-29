/**
 * crops.js — Crop growth data and season mappings.
 * Used by: TileMap (growth), GameState (season validation), Shop, Renderer (sprites).
 */

// Growth stage definitions for renderer
// Each stage maps to a growth percentage threshold
const GROWTH_STAGES = [
  { threshold: 0,   name: 'seed',     description: 'Just planted' },
  { threshold: 25,  name: 'sprout',   description: 'Tiny green shoot' },
  { threshold: 50,  name: 'growing',  description: 'Half-grown plant' },
  { threshold: 75,  name: 'flowering',description: 'Nearly ready' },
  { threshold: 100, name: 'mature',   description: 'Ready to harvest' }
];

/**
 * Get the current growth stage name for a given growth percentage (0-100).
 * @param {number} growthPercent - 0 to 100
 * @returns {string} Stage name (e.g., 'seed', 'sprout', ...)
 */
function getGrowthStage(growthPercent) {
  for (let i = GROWTH_STAGES.length - 1; i >= 0; i--) {
    if (growthPercent >= GROWTH_STAGES[i].threshold) {
      return GROWTH_STAGES[i].name;
    }
  }
  return 'seed';
}

// Seeds available per season (for shop stock and TimeSystem)
const SEEDS_BY_SEASON = {
  Spring: ['parsnip_seed', 'carrot_seed', 'potato_seed', 'cabbage_seed'],
  Summer: ['tomato_seed', 'corn_seed', 'pepper_seed', 'watermelon_seed'],
  Fall:   ['pumpkin_seed', 'eggplant_seed', 'cranberries_seed', 'yam_seed'],
  Winter: []
};

// Legacy season name mapping (for TimeSystem.getAvailableSeeds compatibility)
const SEED_NAMES_BY_SEASON = {
  Spring: ['parsnip', 'carrot', 'potato', 'cabbage'],
  Summer: ['tomato', 'corn', 'pepper', 'watermelon'],
  Fall:   ['pumpkin', 'eggplant', 'cranberries', 'yam'],
  Winter: []
};

module.exports = {
  GROWTH_STAGES,
  getGrowthStage,
  SEEDS_BY_SEASON,
  SEED_NAMES_BY_SEASON
};
