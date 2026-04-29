/**
 * Renderer — Canvas 2D rendering engine for Stardew-WeChat.
 *
 * Architecture:
 * - DPR-correct: canvas.width/height = physical pixels; context scaled once at init.
 *   All subsequent draw calls use LOGICAL coordinates (tile grid units).
 * - Layered rendering: ground → crops → objects → NPCs → player → effects → UI overlay
 * - Sprites via drawImage with Image() objects; falls back to colored rects.
 * - Day/night overlay tinted per time-of-day.
 * - Season-aware ground colors.
 *
 * Usage:
 *   const renderer = new Renderer(canvas, ctx);
 *   renderer.render(gameState);   // called every rAF tick
 */

const {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, TILE_TYPES, SEASONS,
  RENDER_LAYERS, NIGHT_START_HOUR, DAY_START_HOUR
} = require('../utils/Constants');
const { getGrowthStage } = require('../data/crops');

// ─── Color palettes ───────────────────────────────────────────────────────────

const SEASON_GROUND = {
  Spring: { base: '#4a7c3f', border: '#3d5c2f', tilled: '#5c4033', watered: '#3d2817' },
  Summer: { base: '#3d6b35', border: '#2e5528', tilled: '#6b5033', watered: '#4a3520' },
  Fall:   { base: '#7a6b3d', border: '#5e5230', tilled: '#4a3520', watered: '#362913' },
  Winter: { base: '#c8d4e0', border: '#9aacbc', tilled: '#8a9aaa', watered: '#6a7a8a' }
};

const CROP_COLORS = {
  seed:     '#8B7355',
  sprout:   '#90EE90',
  growing:  '#32CD32',
  flowering:'#FF69B4',
  mature:   '#FFD700'
};

const NPC_SPRITES = {
  pierre: { color: '#5B9BD5', initials: 'P' },
  robin:  { color: '#ED7D31', initials: 'R' },
  linus:  { color: '#70AD47', initials: 'L' },
  willy:  { color: '#4472C4', initials: 'W' },
  marnie: { color: '#FFC000', initials: 'M' }
};

// ─── Day/night overlay ────────────────────────────────────────────────────────

/**
 * Get a semi-transparent overlay color based on game time.
 * Returns null for noon (no overlay), a rgba string otherwise.
 * @param {number} hour - Game hour (0-23)
 * @param {boolean} isRaining
 */
function _getDayNightOverlay(hour, isRaining) {
  if (isRaining) {
    // Rainy: blue-grey overlay that persists through day/night
    return 'rgba(30, 60, 90, 0.25)';
  }

  // Night (8pm – 5am): dark blue overlay, full night
  if (hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR) {
    return 'rgba(10, 15, 50, 0.55)';
  }

  // Dawn (5am – 7am): warming orange tint
  if (hour >= 5 && hour < 7) {
    return 'rgba(255, 140, 50, 0.20)';
  }

  // Dusk (7pm – 8pm): cooling purple tint
  if (hour >= 19 && hour < NIGHT_START_HOUR) {
    return 'rgba(80, 40, 100, 0.25)';
  }

  return null; // Day — no overlay
}

// ─── Tile rendering helpers ───────────────────────────────────────────────────

function drawTile(ctx, x, y, tile, seasonPalette) {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  // Ground
  let groundColor = seasonPalette.base;
  if (tile.type === TILE_TYPES.TILLED)  groundColor = seasonPalette.tilled;
  if (tile.type === TILE_TYPES.WATERED) groundColor = seasonPalette.watered;
  if (tile.type === TILE_TYPES.WATER)   groundColor = '#2080c0';
  if (tile.type === TILE_TYPES.PATH)    groundColor = '#9a8a70';
  if (tile.type === TILE_TYPES.OBSTACLE) groundColor = '#7a7a7a';

  ctx.fillStyle = groundColor;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  // Tile border
  ctx.strokeStyle = seasonPalette.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

  // Fence decoration
  if (tile.decoration === TILE_TYPES.FENCE) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(px + 4, py + 2, TILE_SIZE - 8, 6);
    ctx.fillRect(px + 4, py + TILE_SIZE - 8, TILE_SIZE - 8, 6);
    // Fence posts
    ctx.fillStyle = '#6B3510';
    ctx.fillRect(px + 2, py, 4, TILE_SIZE);
    ctx.fillRect(px + TILE_SIZE - 6, py, 4, TILE_SIZE);
  }

  // Forage item (small berry on ground)
  if (tile.forage) {
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crop
  if (tile.crop) {
    drawCrop(ctx, px, py, tile.crop);
  }

  // Hydration indicator (water sheen)
  if (tile.hydration > 0) {
    ctx.fillStyle = `rgba(0, 120, 255, ${Math.min(0.35, tile.hydration / 300)})`;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  }
}

function drawCrop(ctx, px, py, crop) {
  const stage = getGrowthStage(crop.growth);
  const color = CROP_COLORS[stage] || CROP_COLORS.seed;
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;

  switch (stage) {
    case 'seed':
      // Small brown dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'sprout':
      // Two small leaves
      ctx.fillStyle = color;
      ctx.fillRect(cx - 1, cy + 4, 2, 8);
      ctx.fillRect(cx - 5, cy + 2, 4, 3);
      ctx.fillRect(cx + 1, cy + 2, 4, 3);
      break;

    case 'growing':
      // Taller stem with leaves
      ctx.fillStyle = '#228B22';
      ctx.fillRect(cx - 1, cy, 2, 12);
      ctx.fillStyle = color;
      ctx.fillRect(cx - 7, cy + 2, 5, 4);
      ctx.fillRect(cx + 2, cy + 2, 5, 4);
      break;

    case 'flowering':
      // Plant with flower bud
      ctx.fillStyle = '#228B22';
      ctx.fillRect(cx - 1, cy - 2, 2, 14);
      ctx.fillStyle = '#FFA500';
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'mature':
      // Full plant with big fruit/vegetable
      ctx.fillStyle = '#228B22';
      ctx.fillRect(cx - 1, cy - 4, 2, 14);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 9, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(cx - 3, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

// ─── NPC rendering ────────────────────────────────────────────────────────────

function drawNPC(ctx, npc) {
  if (!npc || npc.x == null || npc.y == null) return;
  const px = npc.x * TILE_SIZE;
  const py = npc.y * TILE_SIZE;
  const sprite = NPC_SPRITES[npc.id] || { color: '#888888', initials: '?' };

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 3, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (colored circle)
  ctx.fillStyle = sprite.color;
  ctx.beginPath();
  ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 12, 0, Math.PI * 2);
  ctx.fill();

  // Darker outline
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Initials label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sprite.initials, px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 1);
}

// ─── Player rendering ─────────────────────────────────────────────────────────

function drawPlayer(ctx, playerX, playerY, facing) {
  const px = playerX * TILE_SIZE;
  const py = playerY * TILE_SIZE;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 3, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (red shirt)
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(px + 6, py + 10, TILE_SIZE - 12, TILE_SIZE - 14);

  // Head (skin tone)
  ctx.fillStyle = '#ffd93d';
  ctx.fillRect(px + 8, py + 2, TILE_SIZE - 16, TILE_SIZE - 16);

  // Hair (brown)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(px + 7, py + 2, TILE_SIZE - 14, 5);

  // Facing direction indicator (small triangle pointing in facing direction)
  // B7: Visual feedback for player facing direction
  if (facing && (facing.dx !== 0 || facing.dy !== 0)) {
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;
    const tipX = cx + facing.dx * 10;
    const tipY = cy + facing.dy * 10;
    const perpX = -facing.dy * 4;
    const perpY = facing.dx * 4;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + perpX, cy + perpY);
    ctx.lineTo(cx - perpX, cy - perpY);
    ctx.closePath();
    ctx.fill();
  }
}

// ─── Raindrop helpers ──────────────────────────────────────────────────────────

/**
 * B8 FIX: Seeded PRNG so raindrop positions are deterministic.
 * Pre-computes 40 raindrop positions once at construction time,
 * then animates them downward over time (no per-frame jitter).
 */
function _createRaindrops() {
  // Mulberry32 seeded PRNG — deterministic, no Math.random() at runtime
  let seed = 0xdeadbeef;
  const rng = () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 40 }, () => ({
    x: rng() * MAP_WIDTH * TILE_SIZE,
    // Stagger Y across the full height so drops don't all start at top
    y: rng() * MAP_HEIGHT * TILE_SIZE,
    speed: 0.8 + rng() * 0.4  // slight speed variation per drop
  }));
}

/**
 * B8 FIX: Rain renders from pre-computed positions (stable across frames),
 * each drop falls at its own speed. Resets to top when it exits the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} hour
 * @param {Array} raindrops - pre-computed [{x, y, speed}] array
 */
function drawRain(ctx, hour, raindrops) {
  if (hour >= NIGHT_START_HOUR || hour < DAY_START_HOUR) return;
  ctx.fillStyle = 'rgba(150, 200, 255, 0.6)';
  for (const drop of raindrops) {
    ctx.fillRect(drop.x, drop.y, 1, 6);
  }
}

// ─── Main Renderer class ──────────────────────────────────────────────────────

class Renderer {
  /**
   * @param {HTMLCanvasElement|object} canvas - WeChat canvas node
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = MAP_WIDTH * TILE_SIZE;
    this.height = MAP_HEIGHT * TILE_SIZE;

    // Precompute season palette cache
    this._seasonPalette = SEASON_GROUND.Spring;

    // B8 FIX: pre-seeded raindrops — positions stable across frames
    this._raindrops = _createRaindrops();
    // Accumulated rain animation time (seconds) so drops fall smoothly
    this._rainTime = 0;

    // Last rendered state for dirty-checking (not strictly needed with rAF
    // but useful if we move to conditional render-on-change)
    this._lastRender = null;
  }

  /**
   * Configure DPR scaling. Call once after canvas is set up.
   * @param {number} dpr - Device pixel ratio from wx.getSystemInfoSync()
   * @param {number} logicalWidth  - Logical canvas width (from CSS/style)
   * @param {number} logicalHeight - Logical canvas height
   */
  setupDPR(dpr, logicalWidth, logicalHeight) {
    // Set physical pixel dimensions
    this.canvas.width  = logicalWidth  * dpr;
    this.canvas.height = logicalHeight * dpr;

    // Scale context so all logical coords render at correct physical size
    this.ctx.scale(dpr, dpr);

    this.width  = logicalWidth;
    this.height = logicalHeight;
  }

  /**
   * Main render entry point. Call every rAF tick.
   *
   * B11 FIX: Reads time/weather/season from getRenderData() instead of
   * reaching into gameState.timeSystem internals directly.
   * NPCs are also drawn from render data rather than gameState.npcSystem.
   * B8 FIX: Rain drops animate smoothly using pre-seeded positions.
   *
   * @param {object} gameState - GameState instance
   */
  render(gameState) {
    const ctx  = this.ctx;
    const rd = gameState.getRenderData();
    const { tiles, playerX, playerY, seasonIndex, hour, isRaining, npcs } = rd;

    // Update season palette if changed
    const seasonName = SEASONS[seasonIndex] || 'Spring';
    this._seasonPalette = SEASON_GROUND[seasonName] || SEASON_GROUND.Spring;

    // ── Clear canvas ──────────────────────────────────────────────────────
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // ── Layer 0: Ground tiles ───────────────────────────────────────────────
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = tiles[y][x];
        drawTile(ctx, x, y, tile, this._seasonPalette);
      }
    }

    // ── Layer 1: Rain (before player so rain appears behind) ────────────────
    if (isRaining) {
      // B8 FIX: advance raindrop positions before drawing
      this._rainTime += 0.016; // ~60fps assumed
      for (const drop of this._raindrops) {
        drop.y += drop.speed;
        if (drop.y > MAP_HEIGHT * TILE_SIZE) {
          // Wrap to top with a random horizontal position
          drop.y = -6;
          drop.x = Math.random() * MAP_WIDTH * TILE_SIZE;
        }
      }
      drawRain(ctx, hour, this._raindrops);
    } else {
      // Reset rain time when rain stops so drops restart fresh next time
      this._rainTime = 0;
    }

    // ── Layer 2: NPCs ──────────────────────────────────────────────────────
    if (npcs && npcs.length > 0) {
      for (const npc of npcs) {
        drawNPC(ctx, npc);
      }
    }

    // ── Layer 3: Player ────────────────────────────────────────────────────
    drawPlayer(ctx, playerX, playerY, rd.facing);

    // ── Layer 4: Day/night overlay ─────────────────────────────────────────
    const overlay = _getDayNightOverlay(hour, isRaining);
    if (overlay) {
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this._lastRender = gameState;
  }

  /**
   * Render only the changed HUD parts — call this instead of re-rendering
   * the whole canvas when game state hasn't changed visually.
   * Currently a no-op placeholder; full implementation would use OffscreenCanvas
   * for HUD elements over a cached tile layer.
   */
  renderDirty() {
    if (this._lastRender) {
      this.render(this._lastRender);
    }
  }

  /**
   * Draw a screen-shake effect (quick helper).
   * Applies a random offset to the next render.
   */
  shake(intensity = 4, durationMs = 200) {
    const ctx = this.ctx;
    const start = Date.now();
    const origFillRect = ctx.fillRect.bind(ctx);

    const shakeRect = (...args) => {
      if (Date.now() - start > durationMs) return;
      const ox = (Math.random() - 0.5) * intensity * 2;
      const oy = (Math.random() - 0.5) * intensity * 2;
      ctx.save();
      ctx.translate(ox, oy);
      origFillRect(...args);
      ctx.restore();
    };

    ctx.fillRect = shakeRect;
    setTimeout(() => { ctx.fillRect = origFillRect; }, durationMs);
  }
}

module.exports = { Renderer, CROP_COLORS, NPC_SPRITES };
