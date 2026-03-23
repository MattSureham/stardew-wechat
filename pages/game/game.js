// pages/game/game.js
const { GameState } = require('../../src/core/GameState');
const { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } = require('../../src/core/TileMap');

Page({
  data: {
    canvasWidth: MAP_WIDTH * TILE_SIZE,
    canvasHeight: MAP_HEIGHT * TILE_SIZE,
    time: '06:00',
    date: 'Year 1, Spring 1',
    money: 500,
    selectedTool: null,
    tools: [
      { id: 'till', name: '锄头', icon: '🔨' },
      { id: 'plant', name: '播种', icon: '🌱' },
      { id: 'water', name: '浇水', icon: '💧' },
      { id: 'harvest', name: '收获', icon: '🌾' }
    ]
  },

  onLoad() {
    // Initialize game
    this.game = new GameState();
    this.game.start();
    
    // Start game loop
    this.gameLoop();
    
    // Setup canvas
    this.setupCanvas();
  },

  setupCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // Set canvas size for high DPI
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        
        this.canvas = canvas;
        this.ctx = ctx;
        
        // Initial render
        this.render();
      });
  },

  gameLoop() {
    this.game.update();
    this.render();
    this.updateUI();
    
    requestAnimationFrame(() => this.gameLoop());
  },

  render() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    const { tiles, playerX, playerY } = this.game.getRenderData();
    
    // Clear canvas
    ctx.fillStyle = '#2d4a1c';
    ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
    
    // Render tiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = tiles[y][x];
        this.renderTile(ctx, x, y, tile);
      }
    }
    
    // Render player
    this.renderPlayer(ctx, playerX, playerY);
  },

  renderTile(ctx, x, y, tile) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    
    // Base tile color
    let color = '#4a7c3f'; // grass
    if (tile.type === 'tilled') color = '#5c4033';
    if (tile.type === 'watered') color = '#3d2817';
    
    ctx.fillStyle = color;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    
    // Tile border
    ctx.strokeStyle = '#3d5c2f';
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    
    // Render crop
    if (tile.crop) {
      const growth = tile.crop.growth;
      const size = (TILE_SIZE * growth) / 100;
      ctx.fillStyle = growth >= 100 ? '#ffd700' : '#90ee90';
      ctx.fillRect(px + (TILE_SIZE - size) / 2, py + (TILE_SIZE - size) / 2, size, size);
    }
    
    // Water indicator
    if (tile.hydration > 0) {
      ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  },

  renderPlayer(ctx, x, y) {
    const px = x * TILE_SIZE + 4;
    const py = y * TILE_SIZE + 4;
    
    // Simple player representation
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(px, py, TILE_SIZE - 8, TILE_SIZE - 8);
    
    // Head
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(px + 4, py + 2, TILE_SIZE - 16, TILE_SIZE - 16);
  },

  updateUI() {
    const renderData = this.game.getRenderData();
    
    this.setData({
      time: renderData.time,
      date: renderData.date,
      money: renderData.money
    });
  },

  // Controls
  onTapMove(e) {
    const { direction } = e.currentTarget.dataset;
    
    switch (direction) {
      case 'up': this.game.movePlayer(0, -1); break;
      case 'down': this.game.movePlayer(0, 1); break;
      case 'left': this.game.movePlayer(-1, 0); break;
      case 'right': this.game.movePlayer(1, 0); break;
    }
  },

  onTapAction() {
    this.game.performAction();
  },

  onTapInteract() {
    this.game.interact();
  },

  selectTool(e) {
    const { tool } = e.currentTarget.dataset;
    this.game.setAction(tool);
    this.setData({ selectedTool: tool });
  }
});
