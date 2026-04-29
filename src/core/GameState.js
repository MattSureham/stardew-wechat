/**
 * GameState - Main game controller
 * Coordinates TileMap, TimeSystem, Inventory, EventBus, and optional systems.
 *
 * Phase 1 fixes applied:
 *   B1 - TimeSystem listener destructures payload (object, not string comparison)
 *   B2 - Save/load preserves listener chain (re-register after deserialize)
 *   B3 - onNewDay passes isRaining to TileMap
 *   B4 - EventBus created on GameState
 *   B5 - Actions target facing-tile, not player's current tile
 *   B6 - Obstacle (OBSTACLE/FENCE) tiles block movement
 *   B7 - Player facing direction stored and updated on movement
 */

const { TileMap, TILE_TYPES } = require('./TileMap');
const { TimeSystem } = require('./TimeSystem');
const { Inventory } = require('../systems/Inventory');
const { EventBus } = require('../utils/EventBus');

class GameState {
  constructor() {
    this.tileMap = new TileMap();
    this.timeSystem = new TimeSystem();
    this.inventory = new Inventory();
    this.eventBus = new EventBus();           // B4: EventBus for decoupled system events

    // Player position
    this.playerX = 10;
    this.playerY = 7;

    // Player facing direction (default: facing up)  —  B7
    this.facing = { dx: 0, dy: -1 };

    // Current action
    this.currentAction = null; // 'till', 'plant', 'water', 'harvest'
    this.actionTarget = null;  // { x, y }

    // Game loop
    this.running = false;
    this.lastUpdate = 0;

    // Optional system references (wired by page after construction)
    this.npcSystem = null;
    this.shopSystem = null;

    // Register new-day listener
    this._registerTimeListener();
  }

  /**
   * B1 FIX + B2 FIX: Register (or re-register) the newDay listener.
   * Called during construction AND after deserialization.
   */
  _registerTimeListener() {
    // Destructure payload — TimeSystem passes { event, time }, not a string
    this.timeSystem.addListener((payload) => {
      if (payload.event === 'newDay') {
        this.onNewDay();
      }
    });
  }

  start() {
    this.running = true;
    this.lastUpdate = Date.now();
  }

  stop() {
    this.running = false;
  }

  update() {
    if (!this.running) return;

    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // seconds
    this.lastUpdate = now;

    this.timeSystem.update(deltaTime);
  }

  /**
   * B3 FIX: Pass current rain state to TileMap so crops auto-water on rainy days.
   */
  onNewDay() {
    this.tileMap.newDay(this.timeSystem.isRaining);
    this.eventBus.emit('newDay', { isRaining: this.timeSystem.isRaining });
  }

  /**
   * B6 FIX + B7 FIX: Move player in a direction.
   * - Blocks WATER, OBSTACLE, and FENCE tiles
   * - Updates facing direction based on movement
   */
  movePlayer(dx, dy) {
    const newX = this.playerX + dx;
    const newY = this.playerY + dy;

    // B7: Update facing direction when moving (only if movement is non-zero)
    if (dx !== 0 || dy !== 0) {
      this.facing = { dx: Math.sign(dx), dy: Math.sign(dy) };
    }

    const tile = this.tileMap.getTile(newX, newY);
    // B6: Also block OBSTACLE tiles and tiles with FENCE decoration
    if (
      tile &&
      tile.type !== TILE_TYPES.WATER &&
      tile.type !== TILE_TYPES.OBSTACLE &&
      tile.decoration !== TILE_TYPES.FENCE
    ) {
      this.playerX = newX;
      this.playerY = newY;
      return true;
    }
    return false;
  }

  // Actions
  setAction(action) {
    this.currentAction = action;
  }

  /**
   * B5 FIX: Target the tile the player is FACING, not the tile they stand on.
   */
  performAction() {
    if (!this.currentAction) return false;

    const x = this.playerX + this.facing.dx;
    const y = this.playerY + this.facing.dy;

    let result = false;

    switch (this.currentAction) {
      case 'till':
        result = this.tileMap.till(x, y);
        break;
      case 'plant': {
        const seed = this.inventory.getSelectedItem();
        if (seed && seed.endsWith('_seed')) {
          result = this.tileMap.plant(x, y, seed);
          if (result) {
            this.inventory.removeItem(seed, 1);
          }
        }
        break;
      }
      case 'water':
        result = this.tileMap.water(x, y);
        break;
      case 'harvest': {
        const crop = this.tileMap.harvest(x, y);
        if (crop) {
          const cropItem = crop.replace('_seed', '');
          this.inventory.addItem(cropItem, 1);
          result = true;
        }
        break;
      }
    }

    return result;
  }

  /**
   * B5 FIX: Interact with the tile the player is FACING (not standing on).
   * Handles auto-harvest, forage pickup, and emits interact event for NPCs.
   */
  interact() {
    const facingX = this.playerX + this.facing.dx;
    const facingY = this.playerY + this.facing.dy;
    const tile = this.tileMap.getTile(facingX, facingY);

    if (!tile) return null;

    // Auto-harvest if crop is ready
    if (tile.crop && tile.crop.growth >= 100) {
      this.setAction('harvest');
      return this.performAction();
    }

    // Pick up forage from facing tile
    if (tile.forage) {
      const forageItem = this.tileMap.pickupForage(facingX, facingY);
      if (forageItem) {
        this.inventory.addItem(forageItem, 1);
        this.eventBus.emit('forage-collected', {
          itemId: forageItem, x: facingX, y: facingY
        });
        return forageItem;
      }
    }

    // Emit interact event for NPC dialogue (listened by NPCSystem when wired)
    this.eventBus.emit('interact', { x: facingX, y: facingY });

    return null;
  }

  // Get data for rendering
  getRenderData() {
    return {
      tiles: this.tileMap.tiles,
      playerX: this.playerX,
      playerY: this.playerY,
      facing: this.facing,
      time: this.timeSystem.getTimeString(),
      date: this.timeSystem.getDateString(),
      money: this.inventory.getMoney(),
      selectedItem: this.inventory.getSelectedItem(),
      dayProgress: this.timeSystem.dayProgress,
      // Exposed for Renderer (avoids direct TimeSystem access — B11)
      hour: this.timeSystem.hour,
      seasonIndex: this.timeSystem.seasonIndex,
      season: this.timeSystem.getSeasonName(),
      isRaining: this.timeSystem.isRaining,
      // NPCs (null-safe — set by page when NPCSystem is integrated)
      npcs: this.npcSystem ? this.npcSystem.getVisibleNPCs() : []
    };
  }

  // Save/Load
  serialize() {
    return {
      tileMap: this.tileMap.serialize(),
      timeSystem: this.timeSystem.serialize(),
      inventory: this.inventory.serialize(),
      playerX: this.playerX,
      playerY: this.playerY,
      facing: this.facing
    };
  }

  /**
   * B2 FIX: Re-register time listener after replacing timeSystem during deserialization.
   * TimeSystem.deserialize() returns a fresh instance with no listeners.
   */
  static deserialize(data) {
    const game = new GameState();
    game.tileMap = TileMap.deserialize(data.tileMap);
    // Deserialized TimeSystem has no listeners — re-register
    game.timeSystem = TimeSystem.deserialize(data.timeSystem);
    game._registerTimeListener();
    // Wire EventBus callbacks that other systems depend on
    game.eventBus = new EventBus();
    game.inventory = Inventory.deserialize(data.inventory);
    game.playerX = data.playerX;
    game.playerY = data.playerY;
    game.facing = data.facing || { dx: 0, dy: -1 };
    return game;
  }
}

module.exports = { GameState };
