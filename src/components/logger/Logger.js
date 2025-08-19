export default class Logger {
  static logs = [];
  static maxLogs = 1000;

  static addLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    this.logs.push(logEntry);
    this.trimLogs();
    this.persistLogs();
  }

  static log(message, data = null) {
    const timestamp = new Date().toISOString();
    
    // Use original console if available, otherwise use current
    const consoleMethod = this.originalConsole?.log || console.log;
    consoleMethod(`[${timestamp}] ${message}`, data || '');
    
    this.addLog('info', message, data);
  }

  static error(message, error = null) {
    const timestamp = new Date().toISOString();
    
    // Use original console if available, otherwise use current
    const consoleMethod = this.originalConsole?.error || console.error;
    consoleMethod(`[${timestamp}] ${message}`, error || '');
    
    this.addLog('error', message, error);
  }

  static warn(message, data = null) {
    const timestamp = new Date().toISOString();
    
    // Use original console if available, otherwise use current
    const consoleMethod = this.originalConsole?.warn || console.warn;
    consoleMethod(`[${timestamp}] ${message}`, data || '');
    
    this.addLog('warn', message, data);
  }

  static trimLogs() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  static persistLogs() {
    try {
      localStorage.setItem('venue-client-logs', JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to persist logs:', e);
    }
  }

  static loadLogs() {
    try {
      const stored = localStorage.getItem('venue-client-logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
      this.logs = [];
    }
  }

  static getLogs() {
    return [...this.logs];
  }

  static clearLogs() {
    this.logs = [];
    localStorage.removeItem('venue-client-logs');
  }
}