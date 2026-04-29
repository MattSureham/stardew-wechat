/**
 * GameState - Main game controller
 * Coordinates TileMap, TimeSystem, and Inventory
 */

const { TileMap, TILE_TYPES } = require('./TileMap');
const { TimeSystem } = require('./TimeSystem');
const { Inventory } = require('../systems/Inventory');

class GameState {
  constructor() {
    this.tileMap = new TileMap();
    this.timeSystem = new TimeSystem();
    this.inventory = new Inventory();
    
    // Player position
    this.playerX = 10;
    this.playerY = 7;
    
    // Current action
    this.currentAction = null; // 'till', 'plant', 'water', 'harvest'
    this.actionTarget = null;  // { x, y }
    
    // Game loop
    this.running = false;
    this.lastUpdate = 0;
    
    // Set up time listener for new day
    this.timeSystem.addListener((event) => {
      if (event === 'newDay') {
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

  onNewDay() {
    // Grow crops, dry out soil
    this.tileMap.newDay();
  }

  // Player movement
  movePlayer(dx, dy) {
    const newX = this.playerX + dx;
    const newY = this.playerY + dy;
    
    const tile = this.tileMap.getTile(newX, newY);
    if (tile && tile.type !== TILE_TYPES.WATER) {
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

  performAction() {
    if (!this.currentAction) return;
    
    const x = this.playerX;
    const y = this.playerY;
    
    switch (this.currentAction) {
      case 'till':
        this.tileMap.till(x, y);
        break;
      case 'plant':
        const seed = this.inventory.getSelectedItem();
        if (seed && seed.startsWith('_seed')) {
          if (this.tileMap.plant(x, y, seed)) {
            this.inventory.removeItem(seed, 1);
          }
        }
        break;
      case 'water':
        this.tileMap.water(x, y);
        break;
      case 'harvest':
        const crop = this.tileMap.harvest(x, y);
        if (crop) {
          // Convert seed to crop item
          const cropItem = crop.replace('_seed', '');
          this.inventory.addItem(cropItem, 1);
        }
        break;
    }
  }

  // Interact with tile player is facing
  interact() {
    const tile = this.tileMap.getTile(this.playerX, this.playerY);
    
    if (tile.crop && tile.crop.growth >= 100) {
      // Auto-harvest if crop is ready
      this.setAction('harvest');
      this.performAction();
    }
  }

  // Get data for rendering
  getRenderData() {
    return {
      tiles: this.tileMap.tiles,
      playerX: this.playerX,
      playerY: this.playerY,
      time: this.timeSystem.getTimeString(),
      date: this.timeSystem.getDateString(),
      money: this.inventory.getMoney(),
      selectedItem: this.inventory.getSelectedItem(),
      dayProgress: this.timeSystem.dayProgress
    };
  }

  // Save/Load
  serialize() {
    return {
      tileMap: this.tileMap.serialize(),
      timeSystem: this.timeSystem.serialize(),
      inventory: this.inventory.serialize(),
      playerX: this.playerX,
      playerY: this.playerY
    };
  }

  static deserialize(data) {
    const game = new GameState();
    game.tileMap = TileMap.deserialize(data.tileMap);
    game.timeSystem = TimeSystem.deserialize(data.timeSystem);
    game.inventory = Inventory.deserialize(data.inventory);
    game.playerX = data.playerX;
    game.playerY = data.playerY;
    return game;
  }
}

module.exports = { GameState };
