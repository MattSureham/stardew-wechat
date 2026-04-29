/**
 * pages/game/game.js — Stardew-WeChat game page
 *
 * Phase 1 fixes:
 * - Save/load preserves listener chain & EventBus (B2/B4 fix)
 * - Removed duplicate D-pad handlers (B10 fix)
 * - Listener binding extracted into _bindGameListeners() for re-use
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
    inventoryTotal: 0,

    // Event/dialogue overlay
    showDialogue:  false,
    dialogueText:  '',
    dialogueNPC:   '',
    dialogueChoices: [],  // [{ text, action }]

    // Save slot UI
    showSaveSlots: false,
    saveSlots: [],

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
    // EventBus listeners are bound inside _initGame after game is fully ready
  },

  onShow() {
    if (this.game) this.game.start();
  },

  onHide() {
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
        Object.assign(this.game, loaded);
      }
    } catch (e) {
      console.warn('[Game] No autosave found, starting fresh:', e);
    }

    this.game.start();

    // Seed default tools if inventory is empty
    if (!this.game.inventory.getQuantity('hoe') && !this.game.inventory.getQuantity('watering_can')) {
      this.game.inventory.addItem('hoe', 1);
      this.game.inventory.addItem('watering_can', 1);
    }

    // Register persistent listeners (HUD sync, EventBus) — called exactly once
    this._bindGameListeners();
    this._syncHUD();
  },

  /**
   * B2/B4 FIX: Apply a deserialized save and re-bind all listeners.
   * Object.assign loses the timeSystem's external listeners and the EventBus
   * — _bindGameListeners restores them.
   * Used by onTapLoad (manual load), not by _initGame.
   */
  _applyLoadedSave(saved) {
    const loaded = GameState.deserialize(saved);
    Object.assign(this.game, loaded);
    // Re-bind all external listeners — timeSystem and EventBus are new objects now
    this._bindGameListeners();
  },

  /**
   * Bind persistent listeners that need to survive save/load cycles.
   * Called during init AND after any load operation.
   */
  _bindGameListeners() {
    if (!this.game) return;

    // HUD time-sync listener
    this.game.timeSystem.addListener((payload) => {
      if (payload.event === 'timeUpdate') {
        this._syncHUD();
      }
    });

    // EventBus: dialogue, shop, events
    this._initEventBus();
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

        this.renderer = new Renderer(canvas, ctx);
        this.renderer.setupDPR(dpr, logW, logH);

        // Initial render
        this.renderer.render(this.game);

        this._startRenderLoop();
      });
  },

  /**
   * B10 FIX: Removed duplicate D-pad handler loop from _initInput.
   * The D-pad handlers are statically defined below (onDpadUpStart, etc.)
   * and are not duplicated here.
   */
  _initInput() {
    this.input = new InputManager(this);

    this.input.onMove = (dx, dy) => {
      if (!this.game) return;
      const moved = this.game.movePlayer(dx, dy);
      if (!moved) {
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
  },

  _initEventBus() {
    const bus = this.game && this.game.eventBus;
    if (!bus) return;

    // Clear previous listeners to prevent duplicates after load
    bus.clear();

    bus.on('dialogue', (data) => {
      this.setData({
        showDialogue: true,
        dialogueText: data.text || '',
        dialogueNPC:  data.npcId || ''
      });
    });

    bus.on('shop-open', () => {
      // Shop UI integration point for DeepSeek's ShopSystem
      wx.showToast({ title: '商店 - 待集成', icon: 'none' });
    });

    bus.on('event-triggered', (data) => {
      wx.showToast({ title: data.description || '事件触发', icon: 'none' });
    });

    bus.on('forage-collected', (data) => {
      wx.showToast({ title: `采集了 ${data.itemId || '物品'}！`, icon: 'none' });
    });
  },

  // ─── Render loop ──────────────────────────────────────────────────────────

  _startRenderLoop() {
    if (!this.renderer) return;

    const loop = () => {
      if (!this.game || !this.renderer) return;

      this.game.update();
      this.renderer.render(this.game);

      if (this.canvas) {
        this.canvas.requestAnimationFrame(loop);
      }
    };

    this._renderLoopRef = loop;

    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true }).exec(([res]) => {
      if (res && res.node) {
        this.canvas = res.node;
        this.canvas.requestAnimationFrame(loop);
      }
    });
  },

  // ─── HUD sync ────────────────────────────────────────────────────────────

  _lastHUD = {};

  _syncHUD() {
    if (!this.game) return;

    const rd = this.game.getRenderData();
    const { time, date, money, progress, isRaining, hour } = rd;
    const isNight = hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR;

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

  // ─── Inventory ────────────────────────────────────────────────────────────

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

    if (def.type === 'seed') {
      inv.selectItem(itemid);
      this.game.setAction('plant');
      this.setData({ selectedTool: 'plant' });
      wx.showToast({ title: `已选择: ${def.name}`, icon: 'none' });
    } else if (def.type === 'crop') {
      const sellPrice = Math.floor(def.price);
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

  // ─── D-Pad (statically defined — used by WXML bindtouchstart/bindtouchend) ──
  // B10 FIX: These are the ONLY D-pad handlers; the duplicate loop in old
  // _initInput was removed. InputManager._bindDpadButtons is dead code (B9).

  onTapMove(e) {
    const { direction } = e.currentTarget.dataset;
    if (!this.game || !direction) return;

    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up'   ? -1 : direction === 'down'  ? 1 : 0;
    const moved = this.game.movePlayer(dx, dy);
    if (!moved && this.renderer) this.renderer.shake(3, 100);
  },

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

  // ─── Dialogue ─────────────────────────────────────────────────────────────

  onTapDialogueContinue() {
    this.setData({ showDialogue: false, dialogueChoices: [] });
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

  /**
   * B2/B4 FIX: Manually load uses _applyLoadedSave to re-bind listeners.
   */
  onTapLoad() {
    try {
      const saved = wx.getStorageSync('stardew_autosave');
      if (!saved) {
        wx.showToast({ title: '无存档', icon: 'none' });
        return;
      }
      this._applyLoadedSave(saved);
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
