import Logger from '../logger/Logger.js';

export default class DisplayManager {
  constructor() {
    this.displays = [];
    this.mediaQuery = null;
    this.wakeLock = null;
  }

  init() {
    this.detectDisplays();
    this.setupDisplayChangeListener();
    this.setupOrientationListener();
    this.requestWakeLock();
  }

  detectDisplays() {
    // In PWA, we can't directly access multiple displays like Chrome apps
    // But we can detect screen properties and orientation
    const display = {
      id: 'primary',
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation?.type || 'unknown'
    };

    this.displays = [display];
    Logger.log('Display detected:', display);
  }

  setupDisplayChangeListener() {
    // Listen for screen size changes
    window.addEventListener('resize', () => {
      Logger.log('Screen resize detected');
      this.detectDisplays();
    });
  }

  setupOrientationListener() {
    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => {
        Logger.log('Orientation changed:', screen.orientation.type);
        this.detectDisplays();
      });
    }
  }

  getDisplays() {
    return [...this.displays];
  }

  // PWA equivalent of Chrome's display management
  async requestFullscreen() {
    try {
      if (!document.fullscreenElement) {
        // Check if fullscreen is supported
        if (!document.documentElement.requestFullscreen) {
          Logger.log('Fullscreen API not supported');
          return;
        }
        
        await document.documentElement.requestFullscreen();
        Logger.log('Entered fullscreen mode');
      }
    } catch (error) {
      // Don't log as error - fullscreen may be blocked by browser policy
      Logger.log('Fullscreen request denied (this is normal in some browsers):', error.message);
    }
  }

  async exitFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        Logger.log('Exited fullscreen mode');
      }
    } catch (error) {
      Logger.error('Failed to exit fullscreen:', error);
    }
  }

  // Lock screen orientation (mobile/tablet)
  async lockOrientation(orientation) {
    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock(orientation);
        Logger.log(`Orientation locked to: ${orientation}`);
      } catch (error) {
        Logger.error('Failed to lock orientation:', error);
      }
    }
  }

  // Keep screen awake for venue displays
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        Logger.log('Screen wake lock acquired');
        
        // Monitor wake lock status
        this.wakeLock.addEventListener('release', () => {
          Logger.log('Wake lock was released - reacquiring...');
          setTimeout(() => this.requestWakeLock(), 1000);
        });
        
        // Re-acquire wake lock when page becomes visible
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && !this.wakeLock) {
            this.requestWakeLock();
          }
        });
        
      } catch (error) {
        Logger.log('Wake lock not available:', error.message);
        // Fallback: simulate activity to prevent sleep
        this.simulateActivity();
      }
    } else {
      Logger.log('Wake lock API not supported - using activity simulation');
      this.simulateActivity();
    }
  }

  // Fallback method to prevent screen sleep
  simulateActivity() {
    // Create invisible video element to prevent sleep
    const video = document.createElement('video');
    video.style.position = 'absolute';
    video.style.top = '-1px';
    video.style.left = '-1px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.muted = true;
    video.loop = true;
    video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMWF2YzEAAAAIZnJlZQAAAr1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAABWWWIhAA3//728P4FNjuY0JcRzeidDNtgUg==';
    document.body.appendChild(video);
    video.play().catch(() => {});
    
    setInterval(() => {
      // Multiple activity types
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Shift'}));
      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 1, clientY: 1}));
      document.dispatchEvent(new Event('touchstart'));
    }, 3000);
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      Logger.log('Screen wake lock released');
    }
  }
}