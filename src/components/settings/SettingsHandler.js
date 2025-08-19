export default class SettingsHandler {
  static settings = {};
  static listeners = [];
  static logger = null;

  static async init() {
    // Load settings from localStorage
    const stored = localStorage.getItem('venue-client-settings');
    if (stored) {
      try {
        this.settings = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored settings:', e);
        this.settings = {};
      }
    }
    
    // Set default values
    this.setDefaults();
  }

  static setDefaults() {
    const defaults = {
      checkUSBInterval: 30000,
      startRestartWindow: 2,
      endRestartWindow: 6,
      invenueHost: null
    };

    Object.keys(defaults).forEach(key => {
      if (this.settings[key] === undefined) {
        this.settings[key] = defaults[key];
      }
    });
  }

  static get(key) {
    return this.settings[key];
  }

  static set(key, value) {
    const oldValue = this.settings[key];
    this.settings[key] = value;
    
    // Persist to localStorage
    localStorage.setItem('venue-client-settings', JSON.stringify(this.settings));
    
    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(key, value, oldValue);
      } catch (e) {
        console.error('Settings listener error:', e);
      }
    });

    if (this.logger) {
      this.logger.log(`Setting updated: ${key} = ${value}`);
    }
  }

  static registerOnChange(callback) {
    this.listeners.push(callback);
  }

  static setLogger(logger) {
    this.logger = logger;
  }

  // Getters for common settings
  static get invenueHost() {
    return this.get('invenueHost');
  }

  static get checkUSBInterval() {
    return this.get('checkUSBInterval');
  }

  static get startRestartWindow() {
    return this.get('startRestartWindow');
  }

  static get endRestartWindow() {
    return this.get('endRestartWindow');
  }
}