/**
 * InputManager — Touch/swipe/button input abstraction for Stardew-WeChat.
 *
 * Responsibilities:
 * - Convert WeChat touch events (touchstart/touchmove/touchend) into swipe gestures
 * - Support long-press on D-pad buttons for continuous movement
 * - Detect double-tap (for interact shortcut)
 * - Emit callbacks: onMove(dx, dy), onAction(), onInteract(), onMenu(), onToolSelect(toolId)
 *
 * Usage:
 *   const input = new InputManager(page);   // page = WeChat Page instance
 *   input.onMove = (dx, dy) => game.movePlayer(dx, dy);
 *   input.onAction = () => game.performAction();
 *   input.onInteract = () => game.interact();
 *   input.onMenu = () => that.setData({ showInventory: true });
 */

const MOVE_THRESHOLD_PX = 30;   // minimum swipe distance to register direction
const DOUBLE_TAP_MS = 300;      // max ms between two taps for double-tap detection
const LONG_PRESS_MS = 400;      // ms to hold before triggering long-press repeat
const LONG_PRESS_INTERVAL_MS = 150; // repeat rate while held

class InputManager {
  /**
   * @param {object} page - WeChat Page instance (binds event handlers to it)
   */
  constructor(page) {
    this.page = page;

    // ── Callbacks (set by game/page code) ──────────────────────────────────
    this.onMove     = null; // (dx: number, dy: number) => void
    this.onAction   = null; // () => void
    this.onInteract = null; // () => void
    this.onMenu     = null; // () => void
    this.onToolSelect = null; // (toolId: string) => void

    // ── Internal touch state ───────────────────────────────────────────────
    this._touchStart = null;     // { x, y, time }
    this._lastTap    = null;     // { x, y, time }
    this._longPressTimer = null;
    this._repeatInterval = null;
    this._currentDirection = null; // 'up'|'down'|'left'|'right'|null

    // ── Bind event handlers to page ───────────────────────────────────────
    page.onTouchStart   = page.onTouchStart   ? page.onTouchStart.bind(page)   : () => {};
    page.onTouchMove    = page.onTouchMove    ? page.onTouchMove.bind(page)    : () => {};
    page.onTouchEnd     = page.onTouchEnd     ? page.onTouchEnd.bind(page)     : () => {};
    page.onTouchCancel  = page.onTouchCancel  ? page.onTouchCancel.bind(page)  : () => {};

    // Override with our handlers (after saving originals if needed)
    this._origTouchStart = page.onTouchStart;
    this._origTouchMove  = page.onTouchMove;
    this._origTouchEnd   = page.onTouchEnd;

    page.onTouchStart   = (e) => this._handleTouchStart(e);
    page.onTouchMove    = (e) => this._handleTouchMove(e);
    page.onTouchEnd      = (e) => this._handleTouchEnd(e);
    page.onTouchCancel   = (e) => this._handleTouchEnd(e);

    // Attach tool selection handler
    this._bindToolBar();
  }

  // ─── Touch handlers ────────────────────────────────────────────────────────

  _handleTouchStart(e) {
    const touch = e.touches[0];
    if (!touch) return;

    this._touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    // Forward to original handler if exists
    if (this._origTouchStart) this._origTouchStart(e);

    // Cancel any pending long-press
    this._cancelLongPress();
  }

  _handleTouchMove(e) {
    if (!this._touchStart) return;
    if (this._origTouchMove) this._origTouchMove(e);
    // We don't prevent default — let the page handle other gestures
  }

  _handleTouchEnd(e) {
    if (!this._touchStart) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this._touchStart.x;
    const dy = touch.clientY - this._touchStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - this._touchStart.time;

    // ── Swipe ───────────────────────────────────────────────────────────────
    if (dist >= MOVE_THRESHOLD_PX) {
      const dir = this._swipeToDirection(dx, dy);
      if (dir && this.onMove) {
        const [ddx, ddy] = this._directionToDelta(dir);
        this.onMove(ddx, ddy);
      }
    }
    // ── Tap (short touch, no significant swipe) ────────────────────────────
    else if (elapsed < 400) {
      this._handleTap(this._touchStart.x, this._touchStart.y);
    }

    this._touchStart = null;
    this._cancelLongPress();

    if (this._origTouchEnd) this._origTouchEnd(e);
  }

  /**
   * Convert raw dx/dy to a cardinal direction.
   */
  _swipeToDirection(dx, dy) {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Require at least 1.5x horizontal vs vertical or vice versa
    if (absDx > absDy * 1.5) return dx > 0 ? 'right' : 'left';
    if (absDy > absDx * 1.5) return dy > 0 ? 'down'  : 'up';
    return null;
  }

  _directionToDelta(dir) {
    switch (dir) {
      case 'up':    return [0, -1];
      case 'down':  return [0,  1];
      case 'left':  return [-1, 0];
      case 'right': return [ 1, 0];
    }
    return [0, 0];
  }

  /**
   * Handle tap: check for double-tap, otherwise emit interact.
   */
  _handleTap(x, y) {
    const now = Date.now();
    if (
      this._lastTap &&
      Math.abs(x - this._lastTap.x) < 40 &&
      Math.abs(y - this._lastTap.y) < 40 &&
      now - this._lastTap.time < DOUBLE_TAP_MS
    ) {
      // Double tap → action
      if (this.onAction) this.onAction();
      this._lastTap = null;
    } else {
      // Single tap → interact (or open menu if on menu button)
      if (this.onInteract) this.onInteract();
      this._lastTap = { x, y, time: now };
    }
  }

  // ─── D-pad long-press ─────────────────────────────────────────────────────
  // B9 FIX: Removed dead _bindDpadButtons() — it created _dpad_*_start/_end
  // properties that were never referenced. The WXML uses game.js's
  // onDpadUpStart etc., which call _dpadStart/_dpadEnd directly.

  _dpadStart(direction) {
    if (!this.onMove) return;

    this._currentDirection = direction;
    const [dx, dy] = this._directionToDelta(direction);

    // Immediate first move
    this.onMove(dx, dy);

    // Start long-press timer → then repeat
    this._longPressTimer = setTimeout(() => {
      this._repeatInterval = setInterval(() => {
        if (this._currentDirection === direction && this.onMove) {
          this.onMove(dx, dy);
        }
      }, LONG_PRESS_INTERVAL_MS);
    }, LONG_PRESS_MS);
  }

  _dpadEnd(direction) {
    if (this._currentDirection !== direction) return;
    this._currentDirection = null;
    this._cancelLongPress();
  }

  _cancelLongPress() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    if (this._repeatInterval) {
      clearInterval(this._repeatInterval);
      this._repeatInterval = null;
    }
  }

  // ─── Tool bar ─────────────────────────────────────────────────────────────

  _bindToolBar() {
    // Override selectTool to also call onToolSelect callback
    const orig = this.page.selectTool;
    this.page.selectTool = (e) => {
      const { tool } = e.currentTarget.dataset;
      if (this.onToolSelect) this.onToolSelect(tool);
      if (orig) orig.call(this.page, e);
    };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Trigger a move in a direction programmatically (e.g., keyboard support).
   */
  move(direction) {
    if (!this.onMove) return;
    const [dx, dy] = this._directionToDelta(direction);
    this.onMove(dx, dy);
  }

  /**
   * Destroy the input manager (remove all handlers).
   */
  destroy() {
    this._cancelLongPress();
    if (this.page) {
      this.page.onTouchStart  = this._origTouchStart || (() => {});
      this.page.onTouchMove   = this._origTouchMove  || (() => {});
      this.page.onTouchEnd    = this._origTouchEnd    || (() => {});
    }
  }
}

module.exports = { InputManager, MOVE_THRESHOLD_PX, DOUBLE_TAP_MS };
