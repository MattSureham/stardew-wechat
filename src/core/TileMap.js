/**
 * TileMap - Grid-based world system
 * Each tile stores: type, state, crop, hydration, decoration
 */

const {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TILE_TYPES,
  MAX_HYDRATION, HYDRATION_DECAY_PER_DAY, MAX_GROWTH
} = require('../utils/Constants');

const { ITEMS } = require('../data/items');

class TileMap {
  constructor(width = MAP_WIDTH, height = MAP_HEIGHT) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.init();
  }

  init() {
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = this.createTile(TILE_TYPES.GRASS);
      }
    }
  }

  createTile(type = TILE_TYPES.GRASS) {
    return {
      type,
      crop: null,       // { itemId, growth, growDays, daysGrown, regrows, fertilized }
      hydration: 0,     // 0-100
      decoration: null, // fence, path, etc.
      forage: null      // seasonal forageable item
    };
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.tiles[y][x];
  }

  setTileType(x, y, type) {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.type = type;
      return true;
    }
    return false;
  }

  /**
   * Till grass into farmland.
   * @returns {boolean} True if successful
   */
  till(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.type === TILE_TYPES.GRASS) {
      tile.type = TILE_TYPES.TILLED;
      return true;
    }
    return false;
  }

  /**
   * Plant a seed on tilled soil.
   * @param {string} seedId - e.g., 'parsnip_seed'
   * @returns {boolean} True if planted
   */
  plant(x, y, seedId) {
    const tile = this.getTile(x, y);
    const seedDef = ITEMS[seedId];

    if (!tile || !seedDef) return false;
    if (tile.type !== TILE_TYPES.TILLED) return false;
    if (tile.crop) return false;

    tile.crop = {
      itemId: seedId,
      growth: 0,                    // 0-100 percentage
      growDays: seedDef.growDays || 4,
      daysGrown: 0,
      regrows: seedDef.regrows || false,
      fertilized: false
    };
    return true;
  }

  /**
   * Water a tilled tile, boosting hydration.
   * @returns {boolean} True if watered
   */
  water(x, y) {
    const tile = this.getTile(x, y);
    if (tile && (tile.type === TILE_TYPES.TILLED || tile.type === TILE_TYPES.WATERED)) {
      tile.type = TILE_TYPES.WATERED;
      tile.hydration = MAX_HYDRATION;
      return true;
    }
    return false;
  }

  /**
   * Harvest a mature crop.
   * @returns {string|null} The harvested crop item ID, or null
   */
  harvest(x, y) {
    const tile = this.getTile(x, y);
    if (!tile || !tile.crop || tile.crop.growth < MAX_GROWTH) return null;

    const crop = tile.crop;
    const seedDef = ITEMS[crop.itemId];
    // Derive the harvested item: e.g., 'parsnip_seed' → 'parsnip'
    const harvestItem = seedDef ? crop.itemId.replace('_seed', '') : crop.itemId;

    if (crop.regrows) {
      // Regrowable crops reset to half growth
      crop.daysGrown = Math.floor(crop.growDays / 2);
      crop.growth = Math.floor((crop.daysGrown / crop.growDays) * MAX_GROWTH);
      tile.type = TILE_TYPES.TILLED;
    } else {
      // Single-harvest crops: clear and return to tilled
      tile.crop = null;
      tile.type = TILE_TYPES.TILLED;
    }

    return harvestItem;
  }

  /**
   * Apply fertilizer to a tile with a growing crop.
   * @returns {boolean} True if fertilized
   */
  fertilize(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.crop && !tile.crop.fertilized) {
      tile.crop.fertilized = true;
      return true;
    }
    return false;
  }

  /**
   * Place or remove a fence.
   */
  toggleFence(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return false;

    if (tile.decoration === TILE_TYPES.FENCE) {
      tile.decoration = null;
    } else if (tile.type === TILE_TYPES.GRASS || tile.type === TILE_TYPES.TILLED) {
      tile.decoration = TILE_TYPES.FENCE;
    }
    return true;
  }

  /**
   * Clear an obstacle (boulder/stump) — requires pickaxe.
   * @returns {boolean} True if cleared
   */
  clearObstacle(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.type === TILE_TYPES.OBSTACLE) {
      tile.type = TILE_TYPES.GRASS;
      return true;
    }
    return false;
  }

  /**
   * Pick up a forageable item from a tile.
   * @returns {string|null} Forage item ID or null
   */
  pickupForage(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.forage) {
      const item = tile.forage;
      tile.forage = null;
      return item;
    }
    return null;
  }

  /**
   * Place a forageable item on a grass tile.
   */
  placeForage(x, y, itemId) {
    const tile = this.getTile(x, y);
    if (tile && tile.type === TILE_TYPES.GRASS && !tile.forage && !tile.crop) {
      tile.forage = itemId;
      return true;
    }
    return false;
  }

  // ==================== DAILY CYCLE ====================

  /**
   * Called at the start of each new day.
   * - Dries out watered tiles
   * - Decays hydration
   * - Grows crops (if watered)
   * @param {boolean} isRaining - If true, auto-waters everything
   */
  newDay(isRaining = false) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];

        // Rain waters all tilled and already-watered tiles
        if (isRaining && (tile.type === TILE_TYPES.TILLED || tile.type === TILE_TYPES.WATERED)) {
          tile.type = TILE_TYPES.WATERED;
          tile.hydration = MAX_HYDRATION;
          continue;
        }

        // Dry out: watered → tilled (only when not raining)
        if (tile.type === TILE_TYPES.WATERED) {
          tile.type = TILE_TYPES.TILLED;
        }

        // Hydration decay
        if (tile.hydration > 0) {
          tile.hydration = Math.max(0, tile.hydration - HYDRATION_DECAY_PER_DAY);
        }

        // Crop growth: only grows if tile was hydrated
        if (tile.crop && tile.hydration > 0) {
          tile.crop.daysGrown += 1;
          // Fertilizer gives 25% faster growth
          const effectiveGrowDays = tile.crop.fertilized
            ? Math.max(1, Math.floor(tile.crop.growDays * 0.75))
            : tile.crop.growDays;
          tile.crop.growth = Math.min(MAX_GROWTH,
            Math.floor((tile.crop.daysGrown / effectiveGrowDays) * MAX_GROWTH)
          );
        }
      }
    }
  }

  // ==================== SERIALIZATION ====================

  serialize() {
    // Deep-copy the tiles to avoid mutation issues
    const tilesCopy = this.tiles.map(row =>
      row.map(tile => ({
        type: tile.type,
        crop: tile.crop ? { ...tile.crop } : null,
        hydration: tile.hydration,
        decoration: tile.decoration,
        forage: tile.forage
      }))
    );
    return {
      width: this.width,
      height: this.height,
      tiles: tilesCopy
    };
  }

  static deserialize(data) {
    const map = new TileMap(data.width, data.height);
    map.tiles = data.tiles;
    return map;
  }
}

// Re-export constants from shared module for backward compatibility
module.exports = { TileMap, TILE_TYPES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT };
