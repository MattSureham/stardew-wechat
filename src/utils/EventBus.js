/**
 * EventBus — Lightweight pub/sub for decoupled system communication.
 * Used by: NPC system, Shop system, EventSystem, Renderer, InputManager.
 *
 * Usage:
 *   const { EventBus } = require('../utils/EventBus');
 *   const bus = new EventBus();
 *   bus.on('dialogue', (data) => { ... });
 *   bus.emit('dialogue', { npcId: 'pierre', text: 'Hello!' });
 */

class EventBus {
  constructor() {
    this._handlers = {};
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._handlers[event]) {
      this._handlers[event] = [];
    }
    this._handlers[event].push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   */
  off(event, callback) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(cb => cb !== callback);
    if (this._handlers[event].length === 0) {
      delete this._handlers[event];
    }
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event - Event name
   * @param {*} data - Payload passed to each handler
   */
  emit(event, data) {
    if (!this._handlers[event]) return;
    this._handlers[event].forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first emission).
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Remove all handlers for all events.
   */
  clear() {
    this._handlers = {};
  }
}

module.exports = { EventBus };
