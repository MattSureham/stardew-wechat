/**
 * TimeSystem - Day/Season/Year cycle
 * Stardew-style: 10 minutes real time = 1 hour game time
 */

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
const DAYS_PER_SEASON = 28;
const SEEDS = {
  Spring: ['parsnip', 'carrot', 'potato', 'cabbage'],
  Summer: ['tomato', 'corn', 'pepper', 'watermelon'],
  Fall: ['pumpkin', 'eggplant', 'cranberries', 'yam'],
  Winter: [] // No crops outdoors in winter
};

class TimeSystem {
  constructor() {
    this.year = 1;
    this.season = 0; // 0-3
    this.day = 1;    // 1-28
    this.hour = 6;   // 6am start
    this.minute = 0;
    this.dayProgress = 0; // 0-1 through the day
    
    // Game time config (Stardew-like)
    this.minutesPerDay = 1680; // 28 hours worth of minutes
    this.timeScale = 1; // speed multiplier
    
    this.listeners = [];
  }

  // Called each game tick
  update(deltaTime) {
    // Real time to game time: 1 second = 10 minutes game time
    const gameMinutes = deltaTime * 10 * this.timeScale;
    this.minute += gameMinutes;
    
    if (this.minute >= 60) {
      this.hour += Math.floor(this.minute / 60);
      this.minute = this.minute % 60;
    }
    
    if (this.hour >= 24) {
      this.hour = 0;
      this.nextDay();
    }
    
    // Calculate day progress (0-1)
    this.dayProgress = (this.hour * 60 + this.minute) / (24 * 60);
    
    this.notifyListeners('timeUpdate');
  }

  nextDay() {
    this.day++;
    if (this.day > DAYS_PER_SEASON) {
      this.day = 1;
      this.season++;
      if (this.season >= 4) {
        this.season = 0;
        this.year++;
      }
    }
    
    this.notifyListeners('newDay');
  }

  getTimeString() {
    const h = this.hour.toString().padStart(2, '0');
    const m = this.minute.toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  getSeasonName() {
    return SEASONS[this.season];
  }

  getDateString() {
    return `Year ${this.year}, ${this.getSeasonName()} ${this.day}`;
  }

  getAvailableSeeds() {
    return SEEDS[this.getSeasonName()] || [];
  }

  isNight() {
    return this.hour >= 20 || this.hour < 5;
  }

  isShopOpen() {
    // Shops typically open 9am-5pm
    return this.hour >= 9 && this.hour < 17;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(l => l(event, this));
  }

  // Serialize for save
  serialize() {
    return {
      year: this.year,
      season: this.season,
      day: this.day,
      hour: this.hour,
      minute: this.minute
    };
  }

  static deserialize(data) {
    const time = new TimeSystem();
    time.year = data.year;
    time.season = data.season;
    time.day = data.day;
    time.hour = data.hour;
    time.minute = data.minute;
    return time;
  }
}

module.exports = { TimeSystem, SEASONS, DAYS_PER_SEASON, SEEDS };
