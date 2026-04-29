/**
 * TimeSystem - Day/Season/Year cycle with weather
 * Stardew-style: 10 real seconds = 1 game hour (configurable)
 */

const {
  SEASONS, DAYS_PER_SEASON, DAY_START_HOUR, NIGHT_START_HOUR,
  MIDNIGHT_HOUR, HOURS_PER_DAY, MINUTES_PER_HOUR,
  GAME_MINUTES_PER_REAL_SECOND, DEFAULT_TIME_SCALE, RAIN_CHANCE
} = require('../utils/Constants');

const { SEED_NAMES_BY_SEASON } = require('../data/crops');

class TimeSystem {
  constructor() {
    this.year = 1;
    this.seasonIndex = 0; // 0-3
    this.day = 1;         // 1-28
    this.hour = DAY_START_HOUR;
    this.minute = 0;
    this.dayProgress = 0; // 0-1 through the day

    // Weather
    this.isRaining = false;
    this.rainTimer = 0;   // hours of rain remaining (0 = not raining)

    // Game time config
    this.timeScale = DEFAULT_TIME_SCALE;

    this.listeners = [];
  }

  /**
   * Called each game tick with elapsed real seconds.
   * @param {number} deltaTime - Real seconds since last update
   */
  update(deltaTime) {
    // Real time to game time: deltaTime * minutesPerSecond * timeScale
    const gameMinutes = deltaTime * GAME_MINUTES_PER_REAL_SECOND * this.timeScale;
    this.minute += gameMinutes;

    // Roll over minutes → hours
    while (this.minute >= MINUTES_PER_HOUR) {
      this.minute -= MINUTES_PER_HOUR;
      this.hour += 1;

      // Tick rain timer each game hour
      if (this.rainTimer > 0) {
        this.rainTimer -= 1;
        if (this.rainTimer <= 0) {
          this.isRaining = false;
          this.rainTimer = 0;
        }
      }
    }

    // Roll over hours → next day
    if (this.hour >= MIDNIGHT_HOUR) {
      this.hour -= HOURS_PER_DAY;
      this.nextDay();
    }

    // Calculate day progress (0 = 6am, 1 = 2am next day)
    const totalMinutes = (this.hour - DAY_START_HOUR + HOURS_PER_DAY) % HOURS_PER_DAY * MINUTES_PER_HOUR + this.minute;
    this.dayProgress = totalMinutes / (HOURS_PER_DAY * MINUTES_PER_HOUR);

    this.notifyListeners('timeUpdate');
  }

  nextDay() {
    this.day++;
    if (this.day > DAYS_PER_SEASON) {
      this.day = 1;
      this.seasonIndex++;
      if (this.seasonIndex >= SEASONS.length) {
        this.seasonIndex = 0;
        this.year++;
      }
    }

    // Roll for rain each new day
    this.rollWeather();

    this.notifyListeners('newDay');
  }

  /**
   * Roll for rain based on season chance.
   * Winter has no rain (snow instead, but functionally same).
   */
  rollWeather() {
    const season = this.getSeasonName();
    const chance = RAIN_CHANCE[season] || 0;
    const roll = Math.random() * 100;

    if (roll < chance) {
      this.isRaining = true;
      // Rain lasts 4-12 hours
      this.rainTimer = 4 + Math.floor(Math.random() * 8);
      this.notifyListeners('weatherChange');
    } else {
      this.isRaining = false;
      this.rainTimer = 0;
    }
  }

  getTimeString() {
    const h = this.hour.toString().padStart(2, '0');
    const m = Math.floor(this.minute).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  getSeasonName() {
    return SEASONS[this.seasonIndex];
  }

  getDateString() {
    return `Y${this.year} ${this.getSeasonName()} D${this.day}`;
  }

  /**
   * Returns seed names (without _seed suffix) available this season.
   * For backward compatibility and shop UIs.
   */
  getAvailableSeeds() {
    return SEED_NAMES_BY_SEASON[this.getSeasonName()] || [];
  }

  /**
   * Returns full seed IDs available this season.
   */
  getAvailableSeedIds() {
    const season = this.getSeasonName();
    const names = SEED_NAMES_BY_SEASON[season] || [];
    return names.map(name => `${name}_seed`);
  }

  isNight() {
    return this.hour >= NIGHT_START_HOUR || this.hour < DAY_START_HOUR;
  }

  isShopOpen() {
    // Shops open 9am-5pm, not on festival days
    return this.hour >= 9 && this.hour < 17;
  }

  /**
   * Get total days elapsed (for save display).
   */
  getTotalDays() {
    return (this.year - 1) * DAYS_PER_SEASON * SEASONS.length
      + this.seasonIndex * DAYS_PER_SEASON
      + this.day;
  }

  // ==================== LISTENERS ====================

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(l => {
      try {
        l({ event, time: this });
      } catch (e) {
        console.error('[TimeSystem] Listener error:', e);
      }
    });
  }

  // ==================== SERIALIZATION ====================

  serialize() {
    return {
      year: this.year,
      seasonIndex: this.seasonIndex,
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      isRaining: this.isRaining,
      rainTimer: this.rainTimer,
      timeScale: this.timeScale
    };
  }

  static deserialize(data) {
    const time = new TimeSystem();
    time.year = data.year;
    time.seasonIndex = data.seasonIndex;
    time.day = data.day;
    time.hour = data.hour;
    time.minute = data.minute;
    time.isRaining = data.isRaining || false;
    time.rainTimer = data.rainTimer || 0;
    time.timeScale = data.timeScale || DEFAULT_TIME_SCALE;
    return time;
  }
}

// Re-export for backward compatibility
module.exports = { TimeSystem, SEASONS, DAYS_PER_SEASON };
