import Logger from '../logger/Logger.js';

export default class ApiClient {
  constructor() {
    this.baseUrl = null;
    this.deviceId = null;
    this.isConnected = false;
    this.secondaryWindow = null;
    this.secondaryWindowOpened = false;
    this.generateDeviceId();
  }

  init(baseUrl) {
    this.baseUrl = baseUrl;
    console.log('API Client initialized with baseUrl:', baseUrl);
    this.startSession();
  }

  updateHost(newHost) {
    this.baseUrl = newHost;
    Logger.log(`API host updated to: ${newHost}`);
  }

  async generateDeviceId() {
    // Use config device ID if available
    if (window.config?.deviceId) {
      this.deviceId = window.config.deviceId;
      Logger.log(`Using config device ID: ${this.deviceId}`);
      return;
    }

    Logger.log(`navigator.managed is ${navigator.managed ? 'TRUE' : 'FALSE'}`);
    // Test navigator.managed.getSerialNumber() as Promise
    if (navigator.managed && typeof navigator.managed.getSerialNumber === 'function') {
      try {
        Logger.log('Attempting getSerialNumber()...');
        const serialNumber = await navigator.managed.getSerialNumber();
        Logger.log('Serial number:', serialNumber);
        if (serialNumber) {
          this.deviceId = serialNumber;
          Logger.log(`Using serial number as device ID: ${this.deviceId}`);
          return;
        }
      } catch (error) {
        Logger.error('getSerialNumber failed:', error.name, error.message);
      }
    } else {
      Logger.log('getSerialNumber method not available');
    }
    
    // Check policy status
    //  this.checkPolicyStatus();
    
    // Try to get managed device ID using navigator.managed
    // console.log("*****************")
    // if (navigator.managed) {
    //   Logger.log('navigator.managed IS Available');
      // if (typeof navigator.managed.getDirectoryId === 'function') {
      //   Logger.log('NavigatorManagedData API is available - attempting to get device ID');
      //   try {
      //     Logger.log('Calling navigator.managed.getDirectoryId()...');
          
      //     const directoryId = await navigator.managed.getDirectoryId();
          
      //     Logger.log('getDirectoryId() resolved with:', directoryId, typeof directoryId);
          
      //     if (directoryId && directoryId.trim && directoryId.trim()) {
      //       this.deviceId = directoryId;
      //       Logger.log(`Using managed directory ID: ${this.deviceId}`);
      //       return;
      //     } else {
      //       Logger.log('getDirectoryId() returned empty/null/undefined value');
      //     }
      //   } catch (error) {
      //     Logger.error('Managed directory ID error:', error?.name || 'Unknown', error?.message || 'No message');
      //     if (error?.stack) Logger.error('Error stack:', error.stack);
      //   }
      // } else {
      //   Logger.error('navigator.managed exists but getDirectoryId method is not available');
      //   Logger.error('This means NavigatorManagedData API is not fully implemented in this Chrome version');
      // }
   // }

    // No device ID available
    // Logger.log('No device ID available - will skip API calls');
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.baseUrl) {
      throw new Error('API base URL not configured');
    }

    const url = new URL(endpoint, this.baseUrl).toString();
    console.log('Making request to:', url);
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': this.deviceId
      }
    };

    const requestOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.isConnected = true;
      return data;
    } catch (error) {
      this.isConnected = false;
      Logger.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  async findDevice() {
    try {
      const result = await this.makeRequest(`/v1/invenue-service/display-devices/google/${encodeURIComponent(this.deviceId)}`);
      Logger.log('Device found:', result);
      return result;
    } catch (error) {
      Logger.error('Find device failed:', error);
      throw error;
    }
  }

  async sendConnect() {
    try {
      const displays = this.getDisplaysForConnect();
      const deviceIdentifier = this.serialNumber || this.deviceId;
      
      const result = await this.makeRequest(`/v1/invenue-service/display-devices/${encodeURIComponent(deviceIdentifier)}/connect`, {
        method: 'POST',
        body: JSON.stringify({ displays })
      });
      
      Logger.log('Connect successful:', result);
      
      this.handleConnectResponse(result);
      return result;
    } catch (error) {
      Logger.error('Connect failed:', error);
      throw error;
    }
  }

  getDisplaysForConnect() {
    if (this.detectedScreens && this.detectedScreens.length > 0) {
      const displays = this.detectedScreens.map(screen => ({
        width: screen.width,
        height: screen.height,
        left: screen.left,
        top: screen.top
      }));
      Logger.log(`Using ${displays.length} detected displays`);
      return displays;
    } else {
      Logger.log('Using single primary display');
      return [{ width: screen.width, height: screen.height }];
    }
  }

  handleConnectResponse(result) {
    this.storeConnectData(result);
    this.handleMultipleURLs(result);
    this.updateUI(result);
  }

  storeConnectData(result) {
    if (result.urls) {
      localStorage.setItem('venue-url-1', result.urls[0] || '');
      localStorage.setItem('venue-url-2', result.urls[1] || '');
      localStorage.setItem('venue-urls-updated', Date.now().toString());
      Logger.log('Display URLs:', result.urls);
    }
    
    if (result.terminalNumber) {
      localStorage.setItem('venue-terminal-number', result.terminalNumber);
    }
    if (result.assetId) {
      localStorage.setItem('venue-tab-asset-id', result.assetId);
    }
  }

  handleMultipleURLs(result) {
    if (!result.urls || result.urls.length <= 1) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const displayParam = urlParams.get('display');
    const hasMultipleScreens = this.detectedScreens && this.detectedScreens.length > 1;
    
    Logger.log(`Auto-open check: URLs=${result.urls.length}, displayParam='${displayParam}', screens=${this.detectedScreens?.length || 1}`);
    
    if ((!displayParam || displayParam === '1') && !this.secondaryWindowOpened) {
      if (hasMultipleScreens) {
        Logger.log('Multiple URLs and screens detected - auto-opening second display');
        this.secondaryWindowOpened = true;
        this.openSecondDisplay();
      } else {
        Logger.log('Multiple URLs but only 1 screen - showing URL 1 only');
      }
    } else {
      Logger.log('Auto-open skipped - single URL, secondary instance, or already opened');
    }
  }

  updateUI(result) {
    if (!result.urls || !window.app?.ui) {
      Logger.log('UpdateUI skipped - no URLs or UI not available');
      return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const displayNumber = parseInt(urlParams.get('display') || '1') - 1;
    const urlToLoad = result.urls[displayNumber] || result.urls[0];
    const displayConfig = result.displays && result.displays[displayNumber];
    
    Logger.log(`UpdateUI: displayNumber=${displayNumber}, urlToLoad='${urlToLoad}', totalUrls=${result.urls.length}`);
    
    if (displayConfig?.orientation !== undefined) {
      window.app.ui.setOrientation(displayConfig.orientation);
    }
    
    if (displayConfig?.overscan !== undefined) {
      window.app.ui.setOverscan(displayConfig.overscan);
    }
    
    if (urlToLoad) {
      window.app.ui.loadContentUrl(urlToLoad);
    } else {
      Logger.log('No URL to load for this display');
    }
  }

  async sendPoll() {
    try {
      const systemInfo = await this.getSystemInfo();
      const location = await this.getLocation();
      const deviceIdentifier = this.serialNumber || this.deviceId;
      const result = await this.makeRequest(`/v1/invenue-service/display-devices/${encodeURIComponent(deviceIdentifier)}/poll`, {
        method: 'POST',
        body: JSON.stringify({
          systemStatus: systemInfo,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null
        })
      });
      Logger.log('Poll successful:', result);
      this.isConnected = true;
      
      // Handle actions from poll response (like old app)
      if (result.actions) {
        this.handlePollActions(result.actions);
      }
      
      return result;
    } catch (error) {
      Logger.error('Poll failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async getSystemInfo() {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
      ipAddress: await this.getIpAddress()
    };

    // Add memory info if available (Chrome only)
    if (navigator.deviceMemory) {
      info.deviceMemory = navigator.deviceMemory; // GB
    }

    // Add connection info if available
    if (navigator.connection) {
      info.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      };
    }

    // Add hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency) {
      info.hardwareConcurrency = navigator.hardwareConcurrency;
    }

    // CPU and memory data not available in PWA
    // Would need Chrome extension or kiosk app for system access

    return info;
  }

  async startSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const displayNumber = urlParams.get('display');
    const ouStatus = urlParams.get('ou-status');
    
    // Check for unallocated device mode
    if (ouStatus === 'unallocated') {
      Logger.log('Unallocated device mode - showing device info screen');
      await this.showUnallocatedScreen();
      return;
    }
    
    // Only primary instance (display=1 or no display param) makes API calls
    if (!displayNumber || displayNumber === '1') {
      Logger.log('Primary instance - handling API calls');
      await this.startPrimarySession();
    } else {
      Logger.log(`Secondary instance (display=${displayNumber}) - listening for updates`);
      this.startSecondarySession();
    }
  }

  async startPrimarySession() {
    if (!this.deviceId) {
      Logger.log('No device ID available - skipping API calls');
      return;
    }
    
    try {
      // Try automatic screen detection first
      await this.detectScreens(true);
      
      // First find device to get serial number
      const deviceResult = await this.findDevice();
      if (deviceResult.serialNumber) {
        this.serialNumber = deviceResult.serialNumber;
        Logger.log(`Got serial number: ${this.serialNumber}`);
      }
      
      // Then connect using serial number
      const connectResult = await this.sendConnect();
      
      // Start polling with visibility handling
      this.sendPoll();
      const pollInterval = connectResult.pollInterval || 30000;
      this.startPolling(pollInterval);
      
    } catch (error) {
      Logger.error('Session start failed:', error);
      // Retry in 30 seconds
      setTimeout(() => {
        this.startPrimarySession();
      }, 30000);
    }
  }

  startSecondarySession() {
    // Listen for updates from primary instance
    window.addEventListener('storage', (event) => {
      if (event.key === 'venue-urls-updated') {
        Logger.log('URLs updated by primary instance');
        this.loadSecondaryContent();
      } else if (event.key === 'close-secondary-windows') {
        Logger.log('Received close signal - closing secondary window');
        window.close();
      } else if (event.key === 'identify-action') {
        const identifyData = JSON.parse(event.newValue);
        Logger.log('Received identify action:', identifyData.action);
        if (window.app && window.app.ui) {
          if (identifyData.action === 'identify') {
            window.app.ui.showIdentify(identifyData.displayTime || 10);
          } else if (identifyData.action === 'clear-identify') {
            window.app.ui.hideIdentify();
          }
        }
      }
    });
    
    // Load content immediately if URLs already exist
    this.loadSecondaryContent();
  }

  loadSecondaryContent() {
    const urlParams = new URLSearchParams(window.location.search);
    const displayNumber = parseInt(urlParams.get('display') || '1') - 1;
    
    const url1 = localStorage.getItem('venue-url-1');
    const url2 = localStorage.getItem('venue-url-2');
    const urls = [url1, url2].filter(Boolean);
    
    if (urls.length > displayNumber) {
      const urlToLoad = urls[displayNumber];
      if (window.app && window.app.ui) {
        window.app.ui.loadContentUrl(urlToLoad);
      }
    }
  }

  handlePollActions(actions) {
    actions.forEach(action => {
      Logger.log('Processing action:', action.action);
      
      if (action.action === 'reconnect') {
        Logger.log('Reconnect requested - calling /connect');
        this.sendConnect();
      } else if (action.action === 'reboot') {
        Logger.log('Reboot requested - reloading page');
        window.location.reload();
      } else if (action.action === 'identify') {
        Logger.log('Identify action received');
        // Broadcast identify to all windows
        localStorage.setItem('identify-action', JSON.stringify({
          action: 'identify',
          displayTime: action.displayTime || 10,
          timestamp: Date.now()
        }));
        if (window.app && window.app.ui) {
          window.app.ui.showIdentify(action.displayTime || 10);
        }
      } else if (action.action === 'clear-identify') {
        Logger.log('Clear identify action received');
        // Broadcast clear identify to all windows
        localStorage.setItem('identify-action', JSON.stringify({
          action: 'clear-identify',
          timestamp: Date.now()
        }));
        if (window.app && window.app.ui) {
          window.app.ui.hideIdentify();
        }
      } else if (action.action === 'clear-cache') {
        Logger.log('Clear cache requested');
        // Clear browser cache if possible
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
      }
    });
  }

  async getIpAddress() {
    try {
      return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/);
            if (ipMatch && !ipMatch[1].startsWith('127.')) {
              pc.close();
              resolve(ipMatch[1]);
              return;
            }
          }
        };
        
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        // Timeout after 3 seconds
        setTimeout(() => {
          pc.close();
          resolve(null);
        }, 3000);
      });
    } catch (error) {
      Logger.log('Failed to get IP address:', error);
      return null;
    }
  }

  async getLocation() {
    try {
      // Try Chrome OS device location first (if available)
      const deviceLocation = await this.getChromeOSLocation();
      if (deviceLocation) {
        return deviceLocation;
      }

      // Fallback to browser geolocation
      if (!navigator.geolocation) {
        Logger.log('Geolocation not supported');
        return null;
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            Logger.log('Geolocation error:', error.message);
            resolve(null);
          },
          {
            timeout: 10000,
            enableHighAccuracy: true, // More accurate for fixed devices
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    } catch (error) {
      Logger.log('Failed to get location:', error);
      return null;
    }
  }

  async getChromeOSLocation() {
    try {
      // Check if running in Chrome OS kiosk mode
      if (window.chrome && chrome.runtime && chrome.runtime.getManifest) {
        // Try to get location from Chrome OS device policy
        // This would be set via Google Admin Console device location
        const storedLocation = localStorage.getItem('chrome-os-device-location');
        if (storedLocation) {
          return JSON.parse(storedLocation);
        }
      }
      return null;
    } catch (error) {
      Logger.log('Chrome OS location not available:', error);
      return null;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      baseUrl: this.baseUrl,
      deviceId: this.deviceId
    };
  }

  updateDisplays(screens) {
    this.detectedScreens = screens;
    Logger.log('Updated display information:', screens.length, 'screens');
    
    // Optionally reconnect to update server with new display info
    if (this.isConnected) {
      Logger.log('Reconnecting to update display information...');
      this.sendConnect();
    }
  }

  openSecondDisplay() {
    // Signal any existing secondary windows to close
    localStorage.setItem('close-secondary-windows', Date.now().toString());
    
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('display', '2');
    
    // Try to position on second screen if detected
    let windowFeatures = 'fullscreen=yes';
    if (this.detectedScreens && this.detectedScreens.length > 1) {
      const secondScreen = this.detectedScreens[1];
      windowFeatures = `left=${secondScreen.left},top=${secondScreen.top},width=${secondScreen.width},height=${secondScreen.height}`;
      Logger.log(`Positioning window on screen 2 at (${secondScreen.left}, ${secondScreen.top})`);
    }
    
    this.secondaryWindow = window.open(currentUrl.toString(), '_blank', windowFeatures);
    if (this.secondaryWindow) {
      Logger.log('Auto-opened second display window');
      // Try to make it fullscreen after opening
      setTimeout(() => {
        if (this.secondaryWindow.document) {
          this.secondaryWindow.document.documentElement.requestFullscreen?.();
        }
      }, 1000);
    } else {
      Logger.error('Failed to auto-open second window - popup blocked by browser');
      this.showPopupBlockedNotification(currentUrl.toString());
    }
  }

  showPopupBlockedNotification(url) {
    // Create notification overlay
    const notification = document.createElement('div');
    notification.id = 'popup-blocked-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    
    notification.innerHTML = `
      <div style="margin-bottom: 10px;"><strong>Popup Blocked</strong></div>
      <div style="margin-bottom: 10px;">Second display window was blocked by browser.</div>
      <button onclick="window.open('${url}', '_blank'); this.parentElement.remove();" 
              style="background: white; color: #ff4444; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Open Manually</button>
      <button onclick="this.parentElement.remove();" 
              style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Dismiss</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
    
    Logger.log('Popup blocked notification shown');
  }

  async detectScreens(requirePermission = false) {
    if (!('getScreenDetails' in window)) {
      Logger.log('Multi-screen API not available');
      return false;
    }

    // Check permission first
    let granted = false;
    try {
      const { state } = await navigator.permissions.query({ name: 'window-management' });
      granted = state === 'granted';
      Logger.log(`Window management permission: ${state}`);
    } catch (error) {
      Logger.log('Permission query failed:', error.message);
    }

    if (requirePermission && !granted) {
      Logger.log('Window management permission not granted - skipping detection');
      return false;
    }

    try {
      Logger.log('Attempting screen detection...');
      const screenDetails = await window.getScreenDetails();
      this.detectedScreens = screenDetails.screens;
      Logger.log(`Detected ${screenDetails.screens.length} screens`);
      screenDetails.screens.forEach((screen, index) => {
        Logger.log(`Screen ${index + 1}: ${screen.width}x${screen.height} at (${screen.left}, ${screen.top})`);
      });
      
      // Set up screen change monitoring (only once)
      if (!this.screenMonitoringSetup) {
        this.setupScreenMonitoring(screenDetails);
        this.screenMonitoringSetup = true;
      }
      
      return true;
    } catch (error) {
      Logger.log('Screen detection failed:', error.message);
      return false;
    }
  }

  setupScreenMonitoring(screenDetails) {
    try {
      screenDetails.addEventListener('screenschange', () => {
        Logger.log('Screen configuration changed - re-evaluating displays');
        this.handleScreenChange();
      });
      Logger.log('Screen change monitoring enabled');
    } catch (error) {
      Logger.log('Screen monitoring setup failed:', error.message);
    }
  }

  async handleScreenChange() {
    const previousScreenCount = this.detectedScreens?.length || 1;
    
    // Re-detect screens
    await this.detectScreens(false);
    const currentScreenCount = this.detectedScreens?.length || 1;
    
    Logger.log(`Screen count changed: ${previousScreenCount} → ${currentScreenCount}`);
    
    // If we now have multiple screens and multiple URLs, open second display
    const url1 = localStorage.getItem('venue-url-1');
    const url2 = localStorage.getItem('venue-url-2');
    const hasMultipleUrls = url1 && url2;
    
    if (currentScreenCount > 1 && hasMultipleUrls && !this.secondaryWindowOpened) {
      const urlParams = new URLSearchParams(window.location.search);
      const displayParam = urlParams.get('display');
      
      if (!displayParam || displayParam === '1') {
        Logger.log('Multiple screens detected with multiple URLs - auto-opening second display');
        this.secondaryWindowOpened = true;
        this.openSecondDisplay();
      }
    }
    
    // If screen count decreased to 1, close secondary window
    if (currentScreenCount === 1 && previousScreenCount > 1) {
      Logger.log('Screen count decreased to 1 - closing secondary windows');
      this.closeSecondaryWindows();
    }
    
    // Update server with new screen configuration
    if (this.isConnected) {
      Logger.log('Updating server with new screen configuration');
      this.sendConnect();
    }
  }

  closeSecondaryWindows() {
    // Close our own secondary window if we have reference
    if (this.secondaryWindow && !this.secondaryWindow.closed) {
      Logger.log('Closing secondary window');
      this.secondaryWindow.close();
      this.secondaryWindow = null;
    }
    
    // Signal all secondary windows to close
    localStorage.setItem('close-secondary-windows', Date.now().toString());
    
    // Reset the flag so new windows can be opened later
    this.secondaryWindowOpened = false;
  }

  async showUnallocatedScreen() {
    try {
      const deviceInfo = await this.getDeviceAttributes();
      if (window.app?.ui) {
        window.app.ui.showUnallocatedDevice(deviceInfo);
      }
    } catch (error) {
      Logger.error('Failed to get device attributes:', error);
    }
  }

  async getDeviceAttributes() {
    const urlParams = new URLSearchParams(window.location.search);
    const info = {
      directoryDeviceId: null,
      serialNumber: null,
      assetId: null,
      location: null,
      ipAddress: await this.getIpAddress(),
      osVersion: this.getOSVersion(),
      clientVersion: __APP_VERSION__,
      displayNumber: urlParams.get('display') || '1'
    };

    if (navigator.managed) {
      try {
        info.directoryDeviceId = await navigator.managed.getDirectoryId();
        info.serialNumber = await navigator.managed.getSerialNumber();
        info.assetId = await navigator.managed.getAnnotatedAssetId();
        info.location = await navigator.managed.getAnnotatedLocation();
      } catch (error) {
        Logger.log('Some device attributes not available:', error);
      }
    }

    return info;
  }

  checkPolicyStatus() {
    try {
      // Check if we can access chrome.management API to get policy info
      if (window.chrome && chrome.management) {
        chrome.management.get(chrome.runtime.id, (info) => {
          Logger.log('Extension info:', info);
        });
      }
      
      // Try to detect kiosk mode
      const isKiosk = window.location.search.includes('kiosk') || 
                     document.fullscreenElement !== null ||
                     window.outerHeight === screen.height;
      Logger.error('Kiosk mode detected: ' + isKiosk);
      
      // Check if running in managed context
      const isManaged = !!navigator.managed;
      Logger.error('Managed context: ' + isManaged);
      
      // Log current URL for policy debugging
      Logger.error('Current URL for policy: ' + window.location.origin);
      
    } catch (error) {
      Logger.log('Policy check failed:', error.message);
    }
  }

  getOSVersion() {
    const userAgent = navigator.userAgent;
    const chromeOSMatch = userAgent.match(/CrOS\s+\S+\s+([^\)]+)/);
    if (chromeOSMatch) {
      return `Chrome OS ${chromeOSMatch[1]}`;
    }
    return navigator.platform || 'Unknown';
  }

  startPolling(interval) {
    this.pollInterval = interval;
    this.setupVisibilityHandling();
    this.scheduleNextPoll();
    this.keepScreenAwake();
  }

  keepScreenAwake() {
    let visibilityChange = "visibilitychange";
    
    if (typeof document.hidden !== "undefined") {
      document.addEventListener(visibilityChange, () => {
        if (document.hidden) {
          Logger.log('App went to background - maintaining wake lock');
        } else {
          Logger.log('App came to foreground - ensuring wake lock active');
          // Re-acquire wake lock when visible
          if (window.app?.displayManager) {
            window.app.displayManager.requestWakeLock();
          }
        }
      });
    }
    
    // More frequent activity to prevent sleep
    setInterval(() => {
      if (!document.hidden) {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1 }));
      }
    }, 5000); // Every 5 seconds when visible
  }

  setupVisibilityHandling() {
    if (this.visibilityHandlerSetup) return;
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Logger.log('Tab hidden - polling may be throttled');
      } else {
        Logger.log('Tab visible - resuming normal polling');
        // Send immediate poll when tab becomes visible
        this.sendPoll();
        this.scheduleNextPoll();
      }
    });
    
    this.visibilityHandlerSetup = true;
  }

  scheduleNextPoll() {
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
    }
    
    this.pollTimeout = setTimeout(() => {
      this.sendPoll();
      this.scheduleNextPoll();
    }, this.pollInterval);
  }
}