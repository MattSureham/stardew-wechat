/**
 * Inventory - Player items and tools
 */

// Item categories
const ITEM_TYPES = {
  SEED: 'seed',
  CROP: 'crop',
  TOOL: 'tool',
  ARTIFACT: 'artifact',
  FISH: 'fish'
};

// Basic item definitions (expandable)
const ITEMS = {
  // Seeds
  parsnip_seed: { name: 'Parsnip Seeds', type: ITEM_TYPES.SEED, price: 20, growTime: 4 },
  carrot_seed: { name: 'Carrot Seeds', type: ITEM_TYPES.SEED, price: 30, growTime: 3 },
  potato_seed: { name: 'Potato Seeds', type: ITEM_TYPES.SEED, price: 25, growTime: 6 },
  tomato_seed: { name: 'Tomato Seeds', type: ITEM_TYPES.SEED, price: 50, growTime: 11 },
  corn_seed: { name: 'Corn Seeds', type: ITEM_TYPES.SEED, price: 45, growTime: 14 },
  pumpkin_seed: { name: 'Pumpkin Seeds', type: ITEM_TYPES.SEED, price: 80, growTime: 15 },
  
  // Crops (harvested)
  parsnip: { name: 'Parsnip', type: ITEM_TYPES.CROP, price: 35 },
  carrot: { name: 'Carrot', type: ITEM_TYPES.CROP, price: 45 },
  potato: { name: 'Potato', type: ITEM_TYPES.CROP, price: 40 },
  tomato: { name: 'Tomato', type: ITEM_TYPES.CROP, price: 60 },
  corn: { name: 'Corn', type: ITEM_TYPES.CROP, price: 55 },
  pumpkin: { name: 'Pumpkin', type: ITEM_TYPES.CROP, price: 120 },
  
  // Tools
  hoe: { name: 'Hoe', type: ITEM_TYPES.TOOL, icon: 'hoe' },
  watering_can: { name: 'Watering Can', type: ITEM_TYPES.TOOL, icon: 'water' },
  pickaxe: { name: 'Pickaxe', type: ITEM_TYPES.TOOL, icon: 'pick' },
  scythe: { name: 'Scythe', type: ITEM_TYPES.TOOL, icon: 'scythe' }
};

class Inventory {
  constructor() {
    this.items = {}; // { itemId: quantity }
    this.selectedItem = null;
    this.money = 500; // Starting gold
    
    // Default tools
    this.addItem('hoe', 1);
    this.addItem('watering_can', 1);
  }

  addItem(itemId, quantity = 1) {
    if (!this.items[itemId]) {
      this.items[itemId] = 0;
    }
    this.items[itemId] += quantity;
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
    }
  }

  getSelectedItem() {
    return this.selectedItem;
  }

  getAllItems() {
    return Object.entries(this.items).map(([id, qty]) => ({
      ...ITEMS[id],
      id,
      quantity: qty
    }));
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
    
    // Seeds sell for half price
    const sellPrice = item.type === ITEM_TYPES.SEED 
      ? Math.floor(item.price / 2) 
      : item.price;
    
    this.removeItem(itemId, quantity);
    this.money += sellPrice * quantity;
    return true;
  }

  getMoney() {
    return this.money;
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
    inv.items = data.items;
    inv.money = data.money;
    inv.selectedItem = data.selectedItem;
    return inv;
  }
}

module.exports = { Inventory, ITEMS, ITEM_TYPES };
