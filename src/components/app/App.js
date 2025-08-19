import SettingsHandler from '../settings/SettingsHandler.js';
import Logger from '../logger/Logger.js';
import DisplayManager from '../display/DisplayManager.js';
import ApiClient from '../api/ApiClient.js';
import UI from './UI.js';

export default class App {
  constructor() {
    this.displayManager = new DisplayManager();
    this.apiClient = new ApiClient();
    this.ui = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      Logger.log('Initializing Venue Client PWA');
      
      // Clear localStorage to start fresh
      localStorage.removeItem('venue-client-settings');
      
      // Initialize settings
      await SettingsHandler.init();
      SettingsHandler.registerOnChange(this.onSettingsChanged.bind(this));
      
      // Initialize display management
      this.displayManager.init();
      
      // Set config defaults
      console.log('window.config:', window.config);
      if (window.config?.invenueHost) {
        console.log('Setting invenueHost from config:', window.config.invenueHost);
        SettingsHandler.set('invenueHost', window.config.invenueHost);
      }
      
      // Start API client if configured
      const invenueHost = SettingsHandler.get('invenueHost');
      console.log('Retrieved invenueHost from settings:', invenueHost);
      if (invenueHost) {
        this.apiClient.init(invenueHost);
      }
      
      // Request wake lock to keep display on
      this.requestWakeLock();
      
      // Set up fullscreen
      this.setupFullscreen();
      
      // Initialize UI
      this.ui = new UI(this);
      
      // Make app globally accessible for API callbacks
      window.app = this;
      
      // Check for display parameter and load appropriate URL
      const urlParams = new URLSearchParams(window.location.search);
      const displayNumber = urlParams.get('display') || '1';
      const existingUrl = localStorage.getItem(`venue-url-${displayNumber}`);
      if (existingUrl) {
        this.ui.loadContentUrl(existingUrl);
      }
      Logger.log(`Display ${displayNumber} initialized`);
      
      this.isInitialized = true;
      Logger.log('App initialized successfully');
      
    } catch (error) {
      Logger.error('Failed to initialize app:', error);
    }
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        Logger.log('Wake lock acquired');
        
        wakeLock.addEventListener('release', () => {
          Logger.log('Wake lock released');
        });
      } catch (err) {
        Logger.error('Failed to acquire wake lock:', err);
      }
    }
  }

  setupFullscreen() {
    // Auto-enter fullscreen after a delay (to allow user to see the interface first)
    setTimeout(() => {
      if (!document.fullscreenElement) {
        this.displayManager.requestFullscreen();
      }
    }, 3000);
  }

  onSettingsChanged(key, value) {
    Logger.log(`Setting changed: ${key} = ${value}`);
    
    if (key === 'invenueHost') {
      this.apiClient.updateHost(value);
    }
  }
}