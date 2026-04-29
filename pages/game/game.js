/**
 * pages/game/game.js — Stardew-WeChat game page
 *
 * Changes from original:
 * - Uses src/core/Renderer.js for all canvas drawing
 * - Uses src/utils/InputManager.js for touch/swipe/long-pressive controls
 * - Fixed global requestAnimationFrame() → canvas.requestAnimationFrame()
 * - DPR scaling corrected: set physical px, scale ctx once, use logical coords
 * - setData() only called when HUD values actually change (throttled)
 * - Inventory panel toggleable via menu button
 * - Save/load hooks wired to lifecycle (onHide/onShow)
 * - EventBus integration for dialogue/shop/event popups
 */

const { GameState } = require('../../src/core/GameState');
const { Renderer }  = require('../../src/core/Renderer');
const { InputManager } = require('../../src/utils/InputManager');
const { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, DAY_START_HOUR, NIGHT_START_HOUR } = require('../../src/utils/Constants');

Page({
  data: {
    // Canvas dimensions (logical, used in WXML style)
    canvasWidth:  MAP_WIDTH * TILE_SIZE,
    canvasHeight: MAP_HEIGHT * TILE_SIZE,

    // HUD values — only updated via setData when changed
    time:         '06:00',
    date:         'Y1 Spring D1',
    money:        500,
    dayProgress:  0,

    // Tool bar
    selectedTool: null,
    tools: [
      { id: 'till',    name: '锄头',   icon: '🔨' },
      { id: 'plant',   name: '播种',   icon: '🌱' },
      { id: 'water',   name: '浇水',   icon: '💧' },
      { id: 'harvest', name: '收获',   icon: '🌾' }
    ],

    // Inventory panel
    showInventory: false,
    inventoryItems: [],   // [{ id, name, type, price, quantity }]
    inventoryTotal: 0,    // total gold from selling selected item

    // Event/dialogue overlay
    showDialogue:  false,
    dialogueText:  '',
    dialogueNPC:   '',
    dialogueChoices: [],  // [{ text, action }]

    // Save slot UI
    showSaveSlots: false,
    saveSlots: [],         // [{ key, exists, date }]

    // Weather
    isRaining: false,

    // Screen state
    isNight: false
  },

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onLoad() {
    this._initGame();
    this._initRenderer();
    this._initInput();
    this._initEventBus();
  },

  onShow() {
    // Restore game on app resume
    if (this.game) this.game.start();
  },

  onHide() {
    // Auto-save when app backgrounds
    if (this.game) {
      this.game.stop();
      this._autoSave();
    }
  },

  // ─── Game init ───────────────────────────────────────────────────────────

  _initGame() {
    this.game = new GameState();

    // Try to load autosave
    try {
      const saved = wx.getStorageSync('stardew_autosave');
      if (saved) {
        const loaded = GameState.deserialize(saved);
        // Transfer loaded state into the instance
        Object.assign(this.game, loaded);
      }
    } catch (e) {
      console.warn('[Game] No autosave found, starting fresh:', e);
    }

    this.game.start();

    // Seed default tools into inventory if empty
    if (!this.game.inventory.getQuantity('hoe') && !this.game.inventory.getQuantity('watering_can')) {
      this.game.inventory.addItem('hoe', 1);
      this.game.inventory.addItem('watering_can', 1);
    }

    // Sync initial HUD
    this._syncHUD();

    // Listen for time updates to update HUD
    this.game.timeSystem.addListener((payload) => {
      if (payload.event === 'timeUpdate') {
        this._syncHUD();
      }
    });
  },

  _initRenderer() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec(([res]) => {
        if (!res || !res.node) {
          console.error('[Game] Canvas node not found!');
          return;
        }

        const canvas = res.node;
        const ctx    = canvas.getContext('2d');
        const dpr    = wx.getSystemInfoSync().pixelRatio || 1;
        const logW   = res.width;
        const logH   = res.height;

        // Create renderer and apply DPR correction
        this.renderer = new Renderer(canvas, ctx);
        this.renderer.setupDPR(dpr, logW, logH);

        // Initial render
        this.renderer.render(this.game);

        // Start render loop on the canvas node (NOT the global)
        this._startRenderLoop();
      });
  },

  _initInput() {
    this.input = new InputManager(this);

    this.input.onMove = (dx, dy) => {
      if (!this.game) return;
      const moved = this.game.movePlayer(dx, dy);
      if (!moved) {
        // Bump into wall — small shake feedback
        if (this.renderer) this.renderer.shake(3, 100);
      }
    };

    this.input.onAction = () => {
      if (!this.game) return;
      this.game.performAction();
      this._syncInventory();
    };

    this.input.onInteract = () => {
      if (!this.game) return;
      this.game.interact();
      this._syncInventory();
    };

    this.input.onMenu = () => {
      this._toggleInventory();
    };

    this.input.onToolSelect = (toolId) => {
      if (!this.game) return;
      this.game.setAction(toolId);
      this.setData({ selectedTool: toolId });
    };

    // D-pad long-press binding for each direction
    const dirMap = ['up', 'down', 'left', 'right'];
    for (const dir of dirMap) {
      const key = `onDpad${dir.charAt(0).toUpperCase() + dir.slice(1)}Start`;
      this[key] = () => this.input && this.input._dpadStart(dir);
      const keyEnd = `onDpad${dir.charAt(0).toUpperCase() + dir.slice(1)}End`;
      this[keyEnd] = () => this.input && this.input._dpadEnd(dir);
    }
  },

  _initEventBus() {
    // Listen for events emitted by NPC/Shop/Event systems
    // These will be registered when DeepSeek's systems are integrated
    const bus = this.game.eventBus;
    if (bus) {
      bus.on('dialogue', (data) => {
        this.setData({
          showDialogue: true,
          dialogueText: data.text || '',
          dialogueNPC:  data.npcId || ''
        });
      });

      bus.on('shop-open', () => {
        // TODO: integrate with DeepSeek's shop UI
        wx.showToast({ title: '商店 - 待集成', icon: 'none' });
      });

      bus.on('event-triggered', (data) => {
        wx.showToast({ title: data.description || '事件触发', icon: 'none' });
      });
    }
  },

  // ─── Render loop (on canvas node, not global) ─────────────────────────────

  _startRenderLoop() {
    if (!this.renderer) return;

    const loop = () => {
      if (!this.game || !this.renderer) return;

      this.game.update();        // advance game time
      this.renderer.render(this.game);

      // Schedule next frame — on the CANVAS node, not window
      this.canvas.requestAnimationFrame(loop);
    };

    // Store reference so onUnload can cancel
    this._renderLoopRef = loop;

    // Get canvas node reference for rAF
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true }).exec(([res]) => {
      if (res && res.node) {
        this.canvas = res.node;
        this.canvas.requestAnimationFrame(loop);
      }
    });
  },

  // ─── HUD sync (throttled setData) ─────────────────────────────────────────

  _lastHUD = {};

  _syncHUD() {
    if (!this.game) return;

    const time     = this.game.timeSystem.getTimeString();
    const date     = this.game.timeSystem.getDateString();
    const money    = this.game.inventory.getMoney();
    const progress = this.game.timeSystem.dayProgress;
    const isRaining = this.game.timeSystem.isRaining;
    const hour     = this.game.timeSystem.hour;
    const isNight  = hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR;

    const changed = {};
    if (time     !== this._lastHUD.time)     changed.time     = time;
    if (date     !== this._lastHUD.date)     changed.date     = date;
    if (money    !== this._lastHUD.money)    changed.money    = money;
    if (progress !== this._lastHUD.progress) changed.dayProgress = progress;
    if (isRaining !== this._lastHUD.isRaining) changed.isRaining = isRaining;
    if (isNight  !== this._lastHUD.isNight)  changed.isNight  = isNight;

    if (Object.keys(changed).length > 0) {
      this._lastHUD = { time, date, money, progress, isRaining, isNight };
      this.setData(changed);
    }
  },

  // ─── Inventory ─────────────────────────────────────────────────────────────

  _toggleInventory() {
    const show = !this.data.showInventory;
    this.setData({ showInventory: show });
    if (show) this._syncInventory();
  },

  _syncInventory() {
    if (!this.game) return;
    const items = this.game.inventory.getAllItems();
    this.setData({ inventoryItems: items });
  },

  onTapInventoryItem(e) {
    const { itemid } = e.currentTarget.dataset;
    if (!itemid || !this.game) return;

    const inv = this.game.inventory;
    const def = inv.getItemDef(itemid);

    if (!def) return;

    // If it's a seed, select it for planting
    if (def.type === 'seed') {
      inv.selectItem(itemid);
      this.game.setAction('plant');
      this.setData({ selectedTool: 'plant' });
      wx.showToast({ title: `已选择: ${def.name}`, icon: 'none' });
    } else if (def.type === 'crop') {
      // Show sell option
      const sellPrice = Math.floor(def.price); // crops sell at full price
      wx.showModal({
        title: `出售 ${def.name}`,
        content: `当前价格: ${sellPrice}g /个\n持有: ${inv.getQuantity(itemid)}`,
        confirmText: '出售',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            const qty = inv.getQuantity(itemid);
            if (qty > 0) {
              const earned = inv.sellItem(itemid, qty);
              this._syncInventory();
              this._syncHUD();
              wx.showToast({ title: `+${earned}g`, icon: 'none' });
            }
          }
        }
      });
    }
  },

  onTapMenuBtn() {
    this._toggleInventory();
  },

  // ─── Controls (D-pad) ─────────────────────────────────────────────────────

  onTapMove(e) {
    // Fallback for touch-dpad without long-press simulation
    const { direction } = e.currentTarget.dataset;
    if (!this.game || !direction) return;

    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up'   ? -1 : direction === 'down'  ? 1 : 0;
    const moved = this.game.movePlayer(dx, dy);
    if (!moved && this.renderer) this.renderer.shake(3, 100);
  },

  // D-pad long-press start (set from WXML via component call)
  onDpadUpStart()    { this.input && this.input._dpadStart('up'); },
  onDpadDownStart()  { this.input && this.input._dpadStart('down'); },
  onDpadLeftStart()  { this.input && this.input._dpadStart('left'); },
  onDpadRightStart() { this.input && this.input._dpadStart('right'); },
  onDpadUpEnd()      { this.input && this.input._dpadEnd('up'); },
  onDpadDownEnd()    { this.input && this.input._dpadEnd('down'); },
  onDpadLeftEnd()    { this.input && this.input._dpadEnd('left'); },
  onDpadRightEnd()   { this.input && this.input._dpadEnd('right'); },

  // ─── Action buttons ───────────────────────────────────────────────────────

  onTapAction() {
    if (!this.game) return;
    this.game.performAction();
    this._syncInventory();
  },

  onTapInteract() {
    if (!this.game) return;
    this.game.interact();
    this._syncInventory();
  },

  selectTool(e) {
    const { tool } = e.currentTarget.dataset;
    if (!this.game || !tool) return;
    this.game.setAction(tool);
    this.setData({ selectedTool: tool });
  },

  // ─── Dialogue ──────────────────────────────────────────────────────────────

  onTapDialogueContinue() {
    this.setData({ showDialogue: false, dialogueChoices: [] });
    // Emit continue event to NPC system
    if (this.game && this.game.eventBus) {
      this.game.eventBus.emit('dialogue-continue', {});
    }
  },

  onTapDialogueChoice(e) {
    const { choice } = e.currentTarget.dataset;
    if (this.game && this.game.eventBus) {
      this.game.eventBus.emit('dialogue-choice', { choice });
    }
    this.setData({ showDialogue: false, dialogueChoices: [] });
  },

  // ─── Save / Load ──────────────────────────────────────────────────────────

  _autoSave() {
    try {
      const data = this.game.serialize();
      wx.setStorageSync('stardew_autosave', data);
      console.log('[Game] Autosaved');
    } catch (e) {
      console.error('[Game] Autosave failed:', e);
    }
  },

  onTapSave() {
    this._autoSave();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  onTapLoad() {
    try {
      const saved = wx.getStorageSync('stardew_autosave');
      if (!saved) {
        wx.showToast({ title: '无存档', icon: 'none' });
        return;
      }
      const loaded = GameState.deserialize(saved);
      Object.assign(this.game, loaded);
      this._syncHUD();
      this._syncInventory();
      wx.showToast({ title: '已加载', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  onUnload() {
    if (this.input) this.input.destroy();
    if (this.game)  this.game.stop();
  }
});
