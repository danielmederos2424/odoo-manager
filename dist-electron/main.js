"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const util = require("util");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
let electronAPI = null;
const isElectron = () => {
  return typeof window !== "undefined" && window.process && window.process.type;
};
try {
  if (typeof window !== "undefined" && window.process && window.process.type) {
    electronAPI = window.require("electron");
  }
} catch (e) {
}
const getElectronAPI = () => {
  if (electronAPI) {
    return electronAPI;
  }
  if (isElectron()) {
    electronAPI = window.require("electron");
    return electronAPI;
  }
  return null;
};
const localLogInfo = (message, data) => {
  console.log(`[INFO] ${message}${""}`);
};
const localLogError = (message, error) => {
  console.error(`[ERROR] ${message}`, error);
};
function getAppDataPath() {
  const appName = "odoo-manager";
  try {
    const electron2 = getElectronAPI();
    if (electron2 == null ? void 0 : electron2.ipcRenderer) {
      try {
        const electronPath = electron2.ipcRenderer.sendSync("get-app-path-sync", "userData");
        if (electronPath) {
          localLogInfo(`Got app data path from Electron: ${electronPath}`);
          return electronPath;
        }
      } catch (electronError) {
        localLogError("Failed to get app data path from Electron:", electronError);
      }
    }
    let appDataPath = "";
    switch (process.platform) {
      case "win32":
        appDataPath = path__namespace.join(process.env.APPDATA || "", appName);
        break;
      case "darwin":
        appDataPath = path__namespace.join(os__namespace.homedir(), "Library", "Application Support", appName);
        break;
      case "linux":
        appDataPath = path__namespace.join(os__namespace.homedir(), ".config", appName);
        break;
      default:
        appDataPath = path__namespace.join(os__namespace.homedir(), `.${appName}`);
    }
    localLogInfo(`Using platform-specific app data path: ${appDataPath}`);
    return appDataPath;
  } catch (error) {
    localLogError("Error getting app data path:", error);
    const fallbackPath = path__namespace.join(os__namespace.homedir(), appName);
    localLogInfo(`Falling back to home directory path: ${fallbackPath}`);
    return fallbackPath;
  }
}
function ensureDir(dirPath) {
  if (!fs__namespace.existsSync(dirPath)) {
    fs__namespace.mkdirSync(dirPath, { recursive: true });
  }
}
function getLocalLogsPath(customWorkDirPath) {
  const appName = "odoo-manager";
  try {
    const basePath = customWorkDirPath || path__namespace.join(os__namespace.homedir(), "Library", "Application Support", appName);
    const logsPath = path__namespace.join(basePath, "logs");
    if (!fs__namespace.existsSync(logsPath)) {
      fs__namespace.mkdirSync(logsPath, { recursive: true });
    }
    return logsPath;
  } catch (error) {
    console.error("Error getting logs path:", error);
    return path__namespace.join(os__namespace.tmpdir(), appName, "logs");
  }
}
let GLOBAL_LOGGER_INITIALIZED = false;
let ACTIVE_LOG_FILE_PATH = null;
let SESSION_HEADERS_WRITTEN = {};
const LOG_FILE_SIZE_LIMIT$1 = 5 * 1024 * 1024;
const MAX_LOG_FILES$1 = 5;
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  return LogLevel2;
})(LogLevel || {});
const _Logger = class _Logger {
  constructor() {
    __publicField(this, "logLevel", 1);
    __publicField(this, "logFile", "");
    __publicField(this, "initialized", false);
    __publicField(this, "windowId", null);
    this.logLevel = 0;
  }
  /**
   * Set the window ID for this logger instance
   * @param id Window ID
   */
  setWindowId(id) {
    this.windowId = id;
  }
  /**
   * Get the window ID for this logger instance
   * @returns Window ID or null if not set
   */
  getWindowId() {
    return this.windowId;
  }
  /**
   * Fetch the window ID from the main process
   * @returns Promise that resolves to window ID or null
   */
  async fetchWindowId() {
    if (!isElectron() || this.windowId !== null) return this.windowId;
    try {
      const ipcRenderer = window.ipcRenderer;
      if (ipcRenderer && ipcRenderer.invoke) {
        this.windowId = await ipcRenderer.invoke("get-window-id");
        return this.windowId;
      }
    } catch (error) {
      console.error("Failed to get window ID:", error);
    }
    return null;
  }
  /**
   * Check with main process if there's already an active log file
   * @returns Path to existing log file or null
   */
  static getExistingLogFile() {
    if (isElectron()) {
      try {
        const ipcRenderer = window.ipcRenderer;
        if (ipcRenderer && ipcRenderer.invoke) {
          return null;
        }
      } catch (error) {
        console.error("Failed to get existing log file:", error);
      }
    }
    return null;
  }
  /**
   * Register log file with main process
   * @param logFile Path to log file
   */
  static registerLogFile(logFile) {
    if (isElectron() && logFile && fs__namespace.existsSync(logFile)) {
      try {
        const ipcRenderer = window.ipcRenderer;
        if (ipcRenderer && ipcRenderer.send) {
          ipcRenderer.send("register-log-file", logFile);
          ACTIVE_LOG_FILE_PATH = logFile;
        }
      } catch (error) {
        console.error("Failed to register log file with main process:", error);
      }
    }
  }
  /**
   * Clean up old log files older than specified days
   * This is kept for compatibility but not actively used with rotation-based approach
   * @param days Number of days to keep logs (default: 7)
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanupOldLogFiles(days = 7) {
    try {
      const logFiles = this.getLogFiles();
      if (logFiles.length === 0) {
        return;
      }
      console.log(`Checking for log files older than ${days} days to clean up`);
      const now = (/* @__PURE__ */ new Date()).getTime();
      const maxAge = days * 24 * 60 * 60 * 1e3;
      const threshold = now - maxAge;
      const oldFiles = logFiles.filter((file) => {
        if (file === this.logFile || file === ACTIVE_LOG_FILE_PATH) {
          return false;
        }
        const baseLogName = path__namespace.basename(this.logFile || "", ".log");
        if (path__namespace.basename(file).startsWith(`${baseLogName}.`) && path__namespace.basename(file).endsWith(".log")) {
          return false;
        }
        try {
          const stats = fs__namespace.statSync(file);
          const fileTime = Math.min(stats.birthtimeMs, stats.mtimeMs);
          return fileTime < threshold;
        } catch (err) {
          console.error(`Error checking file age for ${file}:`, err);
          return false;
        }
      });
      if (oldFiles.length > 0) {
        console.log(`Found ${oldFiles.length} log files older than ${days} days to delete`);
        for (const file of oldFiles) {
          try {
            fs__namespace.unlinkSync(file);
            console.log(`Deleted old log file: ${file}`);
          } catch (err) {
            console.error(`Error deleting old log file ${file}:`, err);
          }
        }
      } else {
        console.log(`No log files older than ${days} days found`);
      }
    } catch (err) {
      console.error("Error during log file cleanup:", err);
    }
  }
  /**
   * Check if we've already written session headers for the current log file
   * @param sessionType Type of session header (start, resume)
   * @returns True if headers already written, false otherwise
   */
  isSessionHeaderWritten(sessionType) {
    if (!this.logFile) return false;
    const key = `${this.logFile}:${sessionType}:${this.windowId || "unknown"}`;
    return SESSION_HEADERS_WRITTEN[key] === true;
  }
  /**
   * Mark session headers as written for the current log file
   * @param sessionType Type of session header (start, resume)
   */
  markSessionHeaderWritten(sessionType) {
    if (!this.logFile) return;
    const key = `${this.logFile}:${sessionType}:${this.windowId || "unknown"}`;
    SESSION_HEADERS_WRITTEN[key] = true;
  }
  /**
   * Initialize the logger with settings
   * @returns Promise that resolves when initialization is complete
   */
  async initialize() {
    if (isElectron() && this.windowId === null) {
      await this.fetchWindowId();
    }
    if (GLOBAL_LOGGER_INITIALIZED) {
      console.log(`Logger already initialized globally, using existing instance (window ${this.windowId})`);
      if (ACTIVE_LOG_FILE_PATH && fs__namespace.existsSync(ACTIVE_LOG_FILE_PATH)) {
        this.logFile = ACTIVE_LOG_FILE_PATH;
        this.initialized = true;
        if (!this.isSessionHeaderWritten("resume")) {
          try {
            const sessionMessage = `
===============================================
Session resumed: ${this.formatTimestamp(/* @__PURE__ */ new Date())}
===============================================
`;
            fs__namespace.appendFileSync(this.logFile, sessionMessage);
            this.markSessionHeaderWritten("resume");
          } catch (err) {
            console.error("Error writing session separator to log file:", err);
          }
        }
      }
      return;
    }
    let existingLogFile = null;
    if (isElectron()) {
      try {
        const ipcRenderer = window.ipcRenderer;
        if (ipcRenderer && ipcRenderer.invoke) {
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 500));
          existingLogFile = await Promise.race([
            ipcRenderer.invoke("get-active-log-file"),
            timeoutPromise
          ]);
        }
      } catch (error) {
        console.error("Failed to get existing log file asynchronously:", error);
      }
    }
    if (existingLogFile && fs__namespace.existsSync(existingLogFile)) {
      console.log(`Using existing global log file: ${existingLogFile} (window ${this.windowId})`);
      this.logFile = existingLogFile;
      this.initialized = true;
      GLOBAL_LOGGER_INITIALIZED = true;
      if (!this.isSessionHeaderWritten("resume")) {
        try {
          const sessionMessage = `
===============================================
Session resumed: ${this.formatTimestamp(/* @__PURE__ */ new Date())}
===============================================
`;
          fs__namespace.appendFileSync(this.logFile, sessionMessage);
          this.markSessionHeaderWritten("resume");
        } catch (err) {
          console.error("Error writing session separator to log file:", err);
        }
      }
      return;
    }
    console.log(`Initializing logger for window ${this.windowId}...`);
    try {
      const workDirPath = await settingsService.getWorkDirPath();
      console.log(`Work directory: ${workDirPath || "not set"}`);
      const logsPath = getLocalLogsPath(workDirPath || void 0);
      console.log(`Logs directory: ${logsPath}`);
      this.logFile = path__namespace.join(logsPath, "app.log");
      console.log(`Using main log file at: ${this.logFile}`);
      if (!fs__namespace.existsSync(this.logFile)) {
        const now = /* @__PURE__ */ new Date();
        const initialMessage = `===============================================
Odoo Manager - Application Log (Main Process)
Started: ${this.formatTimestamp(now)}
Environment: ${"development"}
===============================================
`;
        fs__namespace.writeFileSync(this.logFile, initialMessage);
        this.markSessionHeaderWritten("start");
      } else if (!this.isSessionHeaderWritten("start")) {
        const sessionMessage = `
===============================================
Session started: ${this.formatTimestamp(/* @__PURE__ */ new Date())}
===============================================
`;
        fs__namespace.appendFileSync(this.logFile, sessionMessage);
        this.markSessionHeaderWritten("start");
      }
      ACTIVE_LOG_FILE_PATH = this.logFile;
      _Logger.registerLogFile(this.logFile);
      console.log(`Logger initialized with file: ${this.logFile}`);
      this.initialized = true;
      GLOBAL_LOGGER_INITIALIZED = true;
      this.info("Logger initialized successfully");
      this.info(`Log files will be rotated when they reach ${LOG_FILE_SIZE_LIMIT$1 / (1024 * 1024)} MB`);
      this.info(`Registered active log file: ${this.logFile}`);
    } catch (err) {
      console.error("Failed to initialize logger:", err);
    }
  }
  /**
   * Format date for log filename (YYYY-MM-DD-HH-MM-SS)
   * @param date Date object to format
   * @returns Formatted date string suitable for filenames
   */
  formatDateForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  }
  /**
   * Format timestamp for log entries
   * @param date Date object to format
   * @returns Formatted timestamp string
   */
  formatTimestamp(date) {
    return date.toLocaleString();
  }
  /**
   * Get logger instance (singleton pattern)
   * @returns Logger instance
   */
  static getInstance() {
    if (!_Logger.instance) {
      _Logger.instance = new _Logger();
    }
    return _Logger.instance;
  }
  /**
   * Set the log level
   * @param level LogLevel to set
   */
  setLogLevel(level) {
    this.logLevel = level;
  }
  /**
   * Get the current log file path
   * @returns Path to the active log file
   */
  getLogFilePath() {
    return this.logFile;
  }
  /**
   * Check if log file needs rotation based on size
   * @returns true if log rotation was performed, false otherwise
   */
  checkAndRotateLogFile() {
    if (!this.initialized || !this.logFile || !fs__namespace.existsSync(this.logFile)) {
      return false;
    }
    try {
      const stats = fs__namespace.statSync(this.logFile);
      if (stats.size < LOG_FILE_SIZE_LIMIT$1) {
        return false;
      }
      console.log(`Log file size (${stats.size} bytes) exceeds limit (${LOG_FILE_SIZE_LIMIT$1} bytes), rotating logs...`);
      const logsDir = path__namespace.dirname(this.logFile);
      const baseLogName = path__namespace.basename(this.logFile, ".log");
      const rotatedLogs = fs__namespace.readdirSync(logsDir).filter((f) => f.startsWith(`${baseLogName}.`) && f.endsWith(".log")).sort();
      for (let i = rotatedLogs.length - 1; i >= 0; i--) {
        const match = rotatedLogs[i].match(new RegExp(`${baseLogName}.(d+).log`));
        if (match) {
          const rotationNumber = parseInt(match[1], 10);
          if (rotationNumber >= MAX_LOG_FILES$1 - 1) {
            const oldestLog = path__namespace.join(logsDir, rotatedLogs[i]);
            fs__namespace.unlinkSync(oldestLog);
            console.log(`Deleted old log file: ${oldestLog}`);
          } else {
            const oldPath = path__namespace.join(logsDir, rotatedLogs[i]);
            const newPath = path__namespace.join(logsDir, `${baseLogName}.${rotationNumber + 1}.log`);
            fs__namespace.renameSync(oldPath, newPath);
            console.log(`Rotated log file: ${oldPath} -> ${newPath}`);
          }
        }
      }
      const rotatedLogPath = path__namespace.join(logsDir, `${baseLogName}.1.log`);
      fs__namespace.renameSync(this.logFile, rotatedLogPath);
      console.log(`Rotated main log file: ${this.logFile} -> ${rotatedLogPath}`);
      const now = /* @__PURE__ */ new Date();
      const initialMessage = `===============================================
Odoo Manager - Application Log (Rotated)
Started: ${this.formatTimestamp(now)}
Environment: ${"development"}
===============================================
`;
      fs__namespace.writeFileSync(this.logFile, initialMessage);
      SESSION_HEADERS_WRITTEN = {};
      this.markSessionHeaderWritten("start");
      return true;
    } catch (err) {
      console.error("Error rotating log file:", err);
      return false;
    }
  }
  /**
   * Write a log entry to console and file
   * @param level LogLevel of the entry
   * @param message Message to log
   * @param error Optional error object to include
   */
  log(level, message, error) {
    if (level < this.logLevel) return;
    const timestamp = this.formatTimestamp(/* @__PURE__ */ new Date());
    const levelStr = LogLevel[level];
    const windowPrefix = this.windowId !== null ? `[WINDOW-${this.windowId}] ` : "";
    let logMessage = `[${timestamp}] [${levelStr}] ${windowPrefix}${message}`;
    if (error) {
      let errorMsg;
      if (error instanceof Error) {
        errorMsg = error.stack || error.message;
      } else if (typeof error === "string") {
        errorMsg = error;
      } else {
        try {
          errorMsg = JSON.stringify(error);
        } catch {
          errorMsg = String(error);
        }
      }
      logMessage += `
${errorMsg}`;
    }
    const consoleMethod = level === 3 ? "error" : level === 2 ? "warn" : level === 0 ? "debug" : "log";
    console[consoleMethod](logMessage);
    if (this.initialized && this.logFile) {
      try {
        this.checkAndRotateLogFile();
        fs__namespace.appendFileSync(this.logFile, logMessage + "\n");
      } catch (err) {
        console.error("Failed to write to log file:", err);
      }
    }
  }
  /**
   * Log debug message
   * @param message Message to log
   * @param data Optional data to include
   */
  debug(message, data) {
    this.log(0, message, data);
  }
  /**
   * Log info message
   * @param message Message to log
   * @param data Optional data to include
   */
  info(message, data) {
    this.log(1, message, data);
  }
  /**
   * Log warning message
   * @param message Message to log
   * @param error Optional error to include
   */
  warn(message, error) {
    this.log(2, message, error);
  }
  /**
   * Log error message
   * @param message Message to log
   * @param error Optional error to include
   */
  error(message, error) {
    this.log(3, message, error);
  }
  /**
   * Get all log files in the logs directory
   * @returns Array of log file paths
   */
  getLogFiles() {
    try {
      const logsPath = getLocalLogsPath();
      if (!fs__namespace.existsSync(logsPath)) {
        return [];
      }
      return fs__namespace.readdirSync(logsPath).filter((file) => file.endsWith(".log")).map((file) => path__namespace.join(logsPath, file));
    } catch (error) {
      console.error("Failed to get log files:", error);
      return [];
    }
  }
  /**
   * Get the most recent log file
   * @returns Path to the most recent log file or null if none found
   */
  getMostRecentLogFile() {
    try {
      const logFiles = this.getLogFiles();
      if (logFiles.length === 0) {
        return null;
      }
      return logFiles.sort((a, b) => {
        const statA = fs__namespace.statSync(a);
        const statB = fs__namespace.statSync(b);
        return statB.birthtimeMs - statA.birthtimeMs;
      })[0];
    } catch (error) {
      console.error("Failed to get most recent log file:", error);
      return null;
    }
  }
};
__publicField(_Logger, "instance", null);
let Logger = _Logger;
const logger = Logger.getInstance();
if (isElectron()) {
  const ipcRenderer = window.ipcRenderer;
  if (ipcRenderer && ipcRenderer.invoke) {
    ipcRenderer.invoke("get-window-id").then((id) => {
      if (id !== null) {
        logger.setWindowId(id);
      }
    }).catch((err) => console.error("Failed to get window ID for logger:", err));
  }
}
const logInfo$1 = (message, data) => logger.info(message, data);
const logError$1 = (message, error) => logger.error(message, error);
const defaultSettings = {
  theme: "dark",
  language: "en",
  network: "odoo-network",
  showWelcomeScreen: true,
  autoCheckUpdates: true,
  updateCheckFrequency: "daily",
  showUpdateNotifications: true,
  lastUpdateCheck: null,
  createdAt: (/* @__PURE__ */ new Date()).toISOString(),
  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
};
class SettingsService {
  constructor() {
    __publicField(this, "workDirFilePath");
    this.workDirFilePath = path__namespace.join(getAppDataPath(), "workdir.json");
  }
  /**
   * Check if setup has been completed
   * @returns Promise resolving to boolean indicating if setup is complete
   */
  async isSetupCompleted() {
    try {
      const workDirPath = await this.getWorkDirPath();
      if (!workDirPath) {
        return false;
      }
      const settingsPath = path__namespace.join(workDirPath, "settings.json");
      if (!fs__namespace.existsSync(settingsPath)) {
        return false;
      }
      return true;
    } catch (error) {
      logError$1("Error checking if setup is completed", error);
      return false;
    }
  }
  /**
   * Get the work directory path from app data
   * @returns Promise resolving to work directory path or null if not set
   */
  async getWorkDirPath() {
    try {
      if (process.platform === "win32") {
        const appDataPath = getAppDataPath();
        if (fs__namespace.existsSync(this.workDirFilePath)) {
          try {
            const data2 = JSON.parse(fs__namespace.readFileSync(this.workDirFilePath, "utf-8"));
            if (data2.workDir && fs__namespace.existsSync(data2.workDir)) {
              if (data2.workDir !== appDataPath) {
                logInfo$1(`Windows: workdir.json points to ${data2.workDir}, but using ${appDataPath} for consistency`);
              }
            }
          } catch (parseError) {
            logError$1("Windows: Error parsing workdir.json", parseError);
          }
        } else {
          try {
            fs__namespace.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
            logInfo$1(`Windows: Created workdir.json pointing to AppData: ${appDataPath}`);
          } catch (writeError) {
            logError$1("Windows: Error creating workdir.json", writeError);
          }
        }
        return appDataPath;
      }
      if (!fs__namespace.existsSync(this.workDirFilePath)) {
        return null;
      }
      const data = JSON.parse(fs__namespace.readFileSync(this.workDirFilePath, "utf-8"));
      if (!data.workDir || !fs__namespace.existsSync(data.workDir)) {
        return null;
      }
      return data.workDir;
    } catch (error) {
      logError$1("Error getting work directory path", error);
      return null;
    }
  }
  /**
   * Save the work directory path to app data
   * @param workDirPath Path to save as work directory
   * @returns Promise resolving to boolean indicating success
   */
  async saveWorkDirPath(workDirPath) {
    try {
      if (process.platform === "win32") {
        const appDataPath = getAppDataPath();
        ensureDir(path__namespace.dirname(this.workDirFilePath));
        fs__namespace.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
        logInfo$1(`Windows: Ignoring custom work directory, using AppData instead: ${appDataPath}`);
        try {
          const settingsPath = path__namespace.join(appDataPath, "settings.json");
          if (!fs__namespace.existsSync(settingsPath)) {
            fs__namespace.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
            logInfo$1(`Windows: Created settings.json in AppData`);
          }
          const odooDir = path__namespace.join(appDataPath, "odoo");
          const postgresDir = path__namespace.join(appDataPath, "postgres");
          if (!fs__namespace.existsSync(odooDir)) {
            fs__namespace.mkdirSync(odooDir, { recursive: true });
          }
          if (!fs__namespace.existsSync(postgresDir)) {
            fs__namespace.mkdirSync(postgresDir, { recursive: true });
          }
        } catch (setupError) {
          logError$1("Windows: Error setting up AppData directories", setupError);
        }
        return true;
      }
      ensureDir(path__namespace.dirname(this.workDirFilePath));
      fs__namespace.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: workDirPath }, null, 2));
      logInfo$1(`Saved work directory path: ${workDirPath}`);
      return true;
    } catch (error) {
      logError$1("Error saving work directory path", error);
      return false;
    }
  }
  /**
   * Load settings from the work directory
   * @returns Promise resolving to Settings object or null if not found
   */
  async loadSettings() {
    try {
      if (process.platform === "win32") {
        const appDataPath = getAppDataPath();
        const settingsPath2 = path__namespace.join(appDataPath, "settings.json");
        if (!fs__namespace.existsSync(settingsPath2)) {
          try {
            fs__namespace.writeFileSync(settingsPath2, JSON.stringify(defaultSettings, null, 2));
            logInfo$1(`Windows: Created default settings.json in AppData`);
          } catch (writeError) {
            logError$1("Windows: Error creating settings.json", writeError);
            return defaultSettings;
          }
          return defaultSettings;
        }
        try {
          const settings2 = JSON.parse(fs__namespace.readFileSync(settingsPath2, "utf-8"));
          logInfo$1("Windows: Loaded settings from AppData");
          return { ...defaultSettings, ...settings2 };
        } catch (readError) {
          logError$1("Windows: Error reading settings.json, using defaults", readError);
          return defaultSettings;
        }
      }
      const workDirPath = await this.getWorkDirPath();
      if (!workDirPath) {
        return null;
      }
      const settingsPath = path__namespace.join(workDirPath, "settings.json");
      if (!fs__namespace.existsSync(settingsPath)) {
        return null;
      }
      const settings = JSON.parse(fs__namespace.readFileSync(settingsPath, "utf-8"));
      logInfo$1("Loaded settings from work directory");
      return { ...defaultSettings, ...settings };
    } catch (error) {
      logError$1("Error loading settings", error);
      return null;
    }
  }
  /**
   * Save settings to the work directory
   * @param settings Settings object to save
   * @param workDirPath Work directory path where settings should be saved
   * @returns Promise resolving to boolean indicating success
   */
  async saveSettings(settings, workDirPath) {
    try {
      ensureDir(workDirPath);
      const mergedSettings = { ...defaultSettings, ...settings };
      mergedSettings.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const settingsPath = path__namespace.join(workDirPath, "settings.json");
      fs__namespace.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
      logInfo$1(`Saved settings to work directory: ${workDirPath}`);
      return true;
    } catch (error) {
      logError$1("Error saving settings", error);
      return false;
    }
  }
  /**
   * Update settings in the work directory
   * @param updates Partial settings object with updates
   * @returns Promise resolving to boolean indicating success
   */
  async updateSettings(updates) {
    try {
      if (process.platform === "win32") {
        const appDataPath = getAppDataPath();
        const settingsPath2 = path__namespace.join(appDataPath, "settings.json");
        let currentSettings2;
        try {
          if (fs__namespace.existsSync(settingsPath2)) {
            currentSettings2 = JSON.parse(fs__namespace.readFileSync(settingsPath2, "utf-8"));
          } else {
            currentSettings2 = { ...defaultSettings };
          }
        } catch (readError) {
          logError$1("Windows: Error reading settings.json, using defaults", readError);
          currentSettings2 = { ...defaultSettings };
        }
        const updatedSettings2 = {
          ...currentSettings2,
          ...updates,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        ensureDir(path__namespace.dirname(settingsPath2));
        fs__namespace.writeFileSync(settingsPath2, JSON.stringify(updatedSettings2, null, 2));
        logInfo$1("Windows: Updated settings in AppData");
        return true;
      }
      const currentSettings = await this.loadSettings();
      if (!currentSettings) {
        return false;
      }
      const workDirPath = await this.getWorkDirPath();
      if (!workDirPath) {
        return false;
      }
      const updatedSettings = {
        ...currentSettings,
        ...updates,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const settingsPath = path__namespace.join(workDirPath, "settings.json");
      fs__namespace.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
      logInfo$1("Updated settings");
      return true;
    } catch (error) {
      logError$1("Error updating settings", error);
      return false;
    }
  }
}
const settingsService = new SettingsService();
const execAsync$1 = util.promisify(child_process.exec);
const DOCKER_PATHS = {
  darwin: [
    "/usr/local/bin/docker",
    "/opt/homebrew/bin/docker",
    "/Applications/Docker.app/Contents/Resources/bin/docker",
    path__namespace.join(os__namespace.homedir(), ".docker/bin/docker")
  ],
  linux: [
    "/usr/bin/docker",
    "/usr/local/bin/docker"
  ],
  win32: [
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    "C:\\Program Files\\Docker\\Docker\\resources\\docker.exe",
    path__namespace.join(os__namespace.homedir(), "AppData\\Local\\Docker\\Docker\\resources\\bin\\docker.exe")
  ]
};
class DockerPathService {
  constructor() {
    __publicField(this, "dockerPath", null);
    __publicField(this, "dockerComposePath", null);
  }
  /**
   * Find the Docker executable path
   */
  async findDockerPath() {
    if (this.dockerPath) {
      return this.dockerPath;
    }
    logInfo$1("Searching for Docker executable...");
    try {
      await execAsync$1("docker --version");
      this.dockerPath = "docker";
      logInfo$1("Docker executable found in PATH");
      return this.dockerPath;
    } catch (error) {
      logInfo$1("Docker not found in PATH, checking common installation locations");
    }
    const platform = process.platform;
    const possiblePaths = DOCKER_PATHS[platform] || [];
    for (const dockerPath of possiblePaths) {
      try {
        if (fs__namespace.existsSync(dockerPath)) {
          logInfo$1(`Found Docker executable at: ${dockerPath}`);
          this.dockerPath = dockerPath;
          return dockerPath;
        }
      } catch (error) {
      }
    }
    logError$1("Docker executable not found in any common location");
    return null;
  }
  /**
   * Execute a Docker command with the full path to Docker
   */
  async executeDockerCommand(command) {
    const dockerPath = await this.findDockerPath();
    if (!dockerPath) {
      throw new Error("Docker executable not found. Please ensure Docker is installed and in your PATH.");
    }
    const fullCommand = dockerPath === "docker" ? `${command}` : `"${dockerPath}" ${command.replace(/^docker\s+/, "")}`;
    logInfo$1(`Executing Docker command: ${fullCommand}`);
    return await execAsync$1(fullCommand);
  }
  /**
   * Check if Docker is running by executing 'docker info'
   */
  async isDockerRunning() {
    try {
      await this.executeDockerCommand("docker info");
      return true;
    } catch (error) {
      return false;
    }
  }
  /**
   * Get the modified PATH including common Docker installation directories
   */
  getEnhancedPath() {
    const platform = process.platform;
    const currentPath = process.env.PATH || "";
    let additionalPaths = [];
    switch (platform) {
      case "darwin":
        additionalPaths = [
          "/usr/local/bin",
          "/opt/homebrew/bin",
          "/Applications/Docker.app/Contents/Resources/bin",
          path__namespace.join(os__namespace.homedir(), ".docker/bin")
        ];
        break;
      case "linux":
        additionalPaths = [
          "/usr/bin",
          "/usr/local/bin"
        ];
        break;
      case "win32":
        additionalPaths = [
          "C:\\Program Files\\Docker\\Docker\\resources\\bin",
          path__namespace.join(os__namespace.homedir(), "AppData\\Local\\Docker\\Docker\\resources\\bin")
        ];
        break;
    }
    const existingPaths = additionalPaths.filter((p) => {
      try {
        return fs__namespace.existsSync(p);
      } catch (error) {
        return false;
      }
    });
    const pathSeparator = platform === "win32" ? ";" : ":";
    return [...existingPaths, currentPath].join(pathSeparator);
  }
}
const dockerPathService = new DockerPathService();
const execAsync = util.promisify(child_process.exec);
class DockerComposeService {
  constructor() {
    __publicField(this, "projectsPath");
    this.projectsPath = path__namespace.join(getAppDataPath(), "projects");
    if (!fs__namespace.existsSync(this.projectsPath)) {
      try {
        fs__namespace.mkdirSync(this.projectsPath, { recursive: true });
        logInfo$1(`Created projects directory: ${this.projectsPath}`);
      } catch (err) {
        logError$1(`Failed to create projects directory`, err instanceof Error ? err : new Error(String(err)));
      }
    }
    if (process.platform === "win32") {
      setTimeout(() => {
        this.initializeWindowsProjectsPath();
      }, 0);
    }
  }
  /**
   * Initialize projects path specifically for Windows platform
   * This ensures we always use AppData directory on Windows
   */
  async initializeWindowsProjectsPath() {
    if (process.platform !== "win32") return;
    try {
      const appDataPath = getAppDataPath();
      logInfo$1(`Windows: Setting projects path to AppData: ${appDataPath}`);
      this.projectsPath = appDataPath;
      const odooPath = path__namespace.join(this.projectsPath, "odoo");
      const postgresPath = path__namespace.join(this.projectsPath, "postgres");
      if (!fs__namespace.existsSync(odooPath)) {
        fs__namespace.mkdirSync(odooPath, { recursive: true });
        logInfo$1(`Windows: Created odoo directory in AppData`);
      }
      if (!fs__namespace.existsSync(postgresPath)) {
        fs__namespace.mkdirSync(postgresPath, { recursive: true });
        logInfo$1(`Windows: Created postgres directory in AppData`);
      }
      logInfo$1(`Windows: Projects paths initialized: ${this.projectsPath}`);
    } catch (error) {
      logError$1(`Windows: Error initializing projects paths`, error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Initialize or update the projects path based on workdir
   */
  async initializeProjectsPath() {
    try {
      if (process.platform === "win32") {
        await this.initializeWindowsProjectsPath();
        return;
      }
      const workDirPath = await settingsService.getWorkDirPath();
      if (workDirPath) {
        this.projectsPath = workDirPath;
        const odooPath = path__namespace.join(this.projectsPath, "odoo");
        const postgresPath = path__namespace.join(this.projectsPath, "postgres");
        if (!fs__namespace.existsSync(odooPath)) {
          fs__namespace.mkdirSync(odooPath, { recursive: true });
        }
        if (!fs__namespace.existsSync(postgresPath)) {
          fs__namespace.mkdirSync(postgresPath, { recursive: true });
        }
        logInfo$1(`Updated project paths: ${this.projectsPath}`);
      } else {
        logInfo$1(`No workdir found, using default path: ${this.projectsPath}`);
      }
    } catch (error) {
      logError$1(`Error initializing project paths`, error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Check if Docker is running
   */
  async checkDocker() {
    try {
      logInfo$1("Checking Docker engine status");
      process.env.PATH = dockerPathService.getEnhancedPath();
      logInfo$1(`Enhanced PATH: ${process.env.PATH}`);
      const dockerPath = await dockerPathService.findDockerPath();
      if (!dockerPath) {
        logError$1("Docker executable not found in common locations");
        return false;
      }
      await dockerPathService.executeDockerCommand("docker info");
      logInfo$1("Docker engine is running");
      return true;
    } catch (err) {
      logError$1("Docker engine is not running or not installed", err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }
  /**
   * Ensure Docker network exists
   */
  async ensureNetworkExists(networkName = "odoo-network") {
    try {
      logInfo$1(`Checking if network exists: ${networkName}`);
      const { stdout } = await dockerPathService.executeDockerCommand(`docker network ls --format "{{.Name}}"`);
      if (!stdout.includes(networkName)) {
        logInfo$1(`Creating network: ${networkName}`);
        await dockerPathService.executeDockerCommand(`docker network create ${networkName}`);
        logInfo$1(`Network created successfully: ${networkName}`);
      } else {
        logInfo$1(`Network ${networkName} already exists`);
      }
      return true;
    } catch (err) {
      logError$1(`Error ensuring network ${networkName} exists`, err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }
  /**
   * Check if a port is available and find an alternative if needed
   * Improved implementation for better cross-platform support, especially on Windows
   */
  async checkPortAvailability(port) {
    try {
      logInfo$1(`Testing port ${port} availability`);
      const net = require("net");
      const tester = net.createServer();
      const checkPort = (port2) => {
        return new Promise((resolve) => {
          const server = net.createServer().once("error", (err) => {
            if (err.code === "EADDRINUSE" || err.code === "EACCES") {
              logInfo$1(`Port ${port2} is in use or access denied`);
              resolve(false);
            } else {
              logInfo$1(`Port ${port2} check error: ${err.code}`);
              resolve(false);
            }
          }).once("listening", () => {
            server.close();
            logInfo$1(`Port ${port2} is available`);
            resolve(true);
          });
          server.listen(port2, "127.0.0.1");
        });
      };
      const isAvailable = await checkPort(port);
      if (isAvailable) {
        return port;
      } else {
        throw new Error(`Port ${port} is already in use`);
      }
    } catch (err) {
      logInfo$1(`Finding alternative port to ${port}`);
      let newPort = null;
      for (let testPort = port + 1; testPort < port + 20; testPort++) {
        const net = require("net");
        const isAvailable = await new Promise((resolve) => {
          const server = net.createServer().once("error", () => {
            resolve(false);
          }).once("listening", () => {
            server.close();
            resolve(true);
          });
          server.listen(testPort, "127.0.0.1");
        });
        if (isAvailable) {
          newPort = testPort;
          logInfo$1(`Found available port: ${newPort}`);
          break;
        } else {
          logInfo$1(`Port ${testPort} is in use, trying next one`);
        }
      }
      if (newPort) {
        return newPort;
      }
      throw new Error(`Port ${port} is in use and no alternative ports are available. Please specify a different port.`);
    }
  }
  /**
   * Get the correct Docker Compose command
   */
  async getComposeCommand() {
    try {
      await dockerPathService.executeDockerCommand("docker compose version");
      return "docker compose";
    } catch (error) {
      try {
        await execAsync("docker-compose --version");
        return "docker-compose";
      } catch (composeError) {
        throw new Error("Docker Compose is not available");
      }
    }
  }
  /**
   * Create a PostgreSQL instance with Docker Compose
   */
  async createPostgresInstance(instanceName, version, port = 5432, username = "postgres", password = "postgres") {
    try {
      logInfo$1(`Starting PostgreSQL instance creation: ${instanceName}, version: ${version}, port: ${port}`);
      await this.initializeProjectsPath();
      const projectDir = path__namespace.join(this.projectsPath, "postgres", instanceName);
      logInfo$1(`Files will be saved to: ${projectDir}`);
      if (!await this.checkDocker()) {
        return { success: false, message: "Docker is not running. Please start Docker and try again." };
      }
      const settings = await settingsService.loadSettings();
      const networkName = (settings == null ? void 0 : settings.network) || "odoo-network";
      if (!await this.ensureNetworkExists(networkName)) {
        return { success: false, message: `Failed to create or verify network ${networkName}` };
      }
      try {
        port = await this.checkPortAvailability(port);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
      if (fs__namespace.existsSync(projectDir)) {
        logInfo$1(`Instance directory already exists: ${projectDir}`);
        return { success: false, message: `Instance ${instanceName} already exists` };
      }
      logInfo$1(`Creating project directory: ${projectDir}`);
      fs__namespace.mkdirSync(projectDir, { recursive: true });
      logInfo$1(`Generating Docker Compose file with port ${port}`);
      const composeContent = `
services:
  postgres:
    image: postgres:${version}
    container_name: ${instanceName}
    environment:
      - POSTGRES_PASSWORD=${password}
      - POSTGRES_USER=${username}
      - POSTGRES_DB=postgres
    ports:
      - "${port}:5432"
    volumes:
      - ${instanceName}_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - ${networkName}

networks:
  ${networkName}:
    external: true

volumes:
  ${instanceName}_data:
    driver: local
`;
      const composeFilePath = path__namespace.join(projectDir, "docker-compose.yml");
      logInfo$1(`Writing Docker Compose file to ${composeFilePath}`);
      fs__namespace.writeFileSync(composeFilePath, composeContent, "utf8");
      if (!fs__namespace.existsSync(composeFilePath)) {
        logError$1(`Compose file not created: ${composeFilePath}`);
        return { success: false, message: "Failed to create Docker Compose file" };
      }
      const infoFile = path__namespace.join(projectDir, "instance-info.json");
      logInfo$1(`Creating instance info file: ${infoFile}`);
      const info = {
        name: instanceName,
        type: "postgres",
        version,
        port,
        username,
        password,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      fs__namespace.writeFileSync(infoFile, JSON.stringify(info, null, 2), "utf8");
      logInfo$1(`Starting PostgreSQL container`);
      const composeCommand = await this.getComposeCommand();
      try {
        logInfo$1(`Executing: cd "${projectDir}" && ${composeCommand} up -d`);
        const { stdout, stderr } = await execAsync(`cd "${projectDir}" && ${composeCommand} up -d`);
        if (stdout) logInfo$1(`Docker Compose stdout: ${stdout}`);
        if (stderr) logInfo$1(`Docker Compose stderr: ${stderr}`);
      } catch (error) {
        logError$1(`Error starting container`, error);
        try {
          const { stdout: logs } = await execAsync(`cd "${projectDir}" && ${composeCommand} logs`);
          logInfo$1(`Container logs: ${logs}`);
        } catch (error2) {
          logError$1(`Couldn't get container logs`, error2);
        }
        return {
          success: false,
          message: `Error starting container: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      try {
        logInfo$1(`Verifying container is running`);
        const { stdout: containerStatus } = await execAsync(`docker ps --filter "name=${instanceName}" --format "{{.Status}}"`);
        logInfo$1(`Container status: ${containerStatus}`);
        if (!containerStatus.includes("Up")) {
          logInfo$1(`Container may not be running correctly`);
          try {
            const { stdout: containerLogs } = await execAsync(`docker logs ${instanceName} --tail 20`);
            logInfo$1(`Container logs: ${containerLogs}`);
          } catch (error) {
            logError$1(`Couldn't get container logs`, error);
          }
          return {
            success: true,
            // Still return success since files were created
            message: `PostgreSQL instance created, but container may not be running correctly. Check logs.`,
            port
          };
        }
      } catch (error) {
        logError$1(`Error checking container status`, error);
      }
      logInfo$1(`Successfully created PostgreSQL instance: ${instanceName}`);
      return {
        success: true,
        message: `PostgreSQL instance ${instanceName} created successfully on port ${port}!`,
        port
      };
    } catch (error) {
      logError$1(`Error creating PostgreSQL instance ${instanceName}`, error);
      return {
        success: false,
        message: `Error creating instance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Start a Docker Compose instance
   */
  async startInstance(instanceName) {
    try {
      await this.initializeProjectsPath();
      let projectDir;
      if (instanceName.includes("postgres_")) {
        projectDir = path__namespace.join(this.projectsPath, "postgres", instanceName);
      } else {
        projectDir = path__namespace.join(this.projectsPath, "odoo", instanceName);
      }
      if (!fs__namespace.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      const composeFile = path__namespace.join(projectDir, "docker-compose.yml");
      if (!fs__namespace.existsSync(composeFile)) {
        return { success: false, message: `Compose file for ${instanceName} not found` };
      }
      const composeCommand = await this.getComposeCommand();
      logInfo$1(`Starting instance: ${instanceName}`);
      await execAsync(`cd "${projectDir}" && ${composeCommand} up -d`);
      return { success: true, message: `Instance ${instanceName} started successfully` };
    } catch (error) {
      logError$1(`Error starting instance: ${instanceName}`, error);
      return {
        success: false,
        message: `Error starting instance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Stop a Docker Compose instance
   */
  async stopInstance(instanceName) {
    try {
      await this.initializeProjectsPath();
      const instanceType = instanceName.includes("postgres") ? "postgres" : "odoo";
      const projectDir = path__namespace.join(this.projectsPath, instanceType, instanceName);
      logInfo$1(`Stopping instance: ${instanceName}`);
      if (!fs__namespace.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      const composeFile = path__namespace.join(projectDir, "docker-compose.yml");
      if (!fs__namespace.existsSync(composeFile)) {
        return { success: false, message: `Compose file for ${instanceName} not found` };
      }
      if (instanceType === "postgres") {
        logInfo$1(`Checking for dependent Odoo instances before stopping PostgreSQL: ${instanceName}`);
        const instances = await this.listInstances();
        const dependentInstances = instances.filter(
          (instance) => instance.info && instance.info.type === "odoo" && instance.info.postgresInstance === instanceName && instance.status.toLowerCase().includes("up")
        );
        if (dependentInstances.length > 0) {
          const dependentNames = dependentInstances.map((instance) => instance.name).join(", ");
          logInfo$1(`Found running dependent Odoo instances: ${dependentNames}`);
          return {
            success: false,
            message: `Cannot stop PostgreSQL instance "${instanceName}" because it has running Odoo instances that depend on it: ${dependentNames}. Please stop these instances first.`
          };
        }
        logInfo$1("No running dependent Odoo instances found, proceeding with stop");
      }
      const composeCommand = await this.getComposeCommand();
      logInfo$1(`Stopping instance with: ${composeCommand} stop`);
      await execAsync(`cd "${projectDir}" && ${composeCommand} stop`);
      return { success: true, message: `Instance ${instanceName} stopped successfully` };
    } catch (error) {
      logError$1(`Error stopping instance: ${instanceName}`, error);
      return {
        success: false,
        message: `Error stopping instance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Delete a Docker Compose instance
   */
  async deleteInstance(instanceName, keepFiles = false) {
    try {
      await this.initializeProjectsPath();
      const instanceType = instanceName.includes("postgres") ? "postgres" : "odoo";
      const projectDir = path__namespace.join(this.projectsPath, instanceType, instanceName);
      logInfo$1(`Deleting instance: ${instanceName}`);
      if (!fs__namespace.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      if (instanceType === "postgres") {
        logInfo$1(`Checking for dependent Odoo instances before deleting PostgreSQL: ${instanceName}`);
        const instances = await this.listInstances();
        const dependentInstances = instances.filter(
          (instance) => instance.info && instance.info.type === "odoo" && instance.info.postgresInstance === instanceName
        );
        if (dependentInstances.length > 0) {
          const dependentNames = dependentInstances.map((instance) => instance.name).join(", ");
          logInfo$1(`Found dependent Odoo instances: ${dependentNames}`);
          return {
            success: false,
            message: `Cannot delete PostgreSQL instance "${instanceName}" because it has Odoo instances that depend on it: ${dependentNames}. Please delete these instances first.`
          };
        }
        logInfo$1("No dependent Odoo instances found, proceeding with delete");
      }
      const composeCommand = await this.getComposeCommand();
      logInfo$1(`Stopping containers with ${composeCommand} down`);
      await execAsync(`cd "${projectDir}" && ${composeCommand} down -v`);
      if (!keepFiles) {
        logInfo$1(`Removing directory: ${projectDir}`);
        fs__namespace.rmSync(projectDir, { recursive: true, force: true });
      } else {
        logInfo$1(`Keeping files in: ${projectDir}`);
      }
      return { success: true, message: `Instance ${instanceName} deleted successfully` };
    } catch (error) {
      logError$1(`Error deleting instance: ${instanceName}`, error);
      return {
        success: false,
        message: `Error deleting instance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Get logs from a Docker container
   */
  async getLogs(instanceName, service = "auto", tail = 100) {
    try {
      await this.initializeProjectsPath();
      const instanceType = instanceName.includes("postgres") ? "postgres" : "odoo";
      const projectDir = path__namespace.join(this.projectsPath, instanceType, instanceName);
      logInfo$1(`Getting logs for instance: ${instanceName}`);
      if (!fs__namespace.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      if (service === "auto") {
        service = instanceType === "postgres" ? "postgres" : "odoo";
      }
      logInfo$1(`Using service: ${service} for logs`);
      const composeCommand = await this.getComposeCommand();
      const { stdout } = await execAsync(`cd "${projectDir}" && ${composeCommand} logs --tail=${tail} ${service}`);
      return { success: true, logs: stdout };
    } catch (error) {
      logError$1(`Error getting logs for ${instanceName}`, error);
      return {
        success: false,
        message: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * List all Docker Compose instances
   */
  async listInstances() {
    try {
      await this.initializeProjectsPath();
      logInfo$1("Listing instances from both odoo and postgres directories");
      const instances = [];
      if (!fs__namespace.existsSync(this.projectsPath)) {
        logInfo$1("Base directory does not exist");
        return instances;
      }
      const scanDirectory = async (dirPath, instanceType) => {
        if (!fs__namespace.existsSync(dirPath)) {
          logInfo$1(`${instanceType} directory does not exist: ${dirPath}`);
          return;
        }
        const dirs = fs__namespace.readdirSync(dirPath);
        logInfo$1(`Found ${dirs.length} directories in ${instanceType} path`);
        for (const dir of dirs) {
          const instanceDir = path__namespace.join(dirPath, dir);
          const composeFile = path__namespace.join(instanceDir, "docker-compose.yml");
          const infoFile = path__namespace.join(instanceDir, "instance-info.json");
          if (fs__namespace.existsSync(composeFile) && fs__namespace.lstatSync(instanceDir).isDirectory()) {
            let status = "Unknown";
            let info = {};
            try {
              const { stdout } = await execAsync(`docker ps --filter "name=${dir}" --format "{{.Status}}"`);
              status = stdout.trim() ? stdout.trim() : "Not running";
            } catch (error) {
              status = "Not running";
            }
            if (fs__namespace.existsSync(infoFile)) {
              try {
                info = JSON.parse(fs__namespace.readFileSync(infoFile, "utf-8"));
                if (!info.type) {
                  info.type = instanceType === "odoo" ? "odoo" : "postgres";
                }
              } catch (error) {
                info = { name: dir, error: "Invalid info file", type: instanceType };
              }
            } else {
              info = { name: dir, type: instanceType };
            }
            instances.push({
              name: dir,
              status,
              info
            });
            logInfo$1(`Added ${instanceType} instance: ${dir}, status: ${status}`);
          }
        }
      };
      await scanDirectory(path__namespace.join(this.projectsPath, "odoo"), "odoo");
      await scanDirectory(path__namespace.join(this.projectsPath, "postgres"), "postgres");
      return instances;
    } catch (error) {
      logError$1(`Error listing instances`, error);
      return [];
    }
  }
  /**
   * Update PostgreSQL credentials
   */
  async updatePostgresCredentials(instanceName, newUsername, newPassword) {
    try {
      await this.initializeProjectsPath();
      const projectDir = path__namespace.join(this.projectsPath, "postgres", instanceName);
      logInfo$1(`Updating PostgreSQL credentials for instance: ${instanceName}`);
      if (!fs__namespace.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      const composeFilePath = path__namespace.join(projectDir, "docker-compose.yml");
      if (!fs__namespace.existsSync(composeFilePath)) {
        return { success: false, message: `Docker Compose file for ${instanceName} not found` };
      }
      logInfo$1(`Checking for dependent Odoo instances that need updated credentials`);
      const instances = await this.listInstances();
      const dependentInstances = instances.filter(
        (instance) => instance.info && instance.info.type === "odoo" && instance.info.postgresInstance === instanceName
      );
      const dependentNames = dependentInstances.map((instance) => instance.name);
      logInfo$1(`Found ${dependentNames.length} dependent Odoo instances: ${dependentNames.join(", ") || "none"}`);
      const content = fs__namespace.readFileSync(composeFilePath, "utf8");
      const updatedContent = content.replace(/- POSTGRES_PASSWORD=[^\n]+/g, `- POSTGRES_PASSWORD=${newPassword}`).replace(/- POSTGRES_USER=[^\n]+/g, `- POSTGRES_USER=${newUsername}`);
      fs__namespace.writeFileSync(composeFilePath, updatedContent, "utf8");
      const infoFilePath = path__namespace.join(projectDir, "instance-info.json");
      if (fs__namespace.existsSync(infoFilePath)) {
        const infoContent = fs__namespace.readFileSync(infoFilePath, "utf8");
        const info = JSON.parse(infoContent);
        info.username = newUsername;
        info.password = newPassword;
        info.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        fs__namespace.writeFileSync(infoFilePath, JSON.stringify(info, null, 2), "utf8");
      }
      const composeCommand = await this.getComposeCommand();
      logInfo$1(`Restarting PostgreSQL instance: ${instanceName}`);
      await execAsync(`cd "${projectDir}" && ${composeCommand} down && ${composeCommand} up -d`);
      const updatedInstances = [];
      const failedUpdates = [];
      for (const odooInstance of dependentInstances) {
        try {
          logInfo$1(`Updating config for dependent Odoo instance: ${odooInstance.name}`);
          const odooDir = path__namespace.join(this.projectsPath, "odoo", odooInstance.name);
          const configDir = path__namespace.join(odooDir, "config");
          const odooConfPath = path__namespace.join(configDir, "odoo.conf");
          if (fs__namespace.existsSync(odooConfPath)) {
            let odooConfContent = fs__namespace.readFileSync(odooConfPath, "utf8");
            odooConfContent = odooConfContent.replace(/db_user = .*/g, `db_user = ${newUsername}`).replace(/db_password = .*/g, `db_password = ${newPassword}`);
            fs__namespace.writeFileSync(odooConfPath, odooConfContent, "utf8");
            logInfo$1(`Updated odoo.conf for ${odooInstance.name}`);
            const odooInfoPath = path__namespace.join(odooDir, "instance-info.json");
            if (fs__namespace.existsSync(odooInfoPath)) {
              const odooInfo = JSON.parse(fs__namespace.readFileSync(odooInfoPath, "utf8"));
              if (!odooInfo.pgCredentials) odooInfo.pgCredentials = {};
              odooInfo.pgCredentials.username = newUsername;
              odooInfo.pgCredentials.password = newPassword;
              odooInfo.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
              fs__namespace.writeFileSync(odooInfoPath, JSON.stringify(odooInfo, null, 2), "utf8");
              logInfo$1(`Updated instance-info.json for ${odooInstance.name}`);
            }
            if (odooInstance.status.toLowerCase().includes("up")) {
              logInfo$1(`Restarting dependent Odoo instance: ${odooInstance.name}`);
              try {
                await execAsync(`cd "${odooDir}" && ${composeCommand} down && ${composeCommand} up -d`);
                logInfo$1(`Successfully restarted ${odooInstance.name}`);
              } catch (restartErr) {
                logError$1(`Error restarting Odoo instance ${odooInstance.name}`, restartErr);
                failedUpdates.push({ name: odooInstance.name, error: "restart failure" });
                continue;
              }
            } else {
              logInfo$1(`Odoo instance ${odooInstance.name} is not running, no need to restart`);
            }
            updatedInstances.push(odooInstance.name);
          } else {
            logInfo$1(`Could not find odoo.conf for ${odooInstance.name}, skipping update`);
            failedUpdates.push({ name: odooInstance.name, error: "missing configuration file" });
          }
        } catch (instanceError) {
          logError$1(`Error updating Odoo instance ${odooInstance.name}`, instanceError);
          failedUpdates.push({ name: odooInstance.name, error: "general error" });
        }
      }
      let successMessage = `PostgreSQL credentials updated successfully for ${instanceName}.`;
      if (updatedInstances.length > 0) {
        successMessage += ` Updated ${updatedInstances.length} dependent Odoo instance(s): ${updatedInstances.join(", ")}.`;
      }
      if (failedUpdates.length > 0) {
        const failedNames = failedUpdates.map((f) => f.name).join(", ");
        successMessage += ` Failed to update ${failedUpdates.length} instance(s): ${failedNames}.`;
      }
      return {
        success: true,
        message: successMessage,
        updatedInstances
      };
    } catch (error) {
      logError$1(`Error updating PostgreSQL credentials`, error);
      return {
        success: false,
        message: `Error updating credentials: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Create an Odoo instance with Docker Compose
   */
  async createInstance(instanceName, version, edition, adminPassword, dbFilter, port, customImage, customImageName, postgresInstance, pgUser, pgPassword) {
    try {
      logInfo$1(`Starting Odoo instance creation: ${instanceName}, version: ${version}, edition: ${edition}`);
      await this.initializeProjectsPath();
      const projectDir = path__namespace.join(this.projectsPath, "odoo", instanceName);
      logInfo$1(`Files will be saved to: ${projectDir}`);
      if (!await this.checkDocker()) {
        return { success: false, message: "Docker is not running. Please start Docker and try again." };
      }
      const settings = await settingsService.loadSettings();
      const networkName = (settings == null ? void 0 : settings.network) || "odoo-network";
      if (!await this.ensureNetworkExists(networkName)) {
        return { success: false, message: `Failed to create or verify network ${networkName}` };
      }
      if (!postgresInstance) {
        return { success: false, message: "PostgreSQL instance is required" };
      }
      try {
        const { stdout: pgStatus } = await execAsync(`docker ps --filter "name=${postgresInstance}" --format "{{.Status}}"`);
        if (!pgStatus || !pgStatus.toLowerCase().includes("up")) {
          return { success: false, message: `PostgreSQL instance ${postgresInstance} is not running. Please start it first.` };
        }
      } catch (err) {
        logError$1(`Error checking PostgreSQL status`, err);
        return { success: false, message: `PostgreSQL instance ${postgresInstance} not found or not accessible.` };
      }
      try {
        const instances = await this.listInstances();
        const linkedInstances = instances.filter(
          (inst) => inst.info && inst.info.postgresInstance === postgresInstance
        );
        if (linkedInstances.length >= 4) {
          return { success: false, message: `PostgreSQL instance ${postgresInstance} already has 4 linked Odoo instances. Please use another PostgreSQL instance.` };
        }
        logInfo$1(`Found ${linkedInstances.length} Odoo instances linked to ${postgresInstance}`);
      } catch (err) {
        logError$1(`Error checking linked instances count`, err);
      }
      const defaultPort = port || 8069;
      try {
        port = await this.checkPortAvailability(defaultPort);
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : String(err)
        };
      }
      if (fs__namespace.existsSync(projectDir)) {
        logInfo$1(`Instance directory already exists: ${projectDir}`);
        return { success: false, message: `Instance ${instanceName} already exists` };
      }
      logInfo$1(`Creating project directory: ${projectDir}`);
      fs__namespace.mkdirSync(projectDir, { recursive: true });
      const configDir = path__namespace.join(projectDir, "config");
      fs__namespace.mkdirSync(configDir, { recursive: true });
      const addonsDir = path__namespace.join(projectDir, "addons");
      fs__namespace.mkdirSync(addonsDir, { recursive: true });
      const odooConfPath = path__namespace.join(configDir, "odoo.conf");
      const dbFilterStr = dbFilter ? `
dbfilter = ^${instanceName}.*$` : "";
      const pgUserVal = pgUser || "postgres";
      const pgPasswordVal = pgPassword || "postgres";
      const majorVersion = version.split(".")[0];
      const addonsPathStr = edition === "Enterprise" ? `/mnt/extra-addons, /mnt/enterprise-addons/${majorVersion}` : `/mnt/extra-addons`;
      const odooConfContent = `[options]
addons_path = ${addonsPathStr}
data_dir = /var/lib/odoo
admin_passwd = ${adminPassword}${dbFilterStr}
db_host = ${postgresInstance}
db_password = ${pgPasswordVal}
db_port = 5432
db_template = template0
db_user = ${pgUserVal}
list_db = True
`;
      logInfo$1(`Creating odoo.conf`);
      fs__namespace.writeFileSync(odooConfPath, odooConfContent, "utf8");
      const dockerImage = customImage && customImageName ? `odoo-custom:${customImageName}` : `odoo:${version}`;
      logInfo$1(`Using Docker image: ${dockerImage}`);
      const composeContent = `
services:
  odoo:
    image: ${dockerImage}
    container_name: ${instanceName}
    ports:
      - "${port}:8069"
    volumes:
      - ${instanceName}_data:/var/lib/odoo
      - ./config:/etc/odoo
      - ./addons:/mnt/extra-addons
${edition === "Enterprise" ? `      - ${this.projectsPath}/enterprise_addons/${majorVersion}:/mnt/enterprise-addons/${majorVersion}` : ""}
    environment:
      - POSTGRES_USER=${pgUserVal}
      - POSTGRES_PASSWORD=${pgPasswordVal}
      - POSTGRES_HOST=${postgresInstance}
      - POSTGRES_PORT=5432
    restart: unless-stopped
    networks:
      - ${networkName}
    external_links:
      - ${postgresInstance}:${postgresInstance}

networks:
  ${networkName}:
    external: true

volumes:
  ${instanceName}_data:
    driver: local
`;
      const composeFilePath = path__namespace.join(projectDir, "docker-compose.yml");
      logInfo$1(`Writing Docker Compose file to ${composeFilePath}`);
      fs__namespace.writeFileSync(composeFilePath, composeContent, "utf8");
      const enterpriseAddonsDir = path__namespace.join(this.projectsPath, "enterprise_addons", version);
      if (edition === "Enterprise" && !fs__namespace.existsSync(enterpriseAddonsDir)) {
        logInfo$1(`Enterprise addons directory not found: ${enterpriseAddonsDir}`);
        fs__namespace.mkdirSync(enterpriseAddonsDir, { recursive: true });
        const readmePath = path__namespace.join(enterpriseAddonsDir, "README.txt");
        fs__namespace.writeFileSync(readmePath, `This directory should contain Odoo Enterprise addons for version ${version}.
If you have access to Odoo Enterprise repository, please clone or copy those addons to this location.`, "utf8");
      }
      const infoFile = path__namespace.join(projectDir, "instance-info.json");
      logInfo$1(`Creating instance info file: ${infoFile}`);
      const info = {
        name: instanceName,
        type: "odoo",
        version,
        edition,
        port,
        adminPassword,
        dbFilter,
        customImage: !!(customImage && customImageName),
        customImageName: customImage && customImageName ? customImageName : void 0,
        postgresInstance,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      fs__namespace.writeFileSync(infoFile, JSON.stringify(info, null, 2), "utf8");
      logInfo$1(`Starting Odoo container`);
      const composeCommand = await this.getComposeCommand();
      try {
        logInfo$1(`Executing: cd "${projectDir}" && ${composeCommand} up -d`);
        const { stdout, stderr } = await execAsync(`cd "${projectDir}" && ${composeCommand} up -d`);
        if (stdout) logInfo$1(`Docker Compose stdout: ${stdout}`);
        if (stderr) logInfo$1(`Docker Compose stderr: ${stderr}`);
      } catch (error) {
        logError$1(`Error starting container`, error);
        try {
          const { stdout: logs } = await execAsync(`cd "${projectDir}" && ${composeCommand} logs`);
          logInfo$1(`Container logs: ${logs}`);
        } catch (error2) {
          logError$1(`Couldn't get container logs`, error2);
        }
        return {
          success: false,
          message: `Error starting container: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      try {
        logInfo$1(`Verifying container is running`);
        const { stdout: containerStatus } = await execAsync(`docker ps --filter "name=${instanceName}" --format "{{.Status}}"`);
        logInfo$1(`Container status: ${containerStatus}`);
        if (!containerStatus.includes("Up")) {
          logInfo$1(`Container may not be running correctly`);
          try {
            const { stdout: containerLogs } = await execAsync(`docker logs ${instanceName} --tail 20`);
            logInfo$1(`Container logs: ${containerLogs}`);
          } catch (error) {
            logError$1(`Couldn't get container logs`, error);
          }
          return {
            success: true,
            // Still return success since files were created
            message: `Odoo instance created, but container may not be running correctly. Check logs.`,
            port
          };
        }
      } catch (error) {
        logError$1(`Error checking container status`, error);
      }
      logInfo$1(`Successfully created Odoo instance: ${instanceName}`);
      return {
        success: true,
        message: `Odoo instance ${instanceName} created successfully on port ${port}!`,
        port
      };
    } catch (error) {
      logError$1(`Error creating Odoo instance ${instanceName}`, error);
      return {
        success: false,
        message: `Error creating instance: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
const dockerComposeService = new DockerComposeService();
function safeRegisterHandler(channel, handler) {
  try {
    const handlers = electron.ipcMain._invokeHandlers;
    if (handlers && handlers.has && handlers.has(channel)) {
      logInfo$1(`IPC handler already exists for channel: ${channel}, not registering again`);
      return;
    }
    try {
      electron.ipcMain.handle(channel, handler);
      logInfo$1(`Registered IPC handler: ${channel}`);
    } catch (error) {
      if (error.message.includes("second handler")) {
        logInfo$1(`Handler already exists for channel: ${channel}, skipping registration`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    logError$1(`Error while trying to register handler for ${channel}`, error);
  }
}
function initializeIpcHandlers() {
  logInfo$1("Initializing IPC handlers");
  safeRegisterHandler("docker-operation", async (_event, { operation, params }) => {
    logInfo$1(`Executing Docker operation: ${operation}`, params);
    try {
      let result;
      switch (operation) {
        case "check-docker":
          logInfo$1("Checking Docker");
          result = await dockerComposeService.checkDocker();
          break;
        case "start-instance":
          result = await dockerComposeService.startInstance(params.instanceName || "");
          break;
        case "stop-instance":
          result = await dockerComposeService.stopInstance(params.instanceName || "");
          break;
        case "delete-instance":
          result = await dockerComposeService.deleteInstance(params.instanceName || "", params.keepFiles);
          break;
        case "get-logs":
          result = await dockerComposeService.getLogs(
            params.instanceName || "",
            params.service,
            params.tail
          );
          break;
        case "list-instances":
          logInfo$1("Listing instances");
          result = await dockerComposeService.listInstances();
          break;
        case "ensure-network":
          result = await dockerComposeService.ensureNetworkExists(params == null ? void 0 : params.networkName);
          break;
        default:
          throw new Error(`Unknown Docker operation: ${operation}`);
      }
      logInfo$1(`Docker operation completed: ${operation}`, { success: true });
      return result;
    } catch (error) {
      logError$1(`Error executing Docker operation: ${operation}`, error);
      return {
        success: false,
        message: `Operation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });
  safeRegisterHandler("show-error-dialog", (_event, { title, message }) => {
    logError$1(`Showing error dialog: ${title}`, message);
    electron.dialog.showErrorBox(title, message);
  });
  safeRegisterHandler("show-message-dialog", async (_event, options) => {
    logInfo$1("Showing message dialog", { title: options.title });
    return await electron.dialog.showMessageBox(options);
  });
  safeRegisterHandler("show-save-dialog", async (_event, options) => {
    logInfo$1("Showing save dialog", { title: options.title });
    return await electron.dialog.showSaveDialog(options);
  });
  safeRegisterHandler("show-open-dialog", async (_event, options) => {
    logInfo$1("Showing open dialog", { title: options.title });
    return await electron.dialog.showOpenDialog(options);
  });
  logInfo$1("IPC handlers initialization complete");
}
async function initializeApp() {
  try {
    logInfo$1("Initializing application");
    const dockerRunning = await dockerComposeService.checkDocker();
    if (!dockerRunning) {
      logError$1("Docker is not running!");
      return;
    }
    await dockerComposeService.ensureNetworkExists();
    logInfo$1("Application initialized successfully");
  } catch (error) {
    logError$1("Failed to initialize application", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
const getLockFilePath = () => {
  return path__namespace.join(electron.app.getPath("userData"), "logger-lock.json");
};
function setLogFileLock(logFilePath2) {
  try {
    const lockFilePath = getLockFilePath();
    const data = {
      activeLogFile: logFilePath2,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: 2
      // Version to identify single log file strategy
    };
    fs__namespace.writeFileSync(lockFilePath, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Error writing logger lock file:", err);
    return false;
  }
}
function getLogFileLock() {
  try {
    const lockFilePath = getLockFilePath();
    if (fs__namespace.existsSync(lockFilePath)) {
      const data = JSON.parse(fs__namespace.readFileSync(lockFilePath));
      if (data.activeLogFile && fs__namespace.existsSync(data.activeLogFile)) {
        return data.activeLogFile;
      } else {
        if (data.activeLogFile) {
          try {
            const logDir = path__namespace.dirname(data.activeLogFile);
            if (!fs__namespace.existsSync(logDir)) {
              fs__namespace.mkdirSync(logDir, { recursive: true });
            }
          } catch (dirErr) {
            console.error("Error creating log directory:", dirErr);
          }
        }
      }
    }
    return null;
  } catch (err) {
    console.error("Error reading logger lock file:", err);
    return null;
  }
}
function enhanceDockerPath() {
  try {
    const DOCKER_PATH_CONFIG = {
      darwin: [
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/Applications/Docker.app/Contents/Resources/bin",
        path__namespace.join(os__namespace.homedir(), ".docker/bin")
      ],
      linux: [
        "/usr/bin",
        "/usr/local/bin"
      ],
      win32: [
        "C:\\Program Files\\Docker\\Docker\\resources\\bin",
        path__namespace.join(os__namespace.homedir(), "AppData\\Local\\Docker\\Docker\\resources\\bin")
      ]
    };
    const platform = process.platform;
    const possiblePaths = DOCKER_PATH_CONFIG[platform] || [];
    const existingPaths = possiblePaths.filter((p) => {
      try {
        return fs__namespace.existsSync(p);
      } catch (error) {
        return false;
      }
    });
    const currentPath = process.env.PATH || "";
    const pathSeparator = platform === "win32" ? ";" : ":";
    const enhancedPath = [...existingPaths, currentPath].join(pathSeparator);
    process.env.PATH = enhancedPath;
    console.log(`Enhanced PATH for Docker commands: ${process.env.PATH}`);
    return enhancedPath;
  } catch (error) {
    console.error("Error enhancing Docker PATH:", error);
    return process.env.PATH || "";
  }
}
enhanceDockerPath();
let appDir = "";
try {
  appDir = __dirname;
  console.log("Using CommonJS __dirname:", appDir);
} catch (e) {
  try {
    console.log("CommonJS __dirname not available, using fallback");
    appDir = electron.app.getAppPath();
    console.log("Using app path fallback:", appDir);
  } catch (e2) {
    console.error("Both __dirname and app.getAppPath() failed:", e2);
    appDir = process.cwd();
    console.log("Using cwd fallback:", appDir);
  }
}
console.log("Node environment:", "development");
console.log("Current working directory:", process.cwd());
console.log("App directory:", appDir);
let ACTIVE_LOG_FILE = null;
const LOG_FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const MAX_LOG_FILES = 5;
const logInfo = (message, data) => {
  const logMessage = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] [INFO] ${message}${""}`;
  console.log(logMessage);
  appendToLogFile(logMessage);
};
const logError = (message, error) => {
  let errorStr = "";
  if (error) {
    if (error instanceof Error) {
      errorStr = `
${error.stack || error.message}`;
    } else {
      try {
        errorStr = `
${JSON.stringify(error)}`;
      } catch {
        errorStr = `
${String(error)}`;
      }
    }
  }
  const logMessage = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] [ERROR] ${message}${errorStr}`;
  console.error(logMessage);
  appendToLogFile(logMessage);
};
function getLogFilePath() {
  try {
    const appDataPath = electron.app.getPath("userData");
    let workDirPath = null;
    const workDirFilePath = path__namespace.join(appDataPath, "workdir.json");
    if (fs__namespace.existsSync(workDirFilePath)) {
      try {
        const data = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf-8"));
        workDirPath = data.workDir;
      } catch (err) {
        console.error("Error parsing workdir.json:", err);
      }
    }
    const logsPath = workDirPath ? path__namespace.join(workDirPath, "logs") : path__namespace.join(appDataPath, "logs");
    if (!fs__namespace.existsSync(logsPath)) {
      fs__namespace.mkdirSync(logsPath, { recursive: true });
    }
    return path__namespace.join(logsPath, "app.log");
  } catch (err) {
    console.error("Error getting log file path:", err);
    return null;
  }
}
let logFilePath = null;
function initLogFile() {
  try {
    logFilePath = getLogFilePath();
    if (logFilePath) {
      if (!fs__namespace.existsSync(logFilePath)) {
        const initialMessage = `===============================================
Odoo Manager - Application Log (Main Process)
Started: ${(/* @__PURE__ */ new Date()).toLocaleString()}
Environment: ${"development"}
===============================================
`;
        fs__namespace.writeFileSync(logFilePath, initialMessage);
        console.log(`Log file created at: ${logFilePath}`);
      } else {
        const sessionMessage = `
===============================================
Session started: ${(/* @__PURE__ */ new Date()).toLocaleString()}
===============================================
`;
        checkAndRotateLogFile();
        fs__namespace.appendFileSync(logFilePath, sessionMessage);
        console.log(`Using existing log file at: ${logFilePath}`);
      }
    }
  } catch (err) {
    console.error("Error initializing log file:", err);
  }
}
function checkAndRotateLogFile() {
  if (!logFilePath || !fs__namespace.existsSync(logFilePath)) {
    return false;
  }
  try {
    const stats = fs__namespace.statSync(logFilePath);
    if (stats.size < LOG_FILE_SIZE_LIMIT) {
      return false;
    }
    console.log(`Log file size (${stats.size} bytes) exceeds limit (${LOG_FILE_SIZE_LIMIT} bytes), rotating logs...`);
    const logsDir = path__namespace.dirname(logFilePath);
    const baseLogName = path__namespace.basename(logFilePath, ".log");
    const rotatedLogs = fs__namespace.readdirSync(logsDir).filter((f) => f.startsWith(`${baseLogName}.`) && f.endsWith(".log")).sort();
    for (let i = rotatedLogs.length - 1; i >= 0; i--) {
      const match = rotatedLogs[i].match(new RegExp(`${baseLogName}.(d+).log`));
      if (match) {
        const rotationNumber = parseInt(match[1], 10);
        if (rotationNumber >= MAX_LOG_FILES - 1) {
          const oldestLog = path__namespace.join(logsDir, rotatedLogs[i]);
          fs__namespace.unlinkSync(oldestLog);
          console.log(`Deleted old log file: ${oldestLog}`);
        } else {
          const oldPath = path__namespace.join(logsDir, rotatedLogs[i]);
          const newPath = path__namespace.join(logsDir, `${baseLogName}.${rotationNumber + 1}.log`);
          fs__namespace.renameSync(oldPath, newPath);
          console.log(`Rotated log file: ${oldPath} -> ${newPath}`);
        }
      }
    }
    const rotatedLogPath = path__namespace.join(logsDir, `${baseLogName}.1.log`);
    fs__namespace.renameSync(logFilePath, rotatedLogPath);
    console.log(`Rotated main log file: ${logFilePath} -> ${rotatedLogPath}`);
    const now = /* @__PURE__ */ new Date();
    const initialMessage = `===============================================
Odoo Manager - Application Log (Rotated)
Started: ${now.toLocaleString()}
Environment: ${"development"}
===============================================
`;
    fs__namespace.writeFileSync(logFilePath, initialMessage);
    return true;
  } catch (err) {
    console.error("Error rotating log file:", err);
    return false;
  }
}
function appendToLogFile(message) {
  if (!logFilePath) return;
  try {
    checkAndRotateLogFile();
    fs__namespace.appendFileSync(logFilePath, message + "\n");
  } catch (err) {
    console.error("Error writing to log file:", err);
  }
}
electron.app.setName("odoo-manager");
electron.app.setAboutPanelOptions({
  applicationName: "Odoo Manager",
  applicationVersion: electron.app.getVersion(),
  version: electron.app.getVersion(),
  copyright: "© 2025 WebGraphix",
  authors: ["WebGraphix"],
  website: "https://odoo.webgraphix.online",
  credits: "Professional Odoo instance management tool for Docker environments"
});
global.allowSplashClose = false;
global.comingFromSetup = false;
global.currentThemeMode = null;
global.themeUpdateInProgress = false;
const typedIpcMain = electron.ipcMain;
electron.ipcMain.on("register-log-file", (_event, logFilePath2) => {
  try {
    if (!ACTIVE_LOG_FILE && logFilePath2 && fs__namespace.existsSync(logFilePath2)) {
      ACTIVE_LOG_FILE = logFilePath2;
      setLogFileLock(logFilePath2);
      logInfo(`Registered active log file: ${logFilePath2}`);
    }
  } catch (err) {
    console.error("Error registering log file:", err);
  }
});
electron.ipcMain.handle("get-active-log-file", () => {
  try {
    ACTIVE_LOG_FILE = getLogFileLock();
    return ACTIVE_LOG_FILE;
  } catch (err) {
    console.error("Error getting active log file:", err);
    return null;
  }
});
electron.ipcMain.handle("get-log-file-path", async () => {
  try {
    const appDataPath = electron.app.getPath("userData");
    let workDirPath = null;
    const workDirFilePath = path__namespace.join(appDataPath, "workdir.json");
    if (fs__namespace.existsSync(workDirFilePath)) {
      try {
        const data = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf-8"));
        workDirPath = data.workDir;
      } catch (err) {
        logError("Error parsing workdir.json", err);
      }
    }
    const logsPath = workDirPath && fs__namespace.existsSync(workDirPath) ? path__namespace.join(workDirPath, "logs") : path__namespace.join(appDataPath, "logs");
    if (!fs__namespace.existsSync(logsPath)) {
      return null;
    }
    const mainLogPath = path__namespace.join(logsPath, "app.log");
    if (fs__namespace.existsSync(mainLogPath)) {
      return mainLogPath;
    }
    const logFiles = fs__namespace.readdirSync(logsPath).filter((file) => file.endsWith(".log")).map((file) => path__namespace.join(logsPath, file));
    if (logFiles.length === 0) {
      return null;
    }
    return logFiles.sort((a, b) => {
      const statA = fs__namespace.statSync(a);
      const statB = fs__namespace.statSync(b);
      return statB.birthtimeMs - statA.birthtimeMs;
    })[0];
  } catch (error) {
    logError("Error in get-log-file-path handler", error);
    return null;
  }
});
electron.ipcMain.handle("open-log-file", async (_event, { logFilePath: logFilePath2 }) => {
  try {
    if (!logFilePath2 || !fs__namespace.existsSync(logFilePath2)) {
      logError(`Log file not found: ${logFilePath2}`);
      return false;
    }
    await electron.shell.openPath(logFilePath2);
    return true;
  } catch (error) {
    logError("Error in open-log-file handler", error);
    return false;
  }
});
function emitMainWindowVisible(window2) {
  if (!window2 || window2.isDestroyed()) return;
  setTimeout(() => {
    if (window2 && !window2.isDestroyed()) {
      window2.webContents.send("main-window-visible");
    }
  }, 200);
}
async function handleAppTermination(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true;
  }
  try {
    return new Promise((resolve) => {
      const responseHandler = (_event, { canTerminate, alreadyConfirmed }) => {
        electron.ipcMain.removeListener("exit-confirmation-response", responseHandler);
        if (alreadyConfirmed) {
          logInfo("Exit already confirmed by user, allowing termination");
          resolve(true);
          return;
        }
        resolve(canTerminate);
      };
      electron.ipcMain.once("exit-confirmation-response", responseHandler);
      mainWindow.webContents.send("check-running-containers");
      setTimeout(() => {
        electron.ipcMain.removeListener("exit-confirmation-response", responseHandler);
        logInfo("No response from renderer about running containers, allowing termination");
        resolve(true);
      }, 2e3);
    });
  } catch (error) {
    logError("Error checking for running containers", error);
    return true;
  }
}
function loadAndShowDevWindow(window2) {
  if (!window2 || window2.isDestroyed()) return;
  window2.loadURL("http://localhost:5173/#/main").then(() => {
    if (!window2 || window2.isDestroyed()) return;
    window2.show();
    window2.focus();
    emitMainWindowVisible(window2);
  }).catch((err) => {
    logError("Failed to load main URL", err);
    if (!window2 || window2.isDestroyed()) return;
    window2.show();
    window2.focus();
    emitMainWindowVisible(window2);
  });
  if (!window2.isDestroyed()) {
    window2.webContents.openDevTools({ mode: "detach" });
  }
}
function loadAndShowWindow(window2) {
  if (!window2) {
    logError("Cannot load and show a null or undefined window!");
    return;
  }
  {
    loadAndShowDevWindow(window2);
  }
}
const windowConfigs = {
  "main": {
    width: 1200,
    height: 900,
    resizable: true,
    minWidth: 1200,
    minHeight: 750,
    title: "Odoo Manager"
  },
  "splash": {
    width: 500,
    height: 400,
    resizable: false,
    title: "Odoo Manager"
  },
  "setup": {
    width: 950,
    height: 800,
    resizable: true,
    minWidth: 800,
    minHeight: 600,
    title: "Odoo Manager"
  },
  "help": {
    width: 750,
    height: 700,
    resizable: true,
    minWidth: 600,
    minHeight: 500,
    title: "Odoo Manager - Help"
  },
  "settings": {
    width: 900,
    height: 700,
    resizable: true,
    minWidth: 800,
    minHeight: 600,
    title: "Odoo Manager - Settings"
  },
  "new-instance": {
    width: 600,
    height: 870,
    resizable: true,
    minWidth: 500,
    minHeight: 700,
    title: "Odoo Manager - New Instance"
  },
  "new-postgres": {
    width: 600,
    height: 820,
    resizable: true,
    minWidth: 500,
    minHeight: 700,
    title: "Odoo Manager - New PostgreSQL Instance"
  },
  "container-info": {
    width: 700,
    height: 850,
    resizable: true,
    minWidth: 700,
    minHeight: 850,
    title: "Odoo Manager - Container Info"
  },
  "container-logs": {
    width: 800,
    height: 860,
    resizable: true,
    minWidth: 600,
    minHeight: 700,
    title: "Odoo Manager - Container Logs"
  }
};
function getWindowConfig(type) {
  return windowConfigs[type] || {
    width: 800,
    height: 600,
    resizable: true,
    title: `Odoo Manager - ${type}`
  };
}
const windows = {};
async function isSetupCompleted() {
  try {
    if (process.platform === "win32") {
      const appDataPath = electron.app.getPath("userData");
      const workDirFilePath2 = path__namespace.join(appDataPath, "workdir.json");
      if (fs__namespace.existsSync(workDirFilePath2)) {
        logInfo("Windows: workdir.json exists, setup completed");
        try {
          const workDirData2 = JSON.parse(fs__namespace.readFileSync(workDirFilePath2, "utf8"));
          const workDir2 = workDirData2.workDir;
          logInfo(`Windows: workdir.json points to: ${workDir2}`);
          const settingsPath2 = path__namespace.join(workDir2, "settings.json");
          const settingsExists = fs__namespace.existsSync(settingsPath2);
          logInfo(`Windows: Settings file exists at ${settingsPath2}? ${settingsExists}`);
          return { completed: settingsExists };
        } catch (err) {
          logError("Windows: Error parsing workdir.json or checking settings", err);
          return { completed: false };
        }
      } else {
        logInfo("Windows: workdir.json does not exist, setup not completed");
        return { completed: false };
      }
    }
    const workDirFilePath = path__namespace.join(electron.app.getPath("userData"), "workdir.json");
    if (!fs__namespace.existsSync(workDirFilePath)) {
      logInfo("Work directory file does not exist, setup not completed");
      return { completed: false };
    }
    const workDirData = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf8"));
    const workDir = workDirData.workDir;
    if (!workDir || !fs__namespace.existsSync(workDir)) {
      logInfo("Work directory does not exist, setup not completed");
      return { completed: false };
    }
    const settingsPath = path__namespace.join(workDir, "settings.json");
    if (!fs__namespace.existsSync(settingsPath)) {
      logInfo("Settings file does not exist, setup not completed");
      return { completed: false };
    }
    return { completed: true };
  } catch (error) {
    logError("Error checking setup status", error);
    return { completed: false };
  }
}
function createSetupWindow() {
  logInfo("Creating setup window");
  const mainConfig = getWindowConfig("main");
  const setupConfig = getWindowConfig("setup");
  const preloadPath = path__namespace.join(process.cwd(), "dist-electron", "preload.js");
  logInfo(`Using preload path for setup window: ${preloadPath}`);
  const setupWindow = new electron.BrowserWindow({
    width: mainConfig.width,
    height: mainConfig.height,
    minWidth: mainConfig.minWidth,
    minHeight: mainConfig.minHeight,
    center: true,
    show: false,
    backgroundColor: "#121212",
    title: setupConfig.title,
    titleBarStyle: "default",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  setupWindow.setTitle(setupConfig.title);
  setupWindow.webContents.on("did-finish-load", () => {
    setupWindow.setTitle(setupConfig.title);
  });
  setupWindow.once("ready-to-show", () => {
    setupWindow.show();
    setupWindow.focus();
  });
  {
    setupWindow.loadURL("http://localhost:5173/#/setup").catch((err) => {
      logError("Failed to load setup URL", err);
    });
    setupWindow.webContents.openDevTools({ mode: "detach" });
  }
  setupWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url).catch((err) => {
      logError(`Failed to open external URL: ${url}`, err);
    });
    return { action: "deny" };
  });
  windows.setup = setupWindow;
  return setupWindow;
}
function createSplashWindow() {
  logInfo("Creating splash window");
  const config = getWindowConfig("splash");
  const preloadPath = path__namespace.join(process.cwd(), "dist-electron", "preload.js");
  logInfo(`Using preload path: ${preloadPath}`);
  const splash = new electron.BrowserWindow({
    width: 500,
    height: 600,
    center: true,
    frame: false,
    transparent: process.platform !== "linux",
    backgroundColor: process.platform === "linux" ? "#121212" : void 0,
    resizable: false,
    movable: true,
    title: config.title,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    }
  });
  {
    splash.webContents.openDevTools({ mode: "detach" });
  }
  splash.on("close", (event) => {
    if (global.allowSplashClose) {
      return;
    }
    event.preventDefault();
    electron.app.emit("verification-complete");
  });
  splash.once("ready-to-show", () => {
    splash.show();
  });
  {
    splash.loadURL("http://localhost:5173/#/splash").catch((err) => {
      logError("Failed to load splash URL", err);
    });
  }
  windows.splash = splash;
  return splash;
}
function createMainWindow() {
  logInfo("Creating main window");
  const config = getWindowConfig("main");
  const preloadPath = path__namespace.join(process.cwd(), "dist-electron", "preload.js");
  logInfo(`Using preload path for main window: ${preloadPath}`);
  const mainWindow = new electron.BrowserWindow({
    width: config.width,
    height: config.height,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    center: true,
    show: false,
    frame: true,
    transparent: false,
    backgroundColor: "#121212",
    titleBarStyle: "default",
    title: config.title,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.setTitle(config.title);
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(config.title);
  });
  let terminationInProgress = false;
  mainWindow.on("close", async (event) => {
    if (terminationInProgress) {
      return;
    }
    event.preventDefault();
    terminationInProgress = true;
    const shouldTerminate = await handleAppTermination(mainWindow);
    if (shouldTerminate) {
      logInfo("App termination approved, quitting...");
      terminationInProgress = false;
      mainWindow.removeAllListeners("close");
      electron.app.quit();
    } else {
      logInfo("App termination cancelled by user");
      terminationInProgress = false;
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url).catch((err) => {
      logError(`Failed to open external URL: ${url}`, err);
    });
    return { action: "deny" };
  });
  windows.main = mainWindow;
  return mainWindow;
}
function createWindow(windowType, options = {}) {
  logInfo(`Creating window: ${windowType}`);
  const defaultConfig = getWindowConfig(windowType);
  const preloadPath = path__namespace.join(process.cwd(), "dist-electron", "preload.js");
  logInfo(`Using preload path for ${windowType} window: ${preloadPath}`);
  const window2 = new electron.BrowserWindow({
    width: options.width || defaultConfig.width,
    height: options.height || defaultConfig.height,
    minWidth: options.minWidth || defaultConfig.minWidth,
    minHeight: options.minHeight || defaultConfig.minHeight,
    resizable: options.hasOwnProperty("resizable") ? options.resizable : defaultConfig.resizable,
    center: true,
    show: false,
    frame: true,
    title: options.title || defaultConfig.title,
    autoHideMenuBar: process.platform !== "darwin",
    titleBarStyle: "default",
    modal: options.modal === true,
    backgroundColor: "#121212",
    parent: options.parent && windows[options.parent] ? windows[options.parent] : void 0,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
      additionalArguments: options.data ? [`--window-data=${JSON.stringify(options.data)}`] : []
    }
  });
  const windowTitle = options.title || defaultConfig.title;
  window2.setTitle(windowTitle);
  window2.webContents.on("did-finish-load", () => {
    window2.setTitle(windowTitle);
  });
  if (!options.modal) {
    window2.setParentWindow(null);
  }
  window2.once("ready-to-show", () => {
    if (!window2.isDestroyed()) {
      window2.show();
    }
  });
  {
    window2.loadURL(`http://localhost:5173/#/${windowType}`).catch((err) => {
      logError(`Failed to load ${windowType} URL`, err);
      if (!window2.isDestroyed()) {
        window2.show();
      }
    });
    if (options.openDevTools) {
      window2.webContents.openDevTools({ mode: "detach" });
    }
  }
  windows[windowType] = window2;
  window2.isClosing = false;
  const originalClose = window2.close.bind(window2);
  window2.originalClose = originalClose;
  window2.close = function() {
    if (window2.isDestroyed() || window2.isClosing) {
      return originalClose();
    }
    window2.isClosing = true;
    if (!window2.isDestroyed() && window2.webContents) {
      window2.webContents.send("window-fade-out");
      electron.ipcMain.once("window-fade-out-confirm", () => {
        let opacity = 1;
        const fadeStep = 0.1;
        const fadeInterval = setInterval(() => {
          if (window2.isDestroyed()) {
            clearInterval(fadeInterval);
            return;
          }
          opacity -= fadeStep;
          if (opacity <= 0) {
            clearInterval(fadeInterval);
            if (!window2.isDestroyed()) {
              originalClose();
            }
          } else {
            window2.setOpacity(opacity);
          }
        }, 10);
      });
      setTimeout(() => {
        if (!window2.isDestroyed() && window2.isClosing) {
          originalClose();
        }
      }, 800);
    } else {
      originalClose();
    }
    return void 0;
  };
  window2.on("close", (event) => {
    if (!window2.isClosing) {
      event.preventDefault();
      window2.close();
    }
  });
  window2.on("closed", () => {
    windows[windowType] = void 0;
  });
  return window2;
}
function showMainWindow() {
  logInfo("showMainWindow function called");
  try {
    global.allowSplashClose = true;
    const mainExists = windows.main && !windows.main.isDestroyed();
    const splashExists = windows.splash && !windows.splash.isDestroyed();
    logInfo(`Window state: main exists=${mainExists}, splash exists=${splashExists}`);
    if (process.platform === "win32") {
      logInfo("Windows platform: executing showMainWindow");
      if (splashExists && windows.splash) {
        try {
          logInfo("Windows: Force-closing splash window");
          windows.splash.destroy();
        } catch (err) {
          logError("Windows: Error force-closing splash window", err);
        }
      }
      if (mainExists && windows.main) {
        logInfo("Windows: Showing existing main window");
        loadAndShowWindow(windows.main);
        return;
      } else {
        logInfo("Windows: Creating and showing new main window");
        const newMain = createMainWindow();
        setTimeout(() => {
          loadAndShowWindow(newMain);
        }, 100);
        return;
      }
    }
    if (mainExists && windows.main) {
      windows.main.hide();
      if (splashExists && windows.splash) {
        let splashOpacity = 1;
        const fadeInterval = setInterval(() => {
          splashOpacity -= 0.04;
          if (splashOpacity <= 0) {
            clearInterval(fadeInterval);
            if (windows.splash && !windows.splash.isDestroyed()) {
              try {
                windows.splash.close();
                setTimeout(() => {
                  if (windows.main && !windows.main.isDestroyed()) {
                    const mainWindow = windows.main;
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      loadAndShowWindow(mainWindow);
                    }
                  }
                }, 500);
              } catch (err) {
                logError("Error closing splash window", err);
                if (windows.main && !windows.main.isDestroyed()) {
                  const mainWindow = windows.main;
                  loadAndShowWindow(mainWindow);
                }
              }
            } else {
              if (windows.main && !windows.main.isDestroyed()) {
                const mainWindow = windows.main;
                loadAndShowWindow(mainWindow);
              }
            }
          } else if (windows.splash && !windows.splash.isDestroyed()) {
            windows.splash.setOpacity(splashOpacity);
          } else {
            clearInterval(fadeInterval);
            if (windows.main && !windows.main.isDestroyed()) {
              const mainWindow = windows.main;
              loadAndShowWindow(mainWindow);
            }
          }
        }, 16);
      } else {
        if (windows.main && !windows.main.isDestroyed()) {
          const mainWindow = windows.main;
          loadAndShowWindow(mainWindow);
        }
      }
      setTimeout(() => {
        global.allowSplashClose = false;
      }, 2e3);
    } else {
      const newMain = createMainWindow();
      if (splashExists && windows.splash) {
        try {
          let splashOpacity = 1;
          const fadeInterval = setInterval(() => {
            splashOpacity -= 0.04;
            if (splashOpacity <= 0) {
              clearInterval(fadeInterval);
              if (windows.splash && !windows.splash.isDestroyed()) {
                windows.splash.close();
                setTimeout(() => {
                  loadAndShowWindow(newMain);
                }, 50);
              } else {
                loadAndShowWindow(newMain);
              }
            } else if (windows.splash && !windows.splash.isDestroyed()) {
              windows.splash.setOpacity(splashOpacity);
            } else {
              clearInterval(fadeInterval);
              loadAndShowWindow(newMain);
            }
          }, 16);
        } catch (err) {
          logError("Error closing splash window", err);
          if (!newMain.isDestroyed()) {
            newMain.show();
            emitMainWindowVisible(newMain);
          }
        }
      } else {
        newMain.show();
        emitMainWindowVisible(newMain);
      }
    }
  } catch (error) {
    logError("Error in showMainWindow", error);
    try {
      const newMain = createMainWindow();
      if (windows.splash && !windows.splash.isDestroyed()) {
        try {
          windows.splash.close();
          setTimeout(() => {
            newMain.show();
            emitMainWindowVisible(newMain);
          }, 100);
        } catch (err) {
          logError("Error closing splash window", err);
          newMain.show();
          emitMainWindowVisible(newMain);
        }
      } else {
        newMain.show();
        emitMainWindowVisible(newMain);
      }
    } catch (fallbackError) {
      logError("Failed to create fallback main window", fallbackError);
    }
  }
}
function createAppMenu() {
  if (process.platform !== "darwin") return;
  logInfo("Creating macOS application menu");
  const template = [
    {
      label: electron.app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Preferences",
          accelerator: "Cmd+,",
          click: () => {
            if (windows.settings && !windows.settings.isDestroyed()) {
              windows.settings.focus();
            } else {
              createWindow("settings");
            }
          }
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Odoo Instance",
          accelerator: "Cmd+N",
          click: () => {
            if (windows.main && !windows.main.isDestroyed()) {
              createWindow("new-instance");
            }
          }
        },
        {
          label: "New PostgreSQL Instance",
          accelerator: "Shift+Cmd+N",
          click: () => {
            if (windows.main && !windows.main.isDestroyed()) {
              createWindow("new-postgres");
            }
          }
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
        { type: "separator" },
        { role: "window" }
      ]
    },
    {
      role: "help",
      submenu: [
        {
          label: "Help",
          accelerator: "Cmd+H",
          click: () => {
            if (windows.help && !windows.help.isDestroyed()) {
              windows.help.focus();
            } else {
              createWindow("help");
            }
          }
        },
        { type: "separator" },
        {
          label: "Open Application Logs",
          click: async () => {
            var _a, _b;
            try {
              const event = {
                sender: (_a = windows.main) == null ? void 0 : _a.webContents
              };
              const handler = (_b = typedIpcMain.handlers) == null ? void 0 : _b["get-log-file-path"];
              if (handler) {
                const logFilePath2 = await handler(event);
                if (logFilePath2) {
                  await electron.shell.openPath(logFilePath2);
                } else {
                  electron.dialog.showMessageBox({
                    type: "info",
                    title: "No Logs Available",
                    message: "No application logs were found."
                  });
                }
              }
            } catch (error) {
              logError("Error opening application logs", error);
            }
          }
        }
      ]
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
}
async function setupWindowsDefaults() {
  try {
    logInfo("Setting up Windows-specific default configuration");
    const appDataPath = electron.app.getPath("userData");
    logInfo(`Using AppData path: ${appDataPath}`);
    try {
      const appDataContents = fs__namespace.readdirSync(appDataPath);
      logInfo(`AppData contents: ${JSON.stringify(appDataContents)}`);
    } catch (err) {
      logError("Error reading AppData directory", err);
    }
    const workDirFilePath = path__namespace.join(appDataPath, "workdir.json");
    if (!fs__namespace.existsSync(workDirFilePath)) {
      try {
        fs__namespace.writeFileSync(workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
        logInfo(`Created workdir.json in AppData pointing to itself: ${appDataPath}`);
      } catch (err) {
        logError("Error creating workdir.json", err);
        return false;
      }
    } else {
      logInfo(`workdir.json already exists in AppData`);
      try {
        const workDirData = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf8"));
        logInfo(`Existing workdir.json contents: ${JSON.stringify(workDirData)}`);
        if (workDirData.workDir !== appDataPath) {
          logInfo(`Updating workdir.json to point to correct AppData path`);
          workDirData.workDir = appDataPath;
          fs__namespace.writeFileSync(workDirFilePath, JSON.stringify(workDirData, null, 2));
        }
      } catch (err) {
        logError("Error reading/updating existing workdir.json", err);
        try {
          fs__namespace.writeFileSync(workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
          logInfo(`Recreated workdir.json after error`);
        } catch (writeErr) {
          logError("Failed to recreate workdir.json", writeErr);
          return false;
        }
      }
    }
    const settingsPath = path__namespace.join(appDataPath, "settings.json");
    if (!fs__namespace.existsSync(settingsPath)) {
      try {
        const defaultSettings2 = {
          theme: "dark",
          language: "en",
          network: "odoo-network",
          showWelcomeScreen: true,
          autoCheckUpdates: true,
          updateCheckFrequency: "daily",
          showUpdateNotifications: true,
          lastUpdateCheck: null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        fs__namespace.writeFileSync(settingsPath, JSON.stringify(defaultSettings2, null, 2));
        logInfo(`Created default settings.json in AppData`);
      } catch (err) {
        logError("Error creating settings.json", err);
        return false;
      }
    } else {
      logInfo(`settings.json already exists in AppData at: ${settingsPath}`);
      try {
        const settingsData = JSON.parse(fs__namespace.readFileSync(settingsPath, "utf8"));
        logInfo(`Existing settings.json contents: ${JSON.stringify(settingsData)}`);
      } catch (err) {
        logError("Error reading existing settings.json", err);
        try {
          const defaultSettings2 = {
            theme: "dark",
            language: "en",
            network: "odoo-network",
            showWelcomeScreen: true,
            autoCheckUpdates: true,
            updateCheckFrequency: "daily",
            showUpdateNotifications: true,
            lastUpdateCheck: null,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          fs__namespace.writeFileSync(settingsPath, JSON.stringify(defaultSettings2, null, 2));
          logInfo(`Recreated settings.json after error`);
        } catch (writeErr) {
          logError("Failed to recreate settings.json", writeErr);
          return false;
        }
      }
    }
    const odooDir = path__namespace.join(appDataPath, "odoo");
    const postgresDir = path__namespace.join(appDataPath, "postgres");
    const logsDir = path__namespace.join(appDataPath, "logs");
    try {
      if (!fs__namespace.existsSync(odooDir)) {
        fs__namespace.mkdirSync(odooDir, { recursive: true });
        logInfo(`Created odoo directory in AppData: ${odooDir}`);
      } else {
        logInfo(`odoo directory already exists: ${odooDir}`);
      }
    } catch (err) {
      logError("Error creating odoo directory", err);
      return false;
    }
    try {
      if (!fs__namespace.existsSync(postgresDir)) {
        fs__namespace.mkdirSync(postgresDir, { recursive: true });
        logInfo(`Created postgres directory in AppData: ${postgresDir}`);
      } else {
        logInfo(`postgres directory already exists: ${postgresDir}`);
      }
    } catch (err) {
      logError("Error creating postgres directory", err);
      return false;
    }
    try {
      if (!fs__namespace.existsSync(logsDir)) {
        fs__namespace.mkdirSync(logsDir, { recursive: true });
        logInfo(`Created logs directory in AppData: ${logsDir}`);
      } else {
        logInfo(`logs directory already exists: ${logsDir}`);
      }
    } catch (err) {
      logError("Error creating logs directory", err);
      return false;
    }
    let setupSuccessful = true;
    if (!fs__namespace.existsSync(workDirFilePath)) {
      logError("workdir.json was not created successfully");
      setupSuccessful = false;
    }
    if (!fs__namespace.existsSync(settingsPath)) {
      logError("settings.json was not created successfully");
      setupSuccessful = false;
    }
    if (!fs__namespace.existsSync(odooDir)) {
      logError("odoo directory was not created successfully");
      setupSuccessful = false;
    }
    if (!fs__namespace.existsSync(postgresDir)) {
      logError("postgres directory was not created successfully");
      setupSuccessful = false;
    }
    if (!fs__namespace.existsSync(logsDir)) {
      logError("logs directory was not created successfully");
      setupSuccessful = false;
    }
    logInfo(`Windows-specific default configuration completed successfully: ${setupSuccessful}`);
    return setupSuccessful;
  } catch (error) {
    logError("Error setting up Windows-specific defaults", error);
    return false;
  }
}
electron.app.whenReady().then(async () => {
  initLogFile();
  logInfo("Application ready, initializing...");
  ACTIVE_LOG_FILE = getLogFileLock();
  if (ACTIVE_LOG_FILE) {
    logInfo(`Found existing log file from lock: ${ACTIVE_LOG_FILE}`);
  }
  initializeIpcHandlers();
  createAppMenu();
  electron.ipcMain.on("create-instance", async (event, data) => {
    logInfo("[CREATE-INSTANCE] Received create-instance event");
    try {
      const createWithTimeout = async () => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Instance creation timed out after 60 seconds. Please check Docker status."));
          }, 6e4);
          const execOperation = async () => {
            try {
              if (data.instanceType === "postgres") {
                return await dockerComposeService.createPostgresInstance(
                  data.instanceName,
                  data.version,
                  parseInt(data.port, 10) || 5432,
                  data.username || "postgres",
                  data.password || "postgres"
                );
              } else {
                return await dockerComposeService.createInstance(
                  data.instanceName,
                  data.version,
                  data.edition,
                  data.adminPassword,
                  data.dbFilter,
                  parseInt(data.port, 10) || 8069,
                  data.customImage,
                  data.customImageName,
                  data.postgresInstance,
                  data.pgUser,
                  data.pgPassword,
                  data.pgPort
                );
              }
            } catch (error) {
              logError("[CREATE-INSTANCE] Error in execution", error);
              throw error;
            }
          };
          execOperation().then((res) => {
            clearTimeout(timeout);
            resolve(res);
          }).catch((err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      };
      const result = await createWithTimeout();
      logInfo("[CREATE-INSTANCE] Docker Compose operation completed");
      if (result.success) {
        event.sender.send("instance-created", {
          ...data,
          port: result.port,
          instanceType: data.instanceType
        });
        if (windows.main && !windows.main.isDestroyed() && event.sender !== windows.main.webContents) {
          windows.main.webContents.send("instance-created", {
            ...data,
            port: result.port,
            instanceType: data.instanceType
          });
        }
      } else {
        logError("[CREATE-INSTANCE] Error", result.message);
        event.sender.send("instance-creation-error", {
          instanceType: data.instanceType,
          error: result.message || "Unknown error during instance creation"
        });
      }
    } catch (error) {
      logError("[CREATE-INSTANCE] Error handling request", error);
      event.sender.send("instance-creation-error", {
        instanceType: data.instanceType || "unknown",
        error: error instanceof Error ? error.message : "Unknown error occurred during instance creation"
      });
    }
  });
  electron.ipcMain.handle("update-postgres-credentials", async (_event, data) => {
    logInfo("[UPDATE-POSTGRES-CREDENTIALS] Received update request");
    try {
      const { instanceName, username, password } = data;
      const result = await dockerComposeService.updatePostgresCredentials(instanceName, username, password);
      if (result.updatedInstances && result.updatedInstances.length > 0) {
        logInfo(`[UPDATE-POSTGRES-CREDENTIALS] Updated ${result.updatedInstances.length} dependent Odoo instances`);
      }
      return result;
    } catch (error) {
      logError("[UPDATE-POSTGRES-CREDENTIALS] Error updating credentials", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error updating credentials"
      };
    }
  });
  if (process.platform === "win32") {
    logInfo("Windows platform detected, checking for automatic setup...");
    const windowsSetupResult = await setupWindowsDefaults();
    logInfo(`Windows defaults setup result: ${windowsSetupResult ? "success" : "failed"}`);
    const { completed } = await isSetupCompleted();
    logInfo(`Windows: Is setup completed? ${completed}`);
    if (completed) {
      logInfo("Windows: Setup completed, showing splash screen...");
      createSplashWindow();
      createMainWindow();
      initializeApp();
      electron.app.addListener("verification-complete", () => {
        logInfo("App event: verification complete signal received");
        showMainWindow();
      });
      electron.ipcMain.on("verification-complete", (event) => {
        logInfo("IPC event: verification complete signal received");
        logInfo(`Verification complete received from window ID: ${event.sender.id}`);
        if (process.platform === "win32") {
          logInfo("Windows platform: Processing verification-complete signal");
          if (windows.splash && !windows.splash.isDestroyed()) {
            logInfo("Splash window exists and will be closed");
          } else {
            logInfo("Splash window does not exist or is already destroyed");
          }
          if (windows.main && !windows.main.isDestroyed()) {
            logInfo("Main window exists and will be shown");
          } else {
            logInfo("Main window does not exist or is already destroyed");
          }
        }
        showMainWindow();
      });
    } else {
      logInfo("Windows: Setup not completed, showing setup screen (this should be rare)...");
      const setupWindow = createSetupWindow();
      const mainConfig = getWindowConfig("main");
      setupWindow.setSize(mainConfig.width, mainConfig.height);
      if (mainConfig.minWidth && mainConfig.minHeight) {
        setupWindow.setMinimumSize(mainConfig.minWidth, mainConfig.minHeight);
      }
      setupWindow.center();
    }
  } else {
    logInfo("Checking if setup is completed...");
    const { completed } = await isSetupCompleted();
    if (!completed) {
      logInfo("Setup not completed, showing setup screen...");
      const setupWindow = createSetupWindow();
      const mainConfig = getWindowConfig("main");
      setupWindow.setSize(mainConfig.width, mainConfig.height);
      if (mainConfig.minWidth && mainConfig.minHeight) {
        setupWindow.setMinimumSize(mainConfig.minWidth, mainConfig.minHeight);
      }
      setupWindow.center();
    } else {
      logInfo("Normal startup, showing splash screen...");
      createSplashWindow();
      createMainWindow();
      initializeApp();
      electron.app.addListener("verification-complete", () => {
        logInfo("App event: verification complete signal received");
        showMainWindow();
      });
      electron.ipcMain.on("verification-complete", (event) => {
        logInfo("IPC event: verification complete signal received");
        logInfo(`Verification complete received from window ID: ${event.sender.id}`);
        if (process.platform === "win32") {
          logInfo("Windows platform: Processing verification-complete signal");
          if (windows.splash && !windows.splash.isDestroyed()) {
            logInfo("Splash window exists and will be closed");
          } else {
            logInfo("Splash window does not exist or is already destroyed");
          }
          if (windows.main && !windows.main.isDestroyed()) {
            logInfo("Main window exists and will be shown");
          } else {
            logInfo("Main window does not exist or is already destroyed");
          }
        }
        showMainWindow();
      });
    }
  }
  electron.ipcMain.on("sync-theme", (_event, { mode, source }) => {
    if (global.themeUpdateInProgress) {
      logInfo(`Ignoring theme sync during update: ${mode} from ${source || "unknown"}`);
      return;
    }
    global.themeUpdateInProgress = true;
    logInfo(`Syncing theme to all windows: ${mode} from ${source || "unknown"}`);
    if (global.currentThemeMode !== mode) {
      global.currentThemeMode = mode;
      electron.BrowserWindow.getAllWindows().forEach((window2) => {
        if (!window2.isDestroyed()) {
          if (source && window2.webContents.id === parseInt(source)) {
            logInfo(`Skipping theme update to source window: ${source}`);
          } else {
            window2.webContents.send("theme-changed", mode);
          }
        }
      });
    } else {
      logInfo(`Theme already set to ${mode}, no broadcast needed`);
    }
    setTimeout(() => {
      global.themeUpdateInProgress = false;
    }, 500);
  });
  electron.ipcMain.on("open-file", (event, { instanceName, instanceType, filePath }) => {
    logInfo(`Opening file for instance: ${instanceName}, file: ${filePath}`);
    try {
      const workDirPath = electron.app.getPath("userData");
      const fullPath = path__namespace.join(workDirPath, instanceType, instanceName, filePath);
      if (fs__namespace.existsSync(fullPath)) {
        electron.shell.openPath(fullPath).catch((err) => {
          logError("Error opening file", err);
          event.sender.send("show-error-dialog", {
            title: "Error",
            message: `Could not open file: ${err.message}`
          });
        });
      } else {
        const workDirFilePath = path__namespace.join(electron.app.getPath("userData"), "workdir.json");
        if (fs__namespace.existsSync(workDirFilePath)) {
          try {
            const workDirData = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf8"));
            const alternativePath = path__namespace.join(workDirData.workDir, instanceType, instanceName, filePath);
            if (fs__namespace.existsSync(alternativePath)) {
              electron.shell.openPath(alternativePath).catch((err) => {
                logError("Error opening file", err);
                event.sender.send("show-error-dialog", {
                  title: "Error",
                  message: `Could not open file: ${err.message}`
                });
              });
            } else {
              event.sender.send("show-error-dialog", {
                title: "File Not Found",
                message: `File does not exist: ${filePath}`
              });
            }
          } catch (error) {
            logError("Error parsing workdir.json", error);
            event.sender.send("show-error-dialog", {
              title: "Error",
              message: "Could not determine work directory path"
            });
          }
        }
      }
    } catch (error) {
      logError("Error handling open file request", error);
      event.sender.send("show-error-dialog", {
        title: "Error",
        message: `Could not open file: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  electron.ipcMain.handle("update-odoo-config", async (_event, { instanceName, dbFilter }) => {
    logInfo(`Updating DB filter for instance: ${instanceName}, value: ${dbFilter}`);
    try {
      const workDirPath = await settingsService.getWorkDirPath() || electron.app.getPath("userData");
      const instanceDir = path__namespace.join(workDirPath, "odoo", instanceName);
      const configFile = path__namespace.join(instanceDir, "config", "odoo.conf");
      if (!fs__namespace.existsSync(configFile)) {
        return { success: false, message: "Config file not found" };
      }
      let configContent = fs__namespace.readFileSync(configFile, "utf8");
      if (dbFilter) {
        if (configContent.includes("dbfilter =")) {
          configContent = configContent.replace(/dbfilter =.*\n/, `dbfilter = ^${instanceName}.*$
`);
        } else {
          configContent += `
dbfilter = ^${instanceName}.*$`;
        }
      } else {
        configContent = configContent.replace(/dbfilter =.*\n/, "");
      }
      fs__namespace.writeFileSync(configFile, configContent, "utf8");
      const infoFile = path__namespace.join(instanceDir, "instance-info.json");
      if (fs__namespace.existsSync(infoFile)) {
        try {
          const infoContent = JSON.parse(fs__namespace.readFileSync(infoFile, "utf8"));
          infoContent.dbFilter = dbFilter;
          infoContent.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          fs__namespace.writeFileSync(infoFile, JSON.stringify(infoContent, null, 2), "utf8");
        } catch (error) {
          logError("Error updating instance info", error);
        }
      }
      return { success: true, message: "DB filter updated successfully" };
    } catch (error) {
      logError("Error updating DB filter", error);
      return {
        success: false,
        message: `Error updating DB filter: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });
  electron.ipcMain.on("open-instance-folder", (event, { instanceName, instanceType }) => {
    logInfo(`Opening ${instanceType} folder for instance: ${instanceName}`);
    try {
      const workDirPath = path__namespace.join(electron.app.getPath("userData"));
      const instancePath = path__namespace.join(workDirPath, instanceType, instanceName);
      if (fs__namespace.existsSync(instancePath)) {
        electron.shell.openPath(instancePath).catch((err) => {
          logError(`Error opening ${instanceType} folder`, err);
          event.sender.send("show-error-dialog", {
            title: "Error",
            message: `Could not open folder: ${err.message}`
          });
        });
      } else {
        const workDirFilePath = path__namespace.join(electron.app.getPath("userData"), "workdir.json");
        if (fs__namespace.existsSync(workDirFilePath)) {
          try {
            const workDirData = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf8"));
            const alternativePath = path__namespace.join(workDirData.workDir, instanceType, instanceName);
            if (fs__namespace.existsSync(alternativePath)) {
              electron.shell.openPath(alternativePath).catch((err) => {
                logError(`Error opening alternative ${instanceType} folder`, err);
                event.sender.send("show-error-dialog", {
                  title: "Error",
                  message: `Could not open folder: ${err.message}`
                });
              });
            } else {
              event.sender.send("show-error-dialog", {
                title: "Folder Not Found",
                message: `Instance folder does not exist: ${instanceName}`
              });
            }
          } catch (error) {
            logError("Error parsing workdir.json", error);
            event.sender.send("show-error-dialog", {
              title: "Error",
              message: "Could not determine work directory path"
            });
          }
        } else {
          event.sender.send("show-error-dialog", {
            title: "Folder Not Found",
            message: `Instance folder does not exist: ${instanceName}`
          });
        }
      }
    } catch (error) {
      logError("Error handling open folder request", error);
      event.sender.send("show-error-dialog", {
        title: "Error",
        message: `Could not open folder: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  electron.ipcMain.handle("get-current-theme", (_event) => {
    logInfo(`Current theme requested, returning: ${global.currentThemeMode || "null"}`);
    return global.currentThemeMode;
  });
  electron.ipcMain.handle("get-window-id", (event) => {
    try {
      const webContents = event.sender;
      const win = electron.BrowserWindow.fromWebContents(webContents);
      if (win) {
        const id = win.id;
        logInfo(`Window ID requested: ${id}`);
        return id;
      }
      logError("Could not find window from webContents");
      return null;
    } catch (error) {
      logError("Error getting window ID", error);
      return null;
    }
  });
  let currentLanguage = null;
  electron.ipcMain.on("language-changed", (_event, { language }) => {
    logInfo("Syncing language to all windows: " + language);
    currentLanguage = language;
    electron.BrowserWindow.getAllWindows().forEach((window2) => {
      if (!window2.isDestroyed()) {
        window2.webContents.send("language-changed", language);
      }
    });
  });
  electron.ipcMain.handle("get-current-language", () => {
    return currentLanguage;
  });
  electron.ipcMain.on("verification-failed", (_event, { error }) => {
    logError("Verification failed", error);
    electron.dialog.showErrorBox("Verification Failed", `Error: ${error}`);
  });
  electron.ipcMain.on("open-window", (_event, { type, options }) => {
    logInfo(`Request to open window: ${type}`);
    createWindow(type, options);
  });
  electron.ipcMain.on("close-window", (_event, { type }) => {
    var _a, _b;
    logInfo(`Request to close window: ${type}`);
    if (windows[type] && !((_a = windows[type]) == null ? void 0 : _a.isDestroyed())) {
      (_b = windows[type]) == null ? void 0 : _b.close();
    }
  });
  electron.ipcMain.on("set-window-title", (event, title) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setTitle(title);
    }
  });
  electron.ipcMain.handle("show-message-dialog", async (event, options) => {
    const result = await electron.dialog.showMessageBox(options);
    event.sender.send("dialog-response", result.response);
    return result;
  });
  electron.ipcMain.handle("show-open-dialog", async (_event, options) => {
    return await electron.dialog.showOpenDialog(options);
  });
  electron.ipcMain.handle("show-save-dialog", async (_event, options) => {
    return await electron.dialog.showSaveDialog(options);
  });
  electron.ipcMain.on("setup-window-closing", () => {
    logInfo("[SETUP-CLOSE] Received setup-window-closing signal");
    global.comingFromSetup = true;
  });
  electron.ipcMain.on("prepare-for-main-screen", () => {
    logInfo("======= PREPARING FOR MAIN SCREEN =======");
    try {
      const currentWindow = electron.BrowserWindow.getFocusedWindow();
      if (!currentWindow) {
        logError("No focused window found!");
        return;
      }
      const mainConfig = getWindowConfig("main");
      currentWindow.setSize(mainConfig.width, mainConfig.height);
      if (mainConfig.minWidth && mainConfig.minHeight) {
        currentWindow.setMinimumSize(mainConfig.minWidth, mainConfig.minHeight);
      }
      currentWindow.setResizable(mainConfig.resizable);
      currentWindow.setTitle(mainConfig.title);
      currentWindow.center();
      logInfo("Window prepared for main screen");
    } catch (error) {
      logError("Error preparing window for main screen", error);
    }
  });
  electron.ipcMain.on("get-logs", async (event, { instanceName, timeFilter, tail }) => {
    logInfo(`Getting logs for ${instanceName}, timeFilter: ${timeFilter}, tail: ${tail}`);
    try {
      let sinceParam = "";
      switch (timeFilter) {
        case "last_hour":
          sinceParam = "--since=1h";
          break;
        case "last_2_hours":
          sinceParam = "--since=2h";
          break;
        case "last_6_hours":
          sinceParam = "--since=6h";
          break;
        case "all":
          sinceParam = "";
          break;
      }
      const cmd = timeFilter === "all" ? `docker logs --tail=${tail} ${instanceName}` : `docker logs ${sinceParam} ${instanceName}`;
      const { spawn } = require("child_process");
      const dockerProcess = spawn(cmd, [], { shell: true });
      let logs = "";
      let error = "";
      let timeout = null;
      timeout = setTimeout(() => {
        dockerProcess.kill();
        event.sender.send("logs-response", {
          success: false,
          message: "Timeout waiting for logs. The container might not have any logs."
        });
      }, 1e4);
      dockerProcess.stdout.on("data", (data) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        logs += data.toString();
      });
      dockerProcess.stderr.on("data", (data) => {
        error += data.toString();
      });
      dockerProcess.on("close", (code) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        if (code === 0) {
          event.sender.send("logs-response", {
            success: true,
            logs
          });
        } else {
          event.sender.send("logs-response", {
            success: false,
            message: error || `Process exited with code ${code}`
          });
        }
      });
      dockerProcess.on("error", (err) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        logError("Error executing docker logs command", err);
        event.sender.send("logs-response", {
          success: false,
          message: `Error executing docker logs command: ${err.message}`
        });
      });
    } catch (error) {
      logError("Error getting logs", error);
      event.sender.send("logs-response", {
        success: false,
        message: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  setTimeout(() => {
    if (windows.main && !windows.main.isVisible() && windows.splash && windows.splash.isVisible()) {
      logInfo("DEBUG: Forcing main window to show after timeout");
      showMainWindow();
    }
  }, 1e4);
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    logInfo("App activated with no windows, creating main window");
    isSetupCompleted().then(({ completed }) => {
      if (completed) {
        const mainWindow = createMainWindow();
        loadAndShowWindow(mainWindow);
      } else {
        createSetupWindow();
      }
    }).catch((error) => {
      logError("Error checking setup status on activate", error);
      const mainWindow = createMainWindow();
      loadAndShowWindow(mainWindow);
    });
  } else {
    const windows2 = electron.BrowserWindow.getAllWindows();
    const visibleWindows = windows2.filter((win) => win.isVisible());
    if (visibleWindows.length > 0) {
      visibleWindows[0].focus();
    } else if (windows2.length > 0) {
      windows2[0].show();
      windows2[0].focus();
    }
  }
});
electron.ipcMain.on("open-external-url", (_event, url) => {
  if (typeof url === "string") {
    electron.shell.openExternal(url).catch((err) => {
      logError(`Error opening external URL: ${url}`, err);
    });
  }
});
electron.ipcMain.handle("get-app-version", () => {
  return electron.app.getVersion();
});
electron.ipcMain.handle("get-app-path", (_event, name) => {
  const appPath = electron.app.getPath(name || "userData");
  logInfo(`Sending app path via handle: ${name || "userData"} = ${appPath}`);
  return appPath;
});
electron.ipcMain.on("get-app-path-sync", (event, name) => {
  try {
    const appPath = electron.app.getPath(name || "userData");
    logInfo(`Sending app path via sync: ${name || "userData"} = ${appPath}`);
    event.returnValue = appPath;
  } catch (error) {
    logError("Error handling get-app-path-sync", error);
    event.returnValue = "";
  }
});
electron.ipcMain.handle("fetch-github-releases", async () => {
  try {
    logInfo("Fetching GitHub releases for update check");
    const apiUrl = "https://api.github.com/repos/danielmederos2424/odoo-manager/releases";
    const request = electron.net.request({
      method: "GET",
      url: apiUrl,
      redirect: "follow"
    });
    request.setHeader("User-Agent", `Odoo-Manager/${electron.app.getVersion()}`);
    const responsePromise = new Promise((resolve, reject) => {
      let responseData = "";
      request.on("response", (response) => {
        response.on("data", (chunk) => {
          responseData += chunk.toString();
        });
        response.on("end", () => {
          if (response.statusCode === 200) {
            try {
              const releases = JSON.parse(responseData);
              const latestRelease = releases.find((release) => !release.draft);
              if (latestRelease) {
                logInfo(`Found latest GitHub release: ${latestRelease.tag_name}`);
                resolve(latestRelease);
              } else {
                logError("No valid releases found");
                reject(new Error("No valid releases found"));
              }
            } catch (error) {
              logError("Error parsing GitHub API response", error);
              reject(error);
            }
          } else {
            logError(`GitHub API returned status code ${response.statusCode}`);
            reject(new Error(`GitHub API returned status code ${response.statusCode}`));
          }
        });
      });
      request.on("error", (error) => {
        logError("Error fetching GitHub releases", error);
        reject(error);
      });
      setTimeout(() => {
        reject(new Error("Request timed out after 10 seconds"));
      }, 1e4);
    });
    request.end();
    return await responsePromise;
  } catch (error) {
    logError("Error in fetch-github-releases handler", error);
    return null;
  }
});
electron.ipcMain.on("show-update-notification", (_event, { title, body }) => {
  try {
    if (process.platform === "linux") {
      logInfo("Skipping update notification on Linux platform");
      return;
    }
    logInfo(`Showing update notification: ${title}`);
    const notification = new electron.Notification({
      title: title || "Update Available",
      body: body || "A new version of Odoo Manager is available.",
      silent: false
    });
    notification.show();
    notification.on("click", () => {
      logInfo("Update notification clicked");
      if (windows.main && !windows.main.isDestroyed()) {
        windows.main.webContents.send("open-update-section");
        if (!windows.main.isVisible()) {
          windows.main.show();
        }
        windows.main.focus();
      }
    });
  } catch (error) {
    logError("Error showing update notification", error);
  }
});
electron.ipcMain.handle("test-port-availability", async (_event, port) => {
  try {
    logInfo(`Testing port ${port} availability`);
    const net2 = require("net");
    const tester = net2.createServer();
    const isAvailable = await new Promise((resolve) => {
      tester.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          logError(`Port test encountered an error: ${err.message}`, err);
          resolve(false);
        }
      });
      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, "0.0.0.0");
    });
    return isAvailable;
  } catch (error) {
    logError(`Error testing port availability`, error);
    return false;
  }
});
electron.ipcMain.on("restart-app", () => {
  electron.app.relaunch();
  electron.app.exit();
});
electron.ipcMain.on("quit-app", () => {
  electron.app.quit();
});
electron.ipcMain.handle("get-auto-update-enabled", async () => {
  try {
    const workDirPath = path__namespace.join(electron.app.getPath("userData"), "workdir.json");
    if (!fs__namespace.existsSync(workDirPath)) {
      return false;
    }
    const workDirData = JSON.parse(fs__namespace.readFileSync(workDirPath, "utf8"));
    const workDir = workDirData.workDir;
    if (!workDir || !fs__namespace.existsSync(workDir)) {
      return false;
    }
    const settingsPath = path__namespace.join(workDir, "settings.json");
    if (!fs__namespace.existsSync(settingsPath)) {
      return false;
    }
    const settings = JSON.parse(fs__namespace.readFileSync(settingsPath, "utf8"));
    return settings.autoCheckUpdates === true;
  } catch (error) {
    logError("Error checking auto update setting", error);
    return false;
  }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3V0aWxzL2VsZWN0cm9uLnRzIiwiLi4vc3JjL3NlcnZpY2VzL3N5c3RlbS9wYXRoU2VydmljZS50cyIsIi4uL3NyYy9zZXJ2aWNlcy91dGlscy9sb2dnZXIudHMiLCIuLi9zcmMvc2VydmljZXMvc2V0dGluZ3Mvc2V0dGluZ3NTZXJ2aWNlLnRzIiwiLi4vc3JjL3NlcnZpY2VzL3N5c3RlbS9kb2NrZXJQYXRoU2VydmljZS50cyIsIi4uL3NyYy9zZXJ2aWNlcy9kb2NrZXIvZG9ja2VyQ29tcG9zZVNlcnZpY2UudHMiLCIuLi9zcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlLnRzIiwiLi4vZWxlY3Ryb24vbG9nZ2VyLWxvY2sudHMiLCIuLi9lbGVjdHJvbi9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHNyYy91dGlscy9lbGVjdHJvbi50c1xuLy8gSW5pdGlhbGl6ZSB0aGUgQVBJIGF0IHRoZSBtb2R1bGUgbGV2ZWxcbmxldCBlbGVjdHJvbkFQSTogYW55ID0gbnVsbDtcblxuZXhwb3J0IGNvbnN0IGlzRWxlY3Ryb24gPSAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gYSBicm93c2VyIGVudmlyb25tZW50XG4gICAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGU7XG59O1xuXG4vLyBJbml0aWFsaXplIGR1cmluZyBtb2R1bGUgbG9hZCBpZiBwb3NzaWJsZVxudHJ5IHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnByb2Nlc3MgJiYgd2luZG93LnByb2Nlc3MudHlwZSkge1xuICAgICAgICBlbGVjdHJvbkFQSSA9IHdpbmRvdy5yZXF1aXJlKCdlbGVjdHJvbicpO1xuICAgIH1cbn0gY2F0Y2ggKGUpIHtcbiAgICAvLyBTaWxlbnRseSBmYWlsIC0gd2lsbCBpbml0aWFsaXplIG9uIGZpcnN0IGNhbGxcbn1cblxuZXhwb3J0IGNvbnN0IGdldEVsZWN0cm9uQVBJID0gKCkgPT4ge1xuICAgIGlmIChlbGVjdHJvbkFQSSkge1xuICAgICAgICByZXR1cm4gZWxlY3Ryb25BUEk7XG4gICAgfVxuICAgIFxuICAgIGlmIChpc0VsZWN0cm9uKCkpIHtcbiAgICAgICAgZWxlY3Ryb25BUEkgPSB3aW5kb3cucmVxdWlyZSgnZWxlY3Ryb24nKTtcbiAgICAgICAgcmV0dXJuIGVsZWN0cm9uQVBJO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG4iLCIvLyBzcmMvc2VydmljZXMvc3lzdGVtL3BhdGhTZXJ2aWNlLnRzXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgZ2V0RWxlY3Ryb25BUEkgfSBmcm9tICcuLi8uLi91dGlscy9lbGVjdHJvbic7XG5cbi8vIExvY2FsIGxvZ2dlciB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXNcbmNvbnN0IGxvY2FsTG9nSW5mbyA9IChtZXNzYWdlOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkID0+IHtcbiAgICBjb25zb2xlLmxvZyhgW0lORk9dICR7bWVzc2FnZX0ke2RhdGEgPyBgICR7SlNPTi5zdHJpbmdpZnkoZGF0YSl9YCA6ICcnfWApO1xufTtcblxuY29uc3QgbG9jYWxMb2dFcnJvciA9IChtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogYW55KTogdm9pZCA9PiB7XG4gICAgY29uc29sZS5lcnJvcihgW0VSUk9SXSAke21lc3NhZ2V9YCwgZXJyb3IpO1xufTtcblxuLyoqXG4gKiBHZXQgdGhlIGFwcCBkYXRhIGRpcmVjdG9yeSBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBcHBEYXRhUGF0aCgpOiBzdHJpbmcge1xuICAgIGNvbnN0IGFwcE5hbWUgPSAnb2Rvby1tYW5hZ2VyJztcbiAgICBcbiAgICB0cnkge1xuICAgICAgICAvLyBGaXJzdCB0cnkgdG8gZ2V0IHBhdGggZnJvbSBFbGVjdHJvbiBpZiBhdmFpbGFibGUgKG1vcmUgcmVsaWFibGUpXG4gICAgICAgIGNvbnN0IGVsZWN0cm9uID0gZ2V0RWxlY3Ryb25BUEkoKTtcbiAgICAgICAgaWYgKGVsZWN0cm9uPy5pcGNSZW5kZXJlcikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgaW52b2tlIG1ldGhvZCB0byBnZXQgYXBwIHBhdGggZnJvbSBtYWluIHByb2Nlc3NcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVjdHJvblBhdGggPSBlbGVjdHJvbi5pcGNSZW5kZXJlci5zZW5kU3luYygnZ2V0LWFwcC1wYXRoLXN5bmMnLCAndXNlckRhdGEnKTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlY3Ryb25QYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsTG9nSW5mbyhgR290IGFwcCBkYXRhIHBhdGggZnJvbSBFbGVjdHJvbjogJHtlbGVjdHJvblBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlbGVjdHJvblBhdGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZWxlY3Ryb25FcnJvcikge1xuICAgICAgICAgICAgICAgIGxvY2FsTG9nRXJyb3IoJ0ZhaWxlZCB0byBnZXQgYXBwIGRhdGEgcGF0aCBmcm9tIEVsZWN0cm9uOicsIGVsZWN0cm9uRXJyb3IpO1xuICAgICAgICAgICAgICAgIC8vIEZhbGwgdGhyb3VnaCB0byBwbGF0Zm9ybS1zcGVjaWZpYyBsb2dpY1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGYWxsYmFjayB0byBwbGF0Zm9ybS1zcGVjaWZpYyBsb2dpY1xuICAgICAgICBsZXQgYXBwRGF0YVBhdGggPSAnJztcbiAgICAgICAgc3dpdGNoIChwcm9jZXNzLnBsYXRmb3JtKSB7XG4gICAgICAgICAgICBjYXNlICd3aW4zMic6XG4gICAgICAgICAgICAgICAgYXBwRGF0YVBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuQVBQREFUQSB8fCAnJywgYXBwTmFtZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdkYXJ3aW4nOlxuICAgICAgICAgICAgICAgIGFwcERhdGFQYXRoID0gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0xpYnJhcnknLCAnQXBwbGljYXRpb24gU3VwcG9ydCcsIGFwcE5hbWUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnbGludXgnOlxuICAgICAgICAgICAgICAgIGFwcERhdGFQYXRoID0gcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJy5jb25maWcnLCBhcHBOYW1lKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgYXBwRGF0YVBhdGggPSBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCBgLiR7YXBwTmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbG9jYWxMb2dJbmZvKGBVc2luZyBwbGF0Zm9ybS1zcGVjaWZpYyBhcHAgZGF0YSBwYXRoOiAke2FwcERhdGFQYXRofWApO1xuICAgICAgICByZXR1cm4gYXBwRGF0YVBhdGg7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9jYWxMb2dFcnJvcignRXJyb3IgZ2V0dGluZyBhcHAgZGF0YSBwYXRoOicsIGVycm9yKTtcbiAgICAgICAgXG4gICAgICAgIC8vIExhc3QgcmVzb3J0IGZhbGxiYWNrXG4gICAgICAgIGNvbnN0IGZhbGxiYWNrUGF0aCA9IHBhdGguam9pbihvcy5ob21lZGlyKCksIGFwcE5hbWUpO1xuICAgICAgICBsb2NhbExvZ0luZm8oYEZhbGxpbmcgYmFjayB0byBob21lIGRpcmVjdG9yeSBwYXRoOiAke2ZhbGxiYWNrUGF0aH1gKTtcbiAgICAgICAgcmV0dXJuIGZhbGxiYWNrUGF0aDtcbiAgICB9XG59XG5cbi8qKlxuICogRW5zdXJlIGEgZGlyZWN0b3J5IGV4aXN0c1xuICovXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlRGlyKGRpclBhdGg6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXJQYXRoKSkge1xuICAgICAgICBmcy5ta2RpclN5bmMoZGlyUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfVxufVxuXG4vKipcbiAqIEdldCB0aGUgbG9ncyBkaXJlY3RvcnkgcGF0aFxuICogQHBhcmFtIGN1c3RvbVdvcmtEaXJQYXRoIE9wdGlvbmFsIGN1c3RvbSB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2dzUGF0aChjdXN0b21Xb3JrRGlyUGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8gSWYgYSBzcGVjaWZpYyB3b3JrIGRpcmVjdG9yeSBpcyBwcm92aWRlZCwgdXNlIGl0XG4gICAgY29uc3QgYmFzZVBhdGggPSBjdXN0b21Xb3JrRGlyUGF0aCB8fCBnZXRXb3JrRGlyUGF0aCgpIHx8IGdldEFwcERhdGFQYXRoKCk7XG4gICAgY29uc3QgbG9nc1BhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdsb2dzJyk7XG4gICAgZW5zdXJlRGlyKGxvZ3NQYXRoKTtcbiAgICByZXR1cm4gbG9nc1BhdGg7XG59XG5cbi8qKlxuICogR2V0IHRoZSB1c2VyIHdvcmsgZGlyZWN0b3J5IHBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFdvcmtEaXJQYXRoKCk6IHN0cmluZyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFdpbmRvd3Mtc3BlY2lmaWMgYmVoYXZpb3IgLSBhbHdheXMgdXNlIEFwcERhdGFcbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgIGNvbnN0IGFwcERhdGFQYXRoID0gZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIHdvcmtkaXIuanNvbiBpZiBpdCBkb2Vzbid0IGV4aXN0LCBwb2ludGluZyB0byBBcHBEYXRhXG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh3b3JrRGlyRmlsZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgZW5zdXJlRGlyKHBhdGguZGlybmFtZSh3b3JrRGlyRmlsZVBhdGgpKTtcbiAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0RpcjogYXBwRGF0YVBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHdyaXRlRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxMb2dFcnJvcignV2luZG93czogRXJyb3IgY3JlYXRpbmcgd29ya2Rpci5qc29uJywgd3JpdGVFcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gYXBwRGF0YVBhdGg7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIE9yaWdpbmFsIGJlaGF2aW9yIGZvciBvdGhlciBwbGF0Zm9ybXNcbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICByZXR1cm4gZGF0YS53b3JrRGlyIHx8IG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9jYWxMb2dFcnJvcignRXJyb3IgZ2V0dGluZyB3b3JrIGRpcmVjdG9yeSBwYXRoOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIFNldCB0aGUgdXNlciB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRXb3JrRGlyUGF0aCh3b3JrRGlyUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gV2luZG93cy1zcGVjaWZpYyBiZWhhdmlvciAtIGFsd2F5cyB1c2UgQXBwRGF0YVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgY29uc3QgYXBwRGF0YVBhdGggPSBnZXRBcHBEYXRhUGF0aCgpO1xuICAgICAgICAgICAgZW5zdXJlRGlyKGFwcERhdGFQYXRoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRm9yIFdpbmRvd3MsIHdlIGFsd2F5cyBzYXZlIEFwcERhdGEgYXMgdGhlIHdvcmsgZGlyZWN0b3J5IHJlZ2FyZGxlc3Mgb2YgaW5wdXRcbiAgICAgICAgICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ3dvcmtkaXIuanNvbicpO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0RpcjogYXBwRGF0YVBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIG5lY2Vzc2FyeSBkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICAgICAgWydvZG9vJywgJ3Bvc3RncmVzJywgJ2xvZ3MnXS5mb3JFYWNoKGRpciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlyUGF0aCA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgZGlyKTtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKGRpclBhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gT3JpZ2luYWwgYmVoYXZpb3IgZm9yIG90aGVyIHBsYXRmb3Jtc1xuICAgICAgICBjb25zdCBhcHBEYXRhUGF0aCA9IGdldEFwcERhdGFQYXRoKCk7XG4gICAgICAgIGVuc3VyZURpcihhcHBEYXRhUGF0aCk7XG5cbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnd29ya2Rpci5qc29uJyk7XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod29ya0RpckZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeSh7IHdvcmtEaXI6IHdvcmtEaXJQYXRoIH0sIG51bGwsIDIpKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9jYWxMb2dFcnJvcignRXJyb3Igc2V0dGluZyB3b3JrIGRpcmVjdG9yeSBwYXRoOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0iLCIvLyBzcmMvc2VydmljZXMvdXRpbHMvbG9nZ2VyLnRzXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHNldHRpbmdzU2VydmljZSBmcm9tICcuLi9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2UnO1xuaW1wb3J0IHsgaXNFbGVjdHJvbiB9IGZyb20gJy4uLy4uL3V0aWxzL2VsZWN0cm9uJztcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY3kgd2l0aCBwYXRoU2VydmljZVxuZnVuY3Rpb24gZ2V0TG9jYWxMb2dzUGF0aChjdXN0b21Xb3JrRGlyUGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8gSWYgYSBzcGVjaWZpYyB3b3JrIGRpcmVjdG9yeSBpcyBwcm92aWRlZCwgdXNlIGl0XG4gICAgY29uc3QgYXBwTmFtZSA9ICdvZG9vLW1hbmFnZXInO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGJhc2VQYXRoID0gY3VzdG9tV29ya0RpclBhdGggfHwgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0xpYnJhcnknLCAnQXBwbGljYXRpb24gU3VwcG9ydCcsIGFwcE5hbWUpO1xuICAgICAgICBjb25zdCBsb2dzUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgJ2xvZ3MnKTtcbiAgICAgICAgXG4gICAgICAgIC8vIENyZWF0ZSBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nc1BhdGgpKSB7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMobG9nc1BhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbG9nc1BhdGg7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBsb2dzIHBhdGg6JywgZXJyb3IpO1xuICAgICAgICAvLyBGYWxsYmFjayB0byB0ZW1wIGRpcmVjdG9yeVxuICAgICAgICByZXR1cm4gcGF0aC5qb2luKG9zLnRtcGRpcigpLCBhcHBOYW1lLCAnbG9ncycpO1xuICAgIH1cbn1cblxuLy8gR2xvYmFsIGZsYWdzIHRvIHByZXZlbnQgbXVsdGlwbGUgbG9nZ2VyIGluaXRpYWxpemF0aW9ucyBhY3Jvc3MgYWxsIGluc3RhbmNlc1xubGV0IEdMT0JBTF9MT0dHRVJfSU5JVElBTElaRUQgPSBmYWxzZTtcbmxldCBBQ1RJVkVfTE9HX0ZJTEVfUEFUSDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5sZXQgU0VTU0lPTl9IRUFERVJTX1dSSVRURU46IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9ID0ge307XG5cbi8vIExvZyByb3RhdGlvbiBjb25maWd1cmF0aW9uXG5jb25zdCBMT0dfRklMRV9TSVpFX0xJTUlUID0gNSAqIDEwMjQgKiAxMDI0OyAvLyA1IE1CIGluIGJ5dGVzXG5jb25zdCBNQVhfTE9HX0ZJTEVTID0gNTsgLy8gTWF4aW11bSBudW1iZXIgb2Ygcm90YXRlZCBsb2cgZmlsZXMgdG8ga2VlcFxuXG4vLyBMb2cgbGV2ZWxzIGVudW1cbmVudW0gTG9nTGV2ZWwge1xuICAgIERFQlVHID0gMCxcbiAgICBJTkZPID0gMSxcbiAgICBXQVJOID0gMixcbiAgICBFUlJPUiA9IDNcbn1cblxuLy8gVHlwZSBkZWZpbml0aW9uIGZvciBsb2cgZW50cnlcbmludGVyZmFjZSBMb2dFbnRyeSB7XG4gICAgdGltZXN0YW1wOiBzdHJpbmc7XG4gICAgbGV2ZWw6IExvZ0xldmVsO1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBkYXRhPzogYW55O1xufVxuXG4vKipcbiAqIEFwcGxpY2F0aW9uIGxvZ2dlciB3aXRoIGZpbGUgYW5kIGNvbnNvbGUgb3V0cHV0XG4gKi9cbmNsYXNzIExvZ2dlciB7XG4gICAgcHJpdmF0ZSBsb2dMZXZlbDogTG9nTGV2ZWwgPSBMb2dMZXZlbC5JTkZPO1xuICAgIHByaXZhdGUgbG9nRmlsZTogc3RyaW5nID0gJyc7XG4gICAgcHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2U6IExvZ2dlciB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgaW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwcml2YXRlIHdpbmRvd0lkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBEZWZhdWx0IHRvIElORk8gaW4gcHJvZHVjdGlvbiwgREVCVUcgaW4gZGV2ZWxvcG1lbnRcbiAgICAgICAgdGhpcy5sb2dMZXZlbCA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnID8gTG9nTGV2ZWwuREVCVUcgOiBMb2dMZXZlbC5JTkZPO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgd2luZG93IElEIGZvciB0aGlzIGxvZ2dlciBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSBpZCBXaW5kb3cgSURcbiAgICAgKi9cbiAgICBzZXRXaW5kb3dJZChpZDogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIHRoaXMud2luZG93SWQgPSBpZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdpbmRvdyBJRCBmb3IgdGhpcyBsb2dnZXIgaW5zdGFuY2VcbiAgICAgKiBAcmV0dXJucyBXaW5kb3cgSUQgb3IgbnVsbCBpZiBub3Qgc2V0XG4gICAgICovXG4gICAgZ2V0V2luZG93SWQoKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLndpbmRvd0lkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZldGNoIHRoZSB3aW5kb3cgSUQgZnJvbSB0aGUgbWFpbiBwcm9jZXNzXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHdpbmRvdyBJRCBvciBudWxsXG4gICAgICovXG4gICAgYXN5bmMgZmV0Y2hXaW5kb3dJZCgpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICAgICAgaWYgKCFpc0VsZWN0cm9uKCkgfHwgdGhpcy53aW5kb3dJZCAhPT0gbnVsbCkgcmV0dXJuIHRoaXMud2luZG93SWQ7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGlwY1JlbmRlcmVyID0gd2luZG93LmlwY1JlbmRlcmVyO1xuICAgICAgICAgICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICAgICAgICAgIHRoaXMud2luZG93SWQgPSBhd2FpdCBpcGNSZW5kZXJlci5pbnZva2UoJ2dldC13aW5kb3ctaWQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy53aW5kb3dJZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgd2luZG93IElEOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayB3aXRoIG1haW4gcHJvY2VzcyBpZiB0aGVyZSdzIGFscmVhZHkgYW4gYWN0aXZlIGxvZyBmaWxlXG4gICAgICogQHJldHVybnMgUGF0aCB0byBleGlzdGluZyBsb2cgZmlsZSBvciBudWxsXG4gICAgICovXG4gICAgc3RhdGljIGdldEV4aXN0aW5nTG9nRmlsZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKGlzRWxlY3Ryb24oKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBBY2Nlc3MgaXBjUmVuZGVyZXIgZGlyZWN0bHkgd2hlbiBjb250ZXh0SXNvbGF0aW9uIGlzIGRpc2FibGVkXG4gICAgICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICAgICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBVc2UgYXN5bmMgaW52b2tlIGluc3RlYWQgb2Ygc3luYyBjYWxsIHRvIGF2b2lkIGJsb2NraW5nIHJlbmRlcmVyIHByb2Nlc3NcbiAgICAgICAgICAgICAgICAgICAgLy8gV2UnbGwgaGFuZGxlIHRoaXMgYXN5bmNocm9ub3VzbHkgaW4gaW5pdGlhbGl6ZSgpIG1ldGhvZFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgZXhpc3RpbmcgbG9nIGZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGxvZyBmaWxlIHdpdGggbWFpbiBwcm9jZXNzXG4gICAgICogQHBhcmFtIGxvZ0ZpbGUgUGF0aCB0byBsb2cgZmlsZVxuICAgICAqL1xuICAgIHN0YXRpYyByZWdpc3RlckxvZ0ZpbGUobG9nRmlsZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmIChpc0VsZWN0cm9uKCkgJiYgbG9nRmlsZSAmJiBmcy5leGlzdHNTeW5jKGxvZ0ZpbGUpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlwY1JlbmRlcmVyID0gd2luZG93LmlwY1JlbmRlcmVyO1xuICAgICAgICAgICAgICAgIGlmIChpcGNSZW5kZXJlciAmJiBpcGNSZW5kZXJlci5zZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIGlwY1JlbmRlcmVyLnNlbmQoJ3JlZ2lzdGVyLWxvZy1maWxlJywgbG9nRmlsZSk7XG4gICAgICAgICAgICAgICAgICAgIEFDVElWRV9MT0dfRklMRV9QQVRIID0gbG9nRmlsZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byByZWdpc3RlciBsb2cgZmlsZSB3aXRoIG1haW4gcHJvY2VzczonLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhbiB1cCBvbGQgbG9nIGZpbGVzIG9sZGVyIHRoYW4gc3BlY2lmaWVkIGRheXNcbiAgICAgKiBUaGlzIGlzIGtlcHQgZm9yIGNvbXBhdGliaWxpdHkgYnV0IG5vdCBhY3RpdmVseSB1c2VkIHdpdGggcm90YXRpb24tYmFzZWQgYXBwcm9hY2hcbiAgICAgKiBAcGFyYW0gZGF5cyBOdW1iZXIgb2YgZGF5cyB0byBrZWVwIGxvZ3MgKGRlZmF1bHQ6IDcpXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gY2xlYW51cCBpcyBjb21wbGV0ZVxuICAgICAqL1xuICAgIGFzeW5jIGNsZWFudXBPbGRMb2dGaWxlcyhkYXlzOiBudW1iZXIgPSA3KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgYWxsIGxvZyBmaWxlc1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZXMgPSB0aGlzLmdldExvZ0ZpbGVzKCk7XG4gICAgICAgICAgICBpZiAobG9nRmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgQ2hlY2tpbmcgZm9yIGxvZyBmaWxlcyBvbGRlciB0aGFuICR7ZGF5c30gZGF5cyB0byBjbGVhbiB1cGApO1xuXG4gICAgICAgICAgICAvLyBDdXJyZW50IHRpbWVcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgICAgICAgLy8gTWF4IGFnZSBpbiBtaWxsaXNlY29uZHNcbiAgICAgICAgICAgIGNvbnN0IG1heEFnZSA9IGRheXMgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xuICAgICAgICAgICAgLy8gVGhyZXNob2xkIGRhdGVcbiAgICAgICAgICAgIGNvbnN0IHRocmVzaG9sZCA9IG5vdyAtIG1heEFnZTtcblxuICAgICAgICAgICAgLy8gRmlsdGVyIGZpbGVzIG9sZGVyIHRoYW4gdGhyZXNob2xkXG4gICAgICAgICAgICBjb25zdCBvbGRGaWxlcyA9IGxvZ0ZpbGVzLmZpbHRlcihmaWxlID0+IHtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCBkZWxldGUgY3VycmVudCBsb2cgZmlsZSBvciBpdHMgcm90YXRpb25zXG4gICAgICAgICAgICAgICAgaWYgKGZpbGUgPT09IHRoaXMubG9nRmlsZSB8fCBmaWxlID09PSBBQ1RJVkVfTE9HX0ZJTEVfUEFUSCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIERvbid0IGRlbGV0ZSByb3RhdGVkIHZlcnNpb25zIG9mIHRoZSBhY3RpdmUgbG9nIGZpbGVcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlTG9nTmFtZSA9IHBhdGguYmFzZW5hbWUodGhpcy5sb2dGaWxlIHx8ICcnLCAnLmxvZycpO1xuICAgICAgICAgICAgICAgIGlmIChwYXRoLmJhc2VuYW1lKGZpbGUpLnN0YXJ0c1dpdGgoYCR7YmFzZUxvZ05hbWV9LmApICYmIFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmJhc2VuYW1lKGZpbGUpLmVuZHNXaXRoKCcubG9nJykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMoZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVzZSBjcmVhdGlvbiB0aW1lIG9yIG1vZGlmaWVkIHRpbWUsIHdoaWNoZXZlciBpcyBvbGRlclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlVGltZSA9IE1hdGgubWluKHN0YXRzLmJpcnRodGltZU1zLCBzdGF0cy5tdGltZU1zKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVUaW1lIDwgdGhyZXNob2xkO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBjaGVja2luZyBmaWxlIGFnZSBmb3IgJHtmaWxlfTpgLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIERlbGV0ZSBvbGQgZmlsZXNcbiAgICAgICAgICAgIGlmIChvbGRGaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEZvdW5kICR7b2xkRmlsZXMubGVuZ3RofSBsb2cgZmlsZXMgb2xkZXIgdGhhbiAke2RheXN9IGRheXMgdG8gZGVsZXRlYCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygb2xkRmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMoZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRGVsZXRlZCBvbGQgbG9nIGZpbGU6ICR7ZmlsZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBkZWxldGluZyBvbGQgbG9nIGZpbGUgJHtmaWxlfTpgLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTm8gbG9nIGZpbGVzIG9sZGVyIHRoYW4gJHtkYXlzfSBkYXlzIGZvdW5kYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZHVyaW5nIGxvZyBmaWxlIGNsZWFudXA6JywgZXJyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIHdlJ3ZlIGFscmVhZHkgd3JpdHRlbiBzZXNzaW9uIGhlYWRlcnMgZm9yIHRoZSBjdXJyZW50IGxvZyBmaWxlXG4gICAgICogQHBhcmFtIHNlc3Npb25UeXBlIFR5cGUgb2Ygc2Vzc2lvbiBoZWFkZXIgKHN0YXJ0LCByZXN1bWUpXG4gICAgICogQHJldHVybnMgVHJ1ZSBpZiBoZWFkZXJzIGFscmVhZHkgd3JpdHRlbiwgZmFsc2Ugb3RoZXJ3aXNlXG4gICAgICovXG4gICAgcHJpdmF0ZSBpc1Nlc3Npb25IZWFkZXJXcml0dGVuKHNlc3Npb25UeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF0aGlzLmxvZ0ZpbGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3Qga2V5ID0gYCR7dGhpcy5sb2dGaWxlfToke3Nlc3Npb25UeXBlfToke3RoaXMud2luZG93SWQgfHwgJ3Vua25vd24nfWA7XG4gICAgICAgIHJldHVybiBTRVNTSU9OX0hFQURFUlNfV1JJVFRFTltrZXldID09PSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgc2Vzc2lvbiBoZWFkZXJzIGFzIHdyaXR0ZW4gZm9yIHRoZSBjdXJyZW50IGxvZyBmaWxlXG4gICAgICogQHBhcmFtIHNlc3Npb25UeXBlIFR5cGUgb2Ygc2Vzc2lvbiBoZWFkZXIgKHN0YXJ0LCByZXN1bWUpXG4gICAgICovXG4gICAgcHJpdmF0ZSBtYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oc2Vzc2lvblR5cGU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMubG9nRmlsZSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBrZXkgPSBgJHt0aGlzLmxvZ0ZpbGV9OiR7c2Vzc2lvblR5cGV9OiR7dGhpcy53aW5kb3dJZCB8fCAndW5rbm93bid9YDtcbiAgICAgICAgU0VTU0lPTl9IRUFERVJTX1dSSVRURU5ba2V5XSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgbG9nZ2VyIHdpdGggc2V0dGluZ3NcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBpbml0aWFsaXphdGlvbiBpcyBjb21wbGV0ZVxuICAgICAqL1xuICAgIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIEdldCB3aW5kb3cgSUQgZmlyc3QgaWYgd2UncmUgaW4gRWxlY3Ryb25cbiAgICAgICAgaWYgKGlzRWxlY3Ryb24oKSAmJiB0aGlzLndpbmRvd0lkID09PSBudWxsKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmZldGNoV2luZG93SWQoKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICAvLyBDaGVjayBmb3IgZ2xvYmFsIGluaXRpYWxpemF0aW9uIGZsYWcgZmlyc3RcbiAgICAgICAgaWYgKEdMT0JBTF9MT0dHRVJfSU5JVElBTElaRUQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBMb2dnZXIgYWxyZWFkeSBpbml0aWFsaXplZCBnbG9iYWxseSwgdXNpbmcgZXhpc3RpbmcgaW5zdGFuY2UgKHdpbmRvdyAke3RoaXMud2luZG93SWR9KWApO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGVyZSdzIGFuIGFjdGl2ZSBsb2cgZmlsZSBwYXRoLCB1c2UgaXRcbiAgICAgICAgICAgIGlmIChBQ1RJVkVfTE9HX0ZJTEVfUEFUSCAmJiBmcy5leGlzdHNTeW5jKEFDVElWRV9MT0dfRklMRV9QQVRIKSkge1xuICAgICAgICAgICAgICAgIHRoaXMubG9nRmlsZSA9IEFDVElWRV9MT0dfRklMRV9QQVRIO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIE9ubHkgd3JpdGUgcmVzdW1lIGhlYWRlciBpZiB3ZSBoYXZlbid0IHdyaXR0ZW4gaXQgZm9yIHRoaXMgd2luZG93L2ZpbGUgY29tYm9cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaXNTZXNzaW9uSGVhZGVyV3JpdHRlbigncmVzdW1lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgXFxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgU2Vzc2lvbiByZXN1bWVkOiAke3RoaXMuZm9ybWF0VGltZXN0YW1wKG5ldyBEYXRlKCkpfVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5hcHBlbmRGaWxlU3luYyh0aGlzLmxvZ0ZpbGUsIHNlc3Npb25NZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFya1Nlc3Npb25IZWFkZXJXcml0dGVuKCdyZXN1bWUnKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3cml0aW5nIHNlc3Npb24gc2VwYXJhdG9yIHRvIGxvZyBmaWxlOicsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGVyZSdzIGFscmVhZHkgYSBnbG9iYWwgYWN0aXZlIGxvZyBmaWxlIChmcm9tIG1haW4gcHJvY2VzcylcbiAgICAgICAgLy8gVXNlIGFzeW5jIGludm9rZSBpbnN0ZWFkIG9mIGJsb2NraW5nIHN5bmNocm9ub3VzIElQQ1xuICAgICAgICBsZXQgZXhpc3RpbmdMb2dGaWxlID0gbnVsbDtcbiAgICAgICAgaWYgKGlzRWxlY3Ryb24oKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBVc2UgYXN5bmMgaW52b2tlIGFuZCBqdXN0IHdhaXQgYSBtYXggb2YgNTAwbXMgdG8gYXZvaWQgYmxvY2tpbmcgc3RhcnR1cFxuICAgICAgICAgICAgICAgIGNvbnN0IGlwY1JlbmRlcmVyID0gd2luZG93LmlwY1JlbmRlcmVyO1xuICAgICAgICAgICAgICAgIGlmIChpcGNSZW5kZXJlciAmJiBpcGNSZW5kZXJlci5pbnZva2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZTxudWxsPigocmVzb2x2ZSkgPT4gc2V0VGltZW91dCgoKSA9PiByZXNvbHZlKG51bGwpLCA1MDApKTtcbiAgICAgICAgICAgICAgICAgICAgZXhpc3RpbmdMb2dGaWxlID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZ2V0LWFjdGl2ZS1sb2ctZmlsZScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dFByb21pc2VcbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZ2V0IGV4aXN0aW5nIGxvZyBmaWxlIGFzeW5jaHJvbm91c2x5OicsIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGV4aXN0aW5nTG9nRmlsZSAmJiBmcy5leGlzdHNTeW5jKGV4aXN0aW5nTG9nRmlsZSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVc2luZyBleGlzdGluZyBnbG9iYWwgbG9nIGZpbGU6ICR7ZXhpc3RpbmdMb2dGaWxlfSAod2luZG93ICR7dGhpcy53aW5kb3dJZH0pYCk7XG4gICAgICAgICAgICB0aGlzLmxvZ0ZpbGUgPSBleGlzdGluZ0xvZ0ZpbGU7XG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICAgIEdMT0JBTF9MT0dHRVJfSU5JVElBTElaRUQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBPbmx5IHdyaXRlIHJlc3VtZSBoZWFkZXIgaWYgd2UgaGF2ZW4ndCB3cml0dGVuIGl0IGZvciB0aGlzIHdpbmRvdy9maWxlIGNvbWJvXG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNTZXNzaW9uSGVhZGVyV3JpdHRlbigncmVzdW1lJykpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uTWVzc2FnZSA9XG4gICAgICAgICAgICAgICAgICAgICAgICBgXFxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGBTZXNzaW9uIHJlc3VtZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobmV3IERhdGUoKSl9XFxuYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gO1xuICAgICAgICAgICAgICAgICAgICBmcy5hcHBlbmRGaWxlU3luYyh0aGlzLmxvZ0ZpbGUsIHNlc3Npb25NZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3Jlc3VtZScpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3cml0aW5nIHNlc3Npb24gc2VwYXJhdG9yIHRvIGxvZyBmaWxlOicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coYEluaXRpYWxpemluZyBsb2dnZXIgZm9yIHdpbmRvdyAke3RoaXMud2luZG93SWR9Li4uYCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCB3b3JrIGRpcmVjdG9yeSBwYXRoIGZyb20gc2V0dGluZ3Mgc2VydmljZVxuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCBzZXR0aW5nc1NlcnZpY2UuZ2V0V29ya0RpclBhdGgoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBXb3JrIGRpcmVjdG9yeTogJHt3b3JrRGlyUGF0aCB8fCAnbm90IHNldCd9YCk7XG5cbiAgICAgICAgICAgIC8vIEdldCBsb2dzIHBhdGggdXNpbmcgb3VyIGxvY2FsIGZ1bmN0aW9uXG4gICAgICAgICAgICBjb25zdCBsb2dzUGF0aCA9IGdldExvY2FsTG9nc1BhdGgod29ya0RpclBhdGggfHwgdW5kZWZpbmVkKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBMb2dzIGRpcmVjdG9yeTogJHtsb2dzUGF0aH1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IG9yIGNyZWF0ZSBtYWluIGxvZyBmaWxlXG4gICAgICAgICAgICB0aGlzLmxvZ0ZpbGUgPSBwYXRoLmpvaW4obG9nc1BhdGgsICdhcHAubG9nJyk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgVXNpbmcgbWFpbiBsb2cgZmlsZSBhdDogJHt0aGlzLmxvZ0ZpbGV9YCk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIGV4aXN0cywgaWYgbm90IGNyZWF0ZSBpdCB3aXRoIGluaXRpYWwgY29udGVudFxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMubG9nRmlsZSkpIHtcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSBpbml0aWFsIGxvZyBlbnRyeVxuICAgICAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5pdGlhbE1lc3NhZ2UgPVxuICAgICAgICAgICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYE9kb28gTWFuYWdlciAtIEFwcGxpY2F0aW9uIExvZyAoTWFpbiBQcm9jZXNzKVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICBgU3RhcnRlZDogJHt0aGlzLmZvcm1hdFRpbWVzdGFtcChub3cpfVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICBgRW52aXJvbm1lbnQ6ICR7cHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ3Vua25vd24nfVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0aGlzLmxvZ0ZpbGUsIGluaXRpYWxNZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbignc3RhcnQnKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNTZXNzaW9uSGVhZGVyV3JpdHRlbignc3RhcnQnKSkge1xuICAgICAgICAgICAgICAgIC8vIFdyaXRlIGEgc2Vzc2lvbiBzZXBhcmF0b3IgdG8gZXhpc3RpbmcgbG9nIGZpbGUgb25seSBpZiB3ZSBoYXZlbid0IHdyaXR0ZW4gb25lXG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbk1lc3NhZ2UgPVxuICAgICAgICAgICAgICAgICAgICBgXFxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYFNlc3Npb24gc3RhcnRlZDogJHt0aGlzLmZvcm1hdFRpbWVzdGFtcChuZXcgRGF0ZSgpKX1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICAgICAgICAgICAgICBmcy5hcHBlbmRGaWxlU3luYyh0aGlzLmxvZ0ZpbGUsIHNlc3Npb25NZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbignc3RhcnQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU3RvcmUgdGhlIGFjdGl2ZSBsb2cgZmlsZSBwYXRoIGdsb2JhbGx5XG4gICAgICAgICAgICBBQ1RJVkVfTE9HX0ZJTEVfUEFUSCA9IHRoaXMubG9nRmlsZTtcblxuICAgICAgICAgICAgLy8gUmVnaXN0ZXIgd2l0aCBtYWluIHByb2Nlc3NcbiAgICAgICAgICAgIExvZ2dlci5yZWdpc3RlckxvZ0ZpbGUodGhpcy5sb2dGaWxlKTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coYExvZ2dlciBpbml0aWFsaXplZCB3aXRoIGZpbGU6ICR7dGhpcy5sb2dGaWxlfWApO1xuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICBHTE9CQUxfTE9HR0VSX0lOSVRJQUxJWkVEID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaW5mbygnTG9nZ2VyIGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgdGhpcy5pbmZvKGBMb2cgZmlsZXMgd2lsbCBiZSByb3RhdGVkIHdoZW4gdGhleSByZWFjaCAke0xPR19GSUxFX1NJWkVfTElNSVQgLyAoMTAyNCAqIDEwMjQpfSBNQmApO1xuICAgICAgICAgICAgdGhpcy5pbmZvKGBSZWdpc3RlcmVkIGFjdGl2ZSBsb2cgZmlsZTogJHt0aGlzLmxvZ0ZpbGV9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGluaXRpYWxpemUgbG9nZ2VyOicsIGVycik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JtYXQgZGF0ZSBmb3IgbG9nIGZpbGVuYW1lIChZWVlZLU1NLURELUhILU1NLVNTKVxuICAgICAqIEBwYXJhbSBkYXRlIERhdGUgb2JqZWN0IHRvIGZvcm1hdFxuICAgICAqIEByZXR1cm5zIEZvcm1hdHRlZCBkYXRlIHN0cmluZyBzdWl0YWJsZSBmb3IgZmlsZW5hbWVzXG4gICAgICovXG4gICAgcHJpdmF0ZSBmb3JtYXREYXRlRm9yRmlsZW5hbWUoZGF0ZTogRGF0ZSk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gU3RyaW5nKGRhdGUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgICAgY29uc3QgaG91cnMgPSBTdHJpbmcoZGF0ZS5nZXRIb3VycygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgICAgICBjb25zdCBtaW51dGVzID0gU3RyaW5nKGRhdGUuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgICAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuXG4gICAgICAgIHJldHVybiBgJHt5ZWFyfS0ke21vbnRofS0ke2RheX0tJHtob3Vyc30tJHttaW51dGVzfS0ke3NlY29uZHN9YDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JtYXQgdGltZXN0YW1wIGZvciBsb2cgZW50cmllc1xuICAgICAqIEBwYXJhbSBkYXRlIERhdGUgb2JqZWN0IHRvIGZvcm1hdFxuICAgICAqIEByZXR1cm5zIEZvcm1hdHRlZCB0aW1lc3RhbXAgc3RyaW5nXG4gICAgICovXG4gICAgcHJpdmF0ZSBmb3JtYXRUaW1lc3RhbXAoZGF0ZTogRGF0ZSk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBkYXRlLnRvTG9jYWxlU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGxvZ2dlciBpbnN0YW5jZSAoc2luZ2xldG9uIHBhdHRlcm4pXG4gICAgICogQHJldHVybnMgTG9nZ2VyIGluc3RhbmNlXG4gICAgICovXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCk6IExvZ2dlciB7XG4gICAgICAgIGlmICghTG9nZ2VyLmluc3RhbmNlKSB7XG4gICAgICAgICAgICBMb2dnZXIuaW5zdGFuY2UgPSBuZXcgTG9nZ2VyKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIExvZ2dlci5pbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGxvZyBsZXZlbFxuICAgICAqIEBwYXJhbSBsZXZlbCBMb2dMZXZlbCB0byBzZXRcbiAgICAgKi9cbiAgICBzZXRMb2dMZXZlbChsZXZlbDogTG9nTGV2ZWwpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5sb2dMZXZlbCA9IGxldmVsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgY3VycmVudCBsb2cgZmlsZSBwYXRoXG4gICAgICogQHJldHVybnMgUGF0aCB0byB0aGUgYWN0aXZlIGxvZyBmaWxlXG4gICAgICovXG4gICAgZ2V0TG9nRmlsZVBhdGgoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubG9nRmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBsb2cgZmlsZSBuZWVkcyByb3RhdGlvbiBiYXNlZCBvbiBzaXplXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiBsb2cgcm90YXRpb24gd2FzIHBlcmZvcm1lZCwgZmFsc2Ugb3RoZXJ3aXNlXG4gICAgICovXG4gICAgcHJpdmF0ZSBjaGVja0FuZFJvdGF0ZUxvZ0ZpbGUoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5pbml0aWFsaXplZCB8fCAhdGhpcy5sb2dGaWxlIHx8ICFmcy5leGlzdHNTeW5jKHRoaXMubG9nRmlsZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKHRoaXMubG9nRmlsZSk7XG4gICAgICAgICAgICBpZiAoc3RhdHMuc2l6ZSA8IExPR19GSUxFX1NJWkVfTElNSVQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIE5vIHJvdGF0aW9uIG5lZWRlZFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgTG9nIGZpbGUgc2l6ZSAoJHtzdGF0cy5zaXplfSBieXRlcykgZXhjZWVkcyBsaW1pdCAoJHtMT0dfRklMRV9TSVpFX0xJTUlUfSBieXRlcyksIHJvdGF0aW5nIGxvZ3MuLi5gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IHRoZSBsb2dzIGRpcmVjdG9yeVxuICAgICAgICAgICAgY29uc3QgbG9nc0RpciA9IHBhdGguZGlybmFtZSh0aGlzLmxvZ0ZpbGUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBHZXQgZXhpc3Rpbmcgcm90YXRlZCBsb2cgZmlsZXNcbiAgICAgICAgICAgIGNvbnN0IGJhc2VMb2dOYW1lID0gcGF0aC5iYXNlbmFtZSh0aGlzLmxvZ0ZpbGUsICcubG9nJyk7XG4gICAgICAgICAgICBjb25zdCByb3RhdGVkTG9ncyA9IGZzLnJlYWRkaXJTeW5jKGxvZ3NEaXIpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihmID0+IGYuc3RhcnRzV2l0aChgJHtiYXNlTG9nTmFtZX0uYCkgJiYgZi5lbmRzV2l0aCgnLmxvZycpKVxuICAgICAgICAgICAgICAgIC5zb3J0KCk7IC8vIFNvcnQgdG8gZmluZCBoaWdoZXN0IHJvdGF0aW9uIG51bWJlclxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTaGlmdCBvbGRlciBsb2dzIHRvIG1ha2Ugcm9vbSBmb3IgbmV3IHJvdGF0aW9uXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gcm90YXRlZExvZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IHJvdGF0ZWRMb2dzW2ldLm1hdGNoKG5ldyBSZWdFeHAoYCR7YmFzZUxvZ05hbWV9XFwuKFxcZCspXFwubG9nYCkpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb3RhdGlvbk51bWJlciA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyb3RhdGlvbk51bWJlciA+PSBNQVhfTE9HX0ZJTEVTIC0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSBvbGRlc3QgbG9nIGZpbGUgaWYgd2UgYWxyZWFkeSBoYXZlIG1heCBudW1iZXIgb2Ygcm90YXRpb25zXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRlc3RMb2cgPSBwYXRoLmpvaW4obG9nc0Rpciwgcm90YXRlZExvZ3NbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMudW5saW5rU3luYyhvbGRlc3RMb2cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYERlbGV0ZWQgb2xkIGxvZyBmaWxlOiAke29sZGVzdExvZ31gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbmFtZSB0byB0aGUgbmV4dCByb3RhdGlvbiBudW1iZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBwYXRoLmpvaW4obG9nc0Rpciwgcm90YXRlZExvZ3NbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbihsb2dzRGlyLCBgJHtiYXNlTG9nTmFtZX0uJHtyb3RhdGlvbk51bWJlciArIDF9LmxvZ2ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVuYW1lU3luYyhvbGRQYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSb3RhdGVkIGxvZyBmaWxlOiAke29sZFBhdGh9IC0+ICR7bmV3UGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVuYW1lIHRoZSBjdXJyZW50IGxvZyBmaWxlIHRvIGJlIC4xLmxvZ1xuICAgICAgICAgICAgY29uc3Qgcm90YXRlZExvZ1BhdGggPSBwYXRoLmpvaW4obG9nc0RpciwgYCR7YmFzZUxvZ05hbWV9LjEubG9nYCk7XG4gICAgICAgICAgICBmcy5yZW5hbWVTeW5jKHRoaXMubG9nRmlsZSwgcm90YXRlZExvZ1BhdGgpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFJvdGF0ZWQgbWFpbiBsb2cgZmlsZTogJHt0aGlzLmxvZ0ZpbGV9IC0+ICR7cm90YXRlZExvZ1BhdGh9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBlbXB0eSBsb2cgZmlsZVxuICAgICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIGNvbnN0IGluaXRpYWxNZXNzYWdlID1cbiAgICAgICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgICAgICBgT2RvbyBNYW5hZ2VyIC0gQXBwbGljYXRpb24gTG9nIChSb3RhdGVkKVxcbmAgK1xuICAgICAgICAgICAgICAgIGBTdGFydGVkOiAke3RoaXMuZm9ybWF0VGltZXN0YW1wKG5vdyl9XFxuYCArXG4gICAgICAgICAgICAgICAgYEVudmlyb25tZW50OiAke3Byb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICd1bmtub3duJ31cXG5gICtcbiAgICAgICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0aGlzLmxvZ0ZpbGUsIGluaXRpYWxNZXNzYWdlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmVzZXQgc2Vzc2lvbiBoZWFkZXJzIHRyYWNraW5nIHdoZW4gcm90YXRlZFxuICAgICAgICAgICAgU0VTU0lPTl9IRUFERVJTX1dSSVRURU4gPSB7fTtcbiAgICAgICAgICAgIHRoaXMubWFya1Nlc3Npb25IZWFkZXJXcml0dGVuKCdzdGFydCcpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciByb3RhdGluZyBsb2cgZmlsZTonLCBlcnIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGUgYSBsb2cgZW50cnkgdG8gY29uc29sZSBhbmQgZmlsZVxuICAgICAqIEBwYXJhbSBsZXZlbCBMb2dMZXZlbCBvZiB0aGUgZW50cnlcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBNZXNzYWdlIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBlcnJvciBPcHRpb25hbCBlcnJvciBvYmplY3QgdG8gaW5jbHVkZVxuICAgICAqL1xuICAgIHByaXZhdGUgbG9nKGxldmVsOiBMb2dMZXZlbCwgbWVzc2FnZTogc3RyaW5nLCBlcnJvcj86IEVycm9yIHwgdW5rbm93bik6IHZvaWQge1xuICAgICAgICBpZiAobGV2ZWwgPCB0aGlzLmxvZ0xldmVsKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdGltZXN0YW1wID0gdGhpcy5mb3JtYXRUaW1lc3RhbXAobmV3IERhdGUoKSk7XG4gICAgICAgIGNvbnN0IGxldmVsU3RyID0gTG9nTGV2ZWxbbGV2ZWxdO1xuICAgICAgICBjb25zdCB3aW5kb3dQcmVmaXggPSB0aGlzLndpbmRvd0lkICE9PSBudWxsID8gYFtXSU5ET1ctJHt0aGlzLndpbmRvd0lkfV0gYCA6ICcnO1xuXG4gICAgICAgIGxldCBsb2dNZXNzYWdlID0gYFske3RpbWVzdGFtcH1dIFske2xldmVsU3RyfV0gJHt3aW5kb3dQcmVmaXh9JHttZXNzYWdlfWA7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgbGV0IGVycm9yTXNnOiBzdHJpbmc7XG4gICAgICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgICAgIGVycm9yTXNnID0gZXJyb3Iuc3RhY2sgfHwgZXJyb3IubWVzc2FnZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGVycm9yID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGVycm9yTXNnID0gZXJyb3I7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yTXNnID0gSlNPTi5zdHJpbmdpZnkoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICBlcnJvck1zZyA9IFN0cmluZyhlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nTWVzc2FnZSArPSBgXFxuJHtlcnJvck1zZ31gO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV3JpdGUgdG8gY29uc29sZVxuICAgICAgICBjb25zdCBjb25zb2xlTWV0aG9kID0gbGV2ZWwgPT09IExvZ0xldmVsLkVSUk9SID8gJ2Vycm9yJyA6XG4gICAgICAgICAgICBsZXZlbCA9PT0gTG9nTGV2ZWwuV0FSTiA/ICd3YXJuJyA6XG4gICAgICAgICAgICAgICAgbGV2ZWwgPT09IExvZ0xldmVsLkRFQlVHID8gJ2RlYnVnJyA6ICdsb2cnO1xuICAgICAgICBjb25zb2xlW2NvbnNvbGVNZXRob2RdKGxvZ01lc3NhZ2UpO1xuXG4gICAgICAgIC8vIFdyaXRlIHRvIGZpbGUgaWYgaW5pdGlhbGl6ZWRcbiAgICAgICAgaWYgKHRoaXMuaW5pdGlhbGl6ZWQgJiYgdGhpcy5sb2dGaWxlKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGxvZyBmaWxlIG5lZWRzIHJvdGF0aW9uXG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja0FuZFJvdGF0ZUxvZ0ZpbGUoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSB0byBsb2cgZmlsZSAod2hpY2ggbWlnaHQgYmUgbmV3bHkgcm90YXRlZClcbiAgICAgICAgICAgICAgICBmcy5hcHBlbmRGaWxlU3luYyh0aGlzLmxvZ0ZpbGUsIGxvZ01lc3NhZ2UgKyAnXFxuJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gd3JpdGUgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvZyBkZWJ1ZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZGF0YSBPcHRpb25hbCBkYXRhIHRvIGluY2x1ZGVcbiAgICAgKi9cbiAgICBkZWJ1ZyhtZXNzYWdlOiBzdHJpbmcsIGRhdGE/OiBhbnkpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5sb2coTG9nTGV2ZWwuREVCVUcsIG1lc3NhZ2UsIGRhdGEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvZyBpbmZvIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBNZXNzYWdlIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBkYXRhIE9wdGlvbmFsIGRhdGEgdG8gaW5jbHVkZVxuICAgICAqL1xuICAgIGluZm8obWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nKExvZ0xldmVsLklORk8sIG1lc3NhZ2UsIGRhdGEpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvZyB3YXJuaW5nIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBNZXNzYWdlIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBlcnJvciBPcHRpb25hbCBlcnJvciB0byBpbmNsdWRlXG4gICAgICovXG4gICAgd2FybihtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogRXJyb3IgfCB1bmtub3duKTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nKExvZ0xldmVsLldBUk4sIG1lc3NhZ2UsIGVycm9yKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgZXJyb3IgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBtZXNzYWdlIE1lc3NhZ2UgdG8gbG9nXG4gICAgICogQHBhcmFtIGVycm9yIE9wdGlvbmFsIGVycm9yIHRvIGluY2x1ZGVcbiAgICAgKi9cbiAgICBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogRXJyb3IgfCB1bmtub3duKTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nKExvZ0xldmVsLkVSUk9SLCBtZXNzYWdlLCBlcnJvcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGFsbCBsb2cgZmlsZXMgaW4gdGhlIGxvZ3MgZGlyZWN0b3J5XG4gICAgICogQHJldHVybnMgQXJyYXkgb2YgbG9nIGZpbGUgcGF0aHNcbiAgICAgKi9cbiAgICBnZXRMb2dGaWxlcygpOiBzdHJpbmdbXSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBVc2Ugb3VyIGxvY2FsIGZ1bmN0aW9uIHRvIGdldCBsb2dzIHBhdGhcbiAgICAgICAgICAgIGNvbnN0IGxvZ3NQYXRoID0gZ2V0TG9jYWxMb2dzUGF0aCgpO1xuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnMucmVhZGRpclN5bmMobG9nc1BhdGgpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihmaWxlID0+IGZpbGUuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgICAgICAgICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKGxvZ3NQYXRoLCBmaWxlKSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZ2V0IGxvZyBmaWxlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIG1vc3QgcmVjZW50IGxvZyBmaWxlXG4gICAgICogQHJldHVybnMgUGF0aCB0byB0aGUgbW9zdCByZWNlbnQgbG9nIGZpbGUgb3IgbnVsbCBpZiBub25lIGZvdW5kXG4gICAgICovXG4gICAgZ2V0TW9zdFJlY2VudExvZ0ZpbGUoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlcyA9IHRoaXMuZ2V0TG9nRmlsZXMoKTtcbiAgICAgICAgICAgIGlmIChsb2dGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU29ydCBieSBmaWxlIGNyZWF0aW9uIHRpbWUgKG1vc3QgcmVjZW50IGZpcnN0KVxuICAgICAgICAgICAgcmV0dXJuIGxvZ0ZpbGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0QSA9IGZzLnN0YXRTeW5jKGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRCID0gZnMuc3RhdFN5bmMoYik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRCLmJpcnRodGltZU1zIC0gc3RhdEEuYmlydGh0aW1lTXM7XG4gICAgICAgICAgICB9KVswXTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgbW9zdCByZWNlbnQgbG9nIGZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIENyZWF0ZSBzaW5nbGV0b24gbG9nZ2VyIGluc3RhbmNlXG5jb25zdCBsb2dnZXIgPSBMb2dnZXIuZ2V0SW5zdGFuY2UoKTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgd2luZG93IElEIGZvciB0aGUgbG9nZ2VyXG5pZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2dldC13aW5kb3ctaWQnKVxuICAgICAgICAgICAgLnRoZW4oaWQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIuc2V0V2luZG93SWQoaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgd2luZG93IElEIGZvciBsb2dnZXI6JywgZXJyKSk7XG4gICAgfVxufVxuXG4vLyBFeHBvcnQgY29udmVuaWVuY2UgbWV0aG9kc1xuZXhwb3J0IGNvbnN0IGluaXRpYWxpemVMb2dnZXIgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiBhd2FpdCBsb2dnZXIuaW5pdGlhbGl6ZSgpO1xuZXhwb3J0IGNvbnN0IGxvZ0RlYnVnID0gKG1lc3NhZ2U6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQgPT4gbG9nZ2VyLmRlYnVnKG1lc3NhZ2UsIGRhdGEpO1xuZXhwb3J0IGNvbnN0IGxvZ0luZm8gPSAobWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCA9PiBsb2dnZXIuaW5mbyhtZXNzYWdlLCBkYXRhKTtcbmV4cG9ydCBjb25zdCBsb2dXYXJuID0gKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBFcnJvciB8IHVua25vd24pOiB2b2lkID0+IGxvZ2dlci53YXJuKG1lc3NhZ2UsIGVycm9yKTtcbmV4cG9ydCBjb25zdCBsb2dFcnJvciA9IChtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogRXJyb3IgfCB1bmtub3duKTogdm9pZCA9PiBsb2dnZXIuZXJyb3IobWVzc2FnZSwgZXJyb3IpO1xuZXhwb3J0IGNvbnN0IGdldExvZ0ZpbGVzID0gKCk6IHN0cmluZ1tdID0+IGxvZ2dlci5nZXRMb2dGaWxlcygpO1xuZXhwb3J0IGNvbnN0IGdldExvZ0ZpbGVQYXRoID0gKCk6IHN0cmluZyA9PiBsb2dnZXIuZ2V0TG9nRmlsZVBhdGgoKTtcbmV4cG9ydCBjb25zdCBnZXRNb3N0UmVjZW50TG9nRmlsZSA9ICgpOiBzdHJpbmcgfCBudWxsID0+IGxvZ2dlci5nZXRNb3N0UmVjZW50TG9nRmlsZSgpO1xuZXhwb3J0IGNvbnN0IHNldExvZ0xldmVsID0gKGxldmVsOiBudW1iZXIpOiB2b2lkID0+IGxvZ2dlci5zZXRMb2dMZXZlbChsZXZlbCk7XG5leHBvcnQgY29uc3QgY2xlYW51cE9sZExvZ0ZpbGVzID0gYXN5bmMgKGRheXM6IG51bWJlciA9IDcpOiBQcm9taXNlPHZvaWQ+ID0+IGF3YWl0IGxvZ2dlci5jbGVhbnVwT2xkTG9nRmlsZXMoZGF5cyk7XG5cbi8vIEV4cG9ydCBsb2dnZXIgYW5kIExvZ0xldmVsIGVudW0gZm9yIGFkdmFuY2VkIHVzYWdlXG5leHBvcnQgeyBMb2dMZXZlbCB9O1xuZXhwb3J0IGRlZmF1bHQgbG9nZ2VyOyIsIi8vIHNyYy9zZXJ2aWNlcy9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2UudHNcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBnZXRBcHBEYXRhUGF0aCwgZW5zdXJlRGlyIH0gZnJvbSAnLi4vc3lzdGVtL3BhdGhTZXJ2aWNlJztcbmltcG9ydCB7IGxvZ0Vycm9yLCBsb2dJbmZvIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuLy8gU2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIFNldHRpbmdzIHtcbiAgICB0aGVtZTogJ2xpZ2h0JyB8ICdkYXJrJztcbiAgICBsYW5ndWFnZTogc3RyaW5nO1xuICAgIG5ldHdvcms6IHN0cmluZztcbiAgICBzaG93V2VsY29tZVNjcmVlbjogYm9vbGVhbjtcbiAgICBhdXRvQ2hlY2tVcGRhdGVzOiBib29sZWFuO1xuICAgIHVwZGF0ZUNoZWNrRnJlcXVlbmN5OiAnZGFpbHknIHwgJ3dlZWtseSc7XG4gICAgc2hvd1VwZGF0ZU5vdGlmaWNhdGlvbnM6IGJvb2xlYW47XG4gICAgbGFzdFVwZGF0ZUNoZWNrOiBzdHJpbmcgfCBudWxsO1xuICAgIGNyZWF0ZWRBdDogc3RyaW5nO1xuICAgIHVwZGF0ZWRBdDogc3RyaW5nO1xuICAgIFtrZXk6IHN0cmluZ106IGFueTsgLy8gQWxsb3cgZm9yIGV4dGVuc2lvblxufVxuXG4vLyBEZWZhdWx0IHNldHRpbmdzXG5jb25zdCBkZWZhdWx0U2V0dGluZ3M6IFNldHRpbmdzID0ge1xuICAgIHRoZW1lOiAnZGFyaycsXG4gICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgbmV0d29yazogJ29kb28tbmV0d29yaycsXG4gICAgc2hvd1dlbGNvbWVTY3JlZW46IHRydWUsXG4gICAgYXV0b0NoZWNrVXBkYXRlczogdHJ1ZSxcbiAgICB1cGRhdGVDaGVja0ZyZXF1ZW5jeTogJ2RhaWx5JyxcbiAgICBzaG93VXBkYXRlTm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICBsYXN0VXBkYXRlQ2hlY2s6IG51bGwsXG4gICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbn07XG5cbmNsYXNzIFNldHRpbmdzU2VydmljZSB7XG4gICAgcHJpdmF0ZSB3b3JrRGlyRmlsZVBhdGg6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBQYXRoIHRvIHRoZSBmaWxlIHRoYXQgc3RvcmVzIHRoZSB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gICAgICAgIHRoaXMud29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICd3b3JrZGlyLmpzb24nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzZXR1cCBoYXMgYmVlbiBjb21wbGV0ZWRcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgaWYgc2V0dXAgaXMgY29tcGxldGVcbiAgICAgKi9cbiAgICBhc3luYyBpc1NldHVwQ29tcGxldGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpclBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgd2UgaGF2ZSB2YWxpZCBzZXR0aW5ncy5qc29uIGZpbGUsIGl0IG1lYW5zIHNldHVwIHdhcyBjb21wbGV0ZWRcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGNoZWNraW5nIGlmIHNldHVwIGlzIGNvbXBsZXRlZCcsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29yayBkaXJlY3RvcnkgcGF0aCBmcm9tIGFwcCBkYXRhXG4gICAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gd29yayBkaXJlY3RvcnkgcGF0aCBvciBudWxsIGlmIG5vdCBzZXRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRXb3JrRGlyUGF0aCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdpbmRvd3Mtc3BlY2lmaWMgYmVoYXZpb3IgLSBhbHdheXMgdXNlIEFwcERhdGFcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgICAgICAgLy8gRm9yIFdpbmRvd3MsIHdlIGFsd2F5cyB1c2UgdGhlIEFwcERhdGEgbG9jYXRpb24gZm9yIGNvbnNpc3RlbmN5XG4gICAgICAgICAgICAgICAgY29uc3QgYXBwRGF0YVBhdGggPSBnZXRBcHBEYXRhUGF0aCgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIElmIHdvcmtkaXIuanNvbiBleGlzdHMsIHJlYWQgaXQgZm9yIGNvbXBhdGliaWxpdHksIGJ1dCBwcmVmZXIgQXBwRGF0YVxuICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRoaXMud29ya0RpckZpbGVQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHRoaXMud29ya0RpckZpbGVQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIHRoYXQgdGhlIHBhdGggZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS53b3JrRGlyICYmIGZzLmV4aXN0c1N5bmMoZGF0YS53b3JrRGlyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0J3Mgbm90IEFwcERhdGEsIGxvZyBpbmZvIGJ1dCBzdGlsbCByZXR1cm4gQXBwRGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLndvcmtEaXIgIT09IGFwcERhdGFQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFdpbmRvd3M6IHdvcmtkaXIuanNvbiBwb2ludHMgdG8gJHtkYXRhLndvcmtEaXJ9LCBidXQgdXNpbmcgJHthcHBEYXRhUGF0aH0gZm9yIGNvbnNpc3RlbmN5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChwYXJzZUVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcignV2luZG93czogRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24nLCBwYXJzZUVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSB3b3JrZGlyLmpzb24gaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh0aGlzLndvcmtEaXJGaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkoeyB3b3JrRGlyOiBhcHBEYXRhUGF0aCB9LCBudWxsLCAyKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBXaW5kb3dzOiBDcmVhdGVkIHdvcmtkaXIuanNvbiBwb2ludGluZyB0byBBcHBEYXRhOiAke2FwcERhdGFQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoICh3cml0ZUVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcignV2luZG93czogRXJyb3IgY3JlYXRpbmcgd29ya2Rpci5qc29uJywgd3JpdGVFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFwcERhdGFQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBPcmlnaW5hbCBiZWhhdmlvciBmb3Igb3RoZXIgcGxhdGZvcm1zXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy53b3JrRGlyRmlsZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh0aGlzLndvcmtEaXJGaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgaWYgKCFkYXRhLndvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMoZGF0YS53b3JrRGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZGF0YS53b3JrRGlyO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgd29yayBkaXJlY3RvcnkgcGF0aCcsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2F2ZSB0aGUgd29yayBkaXJlY3RvcnkgcGF0aCB0byBhcHAgZGF0YVxuICAgICAqIEBwYXJhbSB3b3JrRGlyUGF0aCBQYXRoIHRvIHNhdmUgYXMgd29yayBkaXJlY3RvcnlcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgc3VjY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHNhdmVXb3JrRGlyUGF0aCh3b3JrRGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaW5kb3dzLXNwZWNpZmljIGJlaGF2aW9yIC0gYWx3YXlzIHVzZSBBcHBEYXRhXG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFwcERhdGFQYXRoID0gZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBGb3IgV2luZG93cywgd2UgYWx3YXlzIHNhdmUgQXBwRGF0YSBhcyB0aGUgd29yayBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGVuc3VyZXMgY29uc2lzdGVuY3kgYWNyb3NzIGRpZmZlcmVudCBpbnN0YWxsYXRpb25zXG4gICAgICAgICAgICAgICAgZW5zdXJlRGlyKHBhdGguZGlybmFtZSh0aGlzLndvcmtEaXJGaWxlUGF0aCkpO1xuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy53b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0RpcjogYXBwRGF0YVBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFdpbmRvd3M6IElnbm9yaW5nIGN1c3RvbSB3b3JrIGRpcmVjdG9yeSwgdXNpbmcgQXBwRGF0YSBpbnN0ZWFkOiAke2FwcERhdGFQYXRofWApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIEVuc3VyZSBhbnkgc2V0dGluZ3Mgb3IgZGlyZWN0b3JpZXMgdGhhdCB3b3VsZCBoYXZlIGJlZW4gaW4gdGhlIGN1c3RvbSB3b3JrRGlyXG4gICAgICAgICAgICAgICAgLy8gYXJlIGNyZWF0ZWQgaW4gQXBwRGF0YSB0b29cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgc2V0dGluZ3MuanNvbiBleGlzdHMgaW4gQXBwRGF0YVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBDcmVhdGUgd2l0aCBkZWZhdWx0IHNldHRpbmdzXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHNldHRpbmdzUGF0aCwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFNldHRpbmdzLCBudWxsLCAyKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBXaW5kb3dzOiBDcmVhdGVkIHNldHRpbmdzLmpzb24gaW4gQXBwRGF0YWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgb2RvbyBhbmQgcG9zdGdyZXMgZGlyZWN0b3JpZXMgZXhpc3RcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Rvb0RpciA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ29kb28nKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zdGdyZXNEaXIgPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICdwb3N0Z3JlcycpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKG9kb29EaXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMob2Rvb0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwb3N0Z3Jlc0RpcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhwb3N0Z3Jlc0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChzZXR1cEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdXaW5kb3dzOiBFcnJvciBzZXR0aW5nIHVwIEFwcERhdGEgZGlyZWN0b3JpZXMnLCBzZXR1cEVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIGJlaGF2aW9yIGZvciBvdGhlciBwbGF0Zm9ybXNcbiAgICAgICAgICAgIGVuc3VyZURpcihwYXRoLmRpcm5hbWUodGhpcy53b3JrRGlyRmlsZVBhdGgpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy53b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0Rpcjogd29ya0RpclBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgbG9nSW5mbyhgU2F2ZWQgd29yayBkaXJlY3RvcnkgcGF0aDogJHt3b3JrRGlyUGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHNhdmluZyB3b3JrIGRpcmVjdG9yeSBwYXRoJywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBzZXR0aW5ncyBmcm9tIHRoZSB3b3JrIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIFNldHRpbmdzIG9iamVjdCBvciBudWxsIGlmIG5vdCBmb3VuZFxuICAgICAqL1xuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPFNldHRpbmdzIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2luZG93cy1zcGVjaWZpYyBiZWhhdmlvciAtIGFsd2F5cyB1c2UgQXBwRGF0YVxuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcHBEYXRhUGF0aCA9IGdldEFwcERhdGFQYXRoKCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnc2V0dGluZ3MuanNvbicpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBkZWZhdWx0IHNldHRpbmdzIGZpbGUgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhzZXR0aW5nc1BhdGgsIEpTT04uc3RyaW5naWZ5KGRlZmF1bHRTZXR0aW5ncywgbnVsbCwgMikpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgV2luZG93czogQ3JlYXRlZCBkZWZhdWx0IHNldHRpbmdzLmpzb24gaW4gQXBwRGF0YWApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoICh3cml0ZUVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcignV2luZG93czogRXJyb3IgY3JlYXRpbmcgc2V0dGluZ3MuanNvbicsIHdyaXRlRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHRTZXR0aW5nczsgLy8gUmV0dXJuIGRlZmF1bHRzIGV2ZW4gaWYgd2UgY291bGRuJ3Qgd3JpdGUgdGhlIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdFNldHRpbmdzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHNldHRpbmdzUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKCdXaW5kb3dzOiBMb2FkZWQgc2V0dGluZ3MgZnJvbSBBcHBEYXRhJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRTZXR0aW5ncywgLi4uc2V0dGluZ3MgfTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChyZWFkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoJ1dpbmRvd3M6IEVycm9yIHJlYWRpbmcgc2V0dGluZ3MuanNvbiwgdXNpbmcgZGVmYXVsdHMnLCByZWFkRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmYXVsdFNldHRpbmdzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gT3JpZ2luYWwgYmVoYXZpb3IgZm9yIG90aGVyIHBsYXRmb3Jtc1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICBsb2dJbmZvKCdMb2FkZWQgc2V0dGluZ3MgZnJvbSB3b3JrIGRpcmVjdG9yeScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdFNldHRpbmdzLCAuLi5zZXR0aW5ncyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGxvYWRpbmcgc2V0dGluZ3MnLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNhdmUgc2V0dGluZ3MgdG8gdGhlIHdvcmsgZGlyZWN0b3J5XG4gICAgICogQHBhcmFtIHNldHRpbmdzIFNldHRpbmdzIG9iamVjdCB0byBzYXZlXG4gICAgICogQHBhcmFtIHdvcmtEaXJQYXRoIFdvcmsgZGlyZWN0b3J5IHBhdGggd2hlcmUgc2V0dGluZ3Mgc2hvdWxkIGJlIHNhdmVkXG4gICAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzYXZlU2V0dGluZ3Moc2V0dGluZ3M6IFBhcnRpYWw8U2V0dGluZ3M+LCB3b3JrRGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgd29yayBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICBlbnN1cmVEaXIod29ya0RpclBhdGgpO1xuXG4gICAgICAgICAgICAvLyBNZXJnZSB3aXRoIGRlZmF1bHQgc2V0dGluZ3NcbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZFNldHRpbmdzID0geyAuLi5kZWZhdWx0U2V0dGluZ3MsIC4uLnNldHRpbmdzIH07XG4gICAgICAgICAgICBtZXJnZWRTZXR0aW5ncy51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICAgICAgICAgIC8vIFdyaXRlIHNldHRpbmdzIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCBKU09OLnN0cmluZ2lmeShtZXJnZWRTZXR0aW5ncywgbnVsbCwgMikpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKGBTYXZlZCBzZXR0aW5ncyB0byB3b3JrIGRpcmVjdG9yeTogJHt3b3JrRGlyUGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHNhdmluZyBzZXR0aW5ncycsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBzZXR0aW5ncyBpbiB0aGUgd29yayBkaXJlY3RvcnlcbiAgICAgKiBAcGFyYW0gdXBkYXRlcyBQYXJ0aWFsIHNldHRpbmdzIG9iamVjdCB3aXRoIHVwZGF0ZXNcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgc3VjY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHVwZGF0ZVNldHRpbmdzKHVwZGF0ZXM6IFBhcnRpYWw8U2V0dGluZ3M+KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaW5kb3dzLXNwZWNpZmljIGJlaGF2aW9yIC0gYWx3YXlzIHVzZSBBcHBEYXRhXG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFwcERhdGFQYXRoID0gZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gR2V0IGN1cnJlbnQgc2V0dGluZ3Mgb3IgZGVmYXVsdHNcbiAgICAgICAgICAgICAgICBsZXQgY3VycmVudFNldHRpbmdzOiBTZXR0aW5ncztcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50U2V0dGluZ3MgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzZXR0aW5nc1BhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRTZXR0aW5ncyA9IHsgLi4uZGVmYXVsdFNldHRpbmdzIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChyZWFkRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoJ1dpbmRvd3M6IEVycm9yIHJlYWRpbmcgc2V0dGluZ3MuanNvbiwgdXNpbmcgZGVmYXVsdHMnLCByZWFkRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50U2V0dGluZ3MgPSB7IC4uLmRlZmF1bHRTZXR0aW5ncyB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBNZXJnZSB1cGRhdGVzIHdpdGggY3VycmVudCBzZXR0aW5nc1xuICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRTZXR0aW5ncyA9IHtcbiAgICAgICAgICAgICAgICAgICAgLi4uY3VycmVudFNldHRpbmdzLFxuICAgICAgICAgICAgICAgICAgICAuLi51cGRhdGVzLFxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRW5zdXJlIGRpcmVjdG9yeSBleGlzdHNcbiAgICAgICAgICAgICAgICBlbnN1cmVEaXIocGF0aC5kaXJuYW1lKHNldHRpbmdzUGF0aCkpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIFdyaXRlIHVwZGF0ZWQgc2V0dGluZ3NcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHNldHRpbmdzUGF0aCwgSlNPTi5zdHJpbmdpZnkodXBkYXRlZFNldHRpbmdzLCBudWxsLCAyKSk7XG4gICAgICAgICAgICAgICAgbG9nSW5mbygnV2luZG93czogVXBkYXRlZCBzZXR0aW5ncyBpbiBBcHBEYXRhJyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIE9yaWdpbmFsIGJlaGF2aW9yIGZvciBvdGhlciBwbGF0Zm9ybXNcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTZXR0aW5ncyA9IGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRTZXR0aW5ncykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNZXJnZSB1cGRhdGVzIHdpdGggY3VycmVudCBzZXR0aW5nc1xuICAgICAgICAgICAgY29uc3QgdXBkYXRlZFNldHRpbmdzID0ge1xuICAgICAgICAgICAgICAgIC4uLmN1cnJlbnRTZXR0aW5ncyxcbiAgICAgICAgICAgICAgICAuLi51cGRhdGVzLFxuICAgICAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBXcml0ZSB1cGRhdGVkIHNldHRpbmdzXG4gICAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpclBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHNldHRpbmdzUGF0aCwgSlNPTi5zdHJpbmdpZnkodXBkYXRlZFNldHRpbmdzLCBudWxsLCAyKSk7XG5cbiAgICAgICAgICAgIGxvZ0luZm8oJ1VwZGF0ZWQgc2V0dGluZ3MnKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHVwZGF0aW5nIHNldHRpbmdzJywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBDcmVhdGUgaW5zdGFuY2VcbmNvbnN0IHNldHRpbmdzU2VydmljZSA9IG5ldyBTZXR0aW5nc1NlcnZpY2UoKTtcblxuZXhwb3J0IHsgc2V0dGluZ3NTZXJ2aWNlIH07XG5leHBvcnQgZGVmYXVsdCBzZXR0aW5nc1NlcnZpY2U7IiwiLy8gc3JjL3NlcnZpY2VzL3N5c3RlbS9kb2NrZXJQYXRoU2VydmljZS50c1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgbG9nSW5mbywgbG9nRXJyb3IgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8qKlxuICogUG9zc2libGUgRG9ja2VyIGluc3RhbGxhdGlvbiBwYXRocyBmb3IgZGlmZmVyZW50IG9wZXJhdGluZyBzeXN0ZW1zXG4gKi9cbmNvbnN0IERPQ0tFUl9QQVRIUyA9IHtcbiAgZGFyd2luOiBbXG4gICAgJy91c3IvbG9jYWwvYmluL2RvY2tlcicsXG4gICAgJy9vcHQvaG9tZWJyZXcvYmluL2RvY2tlcicsXG4gICAgJy9BcHBsaWNhdGlvbnMvRG9ja2VyLmFwcC9Db250ZW50cy9SZXNvdXJjZXMvYmluL2RvY2tlcicsXG4gICAgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJy5kb2NrZXIvYmluL2RvY2tlcicpXG4gIF0sXG4gIGxpbnV4OiBbXG4gICAgJy91c3IvYmluL2RvY2tlcicsXG4gICAgJy91c3IvbG9jYWwvYmluL2RvY2tlcidcbiAgXSxcbiAgd2luMzI6IFtcbiAgICAnQzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxEb2NrZXJcXFxcRG9ja2VyXFxcXHJlc291cmNlc1xcXFxiaW5cXFxcZG9ja2VyLmV4ZScsXG4gICAgJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcRG9ja2VyXFxcXERvY2tlclxcXFxyZXNvdXJjZXNcXFxcZG9ja2VyLmV4ZScsXG4gICAgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0FwcERhdGFcXFxcTG9jYWxcXFxcRG9ja2VyXFxcXERvY2tlclxcXFxyZXNvdXJjZXNcXFxcYmluXFxcXGRvY2tlci5leGUnKVxuICBdXG59O1xuXG4vKipcbiAqIENsYXNzIHRvIGhhbmRsZSBEb2NrZXIgY29tbWFuZCBwYXRoIHJlc29sdXRpb25cbiAqL1xuY2xhc3MgRG9ja2VyUGF0aFNlcnZpY2Uge1xuICBwcml2YXRlIGRvY2tlclBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGRvY2tlckNvbXBvc2VQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAvKipcbiAgICogRmluZCB0aGUgRG9ja2VyIGV4ZWN1dGFibGUgcGF0aFxuICAgKi9cbiAgYXN5bmMgZmluZERvY2tlclBhdGgoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgaWYgKHRoaXMuZG9ja2VyUGF0aCkge1xuICAgICAgcmV0dXJuIHRoaXMuZG9ja2VyUGF0aDtcbiAgICB9XG5cbiAgICBsb2dJbmZvKCdTZWFyY2hpbmcgZm9yIERvY2tlciBleGVjdXRhYmxlLi4uJyk7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGV4ZWN1dGUgZG9ja2VyIGRpcmVjdGx5IGluIGNhc2UgaXQncyBpbiB0aGUgUEFUSFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBleGVjQXN5bmMoJ2RvY2tlciAtLXZlcnNpb24nKTtcbiAgICAgIHRoaXMuZG9ja2VyUGF0aCA9ICdkb2NrZXInO1xuICAgICAgbG9nSW5mbygnRG9ja2VyIGV4ZWN1dGFibGUgZm91bmQgaW4gUEFUSCcpO1xuICAgICAgcmV0dXJuIHRoaXMuZG9ja2VyUGF0aDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nSW5mbygnRG9ja2VyIG5vdCBmb3VuZCBpbiBQQVRILCBjaGVja2luZyBjb21tb24gaW5zdGFsbGF0aW9uIGxvY2F0aW9ucycpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGNvbW1vbiBpbnN0YWxsYXRpb24gcGF0aHMgYmFzZWQgb24gcGxhdGZvcm1cbiAgICBjb25zdCBwbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm0gYXMgJ2RhcndpbicgfCAnbGludXgnIHwgJ3dpbjMyJztcbiAgICBjb25zdCBwb3NzaWJsZVBhdGhzID0gRE9DS0VSX1BBVEhTW3BsYXRmb3JtXSB8fCBbXTtcblxuICAgIGZvciAoY29uc3QgZG9ja2VyUGF0aCBvZiBwb3NzaWJsZVBhdGhzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhkb2NrZXJQYXRoKSkge1xuICAgICAgICAgIGxvZ0luZm8oYEZvdW5kIERvY2tlciBleGVjdXRhYmxlIGF0OiAke2RvY2tlclBhdGh9YCk7XG4gICAgICAgICAgdGhpcy5kb2NrZXJQYXRoID0gZG9ja2VyUGF0aDtcbiAgICAgICAgICByZXR1cm4gZG9ja2VyUGF0aDtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgLy8gSWdub3JlIGVycm9ycyBhbmQgY29udGludWUgY2hlY2tpbmcgb3RoZXIgcGF0aHNcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB3ZSBnZXQgaGVyZSwgRG9ja2VyIGV4ZWN1dGFibGUgd2Fzbid0IGZvdW5kXG4gICAgbG9nRXJyb3IoJ0RvY2tlciBleGVjdXRhYmxlIG5vdCBmb3VuZCBpbiBhbnkgY29tbW9uIGxvY2F0aW9uJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSBhIERvY2tlciBjb21tYW5kIHdpdGggdGhlIGZ1bGwgcGF0aCB0byBEb2NrZXJcbiAgICovXG4gIGFzeW5jIGV4ZWN1dGVEb2NrZXJDb21tYW5kKGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8eyBzdGRvdXQ6IHN0cmluZzsgc3RkZXJyOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IGRvY2tlclBhdGggPSBhd2FpdCB0aGlzLmZpbmREb2NrZXJQYXRoKCk7XG4gICAgXG4gICAgaWYgKCFkb2NrZXJQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0RvY2tlciBleGVjdXRhYmxlIG5vdCBmb3VuZC4gUGxlYXNlIGVuc3VyZSBEb2NrZXIgaXMgaW5zdGFsbGVkIGFuZCBpbiB5b3VyIFBBVEguJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZnVsbENvbW1hbmQgPSBkb2NrZXJQYXRoID09PSAnZG9ja2VyJyBcbiAgICAgID8gYCR7Y29tbWFuZH1gICAvLyBEb2NrZXIgaXMgaW4gUEFUSFxuICAgICAgOiBgXCIke2RvY2tlclBhdGh9XCIgJHtjb21tYW5kLnJlcGxhY2UoL15kb2NrZXJcXHMrLywgJycpfWA7ICAvLyBVc2UgZnVsbCBwYXRoIGFuZCByZW1vdmUgJ2RvY2tlcicgcHJlZml4XG4gICAgXG4gICAgbG9nSW5mbyhgRXhlY3V0aW5nIERvY2tlciBjb21tYW5kOiAke2Z1bGxDb21tYW5kfWApO1xuICAgIHJldHVybiBhd2FpdCBleGVjQXN5bmMoZnVsbENvbW1hbmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIERvY2tlciBpcyBydW5uaW5nIGJ5IGV4ZWN1dGluZyAnZG9ja2VyIGluZm8nXG4gICAqL1xuICBhc3luYyBpc0RvY2tlclJ1bm5pbmcoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZURvY2tlckNvbW1hbmQoJ2RvY2tlciBpbmZvJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIG1vZGlmaWVkIFBBVEggaW5jbHVkaW5nIGNvbW1vbiBEb2NrZXIgaW5zdGFsbGF0aW9uIGRpcmVjdG9yaWVzXG4gICAqL1xuICBnZXRFbmhhbmNlZFBhdGgoKTogc3RyaW5nIHtcbiAgICBjb25zdCBwbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm07XG4gICAgY29uc3QgY3VycmVudFBhdGggPSBwcm9jZXNzLmVudi5QQVRIIHx8ICcnO1xuICAgIGxldCBhZGRpdGlvbmFsUGF0aHM6IHN0cmluZ1tdID0gW107XG5cbiAgICBzd2l0Y2ggKHBsYXRmb3JtKSB7XG4gICAgICBjYXNlICdkYXJ3aW4nOlxuICAgICAgICBhZGRpdGlvbmFsUGF0aHMgPSBbXG4gICAgICAgICAgJy91c3IvbG9jYWwvYmluJyxcbiAgICAgICAgICAnL29wdC9ob21lYnJldy9iaW4nLFxuICAgICAgICAgICcvQXBwbGljYXRpb25zL0RvY2tlci5hcHAvQ29udGVudHMvUmVzb3VyY2VzL2JpbicsXG4gICAgICAgICAgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJy5kb2NrZXIvYmluJylcbiAgICAgICAgXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdsaW51eCc6XG4gICAgICAgIGFkZGl0aW9uYWxQYXRocyA9IFtcbiAgICAgICAgICAnL3Vzci9iaW4nLFxuICAgICAgICAgICcvdXNyL2xvY2FsL2JpbidcbiAgICAgICAgXTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd3aW4zMic6XG4gICAgICAgIGFkZGl0aW9uYWxQYXRocyA9IFtcbiAgICAgICAgICAnQzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxEb2NrZXJcXFxcRG9ja2VyXFxcXHJlc291cmNlc1xcXFxiaW4nLFxuICAgICAgICAgIHBhdGguam9pbihvcy5ob21lZGlyKCksICdBcHBEYXRhXFxcXExvY2FsXFxcXERvY2tlclxcXFxEb2NrZXJcXFxccmVzb3VyY2VzXFxcXGJpbicpXG4gICAgICAgIF07XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIEZpbHRlciBwYXRocyB0aGF0IGFjdHVhbGx5IGV4aXN0XG4gICAgY29uc3QgZXhpc3RpbmdQYXRocyA9IGFkZGl0aW9uYWxQYXRocy5maWx0ZXIocCA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZnMuZXhpc3RzU3luYyhwKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgbmV3IFBBVEggc3RyaW5nIHdpdGggcGxhdGZvcm0tc3BlY2lmaWMgc2VwYXJhdG9yXG4gICAgY29uc3QgcGF0aFNlcGFyYXRvciA9IHBsYXRmb3JtID09PSAnd2luMzInID8gJzsnIDogJzonO1xuICAgIHJldHVybiBbLi4uZXhpc3RpbmdQYXRocywgY3VycmVudFBhdGhdLmpvaW4ocGF0aFNlcGFyYXRvcik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IERvY2tlclBhdGhTZXJ2aWNlKCk7IiwiLy8gc3JjL3NlcnZpY2VzL2RvY2tlci9kb2NrZXJDb21wb3NlU2VydmljZS50c1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgZ2V0QXBwRGF0YVBhdGggfSBmcm9tICcuLi9zeXN0ZW0vcGF0aFNlcnZpY2UnO1xuaW1wb3J0IHNldHRpbmdzU2VydmljZSBmcm9tICcuLi9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2UnO1xuaW1wb3J0IHsgbG9nSW5mbywgbG9nRXJyb3IgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IGRvY2tlclBhdGhTZXJ2aWNlIGZyb20gJy4uL3N5c3RlbS9kb2NrZXJQYXRoU2VydmljZSc7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLyoqXG4gKiBTZXJ2aWNlIGZvciBtYW5hZ2luZyBEb2NrZXIgQ29tcG9zZSBvcGVyYXRpb25zIGZvciBPZG9vIGluc3RhbmNlc1xuICovXG5jbGFzcyBEb2NrZXJDb21wb3NlU2VydmljZSB7XG4gICAgcHJpdmF0ZSBwcm9qZWN0c1BhdGg6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLnByb2plY3RzUGF0aCA9IHBhdGguam9pbihnZXRBcHBEYXRhUGF0aCgpLCAncHJvamVjdHMnKTtcblxuICAgICAgICAvLyBFbnN1cmUgcHJvamVjdHMgZGlyZWN0b3J5IGV4aXN0c1xuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5wcm9qZWN0c1BhdGgpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLnByb2plY3RzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRlZCBwcm9qZWN0cyBkaXJlY3Rvcnk6ICR7dGhpcy5wcm9qZWN0c1BhdGh9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBwcm9qZWN0cyBkaXJlY3RvcnlgLCBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBGb3IgV2luZG93cywgd2Ugd2FudCB0byBpbml0aWFsaXplIGltbWVkaWF0ZWx5IHRvIGVuc3VyZSBwYXRocyBhcmUgc2V0IGNvcnJlY3RseVxuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplV2luZG93c1Byb2plY3RzUGF0aCgpO1xuICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBwcm9qZWN0cyBwYXRoIHNwZWNpZmljYWxseSBmb3IgV2luZG93cyBwbGF0Zm9ybVxuICAgICAqIFRoaXMgZW5zdXJlcyB3ZSBhbHdheXMgdXNlIEFwcERhdGEgZGlyZWN0b3J5IG9uIFdpbmRvd3NcbiAgICAgKi9cbiAgICBhc3luYyBpbml0aWFsaXplV2luZG93c1Byb2plY3RzUGF0aCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICd3aW4zMicpIHJldHVybjtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhcHBEYXRhUGF0aCA9IGdldEFwcERhdGFQYXRoKCk7XG4gICAgICAgICAgICBsb2dJbmZvKGBXaW5kb3dzOiBTZXR0aW5nIHByb2plY3RzIHBhdGggdG8gQXBwRGF0YTogJHthcHBEYXRhUGF0aH1gKTtcbiAgICAgICAgICAgIHRoaXMucHJvamVjdHNQYXRoID0gYXBwRGF0YVBhdGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENyZWF0ZSBvZG9vIGFuZCBwb3N0Z3JlcyBkaXJlY3RvcmllcyBpZiB0aGV5IGRvbid0IGV4aXN0XG4gICAgICAgICAgICBjb25zdCBvZG9vUGF0aCA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nKTtcbiAgICAgICAgICAgIGNvbnN0IHBvc3RncmVzUGF0aCA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhvZG9vUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMob2Rvb1BhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFdpbmRvd3M6IENyZWF0ZWQgb2RvbyBkaXJlY3RvcnkgaW4gQXBwRGF0YWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocG9zdGdyZXNQYXRoKSkge1xuICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhwb3N0Z3Jlc1BhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFdpbmRvd3M6IENyZWF0ZWQgcG9zdGdyZXMgZGlyZWN0b3J5IGluIEFwcERhdGFgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbG9nSW5mbyhgV2luZG93czogUHJvamVjdHMgcGF0aHMgaW5pdGlhbGl6ZWQ6ICR7dGhpcy5wcm9qZWN0c1BhdGh9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgV2luZG93czogRXJyb3IgaW5pdGlhbGl6aW5nIHByb2plY3RzIHBhdGhzYCwgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgb3IgdXBkYXRlIHRoZSBwcm9qZWN0cyBwYXRoIGJhc2VkIG9uIHdvcmtkaXJcbiAgICAgKi9cbiAgICBhc3luYyBpbml0aWFsaXplUHJvamVjdHNQYXRoKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2luZG93cy1zcGVjaWZpYyBiZWhhdmlvciAtIGFsd2F5cyB1c2UgQXBwRGF0YVxuICAgICAgICAgICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVXaW5kb3dzUHJvamVjdHNQYXRoKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBPcmlnaW5hbCBiZWhhdmlvciBmb3Igb3RoZXIgcGxhdGZvcm1zXG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGF3YWl0IHNldHRpbmdzU2VydmljZS5nZXRXb3JrRGlyUGF0aCgpO1xuICAgICAgICAgICAgaWYgKHdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9qZWN0c1BhdGggPSB3b3JrRGlyUGF0aDtcblxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBvZG9vIGFuZCBwb3N0Z3JlcyBkaXJlY3Rvcmllc1xuICAgICAgICAgICAgICAgIGNvbnN0IG9kb29QYXRoID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvc3RncmVzUGF0aCA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJyk7XG5cbiAgICAgICAgICAgICAgICAvLyBFbnN1cmUgYm90aCBkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhvZG9vUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKG9kb29QYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBvc3RncmVzUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHBvc3RncmVzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgVXBkYXRlZCBwcm9qZWN0IHBhdGhzOiAke3RoaXMucHJvamVjdHNQYXRofWApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBObyB3b3JrZGlyIGZvdW5kLCB1c2luZyBkZWZhdWx0IHBhdGg6ICR7dGhpcy5wcm9qZWN0c1BhdGh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgaW5pdGlhbGl6aW5nIHByb2plY3QgcGF0aHNgLCBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoU3RyaW5nKGVycm9yKSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgKi9cbiAgICBhc3luYyBjaGVja0RvY2tlcigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oJ0NoZWNraW5nIERvY2tlciBlbmdpbmUgc3RhdHVzJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEZpcnN0LCBlbmhhbmNlIHRoZSBQQVRIIGVudmlyb25tZW50IHRvIGluY2x1ZGUgY29tbW9uIERvY2tlciBpbnN0YWxsYXRpb24gbG9jYXRpb25zXG4gICAgICAgICAgICBwcm9jZXNzLmVudi5QQVRIID0gZG9ja2VyUGF0aFNlcnZpY2UuZ2V0RW5oYW5jZWRQYXRoKCk7XG4gICAgICAgICAgICBsb2dJbmZvKGBFbmhhbmNlZCBQQVRIOiAke3Byb2Nlc3MuZW52LlBBVEh9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIERvY2tlciBwYXRoIGZpcnN0XG4gICAgICAgICAgICBjb25zdCBkb2NrZXJQYXRoID0gYXdhaXQgZG9ja2VyUGF0aFNlcnZpY2UuZmluZERvY2tlclBhdGgoKTtcbiAgICAgICAgICAgIGlmICghZG9ja2VyUGF0aCkge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdEb2NrZXIgZXhlY3V0YWJsZSBub3QgZm91bmQgaW4gY29tbW9uIGxvY2F0aW9ucycpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRXhlY3V0ZSBkb2NrZXIgaW5mbyBjb21tYW5kIHRvIGNoZWNrIGlmIERvY2tlciBpcyBydW5uaW5nXG4gICAgICAgICAgICBhd2FpdCBkb2NrZXJQYXRoU2VydmljZS5leGVjdXRlRG9ja2VyQ29tbWFuZCgnZG9ja2VyIGluZm8nKTtcbiAgICAgICAgICAgIGxvZ0luZm8oJ0RvY2tlciBlbmdpbmUgaXMgcnVubmluZycpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0RvY2tlciBlbmdpbmUgaXMgbm90IHJ1bm5pbmcgb3Igbm90IGluc3RhbGxlZCcsIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyIDogbmV3IEVycm9yKFN0cmluZyhlcnIpKSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbnN1cmUgRG9ja2VyIG5ldHdvcmsgZXhpc3RzXG4gICAgICovXG4gICAgYXN5bmMgZW5zdXJlTmV0d29ya0V4aXN0cyhuZXR3b3JrTmFtZTogc3RyaW5nID0gJ29kb28tbmV0d29yaycpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oYENoZWNraW5nIGlmIG5ldHdvcmsgZXhpc3RzOiAke25ldHdvcmtOYW1lfWApO1xuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGRvY2tlclBhdGhTZXJ2aWNlLmV4ZWN1dGVEb2NrZXJDb21tYW5kKGBkb2NrZXIgbmV0d29yayBscyAtLWZvcm1hdCBcInt7Lk5hbWV9fVwiYCk7XG5cbiAgICAgICAgICAgIGlmICghc3Rkb3V0LmluY2x1ZGVzKG5ldHdvcmtOYW1lKSkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYENyZWF0aW5nIG5ldHdvcms6ICR7bmV0d29ya05hbWV9YCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgZG9ja2VyUGF0aFNlcnZpY2UuZXhlY3V0ZURvY2tlckNvbW1hbmQoYGRvY2tlciBuZXR3b3JrIGNyZWF0ZSAke25ldHdvcmtOYW1lfWApO1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYE5ldHdvcmsgY3JlYXRlZCBzdWNjZXNzZnVsbHk6ICR7bmV0d29ya05hbWV9YCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYE5ldHdvcmsgJHtuZXR3b3JrTmFtZX0gYWxyZWFkeSBleGlzdHNgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBlbnN1cmluZyBuZXR3b3JrICR7bmV0d29ya05hbWV9IGV4aXN0c2AsIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyIDogbmV3IEVycm9yKFN0cmluZyhlcnIpKSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBhIHBvcnQgaXMgYXZhaWxhYmxlIGFuZCBmaW5kIGFuIGFsdGVybmF0aXZlIGlmIG5lZWRlZFxuICAgICAqIEltcHJvdmVkIGltcGxlbWVudGF0aW9uIGZvciBiZXR0ZXIgY3Jvc3MtcGxhdGZvcm0gc3VwcG9ydCwgZXNwZWNpYWxseSBvbiBXaW5kb3dzXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja1BvcnRBdmFpbGFiaWxpdHkocG9ydDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oYFRlc3RpbmcgcG9ydCAke3BvcnR9IGF2YWlsYWJpbGl0eWApO1xuICAgICAgICAgICAgY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG4gICAgICAgICAgICBjb25zdCB0ZXN0ZXIgPSBuZXQuY3JlYXRlU2VydmVyKCk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHBvcnQgZnVuY3Rpb24gLSBtb3JlIHJlbGlhYmxlIGFjcm9zcyBwbGF0Zm9ybXNcbiAgICAgICAgICAgIGNvbnN0IGNoZWNrUG9ydCA9IChwb3J0OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyID0gbmV0LmNyZWF0ZVNlcnZlcigpXG4gICAgICAgICAgICAgICAgICAgICAgICAub25jZSgnZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyLmNvZGUgPT09ICdFQUREUklOVVNFJyB8fCBlcnIuY29kZSA9PT0gJ0VBQ0NFUycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUG9ydCAke3BvcnR9IGlzIGluIHVzZSBvciBhY2Nlc3MgZGVuaWVkYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBhbnkgb3RoZXIgZXJyb3IsIHdlJ2xsIHN0aWxsIHRyeSB0byB1c2UgYW5vdGhlciBwb3J0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFBvcnQgJHtwb3J0fSBjaGVjayBlcnJvcjogJHtlcnIuY29kZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbmNlKCdsaXN0ZW5pbmcnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUG9ydCAke3BvcnR9IGlzIGF2YWlsYWJsZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaXJzdCB0cnkgdG8gbGlzdGVuIG9uIGxvY2FsaG9zdCAobW9yZSByZWxpYWJsZSBkZXRlY3Rpb24gb24gV2luZG93cylcbiAgICAgICAgICAgICAgICAgICAgc2VydmVyLmxpc3Rlbihwb3J0LCAnMTI3LjAuMC4xJyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgcmVxdWVzdGVkIHBvcnRcbiAgICAgICAgICAgIGNvbnN0IGlzQXZhaWxhYmxlID0gYXdhaXQgY2hlY2tQb3J0KHBvcnQpO1xuICAgICAgICAgICAgaWYgKGlzQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvcnQ7IC8vIFBvcnQgaXMgYXZhaWxhYmxlLCB1c2UgaXRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb3J0ICR7cG9ydH0gaXMgYWxyZWFkeSBpbiB1c2VgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBGaW5kaW5nIGFsdGVybmF0aXZlIHBvcnQgdG8gJHtwb3J0fWApO1xuICAgICAgICAgICAgbGV0IG5ld1BvcnQgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBUcnkgbmV4dCAyMCBwb3J0c1xuICAgICAgICAgICAgZm9yIChsZXQgdGVzdFBvcnQgPSBwb3J0ICsgMTsgdGVzdFBvcnQgPCBwb3J0ICsgMjA7IHRlc3RQb3J0KyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXQgPSByZXF1aXJlKCduZXQnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBNb3JlIHJlbGlhYmxlIHBvcnQgY2hlY2tpbmcgZnVuY3Rpb25cbiAgICAgICAgICAgICAgICBjb25zdCBpc0F2YWlsYWJsZSA9IGF3YWl0IG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uY2UoJ2Vycm9yJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbmNlKCdsaXN0ZW5pbmcnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gT24gV2luZG93cywgbGlzdGVuIG9uIGxvY2FsaG9zdCBmb3IgbW9yZSByZWxpYWJsZSBkZXRlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgc2VydmVyLmxpc3Rlbih0ZXN0UG9ydCwgJzEyNy4wLjAuMScpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1BvcnQgPSB0ZXN0UG9ydDtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgRm91bmQgYXZhaWxhYmxlIHBvcnQ6ICR7bmV3UG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUG9ydCAke3Rlc3RQb3J0fSBpcyBpbiB1c2UsIHRyeWluZyBuZXh0IG9uZWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5ld1BvcnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3UG9ydDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb3J0ICR7cG9ydH0gaXMgaW4gdXNlIGFuZCBubyBhbHRlcm5hdGl2ZSBwb3J0cyBhcmUgYXZhaWxhYmxlLiBQbGVhc2Ugc3BlY2lmeSBhIGRpZmZlcmVudCBwb3J0LmApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb3JyZWN0IERvY2tlciBDb21wb3NlIGNvbW1hbmRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRDb21wb3NlQ29tbWFuZCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZG9ja2VyUGF0aFNlcnZpY2UuZXhlY3V0ZURvY2tlckNvbW1hbmQoJ2RvY2tlciBjb21wb3NlIHZlcnNpb24nKTtcbiAgICAgICAgICAgIHJldHVybiAnZG9ja2VyIGNvbXBvc2UnO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBUcnkgdGhlIG9sZCBkb2NrZXItY29tcG9zZSBjb21tYW5kXG4gICAgICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKCdkb2NrZXItY29tcG9zZSAtLXZlcnNpb24nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2RvY2tlci1jb21wb3NlJztcbiAgICAgICAgICAgIH0gY2F0Y2ggKGNvbXBvc2VFcnJvcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRG9ja2VyIENvbXBvc2UgaXMgbm90IGF2YWlsYWJsZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgUG9zdGdyZVNRTCBpbnN0YW5jZSB3aXRoIERvY2tlciBDb21wb3NlXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlUG9zdGdyZXNJbnN0YW5jZShcbiAgICAgICAgaW5zdGFuY2VOYW1lOiBzdHJpbmcsXG4gICAgICAgIHZlcnNpb246IHN0cmluZyxcbiAgICAgICAgcG9ydDogbnVtYmVyID0gNTQzMixcbiAgICAgICAgdXNlcm5hbWU6IHN0cmluZyA9ICdwb3N0Z3JlcycsXG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmcgPSAncG9zdGdyZXMnXG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZzsgcG9ydD86IG51bWJlciB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBTdGFydGluZyBQb3N0Z3JlU1FMIGluc3RhbmNlIGNyZWF0aW9uOiAke2luc3RhbmNlTmFtZX0sIHZlcnNpb246ICR7dmVyc2lvbn0sIHBvcnQ6ICR7cG9ydH1gKTtcblxuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHdlJ3JlIHVzaW5nIHRoZSBjb3JyZWN0IHBhdGhcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBMb2cgd2hlcmUgZmlsZXMgd2lsbCBiZSBzYXZlZFxuICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYEZpbGVzIHdpbGwgYmUgc2F2ZWQgdG86ICR7cHJvamVjdERpcn1gKTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5jaGVja0RvY2tlcigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdEb2NrZXIgaXMgbm90IHJ1bm5pbmcuIFBsZWFzZSBzdGFydCBEb2NrZXIgYW5kIHRyeSBhZ2Fpbi4nIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgbmV0d29yayBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmxvYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgY29uc3QgbmV0d29ya05hbWUgPSBzZXR0aW5ncz8ubmV0d29yayB8fCAnb2Rvby1uZXR3b3JrJztcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5lbnN1cmVOZXR3b3JrRXhpc3RzKG5ldHdvcmtOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgRmFpbGVkIHRvIGNyZWF0ZSBvciB2ZXJpZnkgbmV0d29yayAke25ldHdvcmtOYW1lfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgcG9ydCBhdmFpbGFiaWxpdHlcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IGF3YWl0IHRoaXMuY2hlY2tQb3J0QXZhaWxhYmlsaXR5KHBvcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIHByb2plY3QgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgSW5zdGFuY2UgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzOiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gYWxyZWFkeSBleGlzdHNgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYENyZWF0aW5nIHByb2plY3QgZGlyZWN0b3J5OiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBEb2NrZXIgQ29tcG9zZSBmaWxlXG4gICAgICAgICAgICBsb2dJbmZvKGBHZW5lcmF0aW5nIERvY2tlciBDb21wb3NlIGZpbGUgd2l0aCBwb3J0ICR7cG9ydH1gKTtcblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbnRlbnQgPSBgXG5zZXJ2aWNlczpcbiAgcG9zdGdyZXM6XG4gICAgaW1hZ2U6IHBvc3RncmVzOiR7dmVyc2lvbn1cbiAgICBjb250YWluZXJfbmFtZTogJHtpbnN0YW5jZU5hbWV9XG4gICAgZW52aXJvbm1lbnQ6XG4gICAgICAtIFBPU1RHUkVTX1BBU1NXT1JEPSR7cGFzc3dvcmR9XG4gICAgICAtIFBPU1RHUkVTX1VTRVI9JHt1c2VybmFtZX1cbiAgICAgIC0gUE9TVEdSRVNfREI9cG9zdGdyZXNcbiAgICBwb3J0czpcbiAgICAgIC0gXCIke3BvcnR9OjU0MzJcIlxuICAgIHZvbHVtZXM6XG4gICAgICAtICR7aW5zdGFuY2VOYW1lfV9kYXRhOi92YXIvbGliL3Bvc3RncmVzcWwvZGF0YVxuICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkXG4gICAgbmV0d29ya3M6XG4gICAgICAtICR7bmV0d29ya05hbWV9XG5cbm5ldHdvcmtzOlxuICAke25ldHdvcmtOYW1lfTpcbiAgICBleHRlcm5hbDogdHJ1ZVxuXG52b2x1bWVzOlxuICAke2luc3RhbmNlTmFtZX1fZGF0YTpcbiAgICBkcml2ZXI6IGxvY2FsXG5gO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgbG9nSW5mbyhgV3JpdGluZyBEb2NrZXIgQ29tcG9zZSBmaWxlIHRvICR7Y29tcG9zZUZpbGVQYXRofWApO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhjb21wb3NlRmlsZVBhdGgsIGNvbXBvc2VDb250ZW50LCAndXRmOCcpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgZmlsZSB3YXMgY3JlYXRlZFxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgQ29tcG9zZSBmaWxlIG5vdCBjcmVhdGVkOiAke2NvbXBvc2VGaWxlUGF0aH1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0ZhaWxlZCB0byBjcmVhdGUgRG9ja2VyIENvbXBvc2UgZmlsZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGluc3RhbmNlIGluZm8gZmlsZVxuICAgICAgICAgICAgY29uc3QgaW5mb0ZpbGUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRpbmcgaW5zdGFuY2UgaW5mbyBmaWxlOiAke2luZm9GaWxlfWApO1xuXG4gICAgICAgICAgICBjb25zdCBpbmZvID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGluc3RhbmNlTmFtZSxcbiAgICAgICAgICAgICAgICB0eXBlOiAncG9zdGdyZXMnLFxuICAgICAgICAgICAgICAgIHZlcnNpb24sXG4gICAgICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgICAgICB1c2VybmFtZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbmZvRmlsZSwgSlNPTi5zdHJpbmdpZnkoaW5mbywgbnVsbCwgMiksICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFN0YXJ0IHRoZSBjb250YWluZXIgd2l0aCBEb2NrZXIgQ29tcG9zZVxuICAgICAgICAgICAgbG9nSW5mbyhgU3RhcnRpbmcgUG9zdGdyZVNRTCBjb250YWluZXJgKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VDb21tYW5kID0gYXdhaXQgdGhpcy5nZXRDb21wb3NlQ29tbWFuZCgpO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEV4ZWN1dGluZzogY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IHVwIC1kYCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3Rkb3V0KSBsb2dJbmZvKGBEb2NrZXIgQ29tcG9zZSBzdGRvdXQ6ICR7c3Rkb3V0fWApO1xuICAgICAgICAgICAgICAgIGlmIChzdGRlcnIpIGxvZ0luZm8oYERvY2tlciBDb21wb3NlIHN0ZGVycjogJHtzdGRlcnJ9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzdGFydGluZyBjb250YWluZXJgLCBlcnJvcik7XG5cbiAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZ2V0IG1vcmUgZXJyb3IgZGV0YWlsc1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBsb2dzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGxvZ3NgKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIGxvZ3M6ICR7bG9nc31gKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcihgQ291bGRuJ3QgZ2V0IGNvbnRhaW5lciBsb2dzYCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3Igc3RhcnRpbmcgY29udGFpbmVyOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmVyaWZ5IHRoZSBjb250YWluZXIgaXMgcnVubmluZ1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBWZXJpZnlpbmcgY29udGFpbmVyIGlzIHJ1bm5pbmdgKTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogY29udGFpbmVyU3RhdHVzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBwcyAtLWZpbHRlciBcIm5hbWU9JHtpbnN0YW5jZU5hbWV9XCIgLS1mb3JtYXQgXCJ7ey5TdGF0dXN9fVwiYCk7XG5cbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgc3RhdHVzOiAke2NvbnRhaW5lclN0YXR1c31gKTtcblxuICAgICAgICAgICAgICAgIGlmICghY29udGFpbmVyU3RhdHVzLmluY2x1ZGVzKCdVcCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBtYXkgbm90IGJlIHJ1bm5pbmcgY29ycmVjdGx5YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gR2V0IGNvbnRhaW5lciBsb2dzIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBjb250YWluZXJMb2dzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBsb2dzICR7aW5zdGFuY2VOYW1lfSAtLXRhaWwgMjBgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBsb2dzOiAke2NvbnRhaW5lckxvZ3N9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcihgQ291bGRuJ3QgZ2V0IGNvbnRhaW5lciBsb2dzYCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIC8vIFN0aWxsIHJldHVybiBzdWNjZXNzIHNpbmNlIGZpbGVzIHdlcmUgY3JlYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgY3JlYXRlZCwgYnV0IGNvbnRhaW5lciBtYXkgbm90IGJlIHJ1bm5pbmcgY29ycmVjdGx5LiBDaGVjayBsb2dzLmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3J0XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY2hlY2tpbmcgY29udGFpbmVyIHN0YXR1c2AsIGVycm9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nSW5mbyhgU3VjY2Vzc2Z1bGx5IGNyZWF0ZWQgUG9zdGdyZVNRTCBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5IG9uIHBvcnQgJHtwb3J0fSFgLFxuICAgICAgICAgICAgICAgIHBvcnRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY3JlYXRpbmcgUG9zdGdyZVNRTCBpbnN0YW5jZSAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBjcmVhdGluZyBpbnN0YW5jZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGEgRG9ja2VyIENvbXBvc2UgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEluc3RhbmNlKGluc3RhbmNlTmFtZTogc3RyaW5nKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVQcm9qZWN0c1BhdGgoKTtcblxuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBjb3JyZWN0IGRpcmVjdG9yeSBiYXNlZCBvbiBpbnN0YW5jZSB0eXBlXG4gICAgICAgICAgICBsZXQgcHJvamVjdERpcjtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZU5hbWUuaW5jbHVkZXMoJ3Bvc3RncmVzXycpKSB7XG4gICAgICAgICAgICAgICAgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nLCBpbnN0YW5jZU5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkb2VzIG5vdCBleGlzdGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUZpbGUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgQ29tcG9zZSBmaWxlIGZvciAke2luc3RhbmNlTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0YXJ0aW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcbiAgICAgICAgICAgIGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBzdGFydGVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzdGFydGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3Igc3RhcnRpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIGEgRG9ja2VyIENvbXBvc2UgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdG9wSW5zdGFuY2UoaW5zdGFuY2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgdGhlIGNvcnJlY3QgZGlyZWN0b3J5IGJhc2VkIG9uIGluc3RhbmNlIHR5cGVcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlVHlwZSA9IGluc3RhbmNlTmFtZS5pbmNsdWRlcygncG9zdGdyZXMnKSA/ICdwb3N0Z3JlcycgOiAnb2Rvbyc7XG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCBpbnN0YW5jZVR5cGUsIGluc3RhbmNlTmFtZSk7XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYFN0b3BwaW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gZG9lcyBub3QgZXhpc3RgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VGaWxlID0gcGF0aC5qb2luKHByb2plY3REaXIsICdkb2NrZXItY29tcG9zZS55bWwnKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb21wb3NlRmlsZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYENvbXBvc2UgZmlsZSBmb3IgJHtpbnN0YW5jZU5hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgaXQncyBhIFBvc3RncmVTUUwgaW5zdGFuY2UsIGNoZWNrIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXNcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZVR5cGUgPT09ICdwb3N0Z3JlcycpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIGJlZm9yZSBzdG9wcGluZyBQb3N0Z3JlU1FMOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgICAgIC8vIExpc3QgYWxsIGluc3RhbmNlcyB0byBmaW5kIGRlcGVuZGVudCBvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gYXdhaXQgdGhpcy5saXN0SW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBGaWx0ZXIgZm9yIGFjdGl2ZSBPZG9vIGluc3RhbmNlcyB0aGF0IGRlcGVuZCBvbiB0aGlzIFBvc3RncmVTUUwgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBkZXBlbmRlbnRJbnN0YW5jZXMgPSBpbnN0YW5jZXMuZmlsdGVyKGluc3RhbmNlID0+XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmluZm8gJiZcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mby50eXBlID09PSAnb2RvbycgJiZcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mby5wb3N0Z3Jlc0luc3RhbmNlID09PSBpbnN0YW5jZU5hbWUgJiZcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2Uuc3RhdHVzLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3VwJylcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRlcGVuZGVudEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudE5hbWVzID0gZGVwZW5kZW50SW5zdGFuY2VzLm1hcChpbnN0YW5jZSA9PiBpbnN0YW5jZS5uYW1lKS5qb2luKCcsICcpO1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCBydW5uaW5nIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlczogJHtkZXBlbmRlbnROYW1lc31gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYENhbm5vdCBzdG9wIFBvc3RncmVTUUwgaW5zdGFuY2UgXCIke2luc3RhbmNlTmFtZX1cIiBiZWNhdXNlIGl0IGhhcyBydW5uaW5nIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIGl0OiAke2RlcGVuZGVudE5hbWVzfS4gUGxlYXNlIHN0b3AgdGhlc2UgaW5zdGFuY2VzIGZpcnN0LmBcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsb2dJbmZvKCdObyBydW5uaW5nIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlcyBmb3VuZCwgcHJvY2VlZGluZyB3aXRoIHN0b3AnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG4gICAgICAgICAgICBsb2dJbmZvKGBTdG9wcGluZyBpbnN0YW5jZSB3aXRoOiAke2NvbXBvc2VDb21tYW5kfSBzdG9wYCk7XG4gICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IHN0b3BgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBzdG9wcGVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzdG9wcGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3Igc3RvcHBpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSBEb2NrZXIgQ29tcG9zZSBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIGRlbGV0ZUluc3RhbmNlKGluc3RhbmNlTmFtZTogc3RyaW5nLCBrZWVwRmlsZXM6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgY29ycmVjdCBkaXJlY3RvcnkgYmFzZWQgb24gaW5zdGFuY2UgdHlwZVxuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VUeXBlID0gaW5zdGFuY2VOYW1lLmluY2x1ZGVzKCdwb3N0Z3JlcycpID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgbG9nSW5mbyhgRGVsZXRpbmcgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkb2VzIG5vdCBleGlzdGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgaXQncyBhIFBvc3RncmVTUUwgaW5zdGFuY2UsIGNoZWNrIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXNcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZVR5cGUgPT09ICdwb3N0Z3JlcycpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIGJlZm9yZSBkZWxldGluZyBQb3N0Z3JlU1FMOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgICAgIC8vIExpc3QgYWxsIGluc3RhbmNlcyB0byBmaW5kIGRlcGVuZGVudCBvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gYXdhaXQgdGhpcy5saXN0SW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBHZXQgYWxsIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIHRoaXMgUG9zdGdyZVNRTCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdGFuY2UgPT5cbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mbyAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnR5cGUgPT09ICdvZG9vJyAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IGluc3RhbmNlTmFtZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVwZW5kZW50SW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVwZW5kZW50TmFtZXMgPSBkZXBlbmRlbnRJbnN0YW5jZXMubWFwKGluc3RhbmNlID0+IGluc3RhbmNlLm5hbWUpLmpvaW4oJywgJyk7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYEZvdW5kIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlczogJHtkZXBlbmRlbnROYW1lc31gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYENhbm5vdCBkZWxldGUgUG9zdGdyZVNRTCBpbnN0YW5jZSBcIiR7aW5zdGFuY2VOYW1lfVwiIGJlY2F1c2UgaXQgaGFzIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIGl0OiAke2RlcGVuZGVudE5hbWVzfS4gUGxlYXNlIGRlbGV0ZSB0aGVzZSBpbnN0YW5jZXMgZmlyc3QuYFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxvZ0luZm8oJ05vIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlcyBmb3VuZCwgcHJvY2VlZGluZyB3aXRoIGRlbGV0ZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcblxuICAgICAgICAgICAgLy8gU3RvcCBhbmQgcmVtb3ZlIGNvbnRhaW5lcnNcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0b3BwaW5nIGNvbnRhaW5lcnMgd2l0aCAke2NvbXBvc2VDb21tYW5kfSBkb3duYCk7XG4gICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGRvd24gLXZgKTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSBkaXJlY3RvcnkgaWYga2VlcEZpbGVzIGlzIGZhbHNlXG4gICAgICAgICAgICBpZiAoIWtlZXBGaWxlcykge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFJlbW92aW5nIGRpcmVjdG9yeTogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgICAgIGZzLnJtU3luYyhwcm9qZWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEtlZXBpbmcgZmlsZXMgaW46ICR7cHJvamVjdERpcn1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkZWxldGVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBkZWxldGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3IgZGVsZXRpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgbG9ncyBmcm9tIGEgRG9ja2VyIGNvbnRhaW5lclxuICAgICAqL1xuICAgIGFzeW5jIGdldExvZ3MoaW5zdGFuY2VOYW1lOiBzdHJpbmcsIHNlcnZpY2U6IHN0cmluZyA9ICdhdXRvJywgdGFpbDogbnVtYmVyID0gMTAwKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGxvZ3M/OiBzdHJpbmc7IG1lc3NhZ2U/OiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgY29ycmVjdCBkaXJlY3RvcnkgYmFzZWQgb24gaW5zdGFuY2UgdHlwZVxuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VUeXBlID0gaW5zdGFuY2VOYW1lLmluY2x1ZGVzKCdwb3N0Z3JlcycpID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgbG9nSW5mbyhgR2V0dGluZyBsb2dzIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRvZXMgbm90IGV4aXN0YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBzZXJ2aWNlIGlzIGF1dG8sIGRldGVybWluZSB0aGUgZGVmYXVsdCBzZXJ2aWNlIGJhc2VkIG9uIGluc3RhbmNlIHR5cGVcbiAgICAgICAgICAgIGlmIChzZXJ2aWNlID09PSAnYXV0bycpIHtcbiAgICAgICAgICAgICAgICBzZXJ2aWNlID0gaW5zdGFuY2VUeXBlID09PSAncG9zdGdyZXMnID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nSW5mbyhgVXNpbmcgc2VydmljZTogJHtzZXJ2aWNlfSBmb3IgbG9nc2ApO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGxvZ3MgLS10YWlsPSR7dGFpbH0gJHtzZXJ2aWNlfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbG9nczogc3Rkb3V0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgZ2V0dGluZyBsb2dzIGZvciAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBnZXR0aW5nIGxvZ3M6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IGFsbCBEb2NrZXIgQ29tcG9zZSBpbnN0YW5jZXNcbiAgICAgKi9cbiAgICBhc3luYyBsaXN0SW5zdGFuY2VzKCk6IFByb21pc2U8QXJyYXk8eyBuYW1lOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nOyBpbmZvOiBhbnkgfT4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuICAgICAgICAgICAgbG9nSW5mbygnTGlzdGluZyBpbnN0YW5jZXMgZnJvbSBib3RoIG9kb28gYW5kIHBvc3RncmVzIGRpcmVjdG9yaWVzJyk7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyBzdGF0dXM6IHN0cmluZzsgaW5mbzogYW55IH0+ID0gW107XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGJhc2UgcGF0aCBleGlzdHNcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLnByb2plY3RzUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKCdCYXNlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZ1bmN0aW9uIHRvIHNjYW4gYSBkaXJlY3RvcnkgZm9yIGluc3RhbmNlc1xuICAgICAgICAgICAgY29uc3Qgc2NhbkRpcmVjdG9yeSA9IGFzeW5jIChkaXJQYXRoOiBzdHJpbmcsIGluc3RhbmNlVHlwZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpclBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYCR7aW5zdGFuY2VUeXBlfSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3Q6ICR7ZGlyUGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKTtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCAke2RpcnMubGVuZ3RofSBkaXJlY3RvcmllcyBpbiAke2luc3RhbmNlVHlwZX0gcGF0aGApO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlycykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZURpciA9IHBhdGguam9pbihkaXJQYXRoLCBkaXIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZSA9IHBhdGguam9pbihpbnN0YW5jZURpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvRmlsZSA9IHBhdGguam9pbihpbnN0YW5jZURpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlKSAmJiBmcy5sc3RhdFN5bmMoaW5zdGFuY2VEaXIpLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzdGF0dXMgPSAnVW5rbm93bic7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgaW5mbzogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBwcyAtLWZpbHRlciBcIm5hbWU9JHtkaXJ9XCIgLS1mb3JtYXQgXCJ7ey5TdGF0dXN9fVwiYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gc3Rkb3V0LnRyaW0oKSA/IHN0ZG91dC50cmltKCkgOiAnTm90IHJ1bm5pbmcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSAnTm90IHJ1bm5pbmcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbmZvRmlsZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmZvID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoaW5mb0ZpbGUsICd1dGYtOCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHR5cGUgaW5mb3JtYXRpb24gaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpbmZvLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8udHlwZSA9IGluc3RhbmNlVHlwZSA9PT0gJ29kb28nID8gJ29kb28nIDogJ3Bvc3RncmVzJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8gPSB7IG5hbWU6IGRpciwgZXJyb3I6ICdJbnZhbGlkIGluZm8gZmlsZScsIHR5cGU6IGluc3RhbmNlVHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mbyA9IHsgbmFtZTogZGlyLCB0eXBlOiBpbnN0YW5jZVR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGRpcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mb1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYEFkZGVkICR7aW5zdGFuY2VUeXBlfSBpbnN0YW5jZTogJHtkaXJ9LCBzdGF0dXM6ICR7c3RhdHVzfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gU2NhbiBib3RoIGRpcmVjdG9yaWVzXG4gICAgICAgICAgICBhd2FpdCBzY2FuRGlyZWN0b3J5KHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nKSwgJ29kb28nKTtcbiAgICAgICAgICAgIGF3YWl0IHNjYW5EaXJlY3RvcnkocGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAncG9zdGdyZXMnKSwgJ3Bvc3RncmVzJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgbGlzdGluZyBpbnN0YW5jZXNgLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgUG9zdGdyZVNRTCBjcmVkZW50aWFsc1xuICAgICAqL1xuICAgIGFzeW5jIHVwZGF0ZVBvc3RncmVzQ3JlZGVudGlhbHMoXG4gICAgICAgIGluc3RhbmNlTmFtZTogc3RyaW5nLFxuICAgICAgICBuZXdVc2VybmFtZTogc3RyaW5nLFxuICAgICAgICBuZXdQYXNzd29yZDogc3RyaW5nXG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZzsgdXBkYXRlZEluc3RhbmNlcz86IHN0cmluZ1tdIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBGaW5kIHRoZSBpbnN0YW5jZSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsICdwb3N0Z3JlcycsIGluc3RhbmNlTmFtZSk7XG4gICAgICAgICAgICBsb2dJbmZvKGBVcGRhdGluZyBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRvZXMgbm90IGV4aXN0YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZXQgZXhpc3RpbmcgY29tcG9zZSBmaWxlXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYERvY2tlciBDb21wb3NlIGZpbGUgZm9yICR7aW5zdGFuY2VOYW1lfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbmQgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzXG4gICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIHRoYXQgbmVlZCB1cGRhdGVkIGNyZWRlbnRpYWxzYCk7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBhd2FpdCB0aGlzLmxpc3RJbnN0YW5jZXMoKTtcbiAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdGFuY2UgPT5cbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvICYmXG4gICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mby50eXBlID09PSAnb2RvbycgJiZcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IGluc3RhbmNlTmFtZVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gU3RvcmUgZGVwZW5kZW50IGluc3RhbmNlcyBmb3IgcmVwb3J0aW5nXG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbnROYW1lcyA9IGRlcGVuZGVudEluc3RhbmNlcy5tYXAoaW5zdGFuY2UgPT4gaW5zdGFuY2UubmFtZSk7XG4gICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCAke2RlcGVuZGVudE5hbWVzLmxlbmd0aH0gZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzOiAke2RlcGVuZGVudE5hbWVzLmpvaW4oJywgJykgfHwgJ25vbmUnfWApO1xuXG4gICAgICAgICAgICAvLyBSZWFkIGFuZCB1cGRhdGUgdGhlIGNvbXBvc2UgZmlsZVxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhjb21wb3NlRmlsZVBhdGgsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRDb250ZW50ID0gY29udGVudFxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8tIFBPU1RHUkVTX1BBU1NXT1JEPVteXFxuXSsvZywgYC0gUE9TVEdSRVNfUEFTU1dPUkQ9JHtuZXdQYXNzd29yZH1gKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8tIFBPU1RHUkVTX1VTRVI9W15cXG5dKy9nLCBgLSBQT1NUR1JFU19VU0VSPSR7bmV3VXNlcm5hbWV9YCk7XG5cbiAgICAgICAgICAgIC8vIFdyaXRlIGJhY2sgdXBkYXRlZCBjb250ZW50XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGNvbXBvc2VGaWxlUGF0aCwgdXBkYXRlZENvbnRlbnQsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgaW5zdGFuY2UgaW5mbyBmaWxlXG4gICAgICAgICAgICBjb25zdCBpbmZvRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoaW5mb0ZpbGVQYXRoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZm9Db250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGluZm9GaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gSlNPTi5wYXJzZShpbmZvQ29udGVudCk7XG5cbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgY3JlZGVudGlhbHNcbiAgICAgICAgICAgICAgICBpbmZvLnVzZXJuYW1lID0gbmV3VXNlcm5hbWU7XG4gICAgICAgICAgICAgICAgaW5mby5wYXNzd29yZCA9IG5ld1Bhc3N3b3JkO1xuICAgICAgICAgICAgICAgIGluZm8udXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbmZvRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KGluZm8sIG51bGwsIDIpLCAndXRmOCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZXQgdGhlIGNvbXBvc2UgY29tbWFuZCBmb3IgcmVzdGFydGluZ1xuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG5cbiAgICAgICAgICAgIC8vIFJlc3RhcnQgdGhlIFBvc3RncmVTUUwgY29udGFpbmVyXG4gICAgICAgICAgICBsb2dJbmZvKGBSZXN0YXJ0aW5nIFBvc3RncmVTUUwgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKGBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSBkb3duICYmICR7Y29tcG9zZUNvbW1hbmR9IHVwIC1kYCk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBlYWNoIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkSW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICBjb25zdCBmYWlsZWRVcGRhdGVzID0gW107XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgb2Rvb0luc3RhbmNlIG9mIGRlcGVuZGVudEluc3RhbmNlcykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFVwZGF0aW5nIGNvbmZpZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2U6ICR7b2Rvb0luc3RhbmNlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUGF0aCB0byB0aGUgT2RvbyBpbnN0YW5jZSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Rvb0RpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nLCBvZG9vSW5zdGFuY2UubmFtZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIG9kb28uY29uZiBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RpciA9IHBhdGguam9pbihvZG9vRGlyLCAnY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9kb29Db25mUGF0aCA9IHBhdGguam9pbihjb25maWdEaXIsICdvZG9vLmNvbmYnKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhvZG9vQ29uZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgb2Rvb0NvbmZDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKG9kb29Db25mUGF0aCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIGRhdGFiYXNlIGNyZWRlbnRpYWxzIGluIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9kb29Db25mQ29udGVudCA9IG9kb29Db25mQ29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9kYl91c2VyID0gLiovZywgYGRiX3VzZXIgPSAke25ld1VzZXJuYW1lfWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL2RiX3Bhc3N3b3JkID0gLiovZywgYGRiX3Bhc3N3b3JkID0gJHtuZXdQYXNzd29yZH1gKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV3JpdGUgYmFjayB1cGRhdGVkIG9kb28uY29uZlxuICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhvZG9vQ29uZlBhdGgsIG9kb29Db25mQ29udGVudCwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFVwZGF0ZWQgb2Rvby5jb25mIGZvciAke29kb29JbnN0YW5jZS5uYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgaW5zdGFuY2UtaW5mby5qc29uIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Rvb0luZm9QYXRoID0gcGF0aC5qb2luKG9kb29EaXIsICdpbnN0YW5jZS1pbmZvLmpzb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKG9kb29JbmZvUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvZG9vSW5mbyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG9kb29JbmZvUGF0aCwgJ3V0ZjgnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgUG9zdGdyZVNRTCBjcmVkZW50aWFscyByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9kb29JbmZvLnBnQ3JlZGVudGlhbHMpIG9kb29JbmZvLnBnQ3JlZGVudGlhbHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZG9vSW5mby5wZ0NyZWRlbnRpYWxzLnVzZXJuYW1lID0gbmV3VXNlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Rvb0luZm8ucGdDcmVkZW50aWFscy5wYXNzd29yZCA9IG5ld1Bhc3N3b3JkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9kb29JbmZvLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMob2Rvb0luZm9QYXRoLCBKU09OLnN0cmluZ2lmeShvZG9vSW5mbywgbnVsbCwgMiksICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgVXBkYXRlZCBpbnN0YW5jZS1pbmZvLmpzb24gZm9yICR7b2Rvb0luc3RhbmNlLm5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlc3RhcnQgdGhlIE9kb28gaW5zdGFuY2UgaWYgaXQncyBydW5uaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2Rvb0luc3RhbmNlLnN0YXR1cy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd1cCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUmVzdGFydGluZyBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZTogJHtvZG9vSW5zdGFuY2UubmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtvZG9vRGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGRvd24gJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgU3VjY2Vzc2Z1bGx5IHJlc3RhcnRlZCAke29kb29JbnN0YW5jZS5uYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHJlc3RhcnRFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHJlc3RhcnRpbmcgT2RvbyBpbnN0YW5jZSAke29kb29JbnN0YW5jZS5uYW1lfWAsIHJlc3RhcnRFcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWRVcGRhdGVzLnB1c2goe25hbWU6IG9kb29JbnN0YW5jZS5uYW1lLCBlcnJvcjogJ3Jlc3RhcnQgZmFpbHVyZSd9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBPZG9vIGluc3RhbmNlICR7b2Rvb0luc3RhbmNlLm5hbWV9IGlzIG5vdCBydW5uaW5nLCBubyBuZWVkIHRvIHJlc3RhcnRgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWFyayBhcyBzdWNjZXNzZnVsbHkgdXBkYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZEluc3RhbmNlcy5wdXNoKG9kb29JbnN0YW5jZS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvdWxkIG5vdCBmaW5kIG9kb28uY29uZiBmb3IgJHtvZG9vSW5zdGFuY2UubmFtZX0sIHNraXBwaW5nIHVwZGF0ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkVXBkYXRlcy5wdXNoKHtuYW1lOiBvZG9vSW5zdGFuY2UubmFtZSwgZXJyb3I6ICdtaXNzaW5nIGNvbmZpZ3VyYXRpb24gZmlsZSd9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGluc3RhbmNlRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHVwZGF0aW5nIE9kb28gaW5zdGFuY2UgJHtvZG9vSW5zdGFuY2UubmFtZX1gLCBpbnN0YW5jZUVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgZmFpbGVkVXBkYXRlcy5wdXNoKHtuYW1lOiBvZG9vSW5zdGFuY2UubmFtZSwgZXJyb3I6ICdnZW5lcmFsIGVycm9yJ30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUHJlcGFyZSBkZXRhaWxlZCBzdWNjZXNzIG1lc3NhZ2VcbiAgICAgICAgICAgIGxldCBzdWNjZXNzTWVzc2FnZSA9IGBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5IGZvciAke2luc3RhbmNlTmFtZX0uYDtcblxuICAgICAgICAgICAgaWYgKHVwZGF0ZWRJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3NNZXNzYWdlICs9IGAgVXBkYXRlZCAke3VwZGF0ZWRJbnN0YW5jZXMubGVuZ3RofSBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZShzKTogJHt1cGRhdGVkSW5zdGFuY2VzLmpvaW4oJywgJyl9LmA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmYWlsZWRVcGRhdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWROYW1lcyA9IGZhaWxlZFVwZGF0ZXMubWFwKGYgPT4gZi5uYW1lKS5qb2luKCcsICcpO1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3NNZXNzYWdlICs9IGAgRmFpbGVkIHRvIHVwZGF0ZSAke2ZhaWxlZFVwZGF0ZXMubGVuZ3RofSBpbnN0YW5jZShzKTogJHtmYWlsZWROYW1lc30uYDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHN1Y2Nlc3NNZXNzYWdlLFxuICAgICAgICAgICAgICAgIHVwZGF0ZWRJbnN0YW5jZXNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgdXBkYXRpbmcgUG9zdGdyZVNRTCBjcmVkZW50aWFsc2AsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIHVwZGF0aW5nIGNyZWRlbnRpYWxzOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIE9kb28gaW5zdGFuY2Ugd2l0aCBEb2NrZXIgQ29tcG9zZVxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUluc3RhbmNlKFxuICAgICAgICBpbnN0YW5jZU5hbWU6IHN0cmluZyxcbiAgICAgICAgdmVyc2lvbjogc3RyaW5nLFxuICAgICAgICBlZGl0aW9uPzogc3RyaW5nLFxuICAgICAgICBhZG1pblBhc3N3b3JkPzogc3RyaW5nLFxuICAgICAgICBkYkZpbHRlcj86IGJvb2xlYW4sXG4gICAgICAgIHBvcnQ/OiBudW1iZXIsXG4gICAgICAgIGN1c3RvbUltYWdlPzogYm9vbGVhbixcbiAgICAgICAgY3VzdG9tSW1hZ2VOYW1lPzogc3RyaW5nLFxuICAgICAgICBwb3N0Z3Jlc0luc3RhbmNlPzogc3RyaW5nLFxuICAgICAgICBwZ1VzZXI/OiBzdHJpbmcsXG4gICAgICAgIHBnUGFzc3dvcmQ/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nOyBwb3J0PzogbnVtYmVyIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0YXJ0aW5nIE9kb28gaW5zdGFuY2UgY3JlYXRpb246ICR7aW5zdGFuY2VOYW1lfSwgdmVyc2lvbjogJHt2ZXJzaW9ufSwgZWRpdGlvbjogJHtlZGl0aW9ufWApO1xuXG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgd2UncmUgdXNpbmcgdGhlIGNvcnJlY3QgcGF0aFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIExvZyB3aGVyZSBmaWxlcyB3aWxsIGJlIHNhdmVkXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycsIGluc3RhbmNlTmFtZSk7XG4gICAgICAgICAgICBsb2dJbmZvKGBGaWxlcyB3aWxsIGJlIHNhdmVkIHRvOiAke3Byb2plY3REaXJ9YCk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIERvY2tlciBpcyBydW5uaW5nXG4gICAgICAgICAgICBpZiAoIWF3YWl0IHRoaXMuY2hlY2tEb2NrZXIoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnRG9ja2VyIGlzIG5vdCBydW5uaW5nLiBQbGVhc2Ugc3RhcnQgRG9ja2VyIGFuZCB0cnkgYWdhaW4uJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBFbnN1cmUgbmV0d29yayBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmxvYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgY29uc3QgbmV0d29ya05hbWUgPSBzZXR0aW5ncz8ubmV0d29yayB8fCAnb2Rvby1uZXR3b3JrJztcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5lbnN1cmVOZXR3b3JrRXhpc3RzKG5ldHdvcmtOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgRmFpbGVkIHRvIGNyZWF0ZSBvciB2ZXJpZnkgbmV0d29yayAke25ldHdvcmtOYW1lfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgUG9zdGdyZVNRTCBpbnN0YW5jZVxuICAgICAgICAgICAgaWYgKCFwb3N0Z3Jlc0luc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdQb3N0Z3JlU1FMIGluc3RhbmNlIGlzIHJlcXVpcmVkJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgaWYgUG9zdGdyZVNRTCBpbnN0YW5jZSBleGlzdHMgYW5kIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHBnU3RhdHVzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBwcyAtLWZpbHRlciBcIm5hbWU9JHtwb3N0Z3Jlc0luc3RhbmNlfVwiIC0tZm9ybWF0IFwie3suU3RhdHVzfX1cImApO1xuICAgICAgICAgICAgICAgIGlmICghcGdTdGF0dXMgfHwgIXBnU3RhdHVzLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3VwJykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBQb3N0Z3JlU1FMIGluc3RhbmNlICR7cG9zdGdyZXNJbnN0YW5jZX0gaXMgbm90IHJ1bm5pbmcuIFBsZWFzZSBzdGFydCBpdCBmaXJzdC5gIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGNoZWNraW5nIFBvc3RncmVTUUwgc3RhdHVzYCwgZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtwb3N0Z3Jlc0luc3RhbmNlfSBub3QgZm91bmQgb3Igbm90IGFjY2Vzc2libGUuYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgbGlua2VkIGluc3RhbmNlcyBjb3VudFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBMaXN0IGFsbCBpbnN0YW5jZXMgdG8gZmluZCBsaW5rZWQgb25lc1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IGF3YWl0IHRoaXMubGlzdEluc3RhbmNlcygpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmtlZEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdCA9PlxuICAgICAgICAgICAgICAgICAgICBpbnN0LmluZm8gJiYgaW5zdC5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IHBvc3RncmVzSW5zdGFuY2VcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgaWYgKGxpbmtlZEluc3RhbmNlcy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtwb3N0Z3Jlc0luc3RhbmNlfSBhbHJlYWR5IGhhcyA0IGxpbmtlZCBPZG9vIGluc3RhbmNlcy4gUGxlYXNlIHVzZSBhbm90aGVyIFBvc3RncmVTUUwgaW5zdGFuY2UuYCB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCAke2xpbmtlZEluc3RhbmNlcy5sZW5ndGh9IE9kb28gaW5zdGFuY2VzIGxpbmtlZCB0byAke3Bvc3RncmVzSW5zdGFuY2V9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY2hlY2tpbmcgbGlua2VkIGluc3RhbmNlcyBjb3VudGAsIGVycik7XG4gICAgICAgICAgICAgICAgLy8gQ29udGludWUgYW55d2F5LCBqdXN0IGxvZyB0aGUgZXJyb3JcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgcG9ydCBhdmFpbGFiaWxpdHlcbiAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRQb3J0ID0gcG9ydCB8fCA4MDY5O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gYXdhaXQgdGhpcy5jaGVja1BvcnRBdmFpbGFiaWxpdHkoZGVmYXVsdFBvcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBwcm9qZWN0IGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEluc3RhbmNlIGRpcmVjdG9yeSBhbHJlYWR5IGV4aXN0czogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGFscmVhZHkgZXhpc3RzYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBwcm9qZWN0IGRpcmVjdG9yeTogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgY29uZmlnIGRpcmVjdG9yeSBmb3Igb2Rvby5jb25mXG4gICAgICAgICAgICBjb25zdCBjb25maWdEaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2NvbmZpZycpO1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKGNvbmZpZ0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhZGRvbnMgZGlyZWN0b3J5XG4gICAgICAgICAgICBjb25zdCBhZGRvbnNEaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2FkZG9ucycpO1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKGFkZG9uc0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBvZG9vLmNvbmYgZmlsZSB3aXRoIHRoZSBwcm9wZXIgY29uZmlndXJhdGlvblxuICAgICAgICAgICAgY29uc3Qgb2Rvb0NvbmZQYXRoID0gcGF0aC5qb2luKGNvbmZpZ0RpciwgJ29kb28uY29uZicpO1xuICAgICAgICAgICAgY29uc3QgZGJGaWx0ZXJTdHIgPSBkYkZpbHRlciA/IGBcXG5kYmZpbHRlciA9IF4ke2luc3RhbmNlTmFtZX0uKiRgIDogJyc7XG5cbiAgICAgICAgICAgIC8vIFVzZSBwcm92aWRlZCBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIG9yIGRlZmF1bHRzXG4gICAgICAgICAgICBjb25zdCBwZ1VzZXJWYWwgPSBwZ1VzZXIgfHwgJ3Bvc3RncmVzJztcbiAgICAgICAgICAgIGNvbnN0IHBnUGFzc3dvcmRWYWwgPSBwZ1Bhc3N3b3JkIHx8ICdwb3N0Z3Jlcyc7XG5cbiAgICAgICAgICAgIGNvbnN0IG1ham9yVmVyc2lvbiA9IHZlcnNpb24uc3BsaXQoJy4nKVswXTtcblxuICAgICAgICAgICAgY29uc3QgYWRkb25zUGF0aFN0ciA9IGVkaXRpb24gPT09ICdFbnRlcnByaXNlJ1xuICAgICAgICAgICAgICAgID8gYC9tbnQvZXh0cmEtYWRkb25zLCAvbW50L2VudGVycHJpc2UtYWRkb25zLyR7bWFqb3JWZXJzaW9ufWBcbiAgICAgICAgICAgICAgICA6IGAvbW50L2V4dHJhLWFkZG9uc2A7XG5cbiAgICAgICAgICAgIGNvbnN0IG9kb29Db25mQ29udGVudCA9IGBbb3B0aW9uc11cbmFkZG9uc19wYXRoID0gJHthZGRvbnNQYXRoU3RyfVxuZGF0YV9kaXIgPSAvdmFyL2xpYi9vZG9vXG5hZG1pbl9wYXNzd2QgPSAke2FkbWluUGFzc3dvcmR9JHtkYkZpbHRlclN0cn1cbmRiX2hvc3QgPSAke3Bvc3RncmVzSW5zdGFuY2V9XG5kYl9wYXNzd29yZCA9ICR7cGdQYXNzd29yZFZhbH1cbmRiX3BvcnQgPSA1NDMyXG5kYl90ZW1wbGF0ZSA9IHRlbXBsYXRlMFxuZGJfdXNlciA9ICR7cGdVc2VyVmFsfVxubGlzdF9kYiA9IFRydWVcbmA7XG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBvZG9vLmNvbmZgKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMob2Rvb0NvbmZQYXRoLCBvZG9vQ29uZkNvbnRlbnQsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgRG9ja2VyIGltYWdlIHRvIHVzZVxuICAgICAgICAgICAgY29uc3QgZG9ja2VySW1hZ2UgPSBjdXN0b21JbWFnZSAmJiBjdXN0b21JbWFnZU5hbWVcbiAgICAgICAgICAgICAgICA/IGBvZG9vLWN1c3RvbToke2N1c3RvbUltYWdlTmFtZX1gXG4gICAgICAgICAgICAgICAgOiBgb2Rvbzoke3ZlcnNpb259YDtcblxuICAgICAgICAgICAgbG9nSW5mbyhgVXNpbmcgRG9ja2VyIGltYWdlOiAke2RvY2tlckltYWdlfWApO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgRG9ja2VyIENvbXBvc2UgZmlsZVxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbnRlbnQgPSBgXG5zZXJ2aWNlczpcbiAgb2RvbzpcbiAgICBpbWFnZTogJHtkb2NrZXJJbWFnZX1cbiAgICBjb250YWluZXJfbmFtZTogJHtpbnN0YW5jZU5hbWV9XG4gICAgcG9ydHM6XG4gICAgICAtIFwiJHtwb3J0fTo4MDY5XCJcbiAgICB2b2x1bWVzOlxuICAgICAgLSAke2luc3RhbmNlTmFtZX1fZGF0YTovdmFyL2xpYi9vZG9vXG4gICAgICAtIC4vY29uZmlnOi9ldGMvb2Rvb1xuICAgICAgLSAuL2FkZG9uczovbW50L2V4dHJhLWFkZG9uc1xuJHtlZGl0aW9uID09PSAnRW50ZXJwcmlzZScgPyBgICAgICAgLSAke3RoaXMucHJvamVjdHNQYXRofS9lbnRlcnByaXNlX2FkZG9ucy8ke21ham9yVmVyc2lvbn06L21udC9lbnRlcnByaXNlLWFkZG9ucy8ke21ham9yVmVyc2lvbn1gIDogJyd9XG4gICAgZW52aXJvbm1lbnQ6XG4gICAgICAtIFBPU1RHUkVTX1VTRVI9JHtwZ1VzZXJWYWx9XG4gICAgICAtIFBPU1RHUkVTX1BBU1NXT1JEPSR7cGdQYXNzd29yZFZhbH1cbiAgICAgIC0gUE9TVEdSRVNfSE9TVD0ke3Bvc3RncmVzSW5zdGFuY2V9XG4gICAgICAtIFBPU1RHUkVTX1BPUlQ9NTQzMlxuICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkXG4gICAgbmV0d29ya3M6XG4gICAgICAtICR7bmV0d29ya05hbWV9XG4gICAgZXh0ZXJuYWxfbGlua3M6XG4gICAgICAtICR7cG9zdGdyZXNJbnN0YW5jZX06JHtwb3N0Z3Jlc0luc3RhbmNlfVxuXG5uZXR3b3JrczpcbiAgJHtuZXR3b3JrTmFtZX06XG4gICAgZXh0ZXJuYWw6IHRydWVcblxudm9sdW1lczpcbiAgJHtpbnN0YW5jZU5hbWV9X2RhdGE6XG4gICAgZHJpdmVyOiBsb2NhbFxuYDtcblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUZpbGVQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsICdkb2NrZXItY29tcG9zZS55bWwnKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFdyaXRpbmcgRG9ja2VyIENvbXBvc2UgZmlsZSB0byAke2NvbXBvc2VGaWxlUGF0aH1gKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoY29tcG9zZUZpbGVQYXRoLCBjb21wb3NlQ29udGVudCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgLy8gVmVyaWZ5IGlmIGVudGVycHJpc2VfYWRkb25zIGRpcmVjdG9yeSBleGlzdHMgYW5kIHdhcm4gaWYgbm90XG4gICAgICAgICAgICBjb25zdCBlbnRlcnByaXNlQWRkb25zRGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnZW50ZXJwcmlzZV9hZGRvbnMnLCB2ZXJzaW9uKTtcbiAgICAgICAgICAgIGlmIChlZGl0aW9uID09PSAnRW50ZXJwcmlzZScgJiYgIWZzLmV4aXN0c1N5bmMoZW50ZXJwcmlzZUFkZG9uc0RpcikpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBFbnRlcnByaXNlIGFkZG9ucyBkaXJlY3Rvcnkgbm90IGZvdW5kOiAke2VudGVycHJpc2VBZGRvbnNEaXJ9YCk7XG5cbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGRpcmVjdG9yeSBzbyBEb2NrZXIgQ29tcG9zZSBkb2Vzbid0IGZhaWxcbiAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoZW50ZXJwcmlzZUFkZG9uc0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBZGQgYSBSRUFETUUgZmlsZSB0byBleHBsYWluIHdoYXQgdG8gZG9cbiAgICAgICAgICAgICAgICBjb25zdCByZWFkbWVQYXRoID0gcGF0aC5qb2luKGVudGVycHJpc2VBZGRvbnNEaXIsICdSRUFETUUudHh0Jyk7XG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhyZWFkbWVQYXRoLCBgVGhpcyBkaXJlY3Rvcnkgc2hvdWxkIGNvbnRhaW4gT2RvbyBFbnRlcnByaXNlIGFkZG9ucyBmb3IgdmVyc2lvbiAke3ZlcnNpb259LlxuSWYgeW91IGhhdmUgYWNjZXNzIHRvIE9kb28gRW50ZXJwcmlzZSByZXBvc2l0b3J5LCBwbGVhc2UgY2xvbmUgb3IgY29weSB0aG9zZSBhZGRvbnMgdG8gdGhpcyBsb2NhdGlvbi5gLCAndXRmOCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgaW5zdGFuY2UgaW5mbyBmaWxlXG4gICAgICAgICAgICBjb25zdCBpbmZvRmlsZSA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnaW5zdGFuY2UtaW5mby5qc29uJyk7XG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBpbnN0YW5jZSBpbmZvIGZpbGU6ICR7aW5mb0ZpbGV9YCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdvZG9vJyxcbiAgICAgICAgICAgICAgICB2ZXJzaW9uLFxuICAgICAgICAgICAgICAgIGVkaXRpb24sXG4gICAgICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgICAgICBhZG1pblBhc3N3b3JkLFxuICAgICAgICAgICAgICAgIGRiRmlsdGVyLFxuICAgICAgICAgICAgICAgIGN1c3RvbUltYWdlOiAhIShjdXN0b21JbWFnZSAmJiBjdXN0b21JbWFnZU5hbWUpLFxuICAgICAgICAgICAgICAgIGN1c3RvbUltYWdlTmFtZTogY3VzdG9tSW1hZ2UgJiYgY3VzdG9tSW1hZ2VOYW1lID8gY3VzdG9tSW1hZ2VOYW1lIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHBvc3RncmVzSW5zdGFuY2UsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5mb0ZpbGUsIEpTT04uc3RyaW5naWZ5KGluZm8sIG51bGwsIDIpLCAndXRmOCcpO1xuXG4gICAgICAgICAgICAvLyBTdGFydCB0aGUgY29udGFpbmVyXG4gICAgICAgICAgICBsb2dJbmZvKGBTdGFydGluZyBPZG9vIGNvbnRhaW5lcmApO1xuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgRXhlY3V0aW5nOiBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSB1cCAtZGApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcblxuICAgICAgICAgICAgICAgIGlmIChzdGRvdXQpIGxvZ0luZm8oYERvY2tlciBDb21wb3NlIHN0ZG91dDogJHtzdGRvdXR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0ZGVycikgbG9nSW5mbyhgRG9ja2VyIENvbXBvc2Ugc3RkZXJyOiAke3N0ZGVycn1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHN0YXJ0aW5nIGNvbnRhaW5lcmAsIGVycm9yKTtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBnZXQgbW9yZSBlcnJvciBkZXRhaWxzXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGxvZ3MgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gbG9nc2ApO1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgbG9nczogJHtsb2dzfWApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb3VsZG4ndCBnZXQgY29udGFpbmVyIGxvZ3NgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBzdGFydGluZyBjb250YWluZXI6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgdGhlIGNvbnRhaW5lciBpcyBydW5uaW5nXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFZlcmlmeWluZyBjb250YWluZXIgaXMgcnVubmluZ2ApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBjb250YWluZXJTdGF0dXMgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIHBzIC0tZmlsdGVyIFwibmFtZT0ke2luc3RhbmNlTmFtZX1cIiAtLWZvcm1hdCBcInt7LlN0YXR1c319XCJgKTtcblxuICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBzdGF0dXM6ICR7Y29udGFpbmVyU3RhdHVzfWApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFjb250YWluZXJTdGF0dXMuaW5jbHVkZXMoJ1VwJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIG1heSBub3QgYmUgcnVubmluZyBjb3JyZWN0bHlgKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBHZXQgY29udGFpbmVyIGxvZ3MgZm9yIGRlYnVnZ2luZ1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGNvbnRhaW5lckxvZ3MgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIGxvZ3MgJHtpbnN0YW5jZU5hbWV9IC0tdGFpbCAyMGApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIGxvZ3M6ICR7Y29udGFpbmVyTG9nc31gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb3VsZG4ndCBnZXQgY29udGFpbmVyIGxvZ3NgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSwgLy8gU3RpbGwgcmV0dXJuIHN1Y2Nlc3Mgc2luY2UgZmlsZXMgd2VyZSBjcmVhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgT2RvbyBpbnN0YW5jZSBjcmVhdGVkLCBidXQgY29udGFpbmVyIG1heSBub3QgYmUgcnVubmluZyBjb3JyZWN0bHkuIENoZWNrIGxvZ3MuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvcnRcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjaGVja2luZyBjb250YWluZXIgc3RhdHVzYCwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2dJbmZvKGBTdWNjZXNzZnVsbHkgY3JlYXRlZCBPZG9vIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgT2RvbyBpbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHkgb24gcG9ydCAke3BvcnR9IWAsXG4gICAgICAgICAgICAgICAgcG9ydFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjcmVhdGluZyBPZG9vIGluc3RhbmNlICR7aW5zdGFuY2VOYW1lfWAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIGNyZWF0aW5nIGluc3RhbmNlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgRG9ja2VyQ29tcG9zZVNlcnZpY2UoKTsiLCIvLyBzcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlLnRzXG5pbXBvcnQgeyBkaWFsb2csIGlwY01haW4sIElwY01haW5JbnZva2VFdmVudCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBkb2NrZXJDb21wb3NlU2VydmljZSBmcm9tICcuLi9kb2NrZXIvZG9ja2VyQ29tcG9zZVNlcnZpY2UnO1xuaW1wb3J0IHsgbG9nSW5mbywgbG9nRXJyb3IgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4vLyBEZWZpbmUgdHlwZXMgZm9yIHRoZSBvcGVyYXRpb25zXG5pbnRlcmZhY2UgRG9ja2VyT3BlcmF0aW9uUGFyYW1zIHtcbiAgICBpbnN0YW5jZU5hbWU/OiBzdHJpbmc7XG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICBlZGl0aW9uPzogc3RyaW5nO1xuICAgIGFkbWluUGFzc3dvcmQ/OiBzdHJpbmc7XG4gICAgZGJGaWx0ZXI/OiBib29sZWFuO1xuICAgIHNlcnZpY2U/OiBzdHJpbmc7XG4gICAgdGFpbD86IG51bWJlcjtcbiAgICBrZWVwRmlsZXM/OiBib29sZWFuO1xuICAgIG5ldHdvcmtOYW1lPzogc3RyaW5nO1xuICAgIGluc3RhbmNlVHlwZT86IHN0cmluZztcbiAgICBwb3J0PzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgRG9ja2VyT3BlcmF0aW9uUmVxdWVzdCB7XG4gICAgb3BlcmF0aW9uOiBzdHJpbmc7XG4gICAgcGFyYW1zOiBEb2NrZXJPcGVyYXRpb25QYXJhbXM7XG59XG5cbmludGVyZmFjZSBFcnJvckRpYWxvZ09wdGlvbnMge1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIFNhZmUgaGFuZGxlciByZWdpc3RyYXRpb24gLSBjaGVja3MgaWYgYSBoYW5kbGVyIGV4aXN0cyBiZWZvcmUgcmVnaXN0ZXJpbmdcbiAqIEBwYXJhbSBjaGFubmVsIElQQyBjaGFubmVsIG5hbWVcbiAqIEBwYXJhbSBoYW5kbGVyIEZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgSVBDIHJlcXVlc3RcbiAqL1xuZnVuY3Rpb24gc2FmZVJlZ2lzdGVySGFuZGxlcjxULCBSPihjaGFubmVsOiBzdHJpbmcsIGhhbmRsZXI6IChldmVudDogSXBjTWFpbkludm9rZUV2ZW50LCBhcmc6IFQpID0+IFByb21pc2U8Uj4gfCBSKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgYSBoYW5kbGVyIGFscmVhZHkgZXhpc3RzIGZvciB0aGlzIGNoYW5uZWxcbiAgICAgICAgY29uc3QgaGFuZGxlcnMgPSAoaXBjTWFpbiBhcyBhbnkpLl9pbnZva2VIYW5kbGVycztcbiAgICAgICAgaWYgKGhhbmRsZXJzICYmIGhhbmRsZXJzLmhhcyAmJiBoYW5kbGVycy5oYXMoY2hhbm5lbCkpIHtcbiAgICAgICAgICAgIGxvZ0luZm8oYElQQyBoYW5kbGVyIGFscmVhZHkgZXhpc3RzIGZvciBjaGFubmVsOiAke2NoYW5uZWx9LCBub3QgcmVnaXN0ZXJpbmcgYWdhaW5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdlIGNhbid0IGNoZWNrIHByb3Blcmx5LCB0cnkgYSBtb3JlIHJlbGlhYmxlIHdheVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaXBjTWFpbi5oYW5kbGUoY2hhbm5lbCwgaGFuZGxlcik7XG4gICAgICAgICAgICBsb2dJbmZvKGBSZWdpc3RlcmVkIElQQyBoYW5kbGVyOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBpZiAoKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlLmluY2x1ZGVzKCdzZWNvbmQgaGFuZGxlcicpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgSGFuZGxlciBhbHJlYWR5IGV4aXN0cyBmb3IgY2hhbm5lbDogJHtjaGFubmVsfSwgc2tpcHBpbmcgcmVnaXN0cmF0aW9uYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yOyAvLyBSZS10aHJvdyB1bmV4cGVjdGVkIGVycm9yc1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nRXJyb3IoYEVycm9yIHdoaWxlIHRyeWluZyB0byByZWdpc3RlciBoYW5kbGVyIGZvciAke2NoYW5uZWx9YCwgZXJyb3IpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBJbml0aWFsaXplIGFsbCBJUEMgaGFuZGxlcnMgZm9yIHRoZSBtYWluIHByb2Nlc3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVJcGNIYW5kbGVycygpOiB2b2lkIHtcbiAgICBsb2dJbmZvKCdJbml0aWFsaXppbmcgSVBDIGhhbmRsZXJzJyk7XG5cbiAgICAvLyBEb2NrZXIgb3BlcmF0aW9uIGhhbmRsZXIgd2l0aCBpbXByb3ZlZCBsb2dnaW5nIGFuZCBlcnJvciBoYW5kbGluZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RG9ja2VyT3BlcmF0aW9uUmVxdWVzdCwgYW55PignZG9ja2VyLW9wZXJhdGlvbicsIGFzeW5jIChfZXZlbnQsIHsgb3BlcmF0aW9uLCBwYXJhbXMgfSkgPT4ge1xuICAgICAgICBsb2dJbmZvKGBFeGVjdXRpbmcgRG9ja2VyIG9wZXJhdGlvbjogJHtvcGVyYXRpb259YCwgcGFyYW1zKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHJlc3VsdDtcblxuICAgICAgICAgICAgc3dpdGNoIChvcGVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICBjYXNlICdjaGVjay1kb2NrZXInOlxuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKCdDaGVja2luZyBEb2NrZXInKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuY2hlY2tEb2NrZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdzdGFydC1pbnN0YW5jZSc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLnN0YXJ0SW5zdGFuY2UocGFyYW1zLmluc3RhbmNlTmFtZSB8fCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnc3RvcC1pbnN0YW5jZSc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLnN0b3BJbnN0YW5jZShwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdkZWxldGUtaW5zdGFuY2UnOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5kZWxldGVJbnN0YW5jZShwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnLCBwYXJhbXMua2VlcEZpbGVzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdnZXQtbG9ncyc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmdldExvZ3MoXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnNlcnZpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMudGFpbFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2xpc3QtaW5zdGFuY2VzJzpcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbygnTGlzdGluZyBpbnN0YW5jZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UubGlzdEluc3RhbmNlcygpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2Vuc3VyZS1uZXR3b3JrJzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuZW5zdXJlTmV0d29ya0V4aXN0cyhwYXJhbXM/Lm5ldHdvcmtOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gRG9ja2VyIG9wZXJhdGlvbjogJHtvcGVyYXRpb259YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYERvY2tlciBvcGVyYXRpb24gY29tcGxldGVkOiAke29wZXJhdGlvbn1gLCB7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGV4ZWN1dGluZyBEb2NrZXIgb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBPcGVyYXRpb24gZmFpbGVkOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBTaG93IGVycm9yIGRpYWxvZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RXJyb3JEaWFsb2dPcHRpb25zLCB2b2lkPignc2hvdy1lcnJvci1kaWFsb2cnLCAoX2V2ZW50LCB7IHRpdGxlLCBtZXNzYWdlIH0pID0+IHtcbiAgICAgICAgbG9nRXJyb3IoYFNob3dpbmcgZXJyb3IgZGlhbG9nOiAke3RpdGxlfWAsIG1lc3NhZ2UpO1xuICAgICAgICBkaWFsb2cuc2hvd0Vycm9yQm94KHRpdGxlLCBtZXNzYWdlKTtcbiAgICB9KTtcblxuICAgIC8vIFNob3cgbWVzc2FnZSBkaWFsb2dcbiAgICBzYWZlUmVnaXN0ZXJIYW5kbGVyPEVsZWN0cm9uLk1lc3NhZ2VCb3hPcHRpb25zLCBFbGVjdHJvbi5NZXNzYWdlQm94UmV0dXJuVmFsdWU+KCdzaG93LW1lc3NhZ2UtZGlhbG9nJywgYXN5bmMgKF9ldmVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBsb2dJbmZvKCdTaG93aW5nIG1lc3NhZ2UgZGlhbG9nJywgeyB0aXRsZTogb3B0aW9ucy50aXRsZSB9KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveChvcHRpb25zKTtcbiAgICB9KTtcblxuICAgIC8vIFNob3cgc2F2ZSBkaWFsb2dcbiAgICBzYWZlUmVnaXN0ZXJIYW5kbGVyPEVsZWN0cm9uLlNhdmVEaWFsb2dPcHRpb25zLCBFbGVjdHJvbi5TYXZlRGlhbG9nUmV0dXJuVmFsdWU+KCdzaG93LXNhdmUtZGlhbG9nJywgYXN5bmMgKF9ldmVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBsb2dJbmZvKCdTaG93aW5nIHNhdmUgZGlhbG9nJywgeyB0aXRsZTogb3B0aW9ucy50aXRsZSB9KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93U2F2ZURpYWxvZyhvcHRpb25zKTtcbiAgICB9KTtcblxuICAgIC8vIFNob3cgb3BlbiBkaWFsb2dcbiAgICBzYWZlUmVnaXN0ZXJIYW5kbGVyPEVsZWN0cm9uLk9wZW5EaWFsb2dPcHRpb25zLCBFbGVjdHJvbi5PcGVuRGlhbG9nUmV0dXJuVmFsdWU+KCdzaG93LW9wZW4tZGlhbG9nJywgYXN5bmMgKF9ldmVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBsb2dJbmZvKCdTaG93aW5nIG9wZW4gZGlhbG9nJywgeyB0aXRsZTogb3B0aW9ucy50aXRsZSB9KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93T3BlbkRpYWxvZyhvcHRpb25zKTtcbiAgICB9KTtcblxuICAgIGxvZ0luZm8oJ0lQQyBoYW5kbGVycyBpbml0aWFsaXphdGlvbiBjb21wbGV0ZScpO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIGFwcGxpY2F0aW9uIGFuZCBwZXJmb3JtIHN0YXJ0dXAgdGFza3NcbiAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGluaXRpYWxpemF0aW9uIGlzIGNvbXBsZXRlXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGxvZ0luZm8oJ0luaXRpYWxpemluZyBhcHBsaWNhdGlvbicpO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIERvY2tlciBpcyBydW5uaW5nXG4gICAgICAgIGNvbnN0IGRvY2tlclJ1bm5pbmcgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5jaGVja0RvY2tlcigpO1xuICAgICAgICBpZiAoIWRvY2tlclJ1bm5pbmcpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdEb2NrZXIgaXMgbm90IHJ1bm5pbmchJyk7XG4gICAgICAgICAgICAvLyBUaGlzIHdpbGwgYmUgaGFuZGxlZCBieSB0aGUgc3BsYXNoIHNjcmVlblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5zdXJlIE9kb28gbmV0d29yayBleGlzdHNcbiAgICAgICAgYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuZW5zdXJlTmV0d29ya0V4aXN0cygpO1xuXG4gICAgICAgIGxvZ0luZm8oJ0FwcGxpY2F0aW9uIGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseScpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gaW5pdGlhbGl6ZSBhcHBsaWNhdGlvbicsIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKSk7XG4gICAgICAgIHRocm93IGVycm9yOyAvLyBSZS10aHJvdyB0byBhbGxvdyBjYWxsZXIgdG8gaGFuZGxlIHRoZSBlcnJvclxuICAgIH1cbn0iLCJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuXG4vLyBQYXRoIHRvIHN0b3JlIHRoZSBsb2NrIGZpbGVcbmNvbnN0IGdldExvY2tGaWxlUGF0aCA9ICgpID0+IHtcbiAgICByZXR1cm4gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpLCAnbG9nZ2VyLWxvY2suanNvbicpO1xufTtcblxuLy8gV3JpdGUgY3VycmVudCBsb2cgZmlsZSBpbmZvIHRvIGxvY2sgZmlsZVxuZXhwb3J0IGZ1bmN0aW9uIHNldExvZ0ZpbGVMb2NrKGxvZ0ZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBsb2NrRmlsZVBhdGggPSBnZXRMb2NrRmlsZVBhdGgoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHsgXG4gICAgICAgICAgICBhY3RpdmVMb2dGaWxlOiBsb2dGaWxlUGF0aCwgXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHZlcnNpb246IDIsIC8vIFZlcnNpb24gdG8gaWRlbnRpZnkgc2luZ2xlIGxvZyBmaWxlIHN0cmF0ZWd5XG4gICAgICAgIH07XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMobG9ja0ZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3cml0aW5nIGxvZ2dlciBsb2NrIGZpbGU6JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLy8gUmVhZCBjdXJyZW50IGxvZyBmaWxlIGluZm8gZnJvbSBsb2NrIGZpbGVcbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2dGaWxlTG9jaygpOiBzdHJpbmcgfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBsb2NrRmlsZVBhdGggPSBnZXRMb2NrRmlsZVBhdGgoKTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9ja0ZpbGVQYXRoKSkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGxvY2tGaWxlUGF0aCkpO1xuXG4gICAgICAgICAgICAvLyBXaXRoIHRoZSBuZXcgc2luZ2xlIGxvZyBmaWxlIGFwcHJvYWNoLCB3ZSBhbHdheXMgd2FudCB0byB1c2VcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGxvZyBmaWxlLCBzbyB3ZSBkb24ndCBuZWVkIHRvIGNoZWNrIGZvciBzdGFsZW5lc3MgYW55bW9yZVxuICAgICAgICAgICAgLy8gV2UganVzdCBuZWVkIHRvIGVuc3VyZSB0aGUgcGF0aCBleGlzdHNcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgdGhlIHBhdGggZXhpc3RzXG4gICAgICAgICAgICBpZiAoZGF0YS5hY3RpdmVMb2dGaWxlICYmIGZzLmV4aXN0c1N5bmMoZGF0YS5hY3RpdmVMb2dGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmFjdGl2ZUxvZ0ZpbGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBsb2cgZmlsZSBkb2Vzbid0IGV4aXN0LCBjcmVhdGUgaXRzIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIGlmIChkYXRhLmFjdGl2ZUxvZ0ZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ0RpciA9IHBhdGguZGlybmFtZShkYXRhLmFjdGl2ZUxvZ0ZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGxvZ0RpcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMobG9nRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZGlyRXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjcmVhdGluZyBsb2cgZGlyZWN0b3J5OicsIGRpckVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJlYWRpbmcgbG9nZ2VyIGxvY2sgZmlsZTonLCBlcnIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59IiwiaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBzaGVsbCwgaXBjTWFpbiwgZGlhbG9nLCBNZW51LCBuZXQsIE5vdGlmaWNhdGlvbiB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgeyBpbml0aWFsaXplSXBjSGFuZGxlcnMsIGluaXRpYWxpemVBcHAgfSBmcm9tICcuLi9zcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlJztcbmltcG9ydCBkb2NrZXJDb21wb3NlU2VydmljZSBmcm9tICcuLi9zcmMvc2VydmljZXMvZG9ja2VyL2RvY2tlckNvbXBvc2VTZXJ2aWNlJztcbmltcG9ydCBzZXR0aW5nc1NlcnZpY2UgZnJvbSBcIi4uL3NyYy9zZXJ2aWNlcy9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2VcIjtcbmltcG9ydCB7IHNldExvZ0ZpbGVMb2NrLCBnZXRMb2dGaWxlTG9jayB9IGZyb20gJy4vbG9nZ2VyLWxvY2snO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbi8vIERvY2tlciBwYXRoIGVuaGFuY2VtZW50IHRvIGVuc3VyZSBEb2NrZXIgY29tbWFuZHMgd29ya1xuLy8gVGhpcyBmaXhlcyB0aGUgXCJkb2NrZXI6IGNvbW1hbmQgbm90IGZvdW5kXCIgaXNzdWUgb24gbWFjT1NcbmZ1bmN0aW9uIGVuaGFuY2VEb2NrZXJQYXRoKCkge1xuICB0cnkge1xuICAgIC8vIERvY2tlciBwYXRoIGNvbmZpZ3VyYXRpb24gZm9yIGRpZmZlcmVudCBwbGF0Zm9ybXNcbiAgICBjb25zdCBET0NLRVJfUEFUSF9DT05GSUcgPSB7XG4gICAgICBkYXJ3aW46IFtcbiAgICAgICAgJy91c3IvbG9jYWwvYmluJyxcbiAgICAgICAgJy9vcHQvaG9tZWJyZXcvYmluJyxcbiAgICAgICAgJy9BcHBsaWNhdGlvbnMvRG9ja2VyLmFwcC9Db250ZW50cy9SZXNvdXJjZXMvYmluJyxcbiAgICAgICAgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJy5kb2NrZXIvYmluJylcbiAgICAgIF0sXG4gICAgICBsaW51eDogW1xuICAgICAgICAnL3Vzci9iaW4nLFxuICAgICAgICAnL3Vzci9sb2NhbC9iaW4nXG4gICAgICBdLFxuICAgICAgd2luMzI6IFtcbiAgICAgICAgJ0M6XFxcXFByb2dyYW0gRmlsZXNcXFxcRG9ja2VyXFxcXERvY2tlclxcXFxyZXNvdXJjZXNcXFxcYmluJyxcbiAgICAgICAgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0FwcERhdGFcXFxcTG9jYWxcXFxcRG9ja2VyXFxcXERvY2tlclxcXFxyZXNvdXJjZXNcXFxcYmluJylcbiAgICAgIF1cbiAgICB9O1xuXG4gICAgY29uc3QgcGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtIGFzICdkYXJ3aW4nIHwgJ2xpbnV4JyB8ICd3aW4zMic7XG4gICAgY29uc3QgcG9zc2libGVQYXRocyA9IERPQ0tFUl9QQVRIX0NPTkZJR1twbGF0Zm9ybV0gfHwgW107XG4gICAgXG4gICAgLy8gRmlsdGVyIHBhdGhzIHRoYXQgYWN0dWFsbHkgZXhpc3RcbiAgICBjb25zdCBleGlzdGluZ1BhdGhzID0gcG9zc2libGVQYXRocy5maWx0ZXIocCA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gZnMuZXhpc3RzU3luYyhwKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICAvLyBHZXQgY3VycmVudCBQQVRIXG4gICAgY29uc3QgY3VycmVudFBhdGggPSBwcm9jZXNzLmVudi5QQVRIIHx8ICcnO1xuICAgIFxuICAgIC8vIENyZWF0ZSBuZXcgUEFUSCB3aXRoIHBsYXRmb3JtLXNwZWNpZmljIHNlcGFyYXRvclxuICAgIGNvbnN0IHBhdGhTZXBhcmF0b3IgPSBwbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6JztcbiAgICBjb25zdCBlbmhhbmNlZFBhdGggPSBbLi4uZXhpc3RpbmdQYXRocywgY3VycmVudFBhdGhdLmpvaW4ocGF0aFNlcGFyYXRvcik7XG4gICAgXG4gICAgLy8gU2V0IHRoZSBlbmhhbmNlZCBQQVRIXG4gICAgcHJvY2Vzcy5lbnYuUEFUSCA9IGVuaGFuY2VkUGF0aDtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgRW5oYW5jZWQgUEFUSCBmb3IgRG9ja2VyIGNvbW1hbmRzOiAke3Byb2Nlc3MuZW52LlBBVEh9YCk7XG4gICAgcmV0dXJuIGVuaGFuY2VkUGF0aDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBlbmhhbmNpbmcgRG9ja2VyIFBBVEg6JywgZXJyb3IpO1xuICAgIHJldHVybiBwcm9jZXNzLmVudi5QQVRIIHx8ICcnO1xuICB9XG59XG5cbi8vIEFwcGx5IHRoZSBEb2NrZXIgUEFUSCBlbmhhbmNlbWVudCBpbW1lZGlhdGVseVxuZW5oYW5jZURvY2tlclBhdGgoKTtcblxuLy8gR2V0IGFwcCBkaXJlY3RvcnkgLSBmb3IgYm90aCBDb21tb25KUyBhbmQgRVNNIGVudmlyb25tZW50c1xubGV0IGFwcERpciA9ICcnO1xudHJ5IHtcbiAgLy8gVHJ5IHJlZ3VsYXIgZGlybmFtZSBmaXJzdCAoQ29tbW9uSlMpXG4gIGFwcERpciA9IF9fZGlybmFtZTtcbiAgY29uc29sZS5sb2coJ1VzaW5nIENvbW1vbkpTIF9fZGlybmFtZTonLCBhcHBEaXIpO1xufSBjYXRjaCAoZSkge1xuICAvLyBJZiB0aGF0IGZhaWxzLCB0cnkgdG8gdXNlIGFwcC5nZXRBcHBQYXRoKCkgYXMgZmFsbGJhY2tcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZygnQ29tbW9uSlMgX19kaXJuYW1lIG5vdCBhdmFpbGFibGUsIHVzaW5nIGZhbGxiYWNrJyk7XG4gICAgYXBwRGlyID0gYXBwLmdldEFwcFBhdGgoKTtcbiAgICBjb25zb2xlLmxvZygnVXNpbmcgYXBwIHBhdGggZmFsbGJhY2s6JywgYXBwRGlyKTtcbiAgfSBjYXRjaCAoZTIpIHtcbiAgICAvLyBMYXN0IHJlc29ydCAtIHVzZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XG4gICAgY29uc29sZS5lcnJvcignQm90aCBfX2Rpcm5hbWUgYW5kIGFwcC5nZXRBcHBQYXRoKCkgZmFpbGVkOicsIGUyKTtcbiAgICBhcHBEaXIgPSBwcm9jZXNzLmN3ZCgpO1xuICAgIGNvbnNvbGUubG9nKCdVc2luZyBjd2QgZmFsbGJhY2s6JywgYXBwRGlyKTtcbiAgfVxufVxuXG4vLyBMb2cgdGhlIGVudmlyb25tZW50IGFuZCBwYXRocyBmb3IgZWFzaWVyIGRlYnVnZ2luZ1xuY29uc29sZS5sb2coJ05vZGUgZW52aXJvbm1lbnQ6JywgcHJvY2Vzcy5lbnYuTk9ERV9FTlYpO1xuY29uc29sZS5sb2coJ0N1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnk6JywgcHJvY2Vzcy5jd2QoKSk7XG5jb25zb2xlLmxvZygnQXBwIGRpcmVjdG9yeTonLCBhcHBEaXIpO1xuXG5sZXQgQUNUSVZFX0xPR19GSUxFOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuLy8gTG9nIHJvdGF0aW9uIGNvbmZpZ3VyYXRpb25cbmNvbnN0IExPR19GSUxFX1NJWkVfTElNSVQgPSA1ICogMTAyNCAqIDEwMjQ7IC8vIDUgTUIgaW4gYnl0ZXNcbmNvbnN0IE1BWF9MT0dfRklMRVMgPSA1OyAvLyBNYXhpbXVtIG51bWJlciBvZiByb3RhdGVkIGxvZyBmaWxlcyB0byBrZWVwXG5cblxuLy8gU2ltcGxlIGlubGluZSBsb2dnZXIgZm9yIHRoZSBtYWluIHByb2Nlc3NcbmNvbnN0IGxvZ0luZm8gPSAobWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KSA9PiB7XG4gIGNvbnN0IGxvZ01lc3NhZ2UgPSBgWyR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygpfV0gW0lORk9dICR7bWVzc2FnZX0ke2RhdGEgPyAnICcgKyBKU09OLnN0cmluZ2lmeShkYXRhKSA6ICcnfWA7XG4gIGNvbnNvbGUubG9nKGxvZ01lc3NhZ2UpO1xuICBhcHBlbmRUb0xvZ0ZpbGUobG9nTWVzc2FnZSk7XG59O1xuXG5jb25zdCBsb2dFcnJvciA9IChtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogYW55KSA9PiB7XG4gIGxldCBlcnJvclN0ciA9ICcnO1xuICBpZiAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgZXJyb3JTdHIgPSBgXFxuJHtlcnJvci5zdGFjayB8fCBlcnJvci5tZXNzYWdlfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGVycm9yU3RyID0gYFxcbiR7SlNPTi5zdHJpbmdpZnkoZXJyb3IpfWA7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgZXJyb3JTdHIgPSBgXFxuJHtTdHJpbmcoZXJyb3IpfWA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbG9nTWVzc2FnZSA9IGBbJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCl9XSBbRVJST1JdICR7bWVzc2FnZX0ke2Vycm9yU3RyfWA7XG4gIGNvbnNvbGUuZXJyb3IobG9nTWVzc2FnZSk7XG4gIGFwcGVuZFRvTG9nRmlsZShsb2dNZXNzYWdlKTtcbn07XG5cbi8vIEdldCBsb2cgZmlsZSBwYXRoXG5mdW5jdGlvbiBnZXRMb2dGaWxlUGF0aCgpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhcHBEYXRhUGF0aCA9IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgIGxldCB3b3JrRGlyUGF0aCA9IG51bGw7XG5cbiAgICAvLyBUcnkgdG8gZ2V0IHdvcmsgZGlyZWN0b3J5IHBhdGhcbiAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICd3b3JrZGlyLmpzb24nKTtcbiAgICBpZiAoZnMuZXhpc3RzU3luYyh3b3JrRGlyRmlsZVBhdGgpKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMod29ya0RpckZpbGVQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgIHdvcmtEaXJQYXRoID0gZGF0YS53b3JrRGlyO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHBhcnNpbmcgd29ya2Rpci5qc29uOicsIGVycik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGxvZ3MgZGlyZWN0b3J5XG4gICAgY29uc3QgbG9nc1BhdGggPSB3b3JrRGlyUGF0aCA/IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ2xvZ3MnKSA6IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ2xvZ3MnKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nc1BhdGgpKSB7XG4gICAgICBmcy5ta2RpclN5bmMobG9nc1BhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIC8vIFVzaW5nIGEgZml4ZWQgbG9nIGZpbGUgbmFtZSBpbnN0ZWFkIG9mIHRpbWVzdGFtcC1iYXNlZFxuICAgIHJldHVybiBwYXRoLmpvaW4obG9nc1BhdGgsICdhcHAubG9nJyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgbG9nIGZpbGUgcGF0aDonLCBlcnIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8vIEdsb2JhbCBsb2cgZmlsZSBwYXRoXG5sZXQgbG9nRmlsZVBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4vLyBJbml0aWFsaXplIGxvZyBmaWxlXG5mdW5jdGlvbiBpbml0TG9nRmlsZSgpIHtcbiAgdHJ5IHtcbiAgICBsb2dGaWxlUGF0aCA9IGdldExvZ0ZpbGVQYXRoKCk7XG4gICAgaWYgKGxvZ0ZpbGVQYXRoKSB7XG4gICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nRmlsZVBhdGgpKSB7XG4gICAgICAgIC8vIENyZWF0ZSBuZXcgbG9nIGZpbGUgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICBjb25zdCBpbml0aWFsTWVzc2FnZSA9XG4gICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgIGBPZG9vIE1hbmFnZXIgLSBBcHBsaWNhdGlvbiBMb2cgKE1haW4gUHJvY2VzcylcXG5gICtcbiAgICAgICAgICAgIGBTdGFydGVkOiAke25ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcoKX1cXG5gICtcbiAgICAgICAgICAgIGBFbnZpcm9ubWVudDogJHtwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAndW5rbm93bid9XFxuYCArXG4gICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gO1xuXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMobG9nRmlsZVBhdGgsIGluaXRpYWxNZXNzYWdlKTtcbiAgICAgICAgY29uc29sZS5sb2coYExvZyBmaWxlIGNyZWF0ZWQgYXQ6ICR7bG9nRmlsZVBhdGh9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBBZGQgYSBzZXNzaW9uIHNlcGFyYXRvciB0byBleGlzdGluZyBsb2cgZmlsZVxuICAgICAgICBjb25zdCBzZXNzaW9uTWVzc2FnZSA9XG4gICAgICAgICAgICBgXFxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gICtcbiAgICAgICAgICAgIGBTZXNzaW9uIHN0YXJ0ZWQ6ICR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygpfVxcbmAgK1xuICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICAgICAgXG4gICAgICAgIC8vIENoZWNrIGlmIGxvZyBmaWxlIG5lZWRzIHJvdGF0aW9uIGJlZm9yZSBhcHBlbmRpbmdcbiAgICAgICAgY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk7XG4gICAgICAgIFxuICAgICAgICBmcy5hcHBlbmRGaWxlU3luYyhsb2dGaWxlUGF0aCwgc2Vzc2lvbk1lc3NhZ2UpO1xuICAgICAgICBjb25zb2xlLmxvZyhgVXNpbmcgZXhpc3RpbmcgbG9nIGZpbGUgYXQ6ICR7bG9nRmlsZVBhdGh9YCk7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbml0aWFsaXppbmcgbG9nIGZpbGU6JywgZXJyKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIGxvZyBmaWxlIG5lZWRzIHJvdGF0aW9uIGJhc2VkIG9uIHNpemVcbiAqIEByZXR1cm5zIHRydWUgaWYgbG9nIHJvdGF0aW9uIHdhcyBwZXJmb3JtZWQsIGZhbHNlIG90aGVyd2lzZVxuICovXG5mdW5jdGlvbiBjaGVja0FuZFJvdGF0ZUxvZ0ZpbGUoKTogYm9vbGVhbiB7XG4gIGlmICghbG9nRmlsZVBhdGggfHwgIWZzLmV4aXN0c1N5bmMobG9nRmlsZVBhdGgpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGxvZ0ZpbGVQYXRoKTtcbiAgICBpZiAoc3RhdHMuc2l6ZSA8IExPR19GSUxFX1NJWkVfTElNSVQpIHtcbiAgICAgIHJldHVybiBmYWxzZTsgLy8gTm8gcm90YXRpb24gbmVlZGVkXG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYExvZyBmaWxlIHNpemUgKCR7c3RhdHMuc2l6ZX0gYnl0ZXMpIGV4Y2VlZHMgbGltaXQgKCR7TE9HX0ZJTEVfU0laRV9MSU1JVH0gYnl0ZXMpLCByb3RhdGluZyBsb2dzLi4uYCk7XG4gICAgXG4gICAgLy8gR2V0IHRoZSBsb2dzIGRpcmVjdG9yeVxuICAgIGNvbnN0IGxvZ3NEaXIgPSBwYXRoLmRpcm5hbWUobG9nRmlsZVBhdGgpO1xuICAgIFxuICAgIC8vIEdldCBleGlzdGluZyByb3RhdGVkIGxvZyBmaWxlc1xuICAgIGNvbnN0IGJhc2VMb2dOYW1lID0gcGF0aC5iYXNlbmFtZShsb2dGaWxlUGF0aCwgJy5sb2cnKTtcbiAgICBjb25zdCByb3RhdGVkTG9ncyA9IGZzLnJlYWRkaXJTeW5jKGxvZ3NEaXIpXG4gICAgICAuZmlsdGVyKGYgPT4gZi5zdGFydHNXaXRoKGAke2Jhc2VMb2dOYW1lfS5gKSAmJiBmLmVuZHNXaXRoKCcubG9nJykpXG4gICAgICAuc29ydCgpOyAvLyBTb3J0IHRvIGZpbmQgaGlnaGVzdCByb3RhdGlvbiBudW1iZXJcbiAgICBcbiAgICAvLyBTaGlmdCBvbGRlciBsb2dzIHRvIG1ha2Ugcm9vbSBmb3IgbmV3IHJvdGF0aW9uXG4gICAgZm9yIChsZXQgaSA9IHJvdGF0ZWRMb2dzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IHJvdGF0ZWRMb2dzW2ldLm1hdGNoKG5ldyBSZWdFeHAoYCR7YmFzZUxvZ05hbWV9XFwuKFxcZCspXFwubG9nYCkpO1xuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uTnVtYmVyID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgaWYgKHJvdGF0aW9uTnVtYmVyID49IE1BWF9MT0dfRklMRVMgLSAxKSB7XG4gICAgICAgICAgLy8gRGVsZXRlIHRoZSBvbGRlc3QgbG9nIGZpbGUgaWYgd2UgYWxyZWFkeSBoYXZlIG1heCBudW1iZXIgb2Ygcm90YXRpb25zXG4gICAgICAgICAgY29uc3Qgb2xkZXN0TG9nID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICBmcy51bmxpbmtTeW5jKG9sZGVzdExvZyk7XG4gICAgICAgICAgY29uc29sZS5sb2coYERlbGV0ZWQgb2xkIGxvZyBmaWxlOiAke29sZGVzdExvZ31gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZW5hbWUgdG8gdGhlIG5leHQgcm90YXRpb24gbnVtYmVyXG4gICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IHBhdGguam9pbihsb2dzRGlyLCByb3RhdGVkTG9nc1tpXSk7XG4gICAgICAgICAgY29uc3QgbmV3UGF0aCA9IHBhdGguam9pbihsb2dzRGlyLCBgJHtiYXNlTG9nTmFtZX0uJHtyb3RhdGlvbk51bWJlciArIDF9LmxvZ2ApO1xuICAgICAgICAgIGZzLnJlbmFtZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFJvdGF0ZWQgbG9nIGZpbGU6ICR7b2xkUGF0aH0gLT4gJHtuZXdQYXRofWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIFJlbmFtZSB0aGUgY3VycmVudCBsb2cgZmlsZSB0byBiZSAuMS5sb2dcbiAgICBjb25zdCByb3RhdGVkTG9nUGF0aCA9IHBhdGguam9pbihsb2dzRGlyLCBgJHtiYXNlTG9nTmFtZX0uMS5sb2dgKTtcbiAgICBmcy5yZW5hbWVTeW5jKGxvZ0ZpbGVQYXRoLCByb3RhdGVkTG9nUGF0aCk7XG4gICAgY29uc29sZS5sb2coYFJvdGF0ZWQgbWFpbiBsb2cgZmlsZTogJHtsb2dGaWxlUGF0aH0gLT4gJHtyb3RhdGVkTG9nUGF0aH1gKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgYSBuZXcgZW1wdHkgbG9nIGZpbGVcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IGluaXRpYWxNZXNzYWdlID1cbiAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgYE9kb28gTWFuYWdlciAtIEFwcGxpY2F0aW9uIExvZyAoUm90YXRlZClcXG5gICtcbiAgICAgIGBTdGFydGVkOiAke25vdy50b0xvY2FsZVN0cmluZygpfVxcbmAgK1xuICAgICAgYEVudmlyb25tZW50OiAke3Byb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICd1bmtub3duJ31cXG5gICtcbiAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG4gICAgZnMud3JpdGVGaWxlU3luYyhsb2dGaWxlUGF0aCwgaW5pdGlhbE1lc3NhZ2UpO1xuICAgIFxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciByb3RhdGluZyBsb2cgZmlsZTonLCBlcnIpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vLyBBcHBlbmQgdG8gbG9nIGZpbGVcbmZ1bmN0aW9uIGFwcGVuZFRvTG9nRmlsZShtZXNzYWdlOiBzdHJpbmcpIHtcbiAgaWYgKCFsb2dGaWxlUGF0aCkgcmV0dXJuO1xuXG4gIHRyeSB7XG4gICAgLy8gQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmVmb3JlIGFwcGVuZGluZ1xuICAgIGNoZWNrQW5kUm90YXRlTG9nRmlsZSgpO1xuICAgIFxuICAgIGZzLmFwcGVuZEZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCBtZXNzYWdlICsgJ1xcbicpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3cml0aW5nIHRvIGxvZyBmaWxlOicsIGVycik7XG4gIH1cbn1cblxuLy8gTG9nIGNsZWFudXAgZnVuY3Rpb25hbGl0eSByZW1vdmVkIGFzIGxvZyByb3RhdGlvbiBoYW5kbGVzIHRoaXMgbm93XG5cbi8vIFNldCBhcHBsaWNhdGlvbiBtZXRhZGF0YVxuYXBwLnNldE5hbWUoJ29kb28tbWFuYWdlcicpO1xuYXBwLnNldEFib3V0UGFuZWxPcHRpb25zKHtcbiAgYXBwbGljYXRpb25OYW1lOiAnT2RvbyBNYW5hZ2VyJyxcbiAgYXBwbGljYXRpb25WZXJzaW9uOiBhcHAuZ2V0VmVyc2lvbigpLFxuICB2ZXJzaW9uOiBhcHAuZ2V0VmVyc2lvbigpLFxuICBjb3B5cmlnaHQ6ICfCqSAyMDI1IFdlYkdyYXBoaXgnLFxuICBhdXRob3JzOiBbJ1dlYkdyYXBoaXgnXSxcbiAgd2Vic2l0ZTogJ2h0dHBzOi8vb2Rvby53ZWJncmFwaGl4Lm9ubGluZScsXG4gIGNyZWRpdHM6ICdQcm9mZXNzaW9uYWwgT2RvbyBpbnN0YW5jZSBtYW5hZ2VtZW50IHRvb2wgZm9yIERvY2tlciBlbnZpcm9ubWVudHMnXG59KTtcblxuLy8gR2xvYmFsIGRlY2xhcmF0aW9ucyBmb3IgVHlwZVNjcmlwdFxuZGVjbGFyZSBnbG9iYWwge1xuICB2YXIgYWxsb3dTcGxhc2hDbG9zZTogYm9vbGVhbjtcbiAgdmFyIGNvbWluZ0Zyb21TZXR1cDogYm9vbGVhbjtcbiAgdmFyIGN1cnJlbnRUaGVtZU1vZGU6IHN0cmluZyB8IG51bGw7XG4gIHZhciB0aGVtZVVwZGF0ZUluUHJvZ3Jlc3M6IGJvb2xlYW47XG59XG5cbi8vIEluaXRpYWxpemUgZ2xvYmFsIHZhcmlhYmxlc1xuZ2xvYmFsLmFsbG93U3BsYXNoQ2xvc2UgPSBmYWxzZTtcbmdsb2JhbC5jb21pbmdGcm9tU2V0dXAgPSBmYWxzZTtcbmdsb2JhbC5jdXJyZW50VGhlbWVNb2RlID0gbnVsbDtcbmdsb2JhbC50aGVtZVVwZGF0ZUluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuLy8gRGVmaW5lIGludGVyZmFjZSBmb3IgaXBjTWFpbiB3aXRoIGhhbmRsZXJzIHByb3BlcnR5XG5pbnRlcmZhY2UgSXBjTWFpbldpdGhIYW5kbGVycyBleHRlbmRzIEVsZWN0cm9uLklwY01haW4ge1xuICBoYW5kbGVycz86IFJlY29yZDxzdHJpbmcsIChldmVudDogRWxlY3Ryb24uSXBjTWFpbkludm9rZUV2ZW50LCAuLi5hcmdzOiBhbnlbXSkgPT4gUHJvbWlzZTxhbnk+Pjtcbn1cblxuLy8gQ2FzdCBpcGNNYWluIHRvIG91ciBleHRlbmRlZCBpbnRlcmZhY2VcbmNvbnN0IHR5cGVkSXBjTWFpbiA9IGlwY01haW4gYXMgSXBjTWFpbldpdGhIYW5kbGVycztcblxuaXBjTWFpbi5vbigncmVnaXN0ZXItbG9nLWZpbGUnLCAoX2V2ZW50LCBsb2dGaWxlUGF0aCkgPT4ge1xuICB0cnkge1xuICAgIGlmICghQUNUSVZFX0xPR19GSUxFICYmIGxvZ0ZpbGVQYXRoICYmIGZzLmV4aXN0c1N5bmMobG9nRmlsZVBhdGgpKSB7XG4gICAgICBBQ1RJVkVfTE9HX0ZJTEUgPSBsb2dGaWxlUGF0aDtcbiAgICAgIHNldExvZ0ZpbGVMb2NrKGxvZ0ZpbGVQYXRoKTtcbiAgICAgIGxvZ0luZm8oYFJlZ2lzdGVyZWQgYWN0aXZlIGxvZyBmaWxlOiAke2xvZ0ZpbGVQYXRofWApO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgcmVnaXN0ZXJpbmcgbG9nIGZpbGU6JywgZXJyKTtcbiAgfVxufSk7XG5cbmlwY01haW4uaGFuZGxlKCdnZXQtYWN0aXZlLWxvZy1maWxlJywgKCkgPT4ge1xuICB0cnkge1xuICAgIC8vIEFsd2F5cyBnZXQgZnJlc2ggZnJvbSBsb2NrIGZpbGUgdG8gZW5zdXJlIHdlJ3JlIG5vdCB1c2luZyBhIHN0YWxlIGxvY2tcbiAgICBBQ1RJVkVfTE9HX0ZJTEUgPSBnZXRMb2dGaWxlTG9jaygpO1xuICAgIHJldHVybiBBQ1RJVkVfTE9HX0ZJTEU7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgYWN0aXZlIGxvZyBmaWxlOicsIGVycik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn0pO1xuXG4vLyBHZXQgbG9nIGZpbGUgcGF0aCBoYW5kbGVyXG5pcGNNYWluLmhhbmRsZSgnZ2V0LWxvZy1maWxlLXBhdGgnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgYXBwRGF0YVBhdGggPSBhcHAuZ2V0UGF0aCgndXNlckRhdGEnKTtcbiAgICBsZXQgd29ya0RpclBhdGggPSBudWxsO1xuICAgIFxuICAgIC8vIFRyeSB0byBnZXQgd29yayBkaXJlY3RvcnkgcGF0aFxuICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ3dvcmtkaXIuanNvbicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgd29ya0RpclBhdGggPSBkYXRhLndvcmtEaXI7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHBhcnNpbmcgd29ya2Rpci5qc29uJywgZXJyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gR2V0IHRoZSBsb2dzIGRpcmVjdG9yeVxuICAgIGNvbnN0IGxvZ3NQYXRoID0gd29ya0RpclBhdGggJiYgZnMuZXhpc3RzU3luYyh3b3JrRGlyUGF0aCkgXG4gICAgICA/IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ2xvZ3MnKSBcbiAgICAgIDogcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnbG9ncycpO1xuICAgIFxuICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dzUGF0aCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBcbiAgICAvLyBBbHdheXMgcmV0dXJuIHRoZSBtYWluIGFwcC5sb2cgZmlsZSBpZiBpdCBleGlzdHNcbiAgICBjb25zdCBtYWluTG9nUGF0aCA9IHBhdGguam9pbihsb2dzUGF0aCwgJ2FwcC5sb2cnKTtcbiAgICBpZiAoZnMuZXhpc3RzU3luYyhtYWluTG9nUGF0aCkpIHtcbiAgICAgIHJldHVybiBtYWluTG9nUGF0aDtcbiAgICB9XG4gICAgXG4gICAgLy8gQXMgYSBmYWxsYmFjaywgZ2V0IHRoZSBtb3N0IHJlY2VudCBsb2cgZmlsZVxuICAgIGNvbnN0IGxvZ0ZpbGVzID0gZnMucmVhZGRpclN5bmMobG9nc1BhdGgpXG4gICAgICAuZmlsdGVyKGZpbGUgPT4gZmlsZS5lbmRzV2l0aCgnLmxvZycpKVxuICAgICAgLm1hcChmaWxlID0+IHBhdGguam9pbihsb2dzUGF0aCwgZmlsZSkpO1xuICAgIFxuICAgIGlmIChsb2dGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBcbiAgICAvLyBTb3J0IGJ5IGZpbGUgY3JlYXRpb24gdGltZSAobW9zdCByZWNlbnQgZmlyc3QpXG4gICAgcmV0dXJuIGxvZ0ZpbGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IHN0YXRBID0gZnMuc3RhdFN5bmMoYSk7XG4gICAgICBjb25zdCBzdGF0QiA9IGZzLnN0YXRTeW5jKGIpO1xuICAgICAgcmV0dXJuIHN0YXRCLmJpcnRodGltZU1zIC0gc3RhdEEuYmlydGh0aW1lTXM7XG4gICAgfSlbMF07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nRXJyb3IoJ0Vycm9yIGluIGdldC1sb2ctZmlsZS1wYXRoIGhhbmRsZXInLCBlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn0pO1xuXG4vLyBPcGVuIGxvZyBmaWxlIGhhbmRsZXJcbmlwY01haW4uaGFuZGxlKCdvcGVuLWxvZy1maWxlJywgYXN5bmMgKF9ldmVudCwgeyBsb2dGaWxlUGF0aCB9KSA9PiB7XG4gIHRyeSB7XG4gICAgaWYgKCFsb2dGaWxlUGF0aCB8fCAhZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICAgIGxvZ0Vycm9yKGBMb2cgZmlsZSBub3QgZm91bmQ6ICR7bG9nRmlsZVBhdGh9YCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgYXdhaXQgc2hlbGwub3BlblBhdGgobG9nRmlsZVBhdGgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBvcGVuLWxvZy1maWxlIGhhbmRsZXInLCBlcnJvcik7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59KTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGVtaXQgbWFpbi13aW5kb3ctdmlzaWJsZSBldmVudFxuZnVuY3Rpb24gZW1pdE1haW5XaW5kb3dWaXNpYmxlKHdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IG51bGwgfCB1bmRlZmluZWQpIHtcbiAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAod2luZG93ICYmICF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ21haW4td2luZG93LXZpc2libGUnKTtcbiAgICB9XG4gIH0sIDIwMCk7XG59XG5cbi8vIEhhbmRsZSBhcHAgdGVybWluYXRpb24gd2l0aCBjb25maXJtYXRpb24gd2hlbiBuZWVkZWRcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUFwcFRlcm1pbmF0aW9uKG1haW5XaW5kb3c6IEJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQgfCBudWxsKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmICghbWFpbldpbmRvdyB8fCBtYWluV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICByZXR1cm4gdHJ1ZTsgLy8gQWxsb3cgdGVybWluYXRpb24gaWYgd2luZG93IGRvZXNuJ3QgZXhpc3RcbiAgfVxuXG4gIHRyeSB7XG4gICAgLy8gQ3JlYXRlIGEgcHJvbWlzZSB0aGF0IHdpbGwgcmVzb2x2ZSBiYXNlZCBvbiBJUEMgY29tbXVuaWNhdGlvblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgLy8gU2V0IHVwIGEgb25lLXRpbWUgbGlzdGVuZXIgZm9yIHRoZSByZXNwb25zZVxuICAgICAgY29uc3QgcmVzcG9uc2VIYW5kbGVyID0gKF9ldmVudDogYW55LCB7IGNhblRlcm1pbmF0ZSwgYWxyZWFkeUNvbmZpcm1lZCB9OiB7IGNhblRlcm1pbmF0ZTogYm9vbGVhbiwgYWxyZWFkeUNvbmZpcm1lZD86IGJvb2xlYW4gfSkgPT4ge1xuICAgICAgICBpcGNNYWluLnJlbW92ZUxpc3RlbmVyKCdleGl0LWNvbmZpcm1hdGlvbi1yZXNwb25zZScsIHJlc3BvbnNlSGFuZGxlcik7XG4gICAgICAgIFxuICAgICAgICAvLyBJZiBhbHJlYWR5IGNvbmZpcm1lZCBieSByZW5kZXJlciAodXNlciBjbGlja2VkIFwiRXhpdCBBbnl3YXlcIiksIHdlIGRvbid0IG5lZWQgZnVydGhlciBjaGVja3NcbiAgICAgICAgaWYgKGFscmVhZHlDb25maXJtZWQpIHtcbiAgICAgICAgICBsb2dJbmZvKCdFeGl0IGFscmVhZHkgY29uZmlybWVkIGJ5IHVzZXIsIGFsbG93aW5nIHRlcm1pbmF0aW9uJyk7XG4gICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJlc29sdmUoY2FuVGVybWluYXRlKTtcbiAgICAgIH07XG5cbiAgICAgIGlwY01haW4ub25jZSgnZXhpdC1jb25maXJtYXRpb24tcmVzcG9uc2UnLCByZXNwb25zZUhhbmRsZXIpO1xuXG4gICAgICAvLyBTZW5kIHRoZSByZXF1ZXN0IHRvIGNoZWNrIGlmIHRlcm1pbmF0aW9uIGlzIGFsbG93ZWRcbiAgICAgIG1haW5XaW5kb3cud2ViQ29udGVudHMuc2VuZCgnY2hlY2stcnVubmluZy1jb250YWluZXJzJyk7XG5cbiAgICAgIC8vIFNldCBhIHRpbWVvdXQgaW4gY2FzZSB3ZSBkb24ndCBnZXQgYSByZXNwb25zZVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGlwY01haW4ucmVtb3ZlTGlzdGVuZXIoJ2V4aXQtY29uZmlybWF0aW9uLXJlc3BvbnNlJywgcmVzcG9uc2VIYW5kbGVyKTtcbiAgICAgICAgbG9nSW5mbygnTm8gcmVzcG9uc2UgZnJvbSByZW5kZXJlciBhYm91dCBydW5uaW5nIGNvbnRhaW5lcnMsIGFsbG93aW5nIHRlcm1pbmF0aW9uJyk7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICB9LCAyMDAwKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgZm9yIHJ1bm5pbmcgY29udGFpbmVycycsIGVycm9yKTtcbiAgICByZXR1cm4gdHJ1ZTsgLy8gSW4gY2FzZSBvZiBlcnJvciwgYWxsb3cgdGVybWluYXRpb25cbiAgfVxufVxuXG4vLyBIZWxwZXIgZnVuY3Rpb24gZm9yIGRldmVsb3BtZW50IGVudmlyb25tZW50XG5mdW5jdGlvbiBsb2FkQW5kU2hvd0RldldpbmRvdyh3aW5kb3c6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cpIHtcbiAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcblxuICB3aW5kb3cubG9hZFVSTCgnaHR0cDovL2xvY2FsaG9zdDo1MTczLyMvbWFpbicpLnRoZW4oKCkgPT4ge1xuICAgIGlmICghd2luZG93IHx8IHdpbmRvdy5pc0Rlc3Ryb3llZCgpKSByZXR1cm47XG4gICAgd2luZG93LnNob3coKTtcbiAgICB3aW5kb3cuZm9jdXMoKTtcbiAgICBlbWl0TWFpbldpbmRvd1Zpc2libGUod2luZG93KTtcbiAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgbWFpbiBVUkwnLCBlcnIpO1xuICAgIGlmICghd2luZG93IHx8IHdpbmRvdy5pc0Rlc3Ryb3llZCgpKSByZXR1cm47XG4gICAgd2luZG93LnNob3coKTtcbiAgICB3aW5kb3cuZm9jdXMoKTtcbiAgICBlbWl0TWFpbldpbmRvd1Zpc2libGUod2luZG93KTtcbiAgfSk7XG5cbiAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgIHdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgfVxufVxuXG4vLyBIZWxwZXIgZnVuY3Rpb24gZm9yIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRcbmZ1bmN0aW9uIGxvYWRBbmRTaG93UHJvZFdpbmRvdyh3aW5kb3c6IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cpIHtcbiAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcblxuICAvLyBVc2UgcGF0aC5yZXNvbHZlIGZvciBjb25zaXN0ZW50IHBhdGggcmVzb2x1dGlvblxuICBjb25zdCBodG1sUGF0aCA9IHBhdGgucmVzb2x2ZShhcHBEaXIsICcuLi9kaXN0L2luZGV4Lmh0bWwnKTtcbiAgbG9nSW5mbyhgTG9hZGluZyBtYWluIGZpbGUgZnJvbTogJHtodG1sUGF0aH1gKTtcbiAgXG4gIHdpbmRvdy5sb2FkRmlsZShodG1sUGF0aCwgeyBoYXNoOiAnbWFpbicgfSkudGhlbigoKSA9PiB7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KS5jYXRjaChlcnIgPT4ge1xuICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBtYWluIGZpbGUnLCBlcnIpO1xuICAgIGlmICghd2luZG93IHx8IHdpbmRvdy5pc0Rlc3Ryb3llZCgpKSByZXR1cm47XG4gICAgd2luZG93LnNob3coKTtcbiAgICB3aW5kb3cuZm9jdXMoKTtcbiAgICBlbWl0TWFpbldpbmRvd1Zpc2libGUod2luZG93KTtcbiAgfSk7XG59XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzYWZlbHkgbG9hZCBhbmQgc2hvdyBhIHdpbmRvdyBiYXNlZCBvbiB0aGUgZW52aXJvbm1lbnRcbmZ1bmN0aW9uIGxvYWRBbmRTaG93V2luZG93KHdpbmRvdzogQnJvd3NlcldpbmRvdyB8IG51bGwgfCB1bmRlZmluZWQpIHtcbiAgaWYgKCF3aW5kb3cpIHtcbiAgICBsb2dFcnJvcignQ2Fubm90IGxvYWQgYW5kIHNob3cgYSBudWxsIG9yIHVuZGVmaW5lZCB3aW5kb3chJyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgbG9hZEFuZFNob3dEZXZXaW5kb3cod2luZG93KTtcbiAgfSBlbHNlIHtcbiAgICBsb2FkQW5kU2hvd1Byb2RXaW5kb3cod2luZG93KTtcbiAgfVxufVxuXG4vLyBTdG9yZSB3aW5kb3cgcmVmZXJlbmNlcyB0byBwcmV2ZW50IGdhcmJhZ2UgY29sbGVjdGlvblxuaW50ZXJmYWNlIFdpbmRvd3NSZWdpc3RyeSB7XG4gIHNwbGFzaD86IEJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQ7XG4gIG1haW4/OiBCcm93c2VyV2luZG93IHwgdW5kZWZpbmVkO1xuICBzZXR1cD86IEJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQ7XG4gIFtrZXk6IHN0cmluZ106IEJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQ7XG59XG5cbi8vIFdpbmRvdyBjb25maWd1cmF0aW9uIGJ5IHR5cGVcbmludGVyZmFjZSBXaW5kb3dDb25maWcge1xuICB3aWR0aDogbnVtYmVyO1xuICBoZWlnaHQ6IG51bWJlcjtcbiAgcmVzaXphYmxlOiBib29sZWFuO1xuICBtaW5XaWR0aD86IG51bWJlcjtcbiAgbWluSGVpZ2h0PzogbnVtYmVyO1xuICB0aXRsZTogc3RyaW5nO1xufVxuXG4vLyBEZWZpbmUgZGVmYXVsdCB3aW5kb3cgY29uZmlndXJhdGlvbnNcbmNvbnN0IHdpbmRvd0NvbmZpZ3M6IFJlY29yZDxzdHJpbmcsIFdpbmRvd0NvbmZpZz4gPSB7XG4gICdtYWluJzoge1xuICAgIHdpZHRoOiAxMjAwLFxuICAgIGhlaWdodDogOTAwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogMTIwMCxcbiAgICBtaW5IZWlnaHQ6IDc1MCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlcidcbiAgfSxcbiAgJ3NwbGFzaCc6IHtcbiAgICB3aWR0aDogNTAwLFxuICAgIGhlaWdodDogNDAwLFxuICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXInXG4gIH0sXG4gICdzZXR1cCc6IHtcbiAgICB3aWR0aDogOTUwLFxuICAgIGhlaWdodDogODAwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogODAwLFxuICAgIG1pbkhlaWdodDogNjAwLFxuICAgIHRpdGxlOiAnT2RvbyBNYW5hZ2VyJ1xuICB9LFxuICAnaGVscCc6IHtcbiAgICB3aWR0aDogNzUwLFxuICAgIGhlaWdodDogNzAwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogNjAwLFxuICAgIG1pbkhlaWdodDogNTAwLFxuICAgIHRpdGxlOiAnT2RvbyBNYW5hZ2VyIC0gSGVscCdcbiAgfSxcbiAgXCJzZXR0aW5nc1wiOiB7XG4gICAgd2lkdGg6IDkwMCxcbiAgICBoZWlnaHQ6IDcwMCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDgwMCxcbiAgICBtaW5IZWlnaHQ6IDYwMCxcbiAgICB0aXRsZTogXCJPZG9vIE1hbmFnZXIgLSBTZXR0aW5nc1wiXG4gIH0sXG4gICduZXctaW5zdGFuY2UnOiB7XG4gICAgd2lkdGg6IDYwMCxcbiAgICBoZWlnaHQ6IDg3MCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDUwMCxcbiAgICBtaW5IZWlnaHQ6IDcwMCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIE5ldyBJbnN0YW5jZSdcbiAgfSxcbiAgXCJuZXctcG9zdGdyZXNcIjoge1xuICAgIHdpZHRoOiA2MDAsXG4gICAgaGVpZ2h0OiA4MjAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA1MDAsXG4gICAgbWluSGVpZ2h0OiA3MDAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXIgLSBOZXcgUG9zdGdyZVNRTCBJbnN0YW5jZSdcbiAgfSxcbiAgJ2NvbnRhaW5lci1pbmZvJzoge1xuICAgIHdpZHRoOiA3MDAsXG4gICAgaGVpZ2h0OiA4NTAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA3MDAsXG4gICAgbWluSGVpZ2h0OiA4NTAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXIgLSBDb250YWluZXIgSW5mbydcbiAgfSxcbiAgJ2NvbnRhaW5lci1sb2dzJzoge1xuICAgIHdpZHRoOiA4MDAsXG4gICAgaGVpZ2h0OiA4NjAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA2MDAsXG4gICAgbWluSGVpZ2h0OiA3MDAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXIgLSBDb250YWluZXIgTG9ncydcbiAgfVxufTtcblxuLy8gR2V0IHdpbmRvdyBjb25maWcgd2l0aCBmYWxsYmFjayB0byBkZWZhdWx0XG5mdW5jdGlvbiBnZXRXaW5kb3dDb25maWcodHlwZTogc3RyaW5nKTogV2luZG93Q29uZmlnIHtcbiAgcmV0dXJuIHdpbmRvd0NvbmZpZ3NbdHlwZV0gfHwge1xuICAgIHdpZHRoOiA4MDAsXG4gICAgaGVpZ2h0OiA2MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIHRpdGxlOiBgT2RvbyBNYW5hZ2VyIC0gJHt0eXBlfWBcbiAgfTtcbn1cblxuY29uc3Qgd2luZG93czogV2luZG93c1JlZ2lzdHJ5ID0ge307XG5cbi8vIENoZWNrIGlmIHNldHVwIGlzIGNvbXBsZXRlZFxuYXN5bmMgZnVuY3Rpb24gaXNTZXR1cENvbXBsZXRlZCgpOiBQcm9taXNlPHtjb21wbGV0ZWQ6IGJvb2xlYW59PiB7XG4gIHRyeSB7XG4gICAgLy8gV2luZG93cy1zcGVjaWZpYyBiZWhhdmlvciAtIG9ubHkgY2hlY2sgaWYgd29ya2Rpci5qc29uIGV4aXN0cyBpbiBBcHBEYXRhXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICAgIGNvbnN0IGFwcERhdGFQYXRoID0gYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyk7XG4gICAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICd3b3JrZGlyLmpzb24nKTtcbiAgICAgIFxuICAgICAgLy8gRm9yIFdpbmRvd3MsIHdlIGNvbnNpZGVyIHNldHVwIGNvbXBsZXRlIGlmIHRoZSB3b3JrZGlyLmpzb24gZmlsZSBleGlzdHNcbiAgICAgIC8vIFRoaXMgc2ltcGxpZmllcyB0aGUgV2luZG93cyBzZXR1cCBwcm9jZXNzXG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyh3b3JrRGlyRmlsZVBhdGgpKSB7XG4gICAgICAgIGxvZ0luZm8oJ1dpbmRvd3M6IHdvcmtkaXIuanNvbiBleGlzdHMsIHNldHVwIGNvbXBsZXRlZCcpO1xuICAgICAgICBcbiAgICAgICAgLy8gQWRkaXRpb25hbCB2ZXJpZmljYXRpb24gLSBjaGVjayBpZiBzZXR0aW5ncy5qc29uIGFsc28gZXhpc3RzXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGY4JykpO1xuICAgICAgICAgIGNvbnN0IHdvcmtEaXIgPSB3b3JrRGlyRGF0YS53b3JrRGlyO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIExvZyB0aGUgYWN0dWFsIHBhdGggc3RvcmVkIGluIHdvcmtkaXIuanNvblxuICAgICAgICAgIGxvZ0luZm8oYFdpbmRvd3M6IHdvcmtkaXIuanNvbiBwb2ludHMgdG86ICR7d29ya0Rpcn1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgd29ya0RpciBleGlzdHMgYW5kIGNvbnRhaW5zIHNldHRpbmdzLmpzb25cbiAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpciwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICBjb25zdCBzZXR0aW5nc0V4aXN0cyA9IGZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKTtcbiAgICAgICAgICBsb2dJbmZvKGBXaW5kb3dzOiBTZXR0aW5ncyBmaWxlIGV4aXN0cyBhdCAke3NldHRpbmdzUGF0aH0/ICR7c2V0dGluZ3NFeGlzdHN9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHsgY29tcGxldGVkOiBzZXR0aW5nc0V4aXN0cyB9O1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBsb2dFcnJvcignV2luZG93czogRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24gb3IgY2hlY2tpbmcgc2V0dGluZ3MnLCBlcnIpO1xuICAgICAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9nSW5mbygnV2luZG93czogd29ya2Rpci5qc29uIGRvZXMgbm90IGV4aXN0LCBzZXR1cCBub3QgY29tcGxldGVkJyk7XG4gICAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gT3JpZ2luYWwgYmVoYXZpb3IgZm9yIG90aGVyIHBsYXRmb3Jtc1xuICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHAuZ2V0UGF0aCgndXNlckRhdGEnKSwgJ3dvcmtkaXIuanNvbicpO1xuXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIGxvZ0luZm8oJ1dvcmsgZGlyZWN0b3J5IGZpbGUgZG9lcyBub3QgZXhpc3QsIHNldHVwIG5vdCBjb21wbGV0ZWQnKTtcbiAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCB3b3JrRGlyRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0ZjgnKSk7XG4gICAgY29uc3Qgd29ya0RpciA9IHdvcmtEaXJEYXRhLndvcmtEaXI7XG5cbiAgICBpZiAoIXdvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMod29ya0RpcikpIHtcbiAgICAgIGxvZ0luZm8oJ1dvcmsgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0LCBzZXR1cCBub3QgY29tcGxldGVkJyk7XG4gICAgICByZXR1cm4geyBjb21wbGV0ZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5qb2luKHdvcmtEaXIsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzUGF0aCkpIHtcbiAgICAgIGxvZ0luZm8oJ1NldHRpbmdzIGZpbGUgZG9lcyBub3QgZXhpc3QsIHNldHVwIG5vdCBjb21wbGV0ZWQnKTtcbiAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb21wbGV0ZWQ6IHRydWUgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgc2V0dXAgc3RhdHVzJywgZXJyb3IpO1xuICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgfVxufVxuXG4vLyBDcmVhdGUgc2V0dXAgd2luZG93XG5mdW5jdGlvbiBjcmVhdGVTZXR1cFdpbmRvdygpIHtcbiAgbG9nSW5mbyhcIkNyZWF0aW5nIHNldHVwIHdpbmRvd1wiKTtcblxuICBjb25zdCBtYWluQ29uZmlnID0gZ2V0V2luZG93Q29uZmlnKFwibWFpblwiKTtcbiAgY29uc3Qgc2V0dXBDb25maWcgPSBnZXRXaW5kb3dDb25maWcoXCJzZXR1cFwiKTtcblxuICAvLyBEZWZpbmUgcHJlbG9hZFBhdGggYmFzZWQgb24gZW52aXJvbm1lbnQgLSBlbnN1cmUgcGF0aCByZXNvbHV0aW9uIHdvcmtzIGNvcnJlY3RseVxuICBjb25zdCBwcmVsb2FkUGF0aCA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIFxuICAgID8gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICdkaXN0LWVsZWN0cm9uJywgJ3ByZWxvYWQuanMnKVxuICAgIDogcGF0aC5qb2luKGFwcERpciwgJ3ByZWxvYWQuanMnKTtcbiAgXG4gIGxvZ0luZm8oYFVzaW5nIHByZWxvYWQgcGF0aCBmb3Igc2V0dXAgd2luZG93OiAke3ByZWxvYWRQYXRofWApO1xuXG4gIGNvbnN0IHNldHVwV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgIHdpZHRoOiBtYWluQ29uZmlnLndpZHRoLFxuICAgIGhlaWdodDogbWFpbkNvbmZpZy5oZWlnaHQsXG4gICAgbWluV2lkdGg6IG1haW5Db25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBtYWluQ29uZmlnLm1pbkhlaWdodCxcbiAgICBjZW50ZXI6IHRydWUsXG4gICAgc2hvdzogZmFsc2UsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzEyMTIxMicsXG4gICAgdGl0bGU6IHNldHVwQ29uZmlnLnRpdGxlLFxuICAgIHRpdGxlQmFyU3R5bGU6ICdkZWZhdWx0JyxcbiAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgcHJlbG9hZDogcHJlbG9hZFBhdGgsXG4gICAgICBub2RlSW50ZWdyYXRpb246IHRydWUsXG4gICAgICBjb250ZXh0SXNvbGF0aW9uOiBmYWxzZVxuICAgIH1cbiAgfSk7XG5cbiAgc2V0dXBXaW5kb3cuc2V0VGl0bGUoc2V0dXBDb25maWcudGl0bGUpO1xuXG4gIHNldHVwV2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgc2V0dXBXaW5kb3cuc2V0VGl0bGUoc2V0dXBDb25maWcudGl0bGUpO1xuICB9KTtcblxuICBzZXR1cFdpbmRvdy5vbmNlKCdyZWFkeS10by1zaG93JywgKCkgPT4ge1xuICAgIHNldHVwV2luZG93LnNob3coKTtcbiAgICBzZXR1cFdpbmRvdy5mb2N1cygpO1xuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzZXR1cFdpbmRvdy5sb2FkVVJMKCdodHRwOi8vbG9jYWxob3N0OjUxNzMvIy9zZXR1cCcpLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgc2V0dXAgVVJMJywgZXJyKTtcbiAgICB9KTtcbiAgICBzZXR1cFdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgfSBlbHNlIHtcbiAgICBzZXR1cFdpbmRvdy5sb2FkRmlsZShwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vZGlzdC9pbmRleC5odG1sJyksIHsgaGFzaDogJ3NldHVwJyB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHNldHVwIGZpbGUnLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0dXBXaW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoYEZhaWxlZCB0byBvcGVuIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICB9KTtcblxuICB3aW5kb3dzLnNldHVwID0gc2V0dXBXaW5kb3c7XG5cbiAgcmV0dXJuIHNldHVwV2luZG93O1xufVxuXG4vLyBDcmVhdGUgc3BsYXNoIHdpbmRvd1xuZnVuY3Rpb24gY3JlYXRlU3BsYXNoV2luZG93KCkge1xuICBsb2dJbmZvKFwiQ3JlYXRpbmcgc3BsYXNoIHdpbmRvd1wiKTtcbiAgY29uc3QgY29uZmlnID0gZ2V0V2luZG93Q29uZmlnKFwic3BsYXNoXCIpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBwYXRoIHJlc29sdXRpb24gd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oYXBwRGlyLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoOiAke3ByZWxvYWRQYXRofWApO1xuXG4gIGNvbnN0IHNwbGFzaCA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICB3aWR0aDogNTAwLFxuICAgIGhlaWdodDogNjAwLFxuICAgIGNlbnRlcjogdHJ1ZSxcbiAgICBmcmFtZTogZmFsc2UsXG4gICAgdHJhbnNwYXJlbnQ6IHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcsXG4gICAgYmFja2dyb3VuZENvbG9yOiBwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnID8gJyMxMjEyMTInIDogdW5kZWZpbmVkLFxuICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgbW92YWJsZTogdHJ1ZSxcbiAgICB0aXRsZTogY29uZmlnLnRpdGxlLFxuICAgIHNob3c6IGZhbHNlLFxuICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICBwcmVsb2FkOiBwcmVsb2FkUGF0aCxcbiAgICAgIG5vZGVJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICAgIGNvbnRleHRJc29sYXRpb246IGZhbHNlLFxuICAgICAgZGV2VG9vbHM6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnXG4gICAgfVxuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzcGxhc2gud2ViQ29udGVudHMub3BlbkRldlRvb2xzKHsgbW9kZTogJ2RldGFjaCcgfSk7XG4gIH1cblxuICBzcGxhc2gub24oJ2Nsb3NlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKGdsb2JhbC5hbGxvd1NwbGFzaENsb3NlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBhcHAuZW1pdCgndmVyaWZpY2F0aW9uLWNvbXBsZXRlJyBhcyBhbnkpO1xuICB9KTtcblxuICBzcGxhc2gub25jZSgncmVhZHktdG8tc2hvdycsICgpID0+IHtcbiAgICBzcGxhc2guc2hvdygpO1xuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzcGxhc2gubG9hZFVSTCgnaHR0cDovL2xvY2FsaG9zdDo1MTczLyMvc3BsYXNoJykuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBzcGxhc2ggVVJMJywgZXJyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBVc2UgcGF0aC5yZXNvbHZlIHJhdGhlciB0aGFuIHBhdGguam9pbiB0byBlbnN1cmUgY29ycmVjdCBwYXRoIHJlc29sdXRpb25cbiAgICBjb25zdCBodG1sUGF0aCA9IHBhdGgucmVzb2x2ZShhcHBEaXIsICcuLi9kaXN0L2luZGV4Lmh0bWwnKTtcbiAgICBsb2dJbmZvKGBMb2FkaW5nIHNwbGFzaCBmaWxlIGZyb206ICR7aHRtbFBhdGh9YCk7XG4gICAgc3BsYXNoLmxvYWRGaWxlKGh0bWxQYXRoLCB7IGhhc2g6ICdzcGxhc2gnIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgc3BsYXNoIGZpbGUnLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgd2luZG93cy5zcGxhc2ggPSBzcGxhc2g7XG5cbiAgcmV0dXJuIHNwbGFzaDtcbn1cblxuLy8gQ3JlYXRlIG1haW4gd2luZG93XG5mdW5jdGlvbiBjcmVhdGVNYWluV2luZG93KCkge1xuICBsb2dJbmZvKCdDcmVhdGluZyBtYWluIHdpbmRvdycpO1xuXG4gIGNvbnN0IGNvbmZpZyA9IGdldFdpbmRvd0NvbmZpZygnbWFpbicpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBwYXRoIHJlc29sdXRpb24gd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oYXBwRGlyLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoIGZvciBtYWluIHdpbmRvdzogJHtwcmVsb2FkUGF0aH1gKTtcblxuICBjb25zdCBtYWluV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgIHdpZHRoOiBjb25maWcud2lkdGgsXG4gICAgaGVpZ2h0OiBjb25maWcuaGVpZ2h0LFxuICAgIG1pbldpZHRoOiBjb25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBjb25maWcubWluSGVpZ2h0LFxuICAgIGNlbnRlcjogdHJ1ZSxcbiAgICBzaG93OiBmYWxzZSxcbiAgICBmcmFtZTogdHJ1ZSxcbiAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzEyMTIxMicsXG4gICAgdGl0bGVCYXJTdHlsZTogJ2RlZmF1bHQnLFxuICAgIHRpdGxlOiBjb25maWcudGl0bGUsXG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHByZWxvYWRQYXRoLFxuICAgICAgbm9kZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogZmFsc2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgbWFpbldpbmRvdy5zZXRUaXRsZShjb25maWcudGl0bGUpO1xuXG4gIG1haW5XaW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICBtYWluV2luZG93LnNldFRpdGxlKGNvbmZpZy50aXRsZSk7XG4gIH0pO1xuXG4gIC8vIFRyYWNrIGlmIHdlJ3JlIGluIHRoZSB0ZXJtaW5hdGlvbiBwcm9jZXNzXG4gIGxldCB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICBtYWluV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jIChldmVudCkgPT4ge1xuICAgIC8vIElmIHdlJ3JlIGFscmVhZHkgaGFuZGxpbmcgdGVybWluYXRpb24sIGRvbid0IHRyaWdnZXIgYWdhaW5cbiAgICBpZiAodGVybWluYXRpb25JblByb2dyZXNzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSB0cnVlO1xuXG4gICAgY29uc3Qgc2hvdWxkVGVybWluYXRlID0gYXdhaXQgaGFuZGxlQXBwVGVybWluYXRpb24obWFpbldpbmRvdyk7XG5cbiAgICBpZiAoc2hvdWxkVGVybWluYXRlKSB7XG4gICAgICBsb2dJbmZvKCdBcHAgdGVybWluYXRpb24gYXBwcm92ZWQsIHF1aXR0aW5nLi4uJyk7XG4gICAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICAgIG1haW5XaW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdjbG9zZScpO1xuICAgICAgYXBwLnF1aXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nSW5mbygnQXBwIHRlcm1pbmF0aW9uIGNhbmNlbGxlZCBieSB1c2VyJyk7XG4gICAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuXG4gIG1haW5XaW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoYEZhaWxlZCB0byBvcGVuIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICB9KTtcblxuICB3aW5kb3dzLm1haW4gPSBtYWluV2luZG93O1xuXG4gIHJldHVybiBtYWluV2luZG93O1xufVxuXG4vLyBDcmVhdGUgYSBuZXcgd2luZG93IG9mIHNwZWNpZmllZCB0eXBlXG5mdW5jdGlvbiBjcmVhdGVXaW5kb3cod2luZG93VHlwZTogc3RyaW5nLCBvcHRpb25zOiBhbnkgPSB7fSkge1xuICBsb2dJbmZvKGBDcmVhdGluZyB3aW5kb3c6ICR7d2luZG93VHlwZX1gKTtcblxuICBjb25zdCBkZWZhdWx0Q29uZmlnID0gZ2V0V2luZG93Q29uZmlnKHdpbmRvd1R5cGUpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBwYXRoIHJlc29sdXRpb24gd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oYXBwRGlyLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoIGZvciAke3dpbmRvd1R5cGV9IHdpbmRvdzogJHtwcmVsb2FkUGF0aH1gKTtcblxuICBjb25zdCB3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgd2lkdGg6IG9wdGlvbnMud2lkdGggfHwgZGVmYXVsdENvbmZpZy53aWR0aCxcbiAgICBoZWlnaHQ6IG9wdGlvbnMuaGVpZ2h0IHx8IGRlZmF1bHRDb25maWcuaGVpZ2h0LFxuICAgIG1pbldpZHRoOiBvcHRpb25zLm1pbldpZHRoIHx8IGRlZmF1bHRDb25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBvcHRpb25zLm1pbkhlaWdodCB8fCBkZWZhdWx0Q29uZmlnLm1pbkhlaWdodCxcbiAgICByZXNpemFibGU6IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3Jlc2l6YWJsZScpID8gb3B0aW9ucy5yZXNpemFibGUgOiBkZWZhdWx0Q29uZmlnLnJlc2l6YWJsZSxcbiAgICBjZW50ZXI6IHRydWUsXG4gICAgc2hvdzogZmFsc2UsXG4gICAgZnJhbWU6IHRydWUsXG4gICAgdGl0bGU6IG9wdGlvbnMudGl0bGUgfHwgZGVmYXVsdENvbmZpZy50aXRsZSxcbiAgICBhdXRvSGlkZU1lbnVCYXI6IHByb2Nlc3MucGxhdGZvcm0gIT09ICdkYXJ3aW4nLFxuICAgIHRpdGxlQmFyU3R5bGU6ICdkZWZhdWx0JyxcbiAgICBtb2RhbDogb3B0aW9ucy5tb2RhbCA9PT0gdHJ1ZSxcbiAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMTIxMjEyJyxcbiAgICBwYXJlbnQ6IG9wdGlvbnMucGFyZW50ICYmIHdpbmRvd3Nbb3B0aW9ucy5wYXJlbnRdID8gd2luZG93c1tvcHRpb25zLnBhcmVudF0gOiB1bmRlZmluZWQsXG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHByZWxvYWRQYXRoLFxuICAgICAgbm9kZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogZmFsc2UsXG4gICAgICBhZGRpdGlvbmFsQXJndW1lbnRzOiBvcHRpb25zLmRhdGEgPyBbYC0td2luZG93LWRhdGE9JHtKU09OLnN0cmluZ2lmeShvcHRpb25zLmRhdGEpfWBdIDogW11cbiAgICB9LFxuICB9KTtcblxuICBjb25zdCB3aW5kb3dUaXRsZSA9IG9wdGlvbnMudGl0bGUgfHwgZGVmYXVsdENvbmZpZy50aXRsZTtcbiAgd2luZG93LnNldFRpdGxlKHdpbmRvd1RpdGxlKTtcblxuICB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICB3aW5kb3cuc2V0VGl0bGUod2luZG93VGl0bGUpO1xuICB9KTtcblxuICBpZiAoIW9wdGlvbnMubW9kYWwpIHtcbiAgICB3aW5kb3cuc2V0UGFyZW50V2luZG93KG51bGwpO1xuICB9XG5cbiAgd2luZG93Lm9uY2UoJ3JlYWR5LXRvLXNob3cnLCAoKSA9PiB7XG4gICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgd2luZG93LnNob3coKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jykge1xuICAgIHdpbmRvdy5sb2FkVVJMKGBodHRwOi8vbG9jYWxob3N0OjUxNzMvIy8ke3dpbmRvd1R5cGV9YCkuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKGBGYWlsZWQgdG8gbG9hZCAke3dpbmRvd1R5cGV9IFVSTGAsIGVycik7XG4gICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvdy5zaG93KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAob3B0aW9ucy5vcGVuRGV2VG9vbHMpIHtcbiAgICAgIHdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LmxvYWRGaWxlKHBhdGguam9pbihhcHBEaXIsICcuLi9kaXN0L2luZGV4Lmh0bWwnKSwgeyBoYXNoOiB3aW5kb3dUeXBlIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcihgRmFpbGVkIHRvIGxvYWQgJHt3aW5kb3dUeXBlfSBmaWxlYCwgZXJyKTtcbiAgICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgd2luZG93LnNob3coKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHdpbmRvd3Nbd2luZG93VHlwZV0gPSB3aW5kb3c7XG5cbiAgLy8gQWRkIGlzQ2xvc2luZyBwcm9wZXJ0eSB0byBCcm93c2VyV2luZG93XG4gICh3aW5kb3cgYXMgYW55KS5pc0Nsb3NpbmcgPSBmYWxzZTtcblxuICAvLyBBZGQgY3VzdG9tIGNsb3NlIG1ldGhvZCB3aXRoIGFuaW1hdGlvblxuICBjb25zdCBvcmlnaW5hbENsb3NlID0gd2luZG93LmNsb3NlLmJpbmQod2luZG93KTtcbiAgKHdpbmRvdyBhcyBhbnkpLm9yaWdpbmFsQ2xvc2UgPSBvcmlnaW5hbENsb3NlO1xuICB3aW5kb3cuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAod2luZG93LmlzRGVzdHJveWVkKCkgfHwgKHdpbmRvdyBhcyBhbnkpLmlzQ2xvc2luZykge1xuICAgICAgcmV0dXJuIG9yaWdpbmFsQ2xvc2UoKTtcbiAgICB9XG5cbiAgICAod2luZG93IGFzIGFueSkuaXNDbG9zaW5nID0gdHJ1ZTtcblxuICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkgJiYgd2luZG93LndlYkNvbnRlbnRzKSB7XG4gICAgICB3aW5kb3cud2ViQ29udGVudHMuc2VuZCgnd2luZG93LWZhZGUtb3V0Jyk7XG5cbiAgICAgIGlwY01haW4ub25jZSgnd2luZG93LWZhZGUtb3V0LWNvbmZpcm0nLCAoKSA9PiB7XG4gICAgICAgIGxldCBvcGFjaXR5ID0gMS4wO1xuICAgICAgICBjb25zdCBmYWRlU3RlcCA9IDAuMTtcbiAgICAgICAgY29uc3QgZmFkZUludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgIGlmICh3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG9wYWNpdHkgLT0gZmFkZVN0ZXA7XG4gICAgICAgICAgaWYgKG9wYWNpdHkgPD0gMCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICBvcmlnaW5hbENsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRPcGFjaXR5KG9wYWNpdHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgMTApO1xuICAgICAgfSk7XG5cbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpICYmICh3aW5kb3cgYXMgYW55KS5pc0Nsb3NpbmcpIHtcbiAgICAgICAgICBvcmlnaW5hbENsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDgwMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9yaWdpbmFsQ2xvc2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfTtcblxuICB3aW5kb3cub24oJ2Nsb3NlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKCEod2luZG93IGFzIGFueSkuaXNDbG9zaW5nKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgd2luZG93LmNsb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICB3aW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHtcbiAgICB3aW5kb3dzW3dpbmRvd1R5cGVdID0gdW5kZWZpbmVkO1xuICB9KTtcblxuICByZXR1cm4gd2luZG93O1xufVxuXG5mdW5jdGlvbiBzaG93TWFpbldpbmRvdygpIHtcbiAgbG9nSW5mbygnc2hvd01haW5XaW5kb3cgZnVuY3Rpb24gY2FsbGVkJyk7XG5cbiAgdHJ5IHtcbiAgICBnbG9iYWwuYWxsb3dTcGxhc2hDbG9zZSA9IHRydWU7XG5cbiAgICBjb25zdCBtYWluRXhpc3RzID0gd2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKTtcbiAgICBjb25zdCBzcGxhc2hFeGlzdHMgPSB3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKTtcbiAgICBcbiAgICBsb2dJbmZvKGBXaW5kb3cgc3RhdGU6IG1haW4gZXhpc3RzPSR7bWFpbkV4aXN0c30sIHNwbGFzaCBleGlzdHM9JHtzcGxhc2hFeGlzdHN9YCk7XG5cbiAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBXaW5kb3dzIHBsYXRmb3JtIHRvIGRlYnVnIGlzc3Vlc1xuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICBsb2dJbmZvKCdXaW5kb3dzIHBsYXRmb3JtOiBleGVjdXRpbmcgc2hvd01haW5XaW5kb3cnKTtcbiAgICAgIFxuICAgICAgLy8gRm9yY2UtY2xvc2UgdGhlIHNwbGFzaCB3aW5kb3cgaWYgaXQgZXhpc3RzXG4gICAgICBpZiAoc3BsYXNoRXhpc3RzICYmIHdpbmRvd3Muc3BsYXNoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbG9nSW5mbygnV2luZG93czogRm9yY2UtY2xvc2luZyBzcGxhc2ggd2luZG93Jyk7XG4gICAgICAgICAgd2luZG93cy5zcGxhc2guZGVzdHJveSgpOyAvLyBVc2UgZGVzdHJveSBpbnN0ZWFkIG9mIGNsb3NlIHRvIGVuc3VyZSBpdCBjbG9zZXNcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgbG9nRXJyb3IoJ1dpbmRvd3M6IEVycm9yIGZvcmNlLWNsb3Npbmcgc3BsYXNoIHdpbmRvdycsIGVycik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU2hvdyB0aGUgbWFpbiB3aW5kb3cgaW1tZWRpYXRlbHlcbiAgICAgIGlmIChtYWluRXhpc3RzICYmIHdpbmRvd3MubWFpbikge1xuICAgICAgICBsb2dJbmZvKCdXaW5kb3dzOiBTaG93aW5nIGV4aXN0aW5nIG1haW4gd2luZG93Jyk7XG4gICAgICAgIGxvYWRBbmRTaG93V2luZG93KHdpbmRvd3MubWFpbik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ0luZm8oJ1dpbmRvd3M6IENyZWF0aW5nIGFuZCBzaG93aW5nIG5ldyBtYWluIHdpbmRvdycpO1xuICAgICAgICBjb25zdCBuZXdNYWluID0gY3JlYXRlTWFpbldpbmRvdygpO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE9yaWdpbmFsIGNvZGUgZm9yIG5vbi1XaW5kb3dzIHBsYXRmb3Jtc1xuICAgIGlmIChtYWluRXhpc3RzICYmIHdpbmRvd3MubWFpbikge1xuICAgICAgd2luZG93cy5tYWluLmhpZGUoKTtcblxuICAgICAgaWYgKHNwbGFzaEV4aXN0cyAmJiB3aW5kb3dzLnNwbGFzaCkge1xuICAgICAgICBsZXQgc3BsYXNoT3BhY2l0eSA9IDE7XG4gICAgICAgIGNvbnN0IGZhZGVJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICBzcGxhc2hPcGFjaXR5IC09IDAuMDQ7XG5cbiAgICAgICAgICBpZiAoc3BsYXNoT3BhY2l0eSA8PSAwKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGZhZGVJbnRlcnZhbCk7XG5cbiAgICAgICAgICAgIGlmICh3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHdpbmRvd3Muc3BsYXNoLmNsb3NlKCk7XG5cbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB3aW5kb3dzLm1haW47XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmICFtYWluV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIDUwMCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gd2luZG93cy5tYWluO1xuICAgICAgICAgICAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB3aW5kb3dzLm1haW47XG4gICAgICAgICAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICB3aW5kb3dzLnNwbGFzaC5zZXRPcGFjaXR5KHNwbGFzaE9wYWNpdHkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGZhZGVJbnRlcnZhbCk7XG4gICAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gd2luZG93cy5tYWluO1xuICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sIDE2KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHdpbmRvd3MubWFpbjtcbiAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgZ2xvYmFsLmFsbG93U3BsYXNoQ2xvc2UgPSBmYWxzZTtcbiAgICAgIH0sIDIwMDApO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld01haW4gPSBjcmVhdGVNYWluV2luZG93KCk7XG5cbiAgICAgIGlmIChzcGxhc2hFeGlzdHMgJiYgd2luZG93cy5zcGxhc2gpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBsZXQgc3BsYXNoT3BhY2l0eSA9IDE7XG4gICAgICAgICAgY29uc3QgZmFkZUludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgc3BsYXNoT3BhY2l0eSAtPSAwLjA0O1xuXG4gICAgICAgICAgICBpZiAoc3BsYXNoT3BhY2l0eSA8PSAwKSB7XG4gICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoZmFkZUludGVydmFsKTtcbiAgICAgICAgICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgd2luZG93cy5zcGxhc2guY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGxvYWRBbmRTaG93V2luZG93KG5ld01haW4pO1xuICAgICAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB3aW5kb3dzLnNwbGFzaC5zZXRPcGFjaXR5KHNwbGFzaE9wYWNpdHkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCAxNik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgIGlmICghbmV3TWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICBuZXdNYWluLnNob3coKTtcbiAgICAgICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICBlbWl0TWFpbldpbmRvd1Zpc2libGUobmV3TWFpbik7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBzaG93TWFpbldpbmRvdycsIGVycm9yKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbmV3TWFpbiA9IGNyZWF0ZU1haW5XaW5kb3coKTtcblxuICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2luZG93cy5zcGxhc2guY2xvc2UoKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICAgICAgZW1pdE1haW5XaW5kb3dWaXNpYmxlKG5ld01haW4pO1xuICAgICAgICAgIH0sIDEwMCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3TWFpbi5zaG93KCk7XG4gICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChmYWxsYmFja0Vycm9yKSB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGNyZWF0ZSBmYWxsYmFjayBtYWluIHdpbmRvdycsIGZhbGxiYWNrRXJyb3IpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBDcmVhdGUgdGhlIG1hY09TIGFwcGxpY2F0aW9uIG1lbnVcbmZ1bmN0aW9uIGNyZWF0ZUFwcE1lbnUoKSB7XG4gIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnZGFyd2luJykgcmV0dXJuO1xuXG4gIGxvZ0luZm8oJ0NyZWF0aW5nIG1hY09TIGFwcGxpY2F0aW9uIG1lbnUnKTtcblxuICBjb25zdCB0ZW1wbGF0ZTogRWxlY3Ryb24uTWVudUl0ZW1Db25zdHJ1Y3Rvck9wdGlvbnNbXSA9IFtcbiAgICB7XG4gICAgICBsYWJlbDogYXBwLm5hbWUsXG4gICAgICBzdWJtZW51OiBbXG4gICAgICAgIHsgcm9sZTogJ2Fib3V0JyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ1ByZWZlcmVuY2VzJyxcbiAgICAgICAgICBhY2NlbGVyYXRvcjogJ0NtZCssJyxcbiAgICAgICAgICBjbGljazogKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHdpbmRvd3Muc2V0dGluZ3MgJiYgIXdpbmRvd3Muc2V0dGluZ3MuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB3aW5kb3dzLnNldHRpbmdzLmZvY3VzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjcmVhdGVXaW5kb3coJ3NldHRpbmdzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ3NlcnZpY2VzJyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2hpZGUnIH0sXG4gICAgICAgIHsgcm9sZTogJ2hpZGVPdGhlcnMnIH0sXG4gICAgICAgIHsgcm9sZTogJ3VuaGlkZScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdxdWl0JyB9XG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBsYWJlbDogJ0ZpbGUnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6ICdOZXcgT2RvbyBJbnN0YW5jZScsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdDbWQrTicsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIGNyZWF0ZVdpbmRvdygnbmV3LWluc3RhbmNlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6ICdOZXcgUG9zdGdyZVNRTCBJbnN0YW5jZScsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdTaGlmdCtDbWQrTicsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIGNyZWF0ZVdpbmRvdygnbmV3LXBvc3RncmVzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2Nsb3NlJyB9XG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBsYWJlbDogJ0VkaXQnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7IHJvbGU6ICd1bmRvJyB9LFxuICAgICAgICB7IHJvbGU6ICdyZWRvJyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2N1dCcgfSxcbiAgICAgICAgeyByb2xlOiAnY29weScgfSxcbiAgICAgICAgeyByb2xlOiAncGFzdGUnIH0sXG4gICAgICAgIHsgcm9sZTogJ2RlbGV0ZScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdzZWxlY3RBbGwnIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIGxhYmVsOiAnVmlldycsXG4gICAgICBzdWJtZW51OiBbXG4gICAgICAgIHsgcm9sZTogJ3JlbG9hZCcgfSxcbiAgICAgICAgeyByb2xlOiAnZm9yY2VSZWxvYWQnIH0sXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcbiAgICAgICAgeyByb2xlOiAncmVzZXRab29tJyB9LFxuICAgICAgICB7IHJvbGU6ICd6b29tSW4nIH0sXG4gICAgICAgIHsgcm9sZTogJ3pvb21PdXQnIH0sXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcbiAgICAgICAgeyByb2xlOiAndG9nZ2xlZnVsbHNjcmVlbicgfVxuICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgbGFiZWw6ICdXaW5kb3cnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7IHJvbGU6ICdtaW5pbWl6ZScgfSxcbiAgICAgICAgeyByb2xlOiAnem9vbScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdmcm9udCcgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICd3aW5kb3cnIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIHJvbGU6ICdoZWxwJyxcbiAgICAgIHN1Ym1lbnU6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxhYmVsOiAnSGVscCcsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdDbWQrSCcsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLmhlbHAgJiYgIXdpbmRvd3MuaGVscC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIHdpbmRvd3MuaGVscC5mb2N1cygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY3JlYXRlV2luZG93KCdoZWxwJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ09wZW4gQXBwbGljYXRpb24gTG9ncycsXG4gICAgICAgICAgY2xpY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgICAgICAgICAgIHNlbmRlcjogd2luZG93cy5tYWluPy53ZWJDb250ZW50c1xuICAgICAgICAgICAgICB9IGFzIEVsZWN0cm9uLklwY01haW5JbnZva2VFdmVudDtcblxuICAgICAgICAgICAgICAvLyBUeXBlIGFzc2VydGlvbiB0byBhY2Nlc3MgaGFuZGxlcnNcbiAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHR5cGVkSXBjTWFpbi5oYW5kbGVycz8uWydnZXQtbG9nLWZpbGUtcGF0aCddO1xuICAgICAgICAgICAgICBpZiAoaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvZ0ZpbGVQYXRoID0gYXdhaXQgaGFuZGxlcihldmVudCk7XG4gICAgICAgICAgICAgICAgaWYgKGxvZ0ZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCBzaGVsbC5vcGVuUGF0aChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdObyBMb2dzIEF2YWlsYWJsZScsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdObyBhcHBsaWNhdGlvbiBsb2dzIHdlcmUgZm91bmQuJ1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2dFcnJvcignRXJyb3Igb3BlbmluZyBhcHBsaWNhdGlvbiBsb2dzJywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXVxuICAgIH1cbiAgXTtcblxuICBjb25zdCBtZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gIE1lbnUuc2V0QXBwbGljYXRpb25NZW51KG1lbnUpO1xufVxuXG4vKipcbiAqIFNldHVwIFdpbmRvd3Mtc3BlY2lmaWMgZGVmYXVsdHMgdG8gZW5zdXJlIGFwcCB3b3JrcyBwcm9wZXJseSBvbiBXaW5kb3dzIFxuICogVGhpcyBmdW5jdGlvbiBoYW5kbGVzIHRoZSBXaW5kb3dzLXNwZWNpZmljIGNvbmZpZ3VyYXRpb24gdG8gYWRkcmVzcyBwYXRoIGlzc3Vlc1xuICovXG5hc3luYyBmdW5jdGlvbiBzZXR1cFdpbmRvd3NEZWZhdWx0cygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBsb2dJbmZvKCdTZXR0aW5nIHVwIFdpbmRvd3Mtc3BlY2lmaWMgZGVmYXVsdCBjb25maWd1cmF0aW9uJyk7XG4gICAgY29uc3QgYXBwRGF0YVBhdGggPSBhcHAuZ2V0UGF0aCgndXNlckRhdGEnKTtcbiAgICBsb2dJbmZvKGBVc2luZyBBcHBEYXRhIHBhdGg6ICR7YXBwRGF0YVBhdGh9YCk7XG5cbiAgICAvLyBEZWJ1ZyAtIHNob3cgZGlyZWN0b3J5IGNvbnRlbnRzXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFwcERhdGFDb250ZW50cyA9IGZzLnJlYWRkaXJTeW5jKGFwcERhdGFQYXRoKTtcbiAgICAgIGxvZ0luZm8oYEFwcERhdGEgY29udGVudHM6ICR7SlNPTi5zdHJpbmdpZnkoYXBwRGF0YUNvbnRlbnRzKX1gKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciByZWFkaW5nIEFwcERhdGEgZGlyZWN0b3J5JywgZXJyKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgd29ya2Rpci5qc29uIGluIEFwcERhdGEgcG9pbnRpbmcgdG8gaXRzZWxmXG4gICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnd29ya2Rpci5qc29uJyk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod29ya0RpckZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeSh7IHdvcmtEaXI6IGFwcERhdGFQYXRoIH0sIG51bGwsIDIpKTtcbiAgICAgICAgbG9nSW5mbyhgQ3JlYXRlZCB3b3JrZGlyLmpzb24gaW4gQXBwRGF0YSBwb2ludGluZyB0byBpdHNlbGY6ICR7YXBwRGF0YVBhdGh9YCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGNyZWF0aW5nIHdvcmtkaXIuanNvbicsIGVycik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nSW5mbyhgd29ya2Rpci5qc29uIGFscmVhZHkgZXhpc3RzIGluIEFwcERhdGFgKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFZhbGlkYXRlIHRoZSBleGlzdGluZyB3b3JrZGlyLmpzb25cbiAgICAgICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGY4JykpO1xuICAgICAgICBsb2dJbmZvKGBFeGlzdGluZyB3b3JrZGlyLmpzb24gY29udGVudHM6ICR7SlNPTi5zdHJpbmdpZnkod29ya0RpckRhdGEpfWApO1xuICAgICAgICBcbiAgICAgICAgLy8gRW5zdXJlIHdvcmtEaXIgaXMgc2V0IHRvIGFwcERhdGFQYXRoXG4gICAgICAgIGlmICh3b3JrRGlyRGF0YS53b3JrRGlyICE9PSBhcHBEYXRhUGF0aCkge1xuICAgICAgICAgIGxvZ0luZm8oYFVwZGF0aW5nIHdvcmtkaXIuanNvbiB0byBwb2ludCB0byBjb3JyZWN0IEFwcERhdGEgcGF0aGApO1xuICAgICAgICAgIHdvcmtEaXJEYXRhLndvcmtEaXIgPSBhcHBEYXRhUGF0aDtcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkod29ya0RpckRhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZ0Vycm9yKCdFcnJvciByZWFkaW5nL3VwZGF0aW5nIGV4aXN0aW5nIHdvcmtkaXIuanNvbicsIGVycik7XG4gICAgICAgIC8vIFRyeSB0byByZWNyZWF0ZSBpdFxuICAgICAgICB0cnkge1xuICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMod29ya0RpckZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeSh7IHdvcmtEaXI6IGFwcERhdGFQYXRoIH0sIG51bGwsIDIpKTtcbiAgICAgICAgICBsb2dJbmZvKGBSZWNyZWF0ZWQgd29ya2Rpci5qc29uIGFmdGVyIGVycm9yYCk7XG4gICAgICAgIH0gY2F0Y2ggKHdyaXRlRXJyKSB7XG4gICAgICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byByZWNyZWF0ZSB3b3JrZGlyLmpzb24nLCB3cml0ZUVycik7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGRlZmF1bHQgc2V0dGluZ3MuanNvbiBpbiB0aGUgQXBwRGF0YSBkaXJlY3RvcnlcbiAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRTZXR0aW5ncyA9IHtcbiAgICAgICAgICB0aGVtZTogJ2RhcmsnLFxuICAgICAgICAgIGxhbmd1YWdlOiAnZW4nLFxuICAgICAgICAgIG5ldHdvcms6ICdvZG9vLW5ldHdvcmsnLFxuICAgICAgICAgIHNob3dXZWxjb21lU2NyZWVuOiB0cnVlLFxuICAgICAgICAgIGF1dG9DaGVja1VwZGF0ZXM6IHRydWUsXG4gICAgICAgICAgdXBkYXRlQ2hlY2tGcmVxdWVuY3k6ICdkYWlseScsXG4gICAgICAgICAgc2hvd1VwZGF0ZU5vdGlmaWNhdGlvbnM6IHRydWUsXG4gICAgICAgICAgbGFzdFVwZGF0ZUNoZWNrOiBudWxsLFxuICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH07XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCBKU09OLnN0cmluZ2lmeShkZWZhdWx0U2V0dGluZ3MsIG51bGwsIDIpKTtcbiAgICAgICAgbG9nSW5mbyhgQ3JlYXRlZCBkZWZhdWx0IHNldHRpbmdzLmpzb24gaW4gQXBwRGF0YWApO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjcmVhdGluZyBzZXR0aW5ncy5qc29uJywgZXJyKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dJbmZvKGBzZXR0aW5ncy5qc29uIGFscmVhZHkgZXhpc3RzIGluIEFwcERhdGEgYXQ6ICR7c2V0dGluZ3NQYXRofWApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2V0dGluZ3NEYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmOCcpKTtcbiAgICAgICAgbG9nSW5mbyhgRXhpc3Rpbmcgc2V0dGluZ3MuanNvbiBjb250ZW50czogJHtKU09OLnN0cmluZ2lmeShzZXR0aW5nc0RhdGEpfWApO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZ0Vycm9yKCdFcnJvciByZWFkaW5nIGV4aXN0aW5nIHNldHRpbmdzLmpzb24nLCBlcnIpO1xuICAgICAgICAvLyBUcnkgdG8gcmVjcmVhdGUgaXRcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBkZWZhdWx0U2V0dGluZ3MgPSB7XG4gICAgICAgICAgICB0aGVtZTogJ2RhcmsnLFxuICAgICAgICAgICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgICAgICAgICBuZXR3b3JrOiAnb2Rvby1uZXR3b3JrJyxcbiAgICAgICAgICAgIHNob3dXZWxjb21lU2NyZWVuOiB0cnVlLFxuICAgICAgICAgICAgYXV0b0NoZWNrVXBkYXRlczogdHJ1ZSxcbiAgICAgICAgICAgIHVwZGF0ZUNoZWNrRnJlcXVlbmN5OiAnZGFpbHknLFxuICAgICAgICAgICAgc2hvd1VwZGF0ZU5vdGlmaWNhdGlvbnM6IHRydWUsXG4gICAgICAgICAgICBsYXN0VXBkYXRlQ2hlY2s6IG51bGwsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgfTtcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHNldHRpbmdzUGF0aCwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFNldHRpbmdzLCBudWxsLCAyKSk7XG4gICAgICAgICAgbG9nSW5mbyhgUmVjcmVhdGVkIHNldHRpbmdzLmpzb24gYWZ0ZXIgZXJyb3JgKTtcbiAgICAgICAgfSBjYXRjaCAod3JpdGVFcnIpIHtcbiAgICAgICAgICBsb2dFcnJvcignRmFpbGVkIHRvIHJlY3JlYXRlIHNldHRpbmdzLmpzb24nLCB3cml0ZUVycik7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRW5zdXJlIG5lY2Vzc2FyeSBkaXJlY3RvcmllcyBleGlzdCAob2RvbywgcG9zdGdyZXMsIGxvZ3MpXG4gICAgY29uc3Qgb2Rvb0RpciA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ29kb28nKTtcbiAgICBjb25zdCBwb3N0Z3Jlc0RpciA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ3Bvc3RncmVzJyk7XG4gICAgY29uc3QgbG9nc0RpciA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ2xvZ3MnKTtcblxuICAgIHRyeSB7XG4gICAgICBpZiAoIWZzLmV4aXN0c1N5bmMob2Rvb0RpcikpIHtcbiAgICAgICAgZnMubWtkaXJTeW5jKG9kb29EaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBsb2dJbmZvKGBDcmVhdGVkIG9kb28gZGlyZWN0b3J5IGluIEFwcERhdGE6ICR7b2Rvb0Rpcn1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ0luZm8oYG9kb28gZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzOiAke29kb29EaXJ9YCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgY3JlYXRpbmcgb2RvbyBkaXJlY3RvcnknLCBlcnIpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocG9zdGdyZXNEaXIpKSB7XG4gICAgICAgIGZzLm1rZGlyU3luYyhwb3N0Z3Jlc0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgIGxvZ0luZm8oYENyZWF0ZWQgcG9zdGdyZXMgZGlyZWN0b3J5IGluIEFwcERhdGE6ICR7cG9zdGdyZXNEaXJ9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dJbmZvKGBwb3N0Z3JlcyBkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHM6ICR7cG9zdGdyZXNEaXJ9YCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgY3JlYXRpbmcgcG9zdGdyZXMgZGlyZWN0b3J5JywgZXJyKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGxvZ3NEaXIpKSB7XG4gICAgICAgIGZzLm1rZGlyU3luYyhsb2dzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgbG9nSW5mbyhgQ3JlYXRlZCBsb2dzIGRpcmVjdG9yeSBpbiBBcHBEYXRhOiAke2xvZ3NEaXJ9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dJbmZvKGBsb2dzIGRpcmVjdG9yeSBhbHJlYWR5IGV4aXN0czogJHtsb2dzRGlyfWApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGNyZWF0aW5nIGxvZ3MgZGlyZWN0b3J5JywgZXJyKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBWZXJpZnkgZXZlcnl0aGluZyB3YXMgY3JlYXRlZCBjb3JyZWN0bHlcbiAgICBsZXQgc2V0dXBTdWNjZXNzZnVsID0gdHJ1ZTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya0RpckZpbGVQYXRoKSkge1xuICAgICAgbG9nRXJyb3IoJ3dvcmtkaXIuanNvbiB3YXMgbm90IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICBzZXR1cFN1Y2Nlc3NmdWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzUGF0aCkpIHtcbiAgICAgIGxvZ0Vycm9yKCdzZXR0aW5ncy5qc29uIHdhcyBub3QgY3JlYXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgIHNldHVwU3VjY2Vzc2Z1bCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMob2Rvb0RpcikpIHtcbiAgICAgIGxvZ0Vycm9yKCdvZG9vIGRpcmVjdG9yeSB3YXMgbm90IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICBzZXR1cFN1Y2Nlc3NmdWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHBvc3RncmVzRGlyKSkge1xuICAgICAgbG9nRXJyb3IoJ3Bvc3RncmVzIGRpcmVjdG9yeSB3YXMgbm90IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICBzZXR1cFN1Y2Nlc3NmdWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGxvZ3NEaXIpKSB7XG4gICAgICBsb2dFcnJvcignbG9ncyBkaXJlY3Rvcnkgd2FzIG5vdCBjcmVhdGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgc2V0dXBTdWNjZXNzZnVsID0gZmFsc2U7XG4gICAgfVxuXG4gICAgbG9nSW5mbyhgV2luZG93cy1zcGVjaWZpYyBkZWZhdWx0IGNvbmZpZ3VyYXRpb24gY29tcGxldGVkIHN1Y2Nlc3NmdWxseTogJHtzZXR1cFN1Y2Nlc3NmdWx9YCk7XG4gICAgcmV0dXJuIHNldHVwU3VjY2Vzc2Z1bDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3Igc2V0dGluZyB1cCBXaW5kb3dzLXNwZWNpZmljIGRlZmF1bHRzJywgZXJyb3IpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5hcHAud2hlblJlYWR5KCkudGhlbihhc3luYyAoKSA9PiB7XG4gIC8vIEluaXRpYWxpemUgbG9nIGZpbGVcbiAgaW5pdExvZ0ZpbGUoKTtcblxuICBsb2dJbmZvKCdBcHBsaWNhdGlvbiByZWFkeSwgaW5pdGlhbGl6aW5nLi4uJyk7XG5cbiAgQUNUSVZFX0xPR19GSUxFID0gZ2V0TG9nRmlsZUxvY2soKTtcbiAgaWYgKEFDVElWRV9MT0dfRklMRSkge1xuICAgIGxvZ0luZm8oYEZvdW5kIGV4aXN0aW5nIGxvZyBmaWxlIGZyb20gbG9jazogJHtBQ1RJVkVfTE9HX0ZJTEV9YCk7XG4gIH1cblxuICBpbml0aWFsaXplSXBjSGFuZGxlcnMoKTtcbiAgY3JlYXRlQXBwTWVudSgpO1xuXG4gIC8vIExvZyBjbGVhbnVwIGNvZGUgcmVtb3ZlZCAtIG5vdyBoYW5kbGVkIGJ5IGxvZyByb3RhdGlvblxuXG4gIC8vIEhhbmRsZSBjcmVhdGUtaW5zdGFuY2UgbWVzc2FnZSBmcm9tIHJlbmRlcmVyXG4gIGlwY01haW4ub24oJ2NyZWF0ZS1pbnN0YW5jZScsIGFzeW5jIChldmVudCwgZGF0YSkgPT4ge1xuICAgIGxvZ0luZm8oJ1tDUkVBVEUtSU5TVEFOQ0VdIFJlY2VpdmVkIGNyZWF0ZS1pbnN0YW5jZSBldmVudCcpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNyZWF0ZVdpdGhUaW1lb3V0ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8YW55PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignSW5zdGFuY2UgY3JlYXRpb24gdGltZWQgb3V0IGFmdGVyIDYwIHNlY29uZHMuIFBsZWFzZSBjaGVjayBEb2NrZXIgc3RhdHVzLicpKTtcbiAgICAgICAgICB9LCA2MDAwMCk7XG5cbiAgICAgICAgICBjb25zdCBleGVjT3BlcmF0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWYgKGRhdGEuaW5zdGFuY2VUeXBlID09PSAncG9zdGdyZXMnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmNyZWF0ZVBvc3RncmVzSW5zdGFuY2UoXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KGRhdGEucG9ydCwgMTApIHx8IDU0MzIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudXNlcm5hbWUgfHwgJ3Bvc3RncmVzJyxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wYXNzd29yZCB8fCAncG9zdGdyZXMnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZWRpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5hZG1pblBhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmRiRmlsdGVyLFxuICAgICAgICAgICAgICAgICAgICBwYXJzZUludChkYXRhLnBvcnQsIDEwKSB8fCA4MDY5LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmN1c3RvbUltYWdlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmN1c3RvbUltYWdlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wb3N0Z3Jlc0luc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnBnVXNlcixcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wZ1Bhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnBnUG9ydFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvciBpbiBleGVjdXRpb24nLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBleGVjT3BlcmF0aW9uKClcbiAgICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNyZWF0ZVdpdGhUaW1lb3V0KCk7XG4gICAgICBsb2dJbmZvKCdbQ1JFQVRFLUlOU1RBTkNFXSBEb2NrZXIgQ29tcG9zZSBvcGVyYXRpb24gY29tcGxldGVkJyk7XG5cbiAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnaW5zdGFuY2UtY3JlYXRlZCcsIHtcbiAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgIHBvcnQ6IHJlc3VsdC5wb3J0LFxuICAgICAgICAgIGluc3RhbmNlVHlwZTogZGF0YS5pbnN0YW5jZVR5cGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHdpbmRvd3MubWFpbiAmJiAhd2luZG93cy5tYWluLmlzRGVzdHJveWVkKCkgJiZcbiAgICAgICAgICAgIGV2ZW50LnNlbmRlciAhPT0gd2luZG93cy5tYWluLndlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgd2luZG93cy5tYWluLndlYkNvbnRlbnRzLnNlbmQoJ2luc3RhbmNlLWNyZWF0ZWQnLCB7XG4gICAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgICAgcG9ydDogcmVzdWx0LnBvcnQsXG4gICAgICAgICAgICBpbnN0YW5jZVR5cGU6IGRhdGEuaW5zdGFuY2VUeXBlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvcicsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2luc3RhbmNlLWNyZWF0aW9uLWVycm9yJywge1xuICAgICAgICAgIGluc3RhbmNlVHlwZTogZGF0YS5pbnN0YW5jZVR5cGUsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yIGR1cmluZyBpbnN0YW5jZSBjcmVhdGlvbidcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvciBoYW5kbGluZyByZXF1ZXN0JywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2luc3RhbmNlLWNyZWF0aW9uLWVycm9yJywge1xuICAgICAgICBpbnN0YW5jZVR5cGU6IGRhdGEuaW5zdGFuY2VUeXBlIHx8ICd1bmtub3duJyxcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3Igb2NjdXJyZWQgZHVyaW5nIGluc3RhbmNlIGNyZWF0aW9uJ1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgdXBkYXRlLXBvc3RncmVzLWNyZWRlbnRpYWxzIG1lc3NhZ2UgZnJvbSByZW5kZXJlclxuICBpcGNNYWluLmhhbmRsZSgndXBkYXRlLXBvc3RncmVzLWNyZWRlbnRpYWxzJywgYXN5bmMgKF9ldmVudCwgZGF0YSkgPT4ge1xuICAgIGxvZ0luZm8oJ1tVUERBVEUtUE9TVEdSRVMtQ1JFREVOVElBTFNdIFJlY2VpdmVkIHVwZGF0ZSByZXF1ZXN0Jyk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaW5zdGFuY2VOYW1lLCB1c2VybmFtZSwgcGFzc3dvcmQgfSA9IGRhdGE7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS51cGRhdGVQb3N0Z3Jlc0NyZWRlbnRpYWxzKGluc3RhbmNlTmFtZSwgdXNlcm5hbWUsIHBhc3N3b3JkKTtcblxuICAgICAgaWYgKHJlc3VsdC51cGRhdGVkSW5zdGFuY2VzICYmIHJlc3VsdC51cGRhdGVkSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbG9nSW5mbyhgW1VQREFURS1QT1NUR1JFUy1DUkVERU5USUFMU10gVXBkYXRlZCAke3Jlc3VsdC51cGRhdGVkSW5zdGFuY2VzLmxlbmd0aH0gZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdbVVBEQVRFLVBPU1RHUkVTLUNSRURFTlRJQUxTXSBFcnJvciB1cGRhdGluZyBjcmVkZW50aWFscycsIGVycm9yKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yIHVwZGF0aW5nIGNyZWRlbnRpYWxzJ1xuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFdpbmRvd3Mtc3BlY2lmaWMgYmVoYXZpb3JcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICBsb2dJbmZvKCdXaW5kb3dzIHBsYXRmb3JtIGRldGVjdGVkLCBjaGVja2luZyBmb3IgYXV0b21hdGljIHNldHVwLi4uJyk7XG4gICAgXG4gICAgLy8gU2V0IHVwIFdpbmRvd3MgZGVmYXVsdHNcbiAgICBjb25zdCB3aW5kb3dzU2V0dXBSZXN1bHQgPSBhd2FpdCBzZXR1cFdpbmRvd3NEZWZhdWx0cygpO1xuICAgIGxvZ0luZm8oYFdpbmRvd3MgZGVmYXVsdHMgc2V0dXAgcmVzdWx0OiAke3dpbmRvd3NTZXR1cFJlc3VsdCA/ICdzdWNjZXNzJyA6ICdmYWlsZWQnfWApO1xuICAgIFxuICAgIC8vIENoZWNrIGlmIHNldHVwIGNvbXBsZXRlZCAodGhpcyB3aWxsIHVzZSBXaW5kb3dzLXNwZWNpZmljIGxvZ2ljIHdlIGFkZGVkKVxuICAgIGNvbnN0IHsgY29tcGxldGVkIH0gPSBhd2FpdCBpc1NldHVwQ29tcGxldGVkKCk7XG4gICAgbG9nSW5mbyhgV2luZG93czogSXMgc2V0dXAgY29tcGxldGVkPyAke2NvbXBsZXRlZH1gKTtcbiAgICBcbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICBsb2dJbmZvKCdXaW5kb3dzOiBTZXR1cCBjb21wbGV0ZWQsIHNob3dpbmcgc3BsYXNoIHNjcmVlbi4uLicpO1xuICAgICAgXG4gICAgICBjcmVhdGVTcGxhc2hXaW5kb3coKTtcbiAgICAgIGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICAgIGluaXRpYWxpemVBcHAoKTtcbiAgICAgIFxuICAgICAgYXBwLmFkZExpc3RlbmVyKCd2ZXJpZmljYXRpb24tY29tcGxldGUnIGFzIGFueSwgKCkgPT4ge1xuICAgICAgICBsb2dJbmZvKCdBcHAgZXZlbnQ6IHZlcmlmaWNhdGlvbiBjb21wbGV0ZSBzaWduYWwgcmVjZWl2ZWQnKTtcbiAgICAgICAgc2hvd01haW5XaW5kb3coKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpcGNNYWluLm9uKCd2ZXJpZmljYXRpb24tY29tcGxldGUnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgbG9nSW5mbygnSVBDIGV2ZW50OiB2ZXJpZmljYXRpb24gY29tcGxldGUgc2lnbmFsIHJlY2VpdmVkJyk7XG4gICAgICAgIGxvZ0luZm8oYFZlcmlmaWNhdGlvbiBjb21wbGV0ZSByZWNlaXZlZCBmcm9tIHdpbmRvdyBJRDogJHtldmVudC5zZW5kZXIuaWR9YCk7XG4gICAgICAgIFxuICAgICAgICAvLyBEZWJ1ZyB2ZXJpZmljYXRpb24gcGF0aCBvbiBXaW5kb3dzXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgbG9nSW5mbygnV2luZG93cyBwbGF0Zm9ybTogUHJvY2Vzc2luZyB2ZXJpZmljYXRpb24tY29tcGxldGUgc2lnbmFsJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICBsb2dJbmZvKCdTcGxhc2ggd2luZG93IGV4aXN0cyBhbmQgd2lsbCBiZSBjbG9zZWQnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nSW5mbygnU3BsYXNoIHdpbmRvdyBkb2VzIG5vdCBleGlzdCBvciBpcyBhbHJlYWR5IGRlc3Ryb3llZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgbG9nSW5mbygnTWFpbiB3aW5kb3cgZXhpc3RzIGFuZCB3aWxsIGJlIHNob3duJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0luZm8oJ01haW4gd2luZG93IGRvZXMgbm90IGV4aXN0IG9yIGlzIGFscmVhZHkgZGVzdHJveWVkJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBzaG93TWFpbldpbmRvdygpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ0luZm8oJ1dpbmRvd3M6IFNldHVwIG5vdCBjb21wbGV0ZWQsIHNob3dpbmcgc2V0dXAgc2NyZWVuICh0aGlzIHNob3VsZCBiZSByYXJlKS4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCBzZXR1cFdpbmRvdyA9IGNyZWF0ZVNldHVwV2luZG93KCk7XG4gICAgICBcbiAgICAgIGNvbnN0IG1haW5Db25maWcgPSBnZXRXaW5kb3dDb25maWcoJ21haW4nKTtcbiAgICAgIHNldHVwV2luZG93LnNldFNpemUobWFpbkNvbmZpZy53aWR0aCwgbWFpbkNvbmZpZy5oZWlnaHQpO1xuICAgICAgaWYgKG1haW5Db25maWcubWluV2lkdGggJiYgbWFpbkNvbmZpZy5taW5IZWlnaHQpIHtcbiAgICAgICAgc2V0dXBXaW5kb3cuc2V0TWluaW11bVNpemUobWFpbkNvbmZpZy5taW5XaWR0aCwgbWFpbkNvbmZpZy5taW5IZWlnaHQpO1xuICAgICAgfVxuICAgICAgc2V0dXBXaW5kb3cuY2VudGVyKCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIE9yaWdpbmFsIGJlaGF2aW9yIGZvciBub24tV2luZG93cyBwbGF0Zm9ybXNcbiAgICBsb2dJbmZvKCdDaGVja2luZyBpZiBzZXR1cCBpcyBjb21wbGV0ZWQuLi4nKTtcbiAgICBcbiAgICBjb25zdCB7IGNvbXBsZXRlZCB9ID0gYXdhaXQgaXNTZXR1cENvbXBsZXRlZCgpO1xuICAgIFxuICAgIGlmICghY29tcGxldGVkKSB7XG4gICAgICBsb2dJbmZvKCdTZXR1cCBub3QgY29tcGxldGVkLCBzaG93aW5nIHNldHVwIHNjcmVlbi4uLicpO1xuICAgICAgXG4gICAgICBjb25zdCBzZXR1cFdpbmRvdyA9IGNyZWF0ZVNldHVwV2luZG93KCk7XG4gICAgICBcbiAgICAgIGNvbnN0IG1haW5Db25maWcgPSBnZXRXaW5kb3dDb25maWcoJ21haW4nKTtcbiAgICAgIHNldHVwV2luZG93LnNldFNpemUobWFpbkNvbmZpZy53aWR0aCwgbWFpbkNvbmZpZy5oZWlnaHQpO1xuICAgICAgaWYgKG1haW5Db25maWcubWluV2lkdGggJiYgbWFpbkNvbmZpZy5taW5IZWlnaHQpIHtcbiAgICAgICAgc2V0dXBXaW5kb3cuc2V0TWluaW11bVNpemUobWFpbkNvbmZpZy5taW5XaWR0aCwgbWFpbkNvbmZpZy5taW5IZWlnaHQpO1xuICAgICAgfVxuICAgICAgc2V0dXBXaW5kb3cuY2VudGVyKCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbG9nSW5mbygnTm9ybWFsIHN0YXJ0dXAsIHNob3dpbmcgc3BsYXNoIHNjcmVlbi4uLicpO1xuICAgICAgXG4gICAgICBjcmVhdGVTcGxhc2hXaW5kb3coKTtcbiAgICAgIGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICAgIGluaXRpYWxpemVBcHAoKTtcbiAgICAgIFxuICAgICAgYXBwLmFkZExpc3RlbmVyKCd2ZXJpZmljYXRpb24tY29tcGxldGUnIGFzIGFueSwgKCkgPT4ge1xuICAgICAgICBsb2dJbmZvKCdBcHAgZXZlbnQ6IHZlcmlmaWNhdGlvbiBjb21wbGV0ZSBzaWduYWwgcmVjZWl2ZWQnKTtcbiAgICAgICAgc2hvd01haW5XaW5kb3coKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpcGNNYWluLm9uKCd2ZXJpZmljYXRpb24tY29tcGxldGUnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgbG9nSW5mbygnSVBDIGV2ZW50OiB2ZXJpZmljYXRpb24gY29tcGxldGUgc2lnbmFsIHJlY2VpdmVkJyk7XG4gICAgICAgIGxvZ0luZm8oYFZlcmlmaWNhdGlvbiBjb21wbGV0ZSByZWNlaXZlZCBmcm9tIHdpbmRvdyBJRDogJHtldmVudC5zZW5kZXIuaWR9YCk7XG4gICAgICAgIFxuICAgICAgICAvLyBEZWJ1ZyB2ZXJpZmljYXRpb24gcGF0aCBvbiBXaW5kb3dzXG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgbG9nSW5mbygnV2luZG93cyBwbGF0Zm9ybTogUHJvY2Vzc2luZyB2ZXJpZmljYXRpb24tY29tcGxldGUgc2lnbmFsJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICBsb2dJbmZvKCdTcGxhc2ggd2luZG93IGV4aXN0cyBhbmQgd2lsbCBiZSBjbG9zZWQnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nSW5mbygnU3BsYXNoIHdpbmRvdyBkb2VzIG5vdCBleGlzdCBvciBpcyBhbHJlYWR5IGRlc3Ryb3llZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgbG9nSW5mbygnTWFpbiB3aW5kb3cgZXhpc3RzIGFuZCB3aWxsIGJlIHNob3duJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0luZm8oJ01haW4gd2luZG93IGRvZXMgbm90IGV4aXN0IG9yIGlzIGFscmVhZHkgZGVzdHJveWVkJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBzaG93TWFpbldpbmRvdygpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgaXBjTWFpbi5vbignc3luYy10aGVtZScsIChfZXZlbnQsIHsgbW9kZSwgc291cmNlIH0pID0+IHtcbiAgICBpZiAoZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcykge1xuICAgICAgbG9nSW5mbyhgSWdub3JpbmcgdGhlbWUgc3luYyBkdXJpbmcgdXBkYXRlOiAke21vZGV9IGZyb20gJHtzb3VyY2UgfHwgJ3Vua25vd24nfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdsb2JhbC50aGVtZVVwZGF0ZUluUHJvZ3Jlc3MgPSB0cnVlO1xuXG4gICAgbG9nSW5mbyhgU3luY2luZyB0aGVtZSB0byBhbGwgd2luZG93czogJHttb2RlfSBmcm9tICR7c291cmNlIHx8ICd1bmtub3duJ31gKTtcblxuICAgIGlmIChnbG9iYWwuY3VycmVudFRoZW1lTW9kZSAhPT0gbW9kZSkge1xuICAgICAgZ2xvYmFsLmN1cnJlbnRUaGVtZU1vZGUgPSBtb2RlO1xuXG4gICAgICBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKS5mb3JFYWNoKHdpbmRvdyA9PiB7XG4gICAgICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICBpZiAoc291cmNlICYmIHdpbmRvdy53ZWJDb250ZW50cy5pZCA9PT0gcGFyc2VJbnQoc291cmNlKSkge1xuICAgICAgICAgICAgbG9nSW5mbyhgU2tpcHBpbmcgdGhlbWUgdXBkYXRlIHRvIHNvdXJjZSB3aW5kb3c6ICR7c291cmNlfWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aW5kb3cud2ViQ29udGVudHMuc2VuZCgndGhlbWUtY2hhbmdlZCcsIG1vZGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ0luZm8oYFRoZW1lIGFscmVhZHkgc2V0IHRvICR7bW9kZX0sIG5vIGJyb2FkY2FzdCBuZWVkZWRgKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGdsb2JhbC50aGVtZVVwZGF0ZUluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9LCA1MDApO1xuICB9KTtcblxuICAvLyBIYW5kbGUgb3Blbi1maWxlIG1lc3NhZ2UgZnJvbSByZW5kZXJlclxuICBpcGNNYWluLm9uKCdvcGVuLWZpbGUnLCAoZXZlbnQsIHsgaW5zdGFuY2VOYW1lLCBpbnN0YW5jZVR5cGUsIGZpbGVQYXRoIH0pID0+IHtcbiAgICBsb2dJbmZvKGBPcGVuaW5nIGZpbGUgZm9yIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX0sIGZpbGU6ICR7ZmlsZVBhdGh9YCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhcHAuZ2V0UGF0aCgndXNlckRhdGEnKTtcbiAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCBpbnN0YW5jZVR5cGUsIGluc3RhbmNlTmFtZSwgZmlsZVBhdGgpO1xuXG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhmdWxsUGF0aCkpIHtcbiAgICAgICAgc2hlbGwub3BlblBhdGgoZnVsbFBhdGgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIG9wZW5pbmcgZmlsZScsIGVycik7XG4gICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZmlsZTogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpLCAnd29ya2Rpci5qc29uJyk7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGY4JykpO1xuICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRpdmVQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJEYXRhLndvcmtEaXIsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lLCBmaWxlUGF0aCk7XG5cbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0aXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgc2hlbGwub3BlblBhdGgoYWx0ZXJuYXRpdmVQYXRoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBvcGVuaW5nIGZpbGUnLCBlcnIpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZpbGU6ICR7ZXJyLm1lc3NhZ2V9YFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0ZpbGUgTm90IEZvdW5kJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRmlsZSBkb2VzIG5vdCBleGlzdDogJHtmaWxlUGF0aH1gXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24nLCBlcnJvcik7XG4gICAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgICBtZXNzYWdlOiAnQ291bGQgbm90IGRldGVybWluZSB3b3JrIGRpcmVjdG9yeSBwYXRoJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBoYW5kbGluZyBvcGVuIGZpbGUgcmVxdWVzdCcsIGVycm9yKTtcbiAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgIG1lc3NhZ2U6IGBDb3VsZCBub3Qgb3BlbiBmaWxlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEFkZCBoYW5kbGVyIGZvciB1cGRhdGluZyBEQiBmaWx0ZXJcbiAgaXBjTWFpbi5oYW5kbGUoJ3VwZGF0ZS1vZG9vLWNvbmZpZycsIGFzeW5jIChfZXZlbnQsIHsgaW5zdGFuY2VOYW1lLCBkYkZpbHRlciB9KSA9PiB7XG4gICAgbG9nSW5mbyhgVXBkYXRpbmcgREIgZmlsdGVyIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9LCB2YWx1ZTogJHtkYkZpbHRlcn1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGF3YWl0IHNldHRpbmdzU2VydmljZS5nZXRXb3JrRGlyUGF0aCgpIHx8IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgICAgY29uc3QgaW5zdGFuY2VEaXIgPSBwYXRoLmpvaW4od29ya0RpclBhdGgsICdvZG9vJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgIGNvbnN0IGNvbmZpZ0ZpbGUgPSBwYXRoLmpvaW4oaW5zdGFuY2VEaXIsICdjb25maWcnLCAnb2Rvby5jb25mJyk7XG5cbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb25maWdGaWxlKSkge1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0NvbmZpZyBmaWxlIG5vdCBmb3VuZCcgfTtcbiAgICAgIH1cblxuICAgICAgbGV0IGNvbmZpZ0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZSwgJ3V0ZjgnKTtcblxuICAgICAgaWYgKGRiRmlsdGVyKSB7XG4gICAgICAgIGlmIChjb25maWdDb250ZW50LmluY2x1ZGVzKCdkYmZpbHRlciA9JykpIHtcbiAgICAgICAgICBjb25maWdDb250ZW50ID0gY29uZmlnQ29udGVudC5yZXBsYWNlKC9kYmZpbHRlciA9LipcXG4vLCBgZGJmaWx0ZXIgPSBeJHtpbnN0YW5jZU5hbWV9LiokXFxuYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uZmlnQ29udGVudCArPSBgXFxuZGJmaWx0ZXIgPSBeJHtpbnN0YW5jZU5hbWV9LiokYDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uZmlnQ29udGVudCA9IGNvbmZpZ0NvbnRlbnQucmVwbGFjZSgvZGJmaWx0ZXIgPS4qXFxuLywgJycpO1xuICAgICAgfVxuXG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGNvbmZpZ0ZpbGUsIGNvbmZpZ0NvbnRlbnQsICd1dGY4Jyk7XG5cbiAgICAgIGNvbnN0IGluZm9GaWxlID0gcGF0aC5qb2luKGluc3RhbmNlRGlyLCAnaW5zdGFuY2UtaW5mby5qc29uJyk7XG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbmZvRmlsZSkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpbmZvQ29udGVudCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGluZm9GaWxlLCAndXRmOCcpKTtcbiAgICAgICAgICBpbmZvQ29udGVudC5kYkZpbHRlciA9IGRiRmlsdGVyO1xuICAgICAgICAgIGluZm9Db250ZW50LnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGluZm9GaWxlLCBKU09OLnN0cmluZ2lmeShpbmZvQ29udGVudCwgbnVsbCwgMiksICd1dGY4Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHVwZGF0aW5nIGluc3RhbmNlIGluZm8nLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ0RCIGZpbHRlciB1cGRhdGVkIHN1Y2Nlc3NmdWxseScgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIHVwZGF0aW5nIERCIGZpbHRlcicsIGVycm9yKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBgRXJyb3IgdXBkYXRpbmcgREIgZmlsdGVyOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgaXBjTWFpbi5vbignb3Blbi1pbnN0YW5jZS1mb2xkZXInLCAoZXZlbnQsIHsgaW5zdGFuY2VOYW1lLCBpbnN0YW5jZVR5cGUgfSkgPT4ge1xuICAgIGxvZ0luZm8oYE9wZW5pbmcgJHtpbnN0YW5jZVR5cGV9IGZvbGRlciBmb3IgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtEaXJQYXRoID0gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpKTtcbiAgICAgIGNvbnN0IGluc3RhbmNlUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgaW5zdGFuY2VUeXBlLCBpbnN0YW5jZU5hbWUpO1xuXG4gICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbnN0YW5jZVBhdGgpKSB7XG4gICAgICAgIHNoZWxsLm9wZW5QYXRoKGluc3RhbmNlUGF0aCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICBsb2dFcnJvcihgRXJyb3Igb3BlbmluZyAke2luc3RhbmNlVHlwZX0gZm9sZGVyYCwgZXJyKTtcbiAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBDb3VsZCBub3Qgb3BlbiBmb2xkZXI6ICR7ZXJyLm1lc3NhZ2V9YFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHAuZ2V0UGF0aCgndXNlckRhdGEnKSwgJ3dvcmtkaXIuanNvbicpO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh3b3JrRGlyRmlsZVBhdGgpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmtEaXJEYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMod29ya0RpckZpbGVQYXRoLCAndXRmOCcpKTtcbiAgICAgICAgICAgIGNvbnN0IGFsdGVybmF0aXZlUGF0aCA9IHBhdGguam9pbih3b3JrRGlyRGF0YS53b3JrRGlyLCBpbnN0YW5jZVR5cGUsIGluc3RhbmNlTmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGFsdGVybmF0aXZlUGF0aCkpIHtcbiAgICAgICAgICAgICAgc2hlbGwub3BlblBhdGgoYWx0ZXJuYXRpdmVQYXRoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBvcGVuaW5nIGFsdGVybmF0aXZlICR7aW5zdGFuY2VUeXBlfSBmb2xkZXJgLCBlcnIpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZvbGRlcjogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgIHRpdGxlOiAnRm9sZGVyIE5vdCBGb3VuZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEluc3RhbmNlIGZvbGRlciBkb2VzIG5vdCBleGlzdDogJHtpbnN0YW5jZU5hbWV9YFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHBhcnNpbmcgd29ya2Rpci5qc29uJywgZXJyb3IpO1xuICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgICAgICAgbWVzc2FnZTogJ0NvdWxkIG5vdCBkZXRlcm1pbmUgd29yayBkaXJlY3RvcnkgcGF0aCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICB0aXRsZTogJ0ZvbGRlciBOb3QgRm91bmQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEluc3RhbmNlIGZvbGRlciBkb2VzIG5vdCBleGlzdDogJHtpbnN0YW5jZU5hbWV9YFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBoYW5kbGluZyBvcGVuIGZvbGRlciByZXF1ZXN0JywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZvbGRlcjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZSgnZ2V0LWN1cnJlbnQtdGhlbWUnLCAoX2V2ZW50KSA9PiB7XG4gICAgbG9nSW5mbyhgQ3VycmVudCB0aGVtZSByZXF1ZXN0ZWQsIHJldHVybmluZzogJHtnbG9iYWwuY3VycmVudFRoZW1lTW9kZSB8fCAnbnVsbCd9YCk7XG4gICAgcmV0dXJuIGdsb2JhbC5jdXJyZW50VGhlbWVNb2RlO1xuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZSgnZ2V0LXdpbmRvdy1pZCcsIChldmVudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB3ZWJDb250ZW50cyA9IGV2ZW50LnNlbmRlcjtcbiAgICAgIGNvbnN0IHdpbiA9IEJyb3dzZXJXaW5kb3cuZnJvbVdlYkNvbnRlbnRzKHdlYkNvbnRlbnRzKTtcbiAgICAgIGlmICh3aW4pIHtcbiAgICAgICAgY29uc3QgaWQgPSB3aW4uaWQ7XG4gICAgICAgIGxvZ0luZm8oYFdpbmRvdyBJRCByZXF1ZXN0ZWQ6ICR7aWR9YCk7XG4gICAgICAgIHJldHVybiBpZDtcbiAgICAgIH1cbiAgICAgIGxvZ0Vycm9yKCdDb3VsZCBub3QgZmluZCB3aW5kb3cgZnJvbSB3ZWJDb250ZW50cycpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBnZXR0aW5nIHdpbmRvdyBJRCcsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gR2xvYmFsIGxhbmd1YWdlIHN0b3JhZ2VcbiAgbGV0IGN1cnJlbnRMYW5ndWFnZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgLy8gSGFuZGxlIGxhbmd1YWdlIGNoYW5nZSBzeW5jXG4gIGlwY01haW4ub24oJ2xhbmd1YWdlLWNoYW5nZWQnLCAoX2V2ZW50LCB7IGxhbmd1YWdlIH0pID0+IHtcbiAgICBsb2dJbmZvKCdTeW5jaW5nIGxhbmd1YWdlIHRvIGFsbCB3aW5kb3dzOiAnICsgbGFuZ3VhZ2UpO1xuXG4gICAgY3VycmVudExhbmd1YWdlID0gbGFuZ3VhZ2U7XG5cbiAgICBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKS5mb3JFYWNoKHdpbmRvdyA9PiB7XG4gICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdsYW5ndWFnZS1jaGFuZ2VkJywgbGFuZ3VhZ2UpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICAvLyBIYW5kbGVyIHRvIGdldCBjdXJyZW50IGxhbmd1YWdlXG4gIGlwY01haW4uaGFuZGxlKCdnZXQtY3VycmVudC1sYW5ndWFnZScsICgpID0+IHtcbiAgICByZXR1cm4gY3VycmVudExhbmd1YWdlO1xuICB9KTtcblxuICAvLyBIYW5kbGUgdmVyaWZpY2F0aW9uIGZhaWx1cmVzXG4gIGlwY01haW4ub24oJ3ZlcmlmaWNhdGlvbi1mYWlsZWQnLCAoX2V2ZW50LCB7IGVycm9yIH0pID0+IHtcbiAgICBsb2dFcnJvcignVmVyaWZpY2F0aW9uIGZhaWxlZCcsIGVycm9yKTtcbiAgICBkaWFsb2cuc2hvd0Vycm9yQm94KCdWZXJpZmljYXRpb24gRmFpbGVkJywgYEVycm9yOiAke2Vycm9yfWApO1xuICB9KTtcblxuICAvLyBIYW5kbGUgd2luZG93IGNyZWF0aW9uIHJlcXVlc3RzIGZyb20gcmVuZGVyZXJzXG4gIGlwY01haW4ub24oJ29wZW4td2luZG93JywgKF9ldmVudCwgeyB0eXBlLCBvcHRpb25zIH0pID0+IHtcbiAgICBsb2dJbmZvKGBSZXF1ZXN0IHRvIG9wZW4gd2luZG93OiAke3R5cGV9YCk7XG4gICAgY3JlYXRlV2luZG93KHR5cGUsIG9wdGlvbnMpO1xuICB9KTtcblxuICAvLyBIYW5kbGUgd2luZG93IGNsb3NpbmcgcmVxdWVzdHMgZnJvbSByZW5kZXJlcnNcbiAgaXBjTWFpbi5vbignY2xvc2Utd2luZG93JywgKF9ldmVudCwgeyB0eXBlIH0pID0+IHtcbiAgICBsb2dJbmZvKGBSZXF1ZXN0IHRvIGNsb3NlIHdpbmRvdzogJHt0eXBlfWApO1xuICAgIGlmICh3aW5kb3dzW3R5cGVdICYmICF3aW5kb3dzW3R5cGVdPy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICB3aW5kb3dzW3R5cGVdPy5jbG9zZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gSGFuZGxlIGV4cGxpY2l0IHdpbmRvdyB0aXRsZSBzZXR0aW5nIGZyb20gcmVuZGVyZXJcbiAgaXBjTWFpbi5vbignc2V0LXdpbmRvdy10aXRsZScsIChldmVudCwgdGl0bGUpID0+IHtcbiAgICBjb25zdCB3aW4gPSBCcm93c2VyV2luZG93LmZyb21XZWJDb250ZW50cyhldmVudC5zZW5kZXIpO1xuICAgIGlmICh3aW4pIHtcbiAgICAgIHdpbi5zZXRUaXRsZSh0aXRsZSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgbWVzc2FnZSBkaWFsb2cgcmVxdWVzdHNcbiAgaXBjTWFpbi5oYW5kbGUoJ3Nob3ctbWVzc2FnZS1kaWFsb2cnLCBhc3luYyAoZXZlbnQsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkaWFsb2cuc2hvd01lc3NhZ2VCb3gob3B0aW9ucyk7XG4gICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2RpYWxvZy1yZXNwb25zZScsIHJlc3VsdC5yZXNwb25zZSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG5cbiAgLy8gSGFuZGxlIG9wZW4gZmlsZSBkaWFsb2cgcmVxdWVzdHNcbiAgaXBjTWFpbi5oYW5kbGUoJ3Nob3ctb3Blbi1kaWFsb2cnLCBhc3luYyAoX2V2ZW50LCBvcHRpb25zKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93T3BlbkRpYWxvZyhvcHRpb25zKTtcbiAgfSk7XG5cbiAgLy8gSGFuZGxlIHNhdmUgZmlsZSBkaWFsb2cgcmVxdWVzdHNcbiAgaXBjTWFpbi5oYW5kbGUoJ3Nob3ctc2F2ZS1kaWFsb2cnLCBhc3luYyAoX2V2ZW50LCBvcHRpb25zKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93U2F2ZURpYWxvZyhvcHRpb25zKTtcbiAgfSk7XG5cbiAgLy8gVGhpcyBoYW5kbGVyIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIHNldHVwIHdpbmRvdyBzaWduYWxzIGl0J3MgYWJvdXQgdG8gY2xvc2UgaXRzZWxmXG4gIGlwY01haW4ub24oJ3NldHVwLXdpbmRvdy1jbG9zaW5nJywgKCkgPT4ge1xuICAgIGxvZ0luZm8oJ1tTRVRVUC1DTE9TRV0gUmVjZWl2ZWQgc2V0dXAtd2luZG93LWNsb3Npbmcgc2lnbmFsJyk7XG4gICAgZ2xvYmFsLmNvbWluZ0Zyb21TZXR1cCA9IHRydWU7XG4gIH0pO1xuXG4gIC8vIE1lc3NhZ2UgdG8gcmVzaXplIGFuZCBwcmVwYXJlIHRoZSB3aW5kb3cgZm9yIG1haW4gc2NyZWVuXG4gIGlwY01haW4ub24oJ3ByZXBhcmUtZm9yLW1haW4tc2NyZWVuJywgKCkgPT4ge1xuICAgIGxvZ0luZm8oJz09PT09PT0gUFJFUEFSSU5HIEZPUiBNQUlOIFNDUkVFTiA9PT09PT09Jyk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgY3VycmVudFdpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuICAgICAgaWYgKCFjdXJyZW50V2luZG93KSB7XG4gICAgICAgIGxvZ0Vycm9yKCdObyBmb2N1c2VkIHdpbmRvdyBmb3VuZCEnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYWluQ29uZmlnID0gZ2V0V2luZG93Q29uZmlnKCdtYWluJyk7XG5cbiAgICAgIGN1cnJlbnRXaW5kb3cuc2V0U2l6ZShtYWluQ29uZmlnLndpZHRoLCBtYWluQ29uZmlnLmhlaWdodCk7XG5cbiAgICAgIGlmIChtYWluQ29uZmlnLm1pbldpZHRoICYmIG1haW5Db25maWcubWluSGVpZ2h0KSB7XG4gICAgICAgIGN1cnJlbnRXaW5kb3cuc2V0TWluaW11bVNpemUobWFpbkNvbmZpZy5taW5XaWR0aCwgbWFpbkNvbmZpZy5taW5IZWlnaHQpO1xuICAgICAgfVxuXG4gICAgICBjdXJyZW50V2luZG93LnNldFJlc2l6YWJsZShtYWluQ29uZmlnLnJlc2l6YWJsZSk7XG4gICAgICBjdXJyZW50V2luZG93LnNldFRpdGxlKG1haW5Db25maWcudGl0bGUpO1xuICAgICAgY3VycmVudFdpbmRvdy5jZW50ZXIoKTtcblxuICAgICAgbG9nSW5mbygnV2luZG93IHByZXBhcmVkIGZvciBtYWluIHNjcmVlbicpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgcHJlcGFyaW5nIHdpbmRvdyBmb3IgbWFpbiBzY3JlZW4nLCBlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgZ2V0LWxvZ3MgbWVzc2FnZSBmcm9tIHJlbmRlcmVyIHdpdGggRElSRUNUIG1ldGhvZCBjYWxsIHJhdGhlciB0aGFuIGludm9rZVxuICBpcGNNYWluLm9uKCdnZXQtbG9ncycsIGFzeW5jIChldmVudCwgeyBpbnN0YW5jZU5hbWUsIHRpbWVGaWx0ZXIsIHRhaWwgfSkgPT4ge1xuICAgIGxvZ0luZm8oYEdldHRpbmcgbG9ncyBmb3IgJHtpbnN0YW5jZU5hbWV9LCB0aW1lRmlsdGVyOiAke3RpbWVGaWx0ZXJ9LCB0YWlsOiAke3RhaWx9YCk7XG5cbiAgICB0cnkge1xuICAgICAgbGV0IHNpbmNlUGFyYW0gPSAnJztcbiAgICAgIHN3aXRjaCAodGltZUZpbHRlcikge1xuICAgICAgICBjYXNlICdsYXN0X2hvdXInOlxuICAgICAgICAgIHNpbmNlUGFyYW0gPSAnLS1zaW5jZT0xaCc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2xhc3RfMl9ob3Vycyc6XG4gICAgICAgICAgc2luY2VQYXJhbSA9ICctLXNpbmNlPTJoJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbGFzdF82X2hvdXJzJzpcbiAgICAgICAgICBzaW5jZVBhcmFtID0gJy0tc2luY2U9NmgnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgIHNpbmNlUGFyYW0gPSAnJztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgY21kID0gdGltZUZpbHRlciA9PT0gJ2FsbCdcbiAgICAgICAgICA/IGBkb2NrZXIgbG9ncyAtLXRhaWw9JHt0YWlsfSAke2luc3RhbmNlTmFtZX1gXG4gICAgICAgICAgOiBgZG9ja2VyIGxvZ3MgJHtzaW5jZVBhcmFtfSAke2luc3RhbmNlTmFtZX1gO1xuXG4gICAgICBjb25zdCB7IHNwYXduIH0gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XG4gICAgICBjb25zdCBkb2NrZXJQcm9jZXNzID0gc3Bhd24oY21kLCBbXSwgeyBzaGVsbDogdHJ1ZSB9KTtcblxuICAgICAgbGV0IGxvZ3MgPSAnJztcbiAgICAgIGxldCBlcnJvciA9ICcnO1xuICAgICAgbGV0IHRpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XG5cbiAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgZG9ja2VyUHJvY2Vzcy5raWxsKCk7XG4gICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdsb2dzLXJlc3BvbnNlJywge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdUaW1lb3V0IHdhaXRpbmcgZm9yIGxvZ3MuIFRoZSBjb250YWluZXIgbWlnaHQgbm90IGhhdmUgYW55IGxvZ3MuJ1xuICAgICAgICB9KTtcbiAgICAgIH0sIDEwMDAwKTtcblxuICAgICAgZG9ja2VyUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9ncyArPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICB9KTtcblxuICAgICAgZG9ja2VyUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICAgIGVycm9yICs9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlOiBudW1iZXIpID0+IHtcbiAgICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdsb2dzLXJlc3BvbnNlJywge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIGxvZ3M6IGxvZ3NcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnbG9ncy1yZXNwb25zZScsIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgbWVzc2FnZTogZXJyb3IgfHwgYFByb2Nlc3MgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgZG9ja2VyUHJvY2Vzcy5vbignZXJyb3InLCAoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICBpZiAodGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ0Vycm9yKCdFcnJvciBleGVjdXRpbmcgZG9ja2VyIGxvZ3MgY29tbWFuZCcsIGVycik7XG4gICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdsb2dzLXJlc3BvbnNlJywge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBleGVjdXRpbmcgZG9ja2VyIGxvZ3MgY29tbWFuZDogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgbG9ncycsIGVycm9yKTtcbiAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdsb2dzLXJlc3BvbnNlJywge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTogYEVycm9yIGdldHRpbmcgbG9nczogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBEZWJ1Z2dpbmcgLSBzaG93IGFsbCB3aW5kb3dzIGFmdGVyIGEgdGltZW91dCBpZiBzdGlsbCBpbiBzcGxhc2hcbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKHdpbmRvd3MubWFpbiAmJiAhd2luZG93cy5tYWluLmlzVmlzaWJsZSgpICYmIHdpbmRvd3Muc3BsYXNoICYmIHdpbmRvd3Muc3BsYXNoLmlzVmlzaWJsZSgpKSB7XG4gICAgICBsb2dJbmZvKCdERUJVRzogRm9yY2luZyBtYWluIHdpbmRvdyB0byBzaG93IGFmdGVyIHRpbWVvdXQnKTtcbiAgICAgIHNob3dNYWluV2luZG93KCk7XG4gICAgfVxuICB9LCAxMDAwMCk7XG59KTtcblxuLy8gUXVpdCBhcHBsaWNhdGlvbiB3aGVuIGFsbCB3aW5kb3dzIGFyZSBjbG9zZWQgKGV4Y2VwdCBvbiBtYWNPUylcbmFwcC5vbignd2luZG93LWFsbC1jbG9zZWQnLCAoKSA9PiB7XG4gIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnZGFyd2luJykgYXBwLnF1aXQoKTtcbn0pO1xuXG4vLyBPbiBtYWNPUywgcmVjcmVhdGUgYXBwbGljYXRpb24gd2luZG93IHdoZW4gZG9jayBpY29uIGlzIGNsaWNrZWQgYW5kIG5vIHdpbmRvd3MgYXJlIGF2YWlsYWJsZVxuYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgaWYgKEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpLmxlbmd0aCA9PT0gMCkge1xuICAgIGxvZ0luZm8oJ0FwcCBhY3RpdmF0ZWQgd2l0aCBubyB3aW5kb3dzLCBjcmVhdGluZyBtYWluIHdpbmRvdycpO1xuICAgIGlzU2V0dXBDb21wbGV0ZWQoKS50aGVuKCh7IGNvbXBsZXRlZCB9KSA9PiB7XG4gICAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSBjcmVhdGVNYWluV2luZG93KCk7XG4gICAgICAgIGxvYWRBbmRTaG93V2luZG93KG1haW5XaW5kb3cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3JlYXRlU2V0dXBXaW5kb3coKTtcbiAgICAgIH1cbiAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgc2V0dXAgc3RhdHVzIG9uIGFjdGl2YXRlJywgZXJyb3IpO1xuICAgICAgY29uc3QgbWFpbldpbmRvdyA9IGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICAgIGxvYWRBbmRTaG93V2luZG93KG1haW5XaW5kb3cpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHdpbmRvd3MgPSBCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKTtcbiAgICBjb25zdCB2aXNpYmxlV2luZG93cyA9IHdpbmRvd3MuZmlsdGVyKHdpbiA9PiB3aW4uaXNWaXNpYmxlKCkpO1xuICAgIGlmICh2aXNpYmxlV2luZG93cy5sZW5ndGggPiAwKSB7XG4gICAgICB2aXNpYmxlV2luZG93c1swXS5mb2N1cygpO1xuICAgIH0gZWxzZSBpZiAod2luZG93cy5sZW5ndGggPiAwKSB7XG4gICAgICB3aW5kb3dzWzBdLnNob3coKTtcbiAgICAgIHdpbmRvd3NbMF0uZm9jdXMoKTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vLyBIYW5kbGUgZXh0ZXJuYWwgVVJMIG9wZW5pbmdcbmlwY01haW4ub24oJ29wZW4tZXh0ZXJuYWwtdXJsJywgKF9ldmVudCwgdXJsKSA9PiB7XG4gIGlmICh0eXBlb2YgdXJsID09PSAnc3RyaW5nJykge1xuICAgIHNoZWxsLm9wZW5FeHRlcm5hbCh1cmwpLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcihgRXJyb3Igb3BlbmluZyBleHRlcm5hbCBVUkw6ICR7dXJsfWAsIGVycik7XG4gICAgfSk7XG4gIH1cbn0pO1xuXG4vLyBHZXQgYXBwIHZlcnNpb25cbmlwY01haW4uaGFuZGxlKCdnZXQtYXBwLXZlcnNpb24nLCAoKSA9PiB7XG4gIHJldHVybiBhcHAuZ2V0VmVyc2lvbigpO1xufSk7XG5cbi8vIEdldCBhcHAgcGF0aFxuaXBjTWFpbi5oYW5kbGUoJ2dldC1hcHAtcGF0aCcsIChfZXZlbnQsIG5hbWUpID0+IHtcbiAgY29uc3QgYXBwUGF0aCA9IGFwcC5nZXRQYXRoKG5hbWUgYXMgYW55IHx8ICd1c2VyRGF0YScpO1xuICBsb2dJbmZvKGBTZW5kaW5nIGFwcCBwYXRoIHZpYSBoYW5kbGU6ICR7bmFtZSB8fCAndXNlckRhdGEnfSA9ICR7YXBwUGF0aH1gKTtcbiAgcmV0dXJuIGFwcFBhdGg7XG59KTtcblxuLy8gR2V0IGFwcCBwYXRoIChzeW5jaHJvbm91cyB2ZXJzaW9uIGZvciBtb3JlIHJlbGlhYmxlIHN0YXJ0dXApXG5pcGNNYWluLm9uKCdnZXQtYXBwLXBhdGgtc3luYycsIChldmVudCwgbmFtZSkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGFwcFBhdGggPSBhcHAuZ2V0UGF0aChuYW1lIGFzIGFueSB8fCAndXNlckRhdGEnKTtcbiAgICBsb2dJbmZvKGBTZW5kaW5nIGFwcCBwYXRoIHZpYSBzeW5jOiAke25hbWUgfHwgJ3VzZXJEYXRhJ30gPSAke2FwcFBhdGh9YCk7XG4gICAgZXZlbnQucmV0dXJuVmFsdWUgPSBhcHBQYXRoO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBoYW5kbGluZyBnZXQtYXBwLXBhdGgtc3luYycsIGVycm9yKTtcbiAgICBldmVudC5yZXR1cm5WYWx1ZSA9ICcnO1xuICB9XG59KTtcblxuLyoqXG4gKiBGZXRjaCBHaXRIdWIgcmVsZWFzZXMgZm9yIHRoZSBhcHBsaWNhdGlvblxuICogVXNlZCBmb3IgdGhlIG1hbnVhbCB1cGRhdGUgY2hlY2tpbmcgc3lzdGVtXG4gKi9cbmlwY01haW4uaGFuZGxlKCdmZXRjaC1naXRodWItcmVsZWFzZXMnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgbG9nSW5mbygnRmV0Y2hpbmcgR2l0SHViIHJlbGVhc2VzIGZvciB1cGRhdGUgY2hlY2snKTtcbiAgICBcbiAgICAvLyBHaXRIdWIgQVBJIGVuZHBvaW50IC0gcmVwbGFjZSB3aXRoIHlvdXIgYWN0dWFsIHJlcG9zaXRvcnkgaW5mb1xuICAgIC8vIFRoaXMgaXMgYSBwbGFjZWhvbGRlciAtIHJlcGxhY2Ugd2l0aCB5b3VyIGFjdHVhbCBHaXRIdWIgcmVwb3NpdG9yeVxuICAgIGNvbnN0IGFwaVVybCA9ICdodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL2RhbmllbG1lZGVyb3MyNDI0L29kb28tbWFuYWdlci9yZWxlYXNlcyc7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHJlcXVlc3RcbiAgICBjb25zdCByZXF1ZXN0ID0gbmV0LnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHVybDogYXBpVXJsLFxuICAgICAgcmVkaXJlY3Q6ICdmb2xsb3cnXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2V0IGhlYWRlcnNcbiAgICByZXF1ZXN0LnNldEhlYWRlcignVXNlci1BZ2VudCcsIGBPZG9vLU1hbmFnZXIvJHthcHAuZ2V0VmVyc2lvbigpfWApO1xuICAgIFxuICAgIC8vIENyZWF0ZSBwcm9taXNlIHRvIGhhbmRsZSByZXNwb25zZVxuICAgIGNvbnN0IHJlc3BvbnNlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZXNwb25zZURhdGEgPSAnJztcbiAgICAgIFxuICAgICAgcmVxdWVzdC5vbigncmVzcG9uc2UnLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgcmVzcG9uc2Uub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICByZXNwb25zZURhdGEgKz0gY2h1bmsudG9TdHJpbmcoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXNwb25zZS5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbGVhc2VzID0gSlNPTi5wYXJzZShyZXNwb25zZURhdGEpO1xuICAgICAgICAgICAgICAvLyBHZXQgbGF0ZXN0IG5vbi1kcmFmdCByZWxlYXNlXG4gICAgICAgICAgICAgIGNvbnN0IGxhdGVzdFJlbGVhc2UgPSByZWxlYXNlcy5maW5kKChyZWxlYXNlOiBhbnkpID0+ICFyZWxlYXNlLmRyYWZ0KTtcbiAgICAgICAgICAgICAgaWYgKGxhdGVzdFJlbGVhc2UpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCBsYXRlc3QgR2l0SHViIHJlbGVhc2U6ICR7bGF0ZXN0UmVsZWFzZS50YWdfbmFtZX1gKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGxhdGVzdFJlbGVhc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdObyB2YWxpZCByZWxlYXNlcyBmb3VuZCcpO1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05vIHZhbGlkIHJlbGVhc2VzIGZvdW5kJykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyBHaXRIdWIgQVBJIHJlc3BvbnNlJywgZXJyb3IpO1xuICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgR2l0SHViIEFQSSByZXR1cm5lZCBzdGF0dXMgY29kZSAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9YCk7XG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBHaXRIdWIgQVBJIHJldHVybmVkIHN0YXR1cyBjb2RlICR7cmVzcG9uc2Uuc3RhdHVzQ29kZX1gKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAgICBsb2dFcnJvcignRXJyb3IgZmV0Y2hpbmcgR2l0SHViIHJlbGVhc2VzJywgZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFNldCB0aW1lb3V0ICgxMCBzZWNvbmRzKVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1JlcXVlc3QgdGltZWQgb3V0IGFmdGVyIDEwIHNlY29uZHMnKSk7XG4gICAgICB9LCAxMDAwMCk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2VuZCByZXF1ZXN0XG4gICAgcmVxdWVzdC5lbmQoKTtcbiAgICBcbiAgICByZXR1cm4gYXdhaXQgcmVzcG9uc2VQcm9taXNlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBmZXRjaC1naXRodWItcmVsZWFzZXMgaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8qKlxuICogU2hvdyBzeXN0ZW0gbm90aWZpY2F0aW9uIGZvciBuZXcgdXBkYXRlc1xuICovXG5pcGNNYWluLm9uKCdzaG93LXVwZGF0ZS1ub3RpZmljYXRpb24nLCAoX2V2ZW50LCB7IHRpdGxlLCBib2R5IH0pID0+IHtcbiAgdHJ5IHtcbiAgICAvLyBPbmx5IHByb2NlZWQgaWYgd2UncmUgbm90IG9uIExpbnV4IGFzIHNvbWUgTGludXggZGlzdHJvcyBkb24ndCBzdXBwb3J0IG5vdGlmaWNhdGlvbnMgd2VsbFxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBsb2dJbmZvKCdTa2lwcGluZyB1cGRhdGUgbm90aWZpY2F0aW9uIG9uIExpbnV4IHBsYXRmb3JtJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGxvZ0luZm8oYFNob3dpbmcgdXBkYXRlIG5vdGlmaWNhdGlvbjogJHt0aXRsZX1gKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgbm90aWZpY2F0aW9uXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uID0gbmV3IE5vdGlmaWNhdGlvbih7XG4gICAgICB0aXRsZTogdGl0bGUgfHwgJ1VwZGF0ZSBBdmFpbGFibGUnLFxuICAgICAgYm9keTogYm9keSB8fCAnQSBuZXcgdmVyc2lvbiBvZiBPZG9vIE1hbmFnZXIgaXMgYXZhaWxhYmxlLicsXG4gICAgICBzaWxlbnQ6IGZhbHNlXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2hvdyBub3RpZmljYXRpb25cbiAgICBub3RpZmljYXRpb24uc2hvdygpO1xuICAgIFxuICAgIC8vIEhhbmRsZSBjbGlja1xuICAgIG5vdGlmaWNhdGlvbi5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdVcGRhdGUgbm90aWZpY2F0aW9uIGNsaWNrZWQnKTtcbiAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvd3MubWFpbi53ZWJDb250ZW50cy5zZW5kKCdvcGVuLXVwZGF0ZS1zZWN0aW9uJyk7XG4gICAgICAgIGlmICghd2luZG93cy5tYWluLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgd2luZG93cy5tYWluLnNob3coKTtcbiAgICAgICAgfVxuICAgICAgICB3aW5kb3dzLm1haW4uZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3Igc2hvd2luZyB1cGRhdGUgbm90aWZpY2F0aW9uJywgZXJyb3IpO1xuICB9XG59KTtcblxuLy8gVGVzdCBwb3J0IGF2YWlsYWJpbGl0eSB1c2luZyBhIGRpcmVjdCBzb2NrZXQgdGVzdFxuaXBjTWFpbi5oYW5kbGUoJ3Rlc3QtcG9ydC1hdmFpbGFiaWxpdHknLCBhc3luYyAoX2V2ZW50LCBwb3J0KSA9PiB7XG4gIHRyeSB7XG4gICAgbG9nSW5mbyhgVGVzdGluZyBwb3J0ICR7cG9ydH0gYXZhaWxhYmlsaXR5YCk7XG4gICAgY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG4gICAgY29uc3QgdGVzdGVyID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuXG4gICAgY29uc3QgaXNBdmFpbGFibGUgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGVzdGVyLm9uY2UoJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgcmVzb2x2ZShmYWxzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nRXJyb3IoYFBvcnQgdGVzdCBlbmNvdW50ZXJlZCBhbiBlcnJvcjogJHtlcnIubWVzc2FnZX1gLCBlcnIpO1xuICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGVzdGVyLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHtcbiAgICAgICAgdGVzdGVyLmNsb3NlKCgpID0+IHJlc29sdmUodHJ1ZSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHRlc3Rlci5saXN0ZW4ocG9ydCwgJzAuMC4wLjAnKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBpc0F2YWlsYWJsZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihgRXJyb3IgdGVzdGluZyBwb3J0IGF2YWlsYWJpbGl0eWAsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG4vLyBSZXN0YXJ0IGFwcFxuaXBjTWFpbi5vbigncmVzdGFydC1hcHAnLCAoKSA9PiB7XG4gIGFwcC5yZWxhdW5jaCgpO1xuICBhcHAuZXhpdCgpO1xufSk7XG5cbi8vIFF1aXQgYXBwXG5pcGNNYWluLm9uKCdxdWl0LWFwcCcsICgpID0+IHtcbiAgYXBwLnF1aXQoKTtcbn0pO1xuXG4vLyBDaGVjayBpZiBhdXRvIHVwZGF0ZSBpcyBlbmFibGVkIGluIHNldHRpbmdzXG5pcGNNYWluLmhhbmRsZSgnZ2V0LWF1dG8tdXBkYXRlLWVuYWJsZWQnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgd29ya0RpclBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICd3b3JrZGlyLmpzb24nKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya0RpclBhdGgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyUGF0aCwgJ3V0ZjgnKSk7XG4gICAgY29uc3Qgd29ya0RpciA9IHdvcmtEaXJEYXRhLndvcmtEaXI7XG5cbiAgICBpZiAoIXdvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMod29ya0RpcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpciwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmOCcpKTtcbiAgICByZXR1cm4gc2V0dGluZ3MuYXV0b0NoZWNrVXBkYXRlcyA9PT0gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgYXV0byB1cGRhdGUgc2V0dGluZycsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pOyJdLCJuYW1lcyI6WyJlbGVjdHJvbiIsInBhdGgiLCJvcyIsImZzIiwiTE9HX0ZJTEVfU0laRV9MSU1JVCIsIk1BWF9MT0dfRklMRVMiLCJMb2dMZXZlbCIsImxvZ0luZm8iLCJsb2dFcnJvciIsImRhdGEiLCJzZXR0aW5nc1BhdGgiLCJzZXR0aW5ncyIsImN1cnJlbnRTZXR0aW5ncyIsInVwZGF0ZWRTZXR0aW5ncyIsImV4ZWNBc3luYyIsInByb21pc2lmeSIsImV4ZWMiLCJwb3J0IiwiZXJyb3IiLCJpcGNNYWluIiwiZGlhbG9nIiwiYXBwIiwibG9nRmlsZVBhdGgiLCJzaGVsbCIsIndpbmRvdyIsIndvcmtEaXJGaWxlUGF0aCIsIndvcmtEaXJEYXRhIiwid29ya0RpciIsIkJyb3dzZXJXaW5kb3ciLCJNZW51IiwiZGVmYXVsdFNldHRpbmdzIiwid2luZG93cyIsIm5ldCIsIk5vdGlmaWNhdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQSxJQUFJLGNBQW1CO0FBRWhCLE1BQU0sYUFBYSxNQUFNO0FBRTVCLFNBQU8sT0FBTyxXQUFXLGVBQWUsT0FBTyxXQUFXLE9BQU8sUUFBUTtBQUM3RTtBQUdB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
