/**
 * TileMap - Grid-based world system
 * Each tile stores: type, state, crop, hydration
 */

const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;

const TILE_TYPES = {
  GRASS: 'grass',
  TILLED: 'tilled',
  WATERED: 'watered',
  PATH: 'path',
  WATER: 'water',
  FENCE: 'fence'
};

class TileMap {
  constructor(width = MAP_WIDTH, height = MAP_HEIGHT) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.init();
  }

  init() {
    // Initialize with grass
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
      crop: null,      // { itemId, growth, plantedDay }
      hydration: 0,    // 0-100
      decoration: null // fence, etc.
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
    }
  }

  till(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.type === TILE_TYPES.GRASS) {
      tile.type = TILE_TYPES.TILLED;
      return true;
    }
    return false;
  }

  plant(x, y, seedId) {
    const tile = this.getTile(x, y);
    if (tile && tile.type === TILE_TYPES.TILLED && !tile.crop) {
      tile.crop = {
        itemId: seedId,
        growth: 0,
        plantedDay: 0
      };
      return true;
    }
    return false;
  }

  water(x, y) {
    const tile = this.getTile(x, y);
    if (tile && (tile.type === TILE_TYPES.TILLED || tile.type === TILE_TYPES.WATERED)) {
      tile.type = TILE_TYPES.WATERED;
      tile.hydration = 100;
      return true;
    }
    return false;
  }

  harvest(x, y) {
    const tile = this.getTile(x, y);
    if (tile && tile.crop && tile.crop.growth >= 100) {
      const crop = tile.crop;
      tile.crop = null;
      tile.type = TILE_TYPES.TILLED; // Returns to tilled state
      return crop.itemId; // Return the harvested item
    }
    return null;
  }

  // Called at start of each new day
  newDay() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        
        // Dry out watered tiles
        if (tile.type === TILE_TYPES.WATERED) {
          tile.type = TILE_TYPES.TILLED;
        }
        
        // Reduce hydration
        if (tile.hydration > 0) {
          tile.hydration = Math.max(0, tile.hydration - 20);
        }
        
        // Grow crops
        if (tile.crop && tile.hydration > 0) {
          tile.crop.growth += 25; // 4 days to mature
          if (tile.crop.growth > 100) tile.crop.growth = 100;
        }
      }
    }
  }

  // Serialize for save/load
  serialize() {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles
    };
  }

  static deserialize(data) {
    const map = new TileMap(data.width, data.height);
    map.tiles = data.tiles;
    return map;
  }
}

module.exports = { TileMap, TILE_TYPES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT };
