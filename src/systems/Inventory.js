/**
 * Inventory - Player items and tools
 * Imports item definitions from centralized data layer.
 */

const { ITEMS, ITEM_TYPES } = require('../data/items');
const { START_MONEY } = require('../utils/Constants');

class Inventory {
  constructor() {
    this.items = {}; // { itemId: quantity }
    this.selectedItem = null;
    this.money = START_MONEY;

    // Default starter tools
    this.addItem('hoe', 1);
    this.addItem('watering_can', 1);
  }

  addItem(itemId, quantity = 1) {
    if (!ITEMS[itemId]) {
      console.warn(`[Inventory] Unknown item: ${itemId}`);
      return false;
    }
    if (!this.items[itemId]) {
      this.items[itemId] = 0;
    }
    this.items[itemId] += quantity;
    return true;
  }

  removeItem(itemId, quantity = 1) {
    if (this.items[itemId] && this.items[itemId] >= quantity) {
      this.items[itemId] -= quantity;
      if (this.items[itemId] <= 0) {
        delete this.items[itemId];
        if (this.selectedItem === itemId) {
          this.selectedItem = null;
        }
      }
      return true;
    }
    return false;
  }

  getQuantity(itemId) {
    return this.items[itemId] || 0;
  }

  hasItem(itemId, quantity = 1) {
    return this.getQuantity(itemId) >= quantity;
  }

  selectItem(itemId) {
    if (this.hasItem(itemId)) {
      this.selectedItem = itemId;
      return true;
    }
    return false;
  }

  getSelectedItem() {
    return this.selectedItem;
  }

  /**
   * Get all items in inventory with their full definitions.
   * @returns {Array<{id, name, type, price, quantity, ...}>}
   */
  getAllItems() {
    return Object.entries(this.items)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        ...ITEMS[id],
        id,
        quantity: qty
      }));
  }

  /**
   * Get items filtered by type (e.g., 'seed', 'tool', 'crop').
   */
  getItemsByType(type) {
    return this.getAllItems().filter(item => item.type === type);
  }

  /**
   * Get a specific item definition even if not owned.
   */
  getItemDef(itemId) {
    return ITEMS[itemId] || null;
  }

  buyItem(itemId, quantity = 1) {
    const item = ITEMS[itemId];
    if (!item) return false;

    const cost = item.price * quantity;
    if (this.money >= cost) {
      this.money -= cost;
      this.addItem(itemId, quantity);
      return true;
    }
    return false;
  }

  sellItem(itemId, quantity = 1) {
    const item = ITEMS[itemId];
    if (!item || !this.hasItem(itemId, quantity)) return false;

    // Seeds sell for half price; everything else at face value
    const sellPrice = item.type === ITEM_TYPES.SEED
      ? Math.floor(item.price / 2)
      : item.price;

    this.removeItem(itemId, quantity);
    this.money += sellPrice * quantity;
    return sellPrice * quantity;
  }

  getMoney() {
    return this.money;
  }

  addMoney(amount) {
    this.money += amount;
  }

  // Serialize
  serialize() {
    return {
      items: this.items,
      money: this.money,
      selectedItem: this.selectedItem
    };
  }

  static deserialize(data) {
    const inv = new Inventory();
    inv.items = data.items || {};
    inv.money = data.money || START_MONEY;
    inv.selectedItem = data.selectedItem || null;
    return inv;
  }
}

// Re-export ITEMS and ITEM_TYPES for backward compatibility
module.exports = { Inventory, ITEMS, ITEM_TYPES };
