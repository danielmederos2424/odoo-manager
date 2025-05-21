var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { ipcMain, dialog, app, shell, BrowserWindow, net, Notification, Menu } from "electron";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import { fileURLToPath } from "url";
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
    this.workDirFilePath = path.join(getAppDataPath(), "workdir.json");
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
      const settingsPath = path.join(workDirPath, "settings.json");
      if (!fs.existsSync(settingsPath)) {
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
      if (!fs.existsSync(this.workDirFilePath)) {
        return null;
      }
      const data = JSON.parse(fs.readFileSync(this.workDirFilePath, "utf-8"));
      if (!data.workDir || !fs.existsSync(data.workDir)) {
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
      ensureDir(path.dirname(this.workDirFilePath));
      fs.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: workDirPath }, null, 2));
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
      const workDirPath = await this.getWorkDirPath();
      if (!workDirPath) {
        return null;
      }
      const settingsPath = path.join(workDirPath, "settings.json");
      if (!fs.existsSync(settingsPath)) {
        return null;
      }
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
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
      const settingsPath = path.join(workDirPath, "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
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
      const settingsPath = path.join(workDirPath, "settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
      logInfo$1("Updated settings");
      return true;
    } catch (error) {
      logError$1("Error updating settings", error);
      return false;
    }
  }
}
const settingsService = new SettingsService();
const isElectron = () => {
  return typeof window !== "undefined" && window.process && window.process.type;
};
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
    this.logLevel = 1;
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
    if (isElectron() && logFile && fs.existsSync(logFile)) {
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
        const baseLogName = path.basename(this.logFile || "", ".log");
        if (path.basename(file).startsWith(`${baseLogName}.`) && path.basename(file).endsWith(".log")) {
          return false;
        }
        try {
          const stats = fs.statSync(file);
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
            fs.unlinkSync(file);
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
      if (ACTIVE_LOG_FILE_PATH && fs.existsSync(ACTIVE_LOG_FILE_PATH)) {
        this.logFile = ACTIVE_LOG_FILE_PATH;
        this.initialized = true;
        if (!this.isSessionHeaderWritten("resume")) {
          try {
            const sessionMessage = `
===============================================
Session resumed: ${this.formatTimestamp(/* @__PURE__ */ new Date())}
===============================================
`;
            fs.appendFileSync(this.logFile, sessionMessage);
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
    if (existingLogFile && fs.existsSync(existingLogFile)) {
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
          fs.appendFileSync(this.logFile, sessionMessage);
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
      const logsPath = getLogsPath(workDirPath || void 0);
      console.log(`Logs directory: ${logsPath}`);
      this.logFile = path.join(logsPath, "app.log");
      console.log(`Using main log file at: ${this.logFile}`);
      if (!fs.existsSync(this.logFile)) {
        const now = /* @__PURE__ */ new Date();
        const initialMessage = `===============================================
Odoo Manager - Application Log (Main Process)
Started: ${this.formatTimestamp(now)}
Environment: ${"production"}
===============================================
`;
        fs.writeFileSync(this.logFile, initialMessage);
        this.markSessionHeaderWritten("start");
      } else if (!this.isSessionHeaderWritten("start")) {
        const sessionMessage = `
===============================================
Session started: ${this.formatTimestamp(/* @__PURE__ */ new Date())}
===============================================
`;
        fs.appendFileSync(this.logFile, sessionMessage);
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
    if (!this.initialized || !this.logFile || !fs.existsSync(this.logFile)) {
      return false;
    }
    try {
      const stats = fs.statSync(this.logFile);
      if (stats.size < LOG_FILE_SIZE_LIMIT$1) {
        return false;
      }
      console.log(`Log file size (${stats.size} bytes) exceeds limit (${LOG_FILE_SIZE_LIMIT$1} bytes), rotating logs...`);
      const logsDir = path.dirname(this.logFile);
      const baseLogName = path.basename(this.logFile, ".log");
      const rotatedLogs = fs.readdirSync(logsDir).filter((f) => f.startsWith(`${baseLogName}.`) && f.endsWith(".log")).sort();
      for (let i = rotatedLogs.length - 1; i >= 0; i--) {
        const match = rotatedLogs[i].match(new RegExp(`${baseLogName}.(d+).log`));
        if (match) {
          const rotationNumber = parseInt(match[1], 10);
          if (rotationNumber >= MAX_LOG_FILES$1 - 1) {
            const oldestLog = path.join(logsDir, rotatedLogs[i]);
            fs.unlinkSync(oldestLog);
            console.log(`Deleted old log file: ${oldestLog}`);
          } else {
            const oldPath = path.join(logsDir, rotatedLogs[i]);
            const newPath = path.join(logsDir, `${baseLogName}.${rotationNumber + 1}.log`);
            fs.renameSync(oldPath, newPath);
            console.log(`Rotated log file: ${oldPath} -> ${newPath}`);
          }
        }
      }
      const rotatedLogPath = path.join(logsDir, `${baseLogName}.1.log`);
      fs.renameSync(this.logFile, rotatedLogPath);
      console.log(`Rotated main log file: ${this.logFile} -> ${rotatedLogPath}`);
      const now = /* @__PURE__ */ new Date();
      const initialMessage = `===============================================
Odoo Manager - Application Log (Rotated)
Started: ${this.formatTimestamp(now)}
Environment: ${"production"}
===============================================
`;
      fs.writeFileSync(this.logFile, initialMessage);
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
        fs.appendFileSync(this.logFile, logMessage + "\n");
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
      const logsPath = getLogsPath();
      if (!fs.existsSync(logsPath)) {
        return [];
      }
      return fs.readdirSync(logsPath).filter((file) => file.endsWith(".log")).map((file) => path.join(logsPath, file));
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
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
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
function getAppDataPath() {
  const appName = "odoo-manager";
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA || "", appName);
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", appName);
    case "linux":
      return path.join(os.homedir(), ".config", appName);
    default:
      return path.join(os.homedir(), `.${appName}`);
  }
}
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
function getLogsPath(customWorkDirPath) {
  const basePath = customWorkDirPath || getWorkDirPath() || getAppDataPath();
  const logsPath = path.join(basePath, "logs");
  ensureDir(logsPath);
  return logsPath;
}
function getWorkDirPath() {
  try {
    const workDirFilePath = path.join(getAppDataPath(), "workdir.json");
    if (!fs.existsSync(workDirFilePath)) {
      return null;
    }
    const data = JSON.parse(fs.readFileSync(workDirFilePath, "utf-8"));
    return data.workDir || null;
  } catch (error) {
    logError$1("Error getting work directory path:", error);
    return null;
  }
}
const execAsync = promisify(exec);
class DockerComposeService {
  constructor() {
    __publicField(this, "projectsPath");
    this.projectsPath = path.join(getAppDataPath(), "projects");
    if (!fs.existsSync(this.projectsPath)) {
      try {
        fs.mkdirSync(this.projectsPath, { recursive: true });
        logInfo$1(`Created projects directory: ${this.projectsPath}`);
      } catch (err) {
        logError$1(`Failed to create projects directory`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
  /**
   * Initialize or update the projects path based on workdir
   */
  async initializeProjectsPath() {
    try {
      const workDirPath = await settingsService.getWorkDirPath();
      if (workDirPath) {
        this.projectsPath = workDirPath;
        const odooPath = path.join(this.projectsPath, "odoo");
        const postgresPath = path.join(this.projectsPath, "postgres");
        if (!fs.existsSync(odooPath)) {
          fs.mkdirSync(odooPath, { recursive: true });
        }
        if (!fs.existsSync(postgresPath)) {
          fs.mkdirSync(postgresPath, { recursive: true });
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
      await execAsync("docker info");
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
      const { stdout } = await execAsync(`docker network ls --format "{{.Name}}"`);
      if (!stdout.includes(networkName)) {
        logInfo$1(`Creating network: ${networkName}`);
        await execAsync(`docker network create ${networkName}`);
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
   */
  async checkPortAvailability(port) {
    try {
      logInfo$1(`Testing port ${port} availability`);
      const net2 = require("net");
      const tester = net2.createServer();
      await new Promise((resolve, reject) => {
        tester.once("error", (err) => {
          if (err.code === "EADDRINUSE") {
            logInfo$1(`Port ${port} is in use`);
            reject(new Error(`Port ${port} is already in use`));
          } else {
            reject(err);
          }
        });
        tester.once("listening", () => {
          logInfo$1(`Port ${port} is available`);
          tester.close(() => resolve());
        });
        tester.listen(port, "0.0.0.0");
      });
      return port;
    } catch (err) {
      logInfo$1(`Finding alternative port to ${port}`);
      let newPort = null;
      for (let testPort = port + 1; testPort < port + 20; testPort++) {
        try {
          const net2 = require("net");
          const tester = net2.createServer();
          const isAvailable = await new Promise((resolve) => {
            tester.once("error", () => resolve(false));
            tester.once("listening", () => {
              tester.close(() => resolve(true));
            });
            tester.listen(testPort, "0.0.0.0");
          });
          if (isAvailable) {
            newPort = testPort;
            logInfo$1(`Found available port: ${newPort}`);
            break;
          }
        } catch (e) {
          logInfo$1(`Port ${testPort} test failed`);
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
      await execAsync("docker compose version");
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
      const projectDir = path.join(this.projectsPath, "postgres", instanceName);
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
      if (fs.existsSync(projectDir)) {
        logInfo$1(`Instance directory already exists: ${projectDir}`);
        return { success: false, message: `Instance ${instanceName} already exists` };
      }
      logInfo$1(`Creating project directory: ${projectDir}`);
      fs.mkdirSync(projectDir, { recursive: true });
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
      const composeFilePath = path.join(projectDir, "docker-compose.yml");
      logInfo$1(`Writing Docker Compose file to ${composeFilePath}`);
      fs.writeFileSync(composeFilePath, composeContent, "utf8");
      if (!fs.existsSync(composeFilePath)) {
        logError$1(`Compose file not created: ${composeFilePath}`);
        return { success: false, message: "Failed to create Docker Compose file" };
      }
      const infoFile = path.join(projectDir, "instance-info.json");
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
      fs.writeFileSync(infoFile, JSON.stringify(info, null, 2), "utf8");
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
        projectDir = path.join(this.projectsPath, "postgres", instanceName);
      } else {
        projectDir = path.join(this.projectsPath, "odoo", instanceName);
      }
      if (!fs.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      const composeFile = path.join(projectDir, "docker-compose.yml");
      if (!fs.existsSync(composeFile)) {
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
      const projectDir = path.join(this.projectsPath, instanceType, instanceName);
      logInfo$1(`Stopping instance: ${instanceName}`);
      if (!fs.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      const composeFile = path.join(projectDir, "docker-compose.yml");
      if (!fs.existsSync(composeFile)) {
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
      const projectDir = path.join(this.projectsPath, instanceType, instanceName);
      logInfo$1(`Deleting instance: ${instanceName}`);
      if (!fs.existsSync(projectDir)) {
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
        fs.rmSync(projectDir, { recursive: true, force: true });
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
      const projectDir = path.join(this.projectsPath, instanceType, instanceName);
      logInfo$1(`Getting logs for instance: ${instanceName}`);
      if (!fs.existsSync(projectDir)) {
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
      if (!fs.existsSync(this.projectsPath)) {
        logInfo$1("Base directory does not exist");
        return instances;
      }
      const scanDirectory = async (dirPath, instanceType) => {
        if (!fs.existsSync(dirPath)) {
          logInfo$1(`${instanceType} directory does not exist: ${dirPath}`);
          return;
        }
        const dirs = fs.readdirSync(dirPath);
        logInfo$1(`Found ${dirs.length} directories in ${instanceType} path`);
        for (const dir of dirs) {
          const instanceDir = path.join(dirPath, dir);
          const composeFile = path.join(instanceDir, "docker-compose.yml");
          const infoFile = path.join(instanceDir, "instance-info.json");
          if (fs.existsSync(composeFile) && fs.lstatSync(instanceDir).isDirectory()) {
            let status = "Unknown";
            let info = {};
            try {
              const { stdout } = await execAsync(`docker ps --filter "name=${dir}" --format "{{.Status}}"`);
              status = stdout.trim() ? stdout.trim() : "Not running";
            } catch (error) {
              status = "Not running";
            }
            if (fs.existsSync(infoFile)) {
              try {
                info = JSON.parse(fs.readFileSync(infoFile, "utf-8"));
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
      await scanDirectory(path.join(this.projectsPath, "odoo"), "odoo");
      await scanDirectory(path.join(this.projectsPath, "postgres"), "postgres");
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
      const projectDir = path.join(this.projectsPath, "postgres", instanceName);
      logInfo$1(`Updating PostgreSQL credentials for instance: ${instanceName}`);
      if (!fs.existsSync(projectDir)) {
        return { success: false, message: `Instance ${instanceName} does not exist` };
      }
      const composeFilePath = path.join(projectDir, "docker-compose.yml");
      if (!fs.existsSync(composeFilePath)) {
        return { success: false, message: `Docker Compose file for ${instanceName} not found` };
      }
      logInfo$1(`Checking for dependent Odoo instances that need updated credentials`);
      const instances = await this.listInstances();
      const dependentInstances = instances.filter(
        (instance) => instance.info && instance.info.type === "odoo" && instance.info.postgresInstance === instanceName
      );
      const dependentNames = dependentInstances.map((instance) => instance.name);
      logInfo$1(`Found ${dependentNames.length} dependent Odoo instances: ${dependentNames.join(", ") || "none"}`);
      const content = fs.readFileSync(composeFilePath, "utf8");
      const updatedContent = content.replace(/- POSTGRES_PASSWORD=[^\n]+/g, `- POSTGRES_PASSWORD=${newPassword}`).replace(/- POSTGRES_USER=[^\n]+/g, `- POSTGRES_USER=${newUsername}`);
      fs.writeFileSync(composeFilePath, updatedContent, "utf8");
      const infoFilePath = path.join(projectDir, "instance-info.json");
      if (fs.existsSync(infoFilePath)) {
        const infoContent = fs.readFileSync(infoFilePath, "utf8");
        const info = JSON.parse(infoContent);
        info.username = newUsername;
        info.password = newPassword;
        info.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        fs.writeFileSync(infoFilePath, JSON.stringify(info, null, 2), "utf8");
      }
      const composeCommand = await this.getComposeCommand();
      logInfo$1(`Restarting PostgreSQL instance: ${instanceName}`);
      await execAsync(`cd "${projectDir}" && ${composeCommand} down && ${composeCommand} up -d`);
      const updatedInstances = [];
      const failedUpdates = [];
      for (const odooInstance of dependentInstances) {
        try {
          logInfo$1(`Updating config for dependent Odoo instance: ${odooInstance.name}`);
          const odooDir = path.join(this.projectsPath, "odoo", odooInstance.name);
          const configDir = path.join(odooDir, "config");
          const odooConfPath = path.join(configDir, "odoo.conf");
          if (fs.existsSync(odooConfPath)) {
            let odooConfContent = fs.readFileSync(odooConfPath, "utf8");
            odooConfContent = odooConfContent.replace(/db_user = .*/g, `db_user = ${newUsername}`).replace(/db_password = .*/g, `db_password = ${newPassword}`);
            fs.writeFileSync(odooConfPath, odooConfContent, "utf8");
            logInfo$1(`Updated odoo.conf for ${odooInstance.name}`);
            const odooInfoPath = path.join(odooDir, "instance-info.json");
            if (fs.existsSync(odooInfoPath)) {
              const odooInfo = JSON.parse(fs.readFileSync(odooInfoPath, "utf8"));
              if (!odooInfo.pgCredentials) odooInfo.pgCredentials = {};
              odooInfo.pgCredentials.username = newUsername;
              odooInfo.pgCredentials.password = newPassword;
              odooInfo.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
              fs.writeFileSync(odooInfoPath, JSON.stringify(odooInfo, null, 2), "utf8");
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
      const projectDir = path.join(this.projectsPath, "odoo", instanceName);
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
      if (fs.existsSync(projectDir)) {
        logInfo$1(`Instance directory already exists: ${projectDir}`);
        return { success: false, message: `Instance ${instanceName} already exists` };
      }
      logInfo$1(`Creating project directory: ${projectDir}`);
      fs.mkdirSync(projectDir, { recursive: true });
      const configDir = path.join(projectDir, "config");
      fs.mkdirSync(configDir, { recursive: true });
      const addonsDir = path.join(projectDir, "addons");
      fs.mkdirSync(addonsDir, { recursive: true });
      const odooConfPath = path.join(configDir, "odoo.conf");
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
      fs.writeFileSync(odooConfPath, odooConfContent, "utf8");
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
      const composeFilePath = path.join(projectDir, "docker-compose.yml");
      logInfo$1(`Writing Docker Compose file to ${composeFilePath}`);
      fs.writeFileSync(composeFilePath, composeContent, "utf8");
      const enterpriseAddonsDir = path.join(this.projectsPath, "enterprise_addons", version);
      if (edition === "Enterprise" && !fs.existsSync(enterpriseAddonsDir)) {
        logInfo$1(`Enterprise addons directory not found: ${enterpriseAddonsDir}`);
        fs.mkdirSync(enterpriseAddonsDir, { recursive: true });
        const readmePath = path.join(enterpriseAddonsDir, "README.txt");
        fs.writeFileSync(readmePath, `This directory should contain Odoo Enterprise addons for version ${version}.
If you have access to Odoo Enterprise repository, please clone or copy those addons to this location.`, "utf8");
      }
      const infoFile = path.join(projectDir, "instance-info.json");
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
      fs.writeFileSync(infoFile, JSON.stringify(info, null, 2), "utf8");
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
    const handlers = ipcMain._invokeHandlers;
    if (handlers && handlers.has && handlers.has(channel)) {
      logInfo$1(`IPC handler already exists for channel: ${channel}, not registering again`);
      return;
    }
    try {
      ipcMain.handle(channel, handler);
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
    dialog.showErrorBox(title, message);
  });
  safeRegisterHandler("show-message-dialog", async (_event, options) => {
    logInfo$1("Showing message dialog", { title: options.title });
    return await dialog.showMessageBox(options);
  });
  safeRegisterHandler("show-save-dialog", async (_event, options) => {
    logInfo$1("Showing save dialog", { title: options.title });
    return await dialog.showSaveDialog(options);
  });
  safeRegisterHandler("show-open-dialog", async (_event, options) => {
    logInfo$1("Showing open dialog", { title: options.title });
    return await dialog.showOpenDialog(options);
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
  return path.join(app.getPath("userData"), "logger-lock.json");
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
    fs.writeFileSync(lockFilePath, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Error writing logger lock file:", err);
    return false;
  }
}
function getLogFileLock() {
  try {
    const lockFilePath = getLockFilePath();
    if (fs.existsSync(lockFilePath)) {
      const data = JSON.parse(fs.readFileSync(lockFilePath));
      if (data.activeLogFile && fs.existsSync(data.activeLogFile)) {
        return data.activeLogFile;
      } else {
        if (data.activeLogFile) {
          try {
            const logDir = path.dirname(data.activeLogFile);
            if (!fs.existsSync(logDir)) {
              fs.mkdirSync(logDir, { recursive: true });
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
const getAppDir = () => {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  if (import.meta && import.meta.url) {
    try {
      const filename = fileURLToPath(import.meta.url);
      return path.dirname(filename);
    } catch (e) {
      console.error("Error creating __dirname polyfill:", e);
    }
  }
  const appPath = app.getAppPath();
  console.log("Using app path as fallback:", appPath);
  return appPath;
};
const __dirname = getAppDir();
console.log("Node environment:", "production");
console.log("Current working directory:", process.cwd());
console.log("Dirname polyfill:", __dirname);
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
    const appDataPath = app.getPath("userData");
    let workDirPath = null;
    const workDirFilePath = path.join(appDataPath, "workdir.json");
    if (fs.existsSync(workDirFilePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(workDirFilePath, "utf-8"));
        workDirPath = data.workDir;
      } catch (err) {
        console.error("Error parsing workdir.json:", err);
      }
    }
    const logsPath = workDirPath ? path.join(workDirPath, "logs") : path.join(appDataPath, "logs");
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }
    return path.join(logsPath, "app.log");
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
      if (!fs.existsSync(logFilePath)) {
        const initialMessage = `===============================================
Odoo Manager - Application Log (Main Process)
Started: ${(/* @__PURE__ */ new Date()).toLocaleString()}
Environment: ${"production"}
===============================================
`;
        fs.writeFileSync(logFilePath, initialMessage);
        console.log(`Log file created at: ${logFilePath}`);
      } else {
        const sessionMessage = `
===============================================
Session started: ${(/* @__PURE__ */ new Date()).toLocaleString()}
===============================================
`;
        checkAndRotateLogFile();
        fs.appendFileSync(logFilePath, sessionMessage);
        console.log(`Using existing log file at: ${logFilePath}`);
      }
    }
  } catch (err) {
    console.error("Error initializing log file:", err);
  }
}
function checkAndRotateLogFile() {
  if (!logFilePath || !fs.existsSync(logFilePath)) {
    return false;
  }
  try {
    const stats = fs.statSync(logFilePath);
    if (stats.size < LOG_FILE_SIZE_LIMIT) {
      return false;
    }
    console.log(`Log file size (${stats.size} bytes) exceeds limit (${LOG_FILE_SIZE_LIMIT} bytes), rotating logs...`);
    const logsDir = path.dirname(logFilePath);
    const baseLogName = path.basename(logFilePath, ".log");
    const rotatedLogs = fs.readdirSync(logsDir).filter((f) => f.startsWith(`${baseLogName}.`) && f.endsWith(".log")).sort();
    for (let i = rotatedLogs.length - 1; i >= 0; i--) {
      const match = rotatedLogs[i].match(new RegExp(`${baseLogName}.(d+).log`));
      if (match) {
        const rotationNumber = parseInt(match[1], 10);
        if (rotationNumber >= MAX_LOG_FILES - 1) {
          const oldestLog = path.join(logsDir, rotatedLogs[i]);
          fs.unlinkSync(oldestLog);
          console.log(`Deleted old log file: ${oldestLog}`);
        } else {
          const oldPath = path.join(logsDir, rotatedLogs[i]);
          const newPath = path.join(logsDir, `${baseLogName}.${rotationNumber + 1}.log`);
          fs.renameSync(oldPath, newPath);
          console.log(`Rotated log file: ${oldPath} -> ${newPath}`);
        }
      }
    }
    const rotatedLogPath = path.join(logsDir, `${baseLogName}.1.log`);
    fs.renameSync(logFilePath, rotatedLogPath);
    console.log(`Rotated main log file: ${logFilePath} -> ${rotatedLogPath}`);
    const now = /* @__PURE__ */ new Date();
    const initialMessage = `===============================================
Odoo Manager - Application Log (Rotated)
Started: ${now.toLocaleString()}
Environment: ${"production"}
===============================================
`;
    fs.writeFileSync(logFilePath, initialMessage);
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
    fs.appendFileSync(logFilePath, message + "\n");
  } catch (err) {
    console.error("Error writing to log file:", err);
  }
}
app.setName("odoo-manager");
app.setAboutPanelOptions({
  applicationName: "Odoo Manager",
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
  copyright: "© 2025 WebGraphix",
  authors: ["WebGraphix"],
  website: "https://odoo.webgraphix.online",
  credits: "Professional Odoo instance management tool for Docker environments"
});
global.allowSplashClose = false;
global.comingFromSetup = false;
global.currentThemeMode = null;
global.themeUpdateInProgress = false;
const typedIpcMain = ipcMain;
ipcMain.on("register-log-file", (_event, logFilePath2) => {
  try {
    if (!ACTIVE_LOG_FILE && logFilePath2 && fs.existsSync(logFilePath2)) {
      ACTIVE_LOG_FILE = logFilePath2;
      setLogFileLock(logFilePath2);
      logInfo(`Registered active log file: ${logFilePath2}`);
    }
  } catch (err) {
    console.error("Error registering log file:", err);
  }
});
ipcMain.handle("get-active-log-file", () => {
  try {
    ACTIVE_LOG_FILE = getLogFileLock();
    return ACTIVE_LOG_FILE;
  } catch (err) {
    console.error("Error getting active log file:", err);
    return null;
  }
});
ipcMain.handle("get-log-file-path", async () => {
  try {
    const appDataPath = app.getPath("userData");
    let workDirPath = null;
    const workDirFilePath = path.join(appDataPath, "workdir.json");
    if (fs.existsSync(workDirFilePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(workDirFilePath, "utf-8"));
        workDirPath = data.workDir;
      } catch (err) {
        logError("Error parsing workdir.json", err);
      }
    }
    const logsPath = workDirPath && fs.existsSync(workDirPath) ? path.join(workDirPath, "logs") : path.join(appDataPath, "logs");
    if (!fs.existsSync(logsPath)) {
      return null;
    }
    const mainLogPath = path.join(logsPath, "app.log");
    if (fs.existsSync(mainLogPath)) {
      return mainLogPath;
    }
    const logFiles = fs.readdirSync(logsPath).filter((file) => file.endsWith(".log")).map((file) => path.join(logsPath, file));
    if (logFiles.length === 0) {
      return null;
    }
    return logFiles.sort((a, b) => {
      const statA = fs.statSync(a);
      const statB = fs.statSync(b);
      return statB.birthtimeMs - statA.birthtimeMs;
    })[0];
  } catch (error) {
    logError("Error in get-log-file-path handler", error);
    return null;
  }
});
ipcMain.handle("open-log-file", async (_event, { logFilePath: logFilePath2 }) => {
  try {
    if (!logFilePath2 || !fs.existsSync(logFilePath2)) {
      logError(`Log file not found: ${logFilePath2}`);
      return false;
    }
    await shell.openPath(logFilePath2);
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
        ipcMain.removeListener("exit-confirmation-response", responseHandler);
        if (alreadyConfirmed) {
          logInfo("Exit already confirmed by user, allowing termination");
          resolve(true);
          return;
        }
        resolve(canTerminate);
      };
      ipcMain.once("exit-confirmation-response", responseHandler);
      mainWindow.webContents.send("check-running-containers");
      setTimeout(() => {
        ipcMain.removeListener("exit-confirmation-response", responseHandler);
        logInfo("No response from renderer about running containers, allowing termination");
        resolve(true);
      }, 2e3);
    });
  } catch (error) {
    logError("Error checking for running containers", error);
    return true;
  }
}
function loadAndShowProdWindow(window2) {
  if (!window2 || window2.isDestroyed()) return;
  const htmlPath = path.resolve(__dirname, "../dist/index.html");
  logInfo(`Loading main file from: ${htmlPath}`);
  window2.loadFile(htmlPath, { hash: "main" }).then(() => {
    if (!window2 || window2.isDestroyed()) return;
    window2.show();
    window2.focus();
    emitMainWindowVisible(window2);
  }).catch((err) => {
    logError("Failed to load main file", err);
    if (!window2 || window2.isDestroyed()) return;
    window2.show();
    window2.focus();
    emitMainWindowVisible(window2);
  });
}
function loadAndShowWindow(window2) {
  if (!window2) {
    logError("Cannot load and show a null or undefined window!");
    return;
  }
  {
    loadAndShowProdWindow(window2);
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
    const workDirFilePath = path.join(app.getPath("userData"), "workdir.json");
    if (!fs.existsSync(workDirFilePath)) {
      logInfo("Work directory file does not exist, setup not completed");
      return { completed: false };
    }
    const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, "utf8"));
    const workDir = workDirData.workDir;
    if (!workDir || !fs.existsSync(workDir)) {
      logInfo("Work directory does not exist, setup not completed");
      return { completed: false };
    }
    const settingsPath = path.join(workDir, "settings.json");
    if (!fs.existsSync(settingsPath)) {
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
  const preloadPath = path.join(__dirname, "preload.js");
  logInfo(`Using preload path for setup window: ${preloadPath}`);
  const setupWindow = new BrowserWindow({
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
    setupWindow.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "setup" }).catch((err) => {
      logError("Failed to load setup file", err);
    });
  }
  setupWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch((err) => {
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
  const preloadPath = path.join(__dirname, "preload.js");
  logInfo(`Using preload path: ${preloadPath}`);
  const splash = new BrowserWindow({
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
      devTools: false
    }
  });
  splash.on("close", (event) => {
    if (global.allowSplashClose) {
      return;
    }
    event.preventDefault();
    app.emit("verification-complete");
  });
  splash.once("ready-to-show", () => {
    splash.show();
  });
  {
    const htmlPath = path.resolve(__dirname, "../dist/index.html");
    logInfo(`Loading splash file from: ${htmlPath}`);
    splash.loadFile(htmlPath, { hash: "splash" }).catch((err) => {
      logError("Failed to load splash file", err);
    });
  }
  windows.splash = splash;
  return splash;
}
function createMainWindow() {
  logInfo("Creating main window");
  const config = getWindowConfig("main");
  const preloadPath = path.join(__dirname, "preload.js");
  logInfo(`Using preload path for main window: ${preloadPath}`);
  const mainWindow = new BrowserWindow({
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
      app.quit();
    } else {
      logInfo("App termination cancelled by user");
      terminationInProgress = false;
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch((err) => {
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
  const preloadPath = path.join(__dirname, "preload.js");
  logInfo(`Using preload path for ${windowType} window: ${preloadPath}`);
  const window2 = new BrowserWindow({
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
    window2.loadFile(path.join(__dirname, "../dist/index.html"), { hash: windowType }).catch((err) => {
      logError(`Failed to load ${windowType} file`, err);
      if (!window2.isDestroyed()) {
        window2.show();
      }
    });
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
      ipcMain.once("window-fade-out-confirm", () => {
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
      label: app.name,
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
                  await shell.openPath(logFilePath2);
                } else {
                  dialog.showMessageBox({
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
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
app.whenReady().then(async () => {
  initLogFile();
  logInfo("Application ready, initializing...");
  ACTIVE_LOG_FILE = getLogFileLock();
  if (ACTIVE_LOG_FILE) {
    logInfo(`Found existing log file from lock: ${ACTIVE_LOG_FILE}`);
  }
  initializeIpcHandlers();
  createAppMenu();
  ipcMain.on("create-instance", async (event, data) => {
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
  ipcMain.handle("update-postgres-credentials", async (_event, data) => {
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
    app.addListener("verification-complete", () => {
      logInfo("App event: verification complete signal received");
      showMainWindow();
    });
    ipcMain.on("verification-complete", () => {
      logInfo("IPC event: verification complete signal received");
      showMainWindow();
    });
  }
  ipcMain.on("sync-theme", (_event, { mode, source }) => {
    if (global.themeUpdateInProgress) {
      logInfo(`Ignoring theme sync during update: ${mode} from ${source || "unknown"}`);
      return;
    }
    global.themeUpdateInProgress = true;
    logInfo(`Syncing theme to all windows: ${mode} from ${source || "unknown"}`);
    if (global.currentThemeMode !== mode) {
      global.currentThemeMode = mode;
      BrowserWindow.getAllWindows().forEach((window2) => {
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
  ipcMain.on("open-file", (event, { instanceName, instanceType, filePath }) => {
    logInfo(`Opening file for instance: ${instanceName}, file: ${filePath}`);
    try {
      const workDirPath = app.getPath("userData");
      const fullPath = path.join(workDirPath, instanceType, instanceName, filePath);
      if (fs.existsSync(fullPath)) {
        shell.openPath(fullPath).catch((err) => {
          logError("Error opening file", err);
          event.sender.send("show-error-dialog", {
            title: "Error",
            message: `Could not open file: ${err.message}`
          });
        });
      } else {
        const workDirFilePath = path.join(app.getPath("userData"), "workdir.json");
        if (fs.existsSync(workDirFilePath)) {
          try {
            const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, "utf8"));
            const alternativePath = path.join(workDirData.workDir, instanceType, instanceName, filePath);
            if (fs.existsSync(alternativePath)) {
              shell.openPath(alternativePath).catch((err) => {
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
  ipcMain.handle("update-odoo-config", async (_event, { instanceName, dbFilter }) => {
    logInfo(`Updating DB filter for instance: ${instanceName}, value: ${dbFilter}`);
    try {
      const workDirPath = await settingsService.getWorkDirPath() || app.getPath("userData");
      const instanceDir = path.join(workDirPath, "odoo", instanceName);
      const configFile = path.join(instanceDir, "config", "odoo.conf");
      if (!fs.existsSync(configFile)) {
        return { success: false, message: "Config file not found" };
      }
      let configContent = fs.readFileSync(configFile, "utf8");
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
      fs.writeFileSync(configFile, configContent, "utf8");
      const infoFile = path.join(instanceDir, "instance-info.json");
      if (fs.existsSync(infoFile)) {
        try {
          const infoContent = JSON.parse(fs.readFileSync(infoFile, "utf8"));
          infoContent.dbFilter = dbFilter;
          infoContent.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          fs.writeFileSync(infoFile, JSON.stringify(infoContent, null, 2), "utf8");
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
  ipcMain.on("open-instance-folder", (event, { instanceName, instanceType }) => {
    logInfo(`Opening ${instanceType} folder for instance: ${instanceName}`);
    try {
      const workDirPath = path.join(app.getPath("userData"));
      const instancePath = path.join(workDirPath, instanceType, instanceName);
      if (fs.existsSync(instancePath)) {
        shell.openPath(instancePath).catch((err) => {
          logError(`Error opening ${instanceType} folder`, err);
          event.sender.send("show-error-dialog", {
            title: "Error",
            message: `Could not open folder: ${err.message}`
          });
        });
      } else {
        const workDirFilePath = path.join(app.getPath("userData"), "workdir.json");
        if (fs.existsSync(workDirFilePath)) {
          try {
            const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, "utf8"));
            const alternativePath = path.join(workDirData.workDir, instanceType, instanceName);
            if (fs.existsSync(alternativePath)) {
              shell.openPath(alternativePath).catch((err) => {
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
  ipcMain.handle("get-current-theme", (_event) => {
    logInfo(`Current theme requested, returning: ${global.currentThemeMode || "null"}`);
    return global.currentThemeMode;
  });
  ipcMain.handle("get-window-id", (event) => {
    try {
      const webContents = event.sender;
      const win = BrowserWindow.fromWebContents(webContents);
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
  ipcMain.on("language-changed", (_event, { language }) => {
    logInfo("Syncing language to all windows: " + language);
    currentLanguage = language;
    BrowserWindow.getAllWindows().forEach((window2) => {
      if (!window2.isDestroyed()) {
        window2.webContents.send("language-changed", language);
      }
    });
  });
  ipcMain.handle("get-current-language", () => {
    return currentLanguage;
  });
  ipcMain.on("verification-failed", (_event, { error }) => {
    logError("Verification failed", error);
    dialog.showErrorBox("Verification Failed", `Error: ${error}`);
  });
  ipcMain.on("open-window", (_event, { type, options }) => {
    logInfo(`Request to open window: ${type}`);
    createWindow(type, options);
  });
  ipcMain.on("close-window", (_event, { type }) => {
    var _a, _b;
    logInfo(`Request to close window: ${type}`);
    if (windows[type] && !((_a = windows[type]) == null ? void 0 : _a.isDestroyed())) {
      (_b = windows[type]) == null ? void 0 : _b.close();
    }
  });
  ipcMain.on("set-window-title", (event, title) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setTitle(title);
    }
  });
  ipcMain.handle("show-message-dialog", async (event, options) => {
    const result = await dialog.showMessageBox(options);
    event.sender.send("dialog-response", result.response);
    return result;
  });
  ipcMain.handle("show-open-dialog", async (_event, options) => {
    return await dialog.showOpenDialog(options);
  });
  ipcMain.handle("show-save-dialog", async (_event, options) => {
    return await dialog.showSaveDialog(options);
  });
  ipcMain.on("setup-window-closing", () => {
    logInfo("[SETUP-CLOSE] Received setup-window-closing signal");
    global.comingFromSetup = true;
  });
  ipcMain.on("prepare-for-main-screen", () => {
    logInfo("======= PREPARING FOR MAIN SCREEN =======");
    try {
      const currentWindow = BrowserWindow.getFocusedWindow();
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
  ipcMain.on("get-logs", async (event, { instanceName, timeFilter, tail }) => {
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
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
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
    const windows2 = BrowserWindow.getAllWindows();
    const visibleWindows = windows2.filter((win) => win.isVisible());
    if (visibleWindows.length > 0) {
      visibleWindows[0].focus();
    } else if (windows2.length > 0) {
      windows2[0].show();
      windows2[0].focus();
    }
  }
});
ipcMain.on("open-external-url", (_event, url) => {
  if (typeof url === "string") {
    shell.openExternal(url).catch((err) => {
      logError(`Error opening external URL: ${url}`, err);
    });
  }
});
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});
ipcMain.handle("get-app-path", (_event, name) => {
  return app.getPath(name || "userData");
});
ipcMain.handle("fetch-github-releases", async () => {
  try {
    logInfo("Fetching GitHub releases for update check");
    const apiUrl = "https://api.github.com/repos/danielmederos2424/odoo-manager/releases";
    const request = net.request({
      method: "GET",
      url: apiUrl,
      redirect: "follow"
    });
    request.setHeader("User-Agent", `Odoo-Manager/${app.getVersion()}`);
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
ipcMain.on("show-update-notification", (_event, { title, body }) => {
  try {
    if (process.platform === "linux") {
      logInfo("Skipping update notification on Linux platform");
      return;
    }
    logInfo(`Showing update notification: ${title}`);
    const notification = new Notification({
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
ipcMain.handle("test-port-availability", async (_event, port) => {
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
ipcMain.on("restart-app", () => {
  app.relaunch();
  app.exit();
});
ipcMain.on("quit-app", () => {
  app.quit();
});
ipcMain.handle("get-auto-update-enabled", async () => {
  try {
    const workDirPath = path.join(app.getPath("userData"), "workdir.json");
    if (!fs.existsSync(workDirPath)) {
      return false;
    }
    const workDirData = JSON.parse(fs.readFileSync(workDirPath, "utf8"));
    const workDir = workDirData.workDir;
    if (!workDir || !fs.existsSync(workDir)) {
      return false;
    }
    const settingsPath = path.join(workDir, "settings.json");
    if (!fs.existsSync(settingsPath)) {
      return false;
    }
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return settings.autoCheckUpdates === true;
  } catch (error) {
    logError("Error checking auto update setting", error);
    return false;
  }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5janMiLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2aWNlcy9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2UudHMiLCIuLi9zcmMvdXRpbHMvZWxlY3Ryb24udHMiLCIuLi9zcmMvc2VydmljZXMvdXRpbHMvbG9nZ2VyLnRzIiwiLi4vc3JjL3NlcnZpY2VzL3N5c3RlbS9wYXRoU2VydmljZS50cyIsIi4uL3NyYy9zZXJ2aWNlcy9kb2NrZXIvZG9ja2VyQ29tcG9zZVNlcnZpY2UudHMiLCIuLi9zcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlLnRzIiwiLi4vZWxlY3Ryb24vbG9nZ2VyLWxvY2sudHMiLCIuLi9lbGVjdHJvbi9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHNyYy9zZXJ2aWNlcy9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2UudHNcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBnZXRBcHBEYXRhUGF0aCwgZW5zdXJlRGlyIH0gZnJvbSAnLi4vc3lzdGVtL3BhdGhTZXJ2aWNlJztcbmltcG9ydCB7IGxvZ0Vycm9yLCBsb2dJbmZvIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuLy8gU2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIFNldHRpbmdzIHtcbiAgICB0aGVtZTogJ2xpZ2h0JyB8ICdkYXJrJztcbiAgICBsYW5ndWFnZTogc3RyaW5nO1xuICAgIG5ldHdvcms6IHN0cmluZztcbiAgICBzaG93V2VsY29tZVNjcmVlbjogYm9vbGVhbjtcbiAgICBhdXRvQ2hlY2tVcGRhdGVzOiBib29sZWFuO1xuICAgIHVwZGF0ZUNoZWNrRnJlcXVlbmN5OiAnZGFpbHknIHwgJ3dlZWtseSc7XG4gICAgc2hvd1VwZGF0ZU5vdGlmaWNhdGlvbnM6IGJvb2xlYW47XG4gICAgbGFzdFVwZGF0ZUNoZWNrOiBzdHJpbmcgfCBudWxsO1xuICAgIGNyZWF0ZWRBdDogc3RyaW5nO1xuICAgIHVwZGF0ZWRBdDogc3RyaW5nO1xuICAgIFtrZXk6IHN0cmluZ106IGFueTsgLy8gQWxsb3cgZm9yIGV4dGVuc2lvblxufVxuXG4vLyBEZWZhdWx0IHNldHRpbmdzXG5jb25zdCBkZWZhdWx0U2V0dGluZ3M6IFNldHRpbmdzID0ge1xuICAgIHRoZW1lOiAnZGFyaycsXG4gICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgbmV0d29yazogJ29kb28tbmV0d29yaycsXG4gICAgc2hvd1dlbGNvbWVTY3JlZW46IHRydWUsXG4gICAgYXV0b0NoZWNrVXBkYXRlczogdHJ1ZSxcbiAgICB1cGRhdGVDaGVja0ZyZXF1ZW5jeTogJ2RhaWx5JyxcbiAgICBzaG93VXBkYXRlTm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICBsYXN0VXBkYXRlQ2hlY2s6IG51bGwsXG4gICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbn07XG5cbmNsYXNzIFNldHRpbmdzU2VydmljZSB7XG4gICAgcHJpdmF0ZSB3b3JrRGlyRmlsZVBhdGg6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBQYXRoIHRvIHRoZSBmaWxlIHRoYXQgc3RvcmVzIHRoZSB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gICAgICAgIHRoaXMud29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICd3b3JrZGlyLmpzb24nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzZXR1cCBoYXMgYmVlbiBjb21wbGV0ZWRcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgaWYgc2V0dXAgaXMgY29tcGxldGVcbiAgICAgKi9cbiAgICBhc3luYyBpc1NldHVwQ29tcGxldGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpclBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgd2UgaGF2ZSB2YWxpZCBzZXR0aW5ncy5qc29uIGZpbGUsIGl0IG1lYW5zIHNldHVwIHdhcyBjb21wbGV0ZWRcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGNoZWNraW5nIGlmIHNldHVwIGlzIGNvbXBsZXRlZCcsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29yayBkaXJlY3RvcnkgcGF0aCBmcm9tIGFwcCBkYXRhXG4gICAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gd29yayBkaXJlY3RvcnkgcGF0aCBvciBudWxsIGlmIG5vdCBzZXRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRXb3JrRGlyUGF0aCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLndvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHRoaXMud29ya0RpckZpbGVQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICBpZiAoIWRhdGEud29ya0RpciB8fCAhZnMuZXhpc3RzU3luYyhkYXRhLndvcmtEaXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBkYXRhLndvcmtEaXI7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgZ2V0dGluZyB3b3JrIGRpcmVjdG9yeSBwYXRoJywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTYXZlIHRoZSB3b3JrIGRpcmVjdG9yeSBwYXRoIHRvIGFwcCBkYXRhXG4gICAgICogQHBhcmFtIHdvcmtEaXJQYXRoIFBhdGggdG8gc2F2ZSBhcyB3b3JrIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzXG4gICAgICovXG4gICAgYXN5bmMgc2F2ZVdvcmtEaXJQYXRoKHdvcmtEaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGVuc3VyZURpcihwYXRoLmRpcm5hbWUodGhpcy53b3JrRGlyRmlsZVBhdGgpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy53b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0Rpcjogd29ya0RpclBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgbG9nSW5mbyhgU2F2ZWQgd29yayBkaXJlY3RvcnkgcGF0aDogJHt3b3JrRGlyUGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHNhdmluZyB3b3JrIGRpcmVjdG9yeSBwYXRoJywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBzZXR0aW5ncyBmcm9tIHRoZSB3b3JrIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIFNldHRpbmdzIG9iamVjdCBvciBudWxsIGlmIG5vdCBmb3VuZFxuICAgICAqL1xuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPFNldHRpbmdzIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICBsb2dJbmZvKCdMb2FkZWQgc2V0dGluZ3MgZnJvbSB3b3JrIGRpcmVjdG9yeScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdFNldHRpbmdzLCAuLi5zZXR0aW5ncyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGxvYWRpbmcgc2V0dGluZ3MnLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNhdmUgc2V0dGluZ3MgdG8gdGhlIHdvcmsgZGlyZWN0b3J5XG4gICAgICogQHBhcmFtIHNldHRpbmdzIFNldHRpbmdzIG9iamVjdCB0byBzYXZlXG4gICAgICogQHBhcmFtIHdvcmtEaXJQYXRoIFdvcmsgZGlyZWN0b3J5IHBhdGggd2hlcmUgc2V0dGluZ3Mgc2hvdWxkIGJlIHNhdmVkXG4gICAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzYXZlU2V0dGluZ3Moc2V0dGluZ3M6IFBhcnRpYWw8U2V0dGluZ3M+LCB3b3JrRGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgd29yayBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICBlbnN1cmVEaXIod29ya0RpclBhdGgpO1xuXG4gICAgICAgICAgICAvLyBNZXJnZSB3aXRoIGRlZmF1bHQgc2V0dGluZ3NcbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZFNldHRpbmdzID0geyAuLi5kZWZhdWx0U2V0dGluZ3MsIC4uLnNldHRpbmdzIH07XG4gICAgICAgICAgICBtZXJnZWRTZXR0aW5ncy51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICAgICAgICAgIC8vIFdyaXRlIHNldHRpbmdzIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCBKU09OLnN0cmluZ2lmeShtZXJnZWRTZXR0aW5ncywgbnVsbCwgMikpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKGBTYXZlZCBzZXR0aW5ncyB0byB3b3JrIGRpcmVjdG9yeTogJHt3b3JrRGlyUGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHNhdmluZyBzZXR0aW5ncycsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBzZXR0aW5ncyBpbiB0aGUgd29yayBkaXJlY3RvcnlcbiAgICAgKiBAcGFyYW0gdXBkYXRlcyBQYXJ0aWFsIHNldHRpbmdzIG9iamVjdCB3aXRoIHVwZGF0ZXNcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgc3VjY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHVwZGF0ZVNldHRpbmdzKHVwZGF0ZXM6IFBhcnRpYWw8U2V0dGluZ3M+KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgaWYgKCFjdXJyZW50U2V0dGluZ3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHdvcmtEaXJQYXRoID0gYXdhaXQgdGhpcy5nZXRXb3JrRGlyUGF0aCgpO1xuICAgICAgICAgICAgaWYgKCF3b3JrRGlyUGF0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWVyZ2UgdXBkYXRlcyB3aXRoIGN1cnJlbnQgc2V0dGluZ3NcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRTZXR0aW5ncyA9IHtcbiAgICAgICAgICAgICAgICAuLi5jdXJyZW50U2V0dGluZ3MsXG4gICAgICAgICAgICAgICAgLi4udXBkYXRlcyxcbiAgICAgICAgICAgICAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gV3JpdGUgdXBkYXRlZCBzZXR0aW5nc1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCAnc2V0dGluZ3MuanNvbicpO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhzZXR0aW5nc1BhdGgsIEpTT04uc3RyaW5naWZ5KHVwZGF0ZWRTZXR0aW5ncywgbnVsbCwgMikpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKCdVcGRhdGVkIHNldHRpbmdzJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciB1cGRhdGluZyBzZXR0aW5ncycsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8gQ3JlYXRlIGluc3RhbmNlXG5jb25zdCBzZXR0aW5nc1NlcnZpY2UgPSBuZXcgU2V0dGluZ3NTZXJ2aWNlKCk7XG5cbmV4cG9ydCB7IHNldHRpbmdzU2VydmljZSB9O1xuZXhwb3J0IGRlZmF1bHQgc2V0dGluZ3NTZXJ2aWNlOyIsIi8vIHNyYy91dGlscy9lbGVjdHJvbi50c1xuZXhwb3J0IGNvbnN0IGlzRWxlY3Ryb24gPSAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gYSBicm93c2VyIGVudmlyb25tZW50XG4gICAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGU7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RWxlY3Ryb25BUEkgPSAoKSA9PiB7XG4gICAgaWYgKGlzRWxlY3Ryb24oKSkge1xuICAgICAgICByZXR1cm4gd2luZG93LnJlcXVpcmUoJ2VsZWN0cm9uJyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcbiIsIi8vIHNyYy9zZXJ2aWNlcy91dGlscy9sb2dnZXIudHNcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBnZXRMb2dzUGF0aCB9IGZyb20gJy4uL3N5c3RlbS9wYXRoU2VydmljZSc7XG5pbXBvcnQgc2V0dGluZ3NTZXJ2aWNlIGZyb20gJy4uL3NldHRpbmdzL3NldHRpbmdzU2VydmljZSc7XG5pbXBvcnQgeyBpc0VsZWN0cm9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvZWxlY3Ryb24nO1xuXG4vLyBHbG9iYWwgZmxhZ3MgdG8gcHJldmVudCBtdWx0aXBsZSBsb2dnZXIgaW5pdGlhbGl6YXRpb25zIGFjcm9zcyBhbGwgaW5zdGFuY2VzXG5sZXQgR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCA9IGZhbHNlO1xubGV0IEFDVElWRV9MT0dfRklMRV9QQVRIOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbmxldCBTRVNTSU9OX0hFQURFUlNfV1JJVFRFTjogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcblxuLy8gTG9nIHJvdGF0aW9uIGNvbmZpZ3VyYXRpb25cbmNvbnN0IExPR19GSUxFX1NJWkVfTElNSVQgPSA1ICogMTAyNCAqIDEwMjQ7IC8vIDUgTUIgaW4gYnl0ZXNcbmNvbnN0IE1BWF9MT0dfRklMRVMgPSA1OyAvLyBNYXhpbXVtIG51bWJlciBvZiByb3RhdGVkIGxvZyBmaWxlcyB0byBrZWVwXG5cbi8vIExvZyBsZXZlbHMgZW51bVxuZW51bSBMb2dMZXZlbCB7XG4gICAgREVCVUcgPSAwLFxuICAgIElORk8gPSAxLFxuICAgIFdBUk4gPSAyLFxuICAgIEVSUk9SID0gM1xufVxuXG4vLyBUeXBlIGRlZmluaXRpb24gZm9yIGxvZyBlbnRyeVxuaW50ZXJmYWNlIExvZ0VudHJ5IHtcbiAgICB0aW1lc3RhbXA6IHN0cmluZztcbiAgICBsZXZlbDogTG9nTGV2ZWw7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGRhdGE/OiBhbnk7XG59XG5cbi8qKlxuICogQXBwbGljYXRpb24gbG9nZ2VyIHdpdGggZmlsZSBhbmQgY29uc29sZSBvdXRwdXRcbiAqL1xuY2xhc3MgTG9nZ2VyIHtcbiAgICBwcml2YXRlIGxvZ0xldmVsOiBMb2dMZXZlbCA9IExvZ0xldmVsLklORk87XG4gICAgcHJpdmF0ZSBsb2dGaWxlOiBzdHJpbmcgPSAnJztcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogTG9nZ2VyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBpbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgd2luZG93SWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIERlZmF1bHQgdG8gSU5GTyBpbiBwcm9kdWN0aW9uLCBERUJVRyBpbiBkZXZlbG9wbWVudFxuICAgICAgICB0aGlzLmxvZ0xldmVsID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgPyBMb2dMZXZlbC5ERUJVRyA6IExvZ0xldmVsLklORk87XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSB3aW5kb3cgSUQgZm9yIHRoaXMgbG9nZ2VyIGluc3RhbmNlXG4gICAgICogQHBhcmFtIGlkIFdpbmRvdyBJRFxuICAgICAqL1xuICAgIHNldFdpbmRvd0lkKGlkOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy53aW5kb3dJZCA9IGlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd2luZG93IElEIGZvciB0aGlzIGxvZ2dlciBpbnN0YW5jZVxuICAgICAqIEByZXR1cm5zIFdpbmRvdyBJRCBvciBudWxsIGlmIG5vdCBzZXRcbiAgICAgKi9cbiAgICBnZXRXaW5kb3dJZCgpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2luZG93SWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmV0Y2ggdGhlIHdpbmRvdyBJRCBmcm9tIHRoZSBtYWluIHByb2Nlc3NcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gd2luZG93IElEIG9yIG51bGxcbiAgICAgKi9cbiAgICBhc3luYyBmZXRjaFdpbmRvd0lkKCk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIWlzRWxlY3Ryb24oKSB8fCB0aGlzLndpbmRvd0lkICE9PSBudWxsKSByZXR1cm4gdGhpcy53aW5kb3dJZDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICBpZiAoaXBjUmVuZGVyZXIgJiYgaXBjUmVuZGVyZXIuaW52b2tlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aW5kb3dJZCA9IGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZSgnZ2V0LXdpbmRvdy1pZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLndpbmRvd0lkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGdldCB3aW5kb3cgSUQ6JywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIHdpdGggbWFpbiBwcm9jZXNzIGlmIHRoZXJlJ3MgYWxyZWFkeSBhbiBhY3RpdmUgbG9nIGZpbGVcbiAgICAgKiBAcmV0dXJucyBQYXRoIHRvIGV4aXN0aW5nIGxvZyBmaWxlIG9yIG51bGxcbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0RXhpc3RpbmdMb2dGaWxlKCk6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBpZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEFjY2VzcyBpcGNSZW5kZXJlciBkaXJlY3RseSB3aGVuIGNvbnRleHRJc29sYXRpb24gaXMgZGlzYWJsZWRcbiAgICAgICAgICAgICAgICBjb25zdCBpcGNSZW5kZXJlciA9IHdpbmRvdy5pcGNSZW5kZXJlcjtcbiAgICAgICAgICAgICAgICBpZiAoaXBjUmVuZGVyZXIgJiYgaXBjUmVuZGVyZXIuaW52b2tlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVzZSBhc3luYyBpbnZva2UgaW5zdGVhZCBvZiBzeW5jIGNhbGwgdG8gYXZvaWQgYmxvY2tpbmcgcmVuZGVyZXIgcHJvY2Vzc1xuICAgICAgICAgICAgICAgICAgICAvLyBXZSdsbCBoYW5kbGUgdGhpcyBhc3luY2hyb25vdXNseSBpbiBpbml0aWFsaXplKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGdldCBleGlzdGluZyBsb2cgZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgbG9nIGZpbGUgd2l0aCBtYWluIHByb2Nlc3NcbiAgICAgKiBAcGFyYW0gbG9nRmlsZSBQYXRoIHRvIGxvZyBmaWxlXG4gICAgICovXG4gICAgc3RhdGljIHJlZ2lzdGVyTG9nRmlsZShsb2dGaWxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgaWYgKGlzRWxlY3Ryb24oKSAmJiBsb2dGaWxlICYmIGZzLmV4aXN0c1N5bmMobG9nRmlsZSkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICAgICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLnNlbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgaXBjUmVuZGVyZXIuc2VuZCgncmVnaXN0ZXItbG9nLWZpbGUnLCBsb2dGaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgQUNUSVZFX0xPR19GSUxFX1BBVEggPSBsb2dGaWxlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHJlZ2lzdGVyIGxvZyBmaWxlIHdpdGggbWFpbiBwcm9jZXNzOicsIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFuIHVwIG9sZCBsb2cgZmlsZXMgb2xkZXIgdGhhbiBzcGVjaWZpZWQgZGF5c1xuICAgICAqIFRoaXMgaXMga2VwdCBmb3IgY29tcGF0aWJpbGl0eSBidXQgbm90IGFjdGl2ZWx5IHVzZWQgd2l0aCByb3RhdGlvbi1iYXNlZCBhcHByb2FjaFxuICAgICAqIEBwYXJhbSBkYXlzIE51bWJlciBvZiBkYXlzIHRvIGtlZXAgbG9ncyAoZGVmYXVsdDogNylcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBjbGVhbnVwIGlzIGNvbXBsZXRlXG4gICAgICovXG4gICAgYXN5bmMgY2xlYW51cE9sZExvZ0ZpbGVzKGRheXM6IG51bWJlciA9IDcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCBhbGwgbG9nIGZpbGVzXG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlcyA9IHRoaXMuZ2V0TG9nRmlsZXMoKTtcbiAgICAgICAgICAgIGlmIChsb2dGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDaGVja2luZyBmb3IgbG9nIGZpbGVzIG9sZGVyIHRoYW4gJHtkYXlzfSBkYXlzIHRvIGNsZWFuIHVwYCk7XG5cbiAgICAgICAgICAgIC8vIEN1cnJlbnQgdGltZVxuICAgICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICAvLyBNYXggYWdlIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICAgICAgY29uc3QgbWF4QWdlID0gZGF5cyAqIDI0ICogNjAgKiA2MCAqIDEwMDA7XG4gICAgICAgICAgICAvLyBUaHJlc2hvbGQgZGF0ZVxuICAgICAgICAgICAgY29uc3QgdGhyZXNob2xkID0gbm93IC0gbWF4QWdlO1xuXG4gICAgICAgICAgICAvLyBGaWx0ZXIgZmlsZXMgb2xkZXIgdGhhbiB0aHJlc2hvbGRcbiAgICAgICAgICAgIGNvbnN0IG9sZEZpbGVzID0gbG9nRmlsZXMuZmlsdGVyKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgIC8vIERvbid0IGRlbGV0ZSBjdXJyZW50IGxvZyBmaWxlIG9yIGl0cyByb3RhdGlvbnNcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gdGhpcy5sb2dGaWxlIHx8IGZpbGUgPT09IEFDVElWRV9MT0dfRklMRV9QQVRIKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgZGVsZXRlIHJvdGF0ZWQgdmVyc2lvbnMgb2YgdGhlIGFjdGl2ZSBsb2cgZmlsZVxuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VMb2dOYW1lID0gcGF0aC5iYXNlbmFtZSh0aGlzLmxvZ0ZpbGUgfHwgJycsICcubG9nJyk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGguYmFzZW5hbWUoZmlsZSkuc3RhcnRzV2l0aChgJHtiYXNlTG9nTmFtZX0uYCkgJiYgXG4gICAgICAgICAgICAgICAgICAgIHBhdGguYmFzZW5hbWUoZmlsZSkuZW5kc1dpdGgoJy5sb2cnKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXNlIGNyZWF0aW9uIHRpbWUgb3IgbW9kaWZpZWQgdGltZSwgd2hpY2hldmVyIGlzIG9sZGVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVUaW1lID0gTWF0aC5taW4oc3RhdHMuYmlydGh0aW1lTXMsIHN0YXRzLm10aW1lTXMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsZVRpbWUgPCB0aHJlc2hvbGQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGNoZWNraW5nIGZpbGUgYWdlIGZvciAke2ZpbGV9OmAsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCBmaWxlc1xuICAgICAgICAgICAgaWYgKG9sZEZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRm91bmQgJHtvbGRGaWxlcy5sZW5ndGh9IGxvZyBmaWxlcyBvbGRlciB0aGFuICR7ZGF5c30gZGF5cyB0byBkZWxldGVgKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBvbGRGaWxlcykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMudW5saW5rU3luYyhmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBEZWxldGVkIG9sZCBsb2cgZmlsZTogJHtmaWxlfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGRlbGV0aW5nIG9sZCBsb2cgZmlsZSAke2ZpbGV9OmAsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBObyBsb2cgZmlsZXMgb2xkZXIgdGhhbiAke2RheXN9IGRheXMgZm91bmRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBkdXJpbmcgbG9nIGZpbGUgY2xlYW51cDonLCBlcnIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgd2UndmUgYWxyZWFkeSB3cml0dGVuIHNlc3Npb24gaGVhZGVycyBmb3IgdGhlIGN1cnJlbnQgbG9nIGZpbGVcbiAgICAgKiBAcGFyYW0gc2Vzc2lvblR5cGUgVHlwZSBvZiBzZXNzaW9uIGhlYWRlciAoc3RhcnQsIHJlc3VtZSlcbiAgICAgKiBAcmV0dXJucyBUcnVlIGlmIGhlYWRlcnMgYWxyZWFkeSB3cml0dGVuLCBmYWxzZSBvdGhlcndpc2VcbiAgICAgKi9cbiAgICBwcml2YXRlIGlzU2Vzc2lvbkhlYWRlcldyaXR0ZW4oc2Vzc2lvblR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMubG9nRmlsZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBrZXkgPSBgJHt0aGlzLmxvZ0ZpbGV9OiR7c2Vzc2lvblR5cGV9OiR7dGhpcy53aW5kb3dJZCB8fCAndW5rbm93bid9YDtcbiAgICAgICAgcmV0dXJuIFNFU1NJT05fSEVBREVSU19XUklUVEVOW2tleV0gPT09IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBzZXNzaW9uIGhlYWRlcnMgYXMgd3JpdHRlbiBmb3IgdGhlIGN1cnJlbnQgbG9nIGZpbGVcbiAgICAgKiBAcGFyYW0gc2Vzc2lvblR5cGUgVHlwZSBvZiBzZXNzaW9uIGhlYWRlciAoc3RhcnQsIHJlc3VtZSlcbiAgICAgKi9cbiAgICBwcml2YXRlIG1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbihzZXNzaW9uVHlwZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5sb2dGaWxlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGtleSA9IGAke3RoaXMubG9nRmlsZX06JHtzZXNzaW9uVHlwZX06JHt0aGlzLndpbmRvd0lkIHx8ICd1bmtub3duJ31gO1xuICAgICAgICBTRVNTSU9OX0hFQURFUlNfV1JJVFRFTltrZXldID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBsb2dnZXIgd2l0aCBzZXR0aW5nc1xuICAgICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGluaXRpYWxpemF0aW9uIGlzIGNvbXBsZXRlXG4gICAgICovXG4gICAgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gR2V0IHdpbmRvdyBJRCBmaXJzdCBpZiB3ZSdyZSBpbiBFbGVjdHJvblxuICAgICAgICBpZiAoaXNFbGVjdHJvbigpICYmIHRoaXMud2luZG93SWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZmV0Y2hXaW5kb3dJZCgpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBnbG9iYWwgaW5pdGlhbGl6YXRpb24gZmxhZyBmaXJzdFxuICAgICAgICBpZiAoR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYExvZ2dlciBhbHJlYWR5IGluaXRpYWxpemVkIGdsb2JhbGx5LCB1c2luZyBleGlzdGluZyBpbnN0YW5jZSAod2luZG93ICR7dGhpcy53aW5kb3dJZH0pYCk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZXJlJ3MgYW4gYWN0aXZlIGxvZyBmaWxlIHBhdGgsIHVzZSBpdFxuICAgICAgICAgICAgaWYgKEFDVElWRV9MT0dfRklMRV9QQVRIICYmIGZzLmV4aXN0c1N5bmMoQUNUSVZFX0xPR19GSUxFX1BBVEgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2dGaWxlID0gQUNUSVZFX0xPR19GSUxFX1BBVEg7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gT25seSB3cml0ZSByZXN1bWUgaGVhZGVyIGlmIHdlIGhhdmVuJ3Qgd3JpdHRlbiBpdCBmb3IgdGhpcyB3aW5kb3cvZmlsZSBjb21ib1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1Nlc3Npb25IZWFkZXJXcml0dGVuKCdyZXN1bWUnKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbk1lc3NhZ2UgPVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBcXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBTZXNzaW9uIHJlc3VtZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobmV3IERhdGUoKSl9XFxuYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLmFwcGVuZEZpbGVTeW5jKHRoaXMubG9nRmlsZSwgc2Vzc2lvbk1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3Jlc3VtZScpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgc2Vzc2lvbiBzZXBhcmF0b3IgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZXJlJ3MgYWxyZWFkeSBhIGdsb2JhbCBhY3RpdmUgbG9nIGZpbGUgKGZyb20gbWFpbiBwcm9jZXNzKVxuICAgICAgICAvLyBVc2UgYXN5bmMgaW52b2tlIGluc3RlYWQgb2YgYmxvY2tpbmcgc3luY2hyb25vdXMgSVBDXG4gICAgICAgIGxldCBleGlzdGluZ0xvZ0ZpbGUgPSBudWxsO1xuICAgICAgICBpZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFVzZSBhc3luYyBpbnZva2UgYW5kIGp1c3Qgd2FpdCBhIG1heCBvZiA1MDBtcyB0byBhdm9pZCBibG9ja2luZyBzdGFydHVwXG4gICAgICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICAgICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlPG51bGw+KChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KCgpID0+IHJlc29sdmUobnVsbCksIDUwMCkpO1xuICAgICAgICAgICAgICAgICAgICBleGlzdGluZ0xvZ0ZpbGUgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuICAgICAgICAgICAgICAgICAgICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKCdnZXQtYWN0aXZlLWxvZy1maWxlJyksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0UHJvbWlzZVxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgZXhpc3RpbmcgbG9nIGZpbGUgYXN5bmNocm9ub3VzbHk6JywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoZXhpc3RpbmdMb2dGaWxlICYmIGZzLmV4aXN0c1N5bmMoZXhpc3RpbmdMb2dGaWxlKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFVzaW5nIGV4aXN0aW5nIGdsb2JhbCBsb2cgZmlsZTogJHtleGlzdGluZ0xvZ0ZpbGV9ICh3aW5kb3cgJHt0aGlzLndpbmRvd0lkfSlgKTtcbiAgICAgICAgICAgIHRoaXMubG9nRmlsZSA9IGV4aXN0aW5nTG9nRmlsZTtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgd3JpdGUgcmVzdW1lIGhlYWRlciBpZiB3ZSBoYXZlbid0IHdyaXR0ZW4gaXQgZm9yIHRoaXMgd2luZG93L2ZpbGUgY29tYm9cbiAgICAgICAgICAgIGlmICghdGhpcy5pc1Nlc3Npb25IZWFkZXJXcml0dGVuKCdyZXN1bWUnKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgICAgIGBcXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYFNlc3Npb24gcmVzdW1lZDogJHt0aGlzLmZvcm1hdFRpbWVzdGFtcChuZXcgRGF0ZSgpKX1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG4gICAgICAgICAgICAgICAgICAgIGZzLmFwcGVuZEZpbGVTeW5jKHRoaXMubG9nRmlsZSwgc2Vzc2lvbk1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbigncmVzdW1lJyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgc2Vzc2lvbiBzZXBhcmF0b3IgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZyhgSW5pdGlhbGl6aW5nIGxvZ2dlciBmb3Igd2luZG93ICR7dGhpcy53aW5kb3dJZH0uLi5gKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHdvcmsgZGlyZWN0b3J5IHBhdGggZnJvbSBzZXR0aW5ncyBzZXJ2aWNlXG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGF3YWl0IHNldHRpbmdzU2VydmljZS5nZXRXb3JrRGlyUGF0aCgpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFdvcmsgZGlyZWN0b3J5OiAke3dvcmtEaXJQYXRoIHx8ICdub3Qgc2V0J31gKTtcblxuICAgICAgICAgICAgLy8gR2V0IGxvZ3MgcGF0aCB1c2luZyB0aGUgcGF0aCBzZXJ2aWNlXG4gICAgICAgICAgICBjb25zdCBsb2dzUGF0aCA9IGdldExvZ3NQYXRoKHdvcmtEaXJQYXRoIHx8IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgTG9ncyBkaXJlY3Rvcnk6ICR7bG9nc1BhdGh9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBvciBjcmVhdGUgbWFpbiBsb2cgZmlsZVxuICAgICAgICAgICAgdGhpcy5sb2dGaWxlID0gcGF0aC5qb2luKGxvZ3NQYXRoLCAnYXBwLmxvZycpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFVzaW5nIG1haW4gbG9nIGZpbGUgYXQ6ICR7dGhpcy5sb2dGaWxlfWApO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgZmlsZSBleGlzdHMsIGlmIG5vdCBjcmVhdGUgaXQgd2l0aCBpbml0aWFsIGNvbnRlbnRcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLmxvZ0ZpbGUpKSB7XG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgaW5pdGlhbCBsb2cgZW50cnlcbiAgICAgICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluaXRpYWxNZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICAgICAgICAgICAgICAgIGBPZG9vIE1hbmFnZXIgLSBBcHBsaWNhdGlvbiBMb2cgKE1haW4gUHJvY2VzcylcXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYFN0YXJ0ZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobm93KX1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYEVudmlyb25tZW50OiAke3Byb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICd1bmtub3duJ31cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcblxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy5sb2dGaWxlLCBpbml0aWFsTWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3N0YXJ0Jyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3N0YXJ0JykpIHtcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSBhIHNlc3Npb24gc2VwYXJhdG9yIHRvIGV4aXN0aW5nIGxvZyBmaWxlIG9ubHkgaWYgd2UgaGF2ZW4ndCB3cml0dGVuIG9uZVxuICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgYFxcbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICAgICAgICAgICAgICAgIGBTZXNzaW9uIHN0YXJ0ZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobmV3IERhdGUoKSl9XFxuYCArXG4gICAgICAgICAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG4gICAgICAgICAgICAgICAgZnMuYXBwZW5kRmlsZVN5bmModGhpcy5sb2dGaWxlLCBzZXNzaW9uTWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3N0YXJ0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBhY3RpdmUgbG9nIGZpbGUgcGF0aCBnbG9iYWxseVxuICAgICAgICAgICAgQUNUSVZFX0xPR19GSUxFX1BBVEggPSB0aGlzLmxvZ0ZpbGU7XG5cbiAgICAgICAgICAgIC8vIFJlZ2lzdGVyIHdpdGggbWFpbiBwcm9jZXNzXG4gICAgICAgICAgICBMb2dnZXIucmVnaXN0ZXJMb2dGaWxlKHRoaXMubG9nRmlsZSk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBMb2dnZXIgaW5pdGlhbGl6ZWQgd2l0aCBmaWxlOiAke3RoaXMubG9nRmlsZX1gKTtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmluZm8oJ0xvZ2dlciBpbml0aWFsaXplZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHRoaXMuaW5mbyhgTG9nIGZpbGVzIHdpbGwgYmUgcm90YXRlZCB3aGVuIHRoZXkgcmVhY2ggJHtMT0dfRklMRV9TSVpFX0xJTUlUIC8gKDEwMjQgKiAxMDI0KX0gTUJgKTtcbiAgICAgICAgICAgIHRoaXMuaW5mbyhgUmVnaXN0ZXJlZCBhY3RpdmUgbG9nIGZpbGU6ICR7dGhpcy5sb2dGaWxlfWApO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBpbml0aWFsaXplIGxvZ2dlcjonLCBlcnIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9ybWF0IGRhdGUgZm9yIGxvZyBmaWxlbmFtZSAoWVlZWS1NTS1ERC1ISC1NTS1TUylcbiAgICAgKiBAcGFyYW0gZGF0ZSBEYXRlIG9iamVjdCB0byBmb3JtYXRcbiAgICAgKiBAcmV0dXJucyBGb3JtYXR0ZWQgZGF0ZSBzdHJpbmcgc3VpdGFibGUgZm9yIGZpbGVuYW1lc1xuICAgICAqL1xuICAgIHByaXZhdGUgZm9ybWF0RGF0ZUZvckZpbGVuYW1lKGRhdGU6IERhdGUpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgICAgICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgICAgIGNvbnN0IGhvdXJzID0gU3RyaW5nKGRhdGUuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgICAgY29uc3Qgc2Vjb25kcyA9IFN0cmluZyhkYXRlLmdldFNlY29uZHMoKSkucGFkU3RhcnQoMiwgJzAnKTtcblxuICAgICAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9LSR7aG91cnN9LSR7bWludXRlc30tJHtzZWNvbmRzfWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9ybWF0IHRpbWVzdGFtcCBmb3IgbG9nIGVudHJpZXNcbiAgICAgKiBAcGFyYW0gZGF0ZSBEYXRlIG9iamVjdCB0byBmb3JtYXRcbiAgICAgKiBAcmV0dXJucyBGb3JtYXR0ZWQgdGltZXN0YW1wIHN0cmluZ1xuICAgICAqL1xuICAgIHByaXZhdGUgZm9ybWF0VGltZXN0YW1wKGRhdGU6IERhdGUpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVN0cmluZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBsb2dnZXIgaW5zdGFuY2UgKHNpbmdsZXRvbiBwYXR0ZXJuKVxuICAgICAqIEByZXR1cm5zIExvZ2dlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIHN0YXRpYyBnZXRJbnN0YW5jZSgpOiBMb2dnZXIge1xuICAgICAgICBpZiAoIUxvZ2dlci5pbnN0YW5jZSkge1xuICAgICAgICAgICAgTG9nZ2VyLmluc3RhbmNlID0gbmV3IExvZ2dlcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBMb2dnZXIuaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBsb2cgbGV2ZWxcbiAgICAgKiBAcGFyYW0gbGV2ZWwgTG9nTGV2ZWwgdG8gc2V0XG4gICAgICovXG4gICAgc2V0TG9nTGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nTGV2ZWwgPSBsZXZlbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgbG9nIGZpbGUgcGF0aFxuICAgICAqIEByZXR1cm5zIFBhdGggdG8gdGhlIGFjdGl2ZSBsb2cgZmlsZVxuICAgICAqL1xuICAgIGdldExvZ0ZpbGVQYXRoKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvZ0ZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmFzZWQgb24gc2l6ZVxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgbG9nIHJvdGF0aW9uIHdhcyBwZXJmb3JtZWQsIGZhbHNlIG90aGVyd2lzZVxuICAgICAqL1xuICAgIHByaXZhdGUgY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbGl6ZWQgfHwgIXRoaXMubG9nRmlsZSB8fCAhZnMuZXhpc3RzU3luYyh0aGlzLmxvZ0ZpbGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyh0aGlzLmxvZ0ZpbGUpO1xuICAgICAgICAgICAgaWYgKHN0YXRzLnNpemUgPCBMT0dfRklMRV9TSVpFX0xJTUlUKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBObyByb3RhdGlvbiBuZWVkZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coYExvZyBmaWxlIHNpemUgKCR7c3RhdHMuc2l6ZX0gYnl0ZXMpIGV4Y2VlZHMgbGltaXQgKCR7TE9HX0ZJTEVfU0laRV9MSU1JVH0gYnl0ZXMpLCByb3RhdGluZyBsb2dzLi4uYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCB0aGUgbG9ncyBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbnN0IGxvZ3NEaXIgPSBwYXRoLmRpcm5hbWUodGhpcy5sb2dGaWxlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IGV4aXN0aW5nIHJvdGF0ZWQgbG9nIGZpbGVzXG4gICAgICAgICAgICBjb25zdCBiYXNlTG9nTmFtZSA9IHBhdGguYmFzZW5hbWUodGhpcy5sb2dGaWxlLCAnLmxvZycpO1xuICAgICAgICAgICAgY29uc3Qgcm90YXRlZExvZ3MgPSBmcy5yZWFkZGlyU3luYyhsb2dzRGlyKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoZiA9PiBmLnN0YXJ0c1dpdGgoYCR7YmFzZUxvZ05hbWV9LmApICYmIGYuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgICAgICAgICAgICAuc29ydCgpOyAvLyBTb3J0IHRvIGZpbmQgaGlnaGVzdCByb3RhdGlvbiBudW1iZXJcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gU2hpZnQgb2xkZXIgbG9ncyB0byBtYWtlIHJvb20gZm9yIG5ldyByb3RhdGlvblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHJvdGF0ZWRMb2dzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSByb3RhdGVkTG9nc1tpXS5tYXRjaChuZXcgUmVnRXhwKGAke2Jhc2VMb2dOYW1lfVxcLihcXGQrKVxcLmxvZ2ApKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm90YXRpb25OdW1iZXIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAocm90YXRpb25OdW1iZXIgPj0gTUFYX0xPR19GSUxFUyAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERlbGV0ZSB0aGUgb2xkZXN0IGxvZyBmaWxlIGlmIHdlIGFscmVhZHkgaGF2ZSBtYXggbnVtYmVyIG9mIHJvdGF0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkZXN0TG9nID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkZXN0TG9nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBEZWxldGVkIG9sZCBsb2cgZmlsZTogJHtvbGRlc3RMb2d9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW5hbWUgdG8gdGhlIG5leHQgcm90YXRpb24gbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4obG9nc0RpciwgYCR7YmFzZUxvZ05hbWV9LiR7cm90YXRpb25OdW1iZXIgKyAxfS5sb2dgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUm90YXRlZCBsb2cgZmlsZTogJHtvbGRQYXRofSAtPiAke25ld1BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbmFtZSB0aGUgY3VycmVudCBsb2cgZmlsZSB0byBiZSAuMS5sb2dcbiAgICAgICAgICAgIGNvbnN0IHJvdGF0ZWRMb2dQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIGAke2Jhc2VMb2dOYW1lfS4xLmxvZ2ApO1xuICAgICAgICAgICAgZnMucmVuYW1lU3luYyh0aGlzLmxvZ0ZpbGUsIHJvdGF0ZWRMb2dQYXRoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSb3RhdGVkIG1haW4gbG9nIGZpbGU6ICR7dGhpcy5sb2dGaWxlfSAtPiAke3JvdGF0ZWRMb2dQYXRofWApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBuZXcgZW1wdHkgbG9nIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICBjb25zdCBpbml0aWFsTWVzc2FnZSA9XG4gICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICAgICAgICAgICAgYE9kb28gTWFuYWdlciAtIEFwcGxpY2F0aW9uIExvZyAoUm90YXRlZClcXG5gICtcbiAgICAgICAgICAgICAgICBgU3RhcnRlZDogJHt0aGlzLmZvcm1hdFRpbWVzdGFtcChub3cpfVxcbmAgK1xuICAgICAgICAgICAgICAgIGBFbnZpcm9ubWVudDogJHtwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAndW5rbm93bid9XFxuYCArXG4gICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy5sb2dGaWxlLCBpbml0aWFsTWVzc2FnZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlc2V0IHNlc3Npb24gaGVhZGVycyB0cmFja2luZyB3aGVuIHJvdGF0ZWRcbiAgICAgICAgICAgIFNFU1NJT05fSEVBREVSU19XUklUVEVOID0ge307XG4gICAgICAgICAgICB0aGlzLm1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbignc3RhcnQnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igcm90YXRpbmcgbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyaXRlIGEgbG9nIGVudHJ5IHRvIGNvbnNvbGUgYW5kIGZpbGVcbiAgICAgKiBAcGFyYW0gbGV2ZWwgTG9nTGV2ZWwgb2YgdGhlIGVudHJ5XG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZXJyb3IgT3B0aW9uYWwgZXJyb3Igb2JqZWN0IHRvIGluY2x1ZGVcbiAgICAgKi9cbiAgICBwcml2YXRlIGxvZyhsZXZlbDogTG9nTGV2ZWwsIG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBFcnJvciB8IHVua25vd24pOiB2b2lkIHtcbiAgICAgICAgaWYgKGxldmVsIDwgdGhpcy5sb2dMZXZlbCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IHRoaXMuZm9ybWF0VGltZXN0YW1wKG5ldyBEYXRlKCkpO1xuICAgICAgICBjb25zdCBsZXZlbFN0ciA9IExvZ0xldmVsW2xldmVsXTtcbiAgICAgICAgY29uc3Qgd2luZG93UHJlZml4ID0gdGhpcy53aW5kb3dJZCAhPT0gbnVsbCA/IGBbV0lORE9XLSR7dGhpcy53aW5kb3dJZH1dIGAgOiAnJztcblxuICAgICAgICBsZXQgbG9nTWVzc2FnZSA9IGBbJHt0aW1lc3RhbXB9XSBbJHtsZXZlbFN0cn1dICR7d2luZG93UHJlZml4fSR7bWVzc2FnZX1gO1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxldCBlcnJvck1zZzogc3RyaW5nO1xuICAgICAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBlcnJvck1zZyA9IGVycm9yLnN0YWNrIHx8IGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBlcnJvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBlcnJvck1zZyA9IGVycm9yO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvck1zZyA9IEpTT04uc3RyaW5naWZ5KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JNc2cgPSBTdHJpbmcoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZ01lc3NhZ2UgKz0gYFxcbiR7ZXJyb3JNc2d9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdyaXRlIHRvIGNvbnNvbGVcbiAgICAgICAgY29uc3QgY29uc29sZU1ldGhvZCA9IGxldmVsID09PSBMb2dMZXZlbC5FUlJPUiA/ICdlcnJvcicgOlxuICAgICAgICAgICAgbGV2ZWwgPT09IExvZ0xldmVsLldBUk4gPyAnd2FybicgOlxuICAgICAgICAgICAgICAgIGxldmVsID09PSBMb2dMZXZlbC5ERUJVRyA/ICdkZWJ1ZycgOiAnbG9nJztcbiAgICAgICAgY29uc29sZVtjb25zb2xlTWV0aG9kXShsb2dNZXNzYWdlKTtcblxuICAgICAgICAvLyBXcml0ZSB0byBmaWxlIGlmIGluaXRpYWxpemVkXG4gICAgICAgIGlmICh0aGlzLmluaXRpYWxpemVkICYmIHRoaXMubG9nRmlsZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBsb2cgZmlsZSBuZWVkcyByb3RhdGlvblxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gbG9nIGZpbGUgKHdoaWNoIG1pZ2h0IGJlIG5ld2x5IHJvdGF0ZWQpXG4gICAgICAgICAgICAgICAgZnMuYXBwZW5kRmlsZVN5bmModGhpcy5sb2dGaWxlLCBsb2dNZXNzYWdlICsgJ1xcbicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHdyaXRlIHRvIGxvZyBmaWxlOicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgZGVidWcgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBtZXNzYWdlIE1lc3NhZ2UgdG8gbG9nXG4gICAgICogQHBhcmFtIGRhdGEgT3B0aW9uYWwgZGF0YSB0byBpbmNsdWRlXG4gICAgICovXG4gICAgZGVidWcobWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nKExvZ0xldmVsLkRFQlVHLCBtZXNzYWdlLCBkYXRhKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgaW5mbyBtZXNzYWdlXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZGF0YSBPcHRpb25hbCBkYXRhIHRvIGluY2x1ZGVcbiAgICAgKi9cbiAgICBpbmZvKG1lc3NhZ2U6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQge1xuICAgICAgICB0aGlzLmxvZyhMb2dMZXZlbC5JTkZPLCBtZXNzYWdlLCBkYXRhKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgd2FybmluZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZXJyb3IgT3B0aW9uYWwgZXJyb3IgdG8gaW5jbHVkZVxuICAgICAqL1xuICAgIHdhcm4obWVzc2FnZTogc3RyaW5nLCBlcnJvcj86IEVycm9yIHwgdW5rbm93bik6IHZvaWQge1xuICAgICAgICB0aGlzLmxvZyhMb2dMZXZlbC5XQVJOLCBtZXNzYWdlLCBlcnJvcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9nIGVycm9yIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBNZXNzYWdlIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBlcnJvciBPcHRpb25hbCBlcnJvciB0byBpbmNsdWRlXG4gICAgICovXG4gICAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBlcnJvcj86IEVycm9yIHwgdW5rbm93bik6IHZvaWQge1xuICAgICAgICB0aGlzLmxvZyhMb2dMZXZlbC5FUlJPUiwgbWVzc2FnZSwgZXJyb3IpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhbGwgbG9nIGZpbGVzIGluIHRoZSBsb2dzIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIEFycmF5IG9mIGxvZyBmaWxlIHBhdGhzXG4gICAgICovXG4gICAgZ2V0TG9nRmlsZXMoKTogc3RyaW5nW10ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gVXNlIHRoZSBwYXRoIHNlcnZpY2UgdG8gZ2V0IGxvZ3MgcGF0aFxuICAgICAgICAgICAgY29uc3QgbG9nc1BhdGggPSBnZXRMb2dzUGF0aCgpO1xuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnMucmVhZGRpclN5bmMobG9nc1BhdGgpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihmaWxlID0+IGZpbGUuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgICAgICAgICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKGxvZ3NQYXRoLCBmaWxlKSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZ2V0IGxvZyBmaWxlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIG1vc3QgcmVjZW50IGxvZyBmaWxlXG4gICAgICogQHJldHVybnMgUGF0aCB0byB0aGUgbW9zdCByZWNlbnQgbG9nIGZpbGUgb3IgbnVsbCBpZiBub25lIGZvdW5kXG4gICAgICovXG4gICAgZ2V0TW9zdFJlY2VudExvZ0ZpbGUoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlcyA9IHRoaXMuZ2V0TG9nRmlsZXMoKTtcbiAgICAgICAgICAgIGlmIChsb2dGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU29ydCBieSBmaWxlIGNyZWF0aW9uIHRpbWUgKG1vc3QgcmVjZW50IGZpcnN0KVxuICAgICAgICAgICAgcmV0dXJuIGxvZ0ZpbGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0QSA9IGZzLnN0YXRTeW5jKGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRCID0gZnMuc3RhdFN5bmMoYik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRCLmJpcnRodGltZU1zIC0gc3RhdEEuYmlydGh0aW1lTXM7XG4gICAgICAgICAgICB9KVswXTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgbW9zdCByZWNlbnQgbG9nIGZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIENyZWF0ZSBzaW5nbGV0b24gbG9nZ2VyIGluc3RhbmNlXG5jb25zdCBsb2dnZXIgPSBMb2dnZXIuZ2V0SW5zdGFuY2UoKTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgd2luZG93IElEIGZvciB0aGUgbG9nZ2VyXG5pZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2dldC13aW5kb3ctaWQnKVxuICAgICAgICAgICAgLnRoZW4oaWQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIuc2V0V2luZG93SWQoaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgd2luZG93IElEIGZvciBsb2dnZXI6JywgZXJyKSk7XG4gICAgfVxufVxuXG4vLyBFeHBvcnQgY29udmVuaWVuY2UgbWV0aG9kc1xuZXhwb3J0IGNvbnN0IGluaXRpYWxpemVMb2dnZXIgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiBhd2FpdCBsb2dnZXIuaW5pdGlhbGl6ZSgpO1xuZXhwb3J0IGNvbnN0IGxvZ0RlYnVnID0gKG1lc3NhZ2U6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQgPT4gbG9nZ2VyLmRlYnVnKG1lc3NhZ2UsIGRhdGEpO1xuZXhwb3J0IGNvbnN0IGxvZ0luZm8gPSAobWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCA9PiBsb2dnZXIuaW5mbyhtZXNzYWdlLCBkYXRhKTtcbmV4cG9ydCBjb25zdCBsb2dXYXJuID0gKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBFcnJvciB8IHVua25vd24pOiB2b2lkID0+IGxvZ2dlci53YXJuKG1lc3NhZ2UsIGVycm9yKTtcbmV4cG9ydCBjb25zdCBsb2dFcnJvciA9IChtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogRXJyb3IgfCB1bmtub3duKTogdm9pZCA9PiBsb2dnZXIuZXJyb3IobWVzc2FnZSwgZXJyb3IpO1xuZXhwb3J0IGNvbnN0IGdldExvZ0ZpbGVzID0gKCk6IHN0cmluZ1tdID0+IGxvZ2dlci5nZXRMb2dGaWxlcygpO1xuZXhwb3J0IGNvbnN0IGdldExvZ0ZpbGVQYXRoID0gKCk6IHN0cmluZyA9PiBsb2dnZXIuZ2V0TG9nRmlsZVBhdGgoKTtcbmV4cG9ydCBjb25zdCBnZXRNb3N0UmVjZW50TG9nRmlsZSA9ICgpOiBzdHJpbmcgfCBudWxsID0+IGxvZ2dlci5nZXRNb3N0UmVjZW50TG9nRmlsZSgpO1xuZXhwb3J0IGNvbnN0IHNldExvZ0xldmVsID0gKGxldmVsOiBudW1iZXIpOiB2b2lkID0+IGxvZ2dlci5zZXRMb2dMZXZlbChsZXZlbCk7XG5leHBvcnQgY29uc3QgY2xlYW51cE9sZExvZ0ZpbGVzID0gYXN5bmMgKGRheXM6IG51bWJlciA9IDcpOiBQcm9taXNlPHZvaWQ+ID0+IGF3YWl0IGxvZ2dlci5jbGVhbnVwT2xkTG9nRmlsZXMoZGF5cyk7XG5cbi8vIEV4cG9ydCBsb2dnZXIgYW5kIExvZ0xldmVsIGVudW0gZm9yIGFkdmFuY2VkIHVzYWdlXG5leHBvcnQgeyBMb2dMZXZlbCB9O1xuZXhwb3J0IGRlZmF1bHQgbG9nZ2VyOyIsIi8vIHNyYy9zZXJ2aWNlcy9zeXN0ZW0vcGF0aFNlcnZpY2UudHNcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vKipcbiAqIEdldCB0aGUgYXBwIGRhdGEgZGlyZWN0b3J5IHBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFwcERhdGFQYXRoKCk6IHN0cmluZyB7XG4gICAgY29uc3QgYXBwTmFtZSA9ICdvZG9vLW1hbmFnZXInO1xuXG4gICAgLy8gRGlmZmVyZW50IHBhdGhzIGJhc2VkIG9uIG9wZXJhdGluZyBzeXN0ZW1cbiAgICBzd2l0Y2ggKHByb2Nlc3MucGxhdGZvcm0pIHtcbiAgICAgICAgY2FzZSAnd2luMzInOlxuICAgICAgICAgICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudi5BUFBEQVRBIHx8ICcnLCBhcHBOYW1lKTtcbiAgICAgICAgY2FzZSAnZGFyd2luJzpcbiAgICAgICAgICAgIHJldHVybiBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgYXBwTmFtZSk7XG4gICAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgICAgIHJldHVybiBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnLmNvbmZpZycsIGFwcE5hbWUpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIHBhdGguam9pbihvcy5ob21lZGlyKCksIGAuJHthcHBOYW1lfWApO1xuICAgIH1cbn1cblxuLyoqXG4gKiBFbnN1cmUgYSBkaXJlY3RvcnkgZXhpc3RzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbnN1cmVEaXIoZGlyUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpclBhdGgpKSB7XG4gICAgICAgIGZzLm1rZGlyU3luYyhkaXJQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBsb2dzIGRpcmVjdG9yeSBwYXRoXG4gKiBAcGFyYW0gY3VzdG9tV29ya0RpclBhdGggT3B0aW9uYWwgY3VzdG9tIHdvcmsgZGlyZWN0b3J5IHBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvZ3NQYXRoKGN1c3RvbVdvcmtEaXJQYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBJZiBhIHNwZWNpZmljIHdvcmsgZGlyZWN0b3J5IGlzIHByb3ZpZGVkLCB1c2UgaXRcbiAgICBjb25zdCBiYXNlUGF0aCA9IGN1c3RvbVdvcmtEaXJQYXRoIHx8IGdldFdvcmtEaXJQYXRoKCkgfHwgZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICBjb25zdCBsb2dzUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgJ2xvZ3MnKTtcbiAgICBlbnN1cmVEaXIobG9nc1BhdGgpO1xuICAgIHJldHVybiBsb2dzUGF0aDtcbn1cblxuLyoqXG4gKiBHZXQgdGhlIHVzZXIgd29yayBkaXJlY3RvcnkgcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ya0RpclBhdGgoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICByZXR1cm4gZGF0YS53b3JrRGlyIHx8IG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgd29yayBkaXJlY3RvcnkgcGF0aDonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBTZXQgdGhlIHVzZXIgd29yayBkaXJlY3RvcnkgcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0V29ya0RpclBhdGgod29ya0RpclBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFwcERhdGFQYXRoID0gZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICAgICAgZW5zdXJlRGlyKGFwcERhdGFQYXRoKTtcblxuICAgICAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0Rpcjogd29ya0RpclBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2dFcnJvcignRXJyb3Igc2V0dGluZyB3b3JrIGRpcmVjdG9yeSBwYXRoOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0iLCIvLyBzcmMvc2VydmljZXMvZG9ja2VyL2RvY2tlckNvbXBvc2VTZXJ2aWNlLnRzXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBnZXRBcHBEYXRhUGF0aCB9IGZyb20gJy4uL3N5c3RlbS9wYXRoU2VydmljZSc7XG5pbXBvcnQgc2V0dGluZ3NTZXJ2aWNlIGZyb20gJy4uL3NldHRpbmdzL3NldHRpbmdzU2VydmljZSc7XG5pbXBvcnQgeyBsb2dJbmZvLCBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLyoqXG4gKiBTZXJ2aWNlIGZvciBtYW5hZ2luZyBEb2NrZXIgQ29tcG9zZSBvcGVyYXRpb25zIGZvciBPZG9vIGluc3RhbmNlc1xuICovXG5jbGFzcyBEb2NrZXJDb21wb3NlU2VydmljZSB7XG4gICAgcHJpdmF0ZSBwcm9qZWN0c1BhdGg6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLnByb2plY3RzUGF0aCA9IHBhdGguam9pbihnZXRBcHBEYXRhUGF0aCgpLCAncHJvamVjdHMnKTtcblxuICAgICAgICAvLyBFbnN1cmUgcHJvamVjdHMgZGlyZWN0b3J5IGV4aXN0c1xuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmModGhpcy5wcm9qZWN0c1BhdGgpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyh0aGlzLnByb2plY3RzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRlZCBwcm9qZWN0cyBkaXJlY3Rvcnk6ICR7dGhpcy5wcm9qZWN0c1BhdGh9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBwcm9qZWN0cyBkaXJlY3RvcnlgLCBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBvciB1cGRhdGUgdGhlIHByb2plY3RzIHBhdGggYmFzZWQgb24gd29ya2RpclxuICAgICAqL1xuICAgIGFzeW5jIGluaXRpYWxpemVQcm9qZWN0c1BhdGgoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGF3YWl0IHNldHRpbmdzU2VydmljZS5nZXRXb3JrRGlyUGF0aCgpO1xuICAgICAgICAgICAgaWYgKHdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9qZWN0c1BhdGggPSB3b3JrRGlyUGF0aDtcblxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBvZG9vIGFuZCBwb3N0Z3JlcyBkaXJlY3Rvcmllc1xuICAgICAgICAgICAgICAgIGNvbnN0IG9kb29QYXRoID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvc3RncmVzUGF0aCA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJyk7XG5cbiAgICAgICAgICAgICAgICAvLyBFbnN1cmUgYm90aCBkaXJlY3RvcmllcyBleGlzdFxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhvZG9vUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKG9kb29QYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHBvc3RncmVzUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHBvc3RncmVzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgVXBkYXRlZCBwcm9qZWN0IHBhdGhzOiAke3RoaXMucHJvamVjdHNQYXRofWApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBObyB3b3JrZGlyIGZvdW5kLCB1c2luZyBkZWZhdWx0IHBhdGg6ICR7dGhpcy5wcm9qZWN0c1BhdGh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgaW5pdGlhbGl6aW5nIHByb2plY3QgcGF0aHNgLCBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoU3RyaW5nKGVycm9yKSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgKi9cbiAgICBhc3luYyBjaGVja0RvY2tlcigpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oJ0NoZWNraW5nIERvY2tlciBlbmdpbmUgc3RhdHVzJyk7XG4gICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoJ2RvY2tlciBpbmZvJyk7XG4gICAgICAgICAgICBsb2dJbmZvKCdEb2NrZXIgZW5naW5lIGlzIHJ1bm5pbmcnKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdEb2NrZXIgZW5naW5lIGlzIG5vdCBydW5uaW5nIG9yIG5vdCBpbnN0YWxsZWQnLCBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyKSkpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5zdXJlIERvY2tlciBuZXR3b3JrIGV4aXN0c1xuICAgICAqL1xuICAgIGFzeW5jIGVuc3VyZU5ldHdvcmtFeGlzdHMobmV0d29ya05hbWU6IHN0cmluZyA9ICdvZG9vLW5ldHdvcmsnKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBpZiBuZXR3b3JrIGV4aXN0czogJHtuZXR3b3JrTmFtZX1gKTtcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBuZXR3b3JrIGxzIC0tZm9ybWF0IFwie3suTmFtZX19XCJgKTtcblxuICAgICAgICAgICAgaWYgKCFzdGRvdXQuaW5jbHVkZXMobmV0d29ya05hbWUpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRpbmcgbmV0d29yazogJHtuZXR3b3JrTmFtZX1gKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBuZXR3b3JrIGNyZWF0ZSAke25ldHdvcmtOYW1lfWApO1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYE5ldHdvcmsgY3JlYXRlZCBzdWNjZXNzZnVsbHk6ICR7bmV0d29ya05hbWV9YCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYE5ldHdvcmsgJHtuZXR3b3JrTmFtZX0gYWxyZWFkeSBleGlzdHNgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBlbnN1cmluZyBuZXR3b3JrICR7bmV0d29ya05hbWV9IGV4aXN0c2AsIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyIDogbmV3IEVycm9yKFN0cmluZyhlcnIpKSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBhIHBvcnQgaXMgYXZhaWxhYmxlIGFuZCBmaW5kIGFuIGFsdGVybmF0aXZlIGlmIG5lZWRlZFxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY2hlY2tQb3J0QXZhaWxhYmlsaXR5KHBvcnQ6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBUZXN0aW5nIHBvcnQgJHtwb3J0fSBhdmFpbGFiaWxpdHlgKTtcbiAgICAgICAgICAgIGNvbnN0IG5ldCA9IHJlcXVpcmUoJ25ldCcpO1xuICAgICAgICAgICAgY29uc3QgdGVzdGVyID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgdGVzdGVyLm9uY2UoJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBQb3J0ICR7cG9ydH0gaXMgaW4gdXNlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBQb3J0ICR7cG9ydH0gaXMgYWxyZWFkeSBpbiB1c2VgKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGVzdGVyLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUG9ydCAke3BvcnR9IGlzIGF2YWlsYWJsZWApO1xuICAgICAgICAgICAgICAgICAgICB0ZXN0ZXIuY2xvc2UoKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRlc3Rlci5saXN0ZW4ocG9ydCwgJzAuMC4wLjAnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcG9ydDsgLy8gUG9ydCBpcyBhdmFpbGFibGUsIHVzZSBpdFxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGxvZ0luZm8oYEZpbmRpbmcgYWx0ZXJuYXRpdmUgcG9ydCB0byAke3BvcnR9YCk7XG4gICAgICAgICAgICBsZXQgbmV3UG9ydCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIFRyeSBuZXh0IDIwIHBvcnRzXG4gICAgICAgICAgICBmb3IgKGxldCB0ZXN0UG9ydCA9IHBvcnQgKyAxOyB0ZXN0UG9ydCA8IHBvcnQgKyAyMDsgdGVzdFBvcnQrKykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ldCA9IHJlcXVpcmUoJ25ldCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXN0ZXIgPSBuZXQuY3JlYXRlU2VydmVyKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNBdmFpbGFibGUgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdGVyLm9uY2UoJ2Vycm9yJywgKCkgPT4gcmVzb2x2ZShmYWxzZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdGVyLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXN0ZXIuY2xvc2UoKCkgPT4gcmVzb2x2ZSh0cnVlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlc3Rlci5saXN0ZW4odGVzdFBvcnQsICcwLjAuMC4wJyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0F2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3UG9ydCA9IHRlc3RQb3J0O1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgRm91bmQgYXZhaWxhYmxlIHBvcnQ6ICR7bmV3UG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTa2lwIHRoaXMgcG9ydCBhbmQgdHJ5IG5leHRcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUG9ydCAke3Rlc3RQb3J0fSB0ZXN0IGZhaWxlZGApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5ld1BvcnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3UG9ydDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb3J0ICR7cG9ydH0gaXMgaW4gdXNlIGFuZCBubyBhbHRlcm5hdGl2ZSBwb3J0cyBhcmUgYXZhaWxhYmxlLiBQbGVhc2Ugc3BlY2lmeSBhIGRpZmZlcmVudCBwb3J0LmApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjb3JyZWN0IERvY2tlciBDb21wb3NlIGNvbW1hbmRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRDb21wb3NlQ29tbWFuZCgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKCdkb2NrZXIgY29tcG9zZSB2ZXJzaW9uJyk7XG4gICAgICAgICAgICByZXR1cm4gJ2RvY2tlciBjb21wb3NlJztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKCdkb2NrZXItY29tcG9zZSAtLXZlcnNpb24nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2RvY2tlci1jb21wb3NlJztcbiAgICAgICAgICAgIH0gY2F0Y2ggKGNvbXBvc2VFcnJvcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRG9ja2VyIENvbXBvc2UgaXMgbm90IGF2YWlsYWJsZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgUG9zdGdyZVNRTCBpbnN0YW5jZSB3aXRoIERvY2tlciBDb21wb3NlXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlUG9zdGdyZXNJbnN0YW5jZShcbiAgICAgICAgaW5zdGFuY2VOYW1lOiBzdHJpbmcsXG4gICAgICAgIHZlcnNpb246IHN0cmluZyxcbiAgICAgICAgcG9ydDogbnVtYmVyID0gNTQzMixcbiAgICAgICAgdXNlcm5hbWU6IHN0cmluZyA9ICdwb3N0Z3JlcycsXG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmcgPSAncG9zdGdyZXMnXG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZzsgcG9ydD86IG51bWJlciB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBTdGFydGluZyBQb3N0Z3JlU1FMIGluc3RhbmNlIGNyZWF0aW9uOiAke2luc3RhbmNlTmFtZX0sIHZlcnNpb246ICR7dmVyc2lvbn0sIHBvcnQ6ICR7cG9ydH1gKTtcblxuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHdlJ3JlIHVzaW5nIHRoZSBjb3JyZWN0IHBhdGhcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBMb2cgd2hlcmUgZmlsZXMgd2lsbCBiZSBzYXZlZFxuICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYEZpbGVzIHdpbGwgYmUgc2F2ZWQgdG86ICR7cHJvamVjdERpcn1gKTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5jaGVja0RvY2tlcigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdEb2NrZXIgaXMgbm90IHJ1bm5pbmcuIFBsZWFzZSBzdGFydCBEb2NrZXIgYW5kIHRyeSBhZ2Fpbi4nIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgbmV0d29yayBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmxvYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgY29uc3QgbmV0d29ya05hbWUgPSBzZXR0aW5ncz8ubmV0d29yayB8fCAnb2Rvby1uZXR3b3JrJztcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5lbnN1cmVOZXR3b3JrRXhpc3RzKG5ldHdvcmtOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgRmFpbGVkIHRvIGNyZWF0ZSBvciB2ZXJpZnkgbmV0d29yayAke25ldHdvcmtOYW1lfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgcG9ydCBhdmFpbGFiaWxpdHlcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IGF3YWl0IHRoaXMuY2hlY2tQb3J0QXZhaWxhYmlsaXR5KHBvcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIHByb2plY3QgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgSW5zdGFuY2UgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzOiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gYWxyZWFkeSBleGlzdHNgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYENyZWF0aW5nIHByb2plY3QgZGlyZWN0b3J5OiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBEb2NrZXIgQ29tcG9zZSBmaWxlXG4gICAgICAgICAgICBsb2dJbmZvKGBHZW5lcmF0aW5nIERvY2tlciBDb21wb3NlIGZpbGUgd2l0aCBwb3J0ICR7cG9ydH1gKTtcblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbnRlbnQgPSBgXG5zZXJ2aWNlczpcbiAgcG9zdGdyZXM6XG4gICAgaW1hZ2U6IHBvc3RncmVzOiR7dmVyc2lvbn1cbiAgICBjb250YWluZXJfbmFtZTogJHtpbnN0YW5jZU5hbWV9XG4gICAgZW52aXJvbm1lbnQ6XG4gICAgICAtIFBPU1RHUkVTX1BBU1NXT1JEPSR7cGFzc3dvcmR9XG4gICAgICAtIFBPU1RHUkVTX1VTRVI9JHt1c2VybmFtZX1cbiAgICAgIC0gUE9TVEdSRVNfREI9cG9zdGdyZXNcbiAgICBwb3J0czpcbiAgICAgIC0gXCIke3BvcnR9OjU0MzJcIlxuICAgIHZvbHVtZXM6XG4gICAgICAtICR7aW5zdGFuY2VOYW1lfV9kYXRhOi92YXIvbGliL3Bvc3RncmVzcWwvZGF0YVxuICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkXG4gICAgbmV0d29ya3M6XG4gICAgICAtICR7bmV0d29ya05hbWV9XG5cbm5ldHdvcmtzOlxuICAke25ldHdvcmtOYW1lfTpcbiAgICBleHRlcm5hbDogdHJ1ZVxuXG52b2x1bWVzOlxuICAke2luc3RhbmNlTmFtZX1fZGF0YTpcbiAgICBkcml2ZXI6IGxvY2FsXG5gO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgbG9nSW5mbyhgV3JpdGluZyBEb2NrZXIgQ29tcG9zZSBmaWxlIHRvICR7Y29tcG9zZUZpbGVQYXRofWApO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhjb21wb3NlRmlsZVBhdGgsIGNvbXBvc2VDb250ZW50LCAndXRmOCcpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgZmlsZSB3YXMgY3JlYXRlZFxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgQ29tcG9zZSBmaWxlIG5vdCBjcmVhdGVkOiAke2NvbXBvc2VGaWxlUGF0aH1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0ZhaWxlZCB0byBjcmVhdGUgRG9ja2VyIENvbXBvc2UgZmlsZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGluc3RhbmNlIGluZm8gZmlsZVxuICAgICAgICAgICAgY29uc3QgaW5mb0ZpbGUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRpbmcgaW5zdGFuY2UgaW5mbyBmaWxlOiAke2luZm9GaWxlfWApO1xuXG4gICAgICAgICAgICBjb25zdCBpbmZvID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGluc3RhbmNlTmFtZSxcbiAgICAgICAgICAgICAgICB0eXBlOiAncG9zdGdyZXMnLFxuICAgICAgICAgICAgICAgIHZlcnNpb24sXG4gICAgICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgICAgICB1c2VybmFtZSxcbiAgICAgICAgICAgICAgICBwYXNzd29yZCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbmZvRmlsZSwgSlNPTi5zdHJpbmdpZnkoaW5mbywgbnVsbCwgMiksICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFN0YXJ0IHRoZSBjb250YWluZXIgd2l0aCBEb2NrZXIgQ29tcG9zZVxuICAgICAgICAgICAgbG9nSW5mbyhgU3RhcnRpbmcgUG9zdGdyZVNRTCBjb250YWluZXJgKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VDb21tYW5kID0gYXdhaXQgdGhpcy5nZXRDb21wb3NlQ29tbWFuZCgpO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEV4ZWN1dGluZzogY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IHVwIC1kYCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3Rkb3V0KSBsb2dJbmZvKGBEb2NrZXIgQ29tcG9zZSBzdGRvdXQ6ICR7c3Rkb3V0fWApO1xuICAgICAgICAgICAgICAgIGlmIChzdGRlcnIpIGxvZ0luZm8oYERvY2tlciBDb21wb3NlIHN0ZGVycjogJHtzdGRlcnJ9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzdGFydGluZyBjb250YWluZXJgLCBlcnJvcik7XG5cbiAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZ2V0IG1vcmUgZXJyb3IgZGV0YWlsc1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBsb2dzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGxvZ3NgKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIGxvZ3M6ICR7bG9nc31gKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcihgQ291bGRuJ3QgZ2V0IGNvbnRhaW5lciBsb2dzYCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3Igc3RhcnRpbmcgY29udGFpbmVyOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmVyaWZ5IHRoZSBjb250YWluZXIgaXMgcnVubmluZ1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBWZXJpZnlpbmcgY29udGFpbmVyIGlzIHJ1bm5pbmdgKTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogY29udGFpbmVyU3RhdHVzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBwcyAtLWZpbHRlciBcIm5hbWU9JHtpbnN0YW5jZU5hbWV9XCIgLS1mb3JtYXQgXCJ7ey5TdGF0dXN9fVwiYCk7XG5cbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgc3RhdHVzOiAke2NvbnRhaW5lclN0YXR1c31gKTtcblxuICAgICAgICAgICAgICAgIGlmICghY29udGFpbmVyU3RhdHVzLmluY2x1ZGVzKCdVcCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBtYXkgbm90IGJlIHJ1bm5pbmcgY29ycmVjdGx5YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gR2V0IGNvbnRhaW5lciBsb2dzIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBjb250YWluZXJMb2dzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBsb2dzICR7aW5zdGFuY2VOYW1lfSAtLXRhaWwgMjBgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBsb2dzOiAke2NvbnRhaW5lckxvZ3N9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcihgQ291bGRuJ3QgZ2V0IGNvbnRhaW5lciBsb2dzYCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIC8vIFN0aWxsIHJldHVybiBzdWNjZXNzIHNpbmNlIGZpbGVzIHdlcmUgY3JlYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgY3JlYXRlZCwgYnV0IGNvbnRhaW5lciBtYXkgbm90IGJlIHJ1bm5pbmcgY29ycmVjdGx5LiBDaGVjayBsb2dzLmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3J0XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY2hlY2tpbmcgY29udGFpbmVyIHN0YXR1c2AsIGVycm9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nSW5mbyhgU3VjY2Vzc2Z1bGx5IGNyZWF0ZWQgUG9zdGdyZVNRTCBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5IG9uIHBvcnQgJHtwb3J0fSFgLFxuICAgICAgICAgICAgICAgIHBvcnRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY3JlYXRpbmcgUG9zdGdyZVNRTCBpbnN0YW5jZSAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBjcmVhdGluZyBpbnN0YW5jZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGEgRG9ja2VyIENvbXBvc2UgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdGFydEluc3RhbmNlKGluc3RhbmNlTmFtZTogc3RyaW5nKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVQcm9qZWN0c1BhdGgoKTtcblxuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBjb3JyZWN0IGRpcmVjdG9yeSBiYXNlZCBvbiBpbnN0YW5jZSB0eXBlXG4gICAgICAgICAgICBsZXQgcHJvamVjdERpcjtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZU5hbWUuaW5jbHVkZXMoJ3Bvc3RncmVzXycpKSB7XG4gICAgICAgICAgICAgICAgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nLCBpbnN0YW5jZU5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkb2VzIG5vdCBleGlzdGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUZpbGUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgQ29tcG9zZSBmaWxlIGZvciAke2luc3RhbmNlTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0YXJ0aW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcbiAgICAgICAgICAgIGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBzdGFydGVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzdGFydGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3Igc3RhcnRpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIGEgRG9ja2VyIENvbXBvc2UgaW5zdGFuY2VcbiAgICAgKi9cbiAgICBhc3luYyBzdG9wSW5zdGFuY2UoaW5zdGFuY2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgdGhlIGNvcnJlY3QgZGlyZWN0b3J5IGJhc2VkIG9uIGluc3RhbmNlIHR5cGVcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlVHlwZSA9IGluc3RhbmNlTmFtZS5pbmNsdWRlcygncG9zdGdyZXMnKSA/ICdwb3N0Z3JlcycgOiAnb2Rvbyc7XG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCBpbnN0YW5jZVR5cGUsIGluc3RhbmNlTmFtZSk7XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYFN0b3BwaW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gZG9lcyBub3QgZXhpc3RgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VGaWxlID0gcGF0aC5qb2luKHByb2plY3REaXIsICdkb2NrZXItY29tcG9zZS55bWwnKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhjb21wb3NlRmlsZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYENvbXBvc2UgZmlsZSBmb3IgJHtpbnN0YW5jZU5hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgaXQncyBhIFBvc3RncmVTUUwgaW5zdGFuY2UsIGNoZWNrIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXNcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZVR5cGUgPT09ICdwb3N0Z3JlcycpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIGJlZm9yZSBzdG9wcGluZyBQb3N0Z3JlU1FMOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgICAgIC8vIExpc3QgYWxsIGluc3RhbmNlcyB0byBmaW5kIGRlcGVuZGVudCBvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gYXdhaXQgdGhpcy5saXN0SW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBGaWx0ZXIgZm9yIGFjdGl2ZSBPZG9vIGluc3RhbmNlcyB0aGF0IGRlcGVuZCBvbiB0aGlzIFBvc3RncmVTUUwgaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBkZXBlbmRlbnRJbnN0YW5jZXMgPSBpbnN0YW5jZXMuZmlsdGVyKGluc3RhbmNlID0+XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmluZm8gJiZcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mby50eXBlID09PSAnb2RvbycgJiZcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mby5wb3N0Z3Jlc0luc3RhbmNlID09PSBpbnN0YW5jZU5hbWUgJiZcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2Uuc3RhdHVzLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3VwJylcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRlcGVuZGVudEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudE5hbWVzID0gZGVwZW5kZW50SW5zdGFuY2VzLm1hcChpbnN0YW5jZSA9PiBpbnN0YW5jZS5uYW1lKS5qb2luKCcsICcpO1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCBydW5uaW5nIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlczogJHtkZXBlbmRlbnROYW1lc31gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYENhbm5vdCBzdG9wIFBvc3RncmVTUUwgaW5zdGFuY2UgXCIke2luc3RhbmNlTmFtZX1cIiBiZWNhdXNlIGl0IGhhcyBydW5uaW5nIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIGl0OiAke2RlcGVuZGVudE5hbWVzfS4gUGxlYXNlIHN0b3AgdGhlc2UgaW5zdGFuY2VzIGZpcnN0LmBcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsb2dJbmZvKCdObyBydW5uaW5nIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlcyBmb3VuZCwgcHJvY2VlZGluZyB3aXRoIHN0b3AnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG4gICAgICAgICAgICBsb2dJbmZvKGBTdG9wcGluZyBpbnN0YW5jZSB3aXRoOiAke2NvbXBvc2VDb21tYW5kfSBzdG9wYCk7XG4gICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IHN0b3BgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBzdG9wcGVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBzdG9wcGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3Igc3RvcHBpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSBEb2NrZXIgQ29tcG9zZSBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIGRlbGV0ZUluc3RhbmNlKGluc3RhbmNlTmFtZTogc3RyaW5nLCBrZWVwRmlsZXM6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgY29ycmVjdCBkaXJlY3RvcnkgYmFzZWQgb24gaW5zdGFuY2UgdHlwZVxuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VUeXBlID0gaW5zdGFuY2VOYW1lLmluY2x1ZGVzKCdwb3N0Z3JlcycpID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgbG9nSW5mbyhgRGVsZXRpbmcgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkb2VzIG5vdCBleGlzdGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgaXQncyBhIFBvc3RncmVTUUwgaW5zdGFuY2UsIGNoZWNrIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXNcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZVR5cGUgPT09ICdwb3N0Z3JlcycpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIGJlZm9yZSBkZWxldGluZyBQb3N0Z3JlU1FMOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgICAgIC8vIExpc3QgYWxsIGluc3RhbmNlcyB0byBmaW5kIGRlcGVuZGVudCBvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gYXdhaXQgdGhpcy5saXN0SW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgICAgICAvLyBHZXQgYWxsIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIHRoaXMgUG9zdGdyZVNRTCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdGFuY2UgPT5cbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mbyAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnR5cGUgPT09ICdvZG9vJyAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IGluc3RhbmNlTmFtZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVwZW5kZW50SW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVwZW5kZW50TmFtZXMgPSBkZXBlbmRlbnRJbnN0YW5jZXMubWFwKGluc3RhbmNlID0+IGluc3RhbmNlLm5hbWUpLmpvaW4oJywgJyk7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYEZvdW5kIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlczogJHtkZXBlbmRlbnROYW1lc31gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYENhbm5vdCBkZWxldGUgUG9zdGdyZVNRTCBpbnN0YW5jZSBcIiR7aW5zdGFuY2VOYW1lfVwiIGJlY2F1c2UgaXQgaGFzIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIGl0OiAke2RlcGVuZGVudE5hbWVzfS4gUGxlYXNlIGRlbGV0ZSB0aGVzZSBpbnN0YW5jZXMgZmlyc3QuYFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxvZ0luZm8oJ05vIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlcyBmb3VuZCwgcHJvY2VlZGluZyB3aXRoIGRlbGV0ZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcblxuICAgICAgICAgICAgLy8gU3RvcCBhbmQgcmVtb3ZlIGNvbnRhaW5lcnNcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0b3BwaW5nIGNvbnRhaW5lcnMgd2l0aCAke2NvbXBvc2VDb21tYW5kfSBkb3duYCk7XG4gICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGRvd24gLXZgKTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIHRoZSBkaXJlY3RvcnkgaWYga2VlcEZpbGVzIGlzIGZhbHNlXG4gICAgICAgICAgICBpZiAoIWtlZXBGaWxlcykge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFJlbW92aW5nIGRpcmVjdG9yeTogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgICAgIGZzLnJtU3luYyhwcm9qZWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEtlZXBpbmcgZmlsZXMgaW46ICR7cHJvamVjdERpcn1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkZWxldGVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBkZWxldGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3IgZGVsZXRpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgbG9ncyBmcm9tIGEgRG9ja2VyIGNvbnRhaW5lclxuICAgICAqL1xuICAgIGFzeW5jIGdldExvZ3MoaW5zdGFuY2VOYW1lOiBzdHJpbmcsIHNlcnZpY2U6IHN0cmluZyA9ICdhdXRvJywgdGFpbDogbnVtYmVyID0gMTAwKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGxvZ3M/OiBzdHJpbmc7IG1lc3NhZ2U/OiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgY29ycmVjdCBkaXJlY3RvcnkgYmFzZWQgb24gaW5zdGFuY2UgdHlwZVxuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VUeXBlID0gaW5zdGFuY2VOYW1lLmluY2x1ZGVzKCdwb3N0Z3JlcycpID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgbG9nSW5mbyhgR2V0dGluZyBsb2dzIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRvZXMgbm90IGV4aXN0YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBzZXJ2aWNlIGlzIGF1dG8sIGRldGVybWluZSB0aGUgZGVmYXVsdCBzZXJ2aWNlIGJhc2VkIG9uIGluc3RhbmNlIHR5cGVcbiAgICAgICAgICAgIGlmIChzZXJ2aWNlID09PSAnYXV0bycpIHtcbiAgICAgICAgICAgICAgICBzZXJ2aWNlID0gaW5zdGFuY2VUeXBlID09PSAncG9zdGdyZXMnID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nSW5mbyhgVXNpbmcgc2VydmljZTogJHtzZXJ2aWNlfSBmb3IgbG9nc2ApO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcbiAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGxvZ3MgLS10YWlsPSR7dGFpbH0gJHtzZXJ2aWNlfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbG9nczogc3Rkb3V0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgZ2V0dGluZyBsb2dzIGZvciAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBnZXR0aW5nIGxvZ3M6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IGFsbCBEb2NrZXIgQ29tcG9zZSBpbnN0YW5jZXNcbiAgICAgKi9cbiAgICBhc3luYyBsaXN0SW5zdGFuY2VzKCk6IFByb21pc2U8QXJyYXk8eyBuYW1lOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nOyBpbmZvOiBhbnkgfT4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuICAgICAgICAgICAgbG9nSW5mbygnTGlzdGluZyBpbnN0YW5jZXMgZnJvbSBib3RoIG9kb28gYW5kIHBvc3RncmVzIGRpcmVjdG9yaWVzJyk7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyBzdGF0dXM6IHN0cmluZzsgaW5mbzogYW55IH0+ID0gW107XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGJhc2UgcGF0aCBleGlzdHNcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLnByb2plY3RzUGF0aCkpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKCdCYXNlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZ1bmN0aW9uIHRvIHNjYW4gYSBkaXJlY3RvcnkgZm9yIGluc3RhbmNlc1xuICAgICAgICAgICAgY29uc3Qgc2NhbkRpcmVjdG9yeSA9IGFzeW5jIChkaXJQYXRoOiBzdHJpbmcsIGluc3RhbmNlVHlwZTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpclBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYCR7aW5zdGFuY2VUeXBlfSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3Q6ICR7ZGlyUGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGRpcnMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKTtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCAke2RpcnMubGVuZ3RofSBkaXJlY3RvcmllcyBpbiAke2luc3RhbmNlVHlwZX0gcGF0aGApO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlycykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZURpciA9IHBhdGguam9pbihkaXJQYXRoLCBkaXIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZSA9IHBhdGguam9pbihpbnN0YW5jZURpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvRmlsZSA9IHBhdGguam9pbihpbnN0YW5jZURpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlKSAmJiBmcy5sc3RhdFN5bmMoaW5zdGFuY2VEaXIpLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzdGF0dXMgPSAnVW5rbm93bic7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgaW5mbzogeyBba2V5OiBzdHJpbmddOiBhbnkgfSA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBwcyAtLWZpbHRlciBcIm5hbWU9JHtkaXJ9XCIgLS1mb3JtYXQgXCJ7ey5TdGF0dXN9fVwiYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gc3Rkb3V0LnRyaW0oKSA/IHN0ZG91dC50cmltKCkgOiAnTm90IHJ1bm5pbmcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSAnTm90IHJ1bm5pbmcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbmZvRmlsZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmZvID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoaW5mb0ZpbGUsICd1dGYtOCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHR5cGUgaW5mb3JtYXRpb24gaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpbmZvLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8udHlwZSA9IGluc3RhbmNlVHlwZSA9PT0gJ29kb28nID8gJ29kb28nIDogJ3Bvc3RncmVzJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8gPSB7IG5hbWU6IGRpciwgZXJyb3I6ICdJbnZhbGlkIGluZm8gZmlsZScsIHR5cGU6IGluc3RhbmNlVHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mbyA9IHsgbmFtZTogZGlyLCB0eXBlOiBpbnN0YW5jZVR5cGUgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGRpcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mb1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYEFkZGVkICR7aW5zdGFuY2VUeXBlfSBpbnN0YW5jZTogJHtkaXJ9LCBzdGF0dXM6ICR7c3RhdHVzfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gU2NhbiBib3RoIGRpcmVjdG9yaWVzXG4gICAgICAgICAgICBhd2FpdCBzY2FuRGlyZWN0b3J5KHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nKSwgJ29kb28nKTtcbiAgICAgICAgICAgIGF3YWl0IHNjYW5EaXJlY3RvcnkocGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAncG9zdGdyZXMnKSwgJ3Bvc3RncmVzJyk7XG5cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgbGlzdGluZyBpbnN0YW5jZXNgLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgUG9zdGdyZVNRTCBjcmVkZW50aWFsc1xuICAgICAqL1xuICAgIGFzeW5jIHVwZGF0ZVBvc3RncmVzQ3JlZGVudGlhbHMoXG4gICAgICAgIGluc3RhbmNlTmFtZTogc3RyaW5nLFxuICAgICAgICBuZXdVc2VybmFtZTogc3RyaW5nLFxuICAgICAgICBuZXdQYXNzd29yZDogc3RyaW5nXG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZzsgdXBkYXRlZEluc3RhbmNlcz86IHN0cmluZ1tdIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBGaW5kIHRoZSBpbnN0YW5jZSBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsICdwb3N0Z3JlcycsIGluc3RhbmNlTmFtZSk7XG4gICAgICAgICAgICBsb2dJbmZvKGBVcGRhdGluZyBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRvZXMgbm90IGV4aXN0YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZXQgZXhpc3RpbmcgY29tcG9zZSBmaWxlXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYERvY2tlciBDb21wb3NlIGZpbGUgZm9yICR7aW5zdGFuY2VOYW1lfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbmQgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzXG4gICAgICAgICAgICBsb2dJbmZvKGBDaGVja2luZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIHRoYXQgbmVlZCB1cGRhdGVkIGNyZWRlbnRpYWxzYCk7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBhd2FpdCB0aGlzLmxpc3RJbnN0YW5jZXMoKTtcbiAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdGFuY2UgPT5cbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvICYmXG4gICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mby50eXBlID09PSAnb2RvbycgJiZcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IGluc3RhbmNlTmFtZVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gU3RvcmUgZGVwZW5kZW50IGluc3RhbmNlcyBmb3IgcmVwb3J0aW5nXG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbnROYW1lcyA9IGRlcGVuZGVudEluc3RhbmNlcy5tYXAoaW5zdGFuY2UgPT4gaW5zdGFuY2UubmFtZSk7XG4gICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCAke2RlcGVuZGVudE5hbWVzLmxlbmd0aH0gZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzOiAke2RlcGVuZGVudE5hbWVzLmpvaW4oJywgJykgfHwgJ25vbmUnfWApO1xuXG4gICAgICAgICAgICAvLyBSZWFkIGFuZCB1cGRhdGUgdGhlIGNvbXBvc2UgZmlsZVxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhjb21wb3NlRmlsZVBhdGgsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRDb250ZW50ID0gY29udGVudFxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8tIFBPU1RHUkVTX1BBU1NXT1JEPVteXFxuXSsvZywgYC0gUE9TVEdSRVNfUEFTU1dPUkQ9JHtuZXdQYXNzd29yZH1gKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8tIFBPU1RHUkVTX1VTRVI9W15cXG5dKy9nLCBgLSBQT1NUR1JFU19VU0VSPSR7bmV3VXNlcm5hbWV9YCk7XG5cbiAgICAgICAgICAgIC8vIFdyaXRlIGJhY2sgdXBkYXRlZCBjb250ZW50XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGNvbXBvc2VGaWxlUGF0aCwgdXBkYXRlZENvbnRlbnQsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgaW5zdGFuY2UgaW5mbyBmaWxlXG4gICAgICAgICAgICBjb25zdCBpbmZvRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoaW5mb0ZpbGVQYXRoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZm9Db250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGluZm9GaWxlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gSlNPTi5wYXJzZShpbmZvQ29udGVudCk7XG5cbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgY3JlZGVudGlhbHNcbiAgICAgICAgICAgICAgICBpbmZvLnVzZXJuYW1lID0gbmV3VXNlcm5hbWU7XG4gICAgICAgICAgICAgICAgaW5mby5wYXNzd29yZCA9IG5ld1Bhc3N3b3JkO1xuICAgICAgICAgICAgICAgIGluZm8udXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbmZvRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KGluZm8sIG51bGwsIDIpLCAndXRmOCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZXQgdGhlIGNvbXBvc2UgY29tbWFuZCBmb3IgcmVzdGFydGluZ1xuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG5cbiAgICAgICAgICAgIC8vIFJlc3RhcnQgdGhlIFBvc3RncmVTUUwgY29udGFpbmVyXG4gICAgICAgICAgICBsb2dJbmZvKGBSZXN0YXJ0aW5nIFBvc3RncmVTUUwgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKGBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSBkb3duICYmICR7Y29tcG9zZUNvbW1hbmR9IHVwIC1kYCk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBlYWNoIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkSW5zdGFuY2VzID0gW107XG4gICAgICAgICAgICBjb25zdCBmYWlsZWRVcGRhdGVzID0gW107XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgb2Rvb0luc3RhbmNlIG9mIGRlcGVuZGVudEluc3RhbmNlcykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFVwZGF0aW5nIGNvbmZpZyBmb3IgZGVwZW5kZW50IE9kb28gaW5zdGFuY2U6ICR7b2Rvb0luc3RhbmNlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUGF0aCB0byB0aGUgT2RvbyBpbnN0YW5jZSBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Rvb0RpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ29kb28nLCBvZG9vSW5zdGFuY2UubmFtZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIG9kb28uY29uZiBmaWxlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RpciA9IHBhdGguam9pbihvZG9vRGlyLCAnY29uZmlnJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9kb29Db25mUGF0aCA9IHBhdGguam9pbihjb25maWdEaXIsICdvZG9vLmNvbmYnKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhvZG9vQ29uZlBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgb2Rvb0NvbmZDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKG9kb29Db25mUGF0aCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIGRhdGFiYXNlIGNyZWRlbnRpYWxzIGluIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9kb29Db25mQ29udGVudCA9IG9kb29Db25mQ29udGVudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9kYl91c2VyID0gLiovZywgYGRiX3VzZXIgPSAke25ld1VzZXJuYW1lfWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL2RiX3Bhc3N3b3JkID0gLiovZywgYGRiX3Bhc3N3b3JkID0gJHtuZXdQYXNzd29yZH1gKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV3JpdGUgYmFjayB1cGRhdGVkIG9kb28uY29uZlxuICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhvZG9vQ29uZlBhdGgsIG9kb29Db25mQ29udGVudCwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFVwZGF0ZWQgb2Rvby5jb25mIGZvciAke29kb29JbnN0YW5jZS5uYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgaW5zdGFuY2UtaW5mby5qc29uIGlmIGl0IGV4aXN0c1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Rvb0luZm9QYXRoID0gcGF0aC5qb2luKG9kb29EaXIsICdpbnN0YW5jZS1pbmZvLmpzb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKG9kb29JbmZvUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvZG9vSW5mbyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG9kb29JbmZvUGF0aCwgJ3V0ZjgnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgUG9zdGdyZVNRTCBjcmVkZW50aWFscyByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9kb29JbmZvLnBnQ3JlZGVudGlhbHMpIG9kb29JbmZvLnBnQ3JlZGVudGlhbHMgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZG9vSW5mby5wZ0NyZWRlbnRpYWxzLnVzZXJuYW1lID0gbmV3VXNlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Rvb0luZm8ucGdDcmVkZW50aWFscy5wYXNzd29yZCA9IG5ld1Bhc3N3b3JkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9kb29JbmZvLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMob2Rvb0luZm9QYXRoLCBKU09OLnN0cmluZ2lmeShvZG9vSW5mbywgbnVsbCwgMiksICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgVXBkYXRlZCBpbnN0YW5jZS1pbmZvLmpzb24gZm9yICR7b2Rvb0luc3RhbmNlLm5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlc3RhcnQgdGhlIE9kb28gaW5zdGFuY2UgaWYgaXQncyBydW5uaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob2Rvb0luc3RhbmNlLnN0YXR1cy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd1cCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgUmVzdGFydGluZyBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZTogJHtvZG9vSW5zdGFuY2UubmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtvZG9vRGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGRvd24gJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgU3VjY2Vzc2Z1bGx5IHJlc3RhcnRlZCAke29kb29JbnN0YW5jZS5uYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHJlc3RhcnRFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHJlc3RhcnRpbmcgT2RvbyBpbnN0YW5jZSAke29kb29JbnN0YW5jZS5uYW1lfWAsIHJlc3RhcnRFcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWRVcGRhdGVzLnB1c2goe25hbWU6IG9kb29JbnN0YW5jZS5uYW1lLCBlcnJvcjogJ3Jlc3RhcnQgZmFpbHVyZSd9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBPZG9vIGluc3RhbmNlICR7b2Rvb0luc3RhbmNlLm5hbWV9IGlzIG5vdCBydW5uaW5nLCBubyBuZWVkIHRvIHJlc3RhcnRgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWFyayBhcyBzdWNjZXNzZnVsbHkgdXBkYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZEluc3RhbmNlcy5wdXNoKG9kb29JbnN0YW5jZS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvdWxkIG5vdCBmaW5kIG9kb28uY29uZiBmb3IgJHtvZG9vSW5zdGFuY2UubmFtZX0sIHNraXBwaW5nIHVwZGF0ZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZmFpbGVkVXBkYXRlcy5wdXNoKHtuYW1lOiBvZG9vSW5zdGFuY2UubmFtZSwgZXJyb3I6ICdtaXNzaW5nIGNvbmZpZ3VyYXRpb24gZmlsZSd9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGluc3RhbmNlRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHVwZGF0aW5nIE9kb28gaW5zdGFuY2UgJHtvZG9vSW5zdGFuY2UubmFtZX1gLCBpbnN0YW5jZUVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgZmFpbGVkVXBkYXRlcy5wdXNoKHtuYW1lOiBvZG9vSW5zdGFuY2UubmFtZSwgZXJyb3I6ICdnZW5lcmFsIGVycm9yJ30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUHJlcGFyZSBkZXRhaWxlZCBzdWNjZXNzIG1lc3NhZ2VcbiAgICAgICAgICAgIGxldCBzdWNjZXNzTWVzc2FnZSA9IGBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5IGZvciAke2luc3RhbmNlTmFtZX0uYDtcblxuICAgICAgICAgICAgaWYgKHVwZGF0ZWRJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3NNZXNzYWdlICs9IGAgVXBkYXRlZCAke3VwZGF0ZWRJbnN0YW5jZXMubGVuZ3RofSBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZShzKTogJHt1cGRhdGVkSW5zdGFuY2VzLmpvaW4oJywgJyl9LmA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmYWlsZWRVcGRhdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWlsZWROYW1lcyA9IGZhaWxlZFVwZGF0ZXMubWFwKGYgPT4gZi5uYW1lKS5qb2luKCcsICcpO1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3NNZXNzYWdlICs9IGAgRmFpbGVkIHRvIHVwZGF0ZSAke2ZhaWxlZFVwZGF0ZXMubGVuZ3RofSBpbnN0YW5jZShzKTogJHtmYWlsZWROYW1lc30uYDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHN1Y2Nlc3NNZXNzYWdlLFxuICAgICAgICAgICAgICAgIHVwZGF0ZWRJbnN0YW5jZXNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgdXBkYXRpbmcgUG9zdGdyZVNRTCBjcmVkZW50aWFsc2AsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIHVwZGF0aW5nIGNyZWRlbnRpYWxzOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIE9kb28gaW5zdGFuY2Ugd2l0aCBEb2NrZXIgQ29tcG9zZVxuICAgICAqL1xuICAgIGFzeW5jIGNyZWF0ZUluc3RhbmNlKFxuICAgICAgICBpbnN0YW5jZU5hbWU6IHN0cmluZyxcbiAgICAgICAgdmVyc2lvbjogc3RyaW5nLFxuICAgICAgICBlZGl0aW9uPzogc3RyaW5nLFxuICAgICAgICBhZG1pblBhc3N3b3JkPzogc3RyaW5nLFxuICAgICAgICBkYkZpbHRlcj86IGJvb2xlYW4sXG4gICAgICAgIHBvcnQ/OiBudW1iZXIsXG4gICAgICAgIGN1c3RvbUltYWdlPzogYm9vbGVhbixcbiAgICAgICAgY3VzdG9tSW1hZ2VOYW1lPzogc3RyaW5nLFxuICAgICAgICBwb3N0Z3Jlc0luc3RhbmNlPzogc3RyaW5nLFxuICAgICAgICBwZ1VzZXI/OiBzdHJpbmcsXG4gICAgICAgIHBnUGFzc3dvcmQ/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nOyBwb3J0PzogbnVtYmVyIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0YXJ0aW5nIE9kb28gaW5zdGFuY2UgY3JlYXRpb246ICR7aW5zdGFuY2VOYW1lfSwgdmVyc2lvbjogJHt2ZXJzaW9ufSwgZWRpdGlvbjogJHtlZGl0aW9ufWApO1xuXG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgd2UncmUgdXNpbmcgdGhlIGNvcnJlY3QgcGF0aFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIExvZyB3aGVyZSBmaWxlcyB3aWxsIGJlIHNhdmVkXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycsIGluc3RhbmNlTmFtZSk7XG4gICAgICAgICAgICBsb2dJbmZvKGBGaWxlcyB3aWxsIGJlIHNhdmVkIHRvOiAke3Byb2plY3REaXJ9YCk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIERvY2tlciBpcyBydW5uaW5nXG4gICAgICAgICAgICBpZiAoIWF3YWl0IHRoaXMuY2hlY2tEb2NrZXIoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnRG9ja2VyIGlzIG5vdCBydW5uaW5nLiBQbGVhc2Ugc3RhcnQgRG9ja2VyIGFuZCB0cnkgYWdhaW4uJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBFbnN1cmUgbmV0d29yayBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmxvYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgY29uc3QgbmV0d29ya05hbWUgPSBzZXR0aW5ncz8ubmV0d29yayB8fCAnb2Rvby1uZXR3b3JrJztcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5lbnN1cmVOZXR3b3JrRXhpc3RzKG5ldHdvcmtOYW1lKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgRmFpbGVkIHRvIGNyZWF0ZSBvciB2ZXJpZnkgbmV0d29yayAke25ldHdvcmtOYW1lfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgUG9zdGdyZVNRTCBpbnN0YW5jZVxuICAgICAgICAgICAgaWYgKCFwb3N0Z3Jlc0luc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdQb3N0Z3JlU1FMIGluc3RhbmNlIGlzIHJlcXVpcmVkJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgaWYgUG9zdGdyZVNRTCBpbnN0YW5jZSBleGlzdHMgYW5kIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IHBnU3RhdHVzIH0gPSBhd2FpdCBleGVjQXN5bmMoYGRvY2tlciBwcyAtLWZpbHRlciBcIm5hbWU9JHtwb3N0Z3Jlc0luc3RhbmNlfVwiIC0tZm9ybWF0IFwie3suU3RhdHVzfX1cImApO1xuICAgICAgICAgICAgICAgIGlmICghcGdTdGF0dXMgfHwgIXBnU3RhdHVzLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3VwJykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBQb3N0Z3JlU1FMIGluc3RhbmNlICR7cG9zdGdyZXNJbnN0YW5jZX0gaXMgbm90IHJ1bm5pbmcuIFBsZWFzZSBzdGFydCBpdCBmaXJzdC5gIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGNoZWNraW5nIFBvc3RncmVTUUwgc3RhdHVzYCwgZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtwb3N0Z3Jlc0luc3RhbmNlfSBub3QgZm91bmQgb3Igbm90IGFjY2Vzc2libGUuYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgbGlua2VkIGluc3RhbmNlcyBjb3VudFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBMaXN0IGFsbCBpbnN0YW5jZXMgdG8gZmluZCBsaW5rZWQgb25lc1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IGF3YWl0IHRoaXMubGlzdEluc3RhbmNlcygpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmtlZEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdCA9PlxuICAgICAgICAgICAgICAgICAgICBpbnN0LmluZm8gJiYgaW5zdC5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IHBvc3RncmVzSW5zdGFuY2VcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgaWYgKGxpbmtlZEluc3RhbmNlcy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtwb3N0Z3Jlc0luc3RhbmNlfSBhbHJlYWR5IGhhcyA0IGxpbmtlZCBPZG9vIGluc3RhbmNlcy4gUGxlYXNlIHVzZSBhbm90aGVyIFBvc3RncmVTUUwgaW5zdGFuY2UuYCB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCAke2xpbmtlZEluc3RhbmNlcy5sZW5ndGh9IE9kb28gaW5zdGFuY2VzIGxpbmtlZCB0byAke3Bvc3RncmVzSW5zdGFuY2V9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY2hlY2tpbmcgbGlua2VkIGluc3RhbmNlcyBjb3VudGAsIGVycik7XG4gICAgICAgICAgICAgICAgLy8gQ29udGludWUgYW55d2F5LCBqdXN0IGxvZyB0aGUgZXJyb3JcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgcG9ydCBhdmFpbGFiaWxpdHlcbiAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRQb3J0ID0gcG9ydCB8fCA4MDY5O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gYXdhaXQgdGhpcy5jaGVja1BvcnRBdmFpbGFiaWxpdHkoZGVmYXVsdFBvcnQpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBwcm9qZWN0IGRpcmVjdG9yeSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEluc3RhbmNlIGRpcmVjdG9yeSBhbHJlYWR5IGV4aXN0czogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGFscmVhZHkgZXhpc3RzYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBwcm9qZWN0IGRpcmVjdG9yeTogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgY29uZmlnIGRpcmVjdG9yeSBmb3Igb2Rvby5jb25mXG4gICAgICAgICAgICBjb25zdCBjb25maWdEaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2NvbmZpZycpO1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKGNvbmZpZ0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhZGRvbnMgZGlyZWN0b3J5XG4gICAgICAgICAgICBjb25zdCBhZGRvbnNEaXIgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2FkZG9ucycpO1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKGFkZG9uc0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBvZG9vLmNvbmYgZmlsZSB3aXRoIHRoZSBwcm9wZXIgY29uZmlndXJhdGlvblxuICAgICAgICAgICAgY29uc3Qgb2Rvb0NvbmZQYXRoID0gcGF0aC5qb2luKGNvbmZpZ0RpciwgJ29kb28uY29uZicpO1xuICAgICAgICAgICAgY29uc3QgZGJGaWx0ZXJTdHIgPSBkYkZpbHRlciA/IGBcXG5kYmZpbHRlciA9IF4ke2luc3RhbmNlTmFtZX0uKiRgIDogJyc7XG5cbiAgICAgICAgICAgIC8vIFVzZSBwcm92aWRlZCBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIG9yIGRlZmF1bHRzXG4gICAgICAgICAgICBjb25zdCBwZ1VzZXJWYWwgPSBwZ1VzZXIgfHwgJ3Bvc3RncmVzJztcbiAgICAgICAgICAgIGNvbnN0IHBnUGFzc3dvcmRWYWwgPSBwZ1Bhc3N3b3JkIHx8ICdwb3N0Z3Jlcyc7XG5cbiAgICAgICAgICAgIGNvbnN0IG1ham9yVmVyc2lvbiA9IHZlcnNpb24uc3BsaXQoJy4nKVswXTtcblxuICAgICAgICAgICAgY29uc3QgYWRkb25zUGF0aFN0ciA9IGVkaXRpb24gPT09ICdFbnRlcnByaXNlJ1xuICAgICAgICAgICAgICAgID8gYC9tbnQvZXh0cmEtYWRkb25zLCAvbW50L2VudGVycHJpc2UtYWRkb25zLyR7bWFqb3JWZXJzaW9ufWBcbiAgICAgICAgICAgICAgICA6IGAvbW50L2V4dHJhLWFkZG9uc2A7XG5cbiAgICAgICAgICAgIGNvbnN0IG9kb29Db25mQ29udGVudCA9IGBbb3B0aW9uc11cbmFkZG9uc19wYXRoID0gJHthZGRvbnNQYXRoU3RyfVxuZGF0YV9kaXIgPSAvdmFyL2xpYi9vZG9vXG5hZG1pbl9wYXNzd2QgPSAke2FkbWluUGFzc3dvcmR9JHtkYkZpbHRlclN0cn1cbmRiX2hvc3QgPSAke3Bvc3RncmVzSW5zdGFuY2V9XG5kYl9wYXNzd29yZCA9ICR7cGdQYXNzd29yZFZhbH1cbmRiX3BvcnQgPSA1NDMyXG5kYl90ZW1wbGF0ZSA9IHRlbXBsYXRlMFxuZGJfdXNlciA9ICR7cGdVc2VyVmFsfVxubGlzdF9kYiA9IFRydWVcbmA7XG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBvZG9vLmNvbmZgKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMob2Rvb0NvbmZQYXRoLCBvZG9vQ29uZkNvbnRlbnQsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgRG9ja2VyIGltYWdlIHRvIHVzZVxuICAgICAgICAgICAgY29uc3QgZG9ja2VySW1hZ2UgPSBjdXN0b21JbWFnZSAmJiBjdXN0b21JbWFnZU5hbWVcbiAgICAgICAgICAgICAgICA/IGBvZG9vLWN1c3RvbToke2N1c3RvbUltYWdlTmFtZX1gXG4gICAgICAgICAgICAgICAgOiBgb2Rvbzoke3ZlcnNpb259YDtcblxuICAgICAgICAgICAgbG9nSW5mbyhgVXNpbmcgRG9ja2VyIGltYWdlOiAke2RvY2tlckltYWdlfWApO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgRG9ja2VyIENvbXBvc2UgZmlsZVxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbnRlbnQgPSBgXG5zZXJ2aWNlczpcbiAgb2RvbzpcbiAgICBpbWFnZTogJHtkb2NrZXJJbWFnZX1cbiAgICBjb250YWluZXJfbmFtZTogJHtpbnN0YW5jZU5hbWV9XG4gICAgcG9ydHM6XG4gICAgICAtIFwiJHtwb3J0fTo4MDY5XCJcbiAgICB2b2x1bWVzOlxuICAgICAgLSAke2luc3RhbmNlTmFtZX1fZGF0YTovdmFyL2xpYi9vZG9vXG4gICAgICAtIC4vY29uZmlnOi9ldGMvb2Rvb1xuICAgICAgLSAuL2FkZG9uczovbW50L2V4dHJhLWFkZG9uc1xuJHtlZGl0aW9uID09PSAnRW50ZXJwcmlzZScgPyBgICAgICAgLSAke3RoaXMucHJvamVjdHNQYXRofS9lbnRlcnByaXNlX2FkZG9ucy8ke21ham9yVmVyc2lvbn06L21udC9lbnRlcnByaXNlLWFkZG9ucy8ke21ham9yVmVyc2lvbn1gIDogJyd9XG4gICAgZW52aXJvbm1lbnQ6XG4gICAgICAtIFBPU1RHUkVTX1VTRVI9JHtwZ1VzZXJWYWx9XG4gICAgICAtIFBPU1RHUkVTX1BBU1NXT1JEPSR7cGdQYXNzd29yZFZhbH1cbiAgICAgIC0gUE9TVEdSRVNfSE9TVD0ke3Bvc3RncmVzSW5zdGFuY2V9XG4gICAgICAtIFBPU1RHUkVTX1BPUlQ9NTQzMlxuICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkXG4gICAgbmV0d29ya3M6XG4gICAgICAtICR7bmV0d29ya05hbWV9XG4gICAgZXh0ZXJuYWxfbGlua3M6XG4gICAgICAtICR7cG9zdGdyZXNJbnN0YW5jZX06JHtwb3N0Z3Jlc0luc3RhbmNlfVxuXG5uZXR3b3JrczpcbiAgJHtuZXR3b3JrTmFtZX06XG4gICAgZXh0ZXJuYWw6IHRydWVcblxudm9sdW1lczpcbiAgJHtpbnN0YW5jZU5hbWV9X2RhdGE6XG4gICAgZHJpdmVyOiBsb2NhbFxuYDtcblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUZpbGVQYXRoID0gcGF0aC5qb2luKHByb2plY3REaXIsICdkb2NrZXItY29tcG9zZS55bWwnKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFdyaXRpbmcgRG9ja2VyIENvbXBvc2UgZmlsZSB0byAke2NvbXBvc2VGaWxlUGF0aH1gKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoY29tcG9zZUZpbGVQYXRoLCBjb21wb3NlQ29udGVudCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgLy8gVmVyaWZ5IGlmIGVudGVycHJpc2VfYWRkb25zIGRpcmVjdG9yeSBleGlzdHMgYW5kIHdhcm4gaWYgbm90XG4gICAgICAgICAgICBjb25zdCBlbnRlcnByaXNlQWRkb25zRGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnZW50ZXJwcmlzZV9hZGRvbnMnLCB2ZXJzaW9uKTtcbiAgICAgICAgICAgIGlmIChlZGl0aW9uID09PSAnRW50ZXJwcmlzZScgJiYgIWZzLmV4aXN0c1N5bmMoZW50ZXJwcmlzZUFkZG9uc0RpcikpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBFbnRlcnByaXNlIGFkZG9ucyBkaXJlY3Rvcnkgbm90IGZvdW5kOiAke2VudGVycHJpc2VBZGRvbnNEaXJ9YCk7XG5cbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGRpcmVjdG9yeSBzbyBEb2NrZXIgQ29tcG9zZSBkb2Vzbid0IGZhaWxcbiAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMoZW50ZXJwcmlzZUFkZG9uc0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBZGQgYSBSRUFETUUgZmlsZSB0byBleHBsYWluIHdoYXQgdG8gZG9cbiAgICAgICAgICAgICAgICBjb25zdCByZWFkbWVQYXRoID0gcGF0aC5qb2luKGVudGVycHJpc2VBZGRvbnNEaXIsICdSRUFETUUudHh0Jyk7XG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhyZWFkbWVQYXRoLCBgVGhpcyBkaXJlY3Rvcnkgc2hvdWxkIGNvbnRhaW4gT2RvbyBFbnRlcnByaXNlIGFkZG9ucyBmb3IgdmVyc2lvbiAke3ZlcnNpb259LlxuSWYgeW91IGhhdmUgYWNjZXNzIHRvIE9kb28gRW50ZXJwcmlzZSByZXBvc2l0b3J5LCBwbGVhc2UgY2xvbmUgb3IgY29weSB0aG9zZSBhZGRvbnMgdG8gdGhpcyBsb2NhdGlvbi5gLCAndXRmOCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgaW5zdGFuY2UgaW5mbyBmaWxlXG4gICAgICAgICAgICBjb25zdCBpbmZvRmlsZSA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnaW5zdGFuY2UtaW5mby5qc29uJyk7XG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBpbnN0YW5jZSBpbmZvIGZpbGU6ICR7aW5mb0ZpbGV9YCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdvZG9vJyxcbiAgICAgICAgICAgICAgICB2ZXJzaW9uLFxuICAgICAgICAgICAgICAgIGVkaXRpb24sXG4gICAgICAgICAgICAgICAgcG9ydCxcbiAgICAgICAgICAgICAgICBhZG1pblBhc3N3b3JkLFxuICAgICAgICAgICAgICAgIGRiRmlsdGVyLFxuICAgICAgICAgICAgICAgIGN1c3RvbUltYWdlOiAhIShjdXN0b21JbWFnZSAmJiBjdXN0b21JbWFnZU5hbWUpLFxuICAgICAgICAgICAgICAgIGN1c3RvbUltYWdlTmFtZTogY3VzdG9tSW1hZ2UgJiYgY3VzdG9tSW1hZ2VOYW1lID8gY3VzdG9tSW1hZ2VOYW1lIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHBvc3RncmVzSW5zdGFuY2UsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5mb0ZpbGUsIEpTT04uc3RyaW5naWZ5KGluZm8sIG51bGwsIDIpLCAndXRmOCcpO1xuXG4gICAgICAgICAgICAvLyBTdGFydCB0aGUgY29udGFpbmVyXG4gICAgICAgICAgICBsb2dJbmZvKGBTdGFydGluZyBPZG9vIGNvbnRhaW5lcmApO1xuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgRXhlY3V0aW5nOiBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSB1cCAtZGApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcblxuICAgICAgICAgICAgICAgIGlmIChzdGRvdXQpIGxvZ0luZm8oYERvY2tlciBDb21wb3NlIHN0ZG91dDogJHtzdGRvdXR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0ZGVycikgbG9nSW5mbyhgRG9ja2VyIENvbXBvc2Ugc3RkZXJyOiAke3N0ZGVycn1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHN0YXJ0aW5nIGNvbnRhaW5lcmAsIGVycm9yKTtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBnZXQgbW9yZSBlcnJvciBkZXRhaWxzXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGxvZ3MgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gbG9nc2ApO1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgbG9nczogJHtsb2dzfWApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb3VsZG4ndCBnZXQgY29udGFpbmVyIGxvZ3NgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBzdGFydGluZyBjb250YWluZXI6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgdGhlIGNvbnRhaW5lciBpcyBydW5uaW5nXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFZlcmlmeWluZyBjb250YWluZXIgaXMgcnVubmluZ2ApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBjb250YWluZXJTdGF0dXMgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIHBzIC0tZmlsdGVyIFwibmFtZT0ke2luc3RhbmNlTmFtZX1cIiAtLWZvcm1hdCBcInt7LlN0YXR1c319XCJgKTtcblxuICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBzdGF0dXM6ICR7Y29udGFpbmVyU3RhdHVzfWApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFjb250YWluZXJTdGF0dXMuaW5jbHVkZXMoJ1VwJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIG1heSBub3QgYmUgcnVubmluZyBjb3JyZWN0bHlgKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBHZXQgY29udGFpbmVyIGxvZ3MgZm9yIGRlYnVnZ2luZ1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGNvbnRhaW5lckxvZ3MgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIGxvZ3MgJHtpbnN0YW5jZU5hbWV9IC0tdGFpbCAyMGApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIGxvZ3M6ICR7Y29udGFpbmVyTG9nc31gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb3VsZG4ndCBnZXQgY29udGFpbmVyIGxvZ3NgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSwgLy8gU3RpbGwgcmV0dXJuIHN1Y2Nlc3Mgc2luY2UgZmlsZXMgd2VyZSBjcmVhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgT2RvbyBpbnN0YW5jZSBjcmVhdGVkLCBidXQgY29udGFpbmVyIG1heSBub3QgYmUgcnVubmluZyBjb3JyZWN0bHkuIENoZWNrIGxvZ3MuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvcnRcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjaGVja2luZyBjb250YWluZXIgc3RhdHVzYCwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2dJbmZvKGBTdWNjZXNzZnVsbHkgY3JlYXRlZCBPZG9vIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgT2RvbyBpbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHkgb24gcG9ydCAke3BvcnR9IWAsXG4gICAgICAgICAgICAgICAgcG9ydFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjcmVhdGluZyBPZG9vIGluc3RhbmNlICR7aW5zdGFuY2VOYW1lfWAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIGNyZWF0aW5nIGluc3RhbmNlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgRG9ja2VyQ29tcG9zZVNlcnZpY2UoKTsiLCIvLyBzcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlLnRzXG5pbXBvcnQgeyBkaWFsb2csIGlwY01haW4sIElwY01haW5JbnZva2VFdmVudCB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCBkb2NrZXJDb21wb3NlU2VydmljZSBmcm9tICcuLi9kb2NrZXIvZG9ja2VyQ29tcG9zZVNlcnZpY2UnO1xuaW1wb3J0IHsgbG9nSW5mbywgbG9nRXJyb3IgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4vLyBEZWZpbmUgdHlwZXMgZm9yIHRoZSBvcGVyYXRpb25zXG5pbnRlcmZhY2UgRG9ja2VyT3BlcmF0aW9uUGFyYW1zIHtcbiAgICBpbnN0YW5jZU5hbWU/OiBzdHJpbmc7XG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICBlZGl0aW9uPzogc3RyaW5nO1xuICAgIGFkbWluUGFzc3dvcmQ/OiBzdHJpbmc7XG4gICAgZGJGaWx0ZXI/OiBib29sZWFuO1xuICAgIHNlcnZpY2U/OiBzdHJpbmc7XG4gICAgdGFpbD86IG51bWJlcjtcbiAgICBrZWVwRmlsZXM/OiBib29sZWFuO1xuICAgIG5ldHdvcmtOYW1lPzogc3RyaW5nO1xuICAgIGluc3RhbmNlVHlwZT86IHN0cmluZztcbiAgICBwb3J0PzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgRG9ja2VyT3BlcmF0aW9uUmVxdWVzdCB7XG4gICAgb3BlcmF0aW9uOiBzdHJpbmc7XG4gICAgcGFyYW1zOiBEb2NrZXJPcGVyYXRpb25QYXJhbXM7XG59XG5cbmludGVyZmFjZSBFcnJvckRpYWxvZ09wdGlvbnMge1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIFNhZmUgaGFuZGxlciByZWdpc3RyYXRpb24gLSBjaGVja3MgaWYgYSBoYW5kbGVyIGV4aXN0cyBiZWZvcmUgcmVnaXN0ZXJpbmdcbiAqIEBwYXJhbSBjaGFubmVsIElQQyBjaGFubmVsIG5hbWVcbiAqIEBwYXJhbSBoYW5kbGVyIEZ1bmN0aW9uIHRvIGhhbmRsZSB0aGUgSVBDIHJlcXVlc3RcbiAqL1xuZnVuY3Rpb24gc2FmZVJlZ2lzdGVySGFuZGxlcjxULCBSPihjaGFubmVsOiBzdHJpbmcsIGhhbmRsZXI6IChldmVudDogSXBjTWFpbkludm9rZUV2ZW50LCBhcmc6IFQpID0+IFByb21pc2U8Uj4gfCBSKTogdm9pZCB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgYSBoYW5kbGVyIGFscmVhZHkgZXhpc3RzIGZvciB0aGlzIGNoYW5uZWxcbiAgICAgICAgY29uc3QgaGFuZGxlcnMgPSAoaXBjTWFpbiBhcyBhbnkpLl9pbnZva2VIYW5kbGVycztcbiAgICAgICAgaWYgKGhhbmRsZXJzICYmIGhhbmRsZXJzLmhhcyAmJiBoYW5kbGVycy5oYXMoY2hhbm5lbCkpIHtcbiAgICAgICAgICAgIGxvZ0luZm8oYElQQyBoYW5kbGVyIGFscmVhZHkgZXhpc3RzIGZvciBjaGFubmVsOiAke2NoYW5uZWx9LCBub3QgcmVnaXN0ZXJpbmcgYWdhaW5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdlIGNhbid0IGNoZWNrIHByb3Blcmx5LCB0cnkgYSBtb3JlIHJlbGlhYmxlIHdheVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaXBjTWFpbi5oYW5kbGUoY2hhbm5lbCwgaGFuZGxlcik7XG4gICAgICAgICAgICBsb2dJbmZvKGBSZWdpc3RlcmVkIElQQyBoYW5kbGVyOiAke2NoYW5uZWx9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBpZiAoKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlLmluY2x1ZGVzKCdzZWNvbmQgaGFuZGxlcicpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgSGFuZGxlciBhbHJlYWR5IGV4aXN0cyBmb3IgY2hhbm5lbDogJHtjaGFubmVsfSwgc2tpcHBpbmcgcmVnaXN0cmF0aW9uYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yOyAvLyBSZS10aHJvdyB1bmV4cGVjdGVkIGVycm9yc1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nRXJyb3IoYEVycm9yIHdoaWxlIHRyeWluZyB0byByZWdpc3RlciBoYW5kbGVyIGZvciAke2NoYW5uZWx9YCwgZXJyb3IpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBJbml0aWFsaXplIGFsbCBJUEMgaGFuZGxlcnMgZm9yIHRoZSBtYWluIHByb2Nlc3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVJcGNIYW5kbGVycygpOiB2b2lkIHtcbiAgICBsb2dJbmZvKCdJbml0aWFsaXppbmcgSVBDIGhhbmRsZXJzJyk7XG5cbiAgICAvLyBEb2NrZXIgb3BlcmF0aW9uIGhhbmRsZXIgd2l0aCBpbXByb3ZlZCBsb2dnaW5nIGFuZCBlcnJvciBoYW5kbGluZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RG9ja2VyT3BlcmF0aW9uUmVxdWVzdCwgYW55PignZG9ja2VyLW9wZXJhdGlvbicsIGFzeW5jIChfZXZlbnQsIHsgb3BlcmF0aW9uLCBwYXJhbXMgfSkgPT4ge1xuICAgICAgICBsb2dJbmZvKGBFeGVjdXRpbmcgRG9ja2VyIG9wZXJhdGlvbjogJHtvcGVyYXRpb259YCwgcGFyYW1zKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHJlc3VsdDtcblxuICAgICAgICAgICAgc3dpdGNoIChvcGVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICBjYXNlICdjaGVjay1kb2NrZXInOlxuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKCdDaGVja2luZyBEb2NrZXInKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuY2hlY2tEb2NrZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdzdGFydC1pbnN0YW5jZSc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLnN0YXJ0SW5zdGFuY2UocGFyYW1zLmluc3RhbmNlTmFtZSB8fCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnc3RvcC1pbnN0YW5jZSc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLnN0b3BJbnN0YW5jZShwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdkZWxldGUtaW5zdGFuY2UnOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5kZWxldGVJbnN0YW5jZShwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnLCBwYXJhbXMua2VlcEZpbGVzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdnZXQtbG9ncyc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmdldExvZ3MoXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnNlcnZpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMudGFpbFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2xpc3QtaW5zdGFuY2VzJzpcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbygnTGlzdGluZyBpbnN0YW5jZXMnKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UubGlzdEluc3RhbmNlcygpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2Vuc3VyZS1uZXR3b3JrJzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuZW5zdXJlTmV0d29ya0V4aXN0cyhwYXJhbXM/Lm5ldHdvcmtOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gRG9ja2VyIG9wZXJhdGlvbjogJHtvcGVyYXRpb259YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYERvY2tlciBvcGVyYXRpb24gY29tcGxldGVkOiAke29wZXJhdGlvbn1gLCB7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGV4ZWN1dGluZyBEb2NrZXIgb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBPcGVyYXRpb24gZmFpbGVkOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBTaG93IGVycm9yIGRpYWxvZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RXJyb3JEaWFsb2dPcHRpb25zLCB2b2lkPignc2hvdy1lcnJvci1kaWFsb2cnLCAoX2V2ZW50LCB7IHRpdGxlLCBtZXNzYWdlIH0pID0+IHtcbiAgICAgICAgbG9nRXJyb3IoYFNob3dpbmcgZXJyb3IgZGlhbG9nOiAke3RpdGxlfWAsIG1lc3NhZ2UpO1xuICAgICAgICBkaWFsb2cuc2hvd0Vycm9yQm94KHRpdGxlLCBtZXNzYWdlKTtcbiAgICB9KTtcblxuICAgIC8vIFNob3cgbWVzc2FnZSBkaWFsb2dcbiAgICBzYWZlUmVnaXN0ZXJIYW5kbGVyPEVsZWN0cm9uLk1lc3NhZ2VCb3hPcHRpb25zLCBFbGVjdHJvbi5NZXNzYWdlQm94UmV0dXJuVmFsdWU+KCdzaG93LW1lc3NhZ2UtZGlhbG9nJywgYXN5bmMgKF9ldmVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBsb2dJbmZvKCdTaG93aW5nIG1lc3NhZ2UgZGlhbG9nJywgeyB0aXRsZTogb3B0aW9ucy50aXRsZSB9KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveChvcHRpb25zKTtcbiAgICB9KTtcblxuICAgIC8vIFNob3cgc2F2ZSBkaWFsb2dcbiAgICBzYWZlUmVnaXN0ZXJIYW5kbGVyPEVsZWN0cm9uLlNhdmVEaWFsb2dPcHRpb25zLCBFbGVjdHJvbi5TYXZlRGlhbG9nUmV0dXJuVmFsdWU+KCdzaG93LXNhdmUtZGlhbG9nJywgYXN5bmMgKF9ldmVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBsb2dJbmZvKCdTaG93aW5nIHNhdmUgZGlhbG9nJywgeyB0aXRsZTogb3B0aW9ucy50aXRsZSB9KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93U2F2ZURpYWxvZyhvcHRpb25zKTtcbiAgICB9KTtcblxuICAgIC8vIFNob3cgb3BlbiBkaWFsb2dcbiAgICBzYWZlUmVnaXN0ZXJIYW5kbGVyPEVsZWN0cm9uLk9wZW5EaWFsb2dPcHRpb25zLCBFbGVjdHJvbi5PcGVuRGlhbG9nUmV0dXJuVmFsdWU+KCdzaG93LW9wZW4tZGlhbG9nJywgYXN5bmMgKF9ldmVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBsb2dJbmZvKCdTaG93aW5nIG9wZW4gZGlhbG9nJywgeyB0aXRsZTogb3B0aW9ucy50aXRsZSB9KTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGRpYWxvZy5zaG93T3BlbkRpYWxvZyhvcHRpb25zKTtcbiAgICB9KTtcblxuICAgIGxvZ0luZm8oJ0lQQyBoYW5kbGVycyBpbml0aWFsaXphdGlvbiBjb21wbGV0ZScpO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIGFwcGxpY2F0aW9uIGFuZCBwZXJmb3JtIHN0YXJ0dXAgdGFza3NcbiAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGluaXRpYWxpemF0aW9uIGlzIGNvbXBsZXRlXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbml0aWFsaXplQXBwKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGxvZ0luZm8oJ0luaXRpYWxpemluZyBhcHBsaWNhdGlvbicpO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIERvY2tlciBpcyBydW5uaW5nXG4gICAgICAgIGNvbnN0IGRvY2tlclJ1bm5pbmcgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5jaGVja0RvY2tlcigpO1xuICAgICAgICBpZiAoIWRvY2tlclJ1bm5pbmcpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdEb2NrZXIgaXMgbm90IHJ1bm5pbmchJyk7XG4gICAgICAgICAgICAvLyBUaGlzIHdpbGwgYmUgaGFuZGxlZCBieSB0aGUgc3BsYXNoIHNjcmVlblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5zdXJlIE9kb28gbmV0d29yayBleGlzdHNcbiAgICAgICAgYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuZW5zdXJlTmV0d29ya0V4aXN0cygpO1xuXG4gICAgICAgIGxvZ0luZm8oJ0FwcGxpY2F0aW9uIGluaXRpYWxpemVkIHN1Y2Nlc3NmdWxseScpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gaW5pdGlhbGl6ZSBhcHBsaWNhdGlvbicsIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKSk7XG4gICAgICAgIHRocm93IGVycm9yOyAvLyBSZS10aHJvdyB0byBhbGxvdyBjYWxsZXIgdG8gaGFuZGxlIHRoZSBlcnJvclxuICAgIH1cbn0iLCJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24nO1xuXG4vLyBQYXRoIHRvIHN0b3JlIHRoZSBsb2NrIGZpbGVcbmNvbnN0IGdldExvY2tGaWxlUGF0aCA9ICgpID0+IHtcbiAgICByZXR1cm4gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpLCAnbG9nZ2VyLWxvY2suanNvbicpO1xufTtcblxuLy8gV3JpdGUgY3VycmVudCBsb2cgZmlsZSBpbmZvIHRvIGxvY2sgZmlsZVxuZXhwb3J0IGZ1bmN0aW9uIHNldExvZ0ZpbGVMb2NrKGxvZ0ZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBsb2NrRmlsZVBhdGggPSBnZXRMb2NrRmlsZVBhdGgoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHsgXG4gICAgICAgICAgICBhY3RpdmVMb2dGaWxlOiBsb2dGaWxlUGF0aCwgXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHZlcnNpb246IDIsIC8vIFZlcnNpb24gdG8gaWRlbnRpZnkgc2luZ2xlIGxvZyBmaWxlIHN0cmF0ZWd5XG4gICAgICAgIH07XG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMobG9ja0ZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3cml0aW5nIGxvZ2dlciBsb2NrIGZpbGU6JywgZXJyKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLy8gUmVhZCBjdXJyZW50IGxvZyBmaWxlIGluZm8gZnJvbSBsb2NrIGZpbGVcbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2dGaWxlTG9jaygpOiBzdHJpbmcgfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBsb2NrRmlsZVBhdGggPSBnZXRMb2NrRmlsZVBhdGgoKTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMobG9ja0ZpbGVQYXRoKSkge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGxvY2tGaWxlUGF0aCkpO1xuXG4gICAgICAgICAgICAvLyBXaXRoIHRoZSBuZXcgc2luZ2xlIGxvZyBmaWxlIGFwcHJvYWNoLCB3ZSBhbHdheXMgd2FudCB0byB1c2VcbiAgICAgICAgICAgIC8vIHRoZSBzYW1lIGxvZyBmaWxlLCBzbyB3ZSBkb24ndCBuZWVkIHRvIGNoZWNrIGZvciBzdGFsZW5lc3MgYW55bW9yZVxuICAgICAgICAgICAgLy8gV2UganVzdCBuZWVkIHRvIGVuc3VyZSB0aGUgcGF0aCBleGlzdHNcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgdGhlIHBhdGggZXhpc3RzXG4gICAgICAgICAgICBpZiAoZGF0YS5hY3RpdmVMb2dGaWxlICYmIGZzLmV4aXN0c1N5bmMoZGF0YS5hY3RpdmVMb2dGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmFjdGl2ZUxvZ0ZpbGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBsb2cgZmlsZSBkb2Vzbid0IGV4aXN0LCBjcmVhdGUgaXRzIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIGlmIChkYXRhLmFjdGl2ZUxvZ0ZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvZ0RpciA9IHBhdGguZGlybmFtZShkYXRhLmFjdGl2ZUxvZ0ZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGxvZ0RpcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMobG9nRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZGlyRXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjcmVhdGluZyBsb2cgZGlyZWN0b3J5OicsIGRpckVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJlYWRpbmcgbG9nZ2VyIGxvY2sgZmlsZTonLCBlcnIpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59IiwiaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBzaGVsbCwgaXBjTWFpbiwgZGlhbG9nLCBNZW51LCBuZXQsIE5vdGlmaWNhdGlvbiB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBpbml0aWFsaXplSXBjSGFuZGxlcnMsIGluaXRpYWxpemVBcHAgfSBmcm9tICcuLi9zcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlJztcbmltcG9ydCBkb2NrZXJDb21wb3NlU2VydmljZSBmcm9tICcuLi9zcmMvc2VydmljZXMvZG9ja2VyL2RvY2tlckNvbXBvc2VTZXJ2aWNlJztcbmltcG9ydCBzZXR0aW5nc1NlcnZpY2UgZnJvbSBcIi4uL3NyYy9zZXJ2aWNlcy9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2VcIjtcbmltcG9ydCB7IHNldExvZ0ZpbGVMb2NrLCBnZXRMb2dGaWxlTG9jayB9IGZyb20gJy4vbG9nZ2VyLWxvY2snO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gJ3VybCc7XG5cbi8vIFBvbHlmaWxsIGZvciBfX2Rpcm5hbWUgaW4gRVNNIGVudmlyb25tZW50XG5jb25zdCBnZXRBcHBEaXIgPSAoKSA9PiB7XG4gIGlmICh0eXBlb2YgX19kaXJuYW1lICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBfX2Rpcm5hbWU7XG4gIH1cbiAgXG4gIGlmIChpbXBvcnQubWV0YSAmJiBpbXBvcnQubWV0YS51cmwpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZmlsZW5hbWUgPSBmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCk7XG4gICAgICByZXR1cm4gcGF0aC5kaXJuYW1lKGZpbGVuYW1lKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjcmVhdGluZyBfX2Rpcm5hbWUgcG9seWZpbGw6JywgZSk7XG4gICAgfVxuICB9XG4gIFxuICAvLyBGYWxsYmFjayBmb3IgcHJvZHVjdGlvbiBhc2FyIGVudmlyb25tZW50XG4gIGNvbnN0IGFwcFBhdGggPSBhcHAuZ2V0QXBwUGF0aCgpO1xuICBjb25zb2xlLmxvZygnVXNpbmcgYXBwIHBhdGggYXMgZmFsbGJhY2s6JywgYXBwUGF0aCk7XG4gIHJldHVybiBhcHBQYXRoO1xufTtcblxuY29uc3QgX19kaXJuYW1lID0gZ2V0QXBwRGlyKCk7XG5cbi8vIExvZyB0aGUgZW52aXJvbm1lbnQgYW5kIHBhdGhzIGZvciBlYXNpZXIgZGVidWdnaW5nXG5jb25zb2xlLmxvZygnTm9kZSBlbnZpcm9ubWVudDonLCBwcm9jZXNzLmVudi5OT0RFX0VOVik7XG5jb25zb2xlLmxvZygnQ3VycmVudCB3b3JraW5nIGRpcmVjdG9yeTonLCBwcm9jZXNzLmN3ZCgpKTtcbmNvbnNvbGUubG9nKCdEaXJuYW1lIHBvbHlmaWxsOicsIF9fZGlybmFtZSk7XG5cbmxldCBBQ1RJVkVfTE9HX0ZJTEU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4vLyBMb2cgcm90YXRpb24gY29uZmlndXJhdGlvblxuY29uc3QgTE9HX0ZJTEVfU0laRV9MSU1JVCA9IDUgKiAxMDI0ICogMTAyNDsgLy8gNSBNQiBpbiBieXRlc1xuY29uc3QgTUFYX0xPR19GSUxFUyA9IDU7IC8vIE1heGltdW0gbnVtYmVyIG9mIHJvdGF0ZWQgbG9nIGZpbGVzIHRvIGtlZXBcblxuXG4vLyBTaW1wbGUgaW5saW5lIGxvZ2dlciBmb3IgdGhlIG1haW4gcHJvY2Vzc1xuY29uc3QgbG9nSW5mbyA9IChtZXNzYWdlOiBzdHJpbmcsIGRhdGE/OiBhbnkpID0+IHtcbiAgY29uc3QgbG9nTWVzc2FnZSA9IGBbJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCl9XSBbSU5GT10gJHttZXNzYWdlfSR7ZGF0YSA/ICcgJyArIEpTT04uc3RyaW5naWZ5KGRhdGEpIDogJyd9YDtcbiAgY29uc29sZS5sb2cobG9nTWVzc2FnZSk7XG4gIGFwcGVuZFRvTG9nRmlsZShsb2dNZXNzYWdlKTtcbn07XG5cbmNvbnN0IGxvZ0Vycm9yID0gKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBhbnkpID0+IHtcbiAgbGV0IGVycm9yU3RyID0gJyc7XG4gIGlmIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBlcnJvclN0ciA9IGBcXG4ke2Vycm9yLnN0YWNrIHx8IGVycm9yLm1lc3NhZ2V9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXJyb3JTdHIgPSBgXFxuJHtKU09OLnN0cmluZ2lmeShlcnJvcil9YDtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBlcnJvclN0ciA9IGBcXG4ke1N0cmluZyhlcnJvcil9YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBsb2dNZXNzYWdlID0gYFske25ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcoKX1dIFtFUlJPUl0gJHttZXNzYWdlfSR7ZXJyb3JTdHJ9YDtcbiAgY29uc29sZS5lcnJvcihsb2dNZXNzYWdlKTtcbiAgYXBwZW5kVG9Mb2dGaWxlKGxvZ01lc3NhZ2UpO1xufTtcblxuLy8gR2V0IGxvZyBmaWxlIHBhdGhcbmZ1bmN0aW9uIGdldExvZ0ZpbGVQYXRoKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGFwcERhdGFQYXRoID0gYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyk7XG4gICAgbGV0IHdvcmtEaXJQYXRoID0gbnVsbDtcblxuICAgIC8vIFRyeSB0byBnZXQgd29yayBkaXJlY3RvcnkgcGF0aFxuICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ3dvcmtkaXIuanNvbicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgd29ya0RpclBhdGggPSBkYXRhLndvcmtEaXI7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb246JywgZXJyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgbG9ncyBkaXJlY3RvcnlcbiAgICBjb25zdCBsb2dzUGF0aCA9IHdvcmtEaXJQYXRoID8gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCAnbG9ncycpIDogcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnbG9ncycpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dzUGF0aCkpIHtcbiAgICAgIGZzLm1rZGlyU3luYyhsb2dzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgLy8gVXNpbmcgYSBmaXhlZCBsb2cgZmlsZSBuYW1lIGluc3RlYWQgb2YgdGltZXN0YW1wLWJhc2VkXG4gICAgcmV0dXJuIHBhdGguam9pbihsb2dzUGF0aCwgJ2FwcC5sb2cnKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBsb2cgZmlsZSBwYXRoOicsIGVycik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLy8gR2xvYmFsIGxvZyBmaWxlIHBhdGhcbmxldCBsb2dGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbi8vIEluaXRpYWxpemUgbG9nIGZpbGVcbmZ1bmN0aW9uIGluaXRMb2dGaWxlKCkge1xuICB0cnkge1xuICAgIGxvZ0ZpbGVQYXRoID0gZ2V0TG9nRmlsZVBhdGgoKTtcbiAgICBpZiAobG9nRmlsZVBhdGgpIHtcbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICAgICAgLy8gQ3JlYXRlIG5ldyBsb2cgZmlsZSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgIGNvbnN0IGluaXRpYWxNZXNzYWdlID1cbiAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgYE9kb28gTWFuYWdlciAtIEFwcGxpY2F0aW9uIExvZyAoTWFpbiBQcm9jZXNzKVxcbmAgK1xuICAgICAgICAgICAgYFN0YXJ0ZWQ6ICR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygpfVxcbmAgK1xuICAgICAgICAgICAgYEVudmlyb25tZW50OiAke3Byb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICd1bmtub3duJ31cXG5gICtcbiAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG5cbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhsb2dGaWxlUGF0aCwgaW5pdGlhbE1lc3NhZ2UpO1xuICAgICAgICBjb25zb2xlLmxvZyhgTG9nIGZpbGUgY3JlYXRlZCBhdDogJHtsb2dGaWxlUGF0aH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFkZCBhIHNlc3Npb24gc2VwYXJhdG9yIHRvIGV4aXN0aW5nIGxvZyBmaWxlXG4gICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgIGBcXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgYFNlc3Npb24gc3RhcnRlZDogJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCl9XFxuYCArXG4gICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmVmb3JlIGFwcGVuZGluZ1xuICAgICAgICBjaGVja0FuZFJvdGF0ZUxvZ0ZpbGUoKTtcbiAgICAgICAgXG4gICAgICAgIGZzLmFwcGVuZEZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCBzZXNzaW9uTWVzc2FnZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBVc2luZyBleGlzdGluZyBsb2cgZmlsZSBhdDogJHtsb2dGaWxlUGF0aH1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluaXRpYWxpemluZyBsb2cgZmlsZTonLCBlcnIpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmFzZWQgb24gc2l6ZVxuICogQHJldHVybnMgdHJ1ZSBpZiBsb2cgcm90YXRpb24gd2FzIHBlcmZvcm1lZCwgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmZ1bmN0aW9uIGNoZWNrQW5kUm90YXRlTG9nRmlsZSgpOiBib29sZWFuIHtcbiAgaWYgKCFsb2dGaWxlUGF0aCB8fCAhZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMobG9nRmlsZVBhdGgpO1xuICAgIGlmIChzdGF0cy5zaXplIDwgTE9HX0ZJTEVfU0laRV9MSU1JVCkge1xuICAgICAgcmV0dXJuIGZhbHNlOyAvLyBObyByb3RhdGlvbiBuZWVkZWRcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgTG9nIGZpbGUgc2l6ZSAoJHtzdGF0cy5zaXplfSBieXRlcykgZXhjZWVkcyBsaW1pdCAoJHtMT0dfRklMRV9TSVpFX0xJTUlUfSBieXRlcyksIHJvdGF0aW5nIGxvZ3MuLi5gKTtcbiAgICBcbiAgICAvLyBHZXQgdGhlIGxvZ3MgZGlyZWN0b3J5XG4gICAgY29uc3QgbG9nc0RpciA9IHBhdGguZGlybmFtZShsb2dGaWxlUGF0aCk7XG4gICAgXG4gICAgLy8gR2V0IGV4aXN0aW5nIHJvdGF0ZWQgbG9nIGZpbGVzXG4gICAgY29uc3QgYmFzZUxvZ05hbWUgPSBwYXRoLmJhc2VuYW1lKGxvZ0ZpbGVQYXRoLCAnLmxvZycpO1xuICAgIGNvbnN0IHJvdGF0ZWRMb2dzID0gZnMucmVhZGRpclN5bmMobG9nc0RpcilcbiAgICAgIC5maWx0ZXIoZiA9PiBmLnN0YXJ0c1dpdGgoYCR7YmFzZUxvZ05hbWV9LmApICYmIGYuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgIC5zb3J0KCk7IC8vIFNvcnQgdG8gZmluZCBoaWdoZXN0IHJvdGF0aW9uIG51bWJlclxuICAgIFxuICAgIC8vIFNoaWZ0IG9sZGVyIGxvZ3MgdG8gbWFrZSByb29tIGZvciBuZXcgcm90YXRpb25cbiAgICBmb3IgKGxldCBpID0gcm90YXRlZExvZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gcm90YXRlZExvZ3NbaV0ubWF0Y2gobmV3IFJlZ0V4cChgJHtiYXNlTG9nTmFtZX1cXC4oXFxkKylcXC5sb2dgKSk7XG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY29uc3Qgcm90YXRpb25OdW1iZXIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICBpZiAocm90YXRpb25OdW1iZXIgPj0gTUFYX0xPR19GSUxFUyAtIDEpIHtcbiAgICAgICAgICAvLyBEZWxldGUgdGhlIG9sZGVzdCBsb2cgZmlsZSBpZiB3ZSBhbHJlYWR5IGhhdmUgbWF4IG51bWJlciBvZiByb3RhdGlvbnNcbiAgICAgICAgICBjb25zdCBvbGRlc3RMb2cgPSBwYXRoLmpvaW4obG9nc0Rpciwgcm90YXRlZExvZ3NbaV0pO1xuICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkZXN0TG9nKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgRGVsZXRlZCBvbGQgbG9nIGZpbGU6ICR7b2xkZXN0TG9nfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlbmFtZSB0byB0aGUgbmV4dCByb3RhdGlvbiBudW1iZXJcbiAgICAgICAgICBjb25zdCBvbGRQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIGAke2Jhc2VMb2dOYW1lfS4ke3JvdGF0aW9uTnVtYmVyICsgMX0ubG9nYCk7XG4gICAgICAgICAgZnMucmVuYW1lU3luYyhvbGRQYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgUm90YXRlZCBsb2cgZmlsZTogJHtvbGRQYXRofSAtPiAke25ld1BhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gUmVuYW1lIHRoZSBjdXJyZW50IGxvZyBmaWxlIHRvIGJlIC4xLmxvZ1xuICAgIGNvbnN0IHJvdGF0ZWRMb2dQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIGAke2Jhc2VMb2dOYW1lfS4xLmxvZ2ApO1xuICAgIGZzLnJlbmFtZVN5bmMobG9nRmlsZVBhdGgsIHJvdGF0ZWRMb2dQYXRoKTtcbiAgICBjb25zb2xlLmxvZyhgUm90YXRlZCBtYWluIGxvZyBmaWxlOiAke2xvZ0ZpbGVQYXRofSAtPiAke3JvdGF0ZWRMb2dQYXRofWApO1xuICAgIFxuICAgIC8vIENyZWF0ZSBhIG5ldyBlbXB0eSBsb2cgZmlsZVxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgaW5pdGlhbE1lc3NhZ2UgPVxuICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICBgT2RvbyBNYW5hZ2VyIC0gQXBwbGljYXRpb24gTG9nIChSb3RhdGVkKVxcbmAgK1xuICAgICAgYFN0YXJ0ZWQ6ICR7bm93LnRvTG9jYWxlU3RyaW5nKCl9XFxuYCArXG4gICAgICBgRW52aXJvbm1lbnQ6ICR7cHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ3Vua25vd24nfVxcbmAgK1xuICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICBmcy53cml0ZUZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCBpbml0aWFsTWVzc2FnZSk7XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJvdGF0aW5nIGxvZyBmaWxlOicsIGVycik7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vIEFwcGVuZCB0byBsb2cgZmlsZVxuZnVuY3Rpb24gYXBwZW5kVG9Mb2dGaWxlKG1lc3NhZ2U6IHN0cmluZykge1xuICBpZiAoIWxvZ0ZpbGVQYXRoKSByZXR1cm47XG5cbiAgdHJ5IHtcbiAgICAvLyBDaGVjayBpZiBsb2cgZmlsZSBuZWVkcyByb3RhdGlvbiBiZWZvcmUgYXBwZW5kaW5nXG4gICAgY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk7XG4gICAgXG4gICAgZnMuYXBwZW5kRmlsZVN5bmMobG9nRmlsZVBhdGgsIG1lc3NhZ2UgKyAnXFxuJyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgfVxufVxuXG4vLyBMb2cgY2xlYW51cCBmdW5jdGlvbmFsaXR5IHJlbW92ZWQgYXMgbG9nIHJvdGF0aW9uIGhhbmRsZXMgdGhpcyBub3dcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG1ldGFkYXRhXG5hcHAuc2V0TmFtZSgnb2Rvby1tYW5hZ2VyJyk7XG5hcHAuc2V0QWJvdXRQYW5lbE9wdGlvbnMoe1xuICBhcHBsaWNhdGlvbk5hbWU6ICdPZG9vIE1hbmFnZXInLFxuICBhcHBsaWNhdGlvblZlcnNpb246IGFwcC5nZXRWZXJzaW9uKCksXG4gIHZlcnNpb246IGFwcC5nZXRWZXJzaW9uKCksXG4gIGNvcHlyaWdodDogJ8KpIDIwMjUgV2ViR3JhcGhpeCcsXG4gIGF1dGhvcnM6IFsnV2ViR3JhcGhpeCddLFxuICB3ZWJzaXRlOiAnaHR0cHM6Ly9vZG9vLndlYmdyYXBoaXgub25saW5lJyxcbiAgY3JlZGl0czogJ1Byb2Zlc3Npb25hbCBPZG9vIGluc3RhbmNlIG1hbmFnZW1lbnQgdG9vbCBmb3IgRG9ja2VyIGVudmlyb25tZW50cydcbn0pO1xuXG4vLyBHbG9iYWwgZGVjbGFyYXRpb25zIGZvciBUeXBlU2NyaXB0XG5kZWNsYXJlIGdsb2JhbCB7XG4gIHZhciBhbGxvd1NwbGFzaENsb3NlOiBib29sZWFuO1xuICB2YXIgY29taW5nRnJvbVNldHVwOiBib29sZWFuO1xuICB2YXIgY3VycmVudFRoZW1lTW9kZTogc3RyaW5nIHwgbnVsbDtcbiAgdmFyIHRoZW1lVXBkYXRlSW5Qcm9ncmVzczogYm9vbGVhbjtcbn1cblxuLy8gSW5pdGlhbGl6ZSBnbG9iYWwgdmFyaWFibGVzXG5nbG9iYWwuYWxsb3dTcGxhc2hDbG9zZSA9IGZhbHNlO1xuZ2xvYmFsLmNvbWluZ0Zyb21TZXR1cCA9IGZhbHNlO1xuZ2xvYmFsLmN1cnJlbnRUaGVtZU1vZGUgPSBudWxsO1xuZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXG4vLyBEZWZpbmUgaW50ZXJmYWNlIGZvciBpcGNNYWluIHdpdGggaGFuZGxlcnMgcHJvcGVydHlcbmludGVyZmFjZSBJcGNNYWluV2l0aEhhbmRsZXJzIGV4dGVuZHMgRWxlY3Ryb24uSXBjTWFpbiB7XG4gIGhhbmRsZXJzPzogUmVjb3JkPHN0cmluZywgKGV2ZW50OiBFbGVjdHJvbi5JcGNNYWluSW52b2tlRXZlbnQsIC4uLmFyZ3M6IGFueVtdKSA9PiBQcm9taXNlPGFueT4+O1xufVxuXG4vLyBDYXN0IGlwY01haW4gdG8gb3VyIGV4dGVuZGVkIGludGVyZmFjZVxuY29uc3QgdHlwZWRJcGNNYWluID0gaXBjTWFpbiBhcyBJcGNNYWluV2l0aEhhbmRsZXJzO1xuXG5pcGNNYWluLm9uKCdyZWdpc3Rlci1sb2ctZmlsZScsIChfZXZlbnQsIGxvZ0ZpbGVQYXRoKSA9PiB7XG4gIHRyeSB7XG4gICAgaWYgKCFBQ1RJVkVfTE9HX0ZJTEUgJiYgbG9nRmlsZVBhdGggJiYgZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICAgIEFDVElWRV9MT0dfRklMRSA9IGxvZ0ZpbGVQYXRoO1xuICAgICAgc2V0TG9nRmlsZUxvY2sobG9nRmlsZVBhdGgpO1xuICAgICAgbG9nSW5mbyhgUmVnaXN0ZXJlZCBhY3RpdmUgbG9nIGZpbGU6ICR7bG9nRmlsZVBhdGh9YCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciByZWdpc3RlcmluZyBsb2cgZmlsZTonLCBlcnIpO1xuICB9XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoJ2dldC1hY3RpdmUtbG9nLWZpbGUnLCAoKSA9PiB7XG4gIHRyeSB7XG4gICAgLy8gQWx3YXlzIGdldCBmcmVzaCBmcm9tIGxvY2sgZmlsZSB0byBlbnN1cmUgd2UncmUgbm90IHVzaW5nIGEgc3RhbGUgbG9ja1xuICAgIEFDVElWRV9MT0dfRklMRSA9IGdldExvZ0ZpbGVMb2NrKCk7XG4gICAgcmV0dXJuIEFDVElWRV9MT0dfRklMRTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBhY3RpdmUgbG9nIGZpbGU6JywgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8vIEdldCBsb2cgZmlsZSBwYXRoIGhhbmRsZXJcbmlwY01haW4uaGFuZGxlKCdnZXQtbG9nLWZpbGUtcGF0aCcsIGFzeW5jICgpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhcHBEYXRhUGF0aCA9IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgIGxldCB3b3JrRGlyUGF0aCA9IG51bGw7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGdldCB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnd29ya2Rpci5qc29uJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmMod29ya0RpckZpbGVQYXRoKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICB3b3JrRGlyUGF0aCA9IGRhdGEud29ya0RpcjtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24nLCBlcnIpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBHZXQgdGhlIGxvZ3MgZGlyZWN0b3J5XG4gICAgY29uc3QgbG9nc1BhdGggPSB3b3JrRGlyUGF0aCAmJiBmcy5leGlzdHNTeW5jKHdvcmtEaXJQYXRoKSBcbiAgICAgID8gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCAnbG9ncycpIFxuICAgICAgOiBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICdsb2dzJyk7XG4gICAgXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGxvZ3NQYXRoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIEFsd2F5cyByZXR1cm4gdGhlIG1haW4gYXBwLmxvZyBmaWxlIGlmIGl0IGV4aXN0c1xuICAgIGNvbnN0IG1haW5Mb2dQYXRoID0gcGF0aC5qb2luKGxvZ3NQYXRoLCAnYXBwLmxvZycpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKG1haW5Mb2dQYXRoKSkge1xuICAgICAgcmV0dXJuIG1haW5Mb2dQYXRoO1xuICAgIH1cbiAgICBcbiAgICAvLyBBcyBhIGZhbGxiYWNrLCBnZXQgdGhlIG1vc3QgcmVjZW50IGxvZyBmaWxlXG4gICAgY29uc3QgbG9nRmlsZXMgPSBmcy5yZWFkZGlyU3luYyhsb2dzUGF0aClcbiAgICAgIC5maWx0ZXIoZmlsZSA9PiBmaWxlLmVuZHNXaXRoKCcubG9nJykpXG4gICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKGxvZ3NQYXRoLCBmaWxlKSk7XG4gICAgXG4gICAgaWYgKGxvZ0ZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIFNvcnQgYnkgZmlsZSBjcmVhdGlvbiB0aW1lIChtb3N0IHJlY2VudCBmaXJzdClcbiAgICByZXR1cm4gbG9nRmlsZXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3Qgc3RhdEEgPSBmcy5zdGF0U3luYyhhKTtcbiAgICAgIGNvbnN0IHN0YXRCID0gZnMuc3RhdFN5bmMoYik7XG4gICAgICByZXR1cm4gc3RhdEIuYmlydGh0aW1lTXMgLSBzdGF0QS5iaXJ0aHRpbWVNcztcbiAgICB9KVswXTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgaW4gZ2V0LWxvZy1maWxlLXBhdGggaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8vIE9wZW4gbG9nIGZpbGUgaGFuZGxlclxuaXBjTWFpbi5oYW5kbGUoJ29wZW4tbG9nLWZpbGUnLCBhc3luYyAoX2V2ZW50LCB7IGxvZ0ZpbGVQYXRoIH0pID0+IHtcbiAgdHJ5IHtcbiAgICBpZiAoIWxvZ0ZpbGVQYXRoIHx8ICFmcy5leGlzdHNTeW5jKGxvZ0ZpbGVQYXRoKSkge1xuICAgICAgbG9nRXJyb3IoYExvZyBmaWxlIG5vdCBmb3VuZDogJHtsb2dGaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBhd2FpdCBzaGVsbC5vcGVuUGF0aChsb2dGaWxlUGF0aCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nRXJyb3IoJ0Vycm9yIGluIG9wZW4tbG9nLWZpbGUgaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG4vLyBIZWxwZXIgZnVuY3Rpb24gdG8gZW1pdCBtYWluLXdpbmRvdy12aXNpYmxlIGV2ZW50XG5mdW5jdGlvbiBlbWl0TWFpbldpbmRvd1Zpc2libGUod2luZG93OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmICh3aW5kb3cgJiYgIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICB3aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbWFpbi13aW5kb3ctdmlzaWJsZScpO1xuICAgIH1cbiAgfSwgMjAwKTtcbn1cblxuLy8gSGFuZGxlIGFwcCB0ZXJtaW5hdGlvbiB3aXRoIGNvbmZpcm1hdGlvbiB3aGVuIG5lZWRlZFxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlQXBwVGVybWluYXRpb24obWFpbldpbmRvdzogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZCB8IG51bGwpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgaWYgKCFtYWluV2luZG93IHx8IG1haW5XaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgIHJldHVybiB0cnVlOyAvLyBBbGxvdyB0ZXJtaW5hdGlvbiBpZiB3aW5kb3cgZG9lc24ndCBleGlzdFxuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBDcmVhdGUgYSBwcm9taXNlIHRoYXQgd2lsbCByZXNvbHZlIGJhc2VkIG9uIElQQyBjb21tdW5pY2F0aW9uXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG4gICAgICAvLyBTZXQgdXAgYSBvbmUtdGltZSBsaXN0ZW5lciBmb3IgdGhlIHJlc3BvbnNlXG4gICAgICBjb25zdCByZXNwb25zZUhhbmRsZXIgPSAoX2V2ZW50OiBhbnksIHsgY2FuVGVybWluYXRlLCBhbHJlYWR5Q29uZmlybWVkIH06IHsgY2FuVGVybWluYXRlOiBib29sZWFuLCBhbHJlYWR5Q29uZmlybWVkPzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICAgIGlwY01haW4ucmVtb3ZlTGlzdGVuZXIoJ2V4aXQtY29uZmlybWF0aW9uLXJlc3BvbnNlJywgcmVzcG9uc2VIYW5kbGVyKTtcbiAgICAgICAgXG4gICAgICAgIC8vIElmIGFscmVhZHkgY29uZmlybWVkIGJ5IHJlbmRlcmVyICh1c2VyIGNsaWNrZWQgXCJFeGl0IEFueXdheVwiKSwgd2UgZG9uJ3QgbmVlZCBmdXJ0aGVyIGNoZWNrc1xuICAgICAgICBpZiAoYWxyZWFkeUNvbmZpcm1lZCkge1xuICAgICAgICAgIGxvZ0luZm8oJ0V4aXQgYWxyZWFkeSBjb25maXJtZWQgYnkgdXNlciwgYWxsb3dpbmcgdGVybWluYXRpb24nKTtcbiAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmVzb2x2ZShjYW5UZXJtaW5hdGUpO1xuICAgICAgfTtcblxuICAgICAgaXBjTWFpbi5vbmNlKCdleGl0LWNvbmZpcm1hdGlvbi1yZXNwb25zZScsIHJlc3BvbnNlSGFuZGxlcik7XG5cbiAgICAgIC8vIFNlbmQgdGhlIHJlcXVlc3QgdG8gY2hlY2sgaWYgdGVybWluYXRpb24gaXMgYWxsb3dlZFxuICAgICAgbWFpbldpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdjaGVjay1ydW5uaW5nLWNvbnRhaW5lcnMnKTtcblxuICAgICAgLy8gU2V0IGEgdGltZW91dCBpbiBjYXNlIHdlIGRvbid0IGdldCBhIHJlc3BvbnNlXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaXBjTWFpbi5yZW1vdmVMaXN0ZW5lcignZXhpdC1jb25maXJtYXRpb24tcmVzcG9uc2UnLCByZXNwb25zZUhhbmRsZXIpO1xuICAgICAgICBsb2dJbmZvKCdObyByZXNwb25zZSBmcm9tIHJlbmRlcmVyIGFib3V0IHJ1bm5pbmcgY29udGFpbmVycywgYWxsb3dpbmcgdGVybWluYXRpb24nKTtcbiAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgIH0sIDIwMDApO1xuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBjaGVja2luZyBmb3IgcnVubmluZyBjb250YWluZXJzJywgZXJyb3IpO1xuICAgIHJldHVybiB0cnVlOyAvLyBJbiBjYXNlIG9mIGVycm9yLCBhbGxvdyB0ZXJtaW5hdGlvblxuICB9XG59XG5cbi8vIEhlbHBlciBmdW5jdGlvbiBmb3IgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRcbmZ1bmN0aW9uIGxvYWRBbmRTaG93RGV2V2luZG93KHdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdykge1xuICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuXG4gIHdpbmRvdy5sb2FkVVJMKCdodHRwOi8vbG9jYWxob3N0OjUxNzMvIy9tYWluJykudGhlbigoKSA9PiB7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KS5jYXRjaChlcnIgPT4ge1xuICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBtYWluIFVSTCcsIGVycik7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KTtcblxuICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scyh7IG1vZGU6ICdkZXRhY2gnIH0pO1xuICB9XG59XG5cbi8vIEhlbHBlciBmdW5jdGlvbiBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudFxuZnVuY3Rpb24gbG9hZEFuZFNob3dQcm9kV2luZG93KHdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdykge1xuICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuXG4gIC8vIFVzZSBwYXRoLnJlc29sdmUgZm9yIGNvbnNpc3RlbnQgcGF0aCByZXNvbHV0aW9uXG4gIGNvbnN0IGh0bWxQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uL2Rpc3QvaW5kZXguaHRtbCcpO1xuICBsb2dJbmZvKGBMb2FkaW5nIG1haW4gZmlsZSBmcm9tOiAke2h0bWxQYXRofWApO1xuICBcbiAgd2luZG93LmxvYWRGaWxlKGh0bWxQYXRoLCB7IGhhc2g6ICdtYWluJyB9KS50aGVuKCgpID0+IHtcbiAgICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuICAgIHdpbmRvdy5zaG93KCk7XG4gICAgd2luZG93LmZvY3VzKCk7XG4gICAgZW1pdE1haW5XaW5kb3dWaXNpYmxlKHdpbmRvdyk7XG4gIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIG1haW4gZmlsZScsIGVycik7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KTtcbn1cblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIHNhZmVseSBsb2FkIGFuZCBzaG93IGEgd2luZG93IGJhc2VkIG9uIHRoZSBlbnZpcm9ubWVudFxuZnVuY3Rpb24gbG9hZEFuZFNob3dXaW5kb3cod2luZG93OiBCcm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuICBpZiAoIXdpbmRvdykge1xuICAgIGxvZ0Vycm9yKCdDYW5ub3QgbG9hZCBhbmQgc2hvdyBhIG51bGwgb3IgdW5kZWZpbmVkIHdpbmRvdyEnKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBsb2FkQW5kU2hvd0RldldpbmRvdyh3aW5kb3cpO1xuICB9IGVsc2Uge1xuICAgIGxvYWRBbmRTaG93UHJvZFdpbmRvdyh3aW5kb3cpO1xuICB9XG59XG5cbi8vIFN0b3JlIHdpbmRvdyByZWZlcmVuY2VzIHRvIHByZXZlbnQgZ2FyYmFnZSBjb2xsZWN0aW9uXG5pbnRlcmZhY2UgV2luZG93c1JlZ2lzdHJ5IHtcbiAgc3BsYXNoPzogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbiAgbWFpbj86IEJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQ7XG4gIHNldHVwPzogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbiAgW2tleTogc3RyaW5nXTogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbn1cblxuLy8gV2luZG93IGNvbmZpZ3VyYXRpb24gYnkgdHlwZVxuaW50ZXJmYWNlIFdpbmRvd0NvbmZpZyB7XG4gIHdpZHRoOiBudW1iZXI7XG4gIGhlaWdodDogbnVtYmVyO1xuICByZXNpemFibGU6IGJvb2xlYW47XG4gIG1pbldpZHRoPzogbnVtYmVyO1xuICBtaW5IZWlnaHQ/OiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG59XG5cbi8vIERlZmluZSBkZWZhdWx0IHdpbmRvdyBjb25maWd1cmF0aW9uc1xuY29uc3Qgd2luZG93Q29uZmlnczogUmVjb3JkPHN0cmluZywgV2luZG93Q29uZmlnPiA9IHtcbiAgJ21haW4nOiB7XG4gICAgd2lkdGg6IDEyMDAsXG4gICAgaGVpZ2h0OiA5MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiAxMjAwLFxuICAgIG1pbkhlaWdodDogNzUwLFxuICAgIHRpdGxlOiAnT2RvbyBNYW5hZ2VyJ1xuICB9LFxuICAnc3BsYXNoJzoge1xuICAgIHdpZHRoOiA1MDAsXG4gICAgaGVpZ2h0OiA0MDAsXG4gICAgcmVzaXphYmxlOiBmYWxzZSxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlcidcbiAgfSxcbiAgJ3NldHVwJzoge1xuICAgIHdpZHRoOiA5NTAsXG4gICAgaGVpZ2h0OiA4MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA4MDAsXG4gICAgbWluSGVpZ2h0OiA2MDAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXInXG4gIH0sXG4gICdoZWxwJzoge1xuICAgIHdpZHRoOiA3NTAsXG4gICAgaGVpZ2h0OiA3MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA2MDAsXG4gICAgbWluSGVpZ2h0OiA1MDAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXIgLSBIZWxwJ1xuICB9LFxuICBcInNldHRpbmdzXCI6IHtcbiAgICB3aWR0aDogOTAwLFxuICAgIGhlaWdodDogNzAwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogODAwLFxuICAgIG1pbkhlaWdodDogNjAwLFxuICAgIHRpdGxlOiBcIk9kb28gTWFuYWdlciAtIFNldHRpbmdzXCJcbiAgfSxcbiAgJ25ldy1pbnN0YW5jZSc6IHtcbiAgICB3aWR0aDogNjAwLFxuICAgIGhlaWdodDogODcwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogNTAwLFxuICAgIG1pbkhlaWdodDogNzAwLFxuICAgIHRpdGxlOiAnT2RvbyBNYW5hZ2VyIC0gTmV3IEluc3RhbmNlJ1xuICB9LFxuICBcIm5ldy1wb3N0Z3Jlc1wiOiB7XG4gICAgd2lkdGg6IDYwMCxcbiAgICBoZWlnaHQ6IDgyMCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDUwMCxcbiAgICBtaW5IZWlnaHQ6IDcwMCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIE5ldyBQb3N0Z3JlU1FMIEluc3RhbmNlJ1xuICB9LFxuICAnY29udGFpbmVyLWluZm8nOiB7XG4gICAgd2lkdGg6IDcwMCxcbiAgICBoZWlnaHQ6IDg1MCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDcwMCxcbiAgICBtaW5IZWlnaHQ6IDg1MCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIENvbnRhaW5lciBJbmZvJ1xuICB9LFxuICAnY29udGFpbmVyLWxvZ3MnOiB7XG4gICAgd2lkdGg6IDgwMCxcbiAgICBoZWlnaHQ6IDg2MCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDYwMCxcbiAgICBtaW5IZWlnaHQ6IDcwMCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIENvbnRhaW5lciBMb2dzJ1xuICB9XG59O1xuXG4vLyBHZXQgd2luZG93IGNvbmZpZyB3aXRoIGZhbGxiYWNrIHRvIGRlZmF1bHRcbmZ1bmN0aW9uIGdldFdpbmRvd0NvbmZpZyh0eXBlOiBzdHJpbmcpOiBXaW5kb3dDb25maWcge1xuICByZXR1cm4gd2luZG93Q29uZmlnc1t0eXBlXSB8fCB7XG4gICAgd2lkdGg6IDgwMCxcbiAgICBoZWlnaHQ6IDYwMCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgdGl0bGU6IGBPZG9vIE1hbmFnZXIgLSAke3R5cGV9YFxuICB9O1xufVxuXG5jb25zdCB3aW5kb3dzOiBXaW5kb3dzUmVnaXN0cnkgPSB7fTtcblxuLy8gQ2hlY2sgaWYgc2V0dXAgaXMgY29tcGxldGVkXG5hc3luYyBmdW5jdGlvbiBpc1NldHVwQ29tcGxldGVkKCk6IFByb21pc2U8e2NvbXBsZXRlZDogYm9vbGVhbn0+IHtcbiAgdHJ5IHtcblxuICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHAuZ2V0UGF0aCgndXNlckRhdGEnKSwgJ3dvcmtkaXIuanNvbicpO1xuXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIGxvZ0luZm8oJ1dvcmsgZGlyZWN0b3J5IGZpbGUgZG9lcyBub3QgZXhpc3QsIHNldHVwIG5vdCBjb21wbGV0ZWQnKTtcbiAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCB3b3JrRGlyRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0ZjgnKSk7XG4gICAgY29uc3Qgd29ya0RpciA9IHdvcmtEaXJEYXRhLndvcmtEaXI7XG5cbiAgICBpZiAoIXdvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMod29ya0RpcikpIHtcbiAgICAgIGxvZ0luZm8oJ1dvcmsgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0LCBzZXR1cCBub3QgY29tcGxldGVkJyk7XG4gICAgICByZXR1cm4geyBjb21wbGV0ZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5qb2luKHdvcmtEaXIsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzUGF0aCkpIHtcbiAgICAgIGxvZ0luZm8oJ1NldHRpbmdzIGZpbGUgZG9lcyBub3QgZXhpc3QsIHNldHVwIG5vdCBjb21wbGV0ZWQnKTtcbiAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb21wbGV0ZWQ6IHRydWUgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgc2V0dXAgc3RhdHVzJywgZXJyb3IpO1xuICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgfVxufVxuXG4vLyBDcmVhdGUgc2V0dXAgd2luZG93XG5mdW5jdGlvbiBjcmVhdGVTZXR1cFdpbmRvdygpIHtcbiAgbG9nSW5mbyhcIkNyZWF0aW5nIHNldHVwIHdpbmRvd1wiKTtcblxuICBjb25zdCBtYWluQ29uZmlnID0gZ2V0V2luZG93Q29uZmlnKFwibWFpblwiKTtcbiAgY29uc3Qgc2V0dXBDb25maWcgPSBnZXRXaW5kb3dDb25maWcoXCJzZXR1cFwiKTtcblxuICAvLyBEZWZpbmUgcHJlbG9hZFBhdGggYmFzZWQgb24gZW52aXJvbm1lbnQgLSBlbnN1cmUgX19kaXJuYW1lIHdvcmtzIGNvcnJlY3RseVxuICBjb25zdCBwcmVsb2FkUGF0aCA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIFxuICAgID8gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICdkaXN0LWVsZWN0cm9uJywgJ3ByZWxvYWQuanMnKVxuICAgIDogcGF0aC5qb2luKF9fZGlybmFtZSwgJ3ByZWxvYWQuanMnKTtcbiAgXG4gIGxvZ0luZm8oYFVzaW5nIHByZWxvYWQgcGF0aCBmb3Igc2V0dXAgd2luZG93OiAke3ByZWxvYWRQYXRofWApO1xuXG4gIGNvbnN0IHNldHVwV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgIHdpZHRoOiBtYWluQ29uZmlnLndpZHRoLFxuICAgIGhlaWdodDogbWFpbkNvbmZpZy5oZWlnaHQsXG4gICAgbWluV2lkdGg6IG1haW5Db25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBtYWluQ29uZmlnLm1pbkhlaWdodCxcbiAgICBjZW50ZXI6IHRydWUsXG4gICAgc2hvdzogZmFsc2UsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzEyMTIxMicsXG4gICAgdGl0bGU6IHNldHVwQ29uZmlnLnRpdGxlLFxuICAgIHRpdGxlQmFyU3R5bGU6ICdkZWZhdWx0JyxcbiAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgcHJlbG9hZDogcHJlbG9hZFBhdGgsXG4gICAgICBub2RlSW50ZWdyYXRpb246IHRydWUsXG4gICAgICBjb250ZXh0SXNvbGF0aW9uOiBmYWxzZVxuICAgIH1cbiAgfSk7XG5cbiAgc2V0dXBXaW5kb3cuc2V0VGl0bGUoc2V0dXBDb25maWcudGl0bGUpO1xuXG4gIHNldHVwV2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgc2V0dXBXaW5kb3cuc2V0VGl0bGUoc2V0dXBDb25maWcudGl0bGUpO1xuICB9KTtcblxuICBzZXR1cFdpbmRvdy5vbmNlKCdyZWFkeS10by1zaG93JywgKCkgPT4ge1xuICAgIHNldHVwV2luZG93LnNob3coKTtcbiAgICBzZXR1cFdpbmRvdy5mb2N1cygpO1xuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzZXR1cFdpbmRvdy5sb2FkVVJMKCdodHRwOi8vbG9jYWxob3N0OjUxNzMvIy9zZXR1cCcpLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgc2V0dXAgVVJMJywgZXJyKTtcbiAgICB9KTtcbiAgICBzZXR1cFdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgfSBlbHNlIHtcbiAgICBzZXR1cFdpbmRvdy5sb2FkRmlsZShwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vZGlzdC9pbmRleC5odG1sJyksIHsgaGFzaDogJ3NldHVwJyB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHNldHVwIGZpbGUnLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0dXBXaW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoYEZhaWxlZCB0byBvcGVuIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICB9KTtcblxuICB3aW5kb3dzLnNldHVwID0gc2V0dXBXaW5kb3c7XG5cbiAgcmV0dXJuIHNldHVwV2luZG93O1xufVxuXG4vLyBDcmVhdGUgc3BsYXNoIHdpbmRvd1xuZnVuY3Rpb24gY3JlYXRlU3BsYXNoV2luZG93KCkge1xuICBsb2dJbmZvKFwiQ3JlYXRpbmcgc3BsYXNoIHdpbmRvd1wiKTtcbiAgY29uc3QgY29uZmlnID0gZ2V0V2luZG93Q29uZmlnKFwic3BsYXNoXCIpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBfX2Rpcm5hbWUgd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoOiAke3ByZWxvYWRQYXRofWApO1xuXG4gIGNvbnN0IHNwbGFzaCA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICB3aWR0aDogNTAwLFxuICAgIGhlaWdodDogNjAwLFxuICAgIGNlbnRlcjogdHJ1ZSxcbiAgICBmcmFtZTogZmFsc2UsXG4gICAgdHJhbnNwYXJlbnQ6IHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcsXG4gICAgYmFja2dyb3VuZENvbG9yOiBwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnID8gJyMxMjEyMTInIDogdW5kZWZpbmVkLFxuICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgbW92YWJsZTogdHJ1ZSxcbiAgICB0aXRsZTogY29uZmlnLnRpdGxlLFxuICAgIHNob3c6IGZhbHNlLFxuICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICBwcmVsb2FkOiBwcmVsb2FkUGF0aCxcbiAgICAgIG5vZGVJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICAgIGNvbnRleHRJc29sYXRpb246IGZhbHNlLFxuICAgICAgZGV2VG9vbHM6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnXG4gICAgfVxuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzcGxhc2gud2ViQ29udGVudHMub3BlbkRldlRvb2xzKHsgbW9kZTogJ2RldGFjaCcgfSk7XG4gIH1cblxuICBzcGxhc2gub24oJ2Nsb3NlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKGdsb2JhbC5hbGxvd1NwbGFzaENsb3NlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBhcHAuZW1pdCgndmVyaWZpY2F0aW9uLWNvbXBsZXRlJyBhcyBhbnkpO1xuICB9KTtcblxuICBzcGxhc2gub25jZSgncmVhZHktdG8tc2hvdycsICgpID0+IHtcbiAgICBzcGxhc2guc2hvdygpO1xuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzcGxhc2gubG9hZFVSTCgnaHR0cDovL2xvY2FsaG9zdDo1MTczLyMvc3BsYXNoJykuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBzcGxhc2ggVVJMJywgZXJyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBVc2UgcGF0aC5yZXNvbHZlIHJhdGhlciB0aGFuIHBhdGguam9pbiB0byBlbnN1cmUgY29ycmVjdCBwYXRoIHJlc29sdXRpb25cbiAgICBjb25zdCBodG1sUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9kaXN0L2luZGV4Lmh0bWwnKTtcbiAgICBsb2dJbmZvKGBMb2FkaW5nIHNwbGFzaCBmaWxlIGZyb206ICR7aHRtbFBhdGh9YCk7XG4gICAgc3BsYXNoLmxvYWRGaWxlKGh0bWxQYXRoLCB7IGhhc2g6ICdzcGxhc2gnIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgc3BsYXNoIGZpbGUnLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgd2luZG93cy5zcGxhc2ggPSBzcGxhc2g7XG5cbiAgcmV0dXJuIHNwbGFzaDtcbn1cblxuLy8gQ3JlYXRlIG1haW4gd2luZG93XG5mdW5jdGlvbiBjcmVhdGVNYWluV2luZG93KCkge1xuICBsb2dJbmZvKCdDcmVhdGluZyBtYWluIHdpbmRvdycpO1xuXG4gIGNvbnN0IGNvbmZpZyA9IGdldFdpbmRvd0NvbmZpZygnbWFpbicpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBfX2Rpcm5hbWUgd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoIGZvciBtYWluIHdpbmRvdzogJHtwcmVsb2FkUGF0aH1gKTtcblxuICBjb25zdCBtYWluV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgIHdpZHRoOiBjb25maWcud2lkdGgsXG4gICAgaGVpZ2h0OiBjb25maWcuaGVpZ2h0LFxuICAgIG1pbldpZHRoOiBjb25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBjb25maWcubWluSGVpZ2h0LFxuICAgIGNlbnRlcjogdHJ1ZSxcbiAgICBzaG93OiBmYWxzZSxcbiAgICBmcmFtZTogdHJ1ZSxcbiAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzEyMTIxMicsXG4gICAgdGl0bGVCYXJTdHlsZTogJ2RlZmF1bHQnLFxuICAgIHRpdGxlOiBjb25maWcudGl0bGUsXG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHByZWxvYWRQYXRoLFxuICAgICAgbm9kZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogZmFsc2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgbWFpbldpbmRvdy5zZXRUaXRsZShjb25maWcudGl0bGUpO1xuXG4gIG1haW5XaW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICBtYWluV2luZG93LnNldFRpdGxlKGNvbmZpZy50aXRsZSk7XG4gIH0pO1xuXG4gIC8vIFRyYWNrIGlmIHdlJ3JlIGluIHRoZSB0ZXJtaW5hdGlvbiBwcm9jZXNzXG4gIGxldCB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICBtYWluV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jIChldmVudCkgPT4ge1xuICAgIC8vIElmIHdlJ3JlIGFscmVhZHkgaGFuZGxpbmcgdGVybWluYXRpb24sIGRvbid0IHRyaWdnZXIgYWdhaW5cbiAgICBpZiAodGVybWluYXRpb25JblByb2dyZXNzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSB0cnVlO1xuXG4gICAgY29uc3Qgc2hvdWxkVGVybWluYXRlID0gYXdhaXQgaGFuZGxlQXBwVGVybWluYXRpb24obWFpbldpbmRvdyk7XG5cbiAgICBpZiAoc2hvdWxkVGVybWluYXRlKSB7XG4gICAgICBsb2dJbmZvKCdBcHAgdGVybWluYXRpb24gYXBwcm92ZWQsIHF1aXR0aW5nLi4uJyk7XG4gICAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICAgIG1haW5XaW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdjbG9zZScpO1xuICAgICAgYXBwLnF1aXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nSW5mbygnQXBwIHRlcm1pbmF0aW9uIGNhbmNlbGxlZCBieSB1c2VyJyk7XG4gICAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuXG4gIG1haW5XaW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoYEZhaWxlZCB0byBvcGVuIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICB9KTtcblxuICB3aW5kb3dzLm1haW4gPSBtYWluV2luZG93O1xuXG4gIHJldHVybiBtYWluV2luZG93O1xufVxuXG4vLyBDcmVhdGUgYSBuZXcgd2luZG93IG9mIHNwZWNpZmllZCB0eXBlXG5mdW5jdGlvbiBjcmVhdGVXaW5kb3cod2luZG93VHlwZTogc3RyaW5nLCBvcHRpb25zOiBhbnkgPSB7fSkge1xuICBsb2dJbmZvKGBDcmVhdGluZyB3aW5kb3c6ICR7d2luZG93VHlwZX1gKTtcblxuICBjb25zdCBkZWZhdWx0Q29uZmlnID0gZ2V0V2luZG93Q29uZmlnKHdpbmRvd1R5cGUpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBfX2Rpcm5hbWUgd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoIGZvciAke3dpbmRvd1R5cGV9IHdpbmRvdzogJHtwcmVsb2FkUGF0aH1gKTtcblxuICBjb25zdCB3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgd2lkdGg6IG9wdGlvbnMud2lkdGggfHwgZGVmYXVsdENvbmZpZy53aWR0aCxcbiAgICBoZWlnaHQ6IG9wdGlvbnMuaGVpZ2h0IHx8IGRlZmF1bHRDb25maWcuaGVpZ2h0LFxuICAgIG1pbldpZHRoOiBvcHRpb25zLm1pbldpZHRoIHx8IGRlZmF1bHRDb25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBvcHRpb25zLm1pbkhlaWdodCB8fCBkZWZhdWx0Q29uZmlnLm1pbkhlaWdodCxcbiAgICByZXNpemFibGU6IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3Jlc2l6YWJsZScpID8gb3B0aW9ucy5yZXNpemFibGUgOiBkZWZhdWx0Q29uZmlnLnJlc2l6YWJsZSxcbiAgICBjZW50ZXI6IHRydWUsXG4gICAgc2hvdzogZmFsc2UsXG4gICAgZnJhbWU6IHRydWUsXG4gICAgdGl0bGU6IG9wdGlvbnMudGl0bGUgfHwgZGVmYXVsdENvbmZpZy50aXRsZSxcbiAgICBhdXRvSGlkZU1lbnVCYXI6IHByb2Nlc3MucGxhdGZvcm0gIT09ICdkYXJ3aW4nLFxuICAgIHRpdGxlQmFyU3R5bGU6ICdkZWZhdWx0JyxcbiAgICBtb2RhbDogb3B0aW9ucy5tb2RhbCA9PT0gdHJ1ZSxcbiAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMTIxMjEyJyxcbiAgICBwYXJlbnQ6IG9wdGlvbnMucGFyZW50ICYmIHdpbmRvd3Nbb3B0aW9ucy5wYXJlbnRdID8gd2luZG93c1tvcHRpb25zLnBhcmVudF0gOiB1bmRlZmluZWQsXG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHByZWxvYWRQYXRoLFxuICAgICAgbm9kZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogZmFsc2UsXG4gICAgICBhZGRpdGlvbmFsQXJndW1lbnRzOiBvcHRpb25zLmRhdGEgPyBbYC0td2luZG93LWRhdGE9JHtKU09OLnN0cmluZ2lmeShvcHRpb25zLmRhdGEpfWBdIDogW11cbiAgICB9LFxuICB9KTtcblxuICBjb25zdCB3aW5kb3dUaXRsZSA9IG9wdGlvbnMudGl0bGUgfHwgZGVmYXVsdENvbmZpZy50aXRsZTtcbiAgd2luZG93LnNldFRpdGxlKHdpbmRvd1RpdGxlKTtcblxuICB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICB3aW5kb3cuc2V0VGl0bGUod2luZG93VGl0bGUpO1xuICB9KTtcblxuICBpZiAoIW9wdGlvbnMubW9kYWwpIHtcbiAgICB3aW5kb3cuc2V0UGFyZW50V2luZG93KG51bGwpO1xuICB9XG5cbiAgd2luZG93Lm9uY2UoJ3JlYWR5LXRvLXNob3cnLCAoKSA9PiB7XG4gICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgd2luZG93LnNob3coKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jykge1xuICAgIHdpbmRvdy5sb2FkVVJMKGBodHRwOi8vbG9jYWxob3N0OjUxNzMvIy8ke3dpbmRvd1R5cGV9YCkuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKGBGYWlsZWQgdG8gbG9hZCAke3dpbmRvd1R5cGV9IFVSTGAsIGVycik7XG4gICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvdy5zaG93KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAob3B0aW9ucy5vcGVuRGV2VG9vbHMpIHtcbiAgICAgIHdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LmxvYWRGaWxlKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9kaXN0L2luZGV4Lmh0bWwnKSwgeyBoYXNoOiB3aW5kb3dUeXBlIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcihgRmFpbGVkIHRvIGxvYWQgJHt3aW5kb3dUeXBlfSBmaWxlYCwgZXJyKTtcbiAgICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgd2luZG93LnNob3coKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHdpbmRvd3Nbd2luZG93VHlwZV0gPSB3aW5kb3c7XG5cbiAgLy8gQWRkIGlzQ2xvc2luZyBwcm9wZXJ0eSB0byBCcm93c2VyV2luZG93XG4gICh3aW5kb3cgYXMgYW55KS5pc0Nsb3NpbmcgPSBmYWxzZTtcblxuICAvLyBBZGQgY3VzdG9tIGNsb3NlIG1ldGhvZCB3aXRoIGFuaW1hdGlvblxuICBjb25zdCBvcmlnaW5hbENsb3NlID0gd2luZG93LmNsb3NlLmJpbmQod2luZG93KTtcbiAgKHdpbmRvdyBhcyBhbnkpLm9yaWdpbmFsQ2xvc2UgPSBvcmlnaW5hbENsb3NlO1xuICB3aW5kb3cuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAod2luZG93LmlzRGVzdHJveWVkKCkgfHwgKHdpbmRvdyBhcyBhbnkpLmlzQ2xvc2luZykge1xuICAgICAgcmV0dXJuIG9yaWdpbmFsQ2xvc2UoKTtcbiAgICB9XG5cbiAgICAod2luZG93IGFzIGFueSkuaXNDbG9zaW5nID0gdHJ1ZTtcblxuICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkgJiYgd2luZG93LndlYkNvbnRlbnRzKSB7XG4gICAgICB3aW5kb3cud2ViQ29udGVudHMuc2VuZCgnd2luZG93LWZhZGUtb3V0Jyk7XG5cbiAgICAgIGlwY01haW4ub25jZSgnd2luZG93LWZhZGUtb3V0LWNvbmZpcm0nLCAoKSA9PiB7XG4gICAgICAgIGxldCBvcGFjaXR5ID0gMS4wO1xuICAgICAgICBjb25zdCBmYWRlU3RlcCA9IDAuMTtcbiAgICAgICAgY29uc3QgZmFkZUludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgIGlmICh3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG9wYWNpdHkgLT0gZmFkZVN0ZXA7XG4gICAgICAgICAgaWYgKG9wYWNpdHkgPD0gMCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICBvcmlnaW5hbENsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRPcGFjaXR5KG9wYWNpdHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgMTApO1xuICAgICAgfSk7XG5cbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpICYmICh3aW5kb3cgYXMgYW55KS5pc0Nsb3NpbmcpIHtcbiAgICAgICAgICBvcmlnaW5hbENsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDgwMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9yaWdpbmFsQ2xvc2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfTtcblxuICB3aW5kb3cub24oJ2Nsb3NlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKCEod2luZG93IGFzIGFueSkuaXNDbG9zaW5nKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgd2luZG93LmNsb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICB3aW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHtcbiAgICB3aW5kb3dzW3dpbmRvd1R5cGVdID0gdW5kZWZpbmVkO1xuICB9KTtcblxuICByZXR1cm4gd2luZG93O1xufVxuXG5mdW5jdGlvbiBzaG93TWFpbldpbmRvdygpIHtcbiAgbG9nSW5mbygnc2hvd01haW5XaW5kb3cgZnVuY3Rpb24gY2FsbGVkJyk7XG5cbiAgdHJ5IHtcbiAgICBnbG9iYWwuYWxsb3dTcGxhc2hDbG9zZSA9IHRydWU7XG5cbiAgICBjb25zdCBtYWluRXhpc3RzID0gd2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKTtcbiAgICBjb25zdCBzcGxhc2hFeGlzdHMgPSB3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKTtcblxuICAgIGlmIChtYWluRXhpc3RzICYmIHdpbmRvd3MubWFpbikge1xuICAgICAgd2luZG93cy5tYWluLmhpZGUoKTtcblxuICAgICAgaWYgKHNwbGFzaEV4aXN0cyAmJiB3aW5kb3dzLnNwbGFzaCkge1xuICAgICAgICBsZXQgc3BsYXNoT3BhY2l0eSA9IDE7XG4gICAgICAgIGNvbnN0IGZhZGVJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICBzcGxhc2hPcGFjaXR5IC09IDAuMDQ7XG5cbiAgICAgICAgICBpZiAoc3BsYXNoT3BhY2l0eSA8PSAwKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGZhZGVJbnRlcnZhbCk7XG5cbiAgICAgICAgICAgIGlmICh3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHdpbmRvd3Muc3BsYXNoLmNsb3NlKCk7XG5cbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB3aW5kb3dzLm1haW47XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmICFtYWluV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIDUwMCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gd2luZG93cy5tYWluO1xuICAgICAgICAgICAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB3aW5kb3dzLm1haW47XG4gICAgICAgICAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICB3aW5kb3dzLnNwbGFzaC5zZXRPcGFjaXR5KHNwbGFzaE9wYWNpdHkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGZhZGVJbnRlcnZhbCk7XG4gICAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gd2luZG93cy5tYWluO1xuICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sIDE2KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHdpbmRvd3MubWFpbjtcbiAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgZ2xvYmFsLmFsbG93U3BsYXNoQ2xvc2UgPSBmYWxzZTtcbiAgICAgIH0sIDIwMDApO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld01haW4gPSBjcmVhdGVNYWluV2luZG93KCk7XG5cbiAgICAgIGlmIChzcGxhc2hFeGlzdHMgJiYgd2luZG93cy5zcGxhc2gpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBsZXQgc3BsYXNoT3BhY2l0eSA9IDE7XG4gICAgICAgICAgY29uc3QgZmFkZUludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgc3BsYXNoT3BhY2l0eSAtPSAwLjA0O1xuXG4gICAgICAgICAgICBpZiAoc3BsYXNoT3BhY2l0eSA8PSAwKSB7XG4gICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoZmFkZUludGVydmFsKTtcbiAgICAgICAgICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgd2luZG93cy5zcGxhc2guY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGxvYWRBbmRTaG93V2luZG93KG5ld01haW4pO1xuICAgICAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB3aW5kb3dzLnNwbGFzaC5zZXRPcGFjaXR5KHNwbGFzaE9wYWNpdHkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCAxNik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgIGlmICghbmV3TWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICBuZXdNYWluLnNob3coKTtcbiAgICAgICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICBlbWl0TWFpbldpbmRvd1Zpc2libGUobmV3TWFpbik7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBzaG93TWFpbldpbmRvdycsIGVycm9yKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbmV3TWFpbiA9IGNyZWF0ZU1haW5XaW5kb3coKTtcblxuICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2luZG93cy5zcGxhc2guY2xvc2UoKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICAgICAgZW1pdE1haW5XaW5kb3dWaXNpYmxlKG5ld01haW4pO1xuICAgICAgICAgIH0sIDEwMCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3TWFpbi5zaG93KCk7XG4gICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChmYWxsYmFja0Vycm9yKSB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGNyZWF0ZSBmYWxsYmFjayBtYWluIHdpbmRvdycsIGZhbGxiYWNrRXJyb3IpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBDcmVhdGUgdGhlIG1hY09TIGFwcGxpY2F0aW9uIG1lbnVcbmZ1bmN0aW9uIGNyZWF0ZUFwcE1lbnUoKSB7XG4gIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnZGFyd2luJykgcmV0dXJuO1xuXG4gIGxvZ0luZm8oJ0NyZWF0aW5nIG1hY09TIGFwcGxpY2F0aW9uIG1lbnUnKTtcblxuICBjb25zdCB0ZW1wbGF0ZTogRWxlY3Ryb24uTWVudUl0ZW1Db25zdHJ1Y3Rvck9wdGlvbnNbXSA9IFtcbiAgICB7XG4gICAgICBsYWJlbDogYXBwLm5hbWUsXG4gICAgICBzdWJtZW51OiBbXG4gICAgICAgIHsgcm9sZTogJ2Fib3V0JyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ1ByZWZlcmVuY2VzJyxcbiAgICAgICAgICBhY2NlbGVyYXRvcjogJ0NtZCssJyxcbiAgICAgICAgICBjbGljazogKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHdpbmRvd3Muc2V0dGluZ3MgJiYgIXdpbmRvd3Muc2V0dGluZ3MuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB3aW5kb3dzLnNldHRpbmdzLmZvY3VzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjcmVhdGVXaW5kb3coJ3NldHRpbmdzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ3NlcnZpY2VzJyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2hpZGUnIH0sXG4gICAgICAgIHsgcm9sZTogJ2hpZGVPdGhlcnMnIH0sXG4gICAgICAgIHsgcm9sZTogJ3VuaGlkZScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdxdWl0JyB9XG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBsYWJlbDogJ0ZpbGUnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6ICdOZXcgT2RvbyBJbnN0YW5jZScsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdDbWQrTicsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIGNyZWF0ZVdpbmRvdygnbmV3LWluc3RhbmNlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6ICdOZXcgUG9zdGdyZVNRTCBJbnN0YW5jZScsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdTaGlmdCtDbWQrTicsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIGNyZWF0ZVdpbmRvdygnbmV3LXBvc3RncmVzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2Nsb3NlJyB9XG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBsYWJlbDogJ0VkaXQnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7IHJvbGU6ICd1bmRvJyB9LFxuICAgICAgICB7IHJvbGU6ICdyZWRvJyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2N1dCcgfSxcbiAgICAgICAgeyByb2xlOiAnY29weScgfSxcbiAgICAgICAgeyByb2xlOiAncGFzdGUnIH0sXG4gICAgICAgIHsgcm9sZTogJ2RlbGV0ZScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdzZWxlY3RBbGwnIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIGxhYmVsOiAnVmlldycsXG4gICAgICBzdWJtZW51OiBbXG4gICAgICAgIHsgcm9sZTogJ3JlbG9hZCcgfSxcbiAgICAgICAgeyByb2xlOiAnZm9yY2VSZWxvYWQnIH0sXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcbiAgICAgICAgeyByb2xlOiAncmVzZXRab29tJyB9LFxuICAgICAgICB7IHJvbGU6ICd6b29tSW4nIH0sXG4gICAgICAgIHsgcm9sZTogJ3pvb21PdXQnIH0sXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcbiAgICAgICAgeyByb2xlOiAndG9nZ2xlZnVsbHNjcmVlbicgfVxuICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgbGFiZWw6ICdXaW5kb3cnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7IHJvbGU6ICdtaW5pbWl6ZScgfSxcbiAgICAgICAgeyByb2xlOiAnem9vbScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdmcm9udCcgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICd3aW5kb3cnIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIHJvbGU6ICdoZWxwJyxcbiAgICAgIHN1Ym1lbnU6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxhYmVsOiAnSGVscCcsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdDbWQrSCcsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLmhlbHAgJiYgIXdpbmRvd3MuaGVscC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIHdpbmRvd3MuaGVscC5mb2N1cygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY3JlYXRlV2luZG93KCdoZWxwJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ09wZW4gQXBwbGljYXRpb24gTG9ncycsXG4gICAgICAgICAgY2xpY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgICAgICAgICAgIHNlbmRlcjogd2luZG93cy5tYWluPy53ZWJDb250ZW50c1xuICAgICAgICAgICAgICB9IGFzIEVsZWN0cm9uLklwY01haW5JbnZva2VFdmVudDtcblxuICAgICAgICAgICAgICAvLyBUeXBlIGFzc2VydGlvbiB0byBhY2Nlc3MgaGFuZGxlcnNcbiAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHR5cGVkSXBjTWFpbi5oYW5kbGVycz8uWydnZXQtbG9nLWZpbGUtcGF0aCddO1xuICAgICAgICAgICAgICBpZiAoaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvZ0ZpbGVQYXRoID0gYXdhaXQgaGFuZGxlcihldmVudCk7XG4gICAgICAgICAgICAgICAgaWYgKGxvZ0ZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCBzaGVsbC5vcGVuUGF0aChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdObyBMb2dzIEF2YWlsYWJsZScsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdObyBhcHBsaWNhdGlvbiBsb2dzIHdlcmUgZm91bmQuJ1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2dFcnJvcignRXJyb3Igb3BlbmluZyBhcHBsaWNhdGlvbiBsb2dzJywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXVxuICAgIH1cbiAgXTtcblxuICBjb25zdCBtZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gIE1lbnUuc2V0QXBwbGljYXRpb25NZW51KG1lbnUpO1xufVxuXG5hcHAud2hlblJlYWR5KCkudGhlbihhc3luYyAoKSA9PiB7XG4gIC8vIEluaXRpYWxpemUgbG9nIGZpbGVcbiAgaW5pdExvZ0ZpbGUoKTtcblxuICBsb2dJbmZvKCdBcHBsaWNhdGlvbiByZWFkeSwgaW5pdGlhbGl6aW5nLi4uJyk7XG5cbiAgQUNUSVZFX0xPR19GSUxFID0gZ2V0TG9nRmlsZUxvY2soKTtcbiAgaWYgKEFDVElWRV9MT0dfRklMRSkge1xuICAgIGxvZ0luZm8oYEZvdW5kIGV4aXN0aW5nIGxvZyBmaWxlIGZyb20gbG9jazogJHtBQ1RJVkVfTE9HX0ZJTEV9YCk7XG4gIH1cblxuICBpbml0aWFsaXplSXBjSGFuZGxlcnMoKTtcbiAgY3JlYXRlQXBwTWVudSgpO1xuXG4gIC8vIExvZyBjbGVhbnVwIGNvZGUgcmVtb3ZlZCAtIG5vdyBoYW5kbGVkIGJ5IGxvZyByb3RhdGlvblxuXG4gIC8vIEhhbmRsZSBjcmVhdGUtaW5zdGFuY2UgbWVzc2FnZSBmcm9tIHJlbmRlcmVyXG4gIGlwY01haW4ub24oJ2NyZWF0ZS1pbnN0YW5jZScsIGFzeW5jIChldmVudCwgZGF0YSkgPT4ge1xuICAgIGxvZ0luZm8oJ1tDUkVBVEUtSU5TVEFOQ0VdIFJlY2VpdmVkIGNyZWF0ZS1pbnN0YW5jZSBldmVudCcpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNyZWF0ZVdpdGhUaW1lb3V0ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8YW55PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignSW5zdGFuY2UgY3JlYXRpb24gdGltZWQgb3V0IGFmdGVyIDYwIHNlY29uZHMuIFBsZWFzZSBjaGVjayBEb2NrZXIgc3RhdHVzLicpKTtcbiAgICAgICAgICB9LCA2MDAwMCk7XG5cbiAgICAgICAgICBjb25zdCBleGVjT3BlcmF0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWYgKGRhdGEuaW5zdGFuY2VUeXBlID09PSAncG9zdGdyZXMnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmNyZWF0ZVBvc3RncmVzSW5zdGFuY2UoXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KGRhdGEucG9ydCwgMTApIHx8IDU0MzIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudXNlcm5hbWUgfHwgJ3Bvc3RncmVzJyxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wYXNzd29yZCB8fCAncG9zdGdyZXMnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZWRpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5hZG1pblBhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmRiRmlsdGVyLFxuICAgICAgICAgICAgICAgICAgICBwYXJzZUludChkYXRhLnBvcnQsIDEwKSB8fCA4MDY5LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmN1c3RvbUltYWdlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmN1c3RvbUltYWdlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wb3N0Z3Jlc0luc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnBnVXNlcixcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wZ1Bhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnBnUG9ydFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvciBpbiBleGVjdXRpb24nLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBleGVjT3BlcmF0aW9uKClcbiAgICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNyZWF0ZVdpdGhUaW1lb3V0KCk7XG4gICAgICBsb2dJbmZvKCdbQ1JFQVRFLUlOU1RBTkNFXSBEb2NrZXIgQ29tcG9zZSBvcGVyYXRpb24gY29tcGxldGVkJyk7XG5cbiAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnaW5zdGFuY2UtY3JlYXRlZCcsIHtcbiAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgIHBvcnQ6IHJlc3VsdC5wb3J0LFxuICAgICAgICAgIGluc3RhbmNlVHlwZTogZGF0YS5pbnN0YW5jZVR5cGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHdpbmRvd3MubWFpbiAmJiAhd2luZG93cy5tYWluLmlzRGVzdHJveWVkKCkgJiZcbiAgICAgICAgICAgIGV2ZW50LnNlbmRlciAhPT0gd2luZG93cy5tYWluLndlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgd2luZG93cy5tYWluLndlYkNvbnRlbnRzLnNlbmQoJ2luc3RhbmNlLWNyZWF0ZWQnLCB7XG4gICAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgICAgcG9ydDogcmVzdWx0LnBvcnQsXG4gICAgICAgICAgICBpbnN0YW5jZVR5cGU6IGRhdGEuaW5zdGFuY2VUeXBlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvcicsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2luc3RhbmNlLWNyZWF0aW9uLWVycm9yJywge1xuICAgICAgICAgIGluc3RhbmNlVHlwZTogZGF0YS5pbnN0YW5jZVR5cGUsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yIGR1cmluZyBpbnN0YW5jZSBjcmVhdGlvbidcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvciBoYW5kbGluZyByZXF1ZXN0JywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2luc3RhbmNlLWNyZWF0aW9uLWVycm9yJywge1xuICAgICAgICBpbnN0YW5jZVR5cGU6IGRhdGEuaW5zdGFuY2VUeXBlIHx8ICd1bmtub3duJyxcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3Igb2NjdXJyZWQgZHVyaW5nIGluc3RhbmNlIGNyZWF0aW9uJ1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgdXBkYXRlLXBvc3RncmVzLWNyZWRlbnRpYWxzIG1lc3NhZ2UgZnJvbSByZW5kZXJlclxuICBpcGNNYWluLmhhbmRsZSgndXBkYXRlLXBvc3RncmVzLWNyZWRlbnRpYWxzJywgYXN5bmMgKF9ldmVudCwgZGF0YSkgPT4ge1xuICAgIGxvZ0luZm8oJ1tVUERBVEUtUE9TVEdSRVMtQ1JFREVOVElBTFNdIFJlY2VpdmVkIHVwZGF0ZSByZXF1ZXN0Jyk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaW5zdGFuY2VOYW1lLCB1c2VybmFtZSwgcGFzc3dvcmQgfSA9IGRhdGE7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS51cGRhdGVQb3N0Z3Jlc0NyZWRlbnRpYWxzKGluc3RhbmNlTmFtZSwgdXNlcm5hbWUsIHBhc3N3b3JkKTtcblxuICAgICAgaWYgKHJlc3VsdC51cGRhdGVkSW5zdGFuY2VzICYmIHJlc3VsdC51cGRhdGVkSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbG9nSW5mbyhgW1VQREFURS1QT1NUR1JFUy1DUkVERU5USUFMU10gVXBkYXRlZCAke3Jlc3VsdC51cGRhdGVkSW5zdGFuY2VzLmxlbmd0aH0gZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdbVVBEQVRFLVBPU1RHUkVTLUNSRURFTlRJQUxTXSBFcnJvciB1cGRhdGluZyBjcmVkZW50aWFscycsIGVycm9yKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yIHVwZGF0aW5nIGNyZWRlbnRpYWxzJ1xuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuXG4gIGxvZ0luZm8oJ0NoZWNraW5nIGlmIHNldHVwIGlzIGNvbXBsZXRlZC4uLicpO1xuXG4gIGNvbnN0IHsgY29tcGxldGVkIH0gPSBhd2FpdCBpc1NldHVwQ29tcGxldGVkKCk7XG5cbiAgaWYgKCFjb21wbGV0ZWQpIHtcbiAgICBsb2dJbmZvKCdTZXR1cCBub3QgY29tcGxldGVkLCBzaG93aW5nIHNldHVwIHNjcmVlbi4uLicpO1xuXG4gICAgY29uc3Qgc2V0dXBXaW5kb3cgPSBjcmVhdGVTZXR1cFdpbmRvdygpO1xuXG4gICAgY29uc3QgbWFpbkNvbmZpZyA9IGdldFdpbmRvd0NvbmZpZygnbWFpbicpO1xuICAgIHNldHVwV2luZG93LnNldFNpemUobWFpbkNvbmZpZy53aWR0aCwgbWFpbkNvbmZpZy5oZWlnaHQpO1xuICAgIGlmIChtYWluQ29uZmlnLm1pbldpZHRoICYmIG1haW5Db25maWcubWluSGVpZ2h0KSB7XG4gICAgICBzZXR1cFdpbmRvdy5zZXRNaW5pbXVtU2l6ZShtYWluQ29uZmlnLm1pbldpZHRoLCBtYWluQ29uZmlnLm1pbkhlaWdodCk7XG4gICAgfVxuICAgIHNldHVwV2luZG93LmNlbnRlcigpO1xuICB9XG4gIGVsc2Uge1xuICAgIGxvZ0luZm8oJ05vcm1hbCBzdGFydHVwLCBzaG93aW5nIHNwbGFzaCBzY3JlZW4uLi4nKTtcblxuICAgIGNyZWF0ZVNwbGFzaFdpbmRvdygpO1xuICAgIGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICBpbml0aWFsaXplQXBwKCk7XG5cbiAgICBhcHAuYWRkTGlzdGVuZXIoJ3ZlcmlmaWNhdGlvbi1jb21wbGV0ZScgYXMgYW55LCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdBcHAgZXZlbnQ6IHZlcmlmaWNhdGlvbiBjb21wbGV0ZSBzaWduYWwgcmVjZWl2ZWQnKTtcbiAgICAgIHNob3dNYWluV2luZG93KCk7XG4gICAgfSk7XG5cbiAgICBpcGNNYWluLm9uKCd2ZXJpZmljYXRpb24tY29tcGxldGUnLCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdJUEMgZXZlbnQ6IHZlcmlmaWNhdGlvbiBjb21wbGV0ZSBzaWduYWwgcmVjZWl2ZWQnKTtcbiAgICAgIHNob3dNYWluV2luZG93KCk7XG4gICAgfSk7XG4gIH1cblxuICBpcGNNYWluLm9uKCdzeW5jLXRoZW1lJywgKF9ldmVudCwgeyBtb2RlLCBzb3VyY2UgfSkgPT4ge1xuICAgIGlmIChnbG9iYWwudGhlbWVVcGRhdGVJblByb2dyZXNzKSB7XG4gICAgICBsb2dJbmZvKGBJZ25vcmluZyB0aGVtZSBzeW5jIGR1cmluZyB1cGRhdGU6ICR7bW9kZX0gZnJvbSAke3NvdXJjZSB8fCAndW5rbm93bid9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcyA9IHRydWU7XG5cbiAgICBsb2dJbmZvKGBTeW5jaW5nIHRoZW1lIHRvIGFsbCB3aW5kb3dzOiAke21vZGV9IGZyb20gJHtzb3VyY2UgfHwgJ3Vua25vd24nfWApO1xuXG4gICAgaWYgKGdsb2JhbC5jdXJyZW50VGhlbWVNb2RlICE9PSBtb2RlKSB7XG4gICAgICBnbG9iYWwuY3VycmVudFRoZW1lTW9kZSA9IG1vZGU7XG5cbiAgICAgIEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpLmZvckVhY2god2luZG93ID0+IHtcbiAgICAgICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgIGlmIChzb3VyY2UgJiYgd2luZG93LndlYkNvbnRlbnRzLmlkID09PSBwYXJzZUludChzb3VyY2UpKSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBTa2lwcGluZyB0aGVtZSB1cGRhdGUgdG8gc291cmNlIHdpbmRvdzogJHtzb3VyY2V9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCd0aGVtZS1jaGFuZ2VkJywgbW9kZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nSW5mbyhgVGhlbWUgYWxyZWFkeSBzZXQgdG8gJHttb2RlfSwgbm8gYnJvYWRjYXN0IG5lZWRlZGApO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuICAgIH0sIDUwMCk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBvcGVuLWZpbGUgbWVzc2FnZSBmcm9tIHJlbmRlcmVyXG4gIGlwY01haW4ub24oJ29wZW4tZmlsZScsIChldmVudCwgeyBpbnN0YW5jZU5hbWUsIGluc3RhbmNlVHlwZSwgZmlsZVBhdGggfSkgPT4ge1xuICAgIGxvZ0luZm8oYE9wZW5pbmcgZmlsZSBmb3IgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfSwgZmlsZTogJHtmaWxlUGF0aH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4od29ya0RpclBhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lLCBmaWxlUGF0aCk7XG5cbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICBzaGVsbC5vcGVuUGF0aChmdWxsUGF0aCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICBsb2dFcnJvcignRXJyb3Igb3BlbmluZyBmaWxlJywgZXJyKTtcbiAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBDb3VsZCBub3Qgb3BlbiBmaWxlOiAke2Vyci5tZXNzYWdlfWBcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMod29ya0RpckZpbGVQYXRoKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0ZjgnKSk7XG4gICAgICAgICAgICBjb25zdCBhbHRlcm5hdGl2ZVBhdGggPSBwYXRoLmpvaW4od29ya0RpckRhdGEud29ya0RpciwgaW5zdGFuY2VUeXBlLCBpbnN0YW5jZU5hbWUsIGZpbGVQYXRoKTtcblxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRpdmVQYXRoKSkge1xuICAgICAgICAgICAgICBzaGVsbC5vcGVuUGF0aChhbHRlcm5hdGl2ZVBhdGgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIG9wZW5pbmcgZmlsZScsIGVycik7XG4gICAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZmlsZTogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgIHRpdGxlOiAnRmlsZSBOb3QgRm91bmQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBGaWxlIGRvZXMgbm90IGV4aXN0OiAke2ZpbGVQYXRofWBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBwYXJzaW5nIHdvcmtkaXIuanNvbicsIGVycm9yKTtcbiAgICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb3VsZCBub3QgZGV0ZXJtaW5lIHdvcmsgZGlyZWN0b3J5IHBhdGgnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGhhbmRsaW5nIG9wZW4gZmlsZSByZXF1ZXN0JywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZpbGU6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQWRkIGhhbmRsZXIgZm9yIHVwZGF0aW5nIERCIGZpbHRlclxuICBpcGNNYWluLmhhbmRsZSgndXBkYXRlLW9kb28tY29uZmlnJywgYXN5bmMgKF9ldmVudCwgeyBpbnN0YW5jZU5hbWUsIGRiRmlsdGVyIH0pID0+IHtcbiAgICBsb2dJbmZvKGBVcGRhdGluZyBEQiBmaWx0ZXIgZm9yIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX0sIHZhbHVlOiAke2RiRmlsdGVyfWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtEaXJQYXRoID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmdldFdvcmtEaXJQYXRoKCkgfHwgYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyk7XG4gICAgICBjb25zdCBpbnN0YW5jZURpciA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ29kb28nLCBpbnN0YW5jZU5hbWUpO1xuICAgICAgY29uc3QgY29uZmlnRmlsZSA9IHBhdGguam9pbihpbnN0YW5jZURpciwgJ2NvbmZpZycsICdvZG9vLmNvbmYnKTtcblxuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZ0ZpbGUpKSB7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQ29uZmlnIGZpbGUgbm90IGZvdW5kJyB9O1xuICAgICAgfVxuXG4gICAgICBsZXQgY29uZmlnQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhjb25maWdGaWxlLCAndXRmOCcpO1xuXG4gICAgICBpZiAoZGJGaWx0ZXIpIHtcbiAgICAgICAgaWYgKGNvbmZpZ0NvbnRlbnQuaW5jbHVkZXMoJ2RiZmlsdGVyID0nKSkge1xuICAgICAgICAgIGNvbmZpZ0NvbnRlbnQgPSBjb25maWdDb250ZW50LnJlcGxhY2UoL2RiZmlsdGVyID0uKlxcbi8sIGBkYmZpbHRlciA9IF4ke2luc3RhbmNlTmFtZX0uKiRcXG5gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25maWdDb250ZW50ICs9IGBcXG5kYmZpbHRlciA9IF4ke2luc3RhbmNlTmFtZX0uKiRgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWdDb250ZW50ID0gY29uZmlnQ29udGVudC5yZXBsYWNlKC9kYmZpbHRlciA9LipcXG4vLCAnJyk7XG4gICAgICB9XG5cbiAgICAgIGZzLndyaXRlRmlsZVN5bmMoY29uZmlnRmlsZSwgY29uZmlnQ29udGVudCwgJ3V0ZjgnKTtcblxuICAgICAgY29uc3QgaW5mb0ZpbGUgPSBwYXRoLmpvaW4oaW5zdGFuY2VEaXIsICdpbnN0YW5jZS1pbmZvLmpzb24nKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGluZm9GaWxlKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGluZm9Db250ZW50ID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoaW5mb0ZpbGUsICd1dGY4JykpO1xuICAgICAgICAgIGluZm9Db250ZW50LmRiRmlsdGVyID0gZGJGaWx0ZXI7XG4gICAgICAgICAgaW5mb0NvbnRlbnQudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5mb0ZpbGUsIEpTT04uc3RyaW5naWZ5KGluZm9Db250ZW50LCBudWxsLCAyKSwgJ3V0ZjgnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBsb2dFcnJvcignRXJyb3IgdXBkYXRpbmcgaW5zdGFuY2UgaW5mbycsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnREIgZmlsdGVyIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgdXBkYXRpbmcgREIgZmlsdGVyJywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBFcnJvciB1cGRhdGluZyBEQiBmaWx0ZXI6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLm9uKCdvcGVuLWluc3RhbmNlLWZvbGRlcicsIChldmVudCwgeyBpbnN0YW5jZU5hbWUsIGluc3RhbmNlVHlwZSB9KSA9PiB7XG4gICAgbG9nSW5mbyhgT3BlbmluZyAke2luc3RhbmNlVHlwZX0gZm9sZGVyIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJykpO1xuICAgICAgY29uc3QgaW5zdGFuY2VQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCBpbnN0YW5jZVR5cGUsIGluc3RhbmNlTmFtZSk7XG5cbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGluc3RhbmNlUGF0aCkpIHtcbiAgICAgICAgc2hlbGwub3BlblBhdGgoaW5zdGFuY2VQYXRoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBvcGVuaW5nICR7aW5zdGFuY2VUeXBlfSBmb2xkZXJgLCBlcnIpO1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZvbGRlcjogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpLCAnd29ya2Rpci5qc29uJyk7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGY4JykpO1xuICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRpdmVQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJEYXRhLndvcmtEaXIsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRpdmVQYXRoKSkge1xuICAgICAgICAgICAgICBzaGVsbC5vcGVuUGF0aChhbHRlcm5hdGl2ZVBhdGgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIG9wZW5pbmcgYWx0ZXJuYXRpdmUgJHtpbnN0YW5jZVR5cGV9IGZvbGRlcmAsIGVycik7XG4gICAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZm9sZGVyOiAke2Vyci5tZXNzYWdlfWBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6ICdGb2xkZXIgTm90IEZvdW5kJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSW5zdGFuY2UgZm9sZGVyIGRvZXMgbm90IGV4aXN0OiAke2luc3RhbmNlTmFtZX1gXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24nLCBlcnJvcik7XG4gICAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgICBtZXNzYWdlOiAnQ291bGQgbm90IGRldGVybWluZSB3b3JrIGRpcmVjdG9yeSBwYXRoJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgIHRpdGxlOiAnRm9sZGVyIE5vdCBGb3VuZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgSW5zdGFuY2UgZm9sZGVyIGRvZXMgbm90IGV4aXN0OiAke2luc3RhbmNlTmFtZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGhhbmRsaW5nIG9wZW4gZm9sZGVyIHJlcXVlc3QnLCBlcnJvcik7XG4gICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZm9sZGVyOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKCdnZXQtY3VycmVudC10aGVtZScsIChfZXZlbnQpID0+IHtcbiAgICBsb2dJbmZvKGBDdXJyZW50IHRoZW1lIHJlcXVlc3RlZCwgcmV0dXJuaW5nOiAke2dsb2JhbC5jdXJyZW50VGhlbWVNb2RlIHx8ICdudWxsJ31gKTtcbiAgICByZXR1cm4gZ2xvYmFsLmN1cnJlbnRUaGVtZU1vZGU7XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKCdnZXQtd2luZG93LWlkJywgKGV2ZW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdlYkNvbnRlbnRzID0gZXZlbnQuc2VuZGVyO1xuICAgICAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5mcm9tV2ViQ29udGVudHMod2ViQ29udGVudHMpO1xuICAgICAgaWYgKHdpbikge1xuICAgICAgICBjb25zdCBpZCA9IHdpbi5pZDtcbiAgICAgICAgbG9nSW5mbyhgV2luZG93IElEIHJlcXVlc3RlZDogJHtpZH1gKTtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfVxuICAgICAgbG9nRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdyBmcm9tIHdlYkNvbnRlbnRzJyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgd2luZG93IElEJywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9KTtcblxuICAvLyBHbG9iYWwgbGFuZ3VhZ2Ugc3RvcmFnZVxuICBsZXQgY3VycmVudExhbmd1YWdlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAvLyBIYW5kbGUgbGFuZ3VhZ2UgY2hhbmdlIHN5bmNcbiAgaXBjTWFpbi5vbignbGFuZ3VhZ2UtY2hhbmdlZCcsIChfZXZlbnQsIHsgbGFuZ3VhZ2UgfSkgPT4ge1xuICAgIGxvZ0luZm8oJ1N5bmNpbmcgbGFuZ3VhZ2UgdG8gYWxsIHdpbmRvd3M6ICcgKyBsYW5ndWFnZSk7XG5cbiAgICBjdXJyZW50TGFuZ3VhZ2UgPSBsYW5ndWFnZTtcblxuICAgIEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpLmZvckVhY2god2luZG93ID0+IHtcbiAgICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xhbmd1YWdlLWNoYW5nZWQnLCBsYW5ndWFnZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZXIgdG8gZ2V0IGN1cnJlbnQgbGFuZ3VhZ2VcbiAgaXBjTWFpbi5oYW5kbGUoJ2dldC1jdXJyZW50LWxhbmd1YWdlJywgKCkgPT4ge1xuICAgIHJldHVybiBjdXJyZW50TGFuZ3VhZ2U7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSB2ZXJpZmljYXRpb24gZmFpbHVyZXNcbiAgaXBjTWFpbi5vbigndmVyaWZpY2F0aW9uLWZhaWxlZCcsIChfZXZlbnQsIHsgZXJyb3IgfSkgPT4ge1xuICAgIGxvZ0Vycm9yKCdWZXJpZmljYXRpb24gZmFpbGVkJywgZXJyb3IpO1xuICAgIGRpYWxvZy5zaG93RXJyb3JCb3goJ1ZlcmlmaWNhdGlvbiBGYWlsZWQnLCBgRXJyb3I6ICR7ZXJyb3J9YCk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSB3aW5kb3cgY3JlYXRpb24gcmVxdWVzdHMgZnJvbSByZW5kZXJlcnNcbiAgaXBjTWFpbi5vbignb3Blbi13aW5kb3cnLCAoX2V2ZW50LCB7IHR5cGUsIG9wdGlvbnMgfSkgPT4ge1xuICAgIGxvZ0luZm8oYFJlcXVlc3QgdG8gb3BlbiB3aW5kb3c6ICR7dHlwZX1gKTtcbiAgICBjcmVhdGVXaW5kb3codHlwZSwgb3B0aW9ucyk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSB3aW5kb3cgY2xvc2luZyByZXF1ZXN0cyBmcm9tIHJlbmRlcmVyc1xuICBpcGNNYWluLm9uKCdjbG9zZS13aW5kb3cnLCAoX2V2ZW50LCB7IHR5cGUgfSkgPT4ge1xuICAgIGxvZ0luZm8oYFJlcXVlc3QgdG8gY2xvc2Ugd2luZG93OiAke3R5cGV9YCk7XG4gICAgaWYgKHdpbmRvd3NbdHlwZV0gJiYgIXdpbmRvd3NbdHlwZV0/LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgIHdpbmRvd3NbdHlwZV0/LmNsb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgZXhwbGljaXQgd2luZG93IHRpdGxlIHNldHRpbmcgZnJvbSByZW5kZXJlclxuICBpcGNNYWluLm9uKCdzZXQtd2luZG93LXRpdGxlJywgKGV2ZW50LCB0aXRsZSkgPT4ge1xuICAgIGNvbnN0IHdpbiA9IEJyb3dzZXJXaW5kb3cuZnJvbVdlYkNvbnRlbnRzKGV2ZW50LnNlbmRlcik7XG4gICAgaWYgKHdpbikge1xuICAgICAgd2luLnNldFRpdGxlKHRpdGxlKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBtZXNzYWdlIGRpYWxvZyByZXF1ZXN0c1xuICBpcGNNYWluLmhhbmRsZSgnc2hvdy1tZXNzYWdlLWRpYWxvZycsIGFzeW5jIChldmVudCwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveChvcHRpb25zKTtcbiAgICBldmVudC5zZW5kZXIuc2VuZCgnZGlhbG9nLXJlc3BvbnNlJywgcmVzdWx0LnJlc3BvbnNlKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9KTtcblxuICAvLyBIYW5kbGUgb3BlbiBmaWxlIGRpYWxvZyByZXF1ZXN0c1xuICBpcGNNYWluLmhhbmRsZSgnc2hvdy1vcGVuLWRpYWxvZycsIGFzeW5jIChfZXZlbnQsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dPcGVuRGlhbG9nKG9wdGlvbnMpO1xuICB9KTtcblxuICAvLyBIYW5kbGUgc2F2ZSBmaWxlIGRpYWxvZyByZXF1ZXN0c1xuICBpcGNNYWluLmhhbmRsZSgnc2hvdy1zYXZlLWRpYWxvZycsIGFzeW5jIChfZXZlbnQsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dTYXZlRGlhbG9nKG9wdGlvbnMpO1xuICB9KTtcblxuICAvLyBUaGlzIGhhbmRsZXIgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgc2V0dXAgd2luZG93IHNpZ25hbHMgaXQncyBhYm91dCB0byBjbG9zZSBpdHNlbGZcbiAgaXBjTWFpbi5vbignc2V0dXAtd2luZG93LWNsb3NpbmcnLCAoKSA9PiB7XG4gICAgbG9nSW5mbygnW1NFVFVQLUNMT1NFXSBSZWNlaXZlZCBzZXR1cC13aW5kb3ctY2xvc2luZyBzaWduYWwnKTtcbiAgICBnbG9iYWwuY29taW5nRnJvbVNldHVwID0gdHJ1ZTtcbiAgfSk7XG5cbiAgLy8gTWVzc2FnZSB0byByZXNpemUgYW5kIHByZXBhcmUgdGhlIHdpbmRvdyBmb3IgbWFpbiBzY3JlZW5cbiAgaXBjTWFpbi5vbigncHJlcGFyZS1mb3ItbWFpbi1zY3JlZW4nLCAoKSA9PiB7XG4gICAgbG9nSW5mbygnPT09PT09PSBQUkVQQVJJTkcgRk9SIE1BSU4gU0NSRUVOID09PT09PT0nKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjdXJyZW50V2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICBpZiAoIWN1cnJlbnRXaW5kb3cpIHtcbiAgICAgICAgbG9nRXJyb3IoJ05vIGZvY3VzZWQgd2luZG93IGZvdW5kIScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1haW5Db25maWcgPSBnZXRXaW5kb3dDb25maWcoJ21haW4nKTtcblxuICAgICAgY3VycmVudFdpbmRvdy5zZXRTaXplKG1haW5Db25maWcud2lkdGgsIG1haW5Db25maWcuaGVpZ2h0KTtcblxuICAgICAgaWYgKG1haW5Db25maWcubWluV2lkdGggJiYgbWFpbkNvbmZpZy5taW5IZWlnaHQpIHtcbiAgICAgICAgY3VycmVudFdpbmRvdy5zZXRNaW5pbXVtU2l6ZShtYWluQ29uZmlnLm1pbldpZHRoLCBtYWluQ29uZmlnLm1pbkhlaWdodCk7XG4gICAgICB9XG5cbiAgICAgIGN1cnJlbnRXaW5kb3cuc2V0UmVzaXphYmxlKG1haW5Db25maWcucmVzaXphYmxlKTtcbiAgICAgIGN1cnJlbnRXaW5kb3cuc2V0VGl0bGUobWFpbkNvbmZpZy50aXRsZSk7XG4gICAgICBjdXJyZW50V2luZG93LmNlbnRlcigpO1xuXG4gICAgICBsb2dJbmZvKCdXaW5kb3cgcHJlcGFyZWQgZm9yIG1haW4gc2NyZWVuJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBwcmVwYXJpbmcgd2luZG93IGZvciBtYWluIHNjcmVlbicsIGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBnZXQtbG9ncyBtZXNzYWdlIGZyb20gcmVuZGVyZXIgd2l0aCBESVJFQ1QgbWV0aG9kIGNhbGwgcmF0aGVyIHRoYW4gaW52b2tlXG4gIGlwY01haW4ub24oJ2dldC1sb2dzJywgYXN5bmMgKGV2ZW50LCB7IGluc3RhbmNlTmFtZSwgdGltZUZpbHRlciwgdGFpbCB9KSA9PiB7XG4gICAgbG9nSW5mbyhgR2V0dGluZyBsb2dzIGZvciAke2luc3RhbmNlTmFtZX0sIHRpbWVGaWx0ZXI6ICR7dGltZUZpbHRlcn0sIHRhaWw6ICR7dGFpbH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBsZXQgc2luY2VQYXJhbSA9ICcnO1xuICAgICAgc3dpdGNoICh0aW1lRmlsdGVyKSB7XG4gICAgICAgIGNhc2UgJ2xhc3RfaG91cic6XG4gICAgICAgICAgc2luY2VQYXJhbSA9ICctLXNpbmNlPTFoJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbGFzdF8yX2hvdXJzJzpcbiAgICAgICAgICBzaW5jZVBhcmFtID0gJy0tc2luY2U9MmgnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdsYXN0XzZfaG91cnMnOlxuICAgICAgICAgIHNpbmNlUGFyYW0gPSAnLS1zaW5jZT02aCc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgc2luY2VQYXJhbSA9ICcnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjbWQgPSB0aW1lRmlsdGVyID09PSAnYWxsJ1xuICAgICAgICAgID8gYGRvY2tlciBsb2dzIC0tdGFpbD0ke3RhaWx9ICR7aW5zdGFuY2VOYW1lfWBcbiAgICAgICAgICA6IGBkb2NrZXIgbG9ncyAke3NpbmNlUGFyYW19ICR7aW5zdGFuY2VOYW1lfWA7XG5cbiAgICAgIGNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcbiAgICAgIGNvbnN0IGRvY2tlclByb2Nlc3MgPSBzcGF3bihjbWQsIFtdLCB7IHNoZWxsOiB0cnVlIH0pO1xuXG4gICAgICBsZXQgbG9ncyA9ICcnO1xuICAgICAgbGV0IGVycm9yID0gJyc7XG4gICAgICBsZXQgdGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcblxuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBkb2NrZXJQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZTogJ1RpbWVvdXQgd2FpdGluZyBmb3IgbG9ncy4gVGhlIGNvbnRhaW5lciBtaWdodCBub3QgaGF2ZSBhbnkgbG9ncy4nXG4gICAgICAgIH0pO1xuICAgICAgfSwgMTAwMDApO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBsb2dzICs9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgZXJyb3IgKz0gZGF0YS50b1N0cmluZygpO1xuICAgICAgfSk7XG5cbiAgICAgIGRvY2tlclByb2Nlc3Mub24oJ2Nsb3NlJywgKGNvZGU6IG51bWJlcikgPT4ge1xuICAgICAgICBpZiAodGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgbG9nczogbG9nc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdsb2dzLXJlc3BvbnNlJywge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvciB8fCBgUHJvY2VzcyBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLm9uKCdlcnJvcicsIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGV4ZWN1dGluZyBkb2NrZXIgbG9ncyBjb21tYW5kJywgZXJyKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZTogYEVycm9yIGV4ZWN1dGluZyBkb2NrZXIgbG9ncyBjb21tYW5kOiAke2Vyci5tZXNzYWdlfWBcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgZ2V0dGluZyBsb2dzJywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBgRXJyb3IgZ2V0dGluZyBsb2dzOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIERlYnVnZ2luZyAtIHNob3cgYWxsIHdpbmRvd3MgYWZ0ZXIgYSB0aW1lb3V0IGlmIHN0aWxsIGluIHNwbGFzaFxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNWaXNpYmxlKCkgJiYgd2luZG93cy5zcGxhc2ggJiYgd2luZG93cy5zcGxhc2guaXNWaXNpYmxlKCkpIHtcbiAgICAgIGxvZ0luZm8oJ0RFQlVHOiBGb3JjaW5nIG1haW4gd2luZG93IHRvIHNob3cgYWZ0ZXIgdGltZW91dCcpO1xuICAgICAgc2hvd01haW5XaW5kb3coKTtcbiAgICB9XG4gIH0sIDEwMDAwKTtcbn0pO1xuXG4vLyBRdWl0IGFwcGxpY2F0aW9uIHdoZW4gYWxsIHdpbmRvd3MgYXJlIGNsb3NlZCAoZXhjZXB0IG9uIG1hY09TKVxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHtcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdkYXJ3aW4nKSBhcHAucXVpdCgpO1xufSk7XG5cbi8vIE9uIG1hY09TLCByZWNyZWF0ZSBhcHBsaWNhdGlvbiB3aW5kb3cgd2hlbiBkb2NrIGljb24gaXMgY2xpY2tlZCBhbmQgbm8gd2luZG93cyBhcmUgYXZhaWxhYmxlXG5hcHAub24oJ2FjdGl2YXRlJywgKCkgPT4ge1xuICBpZiAoQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCkubGVuZ3RoID09PSAwKSB7XG4gICAgbG9nSW5mbygnQXBwIGFjdGl2YXRlZCB3aXRoIG5vIHdpbmRvd3MsIGNyZWF0aW5nIG1haW4gd2luZG93Jyk7XG4gICAgaXNTZXR1cENvbXBsZXRlZCgpLnRoZW4oKHsgY29tcGxldGVkIH0pID0+IHtcbiAgICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjcmVhdGVTZXR1cFdpbmRvdygpO1xuICAgICAgfVxuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBjaGVja2luZyBzZXR1cCBzdGF0dXMgb24gYWN0aXZhdGUnLCBlcnJvcik7XG4gICAgICBjb25zdCBtYWluV2luZG93ID0gY3JlYXRlTWFpbldpbmRvdygpO1xuICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgd2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgIGNvbnN0IHZpc2libGVXaW5kb3dzID0gd2luZG93cy5maWx0ZXIod2luID0+IHdpbi5pc1Zpc2libGUoKSk7XG4gICAgaWYgKHZpc2libGVXaW5kb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZpc2libGVXaW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgfSBlbHNlIGlmICh3aW5kb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgIHdpbmRvd3NbMF0uc2hvdygpO1xuICAgICAgd2luZG93c1swXS5mb2N1cygpO1xuICAgIH1cbiAgfVxufSk7XG5cbi8vIEhhbmRsZSBleHRlcm5hbCBVUkwgb3BlbmluZ1xuaXBjTWFpbi5vbignb3Blbi1leHRlcm5hbC11cmwnLCAoX2V2ZW50LCB1cmwpID0+IHtcbiAgaWYgKHR5cGVvZiB1cmwgPT09ICdzdHJpbmcnKSB7XG4gICAgc2hlbGwub3BlbkV4dGVybmFsKHVybCkuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKGBFcnJvciBvcGVuaW5nIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIEdldCBhcHAgdmVyc2lvblxuaXBjTWFpbi5oYW5kbGUoJ2dldC1hcHAtdmVyc2lvbicsICgpID0+IHtcbiAgcmV0dXJuIGFwcC5nZXRWZXJzaW9uKCk7XG59KTtcblxuLy8gR2V0IGFwcCBwYXRoXG5pcGNNYWluLmhhbmRsZSgnZ2V0LWFwcC1wYXRoJywgKF9ldmVudCwgbmFtZSkgPT4ge1xuICByZXR1cm4gYXBwLmdldFBhdGgobmFtZSBhcyBhbnkgfHwgJ3VzZXJEYXRhJyk7XG59KTtcblxuLyoqXG4gKiBGZXRjaCBHaXRIdWIgcmVsZWFzZXMgZm9yIHRoZSBhcHBsaWNhdGlvblxuICogVXNlZCBmb3IgdGhlIG1hbnVhbCB1cGRhdGUgY2hlY2tpbmcgc3lzdGVtXG4gKi9cbmlwY01haW4uaGFuZGxlKCdmZXRjaC1naXRodWItcmVsZWFzZXMnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgbG9nSW5mbygnRmV0Y2hpbmcgR2l0SHViIHJlbGVhc2VzIGZvciB1cGRhdGUgY2hlY2snKTtcbiAgICBcbiAgICAvLyBHaXRIdWIgQVBJIGVuZHBvaW50IC0gcmVwbGFjZSB3aXRoIHlvdXIgYWN0dWFsIHJlcG9zaXRvcnkgaW5mb1xuICAgIC8vIFRoaXMgaXMgYSBwbGFjZWhvbGRlciAtIHJlcGxhY2Ugd2l0aCB5b3VyIGFjdHVhbCBHaXRIdWIgcmVwb3NpdG9yeVxuICAgIGNvbnN0IGFwaVVybCA9ICdodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL2RhbmllbG1lZGVyb3MyNDI0L29kb28tbWFuYWdlci9yZWxlYXNlcyc7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHJlcXVlc3RcbiAgICBjb25zdCByZXF1ZXN0ID0gbmV0LnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHVybDogYXBpVXJsLFxuICAgICAgcmVkaXJlY3Q6ICdmb2xsb3cnXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2V0IGhlYWRlcnNcbiAgICByZXF1ZXN0LnNldEhlYWRlcignVXNlci1BZ2VudCcsIGBPZG9vLU1hbmFnZXIvJHthcHAuZ2V0VmVyc2lvbigpfWApO1xuICAgIFxuICAgIC8vIENyZWF0ZSBwcm9taXNlIHRvIGhhbmRsZSByZXNwb25zZVxuICAgIGNvbnN0IHJlc3BvbnNlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZXNwb25zZURhdGEgPSAnJztcbiAgICAgIFxuICAgICAgcmVxdWVzdC5vbigncmVzcG9uc2UnLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgcmVzcG9uc2Uub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICByZXNwb25zZURhdGEgKz0gY2h1bmsudG9TdHJpbmcoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXNwb25zZS5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbGVhc2VzID0gSlNPTi5wYXJzZShyZXNwb25zZURhdGEpO1xuICAgICAgICAgICAgICAvLyBHZXQgbGF0ZXN0IG5vbi1kcmFmdCByZWxlYXNlXG4gICAgICAgICAgICAgIGNvbnN0IGxhdGVzdFJlbGVhc2UgPSByZWxlYXNlcy5maW5kKChyZWxlYXNlOiBhbnkpID0+ICFyZWxlYXNlLmRyYWZ0KTtcbiAgICAgICAgICAgICAgaWYgKGxhdGVzdFJlbGVhc2UpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCBsYXRlc3QgR2l0SHViIHJlbGVhc2U6ICR7bGF0ZXN0UmVsZWFzZS50YWdfbmFtZX1gKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGxhdGVzdFJlbGVhc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdObyB2YWxpZCByZWxlYXNlcyBmb3VuZCcpO1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05vIHZhbGlkIHJlbGVhc2VzIGZvdW5kJykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyBHaXRIdWIgQVBJIHJlc3BvbnNlJywgZXJyb3IpO1xuICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgR2l0SHViIEFQSSByZXR1cm5lZCBzdGF0dXMgY29kZSAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9YCk7XG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBHaXRIdWIgQVBJIHJldHVybmVkIHN0YXR1cyBjb2RlICR7cmVzcG9uc2Uuc3RhdHVzQ29kZX1gKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAgICBsb2dFcnJvcignRXJyb3IgZmV0Y2hpbmcgR2l0SHViIHJlbGVhc2VzJywgZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFNldCB0aW1lb3V0ICgxMCBzZWNvbmRzKVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1JlcXVlc3QgdGltZWQgb3V0IGFmdGVyIDEwIHNlY29uZHMnKSk7XG4gICAgICB9LCAxMDAwMCk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2VuZCByZXF1ZXN0XG4gICAgcmVxdWVzdC5lbmQoKTtcbiAgICBcbiAgICByZXR1cm4gYXdhaXQgcmVzcG9uc2VQcm9taXNlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBmZXRjaC1naXRodWItcmVsZWFzZXMgaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8qKlxuICogU2hvdyBzeXN0ZW0gbm90aWZpY2F0aW9uIGZvciBuZXcgdXBkYXRlc1xuICovXG5pcGNNYWluLm9uKCdzaG93LXVwZGF0ZS1ub3RpZmljYXRpb24nLCAoX2V2ZW50LCB7IHRpdGxlLCBib2R5IH0pID0+IHtcbiAgdHJ5IHtcbiAgICAvLyBPbmx5IHByb2NlZWQgaWYgd2UncmUgbm90IG9uIExpbnV4IGFzIHNvbWUgTGludXggZGlzdHJvcyBkb24ndCBzdXBwb3J0IG5vdGlmaWNhdGlvbnMgd2VsbFxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBsb2dJbmZvKCdTa2lwcGluZyB1cGRhdGUgbm90aWZpY2F0aW9uIG9uIExpbnV4IHBsYXRmb3JtJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGxvZ0luZm8oYFNob3dpbmcgdXBkYXRlIG5vdGlmaWNhdGlvbjogJHt0aXRsZX1gKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgbm90aWZpY2F0aW9uXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uID0gbmV3IE5vdGlmaWNhdGlvbih7XG4gICAgICB0aXRsZTogdGl0bGUgfHwgJ1VwZGF0ZSBBdmFpbGFibGUnLFxuICAgICAgYm9keTogYm9keSB8fCAnQSBuZXcgdmVyc2lvbiBvZiBPZG9vIE1hbmFnZXIgaXMgYXZhaWxhYmxlLicsXG4gICAgICBzaWxlbnQ6IGZhbHNlXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2hvdyBub3RpZmljYXRpb25cbiAgICBub3RpZmljYXRpb24uc2hvdygpO1xuICAgIFxuICAgIC8vIEhhbmRsZSBjbGlja1xuICAgIG5vdGlmaWNhdGlvbi5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdVcGRhdGUgbm90aWZpY2F0aW9uIGNsaWNrZWQnKTtcbiAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvd3MubWFpbi53ZWJDb250ZW50cy5zZW5kKCdvcGVuLXVwZGF0ZS1zZWN0aW9uJyk7XG4gICAgICAgIGlmICghd2luZG93cy5tYWluLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgd2luZG93cy5tYWluLnNob3coKTtcbiAgICAgICAgfVxuICAgICAgICB3aW5kb3dzLm1haW4uZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3Igc2hvd2luZyB1cGRhdGUgbm90aWZpY2F0aW9uJywgZXJyb3IpO1xuICB9XG59KTtcblxuLy8gVGVzdCBwb3J0IGF2YWlsYWJpbGl0eSB1c2luZyBhIGRpcmVjdCBzb2NrZXQgdGVzdFxuaXBjTWFpbi5oYW5kbGUoJ3Rlc3QtcG9ydC1hdmFpbGFiaWxpdHknLCBhc3luYyAoX2V2ZW50LCBwb3J0KSA9PiB7XG4gIHRyeSB7XG4gICAgbG9nSW5mbyhgVGVzdGluZyBwb3J0ICR7cG9ydH0gYXZhaWxhYmlsaXR5YCk7XG4gICAgY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG4gICAgY29uc3QgdGVzdGVyID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuXG4gICAgY29uc3QgaXNBdmFpbGFibGUgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGVzdGVyLm9uY2UoJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgcmVzb2x2ZShmYWxzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nRXJyb3IoYFBvcnQgdGVzdCBlbmNvdW50ZXJlZCBhbiBlcnJvcjogJHtlcnIubWVzc2FnZX1gLCBlcnIpO1xuICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGVzdGVyLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHtcbiAgICAgICAgdGVzdGVyLmNsb3NlKCgpID0+IHJlc29sdmUodHJ1ZSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHRlc3Rlci5saXN0ZW4ocG9ydCwgJzAuMC4wLjAnKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBpc0F2YWlsYWJsZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihgRXJyb3IgdGVzdGluZyBwb3J0IGF2YWlsYWJpbGl0eWAsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG4vLyBSZXN0YXJ0IGFwcFxuaXBjTWFpbi5vbigncmVzdGFydC1hcHAnLCAoKSA9PiB7XG4gIGFwcC5yZWxhdW5jaCgpO1xuICBhcHAuZXhpdCgpO1xufSk7XG5cbi8vIFF1aXQgYXBwXG5pcGNNYWluLm9uKCdxdWl0LWFwcCcsICgpID0+IHtcbiAgYXBwLnF1aXQoKTtcbn0pO1xuXG4vLyBDaGVjayBpZiBhdXRvIHVwZGF0ZSBpcyBlbmFibGVkIGluIHNldHRpbmdzXG5pcGNNYWluLmhhbmRsZSgnZ2V0LWF1dG8tdXBkYXRlLWVuYWJsZWQnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgd29ya0RpclBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICd3b3JrZGlyLmpzb24nKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya0RpclBhdGgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyUGF0aCwgJ3V0ZjgnKSk7XG4gICAgY29uc3Qgd29ya0RpciA9IHdvcmtEaXJEYXRhLndvcmtEaXI7XG5cbiAgICBpZiAoIXdvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMod29ya0RpcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpciwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmOCcpKTtcbiAgICByZXR1cm4gc2V0dGluZ3MuYXV0b0NoZWNrVXBkYXRlcyA9PT0gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgYXV0byB1cGRhdGUgc2V0dGluZycsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pOyJdLCJuYW1lcyI6WyJsb2dFcnJvciIsImxvZ0luZm8iLCJMT0dfRklMRV9TSVpFX0xJTUlUIiwiTUFYX0xPR19GSUxFUyIsIkxvZ0xldmVsIiwibmV0IiwiZXJyb3IiLCJsb2dGaWxlUGF0aCIsIndpbmRvdyIsIndpbmRvd3MiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFzQkEsTUFBTSxrQkFBNEI7QUFBQSxFQUM5QixPQUFPO0FBQUEsRUFDUCxVQUFVO0FBQUEsRUFDVixTQUFTO0FBQUEsRUFDVCxtQkFBbUI7QUFBQSxFQUNuQixrQkFBa0I7QUFBQSxFQUNsQixzQkFBc0I7QUFBQSxFQUN0Qix5QkFBeUI7QUFBQSxFQUN6QixpQkFBaUI7QUFBQSxFQUNqQixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsRUFDbEMsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUN0QztBQUVBLE1BQU0sZ0JBQWdCO0FBQUEsRUFHbEIsY0FBYztBQUZOO0FBSUosU0FBSyxrQkFBa0IsS0FBSyxLQUFLLGVBQUEsR0FBa0IsY0FBYztBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT3JFLE1BQU0sbUJBQXFDO0FBQ25DLFFBQUE7QUFDTSxZQUFBLGNBQWMsTUFBTSxLQUFLLGVBQWU7QUFDOUMsVUFBSSxDQUFDLGFBQWE7QUFDUCxlQUFBO0FBQUEsTUFBQTtBQUdYLFlBQU0sZUFBZSxLQUFLLEtBQUssYUFBYSxlQUFlO0FBQzNELFVBQUksQ0FBQyxHQUFHLFdBQVcsWUFBWSxHQUFHO0FBQ3ZCLGVBQUE7QUFBQSxNQUFBO0FBSUosYUFBQTtBQUFBLGFBQ0YsT0FBTztBQUNaQSxpQkFBUyx3Q0FBd0MsS0FBSztBQUMvQyxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT0osTUFBTSxpQkFBeUM7QUFDdkMsUUFBQTtBQUNBLFVBQUksQ0FBQyxHQUFHLFdBQVcsS0FBSyxlQUFlLEdBQUc7QUFDL0IsZUFBQTtBQUFBLE1BQUE7QUFHTCxZQUFBLE9BQU8sS0FBSyxNQUFNLEdB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
