import SettingsHandler from '../settings/SettingsHandler.js';
import Logger from '../logger/Logger.js';

export default class UI {
  constructor(app) {
    this.app = app;
    this.settingsVisible = false;
    this.init();
  }

  init() {
    this.createUI();
    this.setupEventListeners();
    this.captureConsoleMessages();
    this.updateConnectionStatus();
    
    // Update connection status periodically
    setInterval(() => {
      this.updateConnectionStatus();
    }, 5000);
  }

  captureConsoleMessages() {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    // Store originals in Logger to avoid infinite loop
    Logger.originalConsole = {
      log: originalLog,
      error: originalError,
      warn: originalWarn,
      info: originalInfo
    };

    // Override console methods to capture messages
    console.log = (...args) => {
      const timestamp = new Date().toISOString();
      Logger.logs.push({
        timestamp,
        level: 'info',
        message: 'CONSOLE: ' + args.join(' '),
        data: null
      });
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      const timestamp = new Date().toISOString();
      Logger.logs.push({
        timestamp,
        level: 'error',
        message: 'CONSOLE ERROR: ' + args.join(' '),
        data: null
      });
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      const timestamp = new Date().toISOString();
      Logger.logs.push({
        timestamp,
        level: 'warn',
        message: 'CONSOLE WARN: ' + args.join(' '),
        data: null
      });
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      const timestamp = new Date().toISOString();
      Logger.logs.push({
        timestamp,
        level: 'info',
        message: 'CONSOLE INFO: ' + args.join(' '),
        data: null
      });
      originalInfo.apply(console, args);
    };
  }

  createUI() {
    const appDiv = document.getElementById('app');
    
    appDiv.innerHTML = `
      <div class="venue-content">
        <div id="content-frame"></div>
        <div class="device-info" style="position: fixed; bottom: 10px; left: 10px; font-size: 12px; background: rgba(0,0,0,0.7); padding: 5px; border-radius: 3px;">
          <p>Device: ${this.app.apiClient.deviceId}</p>
          <p>Screen: ${screen.width}x${screen.height}</p>
        </div>
      </div>
      
      <div class="status-indicator" id="status-indicator">
        Connecting...
      </div>
      
      <div class="settings-panel" id="settings-panel">
        <h3>Settings <span style="float: right; font-size: 14px; font-weight: normal; color: #999;">v${this.getVersion()}</span></h3>
        <div class="setting-group">
          <label for="invenue-host">InVenue Host:</label>
          <input type="url" id="invenue-host" value="${SettingsHandler.invenueHost || ''}" placeholder="https://api.example.com">
        </div>
        
        <div class="setting-group">
          <label>IP Address:</label>
          <span id="ip-address">Loading...</span>
        </div>

        <div class="setting-group">
          <label>Zoom:</label>
          <button onclick="window.ui.zoomOut()">-</button>
          <span id="zoom-level">100%</span>
          <button onclick="window.ui.zoomIn()">+</button>
          <button onclick="window.ui.resetZoom()">Reset</button>
        </div>
        <button onclick="window.ui.saveSettings()">Save</button>
        <button onclick="window.ui.toggleSettings()">Close</button>
        <button onclick="window.ui.showLogs()">View Logs</button>
        <button onclick="window.ui.detectScreens()">Detect Screens</button>
        <button onclick="window.ui.openSecondDisplay()">Open Display 2</button>
      </div>
      
      <div class="logs-panel" id="logs-panel" style="display: none; position: fixed; top: 50px; right: 20px; width: 700px; height: 400px; background: rgba(0,0,0,0.9); color: white; border-radius: 8px; font-family: monospace; font-size: 12px; z-index: 2000;">
        <div style="position: sticky; top: 0; background: rgba(0,0,0,0.9); padding: 10px; border-bottom: 1px solid #333; z-index: 1;">
          <h3 style="margin: 0;">Logs 
            <button onclick="window.ui.hideLogs()" style="float: right; background: #666; color: white; border: none; padding: 2px 8px; cursor: pointer;">×</button>
            <button onclick="window.ui.copyLogs()" style="background: #4CAF50; color: white; border: none; padding: 2px 8px; cursor: pointer; margin-right: 5px;">Copy</button>
            <button onclick="window.ui.clearLogs()" style="background: #4CAF50; color: white; border: none; padding: 2px 8px; cursor: pointer; margin-right: 5px;">Clear</button>
            <button onclick="window.ui.toggleLogsRefresh()" id="logs-refresh-btn" style="background: #f44336; color: white; border: none; padding: 2px 8px; cursor: pointer; margin-right: 5px;">Pause</button>
          </h3>
        </div>
        <div id="logs-content" style="padding: 10px; height: 340px; overflow-y: auto;"></div>
      </div>
    `;
    
    // Make UI accessible globally for button handlers
    window.ui = this;
  }

  setupEventListeners() {
    // Toggle settings with Ctrl+S
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.toggleSettings();
      }
      
      // Toggle fullscreen with F11
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }
    });

    // Double-click to show settings
    document.addEventListener('dblclick', () => {
      this.toggleSettings();
    });

    // Handle offline/online events
    window.addEventListener('offline', () => {
      Logger.log('Network disconnected - showing splash screen and identify overlay');
      this.showSplashScreen(true);
      this.showIdentify(0); // Show identify overlay indefinitely when offline
    });

    window.addEventListener('online', () => {
      Logger.log('Network reconnected');
      this.hideIdentify(); // Hide identify overlay when back online
      
      // Reload content to hide splash screen
      const urlParams = new URLSearchParams(window.location.search);
      const displayNumber = urlParams.get('display') || '1';
      const existingUrl = localStorage.getItem(`venue-url-${displayNumber}`);
      if (existingUrl) {
        this.loadContentUrl(existingUrl);
      }
    });
  }

  toggleSettings() {
    this.settingsVisible = !this.settingsVisible;
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('visible', this.settingsVisible);
    
    // Update IP address when settings are shown
    if (this.settingsVisible) {
      this.updateIPAddress();
    }
  }

  async updateIPAddress() {
    const ipElement = document.getElementById('ip-address');
    if (!ipElement) return;
    
    try {
      // Use the same IP address that ApiClient uses for polling
      const ipAddress = await this.app.apiClient.getIpAddress();
      if (ipAddress) {
        ipElement.textContent = ipAddress;
      } else {
        ipElement.textContent = 'IP address not available';
      }
    } catch (error) {
      ipElement.textContent = 'Error getting IP';
    }
  }

  saveSettings() {
    const invenueHost = document.getElementById('invenue-host').value;

    if (invenueHost) {
      SettingsHandler.set('invenueHost', invenueHost);
    }

    Logger.log('Settings saved');
    this.toggleSettings();
  }

  clearLogs() {
    Logger.clearLogs();
    Logger.log('Logs cleared');
    // Refresh the logs display if panel is open
    if (document.getElementById('logs-panel').style.display === 'block') {
      this.refreshLogs();
    }
  }

  showLogs() {
    this.refreshLogs();
    document.getElementById('logs-panel').style.display = 'block';
    this.logsRefreshEnabled = true;
    
    // Auto-refresh logs every 2 seconds while panel is open
    this.logsInterval = setInterval(() => {
      if (document.getElementById('logs-panel').style.display === 'block' && this.logsRefreshEnabled) {
        this.refreshLogs();
      }
    }, 2000);
  }

  refreshLogs() {
    const logs = Logger.getLogs();
    const logsContent = document.getElementById('logs-content');
    const wasAtBottom = logsContent.scrollTop + logsContent.clientHeight >= logsContent.scrollHeight - 5;
    
    logsContent.innerHTML = logs.map(log => 
      `<div>[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}</div>`
    ).join('');
    
    // Only auto-scroll to bottom if user was already at the bottom
    if (wasAtBottom) {
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  }

  hideLogs() {
    document.getElementById('logs-panel').style.display = 'none';
    if (this.logsInterval) {
      clearInterval(this.logsInterval);
      this.logsInterval = null;
    }
  }

  copyLogs() {
    const logs = Logger.getLogs();
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(logText).then(() => {
        Logger.log('Logs copied to clipboard');
      }).catch(err => {
        Logger.log('Clipboard API failed, trying fallback method');
        this.fallbackCopyLogs(logText);
      });
    } else {
      // Fallback for older browsers or insecure contexts
      this.fallbackCopyLogs(logText);
    }
  }
 // TODO remove fallback - just needed whilst hosting PWA over http
  fallbackCopyLogs(logText) {
    try {
      // Create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = logText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      
      // Select and copy
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const success = document.execCommand('copy');
      
      // Clean up
      document.body.removeChild(textarea);
      
      if (success) {
        Logger.log('Logs copied to clipboard (fallback method)');
      } else {
        Logger.error('Failed to copy logs - copy not supported');
      }
    } catch (err) {
      Logger.error('Fallback copy failed:', err.message);
    }
  }

  toggleLogsRefresh() {
    this.logsRefreshEnabled = !this.logsRefreshEnabled;
    const btn = document.getElementById('logs-refresh-btn');
    
    if (this.logsRefreshEnabled) {
      btn.textContent = 'Pause';
      btn.style.background = '#f44336';
      Logger.log('Logs refresh resumed');
    } else {
      btn.textContent = 'Resume';
      btn.style.background = '#4CAF50';
      Logger.log('Logs refresh paused');
    }
  }

  updateConnectionStatus() {
    const indicator = document.getElementById('status-indicator');
    const status = this.app.apiClient.getConnectionStatus();
    
    if (status.isConnected) {
      indicator.textContent = 'Connected';
      indicator.className = 'status-indicator connected';
    } else {
      indicator.textContent = 'Disconnected';
      indicator.className = 'status-indicator disconnected';
    }
  }

  async toggleFullscreen() {
    if (document.fullscreenElement) {
      await this.app.displayManager.exitFullscreen();
    } else {
      await this.app.displayManager.requestFullscreen();
    }
  }

  loadContentUrl(url) {
    const contentFrame = document.getElementById('content-frame');
    if (url) {
      this.showSplashScreen(true);
      const iframe = document.createElement('iframe');
      iframe.src = url;
      if (this.currentOverscan) {
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
      } else {
        iframe.style.cssText = 'width: 100vw; height: 100vh; border: none;';
      }
      
      iframe.onload = () => {
        // Hide splash screen after content loads
        setTimeout(() => {
          this.showSplashScreen(false);
        }, 1000);
      };
      
      iframe.onerror = () => {
        Logger.error('Failed to load content URL:', url);
        // Keep splash screen visible on error
      };
      
      contentFrame.innerHTML = '';
      contentFrame.appendChild(iframe);
      Logger.log('Loading content URL:', url);
    } else {
      this.showSplashScreen(true);
      contentFrame.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white;"><h2>Waiting for content URL...</h2></div>';
    }
  }

  showSplashScreen(show) {
    let splashScreen = document.getElementById('splash-screen');
    
    if (!splashScreen && show) {
      // Create splash screen
      splashScreen = document.createElement('div');
      splashScreen.id = 'splash-screen';
      splashScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000 url('/splash-${screen.height > screen.width ? 'portrait' : 'landscape'}-tab.svg') center center no-repeat;
        background-size: contain;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      document.body.appendChild(splashScreen);
    }
    
    if (splashScreen) {
      splashScreen.style.display = show ? 'flex' : 'none';
    }
    
    Logger.log(`Splash screen ${show ? 'shown' : 'hidden'}`);
  }

  setOrientation(degrees) {
    this.currentRotation = degrees;
    this.updateTransform();
    
    // Apply rotation to entire app container
    const appContainer = document.getElementById('app');
    if (degrees === 0) {
      appContainer.style.transform = 'none';
    } else {
      appContainer.style.transform = `rotate(${degrees}deg)`;
      appContainer.style.transformOrigin = 'center center';
    }
    
    // Adjust viewport dimensions for 90/270 degree rotations
    if (degrees === 90 || degrees === 270) {
      appContainer.style.width = '100vh';
      appContainer.style.height = '100vw';
    } else {
      appContainer.style.width = '100vw';
      appContainer.style.height = '100vh';
    }
    
    Logger.log(`Applied CSS rotation: ${degrees} degrees`);
  }

  setOverscan(overscan) {
    const contentFrame = document.getElementById('content-frame');
    this.currentOverscan = overscan;
    
    if (overscan) {
      // Apply 40px inset on all sides (like old app)
      contentFrame.style.position = 'absolute';
      contentFrame.style.top = '40px';
      contentFrame.style.left = '40px';
      contentFrame.style.right = '40px';
      contentFrame.style.bottom = '40px';
      contentFrame.style.width = 'auto';
      contentFrame.style.height = 'auto';
    } else {
      // Remove overscan - fill viewport
      contentFrame.style.position = 'static';
      contentFrame.style.top = 'auto';
      contentFrame.style.left = 'auto';
      contentFrame.style.right = 'auto';
      contentFrame.style.bottom = 'auto';
      contentFrame.style.width = '100vw';
      contentFrame.style.height = '100vh';
    }
    
    // Update iframe sizing if content is loaded
    const iframe = contentFrame.querySelector('iframe');
    if (iframe) {
      if (overscan) {
        iframe.style.width = '100%';
        iframe.style.height = '100%';
      } else {
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
      }
    }
    
    Logger.log(`Applied CSS overscan: ${overscan}`);
  }

  updateTransform() {
    const contentFrame = document.getElementById('content-frame');
    const zoom = this.currentZoom || 1;
    
    if (zoom === 1) {
      contentFrame.style.transform = 'none';
    } else {
      contentFrame.style.transform = `scale(${zoom})`;
      contentFrame.style.transformOrigin = 'center center';
    }
  }

  zoomIn() {
    this.currentZoom = (this.currentZoom || 1) + 0.1;
    this.updateTransform();
    this.updateZoomDisplay();
    Logger.log(`Zoom in: ${Math.round(this.currentZoom * 100)}%`);
  }

  zoomOut() {
    this.currentZoom = Math.max(0.1, (this.currentZoom || 1) - 0.1);
    this.updateTransform();
    this.updateZoomDisplay();
    Logger.log(`Zoom out: ${Math.round(this.currentZoom * 100)}%`);
  }

  resetZoom() {
    this.currentZoom = 1;
    this.updateTransform();
    this.updateZoomDisplay();
    Logger.log('Zoom reset to 100%');
  }

  updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round((this.currentZoom || 1) * 100)}%`;
    }
  }

  showIdentify(displayTimeSeconds) {
    // Create identify overlay matching old venue client style
    const overlay = document.createElement('div');
    overlay.id = 'identify-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
    `;
    
    // Get stored values like old app
    const terminalNumber = localStorage.getItem('venue-terminal-number') || '';
    const tabAssetId = localStorage.getItem('venue-tab-asset-id') || '';
    const displayNumber = new URLSearchParams(window.location.search).get('display') || '1';
    
    let displayText = '';
    if (terminalNumber) {
      displayText = `${terminalNumber}/${displayNumber}`;
    }
    
    let assetText = '';
    if (tabAssetId) {
      let assetId = tabAssetId;
      const dashIndex = assetId.indexOf('-');
      if (dashIndex > 0) assetId = assetId.substring(dashIndex + 1);
      assetText = `Asset ID: ${assetId}`;
    }
    
    overlay.innerHTML = `
      <div style="
        display: flex;
        align-items: baseline;
        text-align: left;
        font-size: 72px;
        font-weight: bold;
        opacity: 0.8;
        text-shadow: -4px -4px 0 rgba(64, 64, 64, 0.8), 4px -4px 0 rgba(64, 64, 64, 0.8), -4px 4px 0 rgba(64, 64, 64, 0.8), 4px 4px 0 rgba(64, 64, 64, 0.8);
        color: #e0e0e0;
        position: absolute;
        left: 32px;
        top: 8px;
      ">
        <div id="display-identifier">${displayText}</div>
        <div id="asset-identifier" style="font-size: 48px; padding-left: 8px;">${assetText}</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-hide timer (only if displayTimeSeconds > 0)
    if (displayTimeSeconds > 0) {
      this.identifyTimer = setTimeout(() => {
        this.hideIdentify();
      }, displayTimeSeconds * 1000);
      Logger.log(`Identify overlay shown for ${displayTimeSeconds} seconds`);
    } else {
      Logger.log('Identify overlay shown indefinitely (offline mode)');
    }
  }

  hideIdentify() {
    const overlay = document.getElementById('identify-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    if (this.identifyTimer) {
      clearInterval(this.identifyTimer);
      this.identifyTimer = null;
    }
    
    Logger.log('Identify overlay hidden');
  }

  async detectScreens() {
    // Delegate to ApiClient's centralized screen detection
    if (window.app && window.app.apiClient) {
      await window.app.apiClient.detectScreens(false);
    }
  }

  openSecondDisplay() {
    // Delegate to ApiClient which has the advanced screen positioning logic
    if (window.app && window.app.apiClient) {
      window.app.apiClient.openSecondDisplay();
    }
  }

  getVersion() {
    return __APP_VERSION__;
  }

  showUnallocatedDevice(deviceInfo) {
    const contentFrame = document.getElementById('content-frame');
    
    contentFrame.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background: #1a1a1a;
        color: white;
        font-family: Arial, sans-serif;
        padding: 40px;
        box-sizing: border-box;
      ">
        <h1 style="color: #4CAF50; margin-bottom: 40px; font-size: 48px;">Unallocated Device</h1>
        
        <div style="
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 20px 40px;
          font-size: 24px;
          max-width: 800px;
          width: 100%;
        ">
          <div style="font-weight: bold; text-align: right;">Client Version:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.clientVersion}</div>
          
          <div style="font-weight: bold; text-align: right;">Display Number:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.displayNumber}</div>
          
          <div style="font-weight: bold; text-align: right;">Directory Device ID:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.directoryDeviceId || 'Not available'}</div>
          
          <div style="font-weight: bold; text-align: right;">Serial Number:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.serialNumber || 'Not available'}</div>
          
          <div style="font-weight: bold; text-align: right;">Asset ID:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.assetId || 'Not available'}</div>
          
          <div style="font-weight: bold; text-align: right;">Location:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.location || 'Not available'}</div>
          
          <div style="font-weight: bold; text-align: right;">IP Address:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.ipAddress || 'Not available'}</div>
          
          <div style="font-weight: bold; text-align: right;">OS Version:</div>
          <div style="font-family: monospace; color: #e0e0e0;">${deviceInfo.osVersion || 'Not available'}</div>
        </div>
        
        <div style="margin-top: 60px; font-size: 18px; color: #999; text-align: center;">
          This device is not allocated to a venue.
        </div>
      </div>
    `;
    
    // Auto-enter fullscreen for unallocated screen
    setTimeout(() => {
      this.app.displayManager.requestFullscreen();
    }, 1000);
    
    Logger.log('Unallocated device screen displayed');
  }
}