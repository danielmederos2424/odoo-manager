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
      const logsPath = getLogsPath(workDirPath || void 0);
      console.log(`Logs directory: ${logsPath}`);
      this.logFile = path__namespace.join(logsPath, "app.log");
      console.log(`Using main log file at: ${this.logFile}`);
      if (!fs__namespace.existsSync(this.logFile)) {
        const now = /* @__PURE__ */ new Date();
        const initialMessage = `===============================================
Odoo Manager - Application Log (Main Process)
Started: ${this.formatTimestamp(now)}
Environment: ${"production"}
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
Environment: ${"production"}
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
      const logsPath = getLogsPath();
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
function getAppDataPath() {
  const appName = "odoo-manager";
  switch (process.platform) {
    case "win32":
      return path__namespace.join(process.env.APPDATA || "", appName);
    case "darwin":
      return path__namespace.join(os__namespace.homedir(), "Library", "Application Support", appName);
    case "linux":
      return path__namespace.join(os__namespace.homedir(), ".config", appName);
    default:
      return path__namespace.join(os__namespace.homedir(), `.${appName}`);
  }
}
function ensureDir(dirPath) {
  if (!fs__namespace.existsSync(dirPath)) {
    fs__namespace.mkdirSync(dirPath, { recursive: true });
  }
}
function getLogsPath(customWorkDirPath) {
  const basePath = customWorkDirPath || getWorkDirPath() || getAppDataPath();
  const logsPath = path__namespace.join(basePath, "logs");
  ensureDir(logsPath);
  return logsPath;
}
function getWorkDirPath() {
  try {
    const workDirFilePath = path__namespace.join(getAppDataPath(), "workdir.json");
    if (!fs__namespace.existsSync(workDirFilePath)) {
      return null;
    }
    const data = JSON.parse(fs__namespace.readFileSync(workDirFilePath, "utf-8"));
    return data.workDir || null;
  } catch (error) {
    logError$1("Error getting work directory path:", error);
    return null;
  }
}
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
  }
  /**
   * Initialize or update the projects path based on workdir
   */
  async initializeProjectsPath() {
    try {
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
   */
  async checkPortAvailability(port) {
    try {
      logInfo$1(`Testing port ${port} availability`);
      const net = require("net");
      const tester = net.createServer();
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
          const net = require("net");
          const tester = net.createServer();
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
console.log("Node environment:", "production");
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
Environment: ${"production"}
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
Environment: ${"production"}
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
function loadAndShowProdWindow(window2) {
  if (!window2 || window2.isDestroyed()) return;
  const htmlPath = path__namespace.resolve(appDir, "../dist/index.html");
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
  const preloadPath = path__namespace.join(appDir, "preload.js");
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
    setupWindow.loadFile(path__namespace.join(__dirname, "../dist/index.html"), { hash: "setup" }).catch((err) => {
      logError("Failed to load setup file", err);
    });
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
  const preloadPath = path__namespace.join(appDir, "preload.js");
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
      devTools: false
    }
  });
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
    const htmlPath = path__namespace.resolve(appDir, "../dist/index.html");
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
  const preloadPath = path__namespace.join(appDir, "preload.js");
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
  const preloadPath = path__namespace.join(appDir, "preload.js");
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
    window2.loadFile(path__namespace.join(appDir, "../dist/index.html"), { hash: windowType }).catch((err) => {
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
    electron.ipcMain.on("verification-complete", () => {
      logInfo("IPC event: verification complete signal received");
      showMainWindow();
    });
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
  return electron.app.getPath(name || "userData");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3NlcnZpY2VzL3NldHRpbmdzL3NldHRpbmdzU2VydmljZS50cyIsIi4uL3NyYy91dGlscy9lbGVjdHJvbi50cyIsIi4uL3NyYy9zZXJ2aWNlcy91dGlscy9sb2dnZXIudHMiLCIuLi9zcmMvc2VydmljZXMvc3lzdGVtL3BhdGhTZXJ2aWNlLnRzIiwiLi4vc3JjL3NlcnZpY2VzL3N5c3RlbS9kb2NrZXJQYXRoU2VydmljZS50cyIsIi4uL3NyYy9zZXJ2aWNlcy9kb2NrZXIvZG9ja2VyQ29tcG9zZVNlcnZpY2UudHMiLCIuLi9zcmMvc2VydmljZXMvZWxlY3Ryb24vbWFpblByb2Nlc3NTZXJ2aWNlLnRzIiwiLi4vZWxlY3Ryb24vbG9nZ2VyLWxvY2sudHMiLCIuLi9lbGVjdHJvbi9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHNyYy9zZXJ2aWNlcy9zZXR0aW5ncy9zZXR0aW5nc1NlcnZpY2UudHNcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBnZXRBcHBEYXRhUGF0aCwgZW5zdXJlRGlyIH0gZnJvbSAnLi4vc3lzdGVtL3BhdGhTZXJ2aWNlJztcbmltcG9ydCB7IGxvZ0Vycm9yLCBsb2dJbmZvIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuLy8gU2V0dGluZ3MgaW50ZXJmYWNlXG5leHBvcnQgaW50ZXJmYWNlIFNldHRpbmdzIHtcbiAgICB0aGVtZTogJ2xpZ2h0JyB8ICdkYXJrJztcbiAgICBsYW5ndWFnZTogc3RyaW5nO1xuICAgIG5ldHdvcms6IHN0cmluZztcbiAgICBzaG93V2VsY29tZVNjcmVlbjogYm9vbGVhbjtcbiAgICBhdXRvQ2hlY2tVcGRhdGVzOiBib29sZWFuO1xuICAgIHVwZGF0ZUNoZWNrRnJlcXVlbmN5OiAnZGFpbHknIHwgJ3dlZWtseSc7XG4gICAgc2hvd1VwZGF0ZU5vdGlmaWNhdGlvbnM6IGJvb2xlYW47XG4gICAgbGFzdFVwZGF0ZUNoZWNrOiBzdHJpbmcgfCBudWxsO1xuICAgIGNyZWF0ZWRBdDogc3RyaW5nO1xuICAgIHVwZGF0ZWRBdDogc3RyaW5nO1xuICAgIFtrZXk6IHN0cmluZ106IGFueTsgLy8gQWxsb3cgZm9yIGV4dGVuc2lvblxufVxuXG4vLyBEZWZhdWx0IHNldHRpbmdzXG5jb25zdCBkZWZhdWx0U2V0dGluZ3M6IFNldHRpbmdzID0ge1xuICAgIHRoZW1lOiAnZGFyaycsXG4gICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgbmV0d29yazogJ29kb28tbmV0d29yaycsXG4gICAgc2hvd1dlbGNvbWVTY3JlZW46IHRydWUsXG4gICAgYXV0b0NoZWNrVXBkYXRlczogdHJ1ZSxcbiAgICB1cGRhdGVDaGVja0ZyZXF1ZW5jeTogJ2RhaWx5JyxcbiAgICBzaG93VXBkYXRlTm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICBsYXN0VXBkYXRlQ2hlY2s6IG51bGwsXG4gICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbn07XG5cbmNsYXNzIFNldHRpbmdzU2VydmljZSB7XG4gICAgcHJpdmF0ZSB3b3JrRGlyRmlsZVBhdGg6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBQYXRoIHRvIHRoZSBmaWxlIHRoYXQgc3RvcmVzIHRoZSB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gICAgICAgIHRoaXMud29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICd3b3JrZGlyLmpzb24nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBzZXR1cCBoYXMgYmVlbiBjb21wbGV0ZWRcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgaWYgc2V0dXAgaXMgY29tcGxldGVcbiAgICAgKi9cbiAgICBhc3luYyBpc1NldHVwQ29tcGxldGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpclBhdGgsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgd2UgaGF2ZSB2YWxpZCBzZXR0aW5ncy5qc29uIGZpbGUsIGl0IG1lYW5zIHNldHVwIHdhcyBjb21wbGV0ZWRcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGNoZWNraW5nIGlmIHNldHVwIGlzIGNvbXBsZXRlZCcsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29yayBkaXJlY3RvcnkgcGF0aCBmcm9tIGFwcCBkYXRhXG4gICAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gd29yayBkaXJlY3RvcnkgcGF0aCBvciBudWxsIGlmIG5vdCBzZXRcbiAgICAgKi9cbiAgICBhc3luYyBnZXRXb3JrRGlyUGF0aCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLndvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHRoaXMud29ya0RpckZpbGVQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICBpZiAoIWRhdGEud29ya0RpciB8fCAhZnMuZXhpc3RzU3luYyhkYXRhLndvcmtEaXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBkYXRhLndvcmtEaXI7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgZ2V0dGluZyB3b3JrIGRpcmVjdG9yeSBwYXRoJywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTYXZlIHRoZSB3b3JrIGRpcmVjdG9yeSBwYXRoIHRvIGFwcCBkYXRhXG4gICAgICogQHBhcmFtIHdvcmtEaXJQYXRoIFBhdGggdG8gc2F2ZSBhcyB3b3JrIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzXG4gICAgICovXG4gICAgYXN5bmMgc2F2ZVdvcmtEaXJQYXRoKHdvcmtEaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGVuc3VyZURpcihwYXRoLmRpcm5hbWUodGhpcy53b3JrRGlyRmlsZVBhdGgpKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy53b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0Rpcjogd29ya0RpclBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgbG9nSW5mbyhgU2F2ZWQgd29yayBkaXJlY3RvcnkgcGF0aDogJHt3b3JrRGlyUGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHNhdmluZyB3b3JrIGRpcmVjdG9yeSBwYXRoJywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBzZXR0aW5ncyBmcm9tIHRoZSB3b3JrIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIFNldHRpbmdzIG9iamVjdCBvciBudWxsIGlmIG5vdCBmb3VuZFxuICAgICAqL1xuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPFNldHRpbmdzIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBhd2FpdCB0aGlzLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAoIXdvcmtEaXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICBsb2dJbmZvKCdMb2FkZWQgc2V0dGluZ3MgZnJvbSB3b3JrIGRpcmVjdG9yeScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdFNldHRpbmdzLCAuLi5zZXR0aW5ncyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGxvYWRpbmcgc2V0dGluZ3MnLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNhdmUgc2V0dGluZ3MgdG8gdGhlIHdvcmsgZGlyZWN0b3J5XG4gICAgICogQHBhcmFtIHNldHRpbmdzIFNldHRpbmdzIG9iamVjdCB0byBzYXZlXG4gICAgICogQHBhcmFtIHdvcmtEaXJQYXRoIFdvcmsgZGlyZWN0b3J5IHBhdGggd2hlcmUgc2V0dGluZ3Mgc2hvdWxkIGJlIHNhdmVkXG4gICAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3NcbiAgICAgKi9cbiAgICBhc3luYyBzYXZlU2V0dGluZ3Moc2V0dGluZ3M6IFBhcnRpYWw8U2V0dGluZ3M+LCB3b3JrRGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgd29yayBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgICAgICBlbnN1cmVEaXIod29ya0RpclBhdGgpO1xuXG4gICAgICAgICAgICAvLyBNZXJnZSB3aXRoIGRlZmF1bHQgc2V0dGluZ3NcbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZFNldHRpbmdzID0geyAuLi5kZWZhdWx0U2V0dGluZ3MsIC4uLnNldHRpbmdzIH07XG4gICAgICAgICAgICBtZXJnZWRTZXR0aW5ncy51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICAgICAgICAgIC8vIFdyaXRlIHNldHRpbmdzIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCBKU09OLnN0cmluZ2lmeShtZXJnZWRTZXR0aW5ncywgbnVsbCwgMikpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKGBTYXZlZCBzZXR0aW5ncyB0byB3b3JrIGRpcmVjdG9yeTogJHt3b3JrRGlyUGF0aH1gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIHNhdmluZyBzZXR0aW5ncycsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBzZXR0aW5ncyBpbiB0aGUgd29yayBkaXJlY3RvcnlcbiAgICAgKiBAcGFyYW0gdXBkYXRlcyBQYXJ0aWFsIHNldHRpbmdzIG9iamVjdCB3aXRoIHVwZGF0ZXNcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byBib29sZWFuIGluZGljYXRpbmcgc3VjY2Vzc1xuICAgICAqL1xuICAgIGFzeW5jIHVwZGF0ZVNldHRpbmdzKHVwZGF0ZXM6IFBhcnRpYWw8U2V0dGluZ3M+KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgICAgICAgICAgaWYgKCFjdXJyZW50U2V0dGluZ3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHdvcmtEaXJQYXRoID0gYXdhaXQgdGhpcy5nZXRXb3JrRGlyUGF0aCgpO1xuICAgICAgICAgICAgaWYgKCF3b3JrRGlyUGF0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWVyZ2UgdXBkYXRlcyB3aXRoIGN1cnJlbnQgc2V0dGluZ3NcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRTZXR0aW5ncyA9IHtcbiAgICAgICAgICAgICAgICAuLi5jdXJyZW50U2V0dGluZ3MsXG4gICAgICAgICAgICAgICAgLi4udXBkYXRlcyxcbiAgICAgICAgICAgICAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gV3JpdGUgdXBkYXRlZCBzZXR0aW5nc1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCAnc2V0dGluZ3MuanNvbicpO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhzZXR0aW5nc1BhdGgsIEpTT04uc3RyaW5naWZ5KHVwZGF0ZWRTZXR0aW5ncywgbnVsbCwgMikpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKCdVcGRhdGVkIHNldHRpbmdzJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciB1cGRhdGluZyBzZXR0aW5ncycsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8gQ3JlYXRlIGluc3RhbmNlXG5jb25zdCBzZXR0aW5nc1NlcnZpY2UgPSBuZXcgU2V0dGluZ3NTZXJ2aWNlKCk7XG5cbmV4cG9ydCB7IHNldHRpbmdzU2VydmljZSB9O1xuZXhwb3J0IGRlZmF1bHQgc2V0dGluZ3NTZXJ2aWNlOyIsIi8vIHNyYy91dGlscy9lbGVjdHJvbi50c1xuZXhwb3J0IGNvbnN0IGlzRWxlY3Ryb24gPSAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgaWYgd2UncmUgaW4gYSBicm93c2VyIGVudmlyb25tZW50XG4gICAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5wcm9jZXNzICYmIHdpbmRvdy5wcm9jZXNzLnR5cGU7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RWxlY3Ryb25BUEkgPSAoKSA9PiB7XG4gICAgaWYgKGlzRWxlY3Ryb24oKSkge1xuICAgICAgICByZXR1cm4gd2luZG93LnJlcXVpcmUoJ2VsZWN0cm9uJyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcbiIsIi8vIHNyYy9zZXJ2aWNlcy91dGlscy9sb2dnZXIudHNcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBnZXRMb2dzUGF0aCB9IGZyb20gJy4uL3N5c3RlbS9wYXRoU2VydmljZSc7XG5pbXBvcnQgc2V0dGluZ3NTZXJ2aWNlIGZyb20gJy4uL3NldHRpbmdzL3NldHRpbmdzU2VydmljZSc7XG5pbXBvcnQgeyBpc0VsZWN0cm9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvZWxlY3Ryb24nO1xuXG4vLyBHbG9iYWwgZmxhZ3MgdG8gcHJldmVudCBtdWx0aXBsZSBsb2dnZXIgaW5pdGlhbGl6YXRpb25zIGFjcm9zcyBhbGwgaW5zdGFuY2VzXG5sZXQgR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCA9IGZhbHNlO1xubGV0IEFDVElWRV9MT0dfRklMRV9QQVRIOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbmxldCBTRVNTSU9OX0hFQURFUlNfV1JJVFRFTjogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcblxuLy8gTG9nIHJvdGF0aW9uIGNvbmZpZ3VyYXRpb25cbmNvbnN0IExPR19GSUxFX1NJWkVfTElNSVQgPSA1ICogMTAyNCAqIDEwMjQ7IC8vIDUgTUIgaW4gYnl0ZXNcbmNvbnN0IE1BWF9MT0dfRklMRVMgPSA1OyAvLyBNYXhpbXVtIG51bWJlciBvZiByb3RhdGVkIGxvZyBmaWxlcyB0byBrZWVwXG5cbi8vIExvZyBsZXZlbHMgZW51bVxuZW51bSBMb2dMZXZlbCB7XG4gICAgREVCVUcgPSAwLFxuICAgIElORk8gPSAxLFxuICAgIFdBUk4gPSAyLFxuICAgIEVSUk9SID0gM1xufVxuXG4vLyBUeXBlIGRlZmluaXRpb24gZm9yIGxvZyBlbnRyeVxuaW50ZXJmYWNlIExvZ0VudHJ5IHtcbiAgICB0aW1lc3RhbXA6IHN0cmluZztcbiAgICBsZXZlbDogTG9nTGV2ZWw7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGRhdGE/OiBhbnk7XG59XG5cbi8qKlxuICogQXBwbGljYXRpb24gbG9nZ2VyIHdpdGggZmlsZSBhbmQgY29uc29sZSBvdXRwdXRcbiAqL1xuY2xhc3MgTG9nZ2VyIHtcbiAgICBwcml2YXRlIGxvZ0xldmVsOiBMb2dMZXZlbCA9IExvZ0xldmVsLklORk87XG4gICAgcHJpdmF0ZSBsb2dGaWxlOiBzdHJpbmcgPSAnJztcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogTG9nZ2VyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBpbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgd2luZG93SWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIERlZmF1bHQgdG8gSU5GTyBpbiBwcm9kdWN0aW9uLCBERUJVRyBpbiBkZXZlbG9wbWVudFxuICAgICAgICB0aGlzLmxvZ0xldmVsID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgPyBMb2dMZXZlbC5ERUJVRyA6IExvZ0xldmVsLklORk87XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSB3aW5kb3cgSUQgZm9yIHRoaXMgbG9nZ2VyIGluc3RhbmNlXG4gICAgICogQHBhcmFtIGlkIFdpbmRvdyBJRFxuICAgICAqL1xuICAgIHNldFdpbmRvd0lkKGlkOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy53aW5kb3dJZCA9IGlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd2luZG93IElEIGZvciB0aGlzIGxvZ2dlciBpbnN0YW5jZVxuICAgICAqIEByZXR1cm5zIFdpbmRvdyBJRCBvciBudWxsIGlmIG5vdCBzZXRcbiAgICAgKi9cbiAgICBnZXRXaW5kb3dJZCgpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2luZG93SWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmV0Y2ggdGhlIHdpbmRvdyBJRCBmcm9tIHRoZSBtYWluIHByb2Nlc3NcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gd2luZG93IElEIG9yIG51bGxcbiAgICAgKi9cbiAgICBhc3luYyBmZXRjaFdpbmRvd0lkKCk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIWlzRWxlY3Ryb24oKSB8fCB0aGlzLndpbmRvd0lkICE9PSBudWxsKSByZXR1cm4gdGhpcy53aW5kb3dJZDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICBpZiAoaXBjUmVuZGVyZXIgJiYgaXBjUmVuZGVyZXIuaW52b2tlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aW5kb3dJZCA9IGF3YWl0IGlwY1JlbmRlcmVyLmludm9rZSgnZ2V0LXdpbmRvdy1pZCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLndpbmRvd0lkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGdldCB3aW5kb3cgSUQ6JywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIHdpdGggbWFpbiBwcm9jZXNzIGlmIHRoZXJlJ3MgYWxyZWFkeSBhbiBhY3RpdmUgbG9nIGZpbGVcbiAgICAgKiBAcmV0dXJucyBQYXRoIHRvIGV4aXN0aW5nIGxvZyBmaWxlIG9yIG51bGxcbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0RXhpc3RpbmdMb2dGaWxlKCk6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBpZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIEFjY2VzcyBpcGNSZW5kZXJlciBkaXJlY3RseSB3aGVuIGNvbnRleHRJc29sYXRpb24gaXMgZGlzYWJsZWRcbiAgICAgICAgICAgICAgICBjb25zdCBpcGNSZW5kZXJlciA9IHdpbmRvdy5pcGNSZW5kZXJlcjtcbiAgICAgICAgICAgICAgICBpZiAoaXBjUmVuZGVyZXIgJiYgaXBjUmVuZGVyZXIuaW52b2tlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVzZSBhc3luYyBpbnZva2UgaW5zdGVhZCBvZiBzeW5jIGNhbGwgdG8gYXZvaWQgYmxvY2tpbmcgcmVuZGVyZXIgcHJvY2Vzc1xuICAgICAgICAgICAgICAgICAgICAvLyBXZSdsbCBoYW5kbGUgdGhpcyBhc3luY2hyb25vdXNseSBpbiBpbml0aWFsaXplKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGdldCBleGlzdGluZyBsb2cgZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgbG9nIGZpbGUgd2l0aCBtYWluIHByb2Nlc3NcbiAgICAgKiBAcGFyYW0gbG9nRmlsZSBQYXRoIHRvIGxvZyBmaWxlXG4gICAgICovXG4gICAgc3RhdGljIHJlZ2lzdGVyTG9nRmlsZShsb2dGaWxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgaWYgKGlzRWxlY3Ryb24oKSAmJiBsb2dGaWxlICYmIGZzLmV4aXN0c1N5bmMobG9nRmlsZSkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICAgICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLnNlbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgaXBjUmVuZGVyZXIuc2VuZCgncmVnaXN0ZXItbG9nLWZpbGUnLCBsb2dGaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgQUNUSVZFX0xPR19GSUxFX1BBVEggPSBsb2dGaWxlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHJlZ2lzdGVyIGxvZyBmaWxlIHdpdGggbWFpbiBwcm9jZXNzOicsIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFuIHVwIG9sZCBsb2cgZmlsZXMgb2xkZXIgdGhhbiBzcGVjaWZpZWQgZGF5c1xuICAgICAqIFRoaXMgaXMga2VwdCBmb3IgY29tcGF0aWJpbGl0eSBidXQgbm90IGFjdGl2ZWx5IHVzZWQgd2l0aCByb3RhdGlvbi1iYXNlZCBhcHByb2FjaFxuICAgICAqIEBwYXJhbSBkYXlzIE51bWJlciBvZiBkYXlzIHRvIGtlZXAgbG9ncyAoZGVmYXVsdDogNylcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBjbGVhbnVwIGlzIGNvbXBsZXRlXG4gICAgICovXG4gICAgYXN5bmMgY2xlYW51cE9sZExvZ0ZpbGVzKGRheXM6IG51bWJlciA9IDcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCBhbGwgbG9nIGZpbGVzXG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlcyA9IHRoaXMuZ2V0TG9nRmlsZXMoKTtcbiAgICAgICAgICAgIGlmIChsb2dGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDaGVja2luZyBmb3IgbG9nIGZpbGVzIG9sZGVyIHRoYW4gJHtkYXlzfSBkYXlzIHRvIGNsZWFuIHVwYCk7XG5cbiAgICAgICAgICAgIC8vIEN1cnJlbnQgdGltZVxuICAgICAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICAvLyBNYXggYWdlIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICAgICAgY29uc3QgbWF4QWdlID0gZGF5cyAqIDI0ICogNjAgKiA2MCAqIDEwMDA7XG4gICAgICAgICAgICAvLyBUaHJlc2hvbGQgZGF0ZVxuICAgICAgICAgICAgY29uc3QgdGhyZXNob2xkID0gbm93IC0gbWF4QWdlO1xuXG4gICAgICAgICAgICAvLyBGaWx0ZXIgZmlsZXMgb2xkZXIgdGhhbiB0aHJlc2hvbGRcbiAgICAgICAgICAgIGNvbnN0IG9sZEZpbGVzID0gbG9nRmlsZXMuZmlsdGVyKGZpbGUgPT4ge1xuICAgICAgICAgICAgICAgIC8vIERvbid0IGRlbGV0ZSBjdXJyZW50IGxvZyBmaWxlIG9yIGl0cyByb3RhdGlvbnNcbiAgICAgICAgICAgICAgICBpZiAoZmlsZSA9PT0gdGhpcy5sb2dGaWxlIHx8IGZpbGUgPT09IEFDVElWRV9MT0dfRklMRV9QQVRIKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgZGVsZXRlIHJvdGF0ZWQgdmVyc2lvbnMgb2YgdGhlIGFjdGl2ZSBsb2cgZmlsZVxuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VMb2dOYW1lID0gcGF0aC5iYXNlbmFtZSh0aGlzLmxvZ0ZpbGUgfHwgJycsICcubG9nJyk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGguYmFzZW5hbWUoZmlsZSkuc3RhcnRzV2l0aChgJHtiYXNlTG9nTmFtZX0uYCkgJiYgXG4gICAgICAgICAgICAgICAgICAgIHBhdGguYmFzZW5hbWUoZmlsZSkuZW5kc1dpdGgoJy5sb2cnKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXNlIGNyZWF0aW9uIHRpbWUgb3IgbW9kaWZpZWQgdGltZSwgd2hpY2hldmVyIGlzIG9sZGVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVUaW1lID0gTWF0aC5taW4oc3RhdHMuYmlydGh0aW1lTXMsIHN0YXRzLm10aW1lTXMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsZVRpbWUgPCB0aHJlc2hvbGQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGNoZWNraW5nIGZpbGUgYWdlIGZvciAke2ZpbGV9OmAsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gRGVsZXRlIG9sZCBmaWxlc1xuICAgICAgICAgICAgaWYgKG9sZEZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRm91bmQgJHtvbGRGaWxlcy5sZW5ndGh9IGxvZyBmaWxlcyBvbGRlciB0aGFuICR7ZGF5c30gZGF5cyB0byBkZWxldGVgKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBvbGRGaWxlcykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnMudW5saW5rU3luYyhmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBEZWxldGVkIG9sZCBsb2cgZmlsZTogJHtmaWxlfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGRlbGV0aW5nIG9sZCBsb2cgZmlsZSAke2ZpbGV9OmAsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBObyBsb2cgZmlsZXMgb2xkZXIgdGhhbiAke2RheXN9IGRheXMgZm91bmRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBkdXJpbmcgbG9nIGZpbGUgY2xlYW51cDonLCBlcnIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgd2UndmUgYWxyZWFkeSB3cml0dGVuIHNlc3Npb24gaGVhZGVycyBmb3IgdGhlIGN1cnJlbnQgbG9nIGZpbGVcbiAgICAgKiBAcGFyYW0gc2Vzc2lvblR5cGUgVHlwZSBvZiBzZXNzaW9uIGhlYWRlciAoc3RhcnQsIHJlc3VtZSlcbiAgICAgKiBAcmV0dXJucyBUcnVlIGlmIGhlYWRlcnMgYWxyZWFkeSB3cml0dGVuLCBmYWxzZSBvdGhlcndpc2VcbiAgICAgKi9cbiAgICBwcml2YXRlIGlzU2Vzc2lvbkhlYWRlcldyaXR0ZW4oc2Vzc2lvblR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMubG9nRmlsZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBrZXkgPSBgJHt0aGlzLmxvZ0ZpbGV9OiR7c2Vzc2lvblR5cGV9OiR7dGhpcy53aW5kb3dJZCB8fCAndW5rbm93bid9YDtcbiAgICAgICAgcmV0dXJuIFNFU1NJT05fSEVBREVSU19XUklUVEVOW2tleV0gPT09IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBzZXNzaW9uIGhlYWRlcnMgYXMgd3JpdHRlbiBmb3IgdGhlIGN1cnJlbnQgbG9nIGZpbGVcbiAgICAgKiBAcGFyYW0gc2Vzc2lvblR5cGUgVHlwZSBvZiBzZXNzaW9uIGhlYWRlciAoc3RhcnQsIHJlc3VtZSlcbiAgICAgKi9cbiAgICBwcml2YXRlIG1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbihzZXNzaW9uVHlwZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5sb2dGaWxlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGtleSA9IGAke3RoaXMubG9nRmlsZX06JHtzZXNzaW9uVHlwZX06JHt0aGlzLndpbmRvd0lkIHx8ICd1bmtub3duJ31gO1xuICAgICAgICBTRVNTSU9OX0hFQURFUlNfV1JJVFRFTltrZXldID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBsb2dnZXIgd2l0aCBzZXR0aW5nc1xuICAgICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGluaXRpYWxpemF0aW9uIGlzIGNvbXBsZXRlXG4gICAgICovXG4gICAgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gR2V0IHdpbmRvdyBJRCBmaXJzdCBpZiB3ZSdyZSBpbiBFbGVjdHJvblxuICAgICAgICBpZiAoaXNFbGVjdHJvbigpICYmIHRoaXMud2luZG93SWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZmV0Y2hXaW5kb3dJZCgpO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIC8vIENoZWNrIGZvciBnbG9iYWwgaW5pdGlhbGl6YXRpb24gZmxhZyBmaXJzdFxuICAgICAgICBpZiAoR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYExvZ2dlciBhbHJlYWR5IGluaXRpYWxpemVkIGdsb2JhbGx5LCB1c2luZyBleGlzdGluZyBpbnN0YW5jZSAod2luZG93ICR7dGhpcy53aW5kb3dJZH0pYCk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZXJlJ3MgYW4gYWN0aXZlIGxvZyBmaWxlIHBhdGgsIHVzZSBpdFxuICAgICAgICAgICAgaWYgKEFDVElWRV9MT0dfRklMRV9QQVRIICYmIGZzLmV4aXN0c1N5bmMoQUNUSVZFX0xPR19GSUxFX1BBVEgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2dGaWxlID0gQUNUSVZFX0xPR19GSUxFX1BBVEg7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gT25seSB3cml0ZSByZXN1bWUgaGVhZGVyIGlmIHdlIGhhdmVuJ3Qgd3JpdHRlbiBpdCBmb3IgdGhpcyB3aW5kb3cvZmlsZSBjb21ib1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5pc1Nlc3Npb25IZWFkZXJXcml0dGVuKCdyZXN1bWUnKSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbk1lc3NhZ2UgPVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBcXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBTZXNzaW9uIHJlc3VtZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobmV3IERhdGUoKSl9XFxuYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLmFwcGVuZEZpbGVTeW5jKHRoaXMubG9nRmlsZSwgc2Vzc2lvbk1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3Jlc3VtZScpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgc2Vzc2lvbiBzZXBhcmF0b3IgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZXJlJ3MgYWxyZWFkeSBhIGdsb2JhbCBhY3RpdmUgbG9nIGZpbGUgKGZyb20gbWFpbiBwcm9jZXNzKVxuICAgICAgICAvLyBVc2UgYXN5bmMgaW52b2tlIGluc3RlYWQgb2YgYmxvY2tpbmcgc3luY2hyb25vdXMgSVBDXG4gICAgICAgIGxldCBleGlzdGluZ0xvZ0ZpbGUgPSBudWxsO1xuICAgICAgICBpZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFVzZSBhc3luYyBpbnZva2UgYW5kIGp1c3Qgd2FpdCBhIG1heCBvZiA1MDBtcyB0byBhdm9pZCBibG9ja2luZyBzdGFydHVwXG4gICAgICAgICAgICAgICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgICAgICAgICAgICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlPG51bGw+KChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KCgpID0+IHJlc29sdmUobnVsbCksIDUwMCkpO1xuICAgICAgICAgICAgICAgICAgICBleGlzdGluZ0xvZ0ZpbGUgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuICAgICAgICAgICAgICAgICAgICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKCdnZXQtYWN0aXZlLWxvZy1maWxlJyksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0UHJvbWlzZVxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgZXhpc3RpbmcgbG9nIGZpbGUgYXN5bmNocm9ub3VzbHk6JywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoZXhpc3RpbmdMb2dGaWxlICYmIGZzLmV4aXN0c1N5bmMoZXhpc3RpbmdMb2dGaWxlKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFVzaW5nIGV4aXN0aW5nIGdsb2JhbCBsb2cgZmlsZTogJHtleGlzdGluZ0xvZ0ZpbGV9ICh3aW5kb3cgJHt0aGlzLndpbmRvd0lkfSlgKTtcbiAgICAgICAgICAgIHRoaXMubG9nRmlsZSA9IGV4aXN0aW5nTG9nRmlsZTtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIE9ubHkgd3JpdGUgcmVzdW1lIGhlYWRlciBpZiB3ZSBoYXZlbid0IHdyaXR0ZW4gaXQgZm9yIHRoaXMgd2luZG93L2ZpbGUgY29tYm9cbiAgICAgICAgICAgIGlmICghdGhpcy5pc1Nlc3Npb25IZWFkZXJXcml0dGVuKCdyZXN1bWUnKSkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgICAgIGBcXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYFNlc3Npb24gcmVzdW1lZDogJHt0aGlzLmZvcm1hdFRpbWVzdGFtcChuZXcgRGF0ZSgpKX1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG4gICAgICAgICAgICAgICAgICAgIGZzLmFwcGVuZEZpbGVTeW5jKHRoaXMubG9nRmlsZSwgc2Vzc2lvbk1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbigncmVzdW1lJyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgc2Vzc2lvbiBzZXBhcmF0b3IgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZyhgSW5pdGlhbGl6aW5nIGxvZ2dlciBmb3Igd2luZG93ICR7dGhpcy53aW5kb3dJZH0uLi5gKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IHdvcmsgZGlyZWN0b3J5IHBhdGggZnJvbSBzZXR0aW5ncyBzZXJ2aWNlXG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGF3YWl0IHNldHRpbmdzU2VydmljZS5nZXRXb3JrRGlyUGF0aCgpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFdvcmsgZGlyZWN0b3J5OiAke3dvcmtEaXJQYXRoIHx8ICdub3Qgc2V0J31gKTtcblxuICAgICAgICAgICAgLy8gR2V0IGxvZ3MgcGF0aCB1c2luZyB0aGUgcGF0aCBzZXJ2aWNlXG4gICAgICAgICAgICBjb25zdCBsb2dzUGF0aCA9IGdldExvZ3NQYXRoKHdvcmtEaXJQYXRoIHx8IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgTG9ncyBkaXJlY3Rvcnk6ICR7bG9nc1BhdGh9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCBvciBjcmVhdGUgbWFpbiBsb2cgZmlsZVxuICAgICAgICAgICAgdGhpcy5sb2dGaWxlID0gcGF0aC5qb2luKGxvZ3NQYXRoLCAnYXBwLmxvZycpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFVzaW5nIG1haW4gbG9nIGZpbGUgYXQ6ICR7dGhpcy5sb2dGaWxlfWApO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgZmlsZSBleGlzdHMsIGlmIG5vdCBjcmVhdGUgaXQgd2l0aCBpbml0aWFsIGNvbnRlbnRcbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLmxvZ0ZpbGUpKSB7XG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgaW5pdGlhbCBsb2cgZW50cnlcbiAgICAgICAgICAgICAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluaXRpYWxNZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICAgICAgICAgICAgICAgIGBPZG9vIE1hbmFnZXIgLSBBcHBsaWNhdGlvbiBMb2cgKE1haW4gUHJvY2VzcylcXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYFN0YXJ0ZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobm93KX1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYEVudmlyb25tZW50OiAke3Byb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICd1bmtub3duJ31cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcblxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy5sb2dGaWxlLCBpbml0aWFsTWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3N0YXJ0Jyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLmlzU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3N0YXJ0JykpIHtcbiAgICAgICAgICAgICAgICAvLyBXcml0ZSBhIHNlc3Npb24gc2VwYXJhdG9yIHRvIGV4aXN0aW5nIGxvZyBmaWxlIG9ubHkgaWYgd2UgaGF2ZW4ndCB3cml0dGVuIG9uZVxuICAgICAgICAgICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgICAgICAgICAgYFxcbj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICAgICAgICAgICAgICAgIGBTZXNzaW9uIHN0YXJ0ZWQ6ICR7dGhpcy5mb3JtYXRUaW1lc3RhbXAobmV3IERhdGUoKSl9XFxuYCArXG4gICAgICAgICAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG4gICAgICAgICAgICAgICAgZnMuYXBwZW5kRmlsZVN5bmModGhpcy5sb2dGaWxlLCBzZXNzaW9uTWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrU2Vzc2lvbkhlYWRlcldyaXR0ZW4oJ3N0YXJ0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBhY3RpdmUgbG9nIGZpbGUgcGF0aCBnbG9iYWxseVxuICAgICAgICAgICAgQUNUSVZFX0xPR19GSUxFX1BBVEggPSB0aGlzLmxvZ0ZpbGU7XG5cbiAgICAgICAgICAgIC8vIFJlZ2lzdGVyIHdpdGggbWFpbiBwcm9jZXNzXG4gICAgICAgICAgICBMb2dnZXIucmVnaXN0ZXJMb2dGaWxlKHRoaXMubG9nRmlsZSk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBMb2dnZXIgaW5pdGlhbGl6ZWQgd2l0aCBmaWxlOiAke3RoaXMubG9nRmlsZX1gKTtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgR0xPQkFMX0xPR0dFUl9JTklUSUFMSVpFRCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmluZm8oJ0xvZ2dlciBpbml0aWFsaXplZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHRoaXMuaW5mbyhgTG9nIGZpbGVzIHdpbGwgYmUgcm90YXRlZCB3aGVuIHRoZXkgcmVhY2ggJHtMT0dfRklMRV9TSVpFX0xJTUlUIC8gKDEwMjQgKiAxMDI0KX0gTUJgKTtcbiAgICAgICAgICAgIHRoaXMuaW5mbyhgUmVnaXN0ZXJlZCBhY3RpdmUgbG9nIGZpbGU6ICR7dGhpcy5sb2dGaWxlfWApO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBpbml0aWFsaXplIGxvZ2dlcjonLCBlcnIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9ybWF0IGRhdGUgZm9yIGxvZyBmaWxlbmFtZSAoWVlZWS1NTS1ERC1ISC1NTS1TUylcbiAgICAgKiBAcGFyYW0gZGF0ZSBEYXRlIG9iamVjdCB0byBmb3JtYXRcbiAgICAgKiBAcmV0dXJucyBGb3JtYXR0ZWQgZGF0ZSBzdHJpbmcgc3VpdGFibGUgZm9yIGZpbGVuYW1lc1xuICAgICAqL1xuICAgIHByaXZhdGUgZm9ybWF0RGF0ZUZvckZpbGVuYW1lKGRhdGU6IERhdGUpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgICAgICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgICAgIGNvbnN0IGhvdXJzID0gU3RyaW5nKGRhdGUuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICAgICAgY29uc3Qgc2Vjb25kcyA9IFN0cmluZyhkYXRlLmdldFNlY29uZHMoKSkucGFkU3RhcnQoMiwgJzAnKTtcblxuICAgICAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9LSR7aG91cnN9LSR7bWludXRlc30tJHtzZWNvbmRzfWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9ybWF0IHRpbWVzdGFtcCBmb3IgbG9nIGVudHJpZXNcbiAgICAgKiBAcGFyYW0gZGF0ZSBEYXRlIG9iamVjdCB0byBmb3JtYXRcbiAgICAgKiBAcmV0dXJucyBGb3JtYXR0ZWQgdGltZXN0YW1wIHN0cmluZ1xuICAgICAqL1xuICAgIHByaXZhdGUgZm9ybWF0VGltZXN0YW1wKGRhdGU6IERhdGUpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gZGF0ZS50b0xvY2FsZVN0cmluZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBsb2dnZXIgaW5zdGFuY2UgKHNpbmdsZXRvbiBwYXR0ZXJuKVxuICAgICAqIEByZXR1cm5zIExvZ2dlciBpbnN0YW5jZVxuICAgICAqL1xuICAgIHN0YXRpYyBnZXRJbnN0YW5jZSgpOiBMb2dnZXIge1xuICAgICAgICBpZiAoIUxvZ2dlci5pbnN0YW5jZSkge1xuICAgICAgICAgICAgTG9nZ2VyLmluc3RhbmNlID0gbmV3IExvZ2dlcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBMb2dnZXIuaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBsb2cgbGV2ZWxcbiAgICAgKiBAcGFyYW0gbGV2ZWwgTG9nTGV2ZWwgdG8gc2V0XG4gICAgICovXG4gICAgc2V0TG9nTGV2ZWwobGV2ZWw6IExvZ0xldmVsKTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nTGV2ZWwgPSBsZXZlbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgbG9nIGZpbGUgcGF0aFxuICAgICAqIEByZXR1cm5zIFBhdGggdG8gdGhlIGFjdGl2ZSBsb2cgZmlsZVxuICAgICAqL1xuICAgIGdldExvZ0ZpbGVQYXRoKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvZ0ZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmFzZWQgb24gc2l6ZVxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgbG9nIHJvdGF0aW9uIHdhcyBwZXJmb3JtZWQsIGZhbHNlIG90aGVyd2lzZVxuICAgICAqL1xuICAgIHByaXZhdGUgY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuaW5pdGlhbGl6ZWQgfHwgIXRoaXMubG9nRmlsZSB8fCAhZnMuZXhpc3RzU3luYyh0aGlzLmxvZ0ZpbGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyh0aGlzLmxvZ0ZpbGUpO1xuICAgICAgICAgICAgaWYgKHN0YXRzLnNpemUgPCBMT0dfRklMRV9TSVpFX0xJTUlUKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBObyByb3RhdGlvbiBuZWVkZWRcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coYExvZyBmaWxlIHNpemUgKCR7c3RhdHMuc2l6ZX0gYnl0ZXMpIGV4Y2VlZHMgbGltaXQgKCR7TE9HX0ZJTEVfU0laRV9MSU1JVH0gYnl0ZXMpLCByb3RhdGluZyBsb2dzLi4uYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEdldCB0aGUgbG9ncyBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbnN0IGxvZ3NEaXIgPSBwYXRoLmRpcm5hbWUodGhpcy5sb2dGaWxlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gR2V0IGV4aXN0aW5nIHJvdGF0ZWQgbG9nIGZpbGVzXG4gICAgICAgICAgICBjb25zdCBiYXNlTG9nTmFtZSA9IHBhdGguYmFzZW5hbWUodGhpcy5sb2dGaWxlLCAnLmxvZycpO1xuICAgICAgICAgICAgY29uc3Qgcm90YXRlZExvZ3MgPSBmcy5yZWFkZGlyU3luYyhsb2dzRGlyKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoZiA9PiBmLnN0YXJ0c1dpdGgoYCR7YmFzZUxvZ05hbWV9LmApICYmIGYuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgICAgICAgICAgICAuc29ydCgpOyAvLyBTb3J0IHRvIGZpbmQgaGlnaGVzdCByb3RhdGlvbiBudW1iZXJcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gU2hpZnQgb2xkZXIgbG9ncyB0byBtYWtlIHJvb20gZm9yIG5ldyByb3RhdGlvblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHJvdGF0ZWRMb2dzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSByb3RhdGVkTG9nc1tpXS5tYXRjaChuZXcgUmVnRXhwKGAke2Jhc2VMb2dOYW1lfVxcLihcXGQrKVxcLmxvZ2ApKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm90YXRpb25OdW1iZXIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAocm90YXRpb25OdW1iZXIgPj0gTUFYX0xPR19GSUxFUyAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERlbGV0ZSB0aGUgb2xkZXN0IGxvZyBmaWxlIGlmIHdlIGFscmVhZHkgaGF2ZSBtYXggbnVtYmVyIG9mIHJvdGF0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkZXN0TG9nID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkZXN0TG9nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBEZWxldGVkIG9sZCBsb2cgZmlsZTogJHtvbGRlc3RMb2d9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZW5hbWUgdG8gdGhlIG5leHQgcm90YXRpb24gbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvbGRQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBwYXRoLmpvaW4obG9nc0RpciwgYCR7YmFzZUxvZ05hbWV9LiR7cm90YXRpb25OdW1iZXIgKyAxfS5sb2dgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLnJlbmFtZVN5bmMob2xkUGF0aCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUm90YXRlZCBsb2cgZmlsZTogJHtvbGRQYXRofSAtPiAke25ld1BhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlbmFtZSB0aGUgY3VycmVudCBsb2cgZmlsZSB0byBiZSAuMS5sb2dcbiAgICAgICAgICAgIGNvbnN0IHJvdGF0ZWRMb2dQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIGAke2Jhc2VMb2dOYW1lfS4xLmxvZ2ApO1xuICAgICAgICAgICAgZnMucmVuYW1lU3luYyh0aGlzLmxvZ0ZpbGUsIHJvdGF0ZWRMb2dQYXRoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSb3RhdGVkIG1haW4gbG9nIGZpbGU6ICR7dGhpcy5sb2dGaWxlfSAtPiAke3JvdGF0ZWRMb2dQYXRofWApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBuZXcgZW1wdHkgbG9nIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICBjb25zdCBpbml0aWFsTWVzc2FnZSA9XG4gICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICAgICAgICAgICAgYE9kb28gTWFuYWdlciAtIEFwcGxpY2F0aW9uIExvZyAoUm90YXRlZClcXG5gICtcbiAgICAgICAgICAgICAgICBgU3RhcnRlZDogJHt0aGlzLmZvcm1hdFRpbWVzdGFtcChub3cpfVxcbmAgK1xuICAgICAgICAgICAgICAgIGBFbnZpcm9ubWVudDogJHtwcm9jZXNzLmVudi5OT0RFX0VOViB8fCAndW5rbm93bid9XFxuYCArXG4gICAgICAgICAgICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmModGhpcy5sb2dGaWxlLCBpbml0aWFsTWVzc2FnZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFJlc2V0IHNlc3Npb24gaGVhZGVycyB0cmFja2luZyB3aGVuIHJvdGF0ZWRcbiAgICAgICAgICAgIFNFU1NJT05fSEVBREVSU19XUklUVEVOID0ge307XG4gICAgICAgICAgICB0aGlzLm1hcmtTZXNzaW9uSGVhZGVyV3JpdHRlbignc3RhcnQnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igcm90YXRpbmcgbG9nIGZpbGU6JywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyaXRlIGEgbG9nIGVudHJ5IHRvIGNvbnNvbGUgYW5kIGZpbGVcbiAgICAgKiBAcGFyYW0gbGV2ZWwgTG9nTGV2ZWwgb2YgdGhlIGVudHJ5XG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZXJyb3IgT3B0aW9uYWwgZXJyb3Igb2JqZWN0IHRvIGluY2x1ZGVcbiAgICAgKi9cbiAgICBwcml2YXRlIGxvZyhsZXZlbDogTG9nTGV2ZWwsIG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBFcnJvciB8IHVua25vd24pOiB2b2lkIHtcbiAgICAgICAgaWYgKGxldmVsIDwgdGhpcy5sb2dMZXZlbCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IHRoaXMuZm9ybWF0VGltZXN0YW1wKG5ldyBEYXRlKCkpO1xuICAgICAgICBjb25zdCBsZXZlbFN0ciA9IExvZ0xldmVsW2xldmVsXTtcbiAgICAgICAgY29uc3Qgd2luZG93UHJlZml4ID0gdGhpcy53aW5kb3dJZCAhPT0gbnVsbCA/IGBbV0lORE9XLSR7dGhpcy53aW5kb3dJZH1dIGAgOiAnJztcblxuICAgICAgICBsZXQgbG9nTWVzc2FnZSA9IGBbJHt0aW1lc3RhbXB9XSBbJHtsZXZlbFN0cn1dICR7d2luZG93UHJlZml4fSR7bWVzc2FnZX1gO1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxldCBlcnJvck1zZzogc3RyaW5nO1xuICAgICAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBlcnJvck1zZyA9IGVycm9yLnN0YWNrIHx8IGVycm9yLm1lc3NhZ2U7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBlcnJvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBlcnJvck1zZyA9IGVycm9yO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvck1zZyA9IEpTT04uc3RyaW5naWZ5KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JNc2cgPSBTdHJpbmcoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZ01lc3NhZ2UgKz0gYFxcbiR7ZXJyb3JNc2d9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdyaXRlIHRvIGNvbnNvbGVcbiAgICAgICAgY29uc3QgY29uc29sZU1ldGhvZCA9IGxldmVsID09PSBMb2dMZXZlbC5FUlJPUiA/ICdlcnJvcicgOlxuICAgICAgICAgICAgbGV2ZWwgPT09IExvZ0xldmVsLldBUk4gPyAnd2FybicgOlxuICAgICAgICAgICAgICAgIGxldmVsID09PSBMb2dMZXZlbC5ERUJVRyA/ICdkZWJ1ZycgOiAnbG9nJztcbiAgICAgICAgY29uc29sZVtjb25zb2xlTWV0aG9kXShsb2dNZXNzYWdlKTtcblxuICAgICAgICAvLyBXcml0ZSB0byBmaWxlIGlmIGluaXRpYWxpemVkXG4gICAgICAgIGlmICh0aGlzLmluaXRpYWxpemVkICYmIHRoaXMubG9nRmlsZSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBsb2cgZmlsZSBuZWVkcyByb3RhdGlvblxuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gV3JpdGUgdG8gbG9nIGZpbGUgKHdoaWNoIG1pZ2h0IGJlIG5ld2x5IHJvdGF0ZWQpXG4gICAgICAgICAgICAgICAgZnMuYXBwZW5kRmlsZVN5bmModGhpcy5sb2dGaWxlLCBsb2dNZXNzYWdlICsgJ1xcbicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHdyaXRlIHRvIGxvZyBmaWxlOicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgZGVidWcgbWVzc2FnZVxuICAgICAqIEBwYXJhbSBtZXNzYWdlIE1lc3NhZ2UgdG8gbG9nXG4gICAgICogQHBhcmFtIGRhdGEgT3B0aW9uYWwgZGF0YSB0byBpbmNsdWRlXG4gICAgICovXG4gICAgZGVidWcobWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9nKExvZ0xldmVsLkRFQlVHLCBtZXNzYWdlLCBkYXRhKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgaW5mbyBtZXNzYWdlXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZGF0YSBPcHRpb25hbCBkYXRhIHRvIGluY2x1ZGVcbiAgICAgKi9cbiAgICBpbmZvKG1lc3NhZ2U6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQge1xuICAgICAgICB0aGlzLmxvZyhMb2dMZXZlbC5JTkZPLCBtZXNzYWdlLCBkYXRhKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2cgd2FybmluZyBtZXNzYWdlXG4gICAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBsb2dcbiAgICAgKiBAcGFyYW0gZXJyb3IgT3B0aW9uYWwgZXJyb3IgdG8gaW5jbHVkZVxuICAgICAqL1xuICAgIHdhcm4obWVzc2FnZTogc3RyaW5nLCBlcnJvcj86IEVycm9yIHwgdW5rbm93bik6IHZvaWQge1xuICAgICAgICB0aGlzLmxvZyhMb2dMZXZlbC5XQVJOLCBtZXNzYWdlLCBlcnJvcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9nIGVycm9yIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gbWVzc2FnZSBNZXNzYWdlIHRvIGxvZ1xuICAgICAqIEBwYXJhbSBlcnJvciBPcHRpb25hbCBlcnJvciB0byBpbmNsdWRlXG4gICAgICovXG4gICAgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBlcnJvcj86IEVycm9yIHwgdW5rbm93bik6IHZvaWQge1xuICAgICAgICB0aGlzLmxvZyhMb2dMZXZlbC5FUlJPUiwgbWVzc2FnZSwgZXJyb3IpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhbGwgbG9nIGZpbGVzIGluIHRoZSBsb2dzIGRpcmVjdG9yeVxuICAgICAqIEByZXR1cm5zIEFycmF5IG9mIGxvZyBmaWxlIHBhdGhzXG4gICAgICovXG4gICAgZ2V0TG9nRmlsZXMoKTogc3RyaW5nW10ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gVXNlIHRoZSBwYXRoIHNlcnZpY2UgdG8gZ2V0IGxvZ3MgcGF0aFxuICAgICAgICAgICAgY29uc3QgbG9nc1BhdGggPSBnZXRMb2dzUGF0aCgpO1xuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nc1BhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnMucmVhZGRpclN5bmMobG9nc1BhdGgpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihmaWxlID0+IGZpbGUuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgICAgICAgICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKGxvZ3NQYXRoLCBmaWxlKSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZ2V0IGxvZyBmaWxlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIG1vc3QgcmVjZW50IGxvZyBmaWxlXG4gICAgICogQHJldHVybnMgUGF0aCB0byB0aGUgbW9zdCByZWNlbnQgbG9nIGZpbGUgb3IgbnVsbCBpZiBub25lIGZvdW5kXG4gICAgICovXG4gICAgZ2V0TW9zdFJlY2VudExvZ0ZpbGUoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlcyA9IHRoaXMuZ2V0TG9nRmlsZXMoKTtcbiAgICAgICAgICAgIGlmIChsb2dGaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU29ydCBieSBmaWxlIGNyZWF0aW9uIHRpbWUgKG1vc3QgcmVjZW50IGZpcnN0KVxuICAgICAgICAgICAgcmV0dXJuIGxvZ0ZpbGVzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0QSA9IGZzLnN0YXRTeW5jKGEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRCID0gZnMuc3RhdFN5bmMoYik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRCLmJpcnRodGltZU1zIC0gc3RhdEEuYmlydGh0aW1lTXM7XG4gICAgICAgICAgICB9KVswXTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgbW9zdCByZWNlbnQgbG9nIGZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIENyZWF0ZSBzaW5nbGV0b24gbG9nZ2VyIGluc3RhbmNlXG5jb25zdCBsb2dnZXIgPSBMb2dnZXIuZ2V0SW5zdGFuY2UoKTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgd2luZG93IElEIGZvciB0aGUgbG9nZ2VyXG5pZiAoaXNFbGVjdHJvbigpKSB7XG4gICAgY29uc3QgaXBjUmVuZGVyZXIgPSB3aW5kb3cuaXBjUmVuZGVyZXI7XG4gICAgaWYgKGlwY1JlbmRlcmVyICYmIGlwY1JlbmRlcmVyLmludm9rZSkge1xuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2dldC13aW5kb3ctaWQnKVxuICAgICAgICAgICAgLnRoZW4oaWQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChpZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIuc2V0V2luZG93SWQoaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgd2luZG93IElEIGZvciBsb2dnZXI6JywgZXJyKSk7XG4gICAgfVxufVxuXG4vLyBFeHBvcnQgY29udmVuaWVuY2UgbWV0aG9kc1xuZXhwb3J0IGNvbnN0IGluaXRpYWxpemVMb2dnZXIgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiBhd2FpdCBsb2dnZXIuaW5pdGlhbGl6ZSgpO1xuZXhwb3J0IGNvbnN0IGxvZ0RlYnVnID0gKG1lc3NhZ2U6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQgPT4gbG9nZ2VyLmRlYnVnKG1lc3NhZ2UsIGRhdGEpO1xuZXhwb3J0IGNvbnN0IGxvZ0luZm8gPSAobWVzc2FnZTogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCA9PiBsb2dnZXIuaW5mbyhtZXNzYWdlLCBkYXRhKTtcbmV4cG9ydCBjb25zdCBsb2dXYXJuID0gKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBFcnJvciB8IHVua25vd24pOiB2b2lkID0+IGxvZ2dlci53YXJuKG1lc3NhZ2UsIGVycm9yKTtcbmV4cG9ydCBjb25zdCBsb2dFcnJvciA9IChtZXNzYWdlOiBzdHJpbmcsIGVycm9yPzogRXJyb3IgfCB1bmtub3duKTogdm9pZCA9PiBsb2dnZXIuZXJyb3IobWVzc2FnZSwgZXJyb3IpO1xuZXhwb3J0IGNvbnN0IGdldExvZ0ZpbGVzID0gKCk6IHN0cmluZ1tdID0+IGxvZ2dlci5nZXRMb2dGaWxlcygpO1xuZXhwb3J0IGNvbnN0IGdldExvZ0ZpbGVQYXRoID0gKCk6IHN0cmluZyA9PiBsb2dnZXIuZ2V0TG9nRmlsZVBhdGgoKTtcbmV4cG9ydCBjb25zdCBnZXRNb3N0UmVjZW50TG9nRmlsZSA9ICgpOiBzdHJpbmcgfCBudWxsID0+IGxvZ2dlci5nZXRNb3N0UmVjZW50TG9nRmlsZSgpO1xuZXhwb3J0IGNvbnN0IHNldExvZ0xldmVsID0gKGxldmVsOiBudW1iZXIpOiB2b2lkID0+IGxvZ2dlci5zZXRMb2dMZXZlbChsZXZlbCk7XG5leHBvcnQgY29uc3QgY2xlYW51cE9sZExvZ0ZpbGVzID0gYXN5bmMgKGRheXM6IG51bWJlciA9IDcpOiBQcm9taXNlPHZvaWQ+ID0+IGF3YWl0IGxvZ2dlci5jbGVhbnVwT2xkTG9nRmlsZXMoZGF5cyk7XG5cbi8vIEV4cG9ydCBsb2dnZXIgYW5kIExvZ0xldmVsIGVudW0gZm9yIGFkdmFuY2VkIHVzYWdlXG5leHBvcnQgeyBMb2dMZXZlbCB9O1xuZXhwb3J0IGRlZmF1bHQgbG9nZ2VyOyIsIi8vIHNyYy9zZXJ2aWNlcy9zeXN0ZW0vcGF0aFNlcnZpY2UudHNcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vKipcbiAqIEdldCB0aGUgYXBwIGRhdGEgZGlyZWN0b3J5IHBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFwcERhdGFQYXRoKCk6IHN0cmluZyB7XG4gICAgY29uc3QgYXBwTmFtZSA9ICdvZG9vLW1hbmFnZXInO1xuXG4gICAgLy8gRGlmZmVyZW50IHBhdGhzIGJhc2VkIG9uIG9wZXJhdGluZyBzeXN0ZW1cbiAgICBzd2l0Y2ggKHByb2Nlc3MucGxhdGZvcm0pIHtcbiAgICAgICAgY2FzZSAnd2luMzInOlxuICAgICAgICAgICAgcmV0dXJuIHBhdGguam9pbihwcm9jZXNzLmVudi5BUFBEQVRBIHx8ICcnLCBhcHBOYW1lKTtcbiAgICAgICAgY2FzZSAnZGFyd2luJzpcbiAgICAgICAgICAgIHJldHVybiBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgYXBwTmFtZSk7XG4gICAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgICAgIHJldHVybiBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnLmNvbmZpZycsIGFwcE5hbWUpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIHBhdGguam9pbihvcy5ob21lZGlyKCksIGAuJHthcHBOYW1lfWApO1xuICAgIH1cbn1cblxuLyoqXG4gKiBFbnN1cmUgYSBkaXJlY3RvcnkgZXhpc3RzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbnN1cmVEaXIoZGlyUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpclBhdGgpKSB7XG4gICAgICAgIGZzLm1rZGlyU3luYyhkaXJQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0IHRoZSBsb2dzIGRpcmVjdG9yeSBwYXRoXG4gKiBAcGFyYW0gY3VzdG9tV29ya0RpclBhdGggT3B0aW9uYWwgY3VzdG9tIHdvcmsgZGlyZWN0b3J5IHBhdGhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvZ3NQYXRoKGN1c3RvbVdvcmtEaXJQYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBJZiBhIHNwZWNpZmljIHdvcmsgZGlyZWN0b3J5IGlzIHByb3ZpZGVkLCB1c2UgaXRcbiAgICBjb25zdCBiYXNlUGF0aCA9IGN1c3RvbVdvcmtEaXJQYXRoIHx8IGdldFdvcmtEaXJQYXRoKCkgfHwgZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICBjb25zdCBsb2dzUGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgJ2xvZ3MnKTtcbiAgICBlbnN1cmVEaXIobG9nc1BhdGgpO1xuICAgIHJldHVybiBsb2dzUGF0aDtcbn1cblxuLyoqXG4gKiBHZXQgdGhlIHVzZXIgd29yayBkaXJlY3RvcnkgcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ya0RpclBhdGgoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICByZXR1cm4gZGF0YS53b3JrRGlyIHx8IG51bGw7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgd29yayBkaXJlY3RvcnkgcGF0aDonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBTZXQgdGhlIHVzZXIgd29yayBkaXJlY3RvcnkgcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0V29ya0RpclBhdGgod29ya0RpclBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFwcERhdGFQYXRoID0gZ2V0QXBwRGF0YVBhdGgoKTtcbiAgICAgICAgZW5zdXJlRGlyKGFwcERhdGFQYXRoKTtcblxuICAgICAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHsgd29ya0Rpcjogd29ya0RpclBhdGggfSwgbnVsbCwgMikpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2dFcnJvcignRXJyb3Igc2V0dGluZyB3b3JrIGRpcmVjdG9yeSBwYXRoOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0iLCIvLyBzcmMvc2VydmljZXMvc3lzdGVtL2RvY2tlclBhdGhTZXJ2aWNlLnRzXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBsb2dJbmZvLCBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcblxuLyoqXG4gKiBQb3NzaWJsZSBEb2NrZXIgaW5zdGFsbGF0aW9uIHBhdGhzIGZvciBkaWZmZXJlbnQgb3BlcmF0aW5nIHN5c3RlbXNcbiAqL1xuY29uc3QgRE9DS0VSX1BBVEhTID0ge1xuICBkYXJ3aW46IFtcbiAgICAnL3Vzci9sb2NhbC9iaW4vZG9ja2VyJyxcbiAgICAnL29wdC9ob21lYnJldy9iaW4vZG9ja2VyJyxcbiAgICAnL0FwcGxpY2F0aW9ucy9Eb2NrZXIuYXBwL0NvbnRlbnRzL1Jlc291cmNlcy9iaW4vZG9ja2VyJyxcbiAgICBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnLmRvY2tlci9iaW4vZG9ja2VyJylcbiAgXSxcbiAgbGludXg6IFtcbiAgICAnL3Vzci9iaW4vZG9ja2VyJyxcbiAgICAnL3Vzci9sb2NhbC9iaW4vZG9ja2VyJ1xuICBdLFxuICB3aW4zMjogW1xuICAgICdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXERvY2tlclxcXFxEb2NrZXJcXFxccmVzb3VyY2VzXFxcXGJpblxcXFxkb2NrZXIuZXhlJyxcbiAgICAnQzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxEb2NrZXJcXFxcRG9ja2VyXFxcXHJlc291cmNlc1xcXFxkb2NrZXIuZXhlJyxcbiAgICBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnQXBwRGF0YVxcXFxMb2NhbFxcXFxEb2NrZXJcXFxcRG9ja2VyXFxcXHJlc291cmNlc1xcXFxiaW5cXFxcZG9ja2VyLmV4ZScpXG4gIF1cbn07XG5cbi8qKlxuICogQ2xhc3MgdG8gaGFuZGxlIERvY2tlciBjb21tYW5kIHBhdGggcmVzb2x1dGlvblxuICovXG5jbGFzcyBEb2NrZXJQYXRoU2VydmljZSB7XG4gIHByaXZhdGUgZG9ja2VyUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgZG9ja2VyQ29tcG9zZVBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBGaW5kIHRoZSBEb2NrZXIgZXhlY3V0YWJsZSBwYXRoXG4gICAqL1xuICBhc3luYyBmaW5kRG9ja2VyUGF0aCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICBpZiAodGhpcy5kb2NrZXJQYXRoKSB7XG4gICAgICByZXR1cm4gdGhpcy5kb2NrZXJQYXRoO1xuICAgIH1cblxuICAgIGxvZ0luZm8oJ1NlYXJjaGluZyBmb3IgRG9ja2VyIGV4ZWN1dGFibGUuLi4nKTtcbiAgICBcbiAgICAvLyBUcnkgdG8gZXhlY3V0ZSBkb2NrZXIgZGlyZWN0bHkgaW4gY2FzZSBpdCdzIGluIHRoZSBQQVRIXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGV4ZWNBc3luYygnZG9ja2VyIC0tdmVyc2lvbicpO1xuICAgICAgdGhpcy5kb2NrZXJQYXRoID0gJ2RvY2tlcic7XG4gICAgICBsb2dJbmZvKCdEb2NrZXIgZXhlY3V0YWJsZSBmb3VuZCBpbiBQQVRIJyk7XG4gICAgICByZXR1cm4gdGhpcy5kb2NrZXJQYXRoO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dJbmZvKCdEb2NrZXIgbm90IGZvdW5kIGluIFBBVEgsIGNoZWNraW5nIGNvbW1vbiBpbnN0YWxsYXRpb24gbG9jYXRpb25zJyk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgY29tbW9uIGluc3RhbGxhdGlvbiBwYXRocyBiYXNlZCBvbiBwbGF0Zm9ybVxuICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybSBhcyAnZGFyd2luJyB8ICdsaW51eCcgfCAnd2luMzInO1xuICAgIGNvbnN0IHBvc3NpYmxlUGF0aHMgPSBET0NLRVJfUEFUSFNbcGxhdGZvcm1dIHx8IFtdO1xuXG4gICAgZm9yIChjb25zdCBkb2NrZXJQYXRoIG9mIHBvc3NpYmxlUGF0aHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGRvY2tlclBhdGgpKSB7XG4gICAgICAgICAgbG9nSW5mbyhgRm91bmQgRG9ja2VyIGV4ZWN1dGFibGUgYXQ6ICR7ZG9ja2VyUGF0aH1gKTtcbiAgICAgICAgICB0aGlzLmRvY2tlclBhdGggPSBkb2NrZXJQYXRoO1xuICAgICAgICAgIHJldHVybiBkb2NrZXJQYXRoO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIGFuZCBjb250aW51ZSBjaGVja2luZyBvdGhlciBwYXRoc1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCBoZXJlLCBEb2NrZXIgZXhlY3V0YWJsZSB3YXNuJ3QgZm91bmRcbiAgICBsb2dFcnJvcignRG9ja2VyIGV4ZWN1dGFibGUgbm90IGZvdW5kIGluIGFueSBjb21tb24gbG9jYXRpb24nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgRG9ja2VyIGNvbW1hbmQgd2l0aCB0aGUgZnVsbCBwYXRoIHRvIERvY2tlclxuICAgKi9cbiAgYXN5bmMgZXhlY3V0ZURvY2tlckNvbW1hbmQoY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTx7IHN0ZG91dDogc3RyaW5nOyBzdGRlcnI6IHN0cmluZyB9PiB7XG4gICAgY29uc3QgZG9ja2VyUGF0aCA9IGF3YWl0IHRoaXMuZmluZERvY2tlclBhdGgoKTtcbiAgICBcbiAgICBpZiAoIWRvY2tlclBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRG9ja2VyIGV4ZWN1dGFibGUgbm90IGZvdW5kLiBQbGVhc2UgZW5zdXJlIERvY2tlciBpcyBpbnN0YWxsZWQgYW5kIGluIHlvdXIgUEFUSC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBmdWxsQ29tbWFuZCA9IGRvY2tlclBhdGggPT09ICdkb2NrZXInIFxuICAgICAgPyBgJHtjb21tYW5kfWAgIC8vIERvY2tlciBpcyBpbiBQQVRIXG4gICAgICA6IGBcIiR7ZG9ja2VyUGF0aH1cIiAke2NvbW1hbmQucmVwbGFjZSgvXmRvY2tlclxccysvLCAnJyl9YDsgIC8vIFVzZSBmdWxsIHBhdGggYW5kIHJlbW92ZSAnZG9ja2VyJyBwcmVmaXhcbiAgICBcbiAgICBsb2dJbmZvKGBFeGVjdXRpbmcgRG9ja2VyIGNvbW1hbmQ6ICR7ZnVsbENvbW1hbmR9YCk7XG4gICAgcmV0dXJuIGF3YWl0IGV4ZWNBc3luYyhmdWxsQ29tbWFuZCk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmcgYnkgZXhlY3V0aW5nICdkb2NrZXIgaW5mbydcbiAgICovXG4gIGFzeW5jIGlzRG9ja2VyUnVubmluZygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5leGVjdXRlRG9ja2VyQ29tbWFuZCgnZG9ja2VyIGluZm8nKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbW9kaWZpZWQgUEFUSCBpbmNsdWRpbmcgY29tbW9uIERvY2tlciBpbnN0YWxsYXRpb24gZGlyZWN0b3JpZXNcbiAgICovXG4gIGdldEVuaGFuY2VkUGF0aCgpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBsYXRmb3JtID0gcHJvY2Vzcy5wbGF0Zm9ybTtcbiAgICBjb25zdCBjdXJyZW50UGF0aCA9IHByb2Nlc3MuZW52LlBBVEggfHwgJyc7XG4gICAgbGV0IGFkZGl0aW9uYWxQYXRoczogc3RyaW5nW10gPSBbXTtcblxuICAgIHN3aXRjaCAocGxhdGZvcm0pIHtcbiAgICAgIGNhc2UgJ2Rhcndpbic6XG4gICAgICAgIGFkZGl0aW9uYWxQYXRocyA9IFtcbiAgICAgICAgICAnL3Vzci9sb2NhbC9iaW4nLFxuICAgICAgICAgICcvb3B0L2hvbWVicmV3L2JpbicsXG4gICAgICAgICAgJy9BcHBsaWNhdGlvbnMvRG9ja2VyLmFwcC9Db250ZW50cy9SZXNvdXJjZXMvYmluJyxcbiAgICAgICAgICBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnLmRvY2tlci9iaW4nKVxuICAgICAgICBdO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2xpbnV4JzpcbiAgICAgICAgYWRkaXRpb25hbFBhdGhzID0gW1xuICAgICAgICAgICcvdXNyL2JpbicsXG4gICAgICAgICAgJy91c3IvbG9jYWwvYmluJ1xuICAgICAgICBdO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3dpbjMyJzpcbiAgICAgICAgYWRkaXRpb25hbFBhdGhzID0gW1xuICAgICAgICAgICdDOlxcXFxQcm9ncmFtIEZpbGVzXFxcXERvY2tlclxcXFxEb2NrZXJcXFxccmVzb3VyY2VzXFxcXGJpbicsXG4gICAgICAgICAgcGF0aC5qb2luKG9zLmhvbWVkaXIoKSwgJ0FwcERhdGFcXFxcTG9jYWxcXFxcRG9ja2VyXFxcXERvY2tlclxcXFxyZXNvdXJjZXNcXFxcYmluJylcbiAgICAgICAgXTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gRmlsdGVyIHBhdGhzIHRoYXQgYWN0dWFsbHkgZXhpc3RcbiAgICBjb25zdCBleGlzdGluZ1BhdGhzID0gYWRkaXRpb25hbFBhdGhzLmZpbHRlcihwID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmcy5leGlzdHNTeW5jKHApO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBuZXcgUEFUSCBzdHJpbmcgd2l0aCBwbGF0Zm9ybS1zcGVjaWZpYyBzZXBhcmF0b3JcbiAgICBjb25zdCBwYXRoU2VwYXJhdG9yID0gcGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOic7XG4gICAgcmV0dXJuIFsuLi5leGlzdGluZ1BhdGhzLCBjdXJyZW50UGF0aF0uam9pbihwYXRoU2VwYXJhdG9yKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgRG9ja2VyUGF0aFNlcnZpY2UoKTsiLCIvLyBzcmMvc2VydmljZXMvZG9ja2VyL2RvY2tlckNvbXBvc2VTZXJ2aWNlLnRzXG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBnZXRBcHBEYXRhUGF0aCB9IGZyb20gJy4uL3N5c3RlbS9wYXRoU2VydmljZSc7XG5pbXBvcnQgc2V0dGluZ3NTZXJ2aWNlIGZyb20gJy4uL3NldHRpbmdzL3NldHRpbmdzU2VydmljZSc7XG5pbXBvcnQgeyBsb2dJbmZvLCBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgZG9ja2VyUGF0aFNlcnZpY2UgZnJvbSAnLi4vc3lzdGVtL2RvY2tlclBhdGhTZXJ2aWNlJztcblxuY29uc3QgZXhlY0FzeW5jID0gcHJvbWlzaWZ5KGV4ZWMpO1xuXG4vKipcbiAqIFNlcnZpY2UgZm9yIG1hbmFnaW5nIERvY2tlciBDb21wb3NlIG9wZXJhdGlvbnMgZm9yIE9kb28gaW5zdGFuY2VzXG4gKi9cbmNsYXNzIERvY2tlckNvbXBvc2VTZXJ2aWNlIHtcbiAgICBwcml2YXRlIHByb2plY3RzUGF0aDogc3RyaW5nO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMucHJvamVjdHNQYXRoID0gcGF0aC5qb2luKGdldEFwcERhdGFQYXRoKCksICdwcm9qZWN0cycpO1xuXG4gICAgICAgIC8vIEVuc3VyZSBwcm9qZWN0cyBkaXJlY3RvcnkgZXhpc3RzXG4gICAgICAgIGlmICghZnMuZXhpc3RzU3luYyh0aGlzLnByb2plY3RzUGF0aCkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZnMubWtkaXJTeW5jKHRoaXMucHJvamVjdHNQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGVkIHByb2plY3RzIGRpcmVjdG9yeTogJHt0aGlzLnByb2plY3RzUGF0aH1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBGYWlsZWQgdG8gY3JlYXRlIHByb2plY3RzIGRpcmVjdG9yeWAsIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyIDogbmV3IEVycm9yKFN0cmluZyhlcnIpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIG9yIHVwZGF0ZSB0aGUgcHJvamVjdHMgcGF0aCBiYXNlZCBvbiB3b3JrZGlyXG4gICAgICovXG4gICAgYXN5bmMgaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmtEaXJQYXRoID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmdldFdvcmtEaXJQYXRoKCk7XG4gICAgICAgICAgICBpZiAod29ya0RpclBhdGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2plY3RzUGF0aCA9IHdvcmtEaXJQYXRoO1xuXG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIG9kb28gYW5kIHBvc3RncmVzIGRpcmVjdG9yaWVzXG4gICAgICAgICAgICAgICAgY29uc3Qgb2Rvb1BhdGggPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsICdvZG9vJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgcG9zdGdyZXNQYXRoID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAncG9zdGdyZXMnKTtcblxuICAgICAgICAgICAgICAgIC8vIEVuc3VyZSBib3RoIGRpcmVjdG9yaWVzIGV4aXN0XG4gICAgICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKG9kb29QYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMob2Rvb1BhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocG9zdGdyZXNQYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMocG9zdGdyZXNQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBVcGRhdGVkIHByb2plY3QgcGF0aHM6ICR7dGhpcy5wcm9qZWN0c1BhdGh9YCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYE5vIHdvcmtkaXIgZm91bmQsIHVzaW5nIGRlZmF1bHQgcGF0aDogJHt0aGlzLnByb2plY3RzUGF0aH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBpbml0aWFsaXppbmcgcHJvamVjdCBwYXRoc2AsIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvciA6IG5ldyBFcnJvcihTdHJpbmcoZXJyb3IpKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBEb2NrZXIgaXMgcnVubmluZ1xuICAgICAqL1xuICAgIGFzeW5jIGNoZWNrRG9ja2VyKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbG9nSW5mbygnQ2hlY2tpbmcgRG9ja2VyIGVuZ2luZSBzdGF0dXMnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRmlyc3QsIGVuaGFuY2UgdGhlIFBBVEggZW52aXJvbm1lbnQgdG8gaW5jbHVkZSBjb21tb24gRG9ja2VyIGluc3RhbGxhdGlvbiBsb2NhdGlvbnNcbiAgICAgICAgICAgIHByb2Nlc3MuZW52LlBBVEggPSBkb2NrZXJQYXRoU2VydmljZS5nZXRFbmhhbmNlZFBhdGgoKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYEVuaGFuY2VkIFBBVEg6ICR7cHJvY2Vzcy5lbnYuUEFUSH1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgRG9ja2VyIHBhdGggZmlyc3RcbiAgICAgICAgICAgIGNvbnN0IGRvY2tlclBhdGggPSBhd2FpdCBkb2NrZXJQYXRoU2VydmljZS5maW5kRG9ja2VyUGF0aCgpO1xuICAgICAgICAgICAgaWYgKCFkb2NrZXJQYXRoKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoJ0RvY2tlciBleGVjdXRhYmxlIG5vdCBmb3VuZCBpbiBjb21tb24gbG9jYXRpb25zJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBFeGVjdXRlIGRvY2tlciBpbmZvIGNvbW1hbmQgdG8gY2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIGF3YWl0IGRvY2tlclBhdGhTZXJ2aWNlLmV4ZWN1dGVEb2NrZXJDb21tYW5kKCdkb2NrZXIgaW5mbycpO1xuICAgICAgICAgICAgbG9nSW5mbygnRG9ja2VyIGVuZ2luZSBpcyBydW5uaW5nJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2dFcnJvcignRG9ja2VyIGVuZ2luZSBpcyBub3QgcnVubmluZyBvciBub3QgaW5zdGFsbGVkJywgZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIgOiBuZXcgRXJyb3IoU3RyaW5nKGVycikpKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuc3VyZSBEb2NrZXIgbmV0d29yayBleGlzdHNcbiAgICAgKi9cbiAgICBhc3luYyBlbnN1cmVOZXR3b3JrRXhpc3RzKG5ldHdvcmtOYW1lOiBzdHJpbmcgPSAnb2Rvby1uZXR3b3JrJyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbG9nSW5mbyhgQ2hlY2tpbmcgaWYgbmV0d29yayBleGlzdHM6ICR7bmV0d29ya05hbWV9YCk7XG4gICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZG9ja2VyUGF0aFNlcnZpY2UuZXhlY3V0ZURvY2tlckNvbW1hbmQoYGRvY2tlciBuZXR3b3JrIGxzIC0tZm9ybWF0IFwie3suTmFtZX19XCJgKTtcblxuICAgICAgICAgICAgaWYgKCFzdGRvdXQuaW5jbHVkZXMobmV0d29ya05hbWUpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRpbmcgbmV0d29yazogJHtuZXR3b3JrTmFtZX1gKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBkb2NrZXJQYXRoU2VydmljZS5leGVjdXRlRG9ja2VyQ29tbWFuZChgZG9ja2VyIG5ldHdvcmsgY3JlYXRlICR7bmV0d29ya05hbWV9YCk7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgTmV0d29yayBjcmVhdGVkIHN1Y2Nlc3NmdWxseTogJHtuZXR3b3JrTmFtZX1gKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgTmV0d29yayAke25ldHdvcmtOYW1lfSBhbHJlYWR5IGV4aXN0c2ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGVuc3VyaW5nIG5ldHdvcmsgJHtuZXR3b3JrTmFtZX0gZXhpc3RzYCwgZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIgOiBuZXcgRXJyb3IoU3RyaW5nKGVycikpKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIGEgcG9ydCBpcyBhdmFpbGFibGUgYW5kIGZpbmQgYW4gYWx0ZXJuYXRpdmUgaWYgbmVlZGVkXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja1BvcnRBdmFpbGFiaWxpdHkocG9ydDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oYFRlc3RpbmcgcG9ydCAke3BvcnR9IGF2YWlsYWJpbGl0eWApO1xuICAgICAgICAgICAgY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG4gICAgICAgICAgICBjb25zdCB0ZXN0ZXIgPSBuZXQuY3JlYXRlU2VydmVyKCk7XG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICB0ZXN0ZXIub25jZSgnZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyci5jb2RlID09PSAnRUFERFJJTlVTRScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYFBvcnQgJHtwb3J0fSBpcyBpbiB1c2VgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFBvcnQgJHtwb3J0fSBpcyBhbHJlYWR5IGluIHVzZWApKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0ZXN0ZXIub25jZSgnbGlzdGVuaW5nJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBQb3J0ICR7cG9ydH0gaXMgYXZhaWxhYmxlYCk7XG4gICAgICAgICAgICAgICAgICAgIHRlc3Rlci5jbG9zZSgoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGVzdGVyLmxpc3Rlbihwb3J0LCAnMC4wLjAuMCcpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBwb3J0OyAvLyBQb3J0IGlzIGF2YWlsYWJsZSwgdXNlIGl0XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nSW5mbyhgRmluZGluZyBhbHRlcm5hdGl2ZSBwb3J0IHRvICR7cG9ydH1gKTtcbiAgICAgICAgICAgIGxldCBuZXdQb3J0ID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gVHJ5IG5leHQgMjAgcG9ydHNcbiAgICAgICAgICAgIGZvciAobGV0IHRlc3RQb3J0ID0gcG9ydCArIDE7IHRlc3RQb3J0IDwgcG9ydCArIDIwOyB0ZXN0UG9ydCsrKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRlc3RlciA9IG5ldC5jcmVhdGVTZXJ2ZXIoKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0F2YWlsYWJsZSA9IGF3YWl0IG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXN0ZXIub25jZSgnZXJyb3InLCAoKSA9PiByZXNvbHZlKGZhbHNlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXN0ZXIub25jZSgnbGlzdGVuaW5nJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlc3Rlci5jbG9zZSgoKSA9PiByZXNvbHZlKHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVzdGVyLmxpc3Rlbih0ZXN0UG9ydCwgJzAuMC4wLjAnKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdQb3J0ID0gdGVzdFBvcnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCBhdmFpbGFibGUgcG9ydDogJHtuZXdQb3J0fWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNraXAgdGhpcyBwb3J0IGFuZCB0cnkgbmV4dFxuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBQb3J0ICR7dGVzdFBvcnR9IHRlc3QgZmFpbGVkYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobmV3UG9ydCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdQb3J0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvcnQgJHtwb3J0fSBpcyBpbiB1c2UgYW5kIG5vIGFsdGVybmF0aXZlIHBvcnRzIGFyZSBhdmFpbGFibGUuIFBsZWFzZSBzcGVjaWZ5IGEgZGlmZmVyZW50IHBvcnQuYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGNvcnJlY3QgRG9ja2VyIENvbXBvc2UgY29tbWFuZFxuICAgICAqL1xuICAgIGFzeW5jIGdldENvbXBvc2VDb21tYW5kKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBkb2NrZXJQYXRoU2VydmljZS5leGVjdXRlRG9ja2VyQ29tbWFuZCgnZG9ja2VyIGNvbXBvc2UgdmVyc2lvbicpO1xuICAgICAgICAgICAgcmV0dXJuICdkb2NrZXIgY29tcG9zZSc7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFRyeSB0aGUgb2xkIGRvY2tlci1jb21wb3NlIGNvbW1hbmRcbiAgICAgICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoJ2RvY2tlci1jb21wb3NlIC0tdmVyc2lvbicpO1xuICAgICAgICAgICAgICAgIHJldHVybiAnZG9ja2VyLWNvbXBvc2UnO1xuICAgICAgICAgICAgfSBjYXRjaCAoY29tcG9zZUVycm9yKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdEb2NrZXIgQ29tcG9zZSBpcyBub3QgYXZhaWxhYmxlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBQb3N0Z3JlU1FMIGluc3RhbmNlIHdpdGggRG9ja2VyIENvbXBvc2VcbiAgICAgKi9cbiAgICBhc3luYyBjcmVhdGVQb3N0Z3Jlc0luc3RhbmNlKFxuICAgICAgICBpbnN0YW5jZU5hbWU6IHN0cmluZyxcbiAgICAgICAgdmVyc2lvbjogc3RyaW5nLFxuICAgICAgICBwb3J0OiBudW1iZXIgPSA1NDMyLFxuICAgICAgICB1c2VybmFtZTogc3RyaW5nID0gJ3Bvc3RncmVzJyxcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZyA9ICdwb3N0Z3JlcydcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nOyBwb3J0PzogbnVtYmVyIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0YXJ0aW5nIFBvc3RncmVTUUwgaW5zdGFuY2UgY3JlYXRpb246ICR7aW5zdGFuY2VOYW1lfSwgdmVyc2lvbjogJHt2ZXJzaW9ufSwgcG9ydDogJHtwb3J0fWApO1xuXG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgd2UncmUgdXNpbmcgdGhlIGNvcnJlY3QgcGF0aFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIExvZyB3aGVyZSBmaWxlcyB3aWxsIGJlIHNhdmVkXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAncG9zdGdyZXMnLCBpbnN0YW5jZU5hbWUpO1xuICAgICAgICAgICAgbG9nSW5mbyhgRmlsZXMgd2lsbCBiZSBzYXZlZCB0bzogJHtwcm9qZWN0RGlyfWApO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiBEb2NrZXIgaXMgcnVubmluZ1xuICAgICAgICAgICAgaWYgKCFhd2FpdCB0aGlzLmNoZWNrRG9ja2VyKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0RvY2tlciBpcyBub3QgcnVubmluZy4gUGxlYXNlIHN0YXJ0IERvY2tlciBhbmQgdHJ5IGFnYWluLicgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSBuZXR3b3JrIGV4aXN0c1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBzZXR0aW5nc1NlcnZpY2UubG9hZFNldHRpbmdzKCk7XG4gICAgICAgICAgICBjb25zdCBuZXR3b3JrTmFtZSA9IHNldHRpbmdzPy5uZXR3b3JrIHx8ICdvZG9vLW5ldHdvcmsnO1xuICAgICAgICAgICAgaWYgKCFhd2FpdCB0aGlzLmVuc3VyZU5ldHdvcmtFeGlzdHMobmV0d29ya05hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBGYWlsZWQgdG8gY3JlYXRlIG9yIHZlcmlmeSBuZXR3b3JrICR7bmV0d29ya05hbWV9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayBwb3J0IGF2YWlsYWJpbGl0eVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gYXdhaXQgdGhpcy5jaGVja1BvcnRBdmFpbGFiaWxpdHkocG9ydCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcilcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgcHJvamVjdCBkaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBJbnN0YW5jZSBkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHM6ICR7cHJvamVjdERpcn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBhbHJlYWR5IGV4aXN0c2AgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nSW5mbyhgQ3JlYXRpbmcgcHJvamVjdCBkaXJlY3Rvcnk6ICR7cHJvamVjdERpcn1gKTtcbiAgICAgICAgICAgIGZzLm1rZGlyU3luYyhwcm9qZWN0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIERvY2tlciBDb21wb3NlIGZpbGVcbiAgICAgICAgICAgIGxvZ0luZm8oYEdlbmVyYXRpbmcgRG9ja2VyIENvbXBvc2UgZmlsZSB3aXRoIHBvcnQgJHtwb3J0fWApO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29udGVudCA9IGBcbnNlcnZpY2VzOlxuICBwb3N0Z3JlczpcbiAgICBpbWFnZTogcG9zdGdyZXM6JHt2ZXJzaW9ufVxuICAgIGNvbnRhaW5lcl9uYW1lOiAke2luc3RhbmNlTmFtZX1cbiAgICBlbnZpcm9ubWVudDpcbiAgICAgIC0gUE9TVEdSRVNfUEFTU1dPUkQ9JHtwYXNzd29yZH1cbiAgICAgIC0gUE9TVEdSRVNfVVNFUj0ke3VzZXJuYW1lfVxuICAgICAgLSBQT1NUR1JFU19EQj1wb3N0Z3Jlc1xuICAgIHBvcnRzOlxuICAgICAgLSBcIiR7cG9ydH06NTQzMlwiXG4gICAgdm9sdW1lczpcbiAgICAgIC0gJHtpbnN0YW5jZU5hbWV9X2RhdGE6L3Zhci9saWIvcG9zdGdyZXNxbC9kYXRhXG4gICAgcmVzdGFydDogdW5sZXNzLXN0b3BwZWRcbiAgICBuZXR3b3JrczpcbiAgICAgIC0gJHtuZXR3b3JrTmFtZX1cblxubmV0d29ya3M6XG4gICR7bmV0d29ya05hbWV9OlxuICAgIGV4dGVybmFsOiB0cnVlXG5cbnZvbHVtZXM6XG4gICR7aW5zdGFuY2VOYW1lfV9kYXRhOlxuICAgIGRyaXZlcjogbG9jYWxcbmA7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VGaWxlUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnZG9ja2VyLWNvbXBvc2UueW1sJyk7XG4gICAgICAgICAgICBsb2dJbmZvKGBXcml0aW5nIERvY2tlciBDb21wb3NlIGZpbGUgdG8gJHtjb21wb3NlRmlsZVBhdGh9YCk7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGNvbXBvc2VGaWxlUGF0aCwgY29tcG9zZUNvbnRlbnQsICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSBmaWxlIHdhcyBjcmVhdGVkXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY29tcG9zZUZpbGVQYXRoKSkge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb21wb3NlIGZpbGUgbm90IGNyZWF0ZWQ6ICR7Y29tcG9zZUZpbGVQYXRofWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnRmFpbGVkIHRvIGNyZWF0ZSBEb2NrZXIgQ29tcG9zZSBmaWxlJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgaW5zdGFuY2UgaW5mbyBmaWxlXG4gICAgICAgICAgICBjb25zdCBpbmZvRmlsZSA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnaW5zdGFuY2UtaW5mby5qc29uJyk7XG4gICAgICAgICAgICBsb2dJbmZvKGBDcmVhdGluZyBpbnN0YW5jZSBpbmZvIGZpbGU6ICR7aW5mb0ZpbGV9YCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdwb3N0Z3JlcycsXG4gICAgICAgICAgICAgICAgdmVyc2lvbixcbiAgICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lLFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGluZm9GaWxlLCBKU09OLnN0cmluZ2lmeShpbmZvLCBudWxsLCAyKSwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgLy8gU3RhcnQgdGhlIGNvbnRhaW5lciB3aXRoIERvY2tlciBDb21wb3NlXG4gICAgICAgICAgICBsb2dJbmZvKGBTdGFydGluZyBQb3N0Z3JlU1FMIGNvbnRhaW5lcmApO1xuICAgICAgICAgICAgY29uc3QgY29tcG9zZUNvbW1hbmQgPSBhd2FpdCB0aGlzLmdldENvbXBvc2VDb21tYW5kKCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgRXhlY3V0aW5nOiBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSB1cCAtZGApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0LCBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcblxuICAgICAgICAgICAgICAgIGlmIChzdGRvdXQpIGxvZ0luZm8oYERvY2tlciBDb21wb3NlIHN0ZG91dDogJHtzdGRvdXR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0ZGVycikgbG9nSW5mbyhgRG9ja2VyIENvbXBvc2Ugc3RkZXJyOiAke3N0ZGVycn1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHN0YXJ0aW5nIGNvbnRhaW5lcmAsIGVycm9yKTtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBnZXQgbW9yZSBlcnJvciBkZXRhaWxzXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGxvZ3MgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gbG9nc2ApO1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgbG9nczogJHtsb2dzfWApO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb3VsZG4ndCBnZXQgY29udGFpbmVyIGxvZ3NgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBzdGFydGluZyBjb250YWluZXI6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWZXJpZnkgdGhlIGNvbnRhaW5lciBpcyBydW5uaW5nXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYFZlcmlmeWluZyBjb250YWluZXIgaXMgcnVubmluZ2ApO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBjb250YWluZXJTdGF0dXMgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIHBzIC0tZmlsdGVyIFwibmFtZT0ke2luc3RhbmNlTmFtZX1cIiAtLWZvcm1hdCBcInt7LlN0YXR1c319XCJgKTtcblxuICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBzdGF0dXM6ICR7Y29udGFpbmVyU3RhdHVzfWApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFjb250YWluZXJTdGF0dXMuaW5jbHVkZXMoJ1VwJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIG1heSBub3QgYmUgcnVubmluZyBjb3JyZWN0bHlgKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBHZXQgY29udGFpbmVyIGxvZ3MgZm9yIGRlYnVnZ2luZ1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGNvbnRhaW5lckxvZ3MgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIGxvZ3MgJHtpbnN0YW5jZU5hbWV9IC0tdGFpbCAyMGApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIGxvZ3M6ICR7Y29udGFpbmVyTG9nc31gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBDb3VsZG4ndCBnZXQgY29udGFpbmVyIGxvZ3NgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSwgLy8gU3RpbGwgcmV0dXJuIHN1Y2Nlc3Mgc2luY2UgZmlsZXMgd2VyZSBjcmVhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUG9zdGdyZVNRTCBpbnN0YW5jZSBjcmVhdGVkLCBidXQgY29udGFpbmVyIG1heSBub3QgYmUgcnVubmluZyBjb3JyZWN0bHkuIENoZWNrIGxvZ3MuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvcnRcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjaGVja2luZyBjb250YWluZXIgc3RhdHVzYCwgZXJyb3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2dJbmZvKGBTdWNjZXNzZnVsbHkgY3JlYXRlZCBQb3N0Z3JlU1FMIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUG9zdGdyZVNRTCBpbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHkgb24gcG9ydCAke3BvcnR9IWAsXG4gICAgICAgICAgICAgICAgcG9ydFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjcmVhdGluZyBQb3N0Z3JlU1FMIGluc3RhbmNlICR7aW5zdGFuY2VOYW1lfWAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIGNyZWF0aW5nIGluc3RhbmNlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSBEb2NrZXIgQ29tcG9zZSBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIHN0YXJ0SW5zdGFuY2UoaW5zdGFuY2VOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdGlhbGl6ZVByb2plY3RzUGF0aCgpO1xuXG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgdGhlIGNvcnJlY3QgZGlyZWN0b3J5IGJhc2VkIG9uIGluc3RhbmNlIHR5cGVcbiAgICAgICAgICAgIGxldCBwcm9qZWN0RGlyO1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlTmFtZS5pbmNsdWRlcygncG9zdGdyZXNfJykpIHtcbiAgICAgICAgICAgICAgICBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAncG9zdGdyZXMnLCBpbnN0YW5jZU5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwcm9qZWN0RGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycsIGluc3RhbmNlTmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRvZXMgbm90IGV4aXN0YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZSA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnZG9ja2VyLWNvbXBvc2UueW1sJyk7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY29tcG9zZUZpbGUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBDb21wb3NlIGZpbGUgZm9yICR7aW5zdGFuY2VOYW1lfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VDb21tYW5kID0gYXdhaXQgdGhpcy5nZXRDb21wb3NlQ29tbWFuZCgpO1xuICAgICAgICAgICAgbG9nSW5mbyhgU3RhcnRpbmcgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKGBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSB1cCAtZGApO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IHN0YXJ0ZWQgc3VjY2Vzc2Z1bGx5YCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHN0YXJ0aW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBzdGFydGluZyBpbnN0YW5jZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3AgYSBEb2NrZXIgQ29tcG9zZSBpbnN0YW5jZVxuICAgICAqL1xuICAgIGFzeW5jIHN0b3BJbnN0YW5jZShpbnN0YW5jZU5hbWU6IHN0cmluZyk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIERldGVybWluZSB0aGUgY29ycmVjdCBkaXJlY3RvcnkgYmFzZWQgb24gaW5zdGFuY2UgdHlwZVxuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VUeXBlID0gaW5zdGFuY2VOYW1lLmluY2x1ZGVzKCdwb3N0Z3JlcycpID8gJ3Bvc3RncmVzJyA6ICdvZG9vJztcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgbG9nSW5mbyhgU3RvcHBpbmcgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuXG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMocHJvamVjdERpcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBkb2VzIG5vdCBleGlzdGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9zZUZpbGUgPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbXBvc2VGaWxlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgQ29tcG9zZSBmaWxlIGZvciAke2luc3RhbmNlTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBpdCdzIGEgUG9zdGdyZVNRTCBpbnN0YW5jZSwgY2hlY2sgZm9yIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlc1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlVHlwZSA9PT0gJ3Bvc3RncmVzJykge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYENoZWNraW5nIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXMgYmVmb3JlIHN0b3BwaW5nIFBvc3RncmVTUUw6ICR7aW5zdGFuY2VOYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgLy8gTGlzdCBhbGwgaW5zdGFuY2VzIHRvIGZpbmQgZGVwZW5kZW50IG9uZXNcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBhd2FpdCB0aGlzLmxpc3RJbnN0YW5jZXMoKTtcblxuICAgICAgICAgICAgICAgIC8vIEZpbHRlciBmb3IgYWN0aXZlIE9kb28gaW5zdGFuY2VzIHRoYXQgZGVwZW5kIG9uIHRoaXMgUG9zdGdyZVNRTCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudEluc3RhbmNlcyA9IGluc3RhbmNlcy5maWx0ZXIoaW5zdGFuY2UgPT5cbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuaW5mbyAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnR5cGUgPT09ICdvZG9vJyAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnBvc3RncmVzSW5zdGFuY2UgPT09IGluc3RhbmNlTmFtZSAmJlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5zdGF0dXMudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndXAnKVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVwZW5kZW50SW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVwZW5kZW50TmFtZXMgPSBkZXBlbmRlbnRJbnN0YW5jZXMubWFwKGluc3RhbmNlID0+IGluc3RhbmNlLm5hbWUpLmpvaW4oJywgJyk7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYEZvdW5kIHJ1bm5pbmcgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzOiAke2RlcGVuZGVudE5hbWVzfWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ2Fubm90IHN0b3AgUG9zdGdyZVNRTCBpbnN0YW5jZSBcIiR7aW5zdGFuY2VOYW1lfVwiIGJlY2F1c2UgaXQgaGFzIHJ1bm5pbmcgT2RvbyBpbnN0YW5jZXMgdGhhdCBkZXBlbmQgb24gaXQ6ICR7ZGVwZW5kZW50TmFtZXN9LiBQbGVhc2Ugc3RvcCB0aGVzZSBpbnN0YW5jZXMgZmlyc3QuYFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxvZ0luZm8oJ05vIHJ1bm5pbmcgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIGZvdW5kLCBwcm9jZWVkaW5nIHdpdGggc3RvcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0b3BwaW5nIGluc3RhbmNlIHdpdGg6ICR7Y29tcG9zZUNvbW1hbmR9IHN0b3BgKTtcbiAgICAgICAgICAgIGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gc3RvcGApO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IHN0b3BwZWQgc3VjY2Vzc2Z1bGx5YCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIHN0b3BwaW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBzdG9wcGluZyBpbnN0YW5jZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIERvY2tlciBDb21wb3NlIGluc3RhbmNlXG4gICAgICovXG4gICAgYXN5bmMgZGVsZXRlSW5zdGFuY2UoaW5zdGFuY2VOYW1lOiBzdHJpbmcsIGtlZXBGaWxlczogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U6IHN0cmluZyB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVQcm9qZWN0c1BhdGgoKTtcblxuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBjb3JyZWN0IGRpcmVjdG9yeSBiYXNlZCBvbiBpbnN0YW5jZSB0eXBlXG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZVR5cGUgPSBpbnN0YW5jZU5hbWUuaW5jbHVkZXMoJ3Bvc3RncmVzJykgPyAncG9zdGdyZXMnIDogJ29kb28nO1xuICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgaW5zdGFuY2VUeXBlLCBpbnN0YW5jZU5hbWUpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKGBEZWxldGluZyBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhwcm9qZWN0RGlyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRvZXMgbm90IGV4aXN0YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBpdCdzIGEgUG9zdGdyZVNRTCBpbnN0YW5jZSwgY2hlY2sgZm9yIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlc1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlVHlwZSA9PT0gJ3Bvc3RncmVzJykge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYENoZWNraW5nIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXMgYmVmb3JlIGRlbGV0aW5nIFBvc3RncmVTUUw6ICR7aW5zdGFuY2VOYW1lfWApO1xuXG4gICAgICAgICAgICAgICAgLy8gTGlzdCBhbGwgaW5zdGFuY2VzIHRvIGZpbmQgZGVwZW5kZW50IG9uZXNcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSBhd2FpdCB0aGlzLmxpc3RJbnN0YW5jZXMoKTtcblxuICAgICAgICAgICAgICAgIC8vIEdldCBhbGwgT2RvbyBpbnN0YW5jZXMgdGhhdCBkZXBlbmQgb24gdGhpcyBQb3N0Z3JlU1FMIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3QgZGVwZW5kZW50SW5zdGFuY2VzID0gaW5zdGFuY2VzLmZpbHRlcihpbnN0YW5jZSA9PlxuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvICYmXG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmluZm8udHlwZSA9PT0gJ29kb28nICYmXG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmluZm8ucG9zdGdyZXNJbnN0YW5jZSA9PT0gaW5zdGFuY2VOYW1lXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGlmIChkZXBlbmRlbnRJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXBlbmRlbnROYW1lcyA9IGRlcGVuZGVudEluc3RhbmNlcy5tYXAoaW5zdGFuY2UgPT4gaW5zdGFuY2UubmFtZSkuam9pbignLCAnKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgRm91bmQgZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzOiAke2RlcGVuZGVudE5hbWVzfWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ2Fubm90IGRlbGV0ZSBQb3N0Z3JlU1FMIGluc3RhbmNlIFwiJHtpbnN0YW5jZU5hbWV9XCIgYmVjYXVzZSBpdCBoYXMgT2RvbyBpbnN0YW5jZXMgdGhhdCBkZXBlbmQgb24gaXQ6ICR7ZGVwZW5kZW50TmFtZXN9LiBQbGVhc2UgZGVsZXRlIHRoZXNlIGluc3RhbmNlcyBmaXJzdC5gXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbG9nSW5mbygnTm8gZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzIGZvdW5kLCBwcm9jZWVkaW5nIHdpdGggZGVsZXRlJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VDb21tYW5kID0gYXdhaXQgdGhpcy5nZXRDb21wb3NlQ29tbWFuZCgpO1xuXG4gICAgICAgICAgICAvLyBTdG9wIGFuZCByZW1vdmUgY29udGFpbmVyc1xuICAgICAgICAgICAgbG9nSW5mbyhgU3RvcHBpbmcgY29udGFpbmVycyB3aXRoICR7Y29tcG9zZUNvbW1hbmR9IGRvd25gKTtcbiAgICAgICAgICAgIGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gZG93biAtdmApO1xuXG4gICAgICAgICAgICAvLyBEZWxldGUgdGhlIGRpcmVjdG9yeSBpZiBrZWVwRmlsZXMgaXMgZmFsc2VcbiAgICAgICAgICAgIGlmICgha2VlcEZpbGVzKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgUmVtb3ZpbmcgZGlyZWN0b3J5OiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICAgICAgZnMucm1TeW5jKHByb2plY3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgS2VlcGluZyBmaWxlcyBpbjogJHtwcm9qZWN0RGlyfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgSW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5YCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGRlbGV0aW5nIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJvciBkZWxldGluZyBpbnN0YW5jZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBsb2dzIGZyb20gYSBEb2NrZXIgY29udGFpbmVyXG4gICAgICovXG4gICAgYXN5bmMgZ2V0TG9ncyhpbnN0YW5jZU5hbWU6IHN0cmluZywgc2VydmljZTogc3RyaW5nID0gJ2F1dG8nLCB0YWlsOiBudW1iZXIgPSAxMDApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbG9ncz86IHN0cmluZzsgbWVzc2FnZT86IHN0cmluZyB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVQcm9qZWN0c1BhdGgoKTtcblxuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBjb3JyZWN0IGRpcmVjdG9yeSBiYXNlZCBvbiBpbnN0YW5jZSB0eXBlXG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZVR5cGUgPSBpbnN0YW5jZU5hbWUuaW5jbHVkZXMoJ3Bvc3RncmVzJykgPyAncG9zdGdyZXMnIDogJ29kb28nO1xuICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgaW5zdGFuY2VUeXBlLCBpbnN0YW5jZU5hbWUpO1xuXG4gICAgICAgICAgICBsb2dJbmZvKGBHZXR0aW5nIGxvZ3MgZm9yIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gZG9lcyBub3QgZXhpc3RgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHNlcnZpY2UgaXMgYXV0bywgZGV0ZXJtaW5lIHRoZSBkZWZhdWx0IHNlcnZpY2UgYmFzZWQgb24gaW5zdGFuY2UgdHlwZVxuICAgICAgICAgICAgaWYgKHNlcnZpY2UgPT09ICdhdXRvJykge1xuICAgICAgICAgICAgICAgIHNlcnZpY2UgPSBpbnN0YW5jZVR5cGUgPT09ICdwb3N0Z3JlcycgPyAncG9zdGdyZXMnIDogJ29kb28nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsb2dJbmZvKGBVc2luZyBzZXJ2aWNlOiAke3NlcnZpY2V9IGZvciBsb2dzYCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VDb21tYW5kID0gYXdhaXQgdGhpcy5nZXRDb21wb3NlQ29tbWFuZCgpO1xuICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke3Byb2plY3REaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gbG9ncyAtLXRhaWw9JHt0YWlsfSAke3NlcnZpY2V9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBsb2dzOiBzdGRvdXQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBnZXR0aW5nIGxvZ3MgZm9yICR7aW5zdGFuY2VOYW1lfWAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIGdldHRpbmcgbG9nczogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpc3QgYWxsIERvY2tlciBDb21wb3NlIGluc3RhbmNlc1xuICAgICAqL1xuICAgIGFzeW5jIGxpc3RJbnN0YW5jZXMoKTogUHJvbWlzZTxBcnJheTx7IG5hbWU6IHN0cmluZzsgc3RhdHVzOiBzdHJpbmc7IGluZm86IGFueSB9Pj4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG4gICAgICAgICAgICBsb2dJbmZvKCdMaXN0aW5nIGluc3RhbmNlcyBmcm9tIGJvdGggb2RvbyBhbmQgcG9zdGdyZXMgZGlyZWN0b3JpZXMnKTtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nOyBpbmZvOiBhbnkgfT4gPSBbXTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgYmFzZSBwYXRoIGV4aXN0c1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHRoaXMucHJvamVjdHNQYXRoKSkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oJ0Jhc2UgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRnVuY3Rpb24gdG8gc2NhbiBhIGRpcmVjdG9yeSBmb3IgaW5zdGFuY2VzXG4gICAgICAgICAgICBjb25zdCBzY2FuRGlyZWN0b3J5ID0gYXN5bmMgKGRpclBhdGg6IHN0cmluZywgaW5zdGFuY2VUeXBlOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgJHtpbnN0YW5jZVR5cGV9IGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdDogJHtkaXJQYXRofWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZGlycyA9IGZzLnJlYWRkaXJTeW5jKGRpclBhdGgpO1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEZvdW5kICR7ZGlycy5sZW5ndGh9IGRpcmVjdG9yaWVzIGluICR7aW5zdGFuY2VUeXBlfSBwYXRoYCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlRGlyID0gcGF0aC5qb2luKGRpclBhdGgsIGRpcik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VGaWxlID0gcGF0aC5qb2luKGluc3RhbmNlRGlyLCAnZG9ja2VyLWNvbXBvc2UueW1sJyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZm9GaWxlID0gcGF0aC5qb2luKGluc3RhbmNlRGlyLCAnaW5zdGFuY2UtaW5mby5qc29uJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY29tcG9zZUZpbGUpICYmIGZzLmxzdGF0U3luYyhpbnN0YW5jZURpcikuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHN0YXR1cyA9ICdVbmtub3duJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBpbmZvOiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0ge307XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIHBzIC0tZmlsdGVyIFwibmFtZT0ke2Rpcn1cIiAtLWZvcm1hdCBcInt7LlN0YXR1c319XCJgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBzdGRvdXQudHJpbSgpID8gc3Rkb3V0LnRyaW0oKSA6ICdOb3QgcnVubmluZyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyA9ICdOb3QgcnVubmluZyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGluZm9GaWxlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8gPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhpbmZvRmlsZSwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBZGQgdHlwZSBpbmZvcm1hdGlvbiBpZiBub3QgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWluZm8udHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mby50eXBlID0gaW5zdGFuY2VUeXBlID09PSAnb2RvbycgPyAnb2RvbycgOiAncG9zdGdyZXMnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mbyA9IHsgbmFtZTogZGlyLCBlcnJvcjogJ0ludmFsaWQgaW5mbyBmaWxlJywgdHlwZTogaW5zdGFuY2VUeXBlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmZvID0geyBuYW1lOiBkaXIsIHR5cGU6IGluc3RhbmNlVHlwZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogZGlyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmZvXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQWRkZWQgJHtpbnN0YW5jZVR5cGV9IGluc3RhbmNlOiAke2Rpcn0sIHN0YXR1czogJHtzdGF0dXN9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBTY2FuIGJvdGggZGlyZWN0b3JpZXNcbiAgICAgICAgICAgIGF3YWl0IHNjYW5EaXJlY3RvcnkocGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycpLCAnb2RvbycpO1xuICAgICAgICAgICAgYXdhaXQgc2NhbkRpcmVjdG9yeShwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsICdwb3N0Z3JlcycpLCAncG9zdGdyZXMnKTtcblxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlcztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBsaXN0aW5nIGluc3RhbmNlc2AsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzXG4gICAgICovXG4gICAgYXN5bmMgdXBkYXRlUG9zdGdyZXNDcmVkZW50aWFscyhcbiAgICAgICAgaW5zdGFuY2VOYW1lOiBzdHJpbmcsXG4gICAgICAgIG5ld1VzZXJuYW1lOiBzdHJpbmcsXG4gICAgICAgIG5ld1Bhc3N3b3JkOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nOyB1cGRhdGVkSW5zdGFuY2VzPzogc3RyaW5nW10gfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pbml0aWFsaXplUHJvamVjdHNQYXRoKCk7XG5cbiAgICAgICAgICAgIC8vIEZpbmQgdGhlIGluc3RhbmNlIGRpcmVjdG9yeVxuICAgICAgICAgICAgY29uc3QgcHJvamVjdERpciA9IHBhdGguam9pbih0aGlzLnByb2plY3RzUGF0aCwgJ3Bvc3RncmVzJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFVwZGF0aW5nIFBvc3RncmVTUUwgY3JlZGVudGlhbHMgZm9yIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX1gKTtcblxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gZG9lcyBub3QgZXhpc3RgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdldCBleGlzdGluZyBjb21wb3NlIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2VGaWxlUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnZG9ja2VyLWNvbXBvc2UueW1sJyk7XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoY29tcG9zZUZpbGVQYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgRG9ja2VyIENvbXBvc2UgZmlsZSBmb3IgJHtpbnN0YW5jZU5hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRmluZCBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXNcbiAgICAgICAgICAgIGxvZ0luZm8oYENoZWNraW5nIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXMgdGhhdCBuZWVkIHVwZGF0ZWQgY3JlZGVudGlhbHNgKTtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IGF3YWl0IHRoaXMubGlzdEluc3RhbmNlcygpO1xuICAgICAgICAgICAgY29uc3QgZGVwZW5kZW50SW5zdGFuY2VzID0gaW5zdGFuY2VzLmZpbHRlcihpbnN0YW5jZSA9PlxuICAgICAgICAgICAgICAgIGluc3RhbmNlLmluZm8gJiZcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbmZvLnR5cGUgPT09ICdvZG9vJyAmJlxuICAgICAgICAgICAgICAgIGluc3RhbmNlLmluZm8ucG9zdGdyZXNJbnN0YW5jZSA9PT0gaW5zdGFuY2VOYW1lXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBTdG9yZSBkZXBlbmRlbnQgaW5zdGFuY2VzIGZvciByZXBvcnRpbmdcbiAgICAgICAgICAgIGNvbnN0IGRlcGVuZGVudE5hbWVzID0gZGVwZW5kZW50SW5zdGFuY2VzLm1hcChpbnN0YW5jZSA9PiBpbnN0YW5jZS5uYW1lKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYEZvdW5kICR7ZGVwZW5kZW50TmFtZXMubGVuZ3RofSBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZXM6ICR7ZGVwZW5kZW50TmFtZXMuam9pbignLCAnKSB8fCAnbm9uZSd9YCk7XG5cbiAgICAgICAgICAgIC8vIFJlYWQgYW5kIHVwZGF0ZSB0aGUgY29tcG9zZSBmaWxlXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGNvbXBvc2VGaWxlUGF0aCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICAgICAgICAgICAgY29uc3QgdXBkYXRlZENvbnRlbnQgPSBjb250ZW50XG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoLy0gUE9TVEdSRVNfUEFTU1dPUkQ9W15cXG5dKy9nLCBgLSBQT1NUR1JFU19QQVNTV09SRD0ke25ld1Bhc3N3b3JkfWApXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoLy0gUE9TVEdSRVNfVVNFUj1bXlxcbl0rL2csIGAtIFBPU1RHUkVTX1VTRVI9JHtuZXdVc2VybmFtZX1gKTtcblxuICAgICAgICAgICAgLy8gV3JpdGUgYmFjayB1cGRhdGVkIGNvbnRlbnRcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoY29tcG9zZUZpbGVQYXRoLCB1cGRhdGVkQ29udGVudCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBpbnN0YW5jZSBpbmZvIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IGluZm9GaWxlUGF0aCA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnaW5zdGFuY2UtaW5mby5qc29uJyk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbmZvRmlsZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5mb0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoaW5mb0ZpbGVQYXRoLCAndXRmOCcpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBKU09OLnBhcnNlKGluZm9Db250ZW50KTtcblxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBjcmVkZW50aWFsc1xuICAgICAgICAgICAgICAgIGluZm8udXNlcm5hbWUgPSBuZXdVc2VybmFtZTtcbiAgICAgICAgICAgICAgICBpbmZvLnBhc3N3b3JkID0gbmV3UGFzc3dvcmQ7XG4gICAgICAgICAgICAgICAgaW5mby51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGluZm9GaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkoaW5mbywgbnVsbCwgMiksICd1dGY4Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdldCB0aGUgY29tcG9zZSBjb21tYW5kIGZvciByZXN0YXJ0aW5nXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcblxuICAgICAgICAgICAgLy8gUmVzdGFydCB0aGUgUG9zdGdyZVNRTCBjb250YWluZXJcbiAgICAgICAgICAgIGxvZ0luZm8oYFJlc3RhcnRpbmcgUG9zdGdyZVNRTCBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG4gICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IGRvd24gJiYgJHtjb21wb3NlQ29tbWFuZH0gdXAgLWRgKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIGVhY2ggZGVwZW5kZW50IE9kb28gaW5zdGFuY2VcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGZhaWxlZFVwZGF0ZXMgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCBvZG9vSW5zdGFuY2Ugb2YgZGVwZW5kZW50SW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgVXBkYXRpbmcgY29uZmlnIGZvciBkZXBlbmRlbnQgT2RvbyBpbnN0YW5jZTogJHtvZG9vSW5zdGFuY2UubmFtZX1gKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQYXRoIHRvIHRoZSBPZG9vIGluc3RhbmNlIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBvZG9vRGlyID0gcGF0aC5qb2luKHRoaXMucHJvamVjdHNQYXRoLCAnb2RvbycsIG9kb29JbnN0YW5jZS5uYW1lKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgb2Rvby5jb25mIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29uZmlnRGlyID0gcGF0aC5qb2luKG9kb29EaXIsICdjb25maWcnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Rvb0NvbmZQYXRoID0gcGF0aC5qb2luKGNvbmZpZ0RpciwgJ29kb28uY29uZicpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKG9kb29Db25mUGF0aCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBvZG9vQ29uZkNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMob2Rvb0NvbmZQYXRoLCAndXRmOCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgZGF0YWJhc2UgY3JlZGVudGlhbHMgaW4gY29uZmlndXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgb2Rvb0NvbmZDb250ZW50ID0gb2Rvb0NvbmZDb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL2RiX3VzZXIgPSAuKi9nLCBgZGJfdXNlciA9ICR7bmV3VXNlcm5hbWV9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvZGJfcGFzc3dvcmQgPSAuKi9nLCBgZGJfcGFzc3dvcmQgPSAke25ld1Bhc3N3b3JkfWApO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBXcml0ZSBiYWNrIHVwZGF0ZWQgb2Rvby5jb25mXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKG9kb29Db25mUGF0aCwgb2Rvb0NvbmZDb250ZW50LCAndXRmOCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgVXBkYXRlZCBvZG9vLmNvbmYgZm9yICR7b2Rvb0luc3RhbmNlLm5hbWV9YCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBpbnN0YW5jZS1pbmZvLmpzb24gaWYgaXQgZXhpc3RzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvZG9vSW5mb1BhdGggPSBwYXRoLmpvaW4ob2Rvb0RpciwgJ2luc3RhbmNlLWluZm8uanNvbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMob2Rvb0luZm9QYXRoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9kb29JbmZvID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMob2Rvb0luZm9QYXRoLCAndXRmOCcpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb2Rvb0luZm8ucGdDcmVkZW50aWFscykgb2Rvb0luZm8ucGdDcmVkZW50aWFscyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9kb29JbmZvLnBnQ3JlZGVudGlhbHMudXNlcm5hbWUgPSBuZXdVc2VybmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZG9vSW5mby5wZ0NyZWRlbnRpYWxzLnBhc3N3b3JkID0gbmV3UGFzc3dvcmQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Rvb0luZm8udXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhvZG9vSW5mb1BhdGgsIEpTT04uc3RyaW5naWZ5KG9kb29JbmZvLCBudWxsLCAyKSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBVcGRhdGVkIGluc3RhbmNlLWluZm8uanNvbiBmb3IgJHtvZG9vSW5zdGFuY2UubmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVzdGFydCB0aGUgT2RvbyBpbnN0YW5jZSBpZiBpdCdzIHJ1bm5pbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvZG9vSW5zdGFuY2Uuc3RhdHVzLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3VwJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBSZXN0YXJ0aW5nIGRlcGVuZGVudCBPZG9vIGluc3RhbmNlOiAke29kb29JbnN0YW5jZS5uYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGV4ZWNBc3luYyhgY2QgXCIke29kb29EaXJ9XCIgJiYgJHtjb21wb3NlQ29tbWFuZH0gZG93biAmJiAke2NvbXBvc2VDb21tYW5kfSB1cCAtZGApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBTdWNjZXNzZnVsbHkgcmVzdGFydGVkICR7b2Rvb0luc3RhbmNlLm5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAocmVzdGFydEVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgcmVzdGFydGluZyBPZG9vIGluc3RhbmNlICR7b2Rvb0luc3RhbmNlLm5hbWV9YCwgcmVzdGFydEVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhaWxlZFVwZGF0ZXMucHVzaCh7bmFtZTogb2Rvb0luc3RhbmNlLm5hbWUsIGVycm9yOiAncmVzdGFydCBmYWlsdXJlJ30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYE9kb28gaW5zdGFuY2UgJHtvZG9vSW5zdGFuY2UubmFtZX0gaXMgbm90IHJ1bm5pbmcsIG5vIG5lZWQgdG8gcmVzdGFydGApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBNYXJrIGFzIHN1Y2Nlc3NmdWxseSB1cGRhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkSW5zdGFuY2VzLnB1c2gob2Rvb0luc3RhbmNlLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nSW5mbyhgQ291bGQgbm90IGZpbmQgb2Rvby5jb25mIGZvciAke29kb29JbnN0YW5jZS5uYW1lfSwgc2tpcHBpbmcgdXBkYXRlYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmYWlsZWRVcGRhdGVzLnB1c2goe25hbWU6IG9kb29JbnN0YW5jZS5uYW1lLCBlcnJvcjogJ21pc3NpbmcgY29uZmlndXJhdGlvbiBmaWxlJ30pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaW5zdGFuY2VFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgdXBkYXRpbmcgT2RvbyBpbnN0YW5jZSAke29kb29JbnN0YW5jZS5uYW1lfWAsIGluc3RhbmNlRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBmYWlsZWRVcGRhdGVzLnB1c2goe25hbWU6IG9kb29JbnN0YW5jZS5uYW1lLCBlcnJvcjogJ2dlbmVyYWwgZXJyb3InfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQcmVwYXJlIGRldGFpbGVkIHN1Y2Nlc3MgbWVzc2FnZVxuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NNZXNzYWdlID0gYFBvc3RncmVTUUwgY3JlZGVudGlhbHMgdXBkYXRlZCBzdWNjZXNzZnVsbHkgZm9yICR7aW5zdGFuY2VOYW1lfS5gO1xuXG4gICAgICAgICAgICBpZiAodXBkYXRlZEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgc3VjY2Vzc01lc3NhZ2UgKz0gYCBVcGRhdGVkICR7dXBkYXRlZEluc3RhbmNlcy5sZW5ndGh9IGRlcGVuZGVudCBPZG9vIGluc3RhbmNlKHMpOiAke3VwZGF0ZWRJbnN0YW5jZXMuam9pbignLCAnKX0uYDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZhaWxlZFVwZGF0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhaWxlZE5hbWVzID0gZmFpbGVkVXBkYXRlcy5tYXAoZiA9PiBmLm5hbWUpLmpvaW4oJywgJyk7XG4gICAgICAgICAgICAgICAgc3VjY2Vzc01lc3NhZ2UgKz0gYCBGYWlsZWQgdG8gdXBkYXRlICR7ZmFpbGVkVXBkYXRlcy5sZW5ndGh9IGluc3RhbmNlKHMpOiAke2ZhaWxlZE5hbWVzfS5gO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogc3VjY2Vzc01lc3NhZ2UsXG4gICAgICAgICAgICAgICAgdXBkYXRlZEluc3RhbmNlc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciB1cGRhdGluZyBQb3N0Z3JlU1FMIGNyZWRlbnRpYWxzYCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3IgdXBkYXRpbmcgY3JlZGVudGlhbHM6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gT2RvbyBpbnN0YW5jZSB3aXRoIERvY2tlciBDb21wb3NlXG4gICAgICovXG4gICAgYXN5bmMgY3JlYXRlSW5zdGFuY2UoXG4gICAgICAgIGluc3RhbmNlTmFtZTogc3RyaW5nLFxuICAgICAgICB2ZXJzaW9uOiBzdHJpbmcsXG4gICAgICAgIGVkaXRpb24/OiBzdHJpbmcsXG4gICAgICAgIGFkbWluUGFzc3dvcmQ/OiBzdHJpbmcsXG4gICAgICAgIGRiRmlsdGVyPzogYm9vbGVhbixcbiAgICAgICAgcG9ydD86IG51bWJlcixcbiAgICAgICAgY3VzdG9tSW1hZ2U/OiBib29sZWFuLFxuICAgICAgICBjdXN0b21JbWFnZU5hbWU/OiBzdHJpbmcsXG4gICAgICAgIHBvc3RncmVzSW5zdGFuY2U/OiBzdHJpbmcsXG4gICAgICAgIHBnVXNlcj86IHN0cmluZyxcbiAgICAgICAgcGdQYXNzd29yZD86IHN0cmluZ1xuICAgICk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlOiBzdHJpbmc7IHBvcnQ/OiBudW1iZXIgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbG9nSW5mbyhgU3RhcnRpbmcgT2RvbyBpbnN0YW5jZSBjcmVhdGlvbjogJHtpbnN0YW5jZU5hbWV9LCB2ZXJzaW9uOiAke3ZlcnNpb259LCBlZGl0aW9uOiAke2VkaXRpb259YCk7XG5cbiAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB3ZSdyZSB1c2luZyB0aGUgY29ycmVjdCBwYXRoXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemVQcm9qZWN0c1BhdGgoKTtcblxuICAgICAgICAgICAgLy8gTG9nIHdoZXJlIGZpbGVzIHdpbGwgYmUgc2F2ZWRcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3REaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsICdvZG9vJywgaW5zdGFuY2VOYW1lKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYEZpbGVzIHdpbGwgYmUgc2F2ZWQgdG86ICR7cHJvamVjdERpcn1gKTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5jaGVja0RvY2tlcigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdEb2NrZXIgaXMgbm90IHJ1bm5pbmcuIFBsZWFzZSBzdGFydCBEb2NrZXIgYW5kIHRyeSBhZ2Fpbi4nIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSBuZXR3b3JrIGV4aXN0c1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBzZXR0aW5nc1NlcnZpY2UubG9hZFNldHRpbmdzKCk7XG4gICAgICAgICAgICBjb25zdCBuZXR3b3JrTmFtZSA9IHNldHRpbmdzPy5uZXR3b3JrIHx8ICdvZG9vLW5ldHdvcmsnO1xuICAgICAgICAgICAgaWYgKCFhd2FpdCB0aGlzLmVuc3VyZU5ldHdvcmtFeGlzdHMobmV0d29ya05hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBGYWlsZWQgdG8gY3JlYXRlIG9yIHZlcmlmeSBuZXR3b3JrICR7bmV0d29ya05hbWV9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSBQb3N0Z3JlU1FMIGluc3RhbmNlXG4gICAgICAgICAgICBpZiAoIXBvc3RncmVzSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1Bvc3RncmVTUUwgaW5zdGFuY2UgaXMgcmVxdWlyZWQnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSBpZiBQb3N0Z3JlU1FMIGluc3RhbmNlIGV4aXN0cyBhbmQgaXMgcnVubmluZ1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogcGdTdGF0dXMgfSA9IGF3YWl0IGV4ZWNBc3luYyhgZG9ja2VyIHBzIC0tZmlsdGVyIFwibmFtZT0ke3Bvc3RncmVzSW5zdGFuY2V9XCIgLS1mb3JtYXQgXCJ7ey5TdGF0dXN9fVwiYCk7XG4gICAgICAgICAgICAgICAgaWYgKCFwZ1N0YXR1cyB8fCAhcGdTdGF0dXMudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndXAnKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYFBvc3RncmVTUUwgaW5zdGFuY2UgJHtwb3N0Z3Jlc0luc3RhbmNlfSBpcyBub3QgcnVubmluZy4gUGxlYXNlIHN0YXJ0IGl0IGZpcnN0LmAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgY2hlY2tpbmcgUG9zdGdyZVNRTCBzdGF0dXNgLCBlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgUG9zdGdyZVNRTCBpbnN0YW5jZSAke3Bvc3RncmVzSW5zdGFuY2V9IG5vdCBmb3VuZCBvciBub3QgYWNjZXNzaWJsZS5gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSBsaW5rZWQgaW5zdGFuY2VzIGNvdW50XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIExpc3QgYWxsIGluc3RhbmNlcyB0byBmaW5kIGxpbmtlZCBvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gYXdhaXQgdGhpcy5saXN0SW5zdGFuY2VzKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlua2VkSW5zdGFuY2VzID0gaW5zdGFuY2VzLmZpbHRlcihpbnN0ID0+XG4gICAgICAgICAgICAgICAgICAgIGluc3QuaW5mbyAmJiBpbnN0LmluZm8ucG9zdGdyZXNJbnN0YW5jZSA9PT0gcG9zdGdyZXNJbnN0YW5jZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBpZiAobGlua2VkSW5zdGFuY2VzLmxlbmd0aCA+PSA0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBgUG9zdGdyZVNRTCBpbnN0YW5jZSAke3Bvc3RncmVzSW5zdGFuY2V9IGFscmVhZHkgaGFzIDQgbGlua2VkIE9kb28gaW5zdGFuY2VzLiBQbGVhc2UgdXNlIGFub3RoZXIgUG9zdGdyZVNRTCBpbnN0YW5jZS5gIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEZvdW5kICR7bGlua2VkSW5zdGFuY2VzLmxlbmd0aH0gT2RvbyBpbnN0YW5jZXMgbGlua2VkIHRvICR7cG9zdGdyZXNJbnN0YW5jZX1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBjaGVja2luZyBsaW5rZWQgaW5zdGFuY2VzIGNvdW50YCwgZXJyKTtcbiAgICAgICAgICAgICAgICAvLyBDb250aW51ZSBhbnl3YXksIGp1c3QgbG9nIHRoZSBlcnJvclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayBwb3J0IGF2YWlsYWJpbGl0eVxuICAgICAgICAgICAgY29uc3QgZGVmYXVsdFBvcnQgPSBwb3J0IHx8IDgwNjk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSBhd2FpdCB0aGlzLmNoZWNrUG9ydEF2YWlsYWJpbGl0eShkZWZhdWx0UG9ydCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIHByb2plY3QgZGlyZWN0b3J5IGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHByb2plY3REaXIpKSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgSW5zdGFuY2UgZGlyZWN0b3J5IGFscmVhZHkgZXhpc3RzOiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBJbnN0YW5jZSAke2luc3RhbmNlTmFtZX0gYWxyZWFkeSBleGlzdHNgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYENyZWF0aW5nIHByb2plY3QgZGlyZWN0b3J5OiAke3Byb2plY3REaXJ9YCk7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMocHJvamVjdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBjb25maWcgZGlyZWN0b3J5IGZvciBvZG9vLmNvbmZcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RpciA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnY29uZmlnJyk7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoY29uZmlnRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGFkZG9ucyBkaXJlY3RvcnlcbiAgICAgICAgICAgIGNvbnN0IGFkZG9uc0RpciA9IHBhdGguam9pbihwcm9qZWN0RGlyLCAnYWRkb25zJyk7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoYWRkb25zRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIG9kb28uY29uZiBmaWxlIHdpdGggdGhlIHByb3BlciBjb25maWd1cmF0aW9uXG4gICAgICAgICAgICBjb25zdCBvZG9vQ29uZlBhdGggPSBwYXRoLmpvaW4oY29uZmlnRGlyLCAnb2Rvby5jb25mJyk7XG4gICAgICAgICAgICBjb25zdCBkYkZpbHRlclN0ciA9IGRiRmlsdGVyID8gYFxcbmRiZmlsdGVyID0gXiR7aW5zdGFuY2VOYW1lfS4qJGAgOiAnJztcblxuICAgICAgICAgICAgLy8gVXNlIHByb3ZpZGVkIFBvc3RncmVTUUwgY3JlZGVudGlhbHMgb3IgZGVmYXVsdHNcbiAgICAgICAgICAgIGNvbnN0IHBnVXNlclZhbCA9IHBnVXNlciB8fCAncG9zdGdyZXMnO1xuICAgICAgICAgICAgY29uc3QgcGdQYXNzd29yZFZhbCA9IHBnUGFzc3dvcmQgfHwgJ3Bvc3RncmVzJztcblxuICAgICAgICAgICAgY29uc3QgbWFqb3JWZXJzaW9uID0gdmVyc2lvbi5zcGxpdCgnLicpWzBdO1xuXG4gICAgICAgICAgICBjb25zdCBhZGRvbnNQYXRoU3RyID0gZWRpdGlvbiA9PT0gJ0VudGVycHJpc2UnXG4gICAgICAgICAgICAgICAgPyBgL21udC9leHRyYS1hZGRvbnMsIC9tbnQvZW50ZXJwcmlzZS1hZGRvbnMvJHttYWpvclZlcnNpb259YFxuICAgICAgICAgICAgICAgIDogYC9tbnQvZXh0cmEtYWRkb25zYDtcblxuICAgICAgICAgICAgY29uc3Qgb2Rvb0NvbmZDb250ZW50ID0gYFtvcHRpb25zXVxuYWRkb25zX3BhdGggPSAke2FkZG9uc1BhdGhTdHJ9XG5kYXRhX2RpciA9IC92YXIvbGliL29kb29cbmFkbWluX3Bhc3N3ZCA9ICR7YWRtaW5QYXNzd29yZH0ke2RiRmlsdGVyU3RyfVxuZGJfaG9zdCA9ICR7cG9zdGdyZXNJbnN0YW5jZX1cbmRiX3Bhc3N3b3JkID0gJHtwZ1Bhc3N3b3JkVmFsfVxuZGJfcG9ydCA9IDU0MzJcbmRiX3RlbXBsYXRlID0gdGVtcGxhdGUwXG5kYl91c2VyID0gJHtwZ1VzZXJWYWx9XG5saXN0X2RiID0gVHJ1ZVxuYDtcbiAgICAgICAgICAgIGxvZ0luZm8oYENyZWF0aW5nIG9kb28uY29uZmApO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhvZG9vQ29uZlBhdGgsIG9kb29Db25mQ29udGVudCwgJ3V0ZjgnKTtcblxuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHRoZSBEb2NrZXIgaW1hZ2UgdG8gdXNlXG4gICAgICAgICAgICBjb25zdCBkb2NrZXJJbWFnZSA9IGN1c3RvbUltYWdlICYmIGN1c3RvbUltYWdlTmFtZVxuICAgICAgICAgICAgICAgID8gYG9kb28tY3VzdG9tOiR7Y3VzdG9tSW1hZ2VOYW1lfWBcbiAgICAgICAgICAgICAgICA6IGBvZG9vOiR7dmVyc2lvbn1gO1xuXG4gICAgICAgICAgICBsb2dJbmZvKGBVc2luZyBEb2NrZXIgaW1hZ2U6ICR7ZG9ja2VySW1hZ2V9YCk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBEb2NrZXIgQ29tcG9zZSBmaWxlXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29udGVudCA9IGBcbnNlcnZpY2VzOlxuICBvZG9vOlxuICAgIGltYWdlOiAke2RvY2tlckltYWdlfVxuICAgIGNvbnRhaW5lcl9uYW1lOiAke2luc3RhbmNlTmFtZX1cbiAgICBwb3J0czpcbiAgICAgIC0gXCIke3BvcnR9OjgwNjlcIlxuICAgIHZvbHVtZXM6XG4gICAgICAtICR7aW5zdGFuY2VOYW1lfV9kYXRhOi92YXIvbGliL29kb29cbiAgICAgIC0gLi9jb25maWc6L2V0Yy9vZG9vXG4gICAgICAtIC4vYWRkb25zOi9tbnQvZXh0cmEtYWRkb25zXG4ke2VkaXRpb24gPT09ICdFbnRlcnByaXNlJyA/IGAgICAgICAtICR7dGhpcy5wcm9qZWN0c1BhdGh9L2VudGVycHJpc2VfYWRkb25zLyR7bWFqb3JWZXJzaW9ufTovbW50L2VudGVycHJpc2UtYWRkb25zLyR7bWFqb3JWZXJzaW9ufWAgOiAnJ31cbiAgICBlbnZpcm9ubWVudDpcbiAgICAgIC0gUE9TVEdSRVNfVVNFUj0ke3BnVXNlclZhbH1cbiAgICAgIC0gUE9TVEdSRVNfUEFTU1dPUkQ9JHtwZ1Bhc3N3b3JkVmFsfVxuICAgICAgLSBQT1NUR1JFU19IT1NUPSR7cG9zdGdyZXNJbnN0YW5jZX1cbiAgICAgIC0gUE9TVEdSRVNfUE9SVD01NDMyXG4gICAgcmVzdGFydDogdW5sZXNzLXN0b3BwZWRcbiAgICBuZXR3b3JrczpcbiAgICAgIC0gJHtuZXR3b3JrTmFtZX1cbiAgICBleHRlcm5hbF9saW5rczpcbiAgICAgIC0gJHtwb3N0Z3Jlc0luc3RhbmNlfToke3Bvc3RncmVzSW5zdGFuY2V9XG5cbm5ldHdvcmtzOlxuICAke25ldHdvcmtOYW1lfTpcbiAgICBleHRlcm5hbDogdHJ1ZVxuXG52b2x1bWVzOlxuICAke2luc3RhbmNlTmFtZX1fZGF0YTpcbiAgICBkcml2ZXI6IGxvY2FsXG5gO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wb3NlRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvamVjdERpciwgJ2RvY2tlci1jb21wb3NlLnltbCcpO1xuICAgICAgICAgICAgbG9nSW5mbyhgV3JpdGluZyBEb2NrZXIgQ29tcG9zZSBmaWxlIHRvICR7Y29tcG9zZUZpbGVQYXRofWApO1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhjb21wb3NlRmlsZVBhdGgsIGNvbXBvc2VDb250ZW50LCAndXRmOCcpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgaWYgZW50ZXJwcmlzZV9hZGRvbnMgZGlyZWN0b3J5IGV4aXN0cyBhbmQgd2FybiBpZiBub3RcbiAgICAgICAgICAgIGNvbnN0IGVudGVycHJpc2VBZGRvbnNEaXIgPSBwYXRoLmpvaW4odGhpcy5wcm9qZWN0c1BhdGgsICdlbnRlcnByaXNlX2FkZG9ucycsIHZlcnNpb24pO1xuICAgICAgICAgICAgaWYgKGVkaXRpb24gPT09ICdFbnRlcnByaXNlJyAmJiAhZnMuZXhpc3RzU3luYyhlbnRlcnByaXNlQWRkb25zRGlyKSkge1xuICAgICAgICAgICAgICAgIGxvZ0luZm8oYEVudGVycHJpc2UgYWRkb25zIGRpcmVjdG9yeSBub3QgZm91bmQ6ICR7ZW50ZXJwcmlzZUFkZG9uc0Rpcn1gKTtcblxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgZGlyZWN0b3J5IHNvIERvY2tlciBDb21wb3NlIGRvZXNuJ3QgZmFpbFxuICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhlbnRlcnByaXNlQWRkb25zRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgICAgIC8vIEFkZCBhIFJFQURNRSBmaWxlIHRvIGV4cGxhaW4gd2hhdCB0byBkb1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlYWRtZVBhdGggPSBwYXRoLmpvaW4oZW50ZXJwcmlzZUFkZG9uc0RpciwgJ1JFQURNRS50eHQnKTtcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHJlYWRtZVBhdGgsIGBUaGlzIGRpcmVjdG9yeSBzaG91bGQgY29udGFpbiBPZG9vIEVudGVycHJpc2UgYWRkb25zIGZvciB2ZXJzaW9uICR7dmVyc2lvbn0uXG5JZiB5b3UgaGF2ZSBhY2Nlc3MgdG8gT2RvbyBFbnRlcnByaXNlIHJlcG9zaXRvcnksIHBsZWFzZSBjbG9uZSBvciBjb3B5IHRob3NlIGFkZG9ucyB0byB0aGlzIGxvY2F0aW9uLmAsICd1dGY4Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBpbnN0YW5jZSBpbmZvIGZpbGVcbiAgICAgICAgICAgIGNvbnN0IGluZm9GaWxlID0gcGF0aC5qb2luKHByb2plY3REaXIsICdpbnN0YW5jZS1pbmZvLmpzb24nKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYENyZWF0aW5nIGluc3RhbmNlIGluZm8gZmlsZTogJHtpbmZvRmlsZX1gKTtcblxuICAgICAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBpbnN0YW5jZU5hbWUsXG4gICAgICAgICAgICAgICAgdHlwZTogJ29kb28nLFxuICAgICAgICAgICAgICAgIHZlcnNpb24sXG4gICAgICAgICAgICAgICAgZWRpdGlvbixcbiAgICAgICAgICAgICAgICBwb3J0LFxuICAgICAgICAgICAgICAgIGFkbWluUGFzc3dvcmQsXG4gICAgICAgICAgICAgICAgZGJGaWx0ZXIsXG4gICAgICAgICAgICAgICAgY3VzdG9tSW1hZ2U6ICEhKGN1c3RvbUltYWdlICYmIGN1c3RvbUltYWdlTmFtZSksXG4gICAgICAgICAgICAgICAgY3VzdG9tSW1hZ2VOYW1lOiBjdXN0b21JbWFnZSAmJiBjdXN0b21JbWFnZU5hbWUgPyBjdXN0b21JbWFnZU5hbWUgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgcG9zdGdyZXNJbnN0YW5jZSxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhpbmZvRmlsZSwgSlNPTi5zdHJpbmdpZnkoaW5mbywgbnVsbCwgMiksICd1dGY4Jyk7XG5cbiAgICAgICAgICAgIC8vIFN0YXJ0IHRoZSBjb250YWluZXJcbiAgICAgICAgICAgIGxvZ0luZm8oYFN0YXJ0aW5nIE9kb28gY29udGFpbmVyYCk7XG4gICAgICAgICAgICBjb25zdCBjb21wb3NlQ29tbWFuZCA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9zZUNvbW1hbmQoKTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBFeGVjdXRpbmc6IGNkIFwiJHtwcm9qZWN0RGlyfVwiICYmICR7Y29tcG9zZUNvbW1hbmR9IHVwIC1kYCk7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQsIHN0ZGVyciB9ID0gYXdhaXQgZXhlY0FzeW5jKGBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSB1cCAtZGApO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN0ZG91dCkgbG9nSW5mbyhgRG9ja2VyIENvbXBvc2Ugc3Rkb3V0OiAke3N0ZG91dH1gKTtcbiAgICAgICAgICAgICAgICBpZiAoc3RkZXJyKSBsb2dJbmZvKGBEb2NrZXIgQ29tcG9zZSBzdGRlcnI6ICR7c3RkZXJyfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2dFcnJvcihgRXJyb3Igc3RhcnRpbmcgY29udGFpbmVyYCwgZXJyb3IpO1xuXG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGdldCBtb3JlIGVycm9yIGRldGFpbHNcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogbG9ncyB9ID0gYXdhaXQgZXhlY0FzeW5jKGBjZCBcIiR7cHJvamVjdERpcn1cIiAmJiAke2NvbXBvc2VDb21tYW5kfSBsb2dzYCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oYENvbnRhaW5lciBsb2dzOiAke2xvZ3N9YCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoYENvdWxkbid0IGdldCBjb250YWluZXIgbG9nc2AsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycm9yIHN0YXJ0aW5nIGNvbnRhaW5lcjogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSB0aGUgY29udGFpbmVyIGlzIHJ1bm5pbmdcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgVmVyaWZ5aW5nIGNvbnRhaW5lciBpcyBydW5uaW5nYCk7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGNvbnRhaW5lclN0YXR1cyB9ID0gYXdhaXQgZXhlY0FzeW5jKGBkb2NrZXIgcHMgLS1maWx0ZXIgXCJuYW1lPSR7aW5zdGFuY2VOYW1lfVwiIC0tZm9ybWF0IFwie3suU3RhdHVzfX1cImApO1xuXG4gICAgICAgICAgICAgICAgbG9nSW5mbyhgQ29udGFpbmVyIHN0YXR1czogJHtjb250YWluZXJTdGF0dXN9YCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNvbnRhaW5lclN0YXR1cy5pbmNsdWRlcygnVXAnKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgbWF5IG5vdCBiZSBydW5uaW5nIGNvcnJlY3RseWApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEdldCBjb250YWluZXIgbG9ncyBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogY29udGFpbmVyTG9ncyB9ID0gYXdhaXQgZXhlY0FzeW5jKGBkb2NrZXIgbG9ncyAke2luc3RhbmNlTmFtZX0gLS10YWlsIDIwYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKGBDb250YWluZXIgbG9nczogJHtjb250YWluZXJMb2dzfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3IoYENvdWxkbid0IGdldCBjb250YWluZXIgbG9nc2AsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCAvLyBTdGlsbCByZXR1cm4gc3VjY2VzcyBzaW5jZSBmaWxlcyB3ZXJlIGNyZWF0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBPZG9vIGluc3RhbmNlIGNyZWF0ZWQsIGJ1dCBjb250YWluZXIgbWF5IG5vdCBiZSBydW5uaW5nIGNvcnJlY3RseS4gQ2hlY2sgbG9ncy5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9ydFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGNoZWNraW5nIGNvbnRhaW5lciBzdGF0dXNgLCBlcnJvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxvZ0luZm8oYFN1Y2Nlc3NmdWxseSBjcmVhdGVkIE9kb28gaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfWApO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBPZG9vIGluc3RhbmNlICR7aW5zdGFuY2VOYW1lfSBjcmVhdGVkIHN1Y2Nlc3NmdWxseSBvbiBwb3J0ICR7cG9ydH0hYCxcbiAgICAgICAgICAgICAgICBwb3J0XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIGNyZWF0aW5nIE9kb28gaW5zdGFuY2UgJHtpbnN0YW5jZU5hbWV9YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRXJyb3IgY3JlYXRpbmcgaW5zdGFuY2U6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBEb2NrZXJDb21wb3NlU2VydmljZSgpOyIsIi8vIHNyYy9zZXJ2aWNlcy9lbGVjdHJvbi9tYWluUHJvY2Vzc1NlcnZpY2UudHNcbmltcG9ydCB7IGRpYWxvZywgaXBjTWFpbiwgSXBjTWFpbkludm9rZUV2ZW50IH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGRvY2tlckNvbXBvc2VTZXJ2aWNlIGZyb20gJy4uL2RvY2tlci9kb2NrZXJDb21wb3NlU2VydmljZSc7XG5pbXBvcnQgeyBsb2dJbmZvLCBsb2dFcnJvciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbi8vIERlZmluZSB0eXBlcyBmb3IgdGhlIG9wZXJhdGlvbnNcbmludGVyZmFjZSBEb2NrZXJPcGVyYXRpb25QYXJhbXMge1xuICAgIGluc3RhbmNlTmFtZT86IHN0cmluZztcbiAgICB2ZXJzaW9uPzogc3RyaW5nO1xuICAgIGVkaXRpb24/OiBzdHJpbmc7XG4gICAgYWRtaW5QYXNzd29yZD86IHN0cmluZztcbiAgICBkYkZpbHRlcj86IGJvb2xlYW47XG4gICAgc2VydmljZT86IHN0cmluZztcbiAgICB0YWlsPzogbnVtYmVyO1xuICAgIGtlZXBGaWxlcz86IGJvb2xlYW47XG4gICAgbmV0d29ya05hbWU/OiBzdHJpbmc7XG4gICAgaW5zdGFuY2VUeXBlPzogc3RyaW5nO1xuICAgIHBvcnQ/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBEb2NrZXJPcGVyYXRpb25SZXF1ZXN0IHtcbiAgICBvcGVyYXRpb246IHN0cmluZztcbiAgICBwYXJhbXM6IERvY2tlck9wZXJhdGlvblBhcmFtcztcbn1cblxuaW50ZXJmYWNlIEVycm9yRGlhbG9nT3B0aW9ucyB7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG59XG5cbi8qKlxuICogU2FmZSBoYW5kbGVyIHJlZ2lzdHJhdGlvbiAtIGNoZWNrcyBpZiBhIGhhbmRsZXIgZXhpc3RzIGJlZm9yZSByZWdpc3RlcmluZ1xuICogQHBhcmFtIGNoYW5uZWwgSVBDIGNoYW5uZWwgbmFtZVxuICogQHBhcmFtIGhhbmRsZXIgRnVuY3Rpb24gdG8gaGFuZGxlIHRoZSBJUEMgcmVxdWVzdFxuICovXG5mdW5jdGlvbiBzYWZlUmVnaXN0ZXJIYW5kbGVyPFQsIFI+KGNoYW5uZWw6IHN0cmluZywgaGFuZGxlcjogKGV2ZW50OiBJcGNNYWluSW52b2tlRXZlbnQsIGFyZzogVCkgPT4gUHJvbWlzZTxSPiB8IFIpOiB2b2lkIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBDaGVjayBpZiBhIGhhbmRsZXIgYWxyZWFkeSBleGlzdHMgZm9yIHRoaXMgY2hhbm5lbFxuICAgICAgICBjb25zdCBoYW5kbGVycyA9IChpcGNNYWluIGFzIGFueSkuX2ludm9rZUhhbmRsZXJzO1xuICAgICAgICBpZiAoaGFuZGxlcnMgJiYgaGFuZGxlcnMuaGFzICYmIGhhbmRsZXJzLmhhcyhjaGFubmVsKSkge1xuICAgICAgICAgICAgbG9nSW5mbyhgSVBDIGhhbmRsZXIgYWxyZWFkeSBleGlzdHMgZm9yIGNoYW5uZWw6ICR7Y2hhbm5lbH0sIG5vdCByZWdpc3RlcmluZyBhZ2FpbmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UgY2FuJ3QgY2hlY2sgcHJvcGVybHksIHRyeSBhIG1vcmUgcmVsaWFibGUgd2F5XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpcGNNYWluLmhhbmRsZShjaGFubmVsLCBoYW5kbGVyKTtcbiAgICAgICAgICAgIGxvZ0luZm8oYFJlZ2lzdGVyZWQgSVBDIGhhbmRsZXI6ICR7Y2hhbm5lbH1gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICgoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UuaW5jbHVkZXMoJ3NlY29uZCBoYW5kbGVyJykpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBIYW5kbGVyIGFscmVhZHkgZXhpc3RzIGZvciBjaGFubmVsOiAke2NoYW5uZWx9LCBza2lwcGluZyByZWdpc3RyYXRpb25gKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7IC8vIFJlLXRocm93IHVuZXhwZWN0ZWQgZXJyb3JzXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2dFcnJvcihgRXJyb3Igd2hpbGUgdHJ5aW5nIHRvIHJlZ2lzdGVyIGhhbmRsZXIgZm9yICR7Y2hhbm5lbH1gLCBlcnJvcik7XG4gICAgfVxufVxuXG4vKipcbiAqIEluaXRpYWxpemUgYWxsIElQQyBoYW5kbGVycyBmb3IgdGhlIG1haW4gcHJvY2Vzc1xuICovXG5leHBvcnQgZnVuY3Rpb24gaW5pdGlhbGl6ZUlwY0hhbmRsZXJzKCk6IHZvaWQge1xuICAgIGxvZ0luZm8oJ0luaXRpYWxpemluZyBJUEMgaGFuZGxlcnMnKTtcblxuICAgIC8vIERvY2tlciBvcGVyYXRpb24gaGFuZGxlciB3aXRoIGltcHJvdmVkIGxvZ2dpbmcgYW5kIGVycm9yIGhhbmRsaW5nXG4gICAgc2FmZVJlZ2lzdGVySGFuZGxlcjxEb2NrZXJPcGVyYXRpb25SZXF1ZXN0LCBhbnk+KCdkb2NrZXItb3BlcmF0aW9uJywgYXN5bmMgKF9ldmVudCwgeyBvcGVyYXRpb24sIHBhcmFtcyB9KSA9PiB7XG4gICAgICAgIGxvZ0luZm8oYEV4ZWN1dGluZyBEb2NrZXIgb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBwYXJhbXMpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgcmVzdWx0O1xuXG4gICAgICAgICAgICBzd2l0Y2ggKG9wZXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NoZWNrLWRvY2tlcic6XG4gICAgICAgICAgICAgICAgICAgIGxvZ0luZm8oJ0NoZWNraW5nIERvY2tlcicpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5jaGVja0RvY2tlcigpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ3N0YXJ0LWluc3RhbmNlJzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2Uuc3RhcnRJbnN0YW5jZShwYXJhbXMuaW5zdGFuY2VOYW1lIHx8ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlICdzdG9wLWluc3RhbmNlJzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2Uuc3RvcEluc3RhbmNlKHBhcmFtcy5pbnN0YW5jZU5hbWUgfHwgJycpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZS1pbnN0YW5jZSc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmRlbGV0ZUluc3RhbmNlKHBhcmFtcy5pbnN0YW5jZU5hbWUgfHwgJycsIHBhcmFtcy5rZWVwRmlsZXMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ2dldC1sb2dzJzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuZ2V0TG9ncyhcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcy5pbnN0YW5jZU5hbWUgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMuc2VydmljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcy50YWlsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnbGlzdC1pbnN0YW5jZXMnOlxuICAgICAgICAgICAgICAgICAgICBsb2dJbmZvKCdMaXN0aW5nIGluc3RhbmNlcycpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5saXN0SW5zdGFuY2VzKCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnZW5zdXJlLW5ldHdvcmsnOlxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5lbnN1cmVOZXR3b3JrRXhpc3RzKHBhcmFtcz8ubmV0d29ya05hbWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBEb2NrZXIgb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nSW5mbyhgRG9ja2VyIG9wZXJhdGlvbiBjb21wbGV0ZWQ6ICR7b3BlcmF0aW9ufWAsIHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgRXJyb3IgZXhlY3V0aW5nIERvY2tlciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYE9wZXJhdGlvbiBmYWlsZWQ6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFNob3cgZXJyb3IgZGlhbG9nXG4gICAgc2FmZVJlZ2lzdGVySGFuZGxlcjxFcnJvckRpYWxvZ09wdGlvbnMsIHZvaWQ+KCdzaG93LWVycm9yLWRpYWxvZycsIChfZXZlbnQsIHsgdGl0bGUsIG1lc3NhZ2UgfSkgPT4ge1xuICAgICAgICBsb2dFcnJvcihgU2hvd2luZyBlcnJvciBkaWFsb2c6ICR7dGl0bGV9YCwgbWVzc2FnZSk7XG4gICAgICAgIGRpYWxvZy5zaG93RXJyb3JCb3godGl0bGUsIG1lc3NhZ2UpO1xuICAgIH0pO1xuXG4gICAgLy8gU2hvdyBtZXNzYWdlIGRpYWxvZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RWxlY3Ryb24uTWVzc2FnZUJveE9wdGlvbnMsIEVsZWN0cm9uLk1lc3NhZ2VCb3hSZXR1cm5WYWx1ZT4oJ3Nob3ctbWVzc2FnZS1kaWFsb2cnLCBhc3luYyAoX2V2ZW50LCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGxvZ0luZm8oJ1Nob3dpbmcgbWVzc2FnZSBkaWFsb2cnLCB7IHRpdGxlOiBvcHRpb25zLnRpdGxlIH0pO1xuICAgICAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dNZXNzYWdlQm94KG9wdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgLy8gU2hvdyBzYXZlIGRpYWxvZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RWxlY3Ryb24uU2F2ZURpYWxvZ09wdGlvbnMsIEVsZWN0cm9uLlNhdmVEaWFsb2dSZXR1cm5WYWx1ZT4oJ3Nob3ctc2F2ZS1kaWFsb2cnLCBhc3luYyAoX2V2ZW50LCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGxvZ0luZm8oJ1Nob3dpbmcgc2F2ZSBkaWFsb2cnLCB7IHRpdGxlOiBvcHRpb25zLnRpdGxlIH0pO1xuICAgICAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dTYXZlRGlhbG9nKG9wdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgLy8gU2hvdyBvcGVuIGRpYWxvZ1xuICAgIHNhZmVSZWdpc3RlckhhbmRsZXI8RWxlY3Ryb24uT3BlbkRpYWxvZ09wdGlvbnMsIEVsZWN0cm9uLk9wZW5EaWFsb2dSZXR1cm5WYWx1ZT4oJ3Nob3ctb3Blbi1kaWFsb2cnLCBhc3luYyAoX2V2ZW50LCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGxvZ0luZm8oJ1Nob3dpbmcgb3BlbiBkaWFsb2cnLCB7IHRpdGxlOiBvcHRpb25zLnRpdGxlIH0pO1xuICAgICAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dPcGVuRGlhbG9nKG9wdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgbG9nSW5mbygnSVBDIGhhbmRsZXJzIGluaXRpYWxpemF0aW9uIGNvbXBsZXRlJyk7XG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZSB0aGUgYXBwbGljYXRpb24gYW5kIHBlcmZvcm0gc3RhcnR1cCB0YXNrc1xuICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gaW5pdGlhbGl6YXRpb24gaXMgY29tcGxldGVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9nSW5mbygnSW5pdGlhbGl6aW5nIGFwcGxpY2F0aW9uJyk7XG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgRG9ja2VyIGlzIHJ1bm5pbmdcbiAgICAgICAgY29uc3QgZG9ja2VyUnVubmluZyA9IGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmNoZWNrRG9ja2VyKCk7XG4gICAgICAgIGlmICghZG9ja2VyUnVubmluZykge1xuICAgICAgICAgICAgbG9nRXJyb3IoJ0RvY2tlciBpcyBub3QgcnVubmluZyEnKTtcbiAgICAgICAgICAgIC8vIFRoaXMgd2lsbCBiZSBoYW5kbGVkIGJ5IHRoZSBzcGxhc2ggc2NyZWVuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbnN1cmUgT2RvbyBuZXR3b3JrIGV4aXN0c1xuICAgICAgICBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS5lbnN1cmVOZXR3b3JrRXhpc3RzKCk7XG5cbiAgICAgICAgbG9nSW5mbygnQXBwbGljYXRpb24gaW5pdGlhbGl6ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBpbml0aWFsaXplIGFwcGxpY2F0aW9uJywgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7IC8vIFJlLXRocm93IHRvIGFsbG93IGNhbGxlciB0byBoYW5kbGUgdGhlIGVycm9yXG4gICAgfVxufSIsImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbic7XG5cbi8vIFBhdGggdG8gc3RvcmUgdGhlIGxvY2sgZmlsZVxuY29uc3QgZ2V0TG9ja0ZpbGVQYXRoID0gKCkgPT4ge1xuICAgIHJldHVybiBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICdsb2dnZXItbG9jay5qc29uJyk7XG59O1xuXG4vLyBXcml0ZSBjdXJyZW50IGxvZyBmaWxlIGluZm8gdG8gbG9jayBmaWxlXG5leHBvcnQgZnVuY3Rpb24gc2V0TG9nRmlsZUxvY2sobG9nRmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGxvY2tGaWxlUGF0aCA9IGdldExvY2tGaWxlUGF0aCgpO1xuICAgICAgICBjb25zdCBkYXRhID0geyBcbiAgICAgICAgICAgIGFjdGl2ZUxvZ0ZpbGU6IGxvZ0ZpbGVQYXRoLCBcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgdmVyc2lvbjogMiwgLy8gVmVyc2lvbiB0byBpZGVudGlmeSBzaW5nbGUgbG9nIGZpbGUgc3RyYXRlZ3lcbiAgICAgICAgfTtcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhsb2NrRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KGRhdGEpKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgbG9nZ2VyIGxvY2sgZmlsZTonLCBlcnIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vLyBSZWFkIGN1cnJlbnQgbG9nIGZpbGUgaW5mbyBmcm9tIGxvY2sgZmlsZVxuZXhwb3J0IGZ1bmN0aW9uIGdldExvZ0ZpbGVMb2NrKCk6IHN0cmluZyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGxvY2tGaWxlUGF0aCA9IGdldExvY2tGaWxlUGF0aCgpO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhsb2NrRmlsZVBhdGgpKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMobG9ja0ZpbGVQYXRoKSk7XG5cbiAgICAgICAgICAgIC8vIFdpdGggdGhlIG5ldyBzaW5nbGUgbG9nIGZpbGUgYXBwcm9hY2gsIHdlIGFsd2F5cyB3YW50IHRvIHVzZVxuICAgICAgICAgICAgLy8gdGhlIHNhbWUgbG9nIGZpbGUsIHNvIHdlIGRvbid0IG5lZWQgdG8gY2hlY2sgZm9yIHN0YWxlbmVzcyBhbnltb3JlXG4gICAgICAgICAgICAvLyBXZSBqdXN0IG5lZWQgdG8gZW5zdXJlIHRoZSBwYXRoIGV4aXN0c1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSB0aGUgcGF0aCBleGlzdHNcbiAgICAgICAgICAgIGlmIChkYXRhLmFjdGl2ZUxvZ0ZpbGUgJiYgZnMuZXhpc3RzU3luYyhkYXRhLmFjdGl2ZUxvZ0ZpbGUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRhdGEuYWN0aXZlTG9nRmlsZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIGxvZyBmaWxlIGRvZXNuJ3QgZXhpc3QsIGNyZWF0ZSBpdHMgZGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuYWN0aXZlTG9nRmlsZSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nRGlyID0gcGF0aC5kaXJuYW1lKGRhdGEuYWN0aXZlTG9nRmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMobG9nRGlyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZzLm1rZGlyU3luYyhsb2dEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChkaXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIGxvZyBkaXJlY3Rvcnk6JywgZGlyRXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcmVhZGluZyBsb2dnZXIgbG9jayBmaWxlOicsIGVycik7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0iLCJpbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIHNoZWxsLCBpcGNNYWluLCBkaWFsb2csIE1lbnUsIG5ldCwgTm90aWZpY2F0aW9uIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCB7IGluaXRpYWxpemVJcGNIYW5kbGVycywgaW5pdGlhbGl6ZUFwcCB9IGZyb20gJy4uL3NyYy9zZXJ2aWNlcy9lbGVjdHJvbi9tYWluUHJvY2Vzc1NlcnZpY2UnO1xuaW1wb3J0IGRvY2tlckNvbXBvc2VTZXJ2aWNlIGZyb20gJy4uL3NyYy9zZXJ2aWNlcy9kb2NrZXIvZG9ja2VyQ29tcG9zZVNlcnZpY2UnO1xuaW1wb3J0IHNldHRpbmdzU2VydmljZSBmcm9tIFwiLi4vc3JjL3NlcnZpY2VzL3NldHRpbmdzL3NldHRpbmdzU2VydmljZVwiO1xuaW1wb3J0IHsgc2V0TG9nRmlsZUxvY2ssIGdldExvZ0ZpbGVMb2NrIH0gZnJvbSAnLi9sb2dnZXItbG9jayc7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAndXJsJztcblxuLy8gRG9ja2VyIHBhdGggZW5oYW5jZW1lbnQgdG8gZW5zdXJlIERvY2tlciBjb21tYW5kcyB3b3JrXG4vLyBUaGlzIGZpeGVzIHRoZSBcImRvY2tlcjogY29tbWFuZCBub3QgZm91bmRcIiBpc3N1ZSBvbiBtYWNPU1xuZnVuY3Rpb24gZW5oYW5jZURvY2tlclBhdGgoKSB7XG4gIHRyeSB7XG4gICAgLy8gRG9ja2VyIHBhdGggY29uZmlndXJhdGlvbiBmb3IgZGlmZmVyZW50IHBsYXRmb3Jtc1xuICAgIGNvbnN0IERPQ0tFUl9QQVRIX0NPTkZJRyA9IHtcbiAgICAgIGRhcndpbjogW1xuICAgICAgICAnL3Vzci9sb2NhbC9iaW4nLFxuICAgICAgICAnL29wdC9ob21lYnJldy9iaW4nLFxuICAgICAgICAnL0FwcGxpY2F0aW9ucy9Eb2NrZXIuYXBwL0NvbnRlbnRzL1Jlc291cmNlcy9iaW4nLFxuICAgICAgICBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnLmRvY2tlci9iaW4nKVxuICAgICAgXSxcbiAgICAgIGxpbnV4OiBbXG4gICAgICAgICcvdXNyL2JpbicsXG4gICAgICAgICcvdXNyL2xvY2FsL2JpbidcbiAgICAgIF0sXG4gICAgICB3aW4zMjogW1xuICAgICAgICAnQzpcXFxcUHJvZ3JhbSBGaWxlc1xcXFxEb2NrZXJcXFxcRG9ja2VyXFxcXHJlc291cmNlc1xcXFxiaW4nLFxuICAgICAgICBwYXRoLmpvaW4ob3MuaG9tZWRpcigpLCAnQXBwRGF0YVxcXFxMb2NhbFxcXFxEb2NrZXJcXFxcRG9ja2VyXFxcXHJlc291cmNlc1xcXFxiaW4nKVxuICAgICAgXVxuICAgIH07XG5cbiAgICBjb25zdCBwbGF0Zm9ybSA9IHByb2Nlc3MucGxhdGZvcm0gYXMgJ2RhcndpbicgfCAnbGludXgnIHwgJ3dpbjMyJztcbiAgICBjb25zdCBwb3NzaWJsZVBhdGhzID0gRE9DS0VSX1BBVEhfQ09ORklHW3BsYXRmb3JtXSB8fCBbXTtcbiAgICBcbiAgICAvLyBGaWx0ZXIgcGF0aHMgdGhhdCBhY3R1YWxseSBleGlzdFxuICAgIGNvbnN0IGV4aXN0aW5nUGF0aHMgPSBwb3NzaWJsZVBhdGhzLmZpbHRlcihwID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmcy5leGlzdHNTeW5jKHApO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vIEdldCBjdXJyZW50IFBBVEhcbiAgICBjb25zdCBjdXJyZW50UGF0aCA9IHByb2Nlc3MuZW52LlBBVEggfHwgJyc7XG4gICAgXG4gICAgLy8gQ3JlYXRlIG5ldyBQQVRIIHdpdGggcGxhdGZvcm0tc3BlY2lmaWMgc2VwYXJhdG9yXG4gICAgY29uc3QgcGF0aFNlcGFyYXRvciA9IHBsYXRmb3JtID09PSAnd2luMzInID8gJzsnIDogJzonO1xuICAgIGNvbnN0IGVuaGFuY2VkUGF0aCA9IFsuLi5leGlzdGluZ1BhdGhzLCBjdXJyZW50UGF0aF0uam9pbihwYXRoU2VwYXJhdG9yKTtcbiAgICBcbiAgICAvLyBTZXQgdGhlIGVuaGFuY2VkIFBBVEhcbiAgICBwcm9jZXNzLmVudi5QQVRIID0gZW5oYW5jZWRQYXRoO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGBFbmhhbmNlZCBQQVRIIGZvciBEb2NrZXIgY29tbWFuZHM6ICR7cHJvY2Vzcy5lbnYuUEFUSH1gKTtcbiAgICByZXR1cm4gZW5oYW5jZWRQYXRoO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGVuaGFuY2luZyBEb2NrZXIgUEFUSDonLCBlcnJvcik7XG4gICAgcmV0dXJuIHByb2Nlc3MuZW52LlBBVEggfHwgJyc7XG4gIH1cbn1cblxuLy8gQXBwbHkgdGhlIERvY2tlciBQQVRIIGVuaGFuY2VtZW50IGltbWVkaWF0ZWx5XG5lbmhhbmNlRG9ja2VyUGF0aCgpO1xuXG4vLyBHZXQgYXBwIGRpcmVjdG9yeSAtIGZvciBib3RoIENvbW1vbkpTIGFuZCBFU00gZW52aXJvbm1lbnRzXG5sZXQgYXBwRGlyID0gJyc7XG50cnkge1xuICAvLyBUcnkgcmVndWxhciBkaXJuYW1lIGZpcnN0IChDb21tb25KUylcbiAgYXBwRGlyID0gX19kaXJuYW1lO1xuICBjb25zb2xlLmxvZygnVXNpbmcgQ29tbW9uSlMgX19kaXJuYW1lOicsIGFwcERpcik7XG59IGNhdGNoIChlKSB7XG4gIC8vIElmIHRoYXQgZmFpbHMsIHRyeSB0byB1c2UgYXBwLmdldEFwcFBhdGgoKSBhcyBmYWxsYmFja1xuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKCdDb21tb25KUyBfX2Rpcm5hbWUgbm90IGF2YWlsYWJsZSwgdXNpbmcgZmFsbGJhY2snKTtcbiAgICBhcHBEaXIgPSBhcHAuZ2V0QXBwUGF0aCgpO1xuICAgIGNvbnNvbGUubG9nKCdVc2luZyBhcHAgcGF0aCBmYWxsYmFjazonLCBhcHBEaXIpO1xuICB9IGNhdGNoIChlMikge1xuICAgIC8vIExhc3QgcmVzb3J0IC0gdXNlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnlcbiAgICBjb25zb2xlLmVycm9yKCdCb3RoIF9fZGlybmFtZSBhbmQgYXBwLmdldEFwcFBhdGgoKSBmYWlsZWQ6JywgZTIpO1xuICAgIGFwcERpciA9IHByb2Nlc3MuY3dkKCk7XG4gICAgY29uc29sZS5sb2coJ1VzaW5nIGN3ZCBmYWxsYmFjazonLCBhcHBEaXIpO1xuICB9XG59XG5cbi8vIExvZyB0aGUgZW52aXJvbm1lbnQgYW5kIHBhdGhzIGZvciBlYXNpZXIgZGVidWdnaW5nXG5jb25zb2xlLmxvZygnTm9kZSBlbnZpcm9ubWVudDonLCBwcm9jZXNzLmVudi5OT0RFX0VOVik7XG5jb25zb2xlLmxvZygnQ3VycmVudCB3b3JraW5nIGRpcmVjdG9yeTonLCBwcm9jZXNzLmN3ZCgpKTtcbmNvbnNvbGUubG9nKCdBcHAgZGlyZWN0b3J5OicsIGFwcERpcik7XG5cbmxldCBBQ1RJVkVfTE9HX0ZJTEU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4vLyBMb2cgcm90YXRpb24gY29uZmlndXJhdGlvblxuY29uc3QgTE9HX0ZJTEVfU0laRV9MSU1JVCA9IDUgKiAxMDI0ICogMTAyNDsgLy8gNSBNQiBpbiBieXRlc1xuY29uc3QgTUFYX0xPR19GSUxFUyA9IDU7IC8vIE1heGltdW0gbnVtYmVyIG9mIHJvdGF0ZWQgbG9nIGZpbGVzIHRvIGtlZXBcblxuXG4vLyBTaW1wbGUgaW5saW5lIGxvZ2dlciBmb3IgdGhlIG1haW4gcHJvY2Vzc1xuY29uc3QgbG9nSW5mbyA9IChtZXNzYWdlOiBzdHJpbmcsIGRhdGE/OiBhbnkpID0+IHtcbiAgY29uc3QgbG9nTWVzc2FnZSA9IGBbJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCl9XSBbSU5GT10gJHttZXNzYWdlfSR7ZGF0YSA/ICcgJyArIEpTT04uc3RyaW5naWZ5KGRhdGEpIDogJyd9YDtcbiAgY29uc29sZS5sb2cobG9nTWVzc2FnZSk7XG4gIGFwcGVuZFRvTG9nRmlsZShsb2dNZXNzYWdlKTtcbn07XG5cbmNvbnN0IGxvZ0Vycm9yID0gKG1lc3NhZ2U6IHN0cmluZywgZXJyb3I/OiBhbnkpID0+IHtcbiAgbGV0IGVycm9yU3RyID0gJyc7XG4gIGlmIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBlcnJvclN0ciA9IGBcXG4ke2Vycm9yLnN0YWNrIHx8IGVycm9yLm1lc3NhZ2V9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXJyb3JTdHIgPSBgXFxuJHtKU09OLnN0cmluZ2lmeShlcnJvcil9YDtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICBlcnJvclN0ciA9IGBcXG4ke1N0cmluZyhlcnJvcil9YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBsb2dNZXNzYWdlID0gYFske25ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcoKX1dIFtFUlJPUl0gJHttZXNzYWdlfSR7ZXJyb3JTdHJ9YDtcbiAgY29uc29sZS5lcnJvcihsb2dNZXNzYWdlKTtcbiAgYXBwZW5kVG9Mb2dGaWxlKGxvZ01lc3NhZ2UpO1xufTtcblxuLy8gR2V0IGxvZyBmaWxlIHBhdGhcbmZ1bmN0aW9uIGdldExvZ0ZpbGVQYXRoKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGFwcERhdGFQYXRoID0gYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyk7XG4gICAgbGV0IHdvcmtEaXJQYXRoID0gbnVsbDtcblxuICAgIC8vIFRyeSB0byBnZXQgd29yayBkaXJlY3RvcnkgcGF0aFxuICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHBEYXRhUGF0aCwgJ3dvcmtkaXIuanNvbicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgd29ya0RpclBhdGggPSBkYXRhLndvcmtEaXI7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb246JywgZXJyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgbG9ncyBkaXJlY3RvcnlcbiAgICBjb25zdCBsb2dzUGF0aCA9IHdvcmtEaXJQYXRoID8gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCAnbG9ncycpIDogcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnbG9ncycpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dzUGF0aCkpIHtcbiAgICAgIGZzLm1rZGlyU3luYyhsb2dzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgLy8gVXNpbmcgYSBmaXhlZCBsb2cgZmlsZSBuYW1lIGluc3RlYWQgb2YgdGltZXN0YW1wLWJhc2VkXG4gICAgcmV0dXJuIHBhdGguam9pbihsb2dzUGF0aCwgJ2FwcC5sb2cnKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBsb2cgZmlsZSBwYXRoOicsIGVycik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLy8gR2xvYmFsIGxvZyBmaWxlIHBhdGhcbmxldCBsb2dGaWxlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbi8vIEluaXRpYWxpemUgbG9nIGZpbGVcbmZ1bmN0aW9uIGluaXRMb2dGaWxlKCkge1xuICB0cnkge1xuICAgIGxvZ0ZpbGVQYXRoID0gZ2V0TG9nRmlsZVBhdGgoKTtcbiAgICBpZiAobG9nRmlsZVBhdGgpIHtcbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICAgICAgLy8gQ3JlYXRlIG5ldyBsb2cgZmlsZSBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICAgIGNvbnN0IGluaXRpYWxNZXNzYWdlID1cbiAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgYE9kb28gTWFuYWdlciAtIEFwcGxpY2F0aW9uIExvZyAoTWFpbiBQcm9jZXNzKVxcbmAgK1xuICAgICAgICAgICAgYFN0YXJ0ZWQ6ICR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygpfVxcbmAgK1xuICAgICAgICAgICAgYEVudmlyb25tZW50OiAke3Byb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICd1bmtub3duJ31cXG5gICtcbiAgICAgICAgICAgIGA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmA7XG5cbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhsb2dGaWxlUGF0aCwgaW5pdGlhbE1lc3NhZ2UpO1xuICAgICAgICBjb25zb2xlLmxvZyhgTG9nIGZpbGUgY3JlYXRlZCBhdDogJHtsb2dGaWxlUGF0aH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEFkZCBhIHNlc3Npb24gc2VwYXJhdG9yIHRvIGV4aXN0aW5nIGxvZyBmaWxlXG4gICAgICAgIGNvbnN0IHNlc3Npb25NZXNzYWdlID1cbiAgICAgICAgICAgIGBcXG49PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxcbmAgK1xuICAgICAgICAgICAgYFNlc3Npb24gc3RhcnRlZDogJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCl9XFxuYCArXG4gICAgICAgICAgICBgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cXG5gO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmVmb3JlIGFwcGVuZGluZ1xuICAgICAgICBjaGVja0FuZFJvdGF0ZUxvZ0ZpbGUoKTtcbiAgICAgICAgXG4gICAgICAgIGZzLmFwcGVuZEZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCBzZXNzaW9uTWVzc2FnZSk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBVc2luZyBleGlzdGluZyBsb2cgZmlsZSBhdDogJHtsb2dGaWxlUGF0aH1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluaXRpYWxpemluZyBsb2cgZmlsZTonLCBlcnIpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgbG9nIGZpbGUgbmVlZHMgcm90YXRpb24gYmFzZWQgb24gc2l6ZVxuICogQHJldHVybnMgdHJ1ZSBpZiBsb2cgcm90YXRpb24gd2FzIHBlcmZvcm1lZCwgZmFsc2Ugb3RoZXJ3aXNlXG4gKi9cbmZ1bmN0aW9uIGNoZWNrQW5kUm90YXRlTG9nRmlsZSgpOiBib29sZWFuIHtcbiAgaWYgKCFsb2dGaWxlUGF0aCB8fCAhZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMobG9nRmlsZVBhdGgpO1xuICAgIGlmIChzdGF0cy5zaXplIDwgTE9HX0ZJTEVfU0laRV9MSU1JVCkge1xuICAgICAgcmV0dXJuIGZhbHNlOyAvLyBObyByb3RhdGlvbiBuZWVkZWRcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZyhgTG9nIGZpbGUgc2l6ZSAoJHtzdGF0cy5zaXplfSBieXRlcykgZXhjZWVkcyBsaW1pdCAoJHtMT0dfRklMRV9TSVpFX0xJTUlUfSBieXRlcyksIHJvdGF0aW5nIGxvZ3MuLi5gKTtcbiAgICBcbiAgICAvLyBHZXQgdGhlIGxvZ3MgZGlyZWN0b3J5XG4gICAgY29uc3QgbG9nc0RpciA9IHBhdGguZGlybmFtZShsb2dGaWxlUGF0aCk7XG4gICAgXG4gICAgLy8gR2V0IGV4aXN0aW5nIHJvdGF0ZWQgbG9nIGZpbGVzXG4gICAgY29uc3QgYmFzZUxvZ05hbWUgPSBwYXRoLmJhc2VuYW1lKGxvZ0ZpbGVQYXRoLCAnLmxvZycpO1xuICAgIGNvbnN0IHJvdGF0ZWRMb2dzID0gZnMucmVhZGRpclN5bmMobG9nc0RpcilcbiAgICAgIC5maWx0ZXIoZiA9PiBmLnN0YXJ0c1dpdGgoYCR7YmFzZUxvZ05hbWV9LmApICYmIGYuZW5kc1dpdGgoJy5sb2cnKSlcbiAgICAgIC5zb3J0KCk7IC8vIFNvcnQgdG8gZmluZCBoaWdoZXN0IHJvdGF0aW9uIG51bWJlclxuICAgIFxuICAgIC8vIFNoaWZ0IG9sZGVyIGxvZ3MgdG8gbWFrZSByb29tIGZvciBuZXcgcm90YXRpb25cbiAgICBmb3IgKGxldCBpID0gcm90YXRlZExvZ3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gcm90YXRlZExvZ3NbaV0ubWF0Y2gobmV3IFJlZ0V4cChgJHtiYXNlTG9nTmFtZX1cXC4oXFxkKylcXC5sb2dgKSk7XG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY29uc3Qgcm90YXRpb25OdW1iZXIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICAgICAgICBpZiAocm90YXRpb25OdW1iZXIgPj0gTUFYX0xPR19GSUxFUyAtIDEpIHtcbiAgICAgICAgICAvLyBEZWxldGUgdGhlIG9sZGVzdCBsb2cgZmlsZSBpZiB3ZSBhbHJlYWR5IGhhdmUgbWF4IG51bWJlciBvZiByb3RhdGlvbnNcbiAgICAgICAgICBjb25zdCBvbGRlc3RMb2cgPSBwYXRoLmpvaW4obG9nc0Rpciwgcm90YXRlZExvZ3NbaV0pO1xuICAgICAgICAgIGZzLnVubGlua1N5bmMob2xkZXN0TG9nKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgRGVsZXRlZCBvbGQgbG9nIGZpbGU6ICR7b2xkZXN0TG9nfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFJlbmFtZSB0byB0aGUgbmV4dCByb3RhdGlvbiBudW1iZXJcbiAgICAgICAgICBjb25zdCBvbGRQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIHJvdGF0ZWRMb2dzW2ldKTtcbiAgICAgICAgICBjb25zdCBuZXdQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIGAke2Jhc2VMb2dOYW1lfS4ke3JvdGF0aW9uTnVtYmVyICsgMX0ubG9nYCk7XG4gICAgICAgICAgZnMucmVuYW1lU3luYyhvbGRQYXRoLCBuZXdQYXRoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgUm90YXRlZCBsb2cgZmlsZTogJHtvbGRQYXRofSAtPiAke25ld1BhdGh9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gUmVuYW1lIHRoZSBjdXJyZW50IGxvZyBmaWxlIHRvIGJlIC4xLmxvZ1xuICAgIGNvbnN0IHJvdGF0ZWRMb2dQYXRoID0gcGF0aC5qb2luKGxvZ3NEaXIsIGAke2Jhc2VMb2dOYW1lfS4xLmxvZ2ApO1xuICAgIGZzLnJlbmFtZVN5bmMobG9nRmlsZVBhdGgsIHJvdGF0ZWRMb2dQYXRoKTtcbiAgICBjb25zb2xlLmxvZyhgUm90YXRlZCBtYWluIGxvZyBmaWxlOiAke2xvZ0ZpbGVQYXRofSAtPiAke3JvdGF0ZWRMb2dQYXRofWApO1xuICAgIFxuICAgIC8vIENyZWF0ZSBhIG5ldyBlbXB0eSBsb2cgZmlsZVxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgaW5pdGlhbE1lc3NhZ2UgPVxuICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYCArXG4gICAgICBgT2RvbyBNYW5hZ2VyIC0gQXBwbGljYXRpb24gTG9nIChSb3RhdGVkKVxcbmAgK1xuICAgICAgYFN0YXJ0ZWQ6ICR7bm93LnRvTG9jYWxlU3RyaW5nKCl9XFxuYCArXG4gICAgICBgRW52aXJvbm1lbnQ6ICR7cHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ3Vua25vd24nfVxcbmAgK1xuICAgICAgYD09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XFxuYDtcbiAgICBmcy53cml0ZUZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCBpbml0aWFsTWVzc2FnZSk7XG4gICAgXG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJvdGF0aW5nIGxvZyBmaWxlOicsIGVycik7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vIEFwcGVuZCB0byBsb2cgZmlsZVxuZnVuY3Rpb24gYXBwZW5kVG9Mb2dGaWxlKG1lc3NhZ2U6IHN0cmluZykge1xuICBpZiAoIWxvZ0ZpbGVQYXRoKSByZXR1cm47XG5cbiAgdHJ5IHtcbiAgICAvLyBDaGVjayBpZiBsb2cgZmlsZSBuZWVkcyByb3RhdGlvbiBiZWZvcmUgYXBwZW5kaW5nXG4gICAgY2hlY2tBbmRSb3RhdGVMb2dGaWxlKCk7XG4gICAgXG4gICAgZnMuYXBwZW5kRmlsZVN5bmMobG9nRmlsZVBhdGgsIG1lc3NhZ2UgKyAnXFxuJyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdyaXRpbmcgdG8gbG9nIGZpbGU6JywgZXJyKTtcbiAgfVxufVxuXG4vLyBMb2cgY2xlYW51cCBmdW5jdGlvbmFsaXR5IHJlbW92ZWQgYXMgbG9nIHJvdGF0aW9uIGhhbmRsZXMgdGhpcyBub3dcblxuLy8gU2V0IGFwcGxpY2F0aW9uIG1ldGFkYXRhXG5hcHAuc2V0TmFtZSgnb2Rvby1tYW5hZ2VyJyk7XG5hcHAuc2V0QWJvdXRQYW5lbE9wdGlvbnMoe1xuICBhcHBsaWNhdGlvbk5hbWU6ICdPZG9vIE1hbmFnZXInLFxuICBhcHBsaWNhdGlvblZlcnNpb246IGFwcC5nZXRWZXJzaW9uKCksXG4gIHZlcnNpb246IGFwcC5nZXRWZXJzaW9uKCksXG4gIGNvcHlyaWdodDogJ8KpIDIwMjUgV2ViR3JhcGhpeCcsXG4gIGF1dGhvcnM6IFsnV2ViR3JhcGhpeCddLFxuICB3ZWJzaXRlOiAnaHR0cHM6Ly9vZG9vLndlYmdyYXBoaXgub25saW5lJyxcbiAgY3JlZGl0czogJ1Byb2Zlc3Npb25hbCBPZG9vIGluc3RhbmNlIG1hbmFnZW1lbnQgdG9vbCBmb3IgRG9ja2VyIGVudmlyb25tZW50cydcbn0pO1xuXG4vLyBHbG9iYWwgZGVjbGFyYXRpb25zIGZvciBUeXBlU2NyaXB0XG5kZWNsYXJlIGdsb2JhbCB7XG4gIHZhciBhbGxvd1NwbGFzaENsb3NlOiBib29sZWFuO1xuICB2YXIgY29taW5nRnJvbVNldHVwOiBib29sZWFuO1xuICB2YXIgY3VycmVudFRoZW1lTW9kZTogc3RyaW5nIHwgbnVsbDtcbiAgdmFyIHRoZW1lVXBkYXRlSW5Qcm9ncmVzczogYm9vbGVhbjtcbn1cblxuLy8gSW5pdGlhbGl6ZSBnbG9iYWwgdmFyaWFibGVzXG5nbG9iYWwuYWxsb3dTcGxhc2hDbG9zZSA9IGZhbHNlO1xuZ2xvYmFsLmNvbWluZ0Zyb21TZXR1cCA9IGZhbHNlO1xuZ2xvYmFsLmN1cnJlbnRUaGVtZU1vZGUgPSBudWxsO1xuZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXG4vLyBEZWZpbmUgaW50ZXJmYWNlIGZvciBpcGNNYWluIHdpdGggaGFuZGxlcnMgcHJvcGVydHlcbmludGVyZmFjZSBJcGNNYWluV2l0aEhhbmRsZXJzIGV4dGVuZHMgRWxlY3Ryb24uSXBjTWFpbiB7XG4gIGhhbmRsZXJzPzogUmVjb3JkPHN0cmluZywgKGV2ZW50OiBFbGVjdHJvbi5JcGNNYWluSW52b2tlRXZlbnQsIC4uLmFyZ3M6IGFueVtdKSA9PiBQcm9taXNlPGFueT4+O1xufVxuXG4vLyBDYXN0IGlwY01haW4gdG8gb3VyIGV4dGVuZGVkIGludGVyZmFjZVxuY29uc3QgdHlwZWRJcGNNYWluID0gaXBjTWFpbiBhcyBJcGNNYWluV2l0aEhhbmRsZXJzO1xuXG5pcGNNYWluLm9uKCdyZWdpc3Rlci1sb2ctZmlsZScsIChfZXZlbnQsIGxvZ0ZpbGVQYXRoKSA9PiB7XG4gIHRyeSB7XG4gICAgaWYgKCFBQ1RJVkVfTE9HX0ZJTEUgJiYgbG9nRmlsZVBhdGggJiYgZnMuZXhpc3RzU3luYyhsb2dGaWxlUGF0aCkpIHtcbiAgICAgIEFDVElWRV9MT0dfRklMRSA9IGxvZ0ZpbGVQYXRoO1xuICAgICAgc2V0TG9nRmlsZUxvY2sobG9nRmlsZVBhdGgpO1xuICAgICAgbG9nSW5mbyhgUmVnaXN0ZXJlZCBhY3RpdmUgbG9nIGZpbGU6ICR7bG9nRmlsZVBhdGh9YCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciByZWdpc3RlcmluZyBsb2cgZmlsZTonLCBlcnIpO1xuICB9XG59KTtcblxuaXBjTWFpbi5oYW5kbGUoJ2dldC1hY3RpdmUtbG9nLWZpbGUnLCAoKSA9PiB7XG4gIHRyeSB7XG4gICAgLy8gQWx3YXlzIGdldCBmcmVzaCBmcm9tIGxvY2sgZmlsZSB0byBlbnN1cmUgd2UncmUgbm90IHVzaW5nIGEgc3RhbGUgbG9ja1xuICAgIEFDVElWRV9MT0dfRklMRSA9IGdldExvZ0ZpbGVMb2NrKCk7XG4gICAgcmV0dXJuIEFDVElWRV9MT0dfRklMRTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBhY3RpdmUgbG9nIGZpbGU6JywgZXJyKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8vIEdldCBsb2cgZmlsZSBwYXRoIGhhbmRsZXJcbmlwY01haW4uaGFuZGxlKCdnZXQtbG9nLWZpbGUtcGF0aCcsIGFzeW5jICgpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBhcHBEYXRhUGF0aCA9IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgIGxldCB3b3JrRGlyUGF0aCA9IG51bGw7XG4gICAgXG4gICAgLy8gVHJ5IHRvIGdldCB3b3JrIGRpcmVjdG9yeSBwYXRoXG4gICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcERhdGFQYXRoLCAnd29ya2Rpci5qc29uJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmMod29ya0RpckZpbGVQYXRoKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICB3b3JrRGlyUGF0aCA9IGRhdGEud29ya0RpcjtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24nLCBlcnIpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBHZXQgdGhlIGxvZ3MgZGlyZWN0b3J5XG4gICAgY29uc3QgbG9nc1BhdGggPSB3b3JrRGlyUGF0aCAmJiBmcy5leGlzdHNTeW5jKHdvcmtEaXJQYXRoKSBcbiAgICAgID8gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCAnbG9ncycpIFxuICAgICAgOiBwYXRoLmpvaW4oYXBwRGF0YVBhdGgsICdsb2dzJyk7XG4gICAgXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGxvZ3NQYXRoKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIEFsd2F5cyByZXR1cm4gdGhlIG1haW4gYXBwLmxvZyBmaWxlIGlmIGl0IGV4aXN0c1xuICAgIGNvbnN0IG1haW5Mb2dQYXRoID0gcGF0aC5qb2luKGxvZ3NQYXRoLCAnYXBwLmxvZycpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKG1haW5Mb2dQYXRoKSkge1xuICAgICAgcmV0dXJuIG1haW5Mb2dQYXRoO1xuICAgIH1cbiAgICBcbiAgICAvLyBBcyBhIGZhbGxiYWNrLCBnZXQgdGhlIG1vc3QgcmVjZW50IGxvZyBmaWxlXG4gICAgY29uc3QgbG9nRmlsZXMgPSBmcy5yZWFkZGlyU3luYyhsb2dzUGF0aClcbiAgICAgIC5maWx0ZXIoZmlsZSA9PiBmaWxlLmVuZHNXaXRoKCcubG9nJykpXG4gICAgICAubWFwKGZpbGUgPT4gcGF0aC5qb2luKGxvZ3NQYXRoLCBmaWxlKSk7XG4gICAgXG4gICAgaWYgKGxvZ0ZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIFNvcnQgYnkgZmlsZSBjcmVhdGlvbiB0aW1lIChtb3N0IHJlY2VudCBmaXJzdClcbiAgICByZXR1cm4gbG9nRmlsZXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgY29uc3Qgc3RhdEEgPSBmcy5zdGF0U3luYyhhKTtcbiAgICAgIGNvbnN0IHN0YXRCID0gZnMuc3RhdFN5bmMoYik7XG4gICAgICByZXR1cm4gc3RhdEIuYmlydGh0aW1lTXMgLSBzdGF0QS5iaXJ0aHRpbWVNcztcbiAgICB9KVswXTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgaW4gZ2V0LWxvZy1maWxlLXBhdGggaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8vIE9wZW4gbG9nIGZpbGUgaGFuZGxlclxuaXBjTWFpbi5oYW5kbGUoJ29wZW4tbG9nLWZpbGUnLCBhc3luYyAoX2V2ZW50LCB7IGxvZ0ZpbGVQYXRoIH0pID0+IHtcbiAgdHJ5IHtcbiAgICBpZiAoIWxvZ0ZpbGVQYXRoIHx8ICFmcy5leGlzdHNTeW5jKGxvZ0ZpbGVQYXRoKSkge1xuICAgICAgbG9nRXJyb3IoYExvZyBmaWxlIG5vdCBmb3VuZDogJHtsb2dGaWxlUGF0aH1gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBhd2FpdCBzaGVsbC5vcGVuUGF0aChsb2dGaWxlUGF0aCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nRXJyb3IoJ0Vycm9yIGluIG9wZW4tbG9nLWZpbGUgaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG4vLyBIZWxwZXIgZnVuY3Rpb24gdG8gZW1pdCBtYWluLXdpbmRvdy12aXNpYmxlIGV2ZW50XG5mdW5jdGlvbiBlbWl0TWFpbldpbmRvd1Zpc2libGUod2luZG93OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmICh3aW5kb3cgJiYgIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICB3aW5kb3cud2ViQ29udGVudHMuc2VuZCgnbWFpbi13aW5kb3ctdmlzaWJsZScpO1xuICAgIH1cbiAgfSwgMjAwKTtcbn1cblxuLy8gSGFuZGxlIGFwcCB0ZXJtaW5hdGlvbiB3aXRoIGNvbmZpcm1hdGlvbiB3aGVuIG5lZWRlZFxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlQXBwVGVybWluYXRpb24obWFpbldpbmRvdzogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZCB8IG51bGwpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgaWYgKCFtYWluV2luZG93IHx8IG1haW5XaW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgIHJldHVybiB0cnVlOyAvLyBBbGxvdyB0ZXJtaW5hdGlvbiBpZiB3aW5kb3cgZG9lc24ndCBleGlzdFxuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBDcmVhdGUgYSBwcm9taXNlIHRoYXQgd2lsbCByZXNvbHZlIGJhc2VkIG9uIElQQyBjb21tdW5pY2F0aW9uXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG4gICAgICAvLyBTZXQgdXAgYSBvbmUtdGltZSBsaXN0ZW5lciBmb3IgdGhlIHJlc3BvbnNlXG4gICAgICBjb25zdCByZXNwb25zZUhhbmRsZXIgPSAoX2V2ZW50OiBhbnksIHsgY2FuVGVybWluYXRlLCBhbHJlYWR5Q29uZmlybWVkIH06IHsgY2FuVGVybWluYXRlOiBib29sZWFuLCBhbHJlYWR5Q29uZmlybWVkPzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICAgIGlwY01haW4ucmVtb3ZlTGlzdGVuZXIoJ2V4aXQtY29uZmlybWF0aW9uLXJlc3BvbnNlJywgcmVzcG9uc2VIYW5kbGVyKTtcbiAgICAgICAgXG4gICAgICAgIC8vIElmIGFscmVhZHkgY29uZmlybWVkIGJ5IHJlbmRlcmVyICh1c2VyIGNsaWNrZWQgXCJFeGl0IEFueXdheVwiKSwgd2UgZG9uJ3QgbmVlZCBmdXJ0aGVyIGNoZWNrc1xuICAgICAgICBpZiAoYWxyZWFkeUNvbmZpcm1lZCkge1xuICAgICAgICAgIGxvZ0luZm8oJ0V4aXQgYWxyZWFkeSBjb25maXJtZWQgYnkgdXNlciwgYWxsb3dpbmcgdGVybWluYXRpb24nKTtcbiAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmVzb2x2ZShjYW5UZXJtaW5hdGUpO1xuICAgICAgfTtcblxuICAgICAgaXBjTWFpbi5vbmNlKCdleGl0LWNvbmZpcm1hdGlvbi1yZXNwb25zZScsIHJlc3BvbnNlSGFuZGxlcik7XG5cbiAgICAgIC8vIFNlbmQgdGhlIHJlcXVlc3QgdG8gY2hlY2sgaWYgdGVybWluYXRpb24gaXMgYWxsb3dlZFxuICAgICAgbWFpbldpbmRvdy53ZWJDb250ZW50cy5zZW5kKCdjaGVjay1ydW5uaW5nLWNvbnRhaW5lcnMnKTtcblxuICAgICAgLy8gU2V0IGEgdGltZW91dCBpbiBjYXNlIHdlIGRvbid0IGdldCBhIHJlc3BvbnNlXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaXBjTWFpbi5yZW1vdmVMaXN0ZW5lcignZXhpdC1jb25maXJtYXRpb24tcmVzcG9uc2UnLCByZXNwb25zZUhhbmRsZXIpO1xuICAgICAgICBsb2dJbmZvKCdObyByZXNwb25zZSBmcm9tIHJlbmRlcmVyIGFib3V0IHJ1bm5pbmcgY29udGFpbmVycywgYWxsb3dpbmcgdGVybWluYXRpb24nKTtcbiAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgIH0sIDIwMDApO1xuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBjaGVja2luZyBmb3IgcnVubmluZyBjb250YWluZXJzJywgZXJyb3IpO1xuICAgIHJldHVybiB0cnVlOyAvLyBJbiBjYXNlIG9mIGVycm9yLCBhbGxvdyB0ZXJtaW5hdGlvblxuICB9XG59XG5cbi8vIEhlbHBlciBmdW5jdGlvbiBmb3IgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRcbmZ1bmN0aW9uIGxvYWRBbmRTaG93RGV2V2luZG93KHdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdykge1xuICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuXG4gIHdpbmRvdy5sb2FkVVJMKCdodHRwOi8vbG9jYWxob3N0OjUxNzMvIy9tYWluJykudGhlbigoKSA9PiB7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KS5jYXRjaChlcnIgPT4ge1xuICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBtYWluIFVSTCcsIGVycik7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KTtcblxuICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgd2luZG93LndlYkNvbnRlbnRzLm9wZW5EZXZUb29scyh7IG1vZGU6ICdkZXRhY2gnIH0pO1xuICB9XG59XG5cbi8vIEhlbHBlciBmdW5jdGlvbiBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudFxuZnVuY3Rpb24gbG9hZEFuZFNob3dQcm9kV2luZG93KHdpbmRvdzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdykge1xuICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuXG4gIC8vIFVzZSBwYXRoLnJlc29sdmUgZm9yIGNvbnNpc3RlbnQgcGF0aCByZXNvbHV0aW9uXG4gIGNvbnN0IGh0bWxQYXRoID0gcGF0aC5yZXNvbHZlKGFwcERpciwgJy4uL2Rpc3QvaW5kZXguaHRtbCcpO1xuICBsb2dJbmZvKGBMb2FkaW5nIG1haW4gZmlsZSBmcm9tOiAke2h0bWxQYXRofWApO1xuICBcbiAgd2luZG93LmxvYWRGaWxlKGh0bWxQYXRoLCB7IGhhc2g6ICdtYWluJyB9KS50aGVuKCgpID0+IHtcbiAgICBpZiAoIXdpbmRvdyB8fCB3aW5kb3cuaXNEZXN0cm95ZWQoKSkgcmV0dXJuO1xuICAgIHdpbmRvdy5zaG93KCk7XG4gICAgd2luZG93LmZvY3VzKCk7XG4gICAgZW1pdE1haW5XaW5kb3dWaXNpYmxlKHdpbmRvdyk7XG4gIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIG1haW4gZmlsZScsIGVycik7XG4gICAgaWYgKCF3aW5kb3cgfHwgd2luZG93LmlzRGVzdHJveWVkKCkpIHJldHVybjtcbiAgICB3aW5kb3cuc2hvdygpO1xuICAgIHdpbmRvdy5mb2N1cygpO1xuICAgIGVtaXRNYWluV2luZG93VmlzaWJsZSh3aW5kb3cpO1xuICB9KTtcbn1cblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIHNhZmVseSBsb2FkIGFuZCBzaG93IGEgd2luZG93IGJhc2VkIG9uIHRoZSBlbnZpcm9ubWVudFxuZnVuY3Rpb24gbG9hZEFuZFNob3dXaW5kb3cod2luZG93OiBCcm93c2VyV2luZG93IHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuICBpZiAoIXdpbmRvdykge1xuICAgIGxvZ0Vycm9yKCdDYW5ub3QgbG9hZCBhbmQgc2hvdyBhIG51bGwgb3IgdW5kZWZpbmVkIHdpbmRvdyEnKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBsb2FkQW5kU2hvd0RldldpbmRvdyh3aW5kb3cpO1xuICB9IGVsc2Uge1xuICAgIGxvYWRBbmRTaG93UHJvZFdpbmRvdyh3aW5kb3cpO1xuICB9XG59XG5cbi8vIFN0b3JlIHdpbmRvdyByZWZlcmVuY2VzIHRvIHByZXZlbnQgZ2FyYmFnZSBjb2xsZWN0aW9uXG5pbnRlcmZhY2UgV2luZG93c1JlZ2lzdHJ5IHtcbiAgc3BsYXNoPzogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbiAgbWFpbj86IEJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQ7XG4gIHNldHVwPzogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbiAgW2tleTogc3RyaW5nXTogQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZDtcbn1cblxuLy8gV2luZG93IGNvbmZpZ3VyYXRpb24gYnkgdHlwZVxuaW50ZXJmYWNlIFdpbmRvd0NvbmZpZyB7XG4gIHdpZHRoOiBudW1iZXI7XG4gIGhlaWdodDogbnVtYmVyO1xuICByZXNpemFibGU6IGJvb2xlYW47XG4gIG1pbldpZHRoPzogbnVtYmVyO1xuICBtaW5IZWlnaHQ/OiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG59XG5cbi8vIERlZmluZSBkZWZhdWx0IHdpbmRvdyBjb25maWd1cmF0aW9uc1xuY29uc3Qgd2luZG93Q29uZmlnczogUmVjb3JkPHN0cmluZywgV2luZG93Q29uZmlnPiA9IHtcbiAgJ21haW4nOiB7XG4gICAgd2lkdGg6IDEyMDAsXG4gICAgaGVpZ2h0OiA5MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiAxMjAwLFxuICAgIG1pbkhlaWdodDogNzUwLFxuICAgIHRpdGxlOiAnT2RvbyBNYW5hZ2VyJ1xuICB9LFxuICAnc3BsYXNoJzoge1xuICAgIHdpZHRoOiA1MDAsXG4gICAgaGVpZ2h0OiA0MDAsXG4gICAgcmVzaXphYmxlOiBmYWxzZSxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlcidcbiAgfSxcbiAgJ3NldHVwJzoge1xuICAgIHdpZHRoOiA5NTAsXG4gICAgaGVpZ2h0OiA4MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA4MDAsXG4gICAgbWluSGVpZ2h0OiA2MDAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXInXG4gIH0sXG4gICdoZWxwJzoge1xuICAgIHdpZHRoOiA3NTAsXG4gICAgaGVpZ2h0OiA3MDAsXG4gICAgcmVzaXphYmxlOiB0cnVlLFxuICAgIG1pbldpZHRoOiA2MDAsXG4gICAgbWluSGVpZ2h0OiA1MDAsXG4gICAgdGl0bGU6ICdPZG9vIE1hbmFnZXIgLSBIZWxwJ1xuICB9LFxuICBcInNldHRpbmdzXCI6IHtcbiAgICB3aWR0aDogOTAwLFxuICAgIGhlaWdodDogNzAwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogODAwLFxuICAgIG1pbkhlaWdodDogNjAwLFxuICAgIHRpdGxlOiBcIk9kb28gTWFuYWdlciAtIFNldHRpbmdzXCJcbiAgfSxcbiAgJ25ldy1pbnN0YW5jZSc6IHtcbiAgICB3aWR0aDogNjAwLFxuICAgIGhlaWdodDogODcwLFxuICAgIHJlc2l6YWJsZTogdHJ1ZSxcbiAgICBtaW5XaWR0aDogNTAwLFxuICAgIG1pbkhlaWdodDogNzAwLFxuICAgIHRpdGxlOiAnT2RvbyBNYW5hZ2VyIC0gTmV3IEluc3RhbmNlJ1xuICB9LFxuICBcIm5ldy1wb3N0Z3Jlc1wiOiB7XG4gICAgd2lkdGg6IDYwMCxcbiAgICBoZWlnaHQ6IDgyMCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDUwMCxcbiAgICBtaW5IZWlnaHQ6IDcwMCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIE5ldyBQb3N0Z3JlU1FMIEluc3RhbmNlJ1xuICB9LFxuICAnY29udGFpbmVyLWluZm8nOiB7XG4gICAgd2lkdGg6IDcwMCxcbiAgICBoZWlnaHQ6IDg1MCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDcwMCxcbiAgICBtaW5IZWlnaHQ6IDg1MCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIENvbnRhaW5lciBJbmZvJ1xuICB9LFxuICAnY29udGFpbmVyLWxvZ3MnOiB7XG4gICAgd2lkdGg6IDgwMCxcbiAgICBoZWlnaHQ6IDg2MCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgbWluV2lkdGg6IDYwMCxcbiAgICBtaW5IZWlnaHQ6IDcwMCxcbiAgICB0aXRsZTogJ09kb28gTWFuYWdlciAtIENvbnRhaW5lciBMb2dzJ1xuICB9XG59O1xuXG4vLyBHZXQgd2luZG93IGNvbmZpZyB3aXRoIGZhbGxiYWNrIHRvIGRlZmF1bHRcbmZ1bmN0aW9uIGdldFdpbmRvd0NvbmZpZyh0eXBlOiBzdHJpbmcpOiBXaW5kb3dDb25maWcge1xuICByZXR1cm4gd2luZG93Q29uZmlnc1t0eXBlXSB8fCB7XG4gICAgd2lkdGg6IDgwMCxcbiAgICBoZWlnaHQ6IDYwMCxcbiAgICByZXNpemFibGU6IHRydWUsXG4gICAgdGl0bGU6IGBPZG9vIE1hbmFnZXIgLSAke3R5cGV9YFxuICB9O1xufVxuXG5jb25zdCB3aW5kb3dzOiBXaW5kb3dzUmVnaXN0cnkgPSB7fTtcblxuLy8gQ2hlY2sgaWYgc2V0dXAgaXMgY29tcGxldGVkXG5hc3luYyBmdW5jdGlvbiBpc1NldHVwQ29tcGxldGVkKCk6IFByb21pc2U8e2NvbXBsZXRlZDogYm9vbGVhbn0+IHtcbiAgdHJ5IHtcblxuICAgIGNvbnN0IHdvcmtEaXJGaWxlUGF0aCA9IHBhdGguam9pbihhcHAuZ2V0UGF0aCgndXNlckRhdGEnKSwgJ3dvcmtkaXIuanNvbicpO1xuXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgIGxvZ0luZm8oJ1dvcmsgZGlyZWN0b3J5IGZpbGUgZG9lcyBub3QgZXhpc3QsIHNldHVwIG5vdCBjb21wbGV0ZWQnKTtcbiAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCB3b3JrRGlyRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0ZjgnKSk7XG4gICAgY29uc3Qgd29ya0RpciA9IHdvcmtEaXJEYXRhLndvcmtEaXI7XG5cbiAgICBpZiAoIXdvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMod29ya0RpcikpIHtcbiAgICAgIGxvZ0luZm8oJ1dvcmsgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0LCBzZXR1cCBub3QgY29tcGxldGVkJyk7XG4gICAgICByZXR1cm4geyBjb21wbGV0ZWQ6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgY29uc3Qgc2V0dGluZ3NQYXRoID0gcGF0aC5qb2luKHdvcmtEaXIsICdzZXR0aW5ncy5qc29uJyk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzUGF0aCkpIHtcbiAgICAgIGxvZ0luZm8oJ1NldHRpbmdzIGZpbGUgZG9lcyBub3QgZXhpc3QsIHNldHVwIG5vdCBjb21wbGV0ZWQnKTtcbiAgICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb21wbGV0ZWQ6IHRydWUgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgc2V0dXAgc3RhdHVzJywgZXJyb3IpO1xuICAgIHJldHVybiB7IGNvbXBsZXRlZDogZmFsc2UgfTtcbiAgfVxufVxuXG4vLyBDcmVhdGUgc2V0dXAgd2luZG93XG5mdW5jdGlvbiBjcmVhdGVTZXR1cFdpbmRvdygpIHtcbiAgbG9nSW5mbyhcIkNyZWF0aW5nIHNldHVwIHdpbmRvd1wiKTtcblxuICBjb25zdCBtYWluQ29uZmlnID0gZ2V0V2luZG93Q29uZmlnKFwibWFpblwiKTtcbiAgY29uc3Qgc2V0dXBDb25maWcgPSBnZXRXaW5kb3dDb25maWcoXCJzZXR1cFwiKTtcblxuICAvLyBEZWZpbmUgcHJlbG9hZFBhdGggYmFzZWQgb24gZW52aXJvbm1lbnQgLSBlbnN1cmUgcGF0aCByZXNvbHV0aW9uIHdvcmtzIGNvcnJlY3RseVxuICBjb25zdCBwcmVsb2FkUGF0aCA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnIFxuICAgID8gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICdkaXN0LWVsZWN0cm9uJywgJ3ByZWxvYWQuanMnKVxuICAgIDogcGF0aC5qb2luKGFwcERpciwgJ3ByZWxvYWQuanMnKTtcbiAgXG4gIGxvZ0luZm8oYFVzaW5nIHByZWxvYWQgcGF0aCBmb3Igc2V0dXAgd2luZG93OiAke3ByZWxvYWRQYXRofWApO1xuXG4gIGNvbnN0IHNldHVwV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgIHdpZHRoOiBtYWluQ29uZmlnLndpZHRoLFxuICAgIGhlaWdodDogbWFpbkNvbmZpZy5oZWlnaHQsXG4gICAgbWluV2lkdGg6IG1haW5Db25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBtYWluQ29uZmlnLm1pbkhlaWdodCxcbiAgICBjZW50ZXI6IHRydWUsXG4gICAgc2hvdzogZmFsc2UsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzEyMTIxMicsXG4gICAgdGl0bGU6IHNldHVwQ29uZmlnLnRpdGxlLFxuICAgIHRpdGxlQmFyU3R5bGU6ICdkZWZhdWx0JyxcbiAgICB3ZWJQcmVmZXJlbmNlczoge1xuICAgICAgcHJlbG9hZDogcHJlbG9hZFBhdGgsXG4gICAgICBub2RlSW50ZWdyYXRpb246IHRydWUsXG4gICAgICBjb250ZXh0SXNvbGF0aW9uOiBmYWxzZVxuICAgIH1cbiAgfSk7XG5cbiAgc2V0dXBXaW5kb3cuc2V0VGl0bGUoc2V0dXBDb25maWcudGl0bGUpO1xuXG4gIHNldHVwV2luZG93LndlYkNvbnRlbnRzLm9uKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgc2V0dXBXaW5kb3cuc2V0VGl0bGUoc2V0dXBDb25maWcudGl0bGUpO1xuICB9KTtcblxuICBzZXR1cFdpbmRvdy5vbmNlKCdyZWFkeS10by1zaG93JywgKCkgPT4ge1xuICAgIHNldHVwV2luZG93LnNob3coKTtcbiAgICBzZXR1cFdpbmRvdy5mb2N1cygpO1xuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzZXR1cFdpbmRvdy5sb2FkVVJMKCdodHRwOi8vbG9jYWxob3N0OjUxNzMvIy9zZXR1cCcpLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgc2V0dXAgVVJMJywgZXJyKTtcbiAgICB9KTtcbiAgICBzZXR1cFdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgfSBlbHNlIHtcbiAgICBzZXR1cFdpbmRvdy5sb2FkRmlsZShwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vZGlzdC9pbmRleC5odG1sJyksIHsgaGFzaDogJ3NldHVwJyB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHNldHVwIGZpbGUnLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgc2V0dXBXaW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoYEZhaWxlZCB0byBvcGVuIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICB9KTtcblxuICB3aW5kb3dzLnNldHVwID0gc2V0dXBXaW5kb3c7XG5cbiAgcmV0dXJuIHNldHVwV2luZG93O1xufVxuXG4vLyBDcmVhdGUgc3BsYXNoIHdpbmRvd1xuZnVuY3Rpb24gY3JlYXRlU3BsYXNoV2luZG93KCkge1xuICBsb2dJbmZvKFwiQ3JlYXRpbmcgc3BsYXNoIHdpbmRvd1wiKTtcbiAgY29uc3QgY29uZmlnID0gZ2V0V2luZG93Q29uZmlnKFwic3BsYXNoXCIpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBwYXRoIHJlc29sdXRpb24gd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oYXBwRGlyLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoOiAke3ByZWxvYWRQYXRofWApO1xuXG4gIGNvbnN0IHNwbGFzaCA9IG5ldyBCcm93c2VyV2luZG93KHtcbiAgICB3aWR0aDogNTAwLFxuICAgIGhlaWdodDogNjAwLFxuICAgIGNlbnRlcjogdHJ1ZSxcbiAgICBmcmFtZTogZmFsc2UsXG4gICAgdHJhbnNwYXJlbnQ6IHByb2Nlc3MucGxhdGZvcm0gIT09ICdsaW51eCcsXG4gICAgYmFja2dyb3VuZENvbG9yOiBwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnID8gJyMxMjEyMTInIDogdW5kZWZpbmVkLFxuICAgIHJlc2l6YWJsZTogZmFsc2UsXG4gICAgbW92YWJsZTogdHJ1ZSxcbiAgICB0aXRsZTogY29uZmlnLnRpdGxlLFxuICAgIHNob3c6IGZhbHNlLFxuICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICBwcmVsb2FkOiBwcmVsb2FkUGF0aCxcbiAgICAgIG5vZGVJbnRlZ3JhdGlvbjogdHJ1ZSxcbiAgICAgIGNvbnRleHRJc29sYXRpb246IGZhbHNlLFxuICAgICAgZGV2VG9vbHM6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnXG4gICAgfVxuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzcGxhc2gud2ViQ29udGVudHMub3BlbkRldlRvb2xzKHsgbW9kZTogJ2RldGFjaCcgfSk7XG4gIH1cblxuICBzcGxhc2gub24oJ2Nsb3NlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKGdsb2JhbC5hbGxvd1NwbGFzaENsb3NlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBhcHAuZW1pdCgndmVyaWZpY2F0aW9uLWNvbXBsZXRlJyBhcyBhbnkpO1xuICB9KTtcblxuICBzcGxhc2gub25jZSgncmVhZHktdG8tc2hvdycsICgpID0+IHtcbiAgICBzcGxhc2guc2hvdygpO1xuICB9KTtcblxuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICBzcGxhc2gubG9hZFVSTCgnaHR0cDovL2xvY2FsaG9zdDo1MTczLyMvc3BsYXNoJykuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBzcGxhc2ggVVJMJywgZXJyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICAvLyBVc2UgcGF0aC5yZXNvbHZlIHJhdGhlciB0aGFuIHBhdGguam9pbiB0byBlbnN1cmUgY29ycmVjdCBwYXRoIHJlc29sdXRpb25cbiAgICBjb25zdCBodG1sUGF0aCA9IHBhdGgucmVzb2x2ZShhcHBEaXIsICcuLi9kaXN0L2luZGV4Lmh0bWwnKTtcbiAgICBsb2dJbmZvKGBMb2FkaW5nIHNwbGFzaCBmaWxlIGZyb206ICR7aHRtbFBhdGh9YCk7XG4gICAgc3BsYXNoLmxvYWRGaWxlKGh0bWxQYXRoLCB7IGhhc2g6ICdzcGxhc2gnIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGxvYWQgc3BsYXNoIGZpbGUnLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgd2luZG93cy5zcGxhc2ggPSBzcGxhc2g7XG5cbiAgcmV0dXJuIHNwbGFzaDtcbn1cblxuLy8gQ3JlYXRlIG1haW4gd2luZG93XG5mdW5jdGlvbiBjcmVhdGVNYWluV2luZG93KCkge1xuICBsb2dJbmZvKCdDcmVhdGluZyBtYWluIHdpbmRvdycpO1xuXG4gIGNvbnN0IGNvbmZpZyA9IGdldFdpbmRvd0NvbmZpZygnbWFpbicpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBwYXRoIHJlc29sdXRpb24gd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oYXBwRGlyLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoIGZvciBtYWluIHdpbmRvdzogJHtwcmVsb2FkUGF0aH1gKTtcblxuICBjb25zdCBtYWluV2luZG93ID0gbmV3IEJyb3dzZXJXaW5kb3coe1xuICAgIHdpZHRoOiBjb25maWcud2lkdGgsXG4gICAgaGVpZ2h0OiBjb25maWcuaGVpZ2h0LFxuICAgIG1pbldpZHRoOiBjb25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBjb25maWcubWluSGVpZ2h0LFxuICAgIGNlbnRlcjogdHJ1ZSxcbiAgICBzaG93OiBmYWxzZSxcbiAgICBmcmFtZTogdHJ1ZSxcbiAgICB0cmFuc3BhcmVudDogZmFsc2UsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzEyMTIxMicsXG4gICAgdGl0bGVCYXJTdHlsZTogJ2RlZmF1bHQnLFxuICAgIHRpdGxlOiBjb25maWcudGl0bGUsXG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHByZWxvYWRQYXRoLFxuICAgICAgbm9kZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogZmFsc2UsXG4gICAgfSxcbiAgfSk7XG5cbiAgbWFpbldpbmRvdy5zZXRUaXRsZShjb25maWcudGl0bGUpO1xuXG4gIG1haW5XaW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICBtYWluV2luZG93LnNldFRpdGxlKGNvbmZpZy50aXRsZSk7XG4gIH0pO1xuXG4gIC8vIFRyYWNrIGlmIHdlJ3JlIGluIHRoZSB0ZXJtaW5hdGlvbiBwcm9jZXNzXG4gIGxldCB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcblxuICBtYWluV2luZG93Lm9uKCdjbG9zZScsIGFzeW5jIChldmVudCkgPT4ge1xuICAgIC8vIElmIHdlJ3JlIGFscmVhZHkgaGFuZGxpbmcgdGVybWluYXRpb24sIGRvbid0IHRyaWdnZXIgYWdhaW5cbiAgICBpZiAodGVybWluYXRpb25JblByb2dyZXNzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSB0cnVlO1xuXG4gICAgY29uc3Qgc2hvdWxkVGVybWluYXRlID0gYXdhaXQgaGFuZGxlQXBwVGVybWluYXRpb24obWFpbldpbmRvdyk7XG5cbiAgICBpZiAoc2hvdWxkVGVybWluYXRlKSB7XG4gICAgICBsb2dJbmZvKCdBcHAgdGVybWluYXRpb24gYXBwcm92ZWQsIHF1aXR0aW5nLi4uJyk7XG4gICAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICAgIG1haW5XaW5kb3cucmVtb3ZlQWxsTGlzdGVuZXJzKCdjbG9zZScpO1xuICAgICAgYXBwLnF1aXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nSW5mbygnQXBwIHRlcm1pbmF0aW9uIGNhbmNlbGxlZCBieSB1c2VyJyk7XG4gICAgICB0ZXJtaW5hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuXG4gIG1haW5XaW5kb3cud2ViQ29udGVudHMuc2V0V2luZG93T3BlbkhhbmRsZXIoKHsgdXJsIH0pID0+IHtcbiAgICBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoYEZhaWxlZCB0byBvcGVuIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgICByZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuICB9KTtcblxuICB3aW5kb3dzLm1haW4gPSBtYWluV2luZG93O1xuXG4gIHJldHVybiBtYWluV2luZG93O1xufVxuXG4vLyBDcmVhdGUgYSBuZXcgd2luZG93IG9mIHNwZWNpZmllZCB0eXBlXG5mdW5jdGlvbiBjcmVhdGVXaW5kb3cod2luZG93VHlwZTogc3RyaW5nLCBvcHRpb25zOiBhbnkgPSB7fSkge1xuICBsb2dJbmZvKGBDcmVhdGluZyB3aW5kb3c6ICR7d2luZG93VHlwZX1gKTtcblxuICBjb25zdCBkZWZhdWx0Q29uZmlnID0gZ2V0V2luZG93Q29uZmlnKHdpbmRvd1R5cGUpO1xuXG4gIC8vIERlZmluZSBwcmVsb2FkUGF0aCBiYXNlZCBvbiBlbnZpcm9ubWVudCAtIGVuc3VyZSBwYXRoIHJlc29sdXRpb24gd29ya3MgY29ycmVjdGx5XG4gIGNvbnN0IHByZWxvYWRQYXRoID0gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcgXG4gICAgPyBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ2Rpc3QtZWxlY3Ryb24nLCAncHJlbG9hZC5qcycpXG4gICAgOiBwYXRoLmpvaW4oYXBwRGlyLCAncHJlbG9hZC5qcycpO1xuICBcbiAgbG9nSW5mbyhgVXNpbmcgcHJlbG9hZCBwYXRoIGZvciAke3dpbmRvd1R5cGV9IHdpbmRvdzogJHtwcmVsb2FkUGF0aH1gKTtcblxuICBjb25zdCB3aW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgd2lkdGg6IG9wdGlvbnMud2lkdGggfHwgZGVmYXVsdENvbmZpZy53aWR0aCxcbiAgICBoZWlnaHQ6IG9wdGlvbnMuaGVpZ2h0IHx8IGRlZmF1bHRDb25maWcuaGVpZ2h0LFxuICAgIG1pbldpZHRoOiBvcHRpb25zLm1pbldpZHRoIHx8IGRlZmF1bHRDb25maWcubWluV2lkdGgsXG4gICAgbWluSGVpZ2h0OiBvcHRpb25zLm1pbkhlaWdodCB8fCBkZWZhdWx0Q29uZmlnLm1pbkhlaWdodCxcbiAgICByZXNpemFibGU6IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3Jlc2l6YWJsZScpID8gb3B0aW9ucy5yZXNpemFibGUgOiBkZWZhdWx0Q29uZmlnLnJlc2l6YWJsZSxcbiAgICBjZW50ZXI6IHRydWUsXG4gICAgc2hvdzogZmFsc2UsXG4gICAgZnJhbWU6IHRydWUsXG4gICAgdGl0bGU6IG9wdGlvbnMudGl0bGUgfHwgZGVmYXVsdENvbmZpZy50aXRsZSxcbiAgICBhdXRvSGlkZU1lbnVCYXI6IHByb2Nlc3MucGxhdGZvcm0gIT09ICdkYXJ3aW4nLFxuICAgIHRpdGxlQmFyU3R5bGU6ICdkZWZhdWx0JyxcbiAgICBtb2RhbDogb3B0aW9ucy5tb2RhbCA9PT0gdHJ1ZSxcbiAgICBiYWNrZ3JvdW5kQ29sb3I6ICcjMTIxMjEyJyxcbiAgICBwYXJlbnQ6IG9wdGlvbnMucGFyZW50ICYmIHdpbmRvd3Nbb3B0aW9ucy5wYXJlbnRdID8gd2luZG93c1tvcHRpb25zLnBhcmVudF0gOiB1bmRlZmluZWQsXG4gICAgd2ViUHJlZmVyZW5jZXM6IHtcbiAgICAgIHByZWxvYWQ6IHByZWxvYWRQYXRoLFxuICAgICAgbm9kZUludGVncmF0aW9uOiB0cnVlLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogZmFsc2UsXG4gICAgICBhZGRpdGlvbmFsQXJndW1lbnRzOiBvcHRpb25zLmRhdGEgPyBbYC0td2luZG93LWRhdGE9JHtKU09OLnN0cmluZ2lmeShvcHRpb25zLmRhdGEpfWBdIDogW11cbiAgICB9LFxuICB9KTtcblxuICBjb25zdCB3aW5kb3dUaXRsZSA9IG9wdGlvbnMudGl0bGUgfHwgZGVmYXVsdENvbmZpZy50aXRsZTtcbiAgd2luZG93LnNldFRpdGxlKHdpbmRvd1RpdGxlKTtcblxuICB3aW5kb3cud2ViQ29udGVudHMub24oJ2RpZC1maW5pc2gtbG9hZCcsICgpID0+IHtcbiAgICB3aW5kb3cuc2V0VGl0bGUod2luZG93VGl0bGUpO1xuICB9KTtcblxuICBpZiAoIW9wdGlvbnMubW9kYWwpIHtcbiAgICB3aW5kb3cuc2V0UGFyZW50V2luZG93KG51bGwpO1xuICB9XG5cbiAgd2luZG93Lm9uY2UoJ3JlYWR5LXRvLXNob3cnLCAoKSA9PiB7XG4gICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgd2luZG93LnNob3coKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jykge1xuICAgIHdpbmRvdy5sb2FkVVJMKGBodHRwOi8vbG9jYWxob3N0OjUxNzMvIy8ke3dpbmRvd1R5cGV9YCkuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKGBGYWlsZWQgdG8gbG9hZCAke3dpbmRvd1R5cGV9IFVSTGAsIGVycik7XG4gICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvdy5zaG93KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAob3B0aW9ucy5vcGVuRGV2VG9vbHMpIHtcbiAgICAgIHdpbmRvdy53ZWJDb250ZW50cy5vcGVuRGV2VG9vbHMoeyBtb2RlOiAnZGV0YWNoJyB9KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgd2luZG93LmxvYWRGaWxlKHBhdGguam9pbihhcHBEaXIsICcuLi9kaXN0L2luZGV4Lmh0bWwnKSwgeyBoYXNoOiB3aW5kb3dUeXBlIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBsb2dFcnJvcihgRmFpbGVkIHRvIGxvYWQgJHt3aW5kb3dUeXBlfSBmaWxlYCwgZXJyKTtcbiAgICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgd2luZG93LnNob3coKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHdpbmRvd3Nbd2luZG93VHlwZV0gPSB3aW5kb3c7XG5cbiAgLy8gQWRkIGlzQ2xvc2luZyBwcm9wZXJ0eSB0byBCcm93c2VyV2luZG93XG4gICh3aW5kb3cgYXMgYW55KS5pc0Nsb3NpbmcgPSBmYWxzZTtcblxuICAvLyBBZGQgY3VzdG9tIGNsb3NlIG1ldGhvZCB3aXRoIGFuaW1hdGlvblxuICBjb25zdCBvcmlnaW5hbENsb3NlID0gd2luZG93LmNsb3NlLmJpbmQod2luZG93KTtcbiAgKHdpbmRvdyBhcyBhbnkpLm9yaWdpbmFsQ2xvc2UgPSBvcmlnaW5hbENsb3NlO1xuICB3aW5kb3cuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAod2luZG93LmlzRGVzdHJveWVkKCkgfHwgKHdpbmRvdyBhcyBhbnkpLmlzQ2xvc2luZykge1xuICAgICAgcmV0dXJuIG9yaWdpbmFsQ2xvc2UoKTtcbiAgICB9XG5cbiAgICAod2luZG93IGFzIGFueSkuaXNDbG9zaW5nID0gdHJ1ZTtcblxuICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkgJiYgd2luZG93LndlYkNvbnRlbnRzKSB7XG4gICAgICB3aW5kb3cud2ViQ29udGVudHMuc2VuZCgnd2luZG93LWZhZGUtb3V0Jyk7XG5cbiAgICAgIGlwY01haW4ub25jZSgnd2luZG93LWZhZGUtb3V0LWNvbmZpcm0nLCAoKSA9PiB7XG4gICAgICAgIGxldCBvcGFjaXR5ID0gMS4wO1xuICAgICAgICBjb25zdCBmYWRlU3RlcCA9IDAuMTtcbiAgICAgICAgY29uc3QgZmFkZUludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgIGlmICh3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG9wYWNpdHkgLT0gZmFkZVN0ZXA7XG4gICAgICAgICAgaWYgKG9wYWNpdHkgPD0gMCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICBvcmlnaW5hbENsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy5zZXRPcGFjaXR5KG9wYWNpdHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgMTApO1xuICAgICAgfSk7XG5cbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBpZiAoIXdpbmRvdy5pc0Rlc3Ryb3llZCgpICYmICh3aW5kb3cgYXMgYW55KS5pc0Nsb3NpbmcpIHtcbiAgICAgICAgICBvcmlnaW5hbENsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIDgwMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9yaWdpbmFsQ2xvc2UoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfTtcblxuICB3aW5kb3cub24oJ2Nsb3NlJywgKGV2ZW50KSA9PiB7XG4gICAgaWYgKCEod2luZG93IGFzIGFueSkuaXNDbG9zaW5nKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgd2luZG93LmNsb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICB3aW5kb3cub24oJ2Nsb3NlZCcsICgpID0+IHtcbiAgICB3aW5kb3dzW3dpbmRvd1R5cGVdID0gdW5kZWZpbmVkO1xuICB9KTtcblxuICByZXR1cm4gd2luZG93O1xufVxuXG5mdW5jdGlvbiBzaG93TWFpbldpbmRvdygpIHtcbiAgbG9nSW5mbygnc2hvd01haW5XaW5kb3cgZnVuY3Rpb24gY2FsbGVkJyk7XG5cbiAgdHJ5IHtcbiAgICBnbG9iYWwuYWxsb3dTcGxhc2hDbG9zZSA9IHRydWU7XG5cbiAgICBjb25zdCBtYWluRXhpc3RzID0gd2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKTtcbiAgICBjb25zdCBzcGxhc2hFeGlzdHMgPSB3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKTtcblxuICAgIGlmIChtYWluRXhpc3RzICYmIHdpbmRvd3MubWFpbikge1xuICAgICAgd2luZG93cy5tYWluLmhpZGUoKTtcblxuICAgICAgaWYgKHNwbGFzaEV4aXN0cyAmJiB3aW5kb3dzLnNwbGFzaCkge1xuICAgICAgICBsZXQgc3BsYXNoT3BhY2l0eSA9IDE7XG4gICAgICAgIGNvbnN0IGZhZGVJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICBzcGxhc2hPcGFjaXR5IC09IDAuMDQ7XG5cbiAgICAgICAgICBpZiAoc3BsYXNoT3BhY2l0eSA8PSAwKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGZhZGVJbnRlcnZhbCk7XG5cbiAgICAgICAgICAgIGlmICh3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHdpbmRvd3Muc3BsYXNoLmNsb3NlKCk7XG5cbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB3aW5kb3dzLm1haW47XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYWluV2luZG93ICYmICFtYWluV2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIDUwMCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gd2luZG93cy5tYWluO1xuICAgICAgICAgICAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1haW5XaW5kb3cgPSB3aW5kb3dzLm1haW47XG4gICAgICAgICAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICB3aW5kb3dzLnNwbGFzaC5zZXRPcGFjaXR5KHNwbGFzaE9wYWNpdHkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGZhZGVJbnRlcnZhbCk7XG4gICAgICAgICAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICBjb25zdCBtYWluV2luZG93ID0gd2luZG93cy5tYWluO1xuICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sIDE2KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IHdpbmRvd3MubWFpbjtcbiAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhtYWluV2luZG93KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgZ2xvYmFsLmFsbG93U3BsYXNoQ2xvc2UgPSBmYWxzZTtcbiAgICAgIH0sIDIwMDApO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld01haW4gPSBjcmVhdGVNYWluV2luZG93KCk7XG5cbiAgICAgIGlmIChzcGxhc2hFeGlzdHMgJiYgd2luZG93cy5zcGxhc2gpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBsZXQgc3BsYXNoT3BhY2l0eSA9IDE7XG4gICAgICAgICAgY29uc3QgZmFkZUludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgc3BsYXNoT3BhY2l0eSAtPSAwLjA0O1xuXG4gICAgICAgICAgICBpZiAoc3BsYXNoT3BhY2l0eSA8PSAwKSB7XG4gICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoZmFkZUludGVydmFsKTtcbiAgICAgICAgICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgICAgd2luZG93cy5zcGxhc2guY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGxvYWRBbmRTaG93V2luZG93KG5ld01haW4pO1xuICAgICAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh3aW5kb3dzLnNwbGFzaCAmJiAhd2luZG93cy5zcGxhc2guaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB3aW5kb3dzLnNwbGFzaC5zZXRPcGFjaXR5KHNwbGFzaE9wYWNpdHkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChmYWRlSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICBsb2FkQW5kU2hvd1dpbmRvdyhuZXdNYWluKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCAxNik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgIGlmICghbmV3TWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICBuZXdNYWluLnNob3coKTtcbiAgICAgICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICBlbWl0TWFpbldpbmRvd1Zpc2libGUobmV3TWFpbik7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBzaG93TWFpbldpbmRvdycsIGVycm9yKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbmV3TWFpbiA9IGNyZWF0ZU1haW5XaW5kb3coKTtcblxuICAgICAgaWYgKHdpbmRvd3Muc3BsYXNoICYmICF3aW5kb3dzLnNwbGFzaC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2luZG93cy5zcGxhc2guY2xvc2UoKTtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICAgICAgZW1pdE1haW5XaW5kb3dWaXNpYmxlKG5ld01haW4pO1xuICAgICAgICAgIH0sIDEwMCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBjbG9zaW5nIHNwbGFzaCB3aW5kb3cnLCBlcnIpO1xuICAgICAgICAgIG5ld01haW4uc2hvdygpO1xuICAgICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3TWFpbi5zaG93KCk7XG4gICAgICAgIGVtaXRNYWluV2luZG93VmlzaWJsZShuZXdNYWluKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChmYWxsYmFja0Vycm9yKSB7XG4gICAgICBsb2dFcnJvcignRmFpbGVkIHRvIGNyZWF0ZSBmYWxsYmFjayBtYWluIHdpbmRvdycsIGZhbGxiYWNrRXJyb3IpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBDcmVhdGUgdGhlIG1hY09TIGFwcGxpY2F0aW9uIG1lbnVcbmZ1bmN0aW9uIGNyZWF0ZUFwcE1lbnUoKSB7XG4gIGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnZGFyd2luJykgcmV0dXJuO1xuXG4gIGxvZ0luZm8oJ0NyZWF0aW5nIG1hY09TIGFwcGxpY2F0aW9uIG1lbnUnKTtcblxuICBjb25zdCB0ZW1wbGF0ZTogRWxlY3Ryb24uTWVudUl0ZW1Db25zdHJ1Y3Rvck9wdGlvbnNbXSA9IFtcbiAgICB7XG4gICAgICBsYWJlbDogYXBwLm5hbWUsXG4gICAgICBzdWJtZW51OiBbXG4gICAgICAgIHsgcm9sZTogJ2Fib3V0JyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ1ByZWZlcmVuY2VzJyxcbiAgICAgICAgICBhY2NlbGVyYXRvcjogJ0NtZCssJyxcbiAgICAgICAgICBjbGljazogKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHdpbmRvd3Muc2V0dGluZ3MgJiYgIXdpbmRvd3Muc2V0dGluZ3MuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgICAgICB3aW5kb3dzLnNldHRpbmdzLmZvY3VzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjcmVhdGVXaW5kb3coJ3NldHRpbmdzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ3NlcnZpY2VzJyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2hpZGUnIH0sXG4gICAgICAgIHsgcm9sZTogJ2hpZGVPdGhlcnMnIH0sXG4gICAgICAgIHsgcm9sZTogJ3VuaGlkZScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdxdWl0JyB9XG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBsYWJlbDogJ0ZpbGUnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6ICdOZXcgT2RvbyBJbnN0YW5jZScsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdDbWQrTicsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIGNyZWF0ZVdpbmRvdygnbmV3LWluc3RhbmNlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6ICdOZXcgUG9zdGdyZVNRTCBJbnN0YW5jZScsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdTaGlmdCtDbWQrTicsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIGNyZWF0ZVdpbmRvdygnbmV3LXBvc3RncmVzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2Nsb3NlJyB9XG4gICAgICBdXG4gICAgfSxcbiAgICB7XG4gICAgICBsYWJlbDogJ0VkaXQnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7IHJvbGU6ICd1bmRvJyB9LFxuICAgICAgICB7IHJvbGU6ICdyZWRvJyB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHsgcm9sZTogJ2N1dCcgfSxcbiAgICAgICAgeyByb2xlOiAnY29weScgfSxcbiAgICAgICAgeyByb2xlOiAncGFzdGUnIH0sXG4gICAgICAgIHsgcm9sZTogJ2RlbGV0ZScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdzZWxlY3RBbGwnIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIGxhYmVsOiAnVmlldycsXG4gICAgICBzdWJtZW51OiBbXG4gICAgICAgIHsgcm9sZTogJ3JlbG9hZCcgfSxcbiAgICAgICAgeyByb2xlOiAnZm9yY2VSZWxvYWQnIH0sXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcbiAgICAgICAgeyByb2xlOiAncmVzZXRab29tJyB9LFxuICAgICAgICB7IHJvbGU6ICd6b29tSW4nIH0sXG4gICAgICAgIHsgcm9sZTogJ3pvb21PdXQnIH0sXG4gICAgICAgIHsgdHlwZTogJ3NlcGFyYXRvcicgfSxcbiAgICAgICAgeyByb2xlOiAndG9nZ2xlZnVsbHNjcmVlbicgfVxuICAgICAgXVxuICAgIH0sXG4gICAge1xuICAgICAgbGFiZWw6ICdXaW5kb3cnLFxuICAgICAgc3VibWVudTogW1xuICAgICAgICB7IHJvbGU6ICdtaW5pbWl6ZScgfSxcbiAgICAgICAgeyByb2xlOiAnem9vbScgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICdmcm9udCcgfSxcbiAgICAgICAgeyB0eXBlOiAnc2VwYXJhdG9yJyB9LFxuICAgICAgICB7IHJvbGU6ICd3aW5kb3cnIH1cbiAgICAgIF1cbiAgICB9LFxuICAgIHtcbiAgICAgIHJvbGU6ICdoZWxwJyxcbiAgICAgIHN1Ym1lbnU6IFtcbiAgICAgICAge1xuICAgICAgICAgIGxhYmVsOiAnSGVscCcsXG4gICAgICAgICAgYWNjZWxlcmF0b3I6ICdDbWQrSCcsXG4gICAgICAgICAgY2xpY2s6ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh3aW5kb3dzLmhlbHAgJiYgIXdpbmRvd3MuaGVscC5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgICAgICAgIHdpbmRvd3MuaGVscC5mb2N1cygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY3JlYXRlV2luZG93KCdoZWxwJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ09wZW4gQXBwbGljYXRpb24gTG9ncycsXG4gICAgICAgICAgY2xpY2s6IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgICAgICAgICAgIHNlbmRlcjogd2luZG93cy5tYWluPy53ZWJDb250ZW50c1xuICAgICAgICAgICAgICB9IGFzIEVsZWN0cm9uLklwY01haW5JbnZva2VFdmVudDtcblxuICAgICAgICAgICAgICAvLyBUeXBlIGFzc2VydGlvbiB0byBhY2Nlc3MgaGFuZGxlcnNcbiAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHR5cGVkSXBjTWFpbi5oYW5kbGVycz8uWydnZXQtbG9nLWZpbGUtcGF0aCddO1xuICAgICAgICAgICAgICBpZiAoaGFuZGxlcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvZ0ZpbGVQYXRoID0gYXdhaXQgaGFuZGxlcihldmVudCk7XG4gICAgICAgICAgICAgICAgaWYgKGxvZ0ZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCBzaGVsbC5vcGVuUGF0aChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGRpYWxvZy5zaG93TWVzc2FnZUJveCh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbmZvJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdObyBMb2dzIEF2YWlsYWJsZScsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdObyBhcHBsaWNhdGlvbiBsb2dzIHdlcmUgZm91bmQuJ1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2dFcnJvcignRXJyb3Igb3BlbmluZyBhcHBsaWNhdGlvbiBsb2dzJywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXVxuICAgIH1cbiAgXTtcblxuICBjb25zdCBtZW51ID0gTWVudS5idWlsZEZyb21UZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gIE1lbnUuc2V0QXBwbGljYXRpb25NZW51KG1lbnUpO1xufVxuXG5hcHAud2hlblJlYWR5KCkudGhlbihhc3luYyAoKSA9PiB7XG4gIC8vIEluaXRpYWxpemUgbG9nIGZpbGVcbiAgaW5pdExvZ0ZpbGUoKTtcblxuICBsb2dJbmZvKCdBcHBsaWNhdGlvbiByZWFkeSwgaW5pdGlhbGl6aW5nLi4uJyk7XG5cbiAgQUNUSVZFX0xPR19GSUxFID0gZ2V0TG9nRmlsZUxvY2soKTtcbiAgaWYgKEFDVElWRV9MT0dfRklMRSkge1xuICAgIGxvZ0luZm8oYEZvdW5kIGV4aXN0aW5nIGxvZyBmaWxlIGZyb20gbG9jazogJHtBQ1RJVkVfTE9HX0ZJTEV9YCk7XG4gIH1cblxuICBpbml0aWFsaXplSXBjSGFuZGxlcnMoKTtcbiAgY3JlYXRlQXBwTWVudSgpO1xuXG4gIC8vIExvZyBjbGVhbnVwIGNvZGUgcmVtb3ZlZCAtIG5vdyBoYW5kbGVkIGJ5IGxvZyByb3RhdGlvblxuXG4gIC8vIEhhbmRsZSBjcmVhdGUtaW5zdGFuY2UgbWVzc2FnZSBmcm9tIHJlbmRlcmVyXG4gIGlwY01haW4ub24oJ2NyZWF0ZS1pbnN0YW5jZScsIGFzeW5jIChldmVudCwgZGF0YSkgPT4ge1xuICAgIGxvZ0luZm8oJ1tDUkVBVEUtSU5TVEFOQ0VdIFJlY2VpdmVkIGNyZWF0ZS1pbnN0YW5jZSBldmVudCcpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNyZWF0ZVdpdGhUaW1lb3V0ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8YW55PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignSW5zdGFuY2UgY3JlYXRpb24gdGltZWQgb3V0IGFmdGVyIDYwIHNlY29uZHMuIFBsZWFzZSBjaGVjayBEb2NrZXIgc3RhdHVzLicpKTtcbiAgICAgICAgICB9LCA2MDAwMCk7XG5cbiAgICAgICAgICBjb25zdCBleGVjT3BlcmF0aW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWYgKGRhdGEuaW5zdGFuY2VUeXBlID09PSAncG9zdGdyZXMnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGRvY2tlckNvbXBvc2VTZXJ2aWNlLmNyZWF0ZVBvc3RncmVzSW5zdGFuY2UoXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KGRhdGEucG9ydCwgMTApIHx8IDU0MzIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGEudXNlcm5hbWUgfHwgJ3Bvc3RncmVzJyxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wYXNzd29yZCB8fCAncG9zdGdyZXMnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgZG9ja2VyQ29tcG9zZVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VOYW1lLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZWRpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5hZG1pblBhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmRiRmlsdGVyLFxuICAgICAgICAgICAgICAgICAgICBwYXJzZUludChkYXRhLnBvcnQsIDEwKSB8fCA4MDY5LFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmN1c3RvbUltYWdlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLmN1c3RvbUltYWdlTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wb3N0Z3Jlc0luc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnBnVXNlcixcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wZ1Bhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgICBkYXRhLnBnUG9ydFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvciBpbiBleGVjdXRpb24nLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBleGVjT3BlcmF0aW9uKClcbiAgICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNyZWF0ZVdpdGhUaW1lb3V0KCk7XG4gICAgICBsb2dJbmZvKCdbQ1JFQVRFLUlOU1RBTkNFXSBEb2NrZXIgQ29tcG9zZSBvcGVyYXRpb24gY29tcGxldGVkJyk7XG5cbiAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnaW5zdGFuY2UtY3JlYXRlZCcsIHtcbiAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgIHBvcnQ6IHJlc3VsdC5wb3J0LFxuICAgICAgICAgIGluc3RhbmNlVHlwZTogZGF0YS5pbnN0YW5jZVR5cGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHdpbmRvd3MubWFpbiAmJiAhd2luZG93cy5tYWluLmlzRGVzdHJveWVkKCkgJiZcbiAgICAgICAgICAgIGV2ZW50LnNlbmRlciAhPT0gd2luZG93cy5tYWluLndlYkNvbnRlbnRzKSB7XG4gICAgICAgICAgd2luZG93cy5tYWluLndlYkNvbnRlbnRzLnNlbmQoJ2luc3RhbmNlLWNyZWF0ZWQnLCB7XG4gICAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgICAgcG9ydDogcmVzdWx0LnBvcnQsXG4gICAgICAgICAgICBpbnN0YW5jZVR5cGU6IGRhdGEuaW5zdGFuY2VUeXBlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvcicsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2luc3RhbmNlLWNyZWF0aW9uLWVycm9yJywge1xuICAgICAgICAgIGluc3RhbmNlVHlwZTogZGF0YS5pbnN0YW5jZVR5cGUsXG4gICAgICAgICAgZXJyb3I6IHJlc3VsdC5tZXNzYWdlIHx8ICdVbmtub3duIGVycm9yIGR1cmluZyBpbnN0YW5jZSBjcmVhdGlvbidcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdbQ1JFQVRFLUlOU1RBTkNFXSBFcnJvciBoYW5kbGluZyByZXF1ZXN0JywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2luc3RhbmNlLWNyZWF0aW9uLWVycm9yJywge1xuICAgICAgICBpbnN0YW5jZVR5cGU6IGRhdGEuaW5zdGFuY2VUeXBlIHx8ICd1bmtub3duJyxcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3Igb2NjdXJyZWQgZHVyaW5nIGluc3RhbmNlIGNyZWF0aW9uJ1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgdXBkYXRlLXBvc3RncmVzLWNyZWRlbnRpYWxzIG1lc3NhZ2UgZnJvbSByZW5kZXJlclxuICBpcGNNYWluLmhhbmRsZSgndXBkYXRlLXBvc3RncmVzLWNyZWRlbnRpYWxzJywgYXN5bmMgKF9ldmVudCwgZGF0YSkgPT4ge1xuICAgIGxvZ0luZm8oJ1tVUERBVEUtUE9TVEdSRVMtQ1JFREVOVElBTFNdIFJlY2VpdmVkIHVwZGF0ZSByZXF1ZXN0Jyk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgaW5zdGFuY2VOYW1lLCB1c2VybmFtZSwgcGFzc3dvcmQgfSA9IGRhdGE7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkb2NrZXJDb21wb3NlU2VydmljZS51cGRhdGVQb3N0Z3Jlc0NyZWRlbnRpYWxzKGluc3RhbmNlTmFtZSwgdXNlcm5hbWUsIHBhc3N3b3JkKTtcblxuICAgICAgaWYgKHJlc3VsdC51cGRhdGVkSW5zdGFuY2VzICYmIHJlc3VsdC51cGRhdGVkSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbG9nSW5mbyhgW1VQREFURS1QT1NUR1JFUy1DUkVERU5USUFMU10gVXBkYXRlZCAke3Jlc3VsdC51cGRhdGVkSW5zdGFuY2VzLmxlbmd0aH0gZGVwZW5kZW50IE9kb28gaW5zdGFuY2VzYCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdbVVBEQVRFLVBPU1RHUkVTLUNSRURFTlRJQUxTXSBFcnJvciB1cGRhdGluZyBjcmVkZW50aWFscycsIGVycm9yKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yIHVwZGF0aW5nIGNyZWRlbnRpYWxzJ1xuICAgICAgfTtcbiAgICB9XG4gIH0pO1xuXG4gIGxvZ0luZm8oJ0NoZWNraW5nIGlmIHNldHVwIGlzIGNvbXBsZXRlZC4uLicpO1xuXG4gIGNvbnN0IHsgY29tcGxldGVkIH0gPSBhd2FpdCBpc1NldHVwQ29tcGxldGVkKCk7XG5cbiAgaWYgKCFjb21wbGV0ZWQpIHtcbiAgICBsb2dJbmZvKCdTZXR1cCBub3QgY29tcGxldGVkLCBzaG93aW5nIHNldHVwIHNjcmVlbi4uLicpO1xuXG4gICAgY29uc3Qgc2V0dXBXaW5kb3cgPSBjcmVhdGVTZXR1cFdpbmRvdygpO1xuXG4gICAgY29uc3QgbWFpbkNvbmZpZyA9IGdldFdpbmRvd0NvbmZpZygnbWFpbicpO1xuICAgIHNldHVwV2luZG93LnNldFNpemUobWFpbkNvbmZpZy53aWR0aCwgbWFpbkNvbmZpZy5oZWlnaHQpO1xuICAgIGlmIChtYWluQ29uZmlnLm1pbldpZHRoICYmIG1haW5Db25maWcubWluSGVpZ2h0KSB7XG4gICAgICBzZXR1cFdpbmRvdy5zZXRNaW5pbXVtU2l6ZShtYWluQ29uZmlnLm1pbldpZHRoLCBtYWluQ29uZmlnLm1pbkhlaWdodCk7XG4gICAgfVxuICAgIHNldHVwV2luZG93LmNlbnRlcigpO1xuICB9XG4gIGVsc2Uge1xuICAgIGxvZ0luZm8oJ05vcm1hbCBzdGFydHVwLCBzaG93aW5nIHNwbGFzaCBzY3JlZW4uLi4nKTtcblxuICAgIGNyZWF0ZVNwbGFzaFdpbmRvdygpO1xuICAgIGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICBpbml0aWFsaXplQXBwKCk7XG5cbiAgICBhcHAuYWRkTGlzdGVuZXIoJ3ZlcmlmaWNhdGlvbi1jb21wbGV0ZScgYXMgYW55LCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdBcHAgZXZlbnQ6IHZlcmlmaWNhdGlvbiBjb21wbGV0ZSBzaWduYWwgcmVjZWl2ZWQnKTtcbiAgICAgIHNob3dNYWluV2luZG93KCk7XG4gICAgfSk7XG5cbiAgICBpcGNNYWluLm9uKCd2ZXJpZmljYXRpb24tY29tcGxldGUnLCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdJUEMgZXZlbnQ6IHZlcmlmaWNhdGlvbiBjb21wbGV0ZSBzaWduYWwgcmVjZWl2ZWQnKTtcbiAgICAgIHNob3dNYWluV2luZG93KCk7XG4gICAgfSk7XG4gIH1cblxuICBpcGNNYWluLm9uKCdzeW5jLXRoZW1lJywgKF9ldmVudCwgeyBtb2RlLCBzb3VyY2UgfSkgPT4ge1xuICAgIGlmIChnbG9iYWwudGhlbWVVcGRhdGVJblByb2dyZXNzKSB7XG4gICAgICBsb2dJbmZvKGBJZ25vcmluZyB0aGVtZSBzeW5jIGR1cmluZyB1cGRhdGU6ICR7bW9kZX0gZnJvbSAke3NvdXJjZSB8fCAndW5rbm93bid9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcyA9IHRydWU7XG5cbiAgICBsb2dJbmZvKGBTeW5jaW5nIHRoZW1lIHRvIGFsbCB3aW5kb3dzOiAke21vZGV9IGZyb20gJHtzb3VyY2UgfHwgJ3Vua25vd24nfWApO1xuXG4gICAgaWYgKGdsb2JhbC5jdXJyZW50VGhlbWVNb2RlICE9PSBtb2RlKSB7XG4gICAgICBnbG9iYWwuY3VycmVudFRoZW1lTW9kZSA9IG1vZGU7XG5cbiAgICAgIEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpLmZvckVhY2god2luZG93ID0+IHtcbiAgICAgICAgaWYgKCF3aW5kb3cuaXNEZXN0cm95ZWQoKSkge1xuICAgICAgICAgIGlmIChzb3VyY2UgJiYgd2luZG93LndlYkNvbnRlbnRzLmlkID09PSBwYXJzZUludChzb3VyY2UpKSB7XG4gICAgICAgICAgICBsb2dJbmZvKGBTa2lwcGluZyB0aGVtZSB1cGRhdGUgdG8gc291cmNlIHdpbmRvdzogJHtzb3VyY2V9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy53ZWJDb250ZW50cy5zZW5kKCd0aGVtZS1jaGFuZ2VkJywgbW9kZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nSW5mbyhgVGhlbWUgYWxyZWFkeSBzZXQgdG8gJHttb2RlfSwgbm8gYnJvYWRjYXN0IG5lZWRlZGApO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZ2xvYmFsLnRoZW1lVXBkYXRlSW5Qcm9ncmVzcyA9IGZhbHNlO1xuICAgIH0sIDUwMCk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBvcGVuLWZpbGUgbWVzc2FnZSBmcm9tIHJlbmRlcmVyXG4gIGlwY01haW4ub24oJ29wZW4tZmlsZScsIChldmVudCwgeyBpbnN0YW5jZU5hbWUsIGluc3RhbmNlVHlwZSwgZmlsZVBhdGggfSkgPT4ge1xuICAgIGxvZ0luZm8oYE9wZW5pbmcgZmlsZSBmb3IgaW5zdGFuY2U6ICR7aW5zdGFuY2VOYW1lfSwgZmlsZTogJHtmaWxlUGF0aH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCB3b3JrRGlyUGF0aCA9IGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpO1xuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4od29ya0RpclBhdGgsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lLCBmaWxlUGF0aCk7XG5cbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZ1bGxQYXRoKSkge1xuICAgICAgICBzaGVsbC5vcGVuUGF0aChmdWxsUGF0aCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICBsb2dFcnJvcignRXJyb3Igb3BlbmluZyBmaWxlJywgZXJyKTtcbiAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBDb3VsZCBub3Qgb3BlbiBmaWxlOiAke2Vyci5tZXNzYWdlfWBcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB3b3JrRGlyRmlsZVBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICd3b3JrZGlyLmpzb24nKTtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMod29ya0RpckZpbGVQYXRoKSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB3b3JrRGlyRGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtEaXJGaWxlUGF0aCwgJ3V0ZjgnKSk7XG4gICAgICAgICAgICBjb25zdCBhbHRlcm5hdGl2ZVBhdGggPSBwYXRoLmpvaW4od29ya0RpckRhdGEud29ya0RpciwgaW5zdGFuY2VUeXBlLCBpbnN0YW5jZU5hbWUsIGZpbGVQYXRoKTtcblxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRpdmVQYXRoKSkge1xuICAgICAgICAgICAgICBzaGVsbC5vcGVuUGF0aChhbHRlcm5hdGl2ZVBhdGgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIG9wZW5pbmcgZmlsZScsIGVycik7XG4gICAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZmlsZTogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgIHRpdGxlOiAnRmlsZSBOb3QgRm91bmQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBGaWxlIGRvZXMgbm90IGV4aXN0OiAke2ZpbGVQYXRofWBcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ0Vycm9yKCdFcnJvciBwYXJzaW5nIHdvcmtkaXIuanNvbicsIGVycm9yKTtcbiAgICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb3VsZCBub3QgZGV0ZXJtaW5lIHdvcmsgZGlyZWN0b3J5IHBhdGgnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGhhbmRsaW5nIG9wZW4gZmlsZSByZXF1ZXN0JywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICB0aXRsZTogJ0Vycm9yJyxcbiAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZpbGU6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQWRkIGhhbmRsZXIgZm9yIHVwZGF0aW5nIERCIGZpbHRlclxuICBpcGNNYWluLmhhbmRsZSgndXBkYXRlLW9kb28tY29uZmlnJywgYXN5bmMgKF9ldmVudCwgeyBpbnN0YW5jZU5hbWUsIGRiRmlsdGVyIH0pID0+IHtcbiAgICBsb2dJbmZvKGBVcGRhdGluZyBEQiBmaWx0ZXIgZm9yIGluc3RhbmNlOiAke2luc3RhbmNlTmFtZX0sIHZhbHVlOiAke2RiRmlsdGVyfWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtEaXJQYXRoID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmdldFdvcmtEaXJQYXRoKCkgfHwgYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyk7XG4gICAgICBjb25zdCBpbnN0YW5jZURpciA9IHBhdGguam9pbih3b3JrRGlyUGF0aCwgJ29kb28nLCBpbnN0YW5jZU5hbWUpO1xuICAgICAgY29uc3QgY29uZmlnRmlsZSA9IHBhdGguam9pbihpbnN0YW5jZURpciwgJ2NvbmZpZycsICdvZG9vLmNvbmYnKTtcblxuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGNvbmZpZ0ZpbGUpKSB7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQ29uZmlnIGZpbGUgbm90IGZvdW5kJyB9O1xuICAgICAgfVxuXG4gICAgICBsZXQgY29uZmlnQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhjb25maWdGaWxlLCAndXRmOCcpO1xuXG4gICAgICBpZiAoZGJGaWx0ZXIpIHtcbiAgICAgICAgaWYgKGNvbmZpZ0NvbnRlbnQuaW5jbHVkZXMoJ2RiZmlsdGVyID0nKSkge1xuICAgICAgICAgIGNvbmZpZ0NvbnRlbnQgPSBjb25maWdDb250ZW50LnJlcGxhY2UoL2RiZmlsdGVyID0uKlxcbi8sIGBkYmZpbHRlciA9IF4ke2luc3RhbmNlTmFtZX0uKiRcXG5gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25maWdDb250ZW50ICs9IGBcXG5kYmZpbHRlciA9IF4ke2luc3RhbmNlTmFtZX0uKiRgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25maWdDb250ZW50ID0gY29uZmlnQ29udGVudC5yZXBsYWNlKC9kYmZpbHRlciA9LipcXG4vLCAnJyk7XG4gICAgICB9XG5cbiAgICAgIGZzLndyaXRlRmlsZVN5bmMoY29uZmlnRmlsZSwgY29uZmlnQ29udGVudCwgJ3V0ZjgnKTtcblxuICAgICAgY29uc3QgaW5mb0ZpbGUgPSBwYXRoLmpvaW4oaW5zdGFuY2VEaXIsICdpbnN0YW5jZS1pbmZvLmpzb24nKTtcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGluZm9GaWxlKSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGluZm9Db250ZW50ID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoaW5mb0ZpbGUsICd1dGY4JykpO1xuICAgICAgICAgIGluZm9Db250ZW50LmRiRmlsdGVyID0gZGJGaWx0ZXI7XG4gICAgICAgICAgaW5mb0NvbnRlbnQudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoaW5mb0ZpbGUsIEpTT04uc3RyaW5naWZ5KGluZm9Db250ZW50LCBudWxsLCAyKSwgJ3V0ZjgnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBsb2dFcnJvcignRXJyb3IgdXBkYXRpbmcgaW5zdGFuY2UgaW5mbycsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnREIgZmlsdGVyIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JyB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgdXBkYXRpbmcgREIgZmlsdGVyJywgZXJyb3IpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IGBFcnJvciB1cGRhdGluZyBEQiBmaWx0ZXI6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWBcbiAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLm9uKCdvcGVuLWluc3RhbmNlLWZvbGRlcicsIChldmVudCwgeyBpbnN0YW5jZU5hbWUsIGluc3RhbmNlVHlwZSB9KSA9PiB7XG4gICAgbG9nSW5mbyhgT3BlbmluZyAke2luc3RhbmNlVHlwZX0gZm9sZGVyIGZvciBpbnN0YW5jZTogJHtpbnN0YW5jZU5hbWV9YCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya0RpclBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJykpO1xuICAgICAgY29uc3QgaW5zdGFuY2VQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJQYXRoLCBpbnN0YW5jZVR5cGUsIGluc3RhbmNlTmFtZSk7XG5cbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKGluc3RhbmNlUGF0aCkpIHtcbiAgICAgICAgc2hlbGwub3BlblBhdGgoaW5zdGFuY2VQYXRoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgIGxvZ0Vycm9yKGBFcnJvciBvcGVuaW5nICR7aW5zdGFuY2VUeXBlfSBmb2xkZXJgLCBlcnIpO1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogYENvdWxkIG5vdCBvcGVuIGZvbGRlcjogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgd29ya0RpckZpbGVQYXRoID0gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpLCAnd29ya2Rpci5qc29uJyk7XG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHdvcmtEaXJGaWxlUGF0aCkpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyRmlsZVBhdGgsICd1dGY4JykpO1xuICAgICAgICAgICAgY29uc3QgYWx0ZXJuYXRpdmVQYXRoID0gcGF0aC5qb2luKHdvcmtEaXJEYXRhLndvcmtEaXIsIGluc3RhbmNlVHlwZSwgaW5zdGFuY2VOYW1lKTtcblxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoYWx0ZXJuYXRpdmVQYXRoKSkge1xuICAgICAgICAgICAgICBzaGVsbC5vcGVuUGF0aChhbHRlcm5hdGl2ZVBhdGgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoYEVycm9yIG9wZW5pbmcgYWx0ZXJuYXRpdmUgJHtpbnN0YW5jZVR5cGV9IGZvbGRlcmAsIGVycik7XG4gICAgICAgICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ3Nob3ctZXJyb3ItZGlhbG9nJywge1xuICAgICAgICAgICAgICAgICAgdGl0bGU6ICdFcnJvcicsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZm9sZGVyOiAke2Vyci5tZXNzYWdlfWBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6ICdGb2xkZXIgTm90IEZvdW5kJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSW5zdGFuY2UgZm9sZGVyIGRvZXMgbm90IGV4aXN0OiAke2luc3RhbmNlTmFtZX1gXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyB3b3JrZGlyLmpzb24nLCBlcnJvcik7XG4gICAgICAgICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICAgICAgICBtZXNzYWdlOiAnQ291bGQgbm90IGRldGVybWluZSB3b3JrIGRpcmVjdG9yeSBwYXRoJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdzaG93LWVycm9yLWRpYWxvZycsIHtcbiAgICAgICAgICAgIHRpdGxlOiAnRm9sZGVyIE5vdCBGb3VuZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgSW5zdGFuY2UgZm9sZGVyIGRvZXMgbm90IGV4aXN0OiAke2luc3RhbmNlTmFtZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGhhbmRsaW5nIG9wZW4gZm9sZGVyIHJlcXVlc3QnLCBlcnJvcik7XG4gICAgICBldmVudC5zZW5kZXIuc2VuZCgnc2hvdy1lcnJvci1kaWFsb2cnLCB7XG4gICAgICAgIHRpdGxlOiAnRXJyb3InLFxuICAgICAgICBtZXNzYWdlOiBgQ291bGQgbm90IG9wZW4gZm9sZGVyOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKCdnZXQtY3VycmVudC10aGVtZScsIChfZXZlbnQpID0+IHtcbiAgICBsb2dJbmZvKGBDdXJyZW50IHRoZW1lIHJlcXVlc3RlZCwgcmV0dXJuaW5nOiAke2dsb2JhbC5jdXJyZW50VGhlbWVNb2RlIHx8ICdudWxsJ31gKTtcbiAgICByZXR1cm4gZ2xvYmFsLmN1cnJlbnRUaGVtZU1vZGU7XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKCdnZXQtd2luZG93LWlkJywgKGV2ZW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdlYkNvbnRlbnRzID0gZXZlbnQuc2VuZGVyO1xuICAgICAgY29uc3Qgd2luID0gQnJvd3NlcldpbmRvdy5mcm9tV2ViQ29udGVudHMod2ViQ29udGVudHMpO1xuICAgICAgaWYgKHdpbikge1xuICAgICAgICBjb25zdCBpZCA9IHdpbi5pZDtcbiAgICAgICAgbG9nSW5mbyhgV2luZG93IElEIHJlcXVlc3RlZDogJHtpZH1gKTtcbiAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgfVxuICAgICAgbG9nRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIHdpbmRvdyBmcm9tIHdlYkNvbnRlbnRzJyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgbG9nRXJyb3IoJ0Vycm9yIGdldHRpbmcgd2luZG93IElEJywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9KTtcblxuICAvLyBHbG9iYWwgbGFuZ3VhZ2Ugc3RvcmFnZVxuICBsZXQgY3VycmVudExhbmd1YWdlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAvLyBIYW5kbGUgbGFuZ3VhZ2UgY2hhbmdlIHN5bmNcbiAgaXBjTWFpbi5vbignbGFuZ3VhZ2UtY2hhbmdlZCcsIChfZXZlbnQsIHsgbGFuZ3VhZ2UgfSkgPT4ge1xuICAgIGxvZ0luZm8oJ1N5bmNpbmcgbGFuZ3VhZ2UgdG8gYWxsIHdpbmRvd3M6ICcgKyBsYW5ndWFnZSk7XG5cbiAgICBjdXJyZW50TGFuZ3VhZ2UgPSBsYW5ndWFnZTtcblxuICAgIEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpLmZvckVhY2god2luZG93ID0+IHtcbiAgICAgIGlmICghd2luZG93LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgICAgd2luZG93LndlYkNvbnRlbnRzLnNlbmQoJ2xhbmd1YWdlLWNoYW5nZWQnLCBsYW5ndWFnZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZXIgdG8gZ2V0IGN1cnJlbnQgbGFuZ3VhZ2VcbiAgaXBjTWFpbi5oYW5kbGUoJ2dldC1jdXJyZW50LWxhbmd1YWdlJywgKCkgPT4ge1xuICAgIHJldHVybiBjdXJyZW50TGFuZ3VhZ2U7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSB2ZXJpZmljYXRpb24gZmFpbHVyZXNcbiAgaXBjTWFpbi5vbigndmVyaWZpY2F0aW9uLWZhaWxlZCcsIChfZXZlbnQsIHsgZXJyb3IgfSkgPT4ge1xuICAgIGxvZ0Vycm9yKCdWZXJpZmljYXRpb24gZmFpbGVkJywgZXJyb3IpO1xuICAgIGRpYWxvZy5zaG93RXJyb3JCb3goJ1ZlcmlmaWNhdGlvbiBGYWlsZWQnLCBgRXJyb3I6ICR7ZXJyb3J9YCk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSB3aW5kb3cgY3JlYXRpb24gcmVxdWVzdHMgZnJvbSByZW5kZXJlcnNcbiAgaXBjTWFpbi5vbignb3Blbi13aW5kb3cnLCAoX2V2ZW50LCB7IHR5cGUsIG9wdGlvbnMgfSkgPT4ge1xuICAgIGxvZ0luZm8oYFJlcXVlc3QgdG8gb3BlbiB3aW5kb3c6ICR7dHlwZX1gKTtcbiAgICBjcmVhdGVXaW5kb3codHlwZSwgb3B0aW9ucyk7XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSB3aW5kb3cgY2xvc2luZyByZXF1ZXN0cyBmcm9tIHJlbmRlcmVyc1xuICBpcGNNYWluLm9uKCdjbG9zZS13aW5kb3cnLCAoX2V2ZW50LCB7IHR5cGUgfSkgPT4ge1xuICAgIGxvZ0luZm8oYFJlcXVlc3QgdG8gY2xvc2Ugd2luZG93OiAke3R5cGV9YCk7XG4gICAgaWYgKHdpbmRvd3NbdHlwZV0gJiYgIXdpbmRvd3NbdHlwZV0/LmlzRGVzdHJveWVkKCkpIHtcbiAgICAgIHdpbmRvd3NbdHlwZV0/LmNsb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBIYW5kbGUgZXhwbGljaXQgd2luZG93IHRpdGxlIHNldHRpbmcgZnJvbSByZW5kZXJlclxuICBpcGNNYWluLm9uKCdzZXQtd2luZG93LXRpdGxlJywgKGV2ZW50LCB0aXRsZSkgPT4ge1xuICAgIGNvbnN0IHdpbiA9IEJyb3dzZXJXaW5kb3cuZnJvbVdlYkNvbnRlbnRzKGV2ZW50LnNlbmRlcik7XG4gICAgaWYgKHdpbikge1xuICAgICAgd2luLnNldFRpdGxlKHRpdGxlKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBtZXNzYWdlIGRpYWxvZyByZXF1ZXN0c1xuICBpcGNNYWluLmhhbmRsZSgnc2hvdy1tZXNzYWdlLWRpYWxvZycsIGFzeW5jIChldmVudCwgb3B0aW9ucykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZy5zaG93TWVzc2FnZUJveChvcHRpb25zKTtcbiAgICBldmVudC5zZW5kZXIuc2VuZCgnZGlhbG9nLXJlc3BvbnNlJywgcmVzdWx0LnJlc3BvbnNlKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9KTtcblxuICAvLyBIYW5kbGUgb3BlbiBmaWxlIGRpYWxvZyByZXF1ZXN0c1xuICBpcGNNYWluLmhhbmRsZSgnc2hvdy1vcGVuLWRpYWxvZycsIGFzeW5jIChfZXZlbnQsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dPcGVuRGlhbG9nKG9wdGlvbnMpO1xuICB9KTtcblxuICAvLyBIYW5kbGUgc2F2ZSBmaWxlIGRpYWxvZyByZXF1ZXN0c1xuICBpcGNNYWluLmhhbmRsZSgnc2hvdy1zYXZlLWRpYWxvZycsIGFzeW5jIChfZXZlbnQsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgZGlhbG9nLnNob3dTYXZlRGlhbG9nKG9wdGlvbnMpO1xuICB9KTtcblxuICAvLyBUaGlzIGhhbmRsZXIgd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgc2V0dXAgd2luZG93IHNpZ25hbHMgaXQncyBhYm91dCB0byBjbG9zZSBpdHNlbGZcbiAgaXBjTWFpbi5vbignc2V0dXAtd2luZG93LWNsb3NpbmcnLCAoKSA9PiB7XG4gICAgbG9nSW5mbygnW1NFVFVQLUNMT1NFXSBSZWNlaXZlZCBzZXR1cC13aW5kb3ctY2xvc2luZyBzaWduYWwnKTtcbiAgICBnbG9iYWwuY29taW5nRnJvbVNldHVwID0gdHJ1ZTtcbiAgfSk7XG5cbiAgLy8gTWVzc2FnZSB0byByZXNpemUgYW5kIHByZXBhcmUgdGhlIHdpbmRvdyBmb3IgbWFpbiBzY3JlZW5cbiAgaXBjTWFpbi5vbigncHJlcGFyZS1mb3ItbWFpbi1zY3JlZW4nLCAoKSA9PiB7XG4gICAgbG9nSW5mbygnPT09PT09PSBQUkVQQVJJTkcgRk9SIE1BSU4gU0NSRUVOID09PT09PT0nKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBjdXJyZW50V2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG4gICAgICBpZiAoIWN1cnJlbnRXaW5kb3cpIHtcbiAgICAgICAgbG9nRXJyb3IoJ05vIGZvY3VzZWQgd2luZG93IGZvdW5kIScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1haW5Db25maWcgPSBnZXRXaW5kb3dDb25maWcoJ21haW4nKTtcblxuICAgICAgY3VycmVudFdpbmRvdy5zZXRTaXplKG1haW5Db25maWcud2lkdGgsIG1haW5Db25maWcuaGVpZ2h0KTtcblxuICAgICAgaWYgKG1haW5Db25maWcubWluV2lkdGggJiYgbWFpbkNvbmZpZy5taW5IZWlnaHQpIHtcbiAgICAgICAgY3VycmVudFdpbmRvdy5zZXRNaW5pbXVtU2l6ZShtYWluQ29uZmlnLm1pbldpZHRoLCBtYWluQ29uZmlnLm1pbkhlaWdodCk7XG4gICAgICB9XG5cbiAgICAgIGN1cnJlbnRXaW5kb3cuc2V0UmVzaXphYmxlKG1haW5Db25maWcucmVzaXphYmxlKTtcbiAgICAgIGN1cnJlbnRXaW5kb3cuc2V0VGl0bGUobWFpbkNvbmZpZy50aXRsZSk7XG4gICAgICBjdXJyZW50V2luZG93LmNlbnRlcigpO1xuXG4gICAgICBsb2dJbmZvKCdXaW5kb3cgcHJlcGFyZWQgZm9yIG1haW4gc2NyZWVuJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBwcmVwYXJpbmcgd2luZG93IGZvciBtYWluIHNjcmVlbicsIGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEhhbmRsZSBnZXQtbG9ncyBtZXNzYWdlIGZyb20gcmVuZGVyZXIgd2l0aCBESVJFQ1QgbWV0aG9kIGNhbGwgcmF0aGVyIHRoYW4gaW52b2tlXG4gIGlwY01haW4ub24oJ2dldC1sb2dzJywgYXN5bmMgKGV2ZW50LCB7IGluc3RhbmNlTmFtZSwgdGltZUZpbHRlciwgdGFpbCB9KSA9PiB7XG4gICAgbG9nSW5mbyhgR2V0dGluZyBsb2dzIGZvciAke2luc3RhbmNlTmFtZX0sIHRpbWVGaWx0ZXI6ICR7dGltZUZpbHRlcn0sIHRhaWw6ICR7dGFpbH1gKTtcblxuICAgIHRyeSB7XG4gICAgICBsZXQgc2luY2VQYXJhbSA9ICcnO1xuICAgICAgc3dpdGNoICh0aW1lRmlsdGVyKSB7XG4gICAgICAgIGNhc2UgJ2xhc3RfaG91cic6XG4gICAgICAgICAgc2luY2VQYXJhbSA9ICctLXNpbmNlPTFoJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbGFzdF8yX2hvdXJzJzpcbiAgICAgICAgICBzaW5jZVBhcmFtID0gJy0tc2luY2U9MmgnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdsYXN0XzZfaG91cnMnOlxuICAgICAgICAgIHNpbmNlUGFyYW0gPSAnLS1zaW5jZT02aCc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2FsbCc6XG4gICAgICAgICAgc2luY2VQYXJhbSA9ICcnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjbWQgPSB0aW1lRmlsdGVyID09PSAnYWxsJ1xuICAgICAgICAgID8gYGRvY2tlciBsb2dzIC0tdGFpbD0ke3RhaWx9ICR7aW5zdGFuY2VOYW1lfWBcbiAgICAgICAgICA6IGBkb2NrZXIgbG9ncyAke3NpbmNlUGFyYW19ICR7aW5zdGFuY2VOYW1lfWA7XG5cbiAgICAgIGNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcbiAgICAgIGNvbnN0IGRvY2tlclByb2Nlc3MgPSBzcGF3bihjbWQsIFtdLCB7IHNoZWxsOiB0cnVlIH0pO1xuXG4gICAgICBsZXQgbG9ncyA9ICcnO1xuICAgICAgbGV0IGVycm9yID0gJyc7XG4gICAgICBsZXQgdGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcblxuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBkb2NrZXJQcm9jZXNzLmtpbGwoKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZTogJ1RpbWVvdXQgd2FpdGluZyBmb3IgbG9ncy4gVGhlIGNvbnRhaW5lciBtaWdodCBub3QgaGF2ZSBhbnkgbG9ncy4nXG4gICAgICAgIH0pO1xuICAgICAgfSwgMTAwMDApO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBsb2dzICs9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIH0pO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcbiAgICAgICAgZXJyb3IgKz0gZGF0YS50b1N0cmluZygpO1xuICAgICAgfSk7XG5cbiAgICAgIGRvY2tlclByb2Nlc3Mub24oJ2Nsb3NlJywgKGNvZGU6IG51bWJlcikgPT4ge1xuICAgICAgICBpZiAodGltZW91dCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgbG9nczogbG9nc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV2ZW50LnNlbmRlci5zZW5kKCdsb2dzLXJlc3BvbnNlJywge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnJvciB8fCBgUHJvY2VzcyBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBkb2NrZXJQcm9jZXNzLm9uKCdlcnJvcicsIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgbG9nRXJyb3IoJ0Vycm9yIGV4ZWN1dGluZyBkb2NrZXIgbG9ncyBjb21tYW5kJywgZXJyKTtcbiAgICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZTogYEVycm9yIGV4ZWN1dGluZyBkb2NrZXIgbG9ncyBjb21tYW5kOiAke2Vyci5tZXNzYWdlfWBcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcignRXJyb3IgZ2V0dGluZyBsb2dzJywgZXJyb3IpO1xuICAgICAgZXZlbnQuc2VuZGVyLnNlbmQoJ2xvZ3MtcmVzcG9uc2UnLCB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOiBgRXJyb3IgZ2V0dGluZyBsb2dzOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIERlYnVnZ2luZyAtIHNob3cgYWxsIHdpbmRvd3MgYWZ0ZXIgYSB0aW1lb3V0IGlmIHN0aWxsIGluIHNwbGFzaFxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAod2luZG93cy5tYWluICYmICF3aW5kb3dzLm1haW4uaXNWaXNpYmxlKCkgJiYgd2luZG93cy5zcGxhc2ggJiYgd2luZG93cy5zcGxhc2guaXNWaXNpYmxlKCkpIHtcbiAgICAgIGxvZ0luZm8oJ0RFQlVHOiBGb3JjaW5nIG1haW4gd2luZG93IHRvIHNob3cgYWZ0ZXIgdGltZW91dCcpO1xuICAgICAgc2hvd01haW5XaW5kb3coKTtcbiAgICB9XG4gIH0sIDEwMDAwKTtcbn0pO1xuXG4vLyBRdWl0IGFwcGxpY2F0aW9uIHdoZW4gYWxsIHdpbmRvd3MgYXJlIGNsb3NlZCAoZXhjZXB0IG9uIG1hY09TKVxuYXBwLm9uKCd3aW5kb3ctYWxsLWNsb3NlZCcsICgpID0+IHtcbiAgaWYgKHByb2Nlc3MucGxhdGZvcm0gIT09ICdkYXJ3aW4nKSBhcHAucXVpdCgpO1xufSk7XG5cbi8vIE9uIG1hY09TLCByZWNyZWF0ZSBhcHBsaWNhdGlvbiB3aW5kb3cgd2hlbiBkb2NrIGljb24gaXMgY2xpY2tlZCBhbmQgbm8gd2luZG93cyBhcmUgYXZhaWxhYmxlXG5hcHAub24oJ2FjdGl2YXRlJywgKCkgPT4ge1xuICBpZiAoQnJvd3NlcldpbmRvdy5nZXRBbGxXaW5kb3dzKCkubGVuZ3RoID09PSAwKSB7XG4gICAgbG9nSW5mbygnQXBwIGFjdGl2YXRlZCB3aXRoIG5vIHdpbmRvd3MsIGNyZWF0aW5nIG1haW4gd2luZG93Jyk7XG4gICAgaXNTZXR1cENvbXBsZXRlZCgpLnRoZW4oKHsgY29tcGxldGVkIH0pID0+IHtcbiAgICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgICAgY29uc3QgbWFpbldpbmRvdyA9IGNyZWF0ZU1haW5XaW5kb3coKTtcbiAgICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjcmVhdGVTZXR1cFdpbmRvdygpO1xuICAgICAgfVxuICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ0Vycm9yKCdFcnJvciBjaGVja2luZyBzZXR1cCBzdGF0dXMgb24gYWN0aXZhdGUnLCBlcnJvcik7XG4gICAgICBjb25zdCBtYWluV2luZG93ID0gY3JlYXRlTWFpbldpbmRvdygpO1xuICAgICAgbG9hZEFuZFNob3dXaW5kb3cobWFpbldpbmRvdyk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgd2luZG93cyA9IEJyb3dzZXJXaW5kb3cuZ2V0QWxsV2luZG93cygpO1xuICAgIGNvbnN0IHZpc2libGVXaW5kb3dzID0gd2luZG93cy5maWx0ZXIod2luID0+IHdpbi5pc1Zpc2libGUoKSk7XG4gICAgaWYgKHZpc2libGVXaW5kb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgIHZpc2libGVXaW5kb3dzWzBdLmZvY3VzKCk7XG4gICAgfSBlbHNlIGlmICh3aW5kb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgIHdpbmRvd3NbMF0uc2hvdygpO1xuICAgICAgd2luZG93c1swXS5mb2N1cygpO1xuICAgIH1cbiAgfVxufSk7XG5cbi8vIEhhbmRsZSBleHRlcm5hbCBVUkwgb3BlbmluZ1xuaXBjTWFpbi5vbignb3Blbi1leHRlcm5hbC11cmwnLCAoX2V2ZW50LCB1cmwpID0+IHtcbiAgaWYgKHR5cGVvZiB1cmwgPT09ICdzdHJpbmcnKSB7XG4gICAgc2hlbGwub3BlbkV4dGVybmFsKHVybCkuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0Vycm9yKGBFcnJvciBvcGVuaW5nIGV4dGVybmFsIFVSTDogJHt1cmx9YCwgZXJyKTtcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIEdldCBhcHAgdmVyc2lvblxuaXBjTWFpbi5oYW5kbGUoJ2dldC1hcHAtdmVyc2lvbicsICgpID0+IHtcbiAgcmV0dXJuIGFwcC5nZXRWZXJzaW9uKCk7XG59KTtcblxuLy8gR2V0IGFwcCBwYXRoXG5pcGNNYWluLmhhbmRsZSgnZ2V0LWFwcC1wYXRoJywgKF9ldmVudCwgbmFtZSkgPT4ge1xuICByZXR1cm4gYXBwLmdldFBhdGgobmFtZSBhcyBhbnkgfHwgJ3VzZXJEYXRhJyk7XG59KTtcblxuLyoqXG4gKiBGZXRjaCBHaXRIdWIgcmVsZWFzZXMgZm9yIHRoZSBhcHBsaWNhdGlvblxuICogVXNlZCBmb3IgdGhlIG1hbnVhbCB1cGRhdGUgY2hlY2tpbmcgc3lzdGVtXG4gKi9cbmlwY01haW4uaGFuZGxlKCdmZXRjaC1naXRodWItcmVsZWFzZXMnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgbG9nSW5mbygnRmV0Y2hpbmcgR2l0SHViIHJlbGVhc2VzIGZvciB1cGRhdGUgY2hlY2snKTtcbiAgICBcbiAgICAvLyBHaXRIdWIgQVBJIGVuZHBvaW50IC0gcmVwbGFjZSB3aXRoIHlvdXIgYWN0dWFsIHJlcG9zaXRvcnkgaW5mb1xuICAgIC8vIFRoaXMgaXMgYSBwbGFjZWhvbGRlciAtIHJlcGxhY2Ugd2l0aCB5b3VyIGFjdHVhbCBHaXRIdWIgcmVwb3NpdG9yeVxuICAgIGNvbnN0IGFwaVVybCA9ICdodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL2RhbmllbG1lZGVyb3MyNDI0L29kb28tbWFuYWdlci9yZWxlYXNlcyc7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHJlcXVlc3RcbiAgICBjb25zdCByZXF1ZXN0ID0gbmV0LnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHVybDogYXBpVXJsLFxuICAgICAgcmVkaXJlY3Q6ICdmb2xsb3cnXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2V0IGhlYWRlcnNcbiAgICByZXF1ZXN0LnNldEhlYWRlcignVXNlci1BZ2VudCcsIGBPZG9vLU1hbmFnZXIvJHthcHAuZ2V0VmVyc2lvbigpfWApO1xuICAgIFxuICAgIC8vIENyZWF0ZSBwcm9taXNlIHRvIGhhbmRsZSByZXNwb25zZVxuICAgIGNvbnN0IHJlc3BvbnNlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZXNwb25zZURhdGEgPSAnJztcbiAgICAgIFxuICAgICAgcmVxdWVzdC5vbigncmVzcG9uc2UnLCAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgcmVzcG9uc2Uub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICByZXNwb25zZURhdGEgKz0gY2h1bmsudG9TdHJpbmcoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXNwb25zZS5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbGVhc2VzID0gSlNPTi5wYXJzZShyZXNwb25zZURhdGEpO1xuICAgICAgICAgICAgICAvLyBHZXQgbGF0ZXN0IG5vbi1kcmFmdCByZWxlYXNlXG4gICAgICAgICAgICAgIGNvbnN0IGxhdGVzdFJlbGVhc2UgPSByZWxlYXNlcy5maW5kKChyZWxlYXNlOiBhbnkpID0+ICFyZWxlYXNlLmRyYWZ0KTtcbiAgICAgICAgICAgICAgaWYgKGxhdGVzdFJlbGVhc2UpIHtcbiAgICAgICAgICAgICAgICBsb2dJbmZvKGBGb3VuZCBsYXRlc3QgR2l0SHViIHJlbGVhc2U6ICR7bGF0ZXN0UmVsZWFzZS50YWdfbmFtZX1gKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGxhdGVzdFJlbGVhc2UpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKCdObyB2YWxpZCByZWxlYXNlcyBmb3VuZCcpO1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05vIHZhbGlkIHJlbGVhc2VzIGZvdW5kJykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBsb2dFcnJvcignRXJyb3IgcGFyc2luZyBHaXRIdWIgQVBJIHJlc3BvbnNlJywgZXJyb3IpO1xuICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dFcnJvcihgR2l0SHViIEFQSSByZXR1cm5lZCBzdGF0dXMgY29kZSAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9YCk7XG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBHaXRIdWIgQVBJIHJldHVybmVkIHN0YXR1cyBjb2RlICR7cmVzcG9uc2Uuc3RhdHVzQ29kZX1gKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xuICAgICAgICBsb2dFcnJvcignRXJyb3IgZmV0Y2hpbmcgR2l0SHViIHJlbGVhc2VzJywgZXJyb3IpO1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFNldCB0aW1lb3V0ICgxMCBzZWNvbmRzKVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1JlcXVlc3QgdGltZWQgb3V0IGFmdGVyIDEwIHNlY29uZHMnKSk7XG4gICAgICB9LCAxMDAwMCk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2VuZCByZXF1ZXN0XG4gICAgcmVxdWVzdC5lbmQoKTtcbiAgICBcbiAgICByZXR1cm4gYXdhaXQgcmVzcG9uc2VQcm9taXNlO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ0Vycm9yKCdFcnJvciBpbiBmZXRjaC1naXRodWItcmVsZWFzZXMgaGFuZGxlcicsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbi8qKlxuICogU2hvdyBzeXN0ZW0gbm90aWZpY2F0aW9uIGZvciBuZXcgdXBkYXRlc1xuICovXG5pcGNNYWluLm9uKCdzaG93LXVwZGF0ZS1ub3RpZmljYXRpb24nLCAoX2V2ZW50LCB7IHRpdGxlLCBib2R5IH0pID0+IHtcbiAgdHJ5IHtcbiAgICAvLyBPbmx5IHByb2NlZWQgaWYgd2UncmUgbm90IG9uIExpbnV4IGFzIHNvbWUgTGludXggZGlzdHJvcyBkb24ndCBzdXBwb3J0IG5vdGlmaWNhdGlvbnMgd2VsbFxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgICBsb2dJbmZvKCdTa2lwcGluZyB1cGRhdGUgbm90aWZpY2F0aW9uIG9uIExpbnV4IHBsYXRmb3JtJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGxvZ0luZm8oYFNob3dpbmcgdXBkYXRlIG5vdGlmaWNhdGlvbjogJHt0aXRsZX1gKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgbm90aWZpY2F0aW9uXG4gICAgY29uc3Qgbm90aWZpY2F0aW9uID0gbmV3IE5vdGlmaWNhdGlvbih7XG4gICAgICB0aXRsZTogdGl0bGUgfHwgJ1VwZGF0ZSBBdmFpbGFibGUnLFxuICAgICAgYm9keTogYm9keSB8fCAnQSBuZXcgdmVyc2lvbiBvZiBPZG9vIE1hbmFnZXIgaXMgYXZhaWxhYmxlLicsXG4gICAgICBzaWxlbnQ6IGZhbHNlXG4gICAgfSk7XG4gICAgXG4gICAgLy8gU2hvdyBub3RpZmljYXRpb25cbiAgICBub3RpZmljYXRpb24uc2hvdygpO1xuICAgIFxuICAgIC8vIEhhbmRsZSBjbGlja1xuICAgIG5vdGlmaWNhdGlvbi5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICBsb2dJbmZvKCdVcGRhdGUgbm90aWZpY2F0aW9uIGNsaWNrZWQnKTtcbiAgICAgIGlmICh3aW5kb3dzLm1haW4gJiYgIXdpbmRvd3MubWFpbi5pc0Rlc3Ryb3llZCgpKSB7XG4gICAgICAgIHdpbmRvd3MubWFpbi53ZWJDb250ZW50cy5zZW5kKCdvcGVuLXVwZGF0ZS1zZWN0aW9uJyk7XG4gICAgICAgIGlmICghd2luZG93cy5tYWluLmlzVmlzaWJsZSgpKSB7XG4gICAgICAgICAgd2luZG93cy5tYWluLnNob3coKTtcbiAgICAgICAgfVxuICAgICAgICB3aW5kb3dzLm1haW4uZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3Igc2hvd2luZyB1cGRhdGUgbm90aWZpY2F0aW9uJywgZXJyb3IpO1xuICB9XG59KTtcblxuLy8gVGVzdCBwb3J0IGF2YWlsYWJpbGl0eSB1c2luZyBhIGRpcmVjdCBzb2NrZXQgdGVzdFxuaXBjTWFpbi5oYW5kbGUoJ3Rlc3QtcG9ydC1hdmFpbGFiaWxpdHknLCBhc3luYyAoX2V2ZW50LCBwb3J0KSA9PiB7XG4gIHRyeSB7XG4gICAgbG9nSW5mbyhgVGVzdGluZyBwb3J0ICR7cG9ydH0gYXZhaWxhYmlsaXR5YCk7XG4gICAgY29uc3QgbmV0ID0gcmVxdWlyZSgnbmV0Jyk7XG4gICAgY29uc3QgdGVzdGVyID0gbmV0LmNyZWF0ZVNlcnZlcigpO1xuXG4gICAgY29uc3QgaXNBdmFpbGFibGUgPSBhd2FpdCBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGVzdGVyLm9uY2UoJ2Vycm9yJywgKGVycjogYW55KSA9PiB7XG4gICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgcmVzb2x2ZShmYWxzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nRXJyb3IoYFBvcnQgdGVzdCBlbmNvdW50ZXJlZCBhbiBlcnJvcjogJHtlcnIubWVzc2FnZX1gLCBlcnIpO1xuICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGVzdGVyLm9uY2UoJ2xpc3RlbmluZycsICgpID0+IHtcbiAgICAgICAgdGVzdGVyLmNsb3NlKCgpID0+IHJlc29sdmUodHJ1ZSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHRlc3Rlci5saXN0ZW4ocG9ydCwgJzAuMC4wLjAnKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBpc0F2YWlsYWJsZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihgRXJyb3IgdGVzdGluZyBwb3J0IGF2YWlsYWJpbGl0eWAsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG4vLyBSZXN0YXJ0IGFwcFxuaXBjTWFpbi5vbigncmVzdGFydC1hcHAnLCAoKSA9PiB7XG4gIGFwcC5yZWxhdW5jaCgpO1xuICBhcHAuZXhpdCgpO1xufSk7XG5cbi8vIFF1aXQgYXBwXG5pcGNNYWluLm9uKCdxdWl0LWFwcCcsICgpID0+IHtcbiAgYXBwLnF1aXQoKTtcbn0pO1xuXG4vLyBDaGVjayBpZiBhdXRvIHVwZGF0ZSBpcyBlbmFibGVkIGluIHNldHRpbmdzXG5pcGNNYWluLmhhbmRsZSgnZ2V0LWF1dG8tdXBkYXRlLWVuYWJsZWQnLCBhc3luYyAoKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgd29ya0RpclBhdGggPSBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICd3b3JrZGlyLmpzb24nKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMod29ya0RpclBhdGgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3Qgd29ya0RpckRhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh3b3JrRGlyUGF0aCwgJ3V0ZjgnKSk7XG4gICAgY29uc3Qgd29ya0RpciA9IHdvcmtEaXJEYXRhLndvcmtEaXI7XG5cbiAgICBpZiAoIXdvcmtEaXIgfHwgIWZzLmV4aXN0c1N5bmMod29ya0RpcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBzZXR0aW5nc1BhdGggPSBwYXRoLmpvaW4od29ya0RpciwgJ3NldHRpbmdzLmpzb24nKTtcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc2V0dGluZ3NQYXRoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmOCcpKTtcbiAgICByZXR1cm4gc2V0dGluZ3MuYXV0b0NoZWNrVXBkYXRlcyA9PT0gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcignRXJyb3IgY2hlY2tpbmcgYXV0byB1cGRhdGUgc2V0dGluZycsIGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pOyJdLCJuYW1lcyI6WyJwYXRoIiwiZnMiLCJsb2dFcnJvciIsImxvZ0luZm8iLCJMT0dfRklMRV9TSVpFX0xJTUlUIiwiTUFYX0xPR19GSUxFUyIsIkxvZ0xldmVsIiwib3MiLCJleGVjQXN5bmMiLCJwcm9taXNpZnkiLCJleGVjIiwiZXJyb3IiLCJpcGNNYWluIiwiZGlhbG9nIiwiYXBwIiwibG9nRmlsZVBhdGgiLCJzaGVsbCIsIndpbmRvdyIsIkJyb3dzZXJXaW5kb3ciLCJNZW51Iiwid2luZG93cyIsIm5ldCIsIk5vdGlmaWNhdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFzQkEsTUFBTSxrQkFBNEI7QUFBQSxFQUM5QixPQUFPO0FBQUEsRUFDUCxVQUFVO0FBQUEsRUFDVixTQUFTO0FBQUEsRUFDVCxtQkFBbUI7QUFBQSxFQUNuQixrQkFBa0I7QUFBQSxFQUNsQixzQkFBc0I7QUFBQSxFQUN0Qix5QkFBeUI7QUFBQSxFQUN6QixpQkFBaUI7QUFBQSxFQUNqQixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsRUFDbEMsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUN0QztBQUVBLE1BQU0sZ0JBQWdCO0FBQUEsRUFHbEIsY0FBYztBQUZOO0FBSUosU0FBSyxrQkFBa0JBLGdCQUFLLEtBQUssZUFBQSxHQUFrQixjQUFjO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPckUsTUFBTSxtQkFBcUM7QUFDbkMsUUFBQTtBQUNNLFlBQUEsY0FBYyxNQUFNLEtBQUssZUFBZTtBQUM5QyxVQUFJLENBQUMsYUFBYTtBQUNQLGVBQUE7QUFBQSxNQUFBO0FBR1gsWUFBTSxlQUFlQSxnQkFBSyxLQUFLLGFBQWEsZUFBZTtBQUMzRCxVQUFJLENBQUNDLGNBQUcsV0FBVyxZQUFZLEdBQUc7QUFDdkIsZUFBQTtBQUFBLE1BQUE7QUFJSixhQUFBO0FBQUEsYUFDRixPQUFPO0FBQ1pDLGlCQUFTLHdDQUF3QyxLQUFLO0FBQy9DLGFBQUE7QUFBQSxJQUFBO0FBQUEsRUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPSixNQUFNLGlCQUF5QztBQUN2QyxRQUFBO0FBQ0EsVUFBSSxDQUFDRCxjQUFHLFdBQVcsS0FBSyxlQUFlLEdBQUc7QUFDL0IsZUFBQTtBQUFBLE1BQUE7QUFHTCxZQUFBLE9BQU8sS0FBSyxNQUFNQSxjQUFHLGFBQWEsS0FBSyxpQkFBaUIsT0FBTyxDQUFDO0FBQ2xFLFVBQUEsQ0FBQyxLQUFLLFdBQVcsQ0FBQ0EsY0FBRyxXQUFXLEtBQUssT0FBTyxHQUFHO0FBQ3hDLGVBQUE7QUFBQSxNQUFBO0FBR1gsYUFBTyxLQUFLO0FBQUEsYUFDUCxPQUFPO0FBQ1pDLGlCQUFTLHFDQUFxQyxLQUFLO0FBQzVDLGFBQUE7QUFBQSxJQUFBO0FBQUEsRUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFKLE1BQU0sZ0JBQWdCLGFBQXVDO0FBQ3JELFFBQUE7QUFDQSxnQkFBVUYsZ0JBQUssUUFBUSxLQUFLLGVBQWUsQ0FBQztBQUN6Q0Msb0JBQUEsY0FBYyxLQUFLLGlCQUFpQixLQUFLLFVBQVUsRUFBRSxTQUFTLFlBQVksR0FBRyxNQUFNLENBQUMsQ0FBQztBQUNoRkUsZ0JBQUEsOEJBQThCLFdBQVcsRUFBRTtBQUM1QyxhQUFBO0FBQUEsYUFDRixPQUFPO0FBQ1pELGlCQUFTLG9DQUFvQyxLQUFLO0FBQzNDLGFBQUE7QUFBQSxJQUFBO0FBQUEsRUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPSixNQUFNLGVBQXlDO0FBQ3ZDLFFBQUE7QUFDTSxZQUFBLGNBQWMsTUFBTSxLQUFLLGVBQWU7QUFDOUMsVUFBSSxDQUFDLGFBQWE7QUFDUCxlQUFBO0FBQUEsTUFBQTtBQUdYLFlBQU0sZUFBZUYsZ0JBQUssS0FBSyxhQUFhLGVBQWU7QUFDM0QsVUFBSSxDQUFDQyxjQUFHLFdBQVcsWUFBWSxHQUFHO0FBQ3ZCLGVBQUE7QUFBQSxNQUFBO0FBR1gsWUFBTSxXQUFXLEtBQUssTUFBTUEsY0FBRyxhQUFhLGNBQWMsT0FBTyxDQUFDO0FBQ2xFRSxnQkFBUSxxQ0FBcUM7QUFDN0MsYUFBTyxFQUFFLEdBQUcsaUJBQWlCLEdBQUcsU0FBUztBQUFBLGFBQ3BDLE9BQU87QUFDWkQsaUJBQVMsMEJBQTBCLEtBQUs7QUFDakMsYUFBQTtBQUFBLElBQUE7QUFBQSxFQUNYO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFTSixNQUFNLGFBQWEsVUFBNkIsYUFBdUM7QUFDL0UsUUFBQTtBQUVBLGdCQUFVLFdBQVc7QUFHckIsWUFBTSxpQkFBaUIsRUFBRSxHQUFHLGlCQUFpQixHQUFHLFNBQVM7QUFDekQscUJBQWUsYUFBWSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUdsRCxZQUFNLGVBQWVGLGdCQUFLLEtBQUssYUFBYSxlQUFlO0FBQzNEQyxvQkFBRyxjQUFjLGNBQWMsS0FBSyxVQUFVLGdCQUFnQixNQUFNLENBQUMsQ0FBQztBQUU5REUsZ0JBQUEscUNBQXFDLFdBQVcsRUFBRTtBQUNuRCxhQUFBO0FBQUEsYUFDRixPQUFPO0FBQ1pELGlCQUFTLHlCQUF5QixLQUFLO0FBQ2hDLGFBQUE7QUFBQSxJQUFBO0FBQUEsRUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFKLE1BQU0sZUFBZSxTQUE4QztBQUMzRCxRQUFBO0FBQ00sWUFBQSxrQkFBa0IsTUFBTSxLQUFLLGFBQWE7QUFDaEQsVUFBSSxDQUFDLGlCQUFpQjtBQUNYLGVBQUE7QUFBQSxNQUFBO0FBR0wsWUFBQSxjQUFjLE1BQU0sS0FBSyxlQUFlO0FBQzlDLFVBQUksQ0FBQyxhQUFhO0FBQ1AsZUFBQTtBQUFBLE1BQUE7QUFJWCxZQUFNLGtCQUFrQjtBQUFBLFFBQ3BCLEdBQUc7QUFBQSxRQUNILEdBQUc7QUFBQSxRQUNILFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxNQUN0QztBQUdBLFlBQU0sZUFBZUYsZ0JBQUssS0FBSyxhQUFhLGVBQWU7QUFDM0RDLG9CQUFHLGNBQWMsY0FBYyxLQUFLLFVBQVUsaUJBQWlCLE1BQU0sQ0FBQyxDQUFDO0FBRXZFRSxnQkFBUSxrQkFBa0I7QUFDbkIsYUFBQTtBQUFBLGFBQ0YsT0FBTztBQUNaRCxpQkFBUywyQkFBMkIsS0FBSztBQUNsQyxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1g7QUFFUjtBQUdBLE1BQU0sa0JBQWtCLElBQUksZ0JBQWdCO0FDbk1yQyxNQUFNLGFBQWEsTUFBTTtBQUU1QixTQUFPLE9BQU8sV0FBVyxlQUFlLE9BQU8sV0FBVyxPQUFPLFFBQVE7QUFDN0U7QUNJQSxJQUFJLDRCQUE0QjtBQUNoQyxJQUFJLHVCQUFzQztBQUMxQyxJQUFJLDBCQUFzRCxDQUFDO0FBRzNELE1BQU1FLHdCQUFzQixJQUFJLE9BQU87QUFDdkMsTUFBTUMsa0JBQWdCO0FBR3RCLElBQUssNkJBQUFDLGNBQUw7QUFDSUEsWUFBQUEsVUFBQSxXQUFRLENBQVIsSUFBQTtBQUNBQSxZQUFBQSxVQUFBLFVBQU8sQ0FBUCxJQUFBO0FBQ0FBLFlBQUFBLFVBQUEsVUFBTyxDQUFQLElBQUE7QUFDQUEsWUFBQUEsVUFBQSxXQUFRLENBQVIsSUFBQTtBQUpDQSxTQUFBQTtBQUFBLEdBQUEsWUFBQSxDQUFBLENBQUE7QUFrQkwsTUFBTSxVQUFOLE1BQU0sUUFBTztBQUFBLEVBT1QsY0FBYztBQU5OLG9DQUFxQjtBQUNyQixtQ0FBa0I7QUFFbEIsdUNBQXVCO0FBQ3ZCLG9DQUEwQjtBQUl6QixTQUFBLFdBQXFFO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPOUUsWUFBWSxJQUFrQjtBQUMxQixTQUFLLFdBQVc7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9wQixjQUE2QjtBQUN6QixXQUFPLEtBQUs7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9oQixNQUFNLGdCQUF3QztBQUMxQyxRQUFJLENBQUMsV0FBVyxLQUFLLEtBQUssYUFBYSxhQUFhLEtBQUs7QUFFckQsUUFBQTtBQUNBLFlBQU0sY0FBYyxPQUFPO0FBQ3ZCLFVBQUEsZUFBZSxZQUFZLFFBQVE7QUFDbkMsYUFBSyxXQUFXLE1BQU0sWUFBWSxPQUFPLGVBQWU7QUFDeEQsZUFBTyxLQUFLO0FBQUEsTUFBQTtBQUFBLGFBRVgsT0FBTztBQUNKLGNBQUEsTUFBTSw0QkFBNEIsS0FBSztBQUFBLElBQUE7QUFFNUMsV0FBQTtBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT1gsT0FBTyxxQkFBb0M7QUFDdkMsUUFBSSxjQUFjO0FBQ1YsVUFBQTtBQUVBLGNBQU0sY0FBYyxPQUFPO0FBQ3ZCLFlBQUEsZUFBZSxZQUFZLFFBQVE7QUFHNUIsaUJBQUE7QUFBQSxRQUFBO0FBQUEsZUFFTixPQUFPO0FBQ0osZ0JBQUEsTUFBTSxvQ0FBb0MsS0FBSztBQUFBLE1BQUE7QUFBQSxJQUMzRDtBQUVHLFdBQUE7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9YLE9BQU8sZ0JBQWdCLFNBQXVCO0FBQzFDLFFBQUksV0FBZ0IsS0FBQSxXQUFXTCxjQUFHLFdBQVcsT0FBTyxHQUFHO0FBQy9DLFVBQUE7QUFDQSxjQUFNLGNBQWMsT0FBTztBQUN2QixZQUFBLGVBQWUsWUFBWSxNQUFNO0FBQ3JCLHNCQUFBLEtBQUsscUJBQXFCLE9BQU87QUFDdEIsaUNBQUE7QUFBQSxRQUFBO0FBQUEsZUFFdEIsT0FBTztBQUNKLGdCQUFBLE1BQU0sa0RBQWtELEtBQUs7QUFBQSxNQUFBO0FBQUEsSUFDekU7QUFBQSxFQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFTSixNQUFNLG1CQUFtQixPQUFlLEdBQWtCO0FBQ2xELFFBQUE7QUFFTSxZQUFBLFdBQVcsS0FBSyxZQUFZO0FBQzlCLFVBQUEsU0FBUyxXQUFXLEdBQUc7QUFDdkI7QUFBQSxNQUFBO0FBR0ksY0FBQSxJQUFJLHFDQUFxQyxJQUFJLG1CQUFtQjtBQUd4RSxZQUFNLE9BQU0sb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFFL0IsWUFBTSxTQUFTLE9BQU8sS0FBSyxLQUFLLEtBQUs7QUFFckMsWUFBTSxZQUFZLE1BQU07QUFHbEIsWUFBQSxXQUFXLFNBQVMsT0FBTyxDQUFRLFNBQUE7QUFFckMsWUFBSSxTQUFTLEtBQUssV0FBVyxTQUFTLHNCQUFzQjtBQUNqRCxpQkFBQTtBQUFBLFFBQUE7QUFJWCxjQUFNLGNBQWNELGdCQUFLLFNBQVMsS0FBSyxXQUFXLElBQUksTUFBTTtBQUM1RCxZQUFJQSxnQkFBSyxTQUFTLElBQUksRUFBRSxXQUFXLEdBQUcsV0FBVyxHQUFHLEtBQ2hEQSxnQkFBSyxTQUFTLElBQUksRUFBRSxTQUFTLE1BQU0sR0FBRztBQUMvQixpQkFBQTtBQUFBLFFBQUE7QUFHUCxZQUFBO0FBQ00sZ0JBQUEsUUFBUUMsY0FBRyxTQUFTLElBQUk7QUFFOUIsZ0JBQU0sV0FBVyxLQUFLLElBQUksTUFBTSxhQUFhLE1BQU0sT0FBTztBQUMxRCxpQkFBTyxXQUFXO0FBQUEsaUJBQ2IsS0FBSztBQUNWLGtCQUFRLE1BQU0sK0JBQStCLElBQUksS0FBSyxHQUFHO0FBQ2xELGlCQUFBO0FBQUEsUUFBQTtBQUFBLE1BQ1gsQ0FDSDtBQUdHLFVBQUEsU0FBUyxTQUFTLEdBQUc7QUFDckIsZ0JBQVEsSUFBSSxTQUFTLFNBQVMsTUFBTSx5QkFBeUIsSUFBSSxpQkFBaUI7QUFFbEYsbUJBQVcsUUFBUSxVQUFVO0FBQ3JCLGNBQUE7QUFDQUEsMEJBQUcsV0FBVyxJQUFJO0FBQ1Ysb0JBQUEsSUFBSSx5QkFBeUIsSUFBSSxFQUFFO0FBQUEsbUJBQ3RDLEtBQUs7QUFDVixvQkFBUSxNQUFNLCtCQUErQixJQUFJLEtBQUssR0FBRztBQUFBLFVBQUE7QUFBQSxRQUM3RDtBQUFBLE1BQ0osT0FDRztBQUNLLGdCQUFBLElBQUksMkJBQTJCLElBQUksYUFBYTtBQUFBLE1BQUE7QUFBQSxhQUV2RCxLQUFLO0FBQ0YsY0FBQSxNQUFNLGtDQUFrQyxHQUFHO0FBQUEsSUFBQTtBQUFBLEVBQ3ZEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBUUksdUJBQXVCLGFBQThCO0FBQ3JELFFBQUEsQ0FBQyxLQUFLLFFBQWdCLFFBQUE7QUFDcEIsVUFBQSxNQUFNLEdBQUcsS0FBSyxPQUFPLElBQUksV0FBVyxJQUFJLEtBQUssWUFBWSxTQUFTO0FBQ2pFLFdBQUEsd0JBQXdCLEdBQUcsTUFBTTtBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT3BDLHlCQUF5QixhQUEyQjtBQUNwRCxRQUFBLENBQUMsS0FBSyxRQUFTO0FBQ2IsVUFBQSxNQUFNLEdBQUcsS0FBSyxPQUFPLElBQUksV0FBVyxJQUFJLEtBQUssWUFBWSxTQUFTO0FBQ3hFLDRCQUF3QixHQUFHLElBQUk7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9uQyxNQUFNLGFBQTRCO0FBRTlCLFFBQUksV0FBVyxLQUFLLEtBQUssYUFBYSxNQUFNO0FBQ3hDLFlBQU0sS0FBSyxjQUFjO0FBQUEsSUFBQTtBQUk3QixRQUFJLDJCQUEyQjtBQUMzQixjQUFRLElBQUksd0VBQXdFLEtBQUssUUFBUSxHQUFHO0FBR3BHLFVBQUksd0JBQXdCQSxjQUFHLFdBQVcsb0JBQW9CLEdBQUc7QUFDN0QsYUFBSyxVQUFVO0FBQ2YsYUFBSyxjQUFjO0FBR25CLFlBQUksQ0FBQyxLQUFLLHVCQUF1QixRQUFRLEdBQUc7QUFDcEMsY0FBQTtBQUNBLGtCQUFNLGlCQUNGO0FBQUE7QUFBQSxtQkFDb0IsS0FBSyxnQkFBb0Isb0JBQUEsTUFBTSxDQUFDO0FBQUE7QUFBQTtBQUVyREEsMEJBQUEsZUFBZSxLQUFLLFNBQVMsY0FBYztBQUM5QyxpQkFBSyx5QkFBeUIsUUFBUTtBQUFBLG1CQUNqQyxLQUFLO0FBQ0Ysb0JBQUEsTUFBTSxnREFBZ0QsR0FBRztBQUFBLFVBQUE7QUFBQSxRQUNyRTtBQUFBLE1BQ0o7QUFFSjtBQUFBLElBQUE7QUFLSixRQUFJLGtCQUFrQjtBQUN0QixRQUFJLGNBQWM7QUFDVixVQUFBO0FBRUEsY0FBTSxjQUFjLE9BQU87QUFDdkIsWUFBQSxlQUFlLFlBQVksUUFBUTtBQUM3QixnQkFBQSxpQkFBaUIsSUFBSSxRQUFjLENBQUMsWUFBWSxXQUFXLE1BQU0sUUFBUSxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ3hFLDRCQUFBLE1BQU0sUUFBUSxLQUFLO0FBQUEsWUFDakMsWUFBWSxPQUFPLHFCQUFxQjtBQUFBLFlBQ3hDO0FBQUEsVUFBQSxDQUNIO0FBQUEsUUFBQTtBQUFBLGVBRUEsT0FBTztBQUNKLGdCQUFBLE1BQU0sbURBQW1ELEtBQUs7QUFBQSxNQUFBO0FBQUEsSUFDMUU7QUFHSixRQUFJLG1CQUFtQkEsY0FBRyxXQUFXLGVBQWUsR0FBRztBQUNuRCxjQUFRLElBQUksbUNBQW1DLGVBQWUsWUFBWSxLQUFLLFFBQVEsR0FBRztBQUMxRixXQUFLLFVBQVU7QUFDZixXQUFLLGNBQWM7QUFDUyxrQ0FBQTtBQUc1QixVQUFJLENBQUMsS0FBSyx1QkFBdUIsUUFBUSxHQUFHO0FBQ3BDLFlBQUE7QUFDQSxnQkFBTSxpQkFDRjtBQUFBO0FBQUEsbUJBQ29CLEtBQUssZ0JBQW9CLG9CQUFBLE1BQU0sQ0FBQztBQUFBO0FBQUE7QUFFckRBLHdCQUFBLGVBQWUsS0FBSyxTQUFTLGNBQWM7QUFDOUMsZUFBSyx5QkFBeUIsUUFBUTtBQUFBLGlCQUNqQyxLQUFLO0FBQ0Ysa0JBQUEsTUFBTSxnREFBZ0QsR0FBRztBQUFBLFFBQUE7QUFBQSxNQUNyRTtBQUVKO0FBQUEsSUFBQTtBQUdKLFlBQVEsSUFBSSxrQ0FBa0MsS0FBSyxRQUFRLEtBQUs7QUFFNUQsUUFBQTtBQUVNLFlBQUEsY0FBYyxNQUFNLGdCQUFnQixlQUFlO0FBQ3pELGNBQVEsSUFBSSxtQkFBbUIsZUFBZSxTQUFTLEVBQUU7QUFHbkQsWUFBQSxXQUFXLFlBQVksZUFBZSxNQUFTO0FBQzdDLGNBQUEsSUFBSSxtQkFBbUIsUUFBUSxFQUFFO0FBR3pDLFdBQUssVUFBVUQsZ0JBQUssS0FBSyxVQUFVLFNBQVM7QUFDNUMsY0FBUSxJQUFJLDJCQUEyQixLQUFLLE9BQU8sRUFBRTtBQUdyRCxVQUFJLENBQUNDLGNBQUcsV0FBVyxLQUFLLE9BQU8sR0FBRztBQUV4QixjQUFBLDBCQUFVLEtBQUs7QUFDckIsY0FBTSxpQkFDRjtBQUFBO0FBQUEsV0FFWSxLQUFLLGdCQUFnQixHQUFHLENBQUM7QUFBQSxlQUNyQixZQUFpQztBQUFBO0FBQUE7QUFHbERBLHNCQUFBLGNBQWMsS0FBSyxTQUFTLGNBQWM7QUFDN0MsYUFBSyx5QkFBeUIsT0FBTztBQUFBLE1BQzlCLFdBQUEsQ0FBQyxLQUFLLHVCQUF1QixPQUFPLEdBQUc7QUFFOUMsY0FBTSxpQkFDRjtBQUFBO0FBQUEsbUJBQ29CLEtBQUssZ0JBQW9CLG9CQUFBLE1BQU0sQ0FBQztBQUFBO0FBQUE7QUFFckRBLHNCQUFBLGVBQWUsS0FBSyxTQUFTLGNBQWM7QUFDOUMsYUFBSyx5QkFBeUIsT0FBTztBQUFBLE1BQUE7QUFJekMsNkJBQXVCLEtBQUs7QUFHckIsY0FBQSxnQkFBZ0IsS0FBSyxPQUFPO0FBRW5DLGNBQVEsSUFBSSxpQ0FBaUMsS0FBSyxPQUFPLEVBQUU7QUFDM0QsV0FBSyxjQUFjO0FBQ1Msa0NBQUE7QUFDNUIsV0FBSyxLQUFLLGlDQUFpQztBQUMzQyxXQUFLLEtBQUssNkNBQTZDRyx5QkFBdUIsT0FBTyxLQUFLLEtBQUs7QUFDL0YsV0FBSyxLQUFLLCtCQUErQixLQUFLLE9BQU8sRUFBRTtBQUFBLGFBQ2xELEtBQUs7QUFDRixjQUFBLE1BQU0sZ0NBQWdDLEdBQUc7QUFBQSxJQUFBO0FBQUEsRUFDckQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRSSxzQkFBc0IsTUFBb0I7QUFDeEMsVUFBQSxPQUFPLEtBQUssWUFBWTtBQUN4QixVQUFBLFFBQVEsT0FBTyxLQUFLLFNBQUEsSUFBYSxDQUFDLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDbkQsVUFBQSxNQUFNLE9BQU8sS0FBSyxRQUFTLENBQUEsRUFBRSxTQUFTLEdBQUcsR0FBRztBQUM1QyxVQUFBLFFBQVEsT0FBTyxLQUFLLFNBQVUsQ0FBQSxFQUFFLFNBQVMsR0FBRyxHQUFHO0FBQy9DLFVBQUEsVUFBVSxPQUFPLEtBQUssV0FBWSxDQUFBLEVBQUUsU0FBUyxHQUFHLEdBQUc7QUFDbkQsVUFBQSxVQUFVLE9BQU8sS0FBSyxXQUFZLENBQUEsRUFBRSxTQUFTLEdBQUcsR0FBRztBQUVsRCxXQUFBLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksS0FBSyxJQUFJLE9BQU8sSUFBSSxPQUFPO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVF6RCxnQkFBZ0IsTUFBb0I7QUFDeEMsV0FBTyxLQUFLLGVBQWU7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU8vQixPQUFPLGNBQXNCO0FBQ3JCLFFBQUEsQ0FBQyxRQUFPLFVBQVU7QUFDWCxjQUFBLFdBQVcsSUFBSSxRQUFPO0FBQUEsSUFBQTtBQUVqQyxXQUFPLFFBQU87QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9sQixZQUFZLE9BQXVCO0FBQy9CLFNBQUssV0FBVztBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT3BCLGlCQUF5QjtBQUNyQixXQUFPLEtBQUs7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9SLHdCQUFpQztBQUNqQyxRQUFBLENBQUMsS0FBSyxlQUFlLENBQUMsS0FBSyxXQUFXLENBQUNILGNBQUcsV0FBVyxLQUFLLE9BQU8sR0FBRztBQUM3RCxhQUFBO0FBQUEsSUFBQTtBQUdQLFFBQUE7QUFDQSxZQUFNLFFBQVFBLGNBQUcsU0FBUyxLQUFLLE9BQU87QUFDbEMsVUFBQSxNQUFNLE9BQU9HLHVCQUFxQjtBQUMzQixlQUFBO0FBQUEsTUFBQTtBQUdYLGNBQVEsSUFBSSxrQkFBa0IsTUFBTSxJQUFJLDBCQUEwQkEscUJBQW1CLDJCQUEyQjtBQUdoSCxZQUFNLFVBQVVKLGdCQUFLLFFBQVEsS0FBSyxPQUFPO0FBR3pDLFlBQU0sY0FBY0EsZ0JBQUssU0FBUyxLQUFLLFNBQVMsTUFBTTtBQUN0RCxZQUFNLGNBQWNDLGNBQUcsWUFBWSxPQUFPLEVBQ3JDLE9BQU8sT0FBSyxFQUFFLFdBQVcsR0FBRyxXQUFXLEdBQUcsS0FBSyxFQUFFLFNBQVMsTUFBTSxDQUFDLEVBQ2pFLEtBQUs7QUFHVixlQUFTLElBQUksWUFBWSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDeEMsY0FBQSxRQUFRLFlBQVksQ0FBQyxFQUFFLE1BQU0sSUFBSSxPQUFPLEdBQUcsV0FBVyxXQUFjLENBQUM7QUFDM0UsWUFBSSxPQUFPO0FBQ1AsZ0JBQU0saUJBQWlCLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUN4QyxjQUFBLGtCQUFrQkksa0JBQWdCLEdBQUc7QUFFckMsa0JBQU0sWUFBWUwsZ0JBQUssS0FBSyxTQUFTLFlBQVksQ0FBQyxDQUFDO0FBQ25EQywwQkFBRyxXQUFXLFNBQVM7QUFDZixvQkFBQSxJQUFJLHlCQUF5QixTQUFTLEVBQUU7QUFBQSxVQUFBLE9BQzdDO0FBRUgsa0JBQU0sVUFBVUQsZ0JBQUssS0FBSyxTQUFTLFlBQVksQ0FBQyxDQUFDO0FBQzNDLGtCQUFBLFVBQVVBLGdCQUFLLEtBQUssU0FBUyxHQUFHLFdBQVcsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNO0FBQzFFQywwQkFBQSxXQUFXLFNBQVMsT0FBTztBQUM5QixvQkFBUSxJQUFJLHFCQUFxQixPQUFPLE9BQU8sT0FBTyxFQUFFO0FBQUEsVUFBQTtBQUFBLFFBQzVEO0FBQUEsTUFDSjtBQUlKLFlBQU0saUJBQWlCRCxnQkFBSyxLQUFLLFNBQVMsR0FBRyxXQUFXLFFBQVE7QUFDN0RDLG9CQUFBLFdBQVcsS0FBSyxTQUFTLGNBQWM7QUFDMUMsY0FBUSxJQUFJLDBCQUEwQixLQUFLLE9BQU8sT0FBTyxjQUFjLEVBQUU7QUFHbkUsWUFBQSwwQkFBVSxLQUFLO0FBQ3JCLFlBQU0saUJBQ0Y7QUFBQTtBQUFBLFdBRVksS0FBSyxnQkFBZ0IsR0FBRyxDQUFDO0FBQUEsZUFDckIsWUFBaUM7QUFBQTtBQUFBO0FBRWxEQSxvQkFBQSxjQUFjLEtBQUssU0FBUyxjQUFjO0FBRzdDLGdDQUEwQixDQUFDO0FBQzNCLFdBQUsseUJBQXlCLE9BQU87QUFFOUIsYUFBQTtBQUFBLGFBQ0YsS0FBSztBQUNGLGNBQUEsTUFBTSw0QkFBNEIsR0FBRztBQUN0QyxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1g7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVNJLElBQUksT0FBaUIsU0FBaUIsT0FBK0I7QUFDckUsUUFBQSxRQUFRLEtBQUssU0FBVTtBQUUzQixVQUFNLFlBQVksS0FBSyxnQkFBZ0Isb0JBQUksTUFBTTtBQUMzQyxVQUFBLFdBQVcsU0FBUyxLQUFLO0FBQy9CLFVBQU0sZUFBZSxLQUFLLGFBQWEsT0FBTyxXQUFXLEtBQUssUUFBUSxPQUFPO0FBRXpFLFFBQUEsYUFBYSxJQUFJLFNBQVMsTUFBTSxRQUFRLEtBQUssWUFBWSxHQUFHLE9BQU87QUFDdkUsUUFBSSxPQUFPO0FBQ0gsVUFBQTtBQUNKLFVBQUksaUJBQWlCLE9BQU87QUFDYixtQkFBQSxNQUFNLFNBQVMsTUFBTTtBQUFBLE1BQUEsV0FDekIsT0FBTyxVQUFVLFVBQVU7QUFDdkIsbUJBQUE7QUFBQSxNQUFBLE9BQ1I7QUFDQyxZQUFBO0FBQ1cscUJBQUEsS0FBSyxVQUFVLEtBQUs7QUFBQSxRQUFBLFFBQzNCO0FBQ0oscUJBQVcsT0FBTyxLQUFLO0FBQUEsUUFBQTtBQUFBLE1BQzNCO0FBRVUsb0JBQUE7QUFBQSxFQUFLLFFBQVE7QUFBQSxJQUFBO0FBSXpCLFVBQUEsZ0JBQWdCLFVBQVUsSUFBaUIsVUFDN0MsVUFBVSxJQUFnQixTQUN0QixVQUFVLElBQWlCLFVBQVU7QUFDckMsWUFBQSxhQUFhLEVBQUUsVUFBVTtBQUc3QixRQUFBLEtBQUssZUFBZSxLQUFLLFNBQVM7QUFDOUIsVUFBQTtBQUVBLGFBQUssc0JBQXNCO0FBRzNCQSxzQkFBRyxlQUFlLEtBQUssU0FBUyxhQUFhLElBQUk7QUFBQSxlQUM1QyxLQUFLO0FBQ0YsZ0JBQUEsTUFBTSxnQ0FBZ0MsR0FBRztBQUFBLE1BQUE7QUFBQSxJQUNyRDtBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRSixNQUFNLFNBQWlCLE1BQWtCO0FBQ2hDLFNBQUEsSUFBSSxHQUFnQixTQUFTLElBQUk7QUFBQSxFQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBUTFDLEtBQUssU0FBaUIsTUFBa0I7QUFDL0IsU0FBQSxJQUFJLEdBQWUsU0FBUyxJQUFJO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVF6QyxLQUFLLFNBQWlCLE9BQStCO0FBQzVDLFNBQUEsSUFBSSxHQUFlLFNBQVMsS0FBSztBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRMUMsTUFBTSxTQUFpQixPQUErQjtBQUM3QyxTQUFBLElBQUksR0FBZ0IsU0FBUyxLQUFLO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPM0MsY0FBd0I7QUFDaEIsUUFBQTtBQUVBLFlBQU0sV0FBVyxZQUFZO0FBRTdCLFVBQUksQ0FBQ0EsY0FBRyxXQUFXLFFBQVEsR0FBRztBQUMxQixlQUFPLENBQUM7QUFBQSxNQUFBO0FBR1osYUFBT0EsY0FBRyxZQUFZLFFBQVEsRUFDekIsT0FBTyxVQUFRLEtBQUssU0FBUyxNQUFNLENBQUMsRUFDcEMsSUFBSSxDQUFBLFNBQVFELGdCQUFLLEtBQUssVUFBVSxJQUFJLENBQUM7QUFBQSxhQUNyQyxPQUFPO0FBQ0osY0FBQSxNQUFNLDRCQUE0QixLQUFLO0FBQy9DLGFBQU8sQ0FBQztBQUFBLElBQUE7QUFBQSxFQUNaO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9KLHVCQUFzQztBQUM5QixRQUFBO0FBQ00sWUFBQSxXQUFXLEtBQUssWUFBWTtBQUM5QixVQUFBLFNBQVMsV0FBVyxHQUFHO0FBQ2hCLGVBQUE7QUFBQSxNQUFBO0FBSVgsYUFBTyxTQUFTLEtBQUssQ0FBQyxHQUFHLE1BQU07QUFDckIsY0FBQSxRQUFRQyxjQUFHLFNBQVMsQ0FBQztBQUNyQixjQUFBLFFBQVFBLGNBQUcsU0FBUyxDQUFDO0FBQ3BCLGVBQUEsTUFBTSxjQUFjLE1BQU07QUFBQSxNQUNwQyxDQUFBLEVBQUUsQ0FBQztBQUFBLGFBQ0MsT0FBTztBQUNKLGNBQUEsTUFBTSx1Q0FBdUMsS0FBSztBQUNuRCxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1g7QUFFUjtBQTlpQkksY0FIRSxTQUdhLFlBQTBCO0FBSDdDLElBQU0sU0FBTjtBQW9qQkEsTUFBTSxTQUFTLE9BQU8sWUFBWTtBQUdsQyxJQUFJLGNBQWM7QUFDZCxRQUFNLGNBQWMsT0FBTztBQUN2QixNQUFBLGVBQWUsWUFBWSxRQUFRO0FBQ25DLGdCQUFZLE9BQU8sZUFBZSxFQUM3QixLQUFLLENBQU0sT0FBQTtBQUNSLFVBQUksT0FBTyxNQUFNO0FBQ2IsZUFBTyxZQUFZLEVBQUU7QUFBQSxNQUFBO0FBQUEsSUFDekIsQ0FDSCxFQUNBLE1BQU0sQ0FBQSxRQUFPLFFBQVEsTUFBTSx1Q0FBdUMsR0FBRyxDQUFDO0FBQUEsRUFBQTtBQUVuRjtBQUtPLE1BQU1FLFlBQVUsQ0FBQyxTQUFpQixTQUFxQixPQUFPLEtBQUssU0FBUyxJQUFJO0FBRWhGLE1BQU1ELGFBQVcsQ0FBQyxTQUFpQixVQUFrQyxPQUFPLE1BQU0sU0FBUyxLQUFLO0FDcG1CaEcsU0FBUyxpQkFBeUI7QUFDckMsUUFBTSxVQUFVO0FBR2hCLFVBQVEsUUFBUSxVQUFVO0FBQUEsSUFDdEIsS0FBSztBQUNELGFBQU9GLGdCQUFLLEtBQUssUUFBWSxJQUFBLFdBQVcsSUFBSSxPQUFPO0FBQUEsSUFDdkQsS0FBSztBQUNELGFBQU9BLGdCQUFLLEtBQUtPLGNBQUcsV0FBVyxXQUFXLHVCQUF1QixPQUFPO0FBQUEsSUFDNUUsS0FBSztBQUNELGFBQU9QLGdCQUFLLEtBQUtPLGNBQUcsUUFBUSxHQUFHLFdBQVcsT0FBTztBQUFBLElBQ3JEO0FBQ0ksYUFBT1AsZ0JBQUssS0FBS08sY0FBRyxRQUFXLEdBQUEsSUFBSSxPQUFPLEVBQUU7QUFBQSxFQUFBO0FBRXhEO0FBS08sU0FBUyxVQUFVLFNBQXVCO0FBQzdDLE1BQUksQ0FBQ04sY0FBRyxXQUFXLE9BQU8sR0FBRztBQUN6QkEsa0JBQUcsVUFBVSxTQUFTLEVBQUUsV0FBVyxNQUFNO0FBQUEsRUFBQTtBQUVqRDtBQU1PLFNBQVMsWUFBWSxtQkFBb0M7QUFFNUQsUUFBTSxXQUFXLHFCQUFxQixlQUFlLEtBQUssZUFBZTtBQUN6RSxRQUFNLFdBQVdELGdCQUFLLEtBQUssVUFBVSxNQUFNO0FBQzNDLFlBQVUsUUFBUTtBQUNYLFNBQUE7QUFDWDtBQUtPLFNBQVMsaUJBQWdDO0FBQ3hDLE1BQUE7QUFDQSxVQUFNLGtCQUFrQkEsZ0JBQUssS0FBSyxlQUFBLEdBQWtCLGNBQWM7QUFDbEUsUUFBSSxDQUFDQyxjQUFHLFdBQVcsZUFBZSxHQUFHO0FBQzFCLGFBQUE7QUFBQSxJQUFBO0FBR1gsVUFBTSxPQUFPLEtBQUssTUFBTUEsY0FBRyxhQUFhLGlCQUFpQixPQUFPLENBQUM7QUFDakUsV0FBTyxLQUFLLFdBQVc7QUFBQSxXQUNsQixPQUFPO0FBQ1pDLGVBQVMsc0NBQXNDLEtBQUs7QUFDN0MsV0FBQTtBQUFBLEVBQUE7QUFFZjtBQ3JEQSxNQUFNTSxjQUFZQyxlQUFVQyxrQkFBSTtBQUtoQyxNQUFNLGVBQWU7QUFBQSxFQUNuQixRQUFRO0FBQUEsSUFDTjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQVYsZ0JBQUssS0FBS08sY0FBRyxXQUFXLG9CQUFvQjtBQUFBLEVBQzlDO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBUCxnQkFBSyxLQUFLTyxjQUFHLFdBQVcsNERBQTREO0FBQUEsRUFBQTtBQUV4RjtBQUtBLE1BQU0sa0JBQWtCO0FBQUEsRUFBeEI7QUFDVSxzQ0FBNEI7QUFDNUIsNkNBQW1DO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUszQyxNQUFNLGlCQUF5QztBQUM3QyxRQUFJLEtBQUssWUFBWTtBQUNuQixhQUFPLEtBQUs7QUFBQSxJQUFBO0FBR2RKLGNBQVEsb0NBQW9DO0FBR3hDLFFBQUE7QUFDRixZQUFNSyxZQUFVLGtCQUFrQjtBQUNsQyxXQUFLLGFBQWE7QUFDbEJMLGdCQUFRLGlDQUFpQztBQUN6QyxhQUFPLEtBQUs7QUFBQSxhQUNMLE9BQU87QUFDZEEsZ0JBQVEsa0VBQWtFO0FBQUEsSUFBQTtBQUk1RSxVQUFNLFdBQVcsUUFBUTtBQUN6QixVQUFNLGdCQUFnQixhQUFhLFFBQVEsS0FBSyxDQUFDO0FBRWpELGVBQVcsY0FBYyxlQUFlO0FBQ2xDLFVBQUE7QUFDRSxZQUFBRixjQUFHLFdBQVcsVUFBVSxHQUFHO0FBQ3JCRSxvQkFBQSwrQkFBK0IsVUFBVSxFQUFFO0FBQ25ELGVBQUssYUFBYTtBQUNYLGlCQUFBO0FBQUEsUUFBQTtBQUFBLGVBRUYsT0FBTztBQUFBLE1BQUE7QUFBQSxJQUVoQjtBQUlGRCxlQUFTLG9EQUFvRDtBQUN0RCxXQUFBO0FBQUEsRUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTVQsTUFBTSxxQkFBcUIsU0FBOEQ7QUFDakYsVUFBQSxhQUFhLE1BQU0sS0FBSyxlQUFlO0FBRTdDLFFBQUksQ0FBQyxZQUFZO0FBQ1QsWUFBQSxJQUFJLE1BQU0sa0ZBQWtGO0FBQUEsSUFBQTtBQUdwRyxVQUFNLGNBQWMsZUFBZSxXQUMvQixHQUFHLE9BQU8sS0FDVixJQUFJLFVBQVUsS0FBSyxRQUFRLFFBQVEsY0FBYyxFQUFFLENBQUM7QUFFaERDLGNBQUEsNkJBQTZCLFdBQVcsRUFBRTtBQUMzQyxXQUFBLE1BQU1LLFlBQVUsV0FBVztBQUFBLEVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1wQyxNQUFNLGtCQUFvQztBQUNwQyxRQUFBO0FBQ0ksWUFBQSxLQUFLLHFCQUFxQixhQUFhO0FBQ3RDLGFBQUE7QUFBQSxhQUNBLE9BQU87QUFDUCxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1GLGtCQUEwQjtBQUN4QixVQUFNLFdBQVcsUUFBUTtBQUNuQixVQUFBLGNBQWMsWUFBWSxRQUFRO0FBQ3hDLFFBQUksa0JBQTRCLENBQUM7QUFFakMsWUFBUSxVQUFVO0FBQUEsTUFDaEIsS0FBSztBQUNlLDBCQUFBO0FBQUEsVUFDaEI7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0FSLGdCQUFLLEtBQUtPLGNBQUcsV0FBVyxhQUFhO0FBQUEsUUFDdkM7QUFDQTtBQUFBLE1BQ0YsS0FBSztBQUNlLDBCQUFBO0FBQUEsVUFDaEI7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUNBO0FBQUEsTUFDRixLQUFLO0FBQ2UsMEJBQUE7QUFBQSxVQUNoQjtBQUFBLFVBQ0FQLGdCQUFLLEtBQUtPLGNBQUcsV0FBVyxnREFBZ0Q7QUFBQSxRQUMxRTtBQUNBO0FBQUEsSUFBQTtBQUlFLFVBQUEsZ0JBQWdCLGdCQUFnQixPQUFPLENBQUssTUFBQTtBQUM1QyxVQUFBO0FBQ0ssZUFBQU4sY0FBRyxXQUFXLENBQUM7QUFBQSxlQUNmLE9BQU87QUFDUCxlQUFBO0FBQUEsTUFBQTtBQUFBLElBQ1QsQ0FDRDtBQUdLLFVBQUEsZ0JBQWdCLGFBQWEsVUFBVSxNQUFNO0FBQ25ELFdBQU8sQ0FBQyxHQUFHLGVBQWUsV0FBVyxFQUFFLEtBQUssYUFBYTtBQUFBLEVBQUE7QUFFN0Q7QUFFQSxNQUFlLG9CQUFBLElBQUksa0JBQWtCO0FDakpyQyxNQUFNLFlBQVlRLGVBQVVDLGtCQUFJO0FBS2hDLE1BQU0scUJBQXFCO0FBQUEsRUFHdkIsY0FBYztBQUZOO0FBR0osU0FBSyxlQUFlVixnQkFBSyxLQUFLLGVBQUEsR0FBa0IsVUFBVTtBQUcxRCxRQUFJLENBQUNDLGNBQUcsV0FBVyxLQUFLLFlBQVksR0FBRztBQUMvQixVQUFBO0FBQ0FBLHNCQUFHLFVBQVUsS0FBSyxjQUFjLEVBQUUsV0FBVyxNQUFNO0FBQzNDRSxrQkFBQSwrQkFBK0IsS0FBSyxZQUFZLEVBQUU7QUFBQSxlQUNyRCxLQUFLO0FBQ0RELG1CQUFBLHVDQUF1QyxlQUFlLFFBQVEsTUFBTSxJQUFJLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUN2RztBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1KLE1BQU0seUJBQXdDO0FBQ3RDLFFBQUE7QUFDTSxZQUFBLGNBQWMsTUFBTSxnQkFBZ0IsZUFBZTtBQUN6RCxVQUFJLGFBQWE7QUFDYixhQUFLLGVBQWU7QUFHcEIsY0FBTSxXQUFXRixnQkFBSyxLQUFLLEtBQUssY0FBYyxNQUFNO0FBQ3BELGNBQU0sZUFBZUEsZ0JBQUssS0FBSyxLQUFLLGNBQWMsVUFBVTtBQUc1RCxZQUFJLENBQUNDLGNBQUcsV0FBVyxRQUFRLEdBQUc7QUFDMUJBLHdCQUFHLFVBQVUsVUFBVSxFQUFFLFdBQVcsTUFBTTtBQUFBLFFBQUE7QUFFOUMsWUFBSSxDQUFDQSxjQUFHLFdBQVcsWUFBWSxHQUFHO0FBQzlCQSx3QkFBRyxVQUFVLGNBQWMsRUFBRSxXQUFXLE1BQU07QUFBQSxRQUFBO0FBRzFDRSxrQkFBQSwwQkFBMEIsS0FBSyxZQUFZLEVBQUU7QUFBQSxNQUFBLE9BQ2xEO0FBQ0tBLGtCQUFBLHlDQUF5QyxLQUFLLFlBQVksRUFBRTtBQUFBLE1BQUE7QUFBQSxhQUVuRSxPQUFPO0FBQ0hELGlCQUFBLG9DQUFvQyxpQkFBaUIsUUFBUSxRQUFRLElBQUksTUFBTSxPQUFPLEtBQUssQ0FBQyxDQUFDO0FBQUEsSUFBQTtBQUFBLEVBQzFHO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNSixNQUFNLGNBQWdDO0FBQzlCLFFBQUE7QUFDQUMsZ0JBQVEsK0JBQStCO0FBRzNCLGNBQUEsSUFBQSxPQUFPLGtCQUFrQixnQkFBZ0I7QUFDN0NBLGdCQUFBLGtCQUFrQixRQUFZLElBQUEsSUFBSSxFQUFFO0FBR3RDLFlBQUEsYUFBYSxNQUFNLGtCQUFrQixlQUFlO0FBQzFELFVBQUksQ0FBQyxZQUFZO0FBQ2JELG1CQUFTLGlEQUFpRDtBQUNuRCxlQUFBO0FBQUEsTUFBQTtBQUlMLFlBQUEsa0JBQWtCLHFCQUFxQixhQUFhO0FBQzFEQyxnQkFBUSwwQkFBMEI7QUFDM0IsYUFBQTtBQUFBLGFBQ0YsS0FBSztBQUNERCxpQkFBQSxpREFBaUQsZUFBZSxRQUFRLE1BQU0sSUFBSSxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDdEcsYUFBQTtBQUFBLElBQUE7QUFBQSxFQUNYO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNSixNQUFNLG9CQUFvQixjQUFzQixnQkFBa0M7QUFDMUUsUUFBQTtBQUNRQyxnQkFBQSwrQkFBK0IsV0FBVyxFQUFFO0FBQ3BELFlBQU0sRUFBRSxPQUFPLElBQUksTUFBTSxrQkFBa0IscUJBQXFCLHdDQUF3QztBQUV4RyxVQUFJLENBQUMsT0FBTyxTQUFTLFdBQVcsR0FBRztBQUN2QkEsa0JBQUEscUJBQXFCLFdBQVcsRUFBRTtBQUMxQyxjQUFNLGtCQUFrQixxQkFBcUIseUJBQXlCLFdBQVcsRUFBRTtBQUMzRUEsa0JBQUEsaUNBQWlDLFdBQVcsRUFBRTtBQUFBLE1BQUEsT0FDbkQ7QUFDS0Esa0JBQUEsV0FBVyxXQUFXLGlCQUFpQjtBQUFBLE1BQUE7QUFFNUMsYUFBQTtBQUFBLGFBQ0YsS0FBSztBQUNERCxpQkFBQSwwQkFBMEIsV0FBVyxXQUFXLGVBQWUsUUFBUSxNQUFNLElBQUksTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ3JHLGFBQUE7QUFBQSxJQUFBO0FBQUEsRUFDWDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUosTUFBYyxzQkFBc0IsTUFBK0I7QUFDM0QsUUFBQTtBQUNRQyxnQkFBQSxnQkFBZ0IsSUFBSSxlQUFlO0FBQ3JDLFlBQUEsTUFBTSxRQUFRLEtBQUs7QUFDbkIsWUFBQSxTQUFTLElBQUksYUFBYTtBQUVoQyxZQUFNLElBQUksUUFBYyxDQUFDLFNBQVMsV0FBVztBQUNsQyxlQUFBLEtBQUssU0FBUyxDQUFDLFFBQWE7QUFDM0IsY0FBQSxJQUFJLFNBQVMsY0FBYztBQUNuQkEsc0JBQUEsUUFBUSxJQUFJLFlBQVk7QUFDaEMsbUJBQU8sSUFBSSxNQUFNLFFBQVEsSUFBSSxvQkFBb0IsQ0FBQztBQUFBLFVBQUEsT0FDL0M7QUFDSCxtQkFBTyxHQUFHO0FBQUEsVUFBQTtBQUFBLFFBQ2QsQ0FDSDtBQUVNLGVBQUEsS0FBSyxhQUFhLE1BQU07QUFDbkJBLG9CQUFBLFFBQVEsSUFBSSxlQUFlO0FBQzVCLGlCQUFBLE1BQU0sTUFBTSxTQUFTO0FBQUEsUUFBQSxDQUMvQjtBQUVNLGVBQUEsT0FBTyxNQUFNLFNBQVM7QUFBQSxNQUFBLENBQ2hDO0FBRU0sYUFBQTtBQUFBLGFBQ0YsS0FBSztBQUNGQSxnQkFBQSwrQkFBK0IsSUFBSSxFQUFFO0FBQzdDLFVBQUksVUFBVTtBQUdkLGVBQVMsV0FBVyxPQUFPLEdBQUcsV0FBVyxPQUFPLElBQUksWUFBWTtBQUN4RCxZQUFBO0FBQ00sZ0JBQUEsTUFBTSxRQUFRLEtBQUs7QUFDbkIsZ0JBQUEsU0FBUyxJQUFJLGFBQWE7QUFFaEMsZ0JBQU0sY0FBYyxNQUFNLElBQUksUUFBaUIsQ0FBQyxZQUFZO0FBQ3hELG1CQUFPLEtBQUssU0FBUyxNQUFNLFFBQVEsS0FBSyxDQUFDO0FBQ2xDLG1CQUFBLEtBQUssYUFBYSxNQUFNO0FBQzNCLHFCQUFPLE1BQU0sTUFBTSxRQUFRLElBQUksQ0FBQztBQUFBLFlBQUEsQ0FDbkM7QUFDTSxtQkFBQSxPQUFPLFVBQVUsU0FBUztBQUFBLFVBQUEsQ0FDcEM7QUFFRCxjQUFJLGFBQWE7QUFDSCxzQkFBQTtBQUNGQSxzQkFBQSx5QkFBeUIsT0FBTyxFQUFFO0FBQzFDO0FBQUEsVUFBQTtBQUFBLGlCQUVDLEdBQUc7QUFFQUEsb0JBQUEsUUFBUSxRQUFRLGNBQWM7QUFBQSxRQUFBO0FBQUEsTUFDMUM7QUFHSixVQUFJLFNBQVM7QUFDRixlQUFBO0FBQUEsTUFBQTtBQUdYLFlBQU0sSUFBSSxNQUFNLFFBQVEsSUFBSSxxRkFBcUY7QUFBQSxJQUFBO0FBQUEsRUFDckg7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1KLE1BQU0sb0JBQXFDO0FBQ25DLFFBQUE7QUFDTSxZQUFBLGtCQUFrQixxQkFBcUIsd0JBQXdCO0FBQzlELGFBQUE7QUFBQSxhQUNGLE9BQU87QUFDUixVQUFBO0FBRUEsY0FBTSxVQUFVLDBCQUEwQjtBQUNuQyxlQUFBO0FBQUEsZUFDRixjQUFjO0FBQ2IsY0FBQSxJQUFJLE1BQU0saUNBQWlDO0FBQUEsTUFBQTtBQUFBLElBQ3JEO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUosTUFBTSx1QkFDRixjQUNBLFNBQ0EsT0FBZSxNQUNmLFdBQW1CLFlBQ25CLFdBQW1CLFlBQzBDO0FBQ3pELFFBQUE7QUFDQUEsZ0JBQVEsMENBQTBDLFlBQVksY0FBYyxPQUFPLFdBQVcsSUFBSSxFQUFFO0FBR3BHLFlBQU0sS0FBSyx1QkFBdUI7QUFHbEMsWUFBTSxhQUFhSCxnQkFBSyxLQUFLLEtBQUssY0FBYyxZQUFZLFlBQVk7QUFDaEVHLGdCQUFBLDJCQUEyQixVQUFVLEVBQUU7QUFHL0MsVUFBSSxDQUFDLE1BQU0sS0FBSyxlQUFlO0FBQzNCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyw0REFBNEQ7QUFBQSxNQUFBO0FBSTVGLFlBQUEsV0FBVyxNQUFNLGdCQUFnQixhQUFhO0FBQzlDLFlBQUEsZUFBYyxxQ0FBVSxZQUFXO0FBQ3pDLFVBQUksQ0FBQyxNQUFNLEtBQUssb0JBQW9CLFdBQVcsR0FBRztBQUM5QyxlQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsc0NBQXNDLFdBQVcsR0FBRztBQUFBLE1BQUE7QUFJdEYsVUFBQTtBQUNPLGVBQUEsTUFBTSxLQUFLLHNCQUFzQixJQUFJO0FBQUEsZUFDdkMsT0FBTztBQUNMLGVBQUE7QUFBQSxVQUNILFNBQVM7QUFBQSxVQUNULFNBQVMsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSztBQUFBLFFBQ2xFO0FBQUEsTUFBQTtBQUlBLFVBQUFGLGNBQUcsV0FBVyxVQUFVLEdBQUc7QUFDbkJFLGtCQUFBLHNDQUFzQyxVQUFVLEVBQUU7QUFDMUQsZUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLFlBQVksWUFBWSxrQkFBa0I7QUFBQSxNQUFBO0FBR3hFQSxnQkFBQSwrQkFBK0IsVUFBVSxFQUFFO0FBQ25ERixvQkFBRyxVQUFVLFlBQVksRUFBRSxXQUFXLE1BQU07QUFHcENFLGdCQUFBLDRDQUE0QyxJQUFJLEVBQUU7QUFFMUQsWUFBTSxpQkFBaUI7QUFBQTtBQUFBO0FBQUEsc0JBR2IsT0FBTztBQUFBLHNCQUNQLFlBQVk7QUFBQTtBQUFBLDRCQUVOLFFBQVE7QUFBQSx3QkFDWixRQUFRO0FBQUE7QUFBQTtBQUFBLFdBR3JCLElBQUk7QUFBQTtBQUFBLFVBRUwsWUFBWTtBQUFBO0FBQUE7QUFBQSxVQUdaLFdBQVc7QUFBQTtBQUFBO0FBQUEsSUFHakIsV0FBVztBQUFBO0FBQUE7QUFBQTtBQUFBLElBSVgsWUFBWTtBQUFBO0FBQUE7QUFJSixZQUFNLGtCQUFrQkgsZ0JBQUssS0FBSyxZQUFZLG9CQUFvQjtBQUMxREcsZ0JBQUEsa0NBQWtDLGVBQWUsRUFBRTtBQUN4REYsb0JBQUEsY0FBYyxpQkFBaUIsZ0JBQWdCLE1BQU07QUFHeEQsVUFBSSxDQUFDQSxjQUFHLFdBQVcsZUFBZSxHQUFHO0FBQ3hCQyxtQkFBQSw2QkFBNkIsZUFBZSxFQUFFO0FBQ3ZELGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyx1Q0FBdUM7QUFBQSxNQUFBO0FBSTdFLFlBQU0sV0FBV0YsZ0JBQUssS0FBSyxZQUFZLG9CQUFvQjtBQUNuREcsZ0JBQUEsZ0NBQWdDLFFBQVEsRUFBRTtBQUVsRCxZQUFNLE9BQU87QUFBQSxRQUNULE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsTUFDdEM7QUFFR0Ysb0JBQUEsY0FBYyxVQUFVLEtBQUssVUFBVSxNQUFNLE1BQU0sQ0FBQyxHQUFHLE1BQU07QUFHaEVFLGdCQUFRLCtCQUErQjtBQUNqQyxZQUFBLGlCQUFpQixNQUFNLEtBQUssa0JBQWtCO0FBRWhELFVBQUE7QUFDQUEsa0JBQVEsa0JBQWtCLFVBQVUsUUFBUSxjQUFjLFFBQVE7QUFDNUQsY0FBQSxFQUFFLFFBQVEsT0FBVyxJQUFBLE1BQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLFFBQVE7QUFFMUYsWUFBSSxPQUFRQSxXQUFRLDBCQUEwQixNQUFNLEVBQUU7QUFDdEQsWUFBSSxPQUFRQSxXQUFRLDBCQUEwQixNQUFNLEVBQUU7QUFBQSxlQUNqRCxPQUFPO0FBQ1pELG1CQUFTLDRCQUE0QixLQUFLO0FBR3RDLFlBQUE7QUFDTSxnQkFBQSxFQUFFLFFBQVEsS0FBUyxJQUFBLE1BQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLE9BQU87QUFDL0VDLG9CQUFBLG1CQUFtQixJQUFJLEVBQUU7QUFBQSxpQkFDNUJRLFFBQU87QUFDWlQscUJBQVMsK0JBQStCUyxNQUFLO0FBQUEsUUFBQTtBQUcxQyxlQUFBO0FBQUEsVUFDSCxTQUFTO0FBQUEsVUFDVCxTQUFTLDZCQUE2QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxRQUNoRztBQUFBLE1BQUE7QUFJQSxVQUFBO0FBQ0FSLGtCQUFRLGdDQUFnQztBQUNsQyxjQUFBLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSxVQUFVLDRCQUE0QixZQUFZLDBCQUEwQjtBQUU5R0Esa0JBQUEscUJBQXFCLGVBQWUsRUFBRTtBQUU5QyxZQUFJLENBQUMsZ0JBQWdCLFNBQVMsSUFBSSxHQUFHO0FBQ2pDQSxvQkFBUSx3Q0FBd0M7QUFHNUMsY0FBQTtBQUNNLGtCQUFBLEVBQUUsUUFBUSxrQkFBa0IsTUFBTSxVQUFVLGVBQWUsWUFBWSxZQUFZO0FBQ2pGQSxzQkFBQSxtQkFBbUIsYUFBYSxFQUFFO0FBQUEsbUJBQ3JDLE9BQU87QUFDWkQsdUJBQVMsK0JBQStCLEtBQUs7QUFBQSxVQUFBO0FBRzFDLGlCQUFBO0FBQUEsWUFDSCxTQUFTO0FBQUE7QUFBQSxZQUNULFNBQVM7QUFBQSxZQUNUO0FBQUEsVUFDSjtBQUFBLFFBQUE7QUFBQSxlQUVDLE9BQU87QUFDWkEsbUJBQVMsbUNBQW1DLEtBQUs7QUFBQSxNQUFBO0FBRzdDQyxnQkFBQSw2Q0FBNkMsWUFBWSxFQUFFO0FBQzVELGFBQUE7QUFBQSxRQUNILFNBQVM7QUFBQSxRQUNULFNBQVMsdUJBQXVCLFlBQVksaUNBQWlDLElBQUk7QUFBQSxRQUNqRjtBQUFBLE1BQ0o7QUFBQSxhQUNLLE9BQU87QUFDSEQsaUJBQUEsc0NBQXNDLFlBQVksSUFBSSxLQUFLO0FBQzdELGFBQUE7QUFBQSxRQUNILFNBQVM7QUFBQSxRQUNULFNBQVMsNEJBQTRCLGlCQUFpQixRQUFRLE1BQU0sVUFBVSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQy9GO0FBQUEsSUFBQTtBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1KLE1BQU0sY0FBYyxjQUFzRTtBQUNsRixRQUFBO0FBQ0EsWUFBTSxLQUFLLHVCQUF1QjtBQUc5QixVQUFBO0FBQ0EsVUFBQSxhQUFhLFNBQVMsV0FBVyxHQUFHO0FBQ3BDLHFCQUFhRixnQkFBSyxLQUFLLEtBQUssY0FBYyxZQUFZLFlBQVk7QUFBQSxNQUFBLE9BQy9EO0FBQ0gscUJBQWFBLGdCQUFLLEtBQUssS0FBSyxjQUFjLFFBQVEsWUFBWTtBQUFBLE1BQUE7QUFHbEUsVUFBSSxDQUFDQyxjQUFHLFdBQVcsVUFBVSxHQUFHO0FBQzVCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyxZQUFZLFlBQVksa0JBQWtCO0FBQUEsTUFBQTtBQUdoRixZQUFNLGNBQWNELGdCQUFLLEtBQUssWUFBWSxvQkFBb0I7QUFDOUQsVUFBSSxDQUFDQyxjQUFHLFdBQVcsV0FBVyxHQUFHO0FBQzdCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyxvQkFBb0IsWUFBWSxhQUFhO0FBQUEsTUFBQTtBQUc3RSxZQUFBLGlCQUFpQixNQUFNLEtBQUssa0JBQWtCO0FBQzVDRSxnQkFBQSxzQkFBc0IsWUFBWSxFQUFFO0FBQzVDLFlBQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLFFBQVE7QUFFL0QsYUFBTyxFQUFFLFNBQVMsTUFBTSxTQUFTLFlBQVksWUFBWSx3QkFBd0I7QUFBQSxhQUM1RSxPQUFPO0FBQ0hELGlCQUFBLDRCQUE0QixZQUFZLElBQUksS0FBSztBQUNuRCxhQUFBO0FBQUEsUUFDSCxTQUFTO0FBQUEsUUFDVCxTQUFTLDRCQUE0QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUMvRjtBQUFBLElBQUE7QUFBQSxFQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNSixNQUFNLGFBQWEsY0FBc0U7QUFDakYsUUFBQTtBQUNBLFlBQU0sS0FBSyx1QkFBdUI7QUFHbEMsWUFBTSxlQUFlLGFBQWEsU0FBUyxVQUFVLElBQUksYUFBYTtBQUN0RSxZQUFNLGFBQWFGLGdCQUFLLEtBQUssS0FBSyxjQUFjLGNBQWMsWUFBWTtBQUVsRUcsZ0JBQUEsc0JBQXNCLFlBQVksRUFBRTtBQUU1QyxVQUFJLENBQUNGLGNBQUcsV0FBVyxVQUFVLEdBQUc7QUFDNUIsZUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLFlBQVksWUFBWSxrQkFBa0I7QUFBQSxNQUFBO0FBR2hGLFlBQU0sY0FBY0QsZ0JBQUssS0FBSyxZQUFZLG9CQUFvQjtBQUM5RCxVQUFJLENBQUNDLGNBQUcsV0FBVyxXQUFXLEdBQUc7QUFDN0IsZUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLG9CQUFvQixZQUFZLGFBQWE7QUFBQSxNQUFBO0FBSW5GLFVBQUksaUJBQWlCLFlBQVk7QUFDckJFLGtCQUFBLHFFQUFxRSxZQUFZLEVBQUU7QUFHckYsY0FBQSxZQUFZLE1BQU0sS0FBSyxjQUFjO0FBRzNDLGNBQU0scUJBQXFCLFVBQVU7QUFBQSxVQUFPLGNBQ3hDLFNBQVMsUUFDVCxTQUFTLEtBQUssU0FBUyxVQUN2QixTQUFTLEtBQUsscUJBQXFCLGdCQUNuQyxTQUFTLE9BQU8sWUFBWSxFQUFFLFNBQVMsSUFBSTtBQUFBLFFBQy9DO0FBRUksWUFBQSxtQkFBbUIsU0FBUyxHQUFHO0FBQ3pCLGdCQUFBLGlCQUFpQixtQkFBbUIsSUFBSSxDQUFBLGFBQVksU0FBUyxJQUFJLEVBQUUsS0FBSyxJQUFJO0FBQzFFQSxvQkFBQSwyQ0FBMkMsY0FBYyxFQUFFO0FBQzVELGlCQUFBO0FBQUEsWUFDSCxTQUFTO0FBQUEsWUFDVCxTQUFTLG9DQUFvQyxZQUFZLDhEQUE4RCxjQUFjO0FBQUEsVUFDekk7QUFBQSxRQUFBO0FBR0pBLGtCQUFRLGlFQUFpRTtBQUFBLE1BQUE7QUFHdkUsWUFBQSxpQkFBaUIsTUFBTSxLQUFLLGtCQUFrQjtBQUM1Q0EsZ0JBQUEsMkJBQTJCLGNBQWMsT0FBTztBQUN4RCxZQUFNLFVBQVUsT0FBTyxVQUFVLFFBQVEsY0FBYyxPQUFPO0FBRTlELGFBQU8sRUFBRSxTQUFTLE1BQU0sU0FBUyxZQUFZLFlBQVksd0JBQXdCO0FBQUEsYUFDNUUsT0FBTztBQUNIRCxpQkFBQSw0QkFBNEIsWUFBWSxJQUFJLEtBQUs7QUFDbkQsYUFBQTtBQUFBLFFBQ0gsU0FBUztBQUFBLFFBQ1QsU0FBUyw0QkFBNEIsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSyxDQUFDO0FBQUEsTUFDL0Y7QUFBQSxJQUFBO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUosTUFBTSxlQUFlLGNBQXNCLFlBQXFCLE9BQXVEO0FBQy9HLFFBQUE7QUFDQSxZQUFNLEtBQUssdUJBQXVCO0FBR2xDLFlBQU0sZUFBZSxhQUFhLFNBQVMsVUFBVSxJQUFJLGFBQWE7QUFDdEUsWUFBTSxhQUFhRixnQkFBSyxLQUFLLEtBQUssY0FBYyxjQUFjLFlBQVk7QUFFbEVHLGdCQUFBLHNCQUFzQixZQUFZLEVBQUU7QUFFNUMsVUFBSSxDQUFDRixjQUFHLFdBQVcsVUFBVSxHQUFHO0FBQzVCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyxZQUFZLFlBQVksa0JBQWtCO0FBQUEsTUFBQTtBQUloRixVQUFJLGlCQUFpQixZQUFZO0FBQ3JCRSxrQkFBQSxxRUFBcUUsWUFBWSxFQUFFO0FBR3JGLGNBQUEsWUFBWSxNQUFNLEtBQUssY0FBYztBQUczQyxjQUFNLHFCQUFxQixVQUFVO0FBQUEsVUFBTyxDQUFBLGFBQ3hDLFNBQVMsUUFDVCxTQUFTLEtBQUssU0FBUyxVQUN2QixTQUFTLEtBQUsscUJBQXFCO0FBQUEsUUFDdkM7QUFFSSxZQUFBLG1CQUFtQixTQUFTLEdBQUc7QUFDekIsZ0JBQUEsaUJBQWlCLG1CQUFtQixJQUFJLENBQUEsYUFBWSxTQUFTLElBQUksRUFBRSxLQUFLLElBQUk7QUFDMUVBLG9CQUFBLG1DQUFtQyxjQUFjLEVBQUU7QUFDcEQsaUJBQUE7QUFBQSxZQUNILFNBQVM7QUFBQSxZQUNULFNBQVMsc0NBQXNDLFlBQVksc0RBQXNELGNBQWM7QUFBQSxVQUNuSTtBQUFBLFFBQUE7QUFHSkEsa0JBQVEsMkRBQTJEO0FBQUEsTUFBQTtBQUdqRSxZQUFBLGlCQUFpQixNQUFNLEtBQUssa0JBQWtCO0FBRzVDQSxnQkFBQSw0QkFBNEIsY0FBYyxPQUFPO0FBQ3pELFlBQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLFVBQVU7QUFHakUsVUFBSSxDQUFDLFdBQVc7QUFDSkEsa0JBQUEsdUJBQXVCLFVBQVUsRUFBRTtBQUMzQ0Ysc0JBQUcsT0FBTyxZQUFZLEVBQUUsV0FBVyxNQUFNLE9BQU8sTUFBTTtBQUFBLE1BQUEsT0FDbkQ7QUFDS0Usa0JBQUEscUJBQXFCLFVBQVUsRUFBRTtBQUFBLE1BQUE7QUFHN0MsYUFBTyxFQUFFLFNBQVMsTUFBTSxTQUFTLFlBQVksWUFBWSx3QkFBd0I7QUFBQSxhQUM1RSxPQUFPO0FBQ0hELGlCQUFBLDRCQUE0QixZQUFZLElBQUksS0FBSztBQUNuRCxhQUFBO0FBQUEsUUFDSCxTQUFTO0FBQUEsUUFDVCxTQUFTLDRCQUE0QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUMvRjtBQUFBLElBQUE7QUFBQSxFQUNKO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNSixNQUFNLFFBQVEsY0FBc0IsVUFBa0IsUUFBUSxPQUFlLEtBQXFFO0FBQzFJLFFBQUE7QUFDQSxZQUFNLEtBQUssdUJBQXVCO0FBR2xDLFlBQU0sZUFBZSxhQUFhLFNBQVMsVUFBVSxJQUFJLGFBQWE7QUFDdEUsWUFBTSxhQUFhRixnQkFBSyxLQUFLLEtBQUssY0FBYyxjQUFjLFlBQVk7QUFFbEVHLGdCQUFBLDhCQUE4QixZQUFZLEVBQUU7QUFFcEQsVUFBSSxDQUFDRixjQUFHLFdBQVcsVUFBVSxHQUFHO0FBQzVCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyxZQUFZLFlBQVksa0JBQWtCO0FBQUEsTUFBQTtBQUloRixVQUFJLFlBQVksUUFBUTtBQUNWLGtCQUFBLGlCQUFpQixhQUFhLGFBQWE7QUFBQSxNQUFBO0FBR2pERSxnQkFBQSxrQkFBa0IsT0FBTyxXQUFXO0FBRXRDLFlBQUEsaUJBQWlCLE1BQU0sS0FBSyxrQkFBa0I7QUFDcEQsWUFBTSxFQUFFLE9BQVcsSUFBQSxNQUFNLFVBQVUsT0FBTyxVQUFVLFFBQVEsY0FBYyxnQkFBZ0IsSUFBSSxJQUFJLE9BQU8sRUFBRTtBQUMzRyxhQUFPLEVBQUUsU0FBUyxNQUFNLE1BQU0sT0FBTztBQUFBLGFBQ2hDLE9BQU87QUFDSEQsaUJBQUEsMEJBQTBCLFlBQVksSUFBSSxLQUFLO0FBQ2pELGFBQUE7QUFBQSxRQUNILFNBQVM7QUFBQSxRQUNULFNBQVMsdUJBQXVCLGlCQUFpQixRQUFRLE1BQU0sVUFBVSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQzFGO0FBQUEsSUFBQTtBQUFBLEVBQ0o7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1KLE1BQU0sZ0JBQTZFO0FBQzNFLFFBQUE7QUFDQSxZQUFNLEtBQUssdUJBQXVCO0FBQ2xDQyxnQkFBUSwyREFBMkQ7QUFDbkUsWUFBTSxZQUFnRSxDQUFDO0FBR3ZFLFVBQUksQ0FBQ0YsY0FBRyxXQUFXLEtBQUssWUFBWSxHQUFHO0FBQ25DRSxrQkFBUSwrQkFBK0I7QUFDaEMsZUFBQTtBQUFBLE1BQUE7QUFJTCxZQUFBLGdCQUFnQixPQUFPLFNBQWlCLGlCQUF5QjtBQUNuRSxZQUFJLENBQUNGLGNBQUcsV0FBVyxPQUFPLEdBQUc7QUFDekJFLG9CQUFRLEdBQUcsWUFBWSw4QkFBOEIsT0FBTyxFQUFFO0FBQzlEO0FBQUEsUUFBQTtBQUdFLGNBQUEsT0FBT0YsY0FBRyxZQUFZLE9BQU87QUFDbkNFLGtCQUFRLFNBQVMsS0FBSyxNQUFNLG1CQUFtQixZQUFZLE9BQU87QUFFbEUsbUJBQVcsT0FBTyxNQUFNO0FBQ3BCLGdCQUFNLGNBQWNILGdCQUFLLEtBQUssU0FBUyxHQUFHO0FBQzFDLGdCQUFNLGNBQWNBLGdCQUFLLEtBQUssYUFBYSxvQkFBb0I7QUFDL0QsZ0JBQU0sV0FBV0EsZ0JBQUssS0FBSyxhQUFhLG9CQUFvQjtBQUV4RCxjQUFBQyxjQUFHLFdBQVcsV0FBVyxLQUFLQSxjQUFHLFVBQVUsV0FBVyxFQUFFLGVBQWU7QUFDdkUsZ0JBQUksU0FBUztBQUNiLGdCQUFJLE9BQStCLENBQUM7QUFFaEMsZ0JBQUE7QUFDQSxvQkFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNLFVBQVUsNEJBQTRCLEdBQUcsMEJBQTBCO0FBQzVGLHVCQUFTLE9BQU8sS0FBQSxJQUFTLE9BQU8sS0FBUyxJQUFBO0FBQUEscUJBQ3BDLE9BQU87QUFDSCx1QkFBQTtBQUFBLFlBQUE7QUFHVCxnQkFBQUEsY0FBRyxXQUFXLFFBQVEsR0FBRztBQUNyQixrQkFBQTtBQUNBLHVCQUFPLEtBQUssTUFBTUEsY0FBRyxhQUFhLFVBQVUsT0FBTyxDQUFDO0FBRWhELG9CQUFBLENBQUMsS0FBSyxNQUFNO0FBQ1AsdUJBQUEsT0FBTyxpQkFBaUIsU0FBUyxTQUFTO0FBQUEsZ0JBQUE7QUFBQSx1QkFFOUMsT0FBTztBQUNaLHVCQUFPLEVBQUUsTUFBTSxLQUFLLE9BQU8scUJBQXFCLE1BQU0sYUFBYTtBQUFBLGNBQUE7QUFBQSxZQUN2RSxPQUNHO0FBQ0gscUJBQU8sRUFBRSxNQUFNLEtBQUssTUFBTSxhQUFhO0FBQUEsWUFBQTtBQUczQyxzQkFBVSxLQUFLO0FBQUEsY0FDWCxNQUFNO0FBQUEsY0FDTjtBQUFBLGNBQ0E7QUFBQSxZQUFBLENBQ0g7QUFFREUsc0JBQVEsU0FBUyxZQUFZLGNBQWMsR0FBRyxhQUFhLE1BQU0sRUFBRTtBQUFBLFVBQUE7QUFBQSxRQUN2RTtBQUFBLE1BRVI7QUFHQSxZQUFNLGNBQWNILGdCQUFLLEtBQUssS0FBSyxjQUFjLE1BQU0sR0FBRyxNQUFNO0FBQ2hFLFlBQU0sY0FBY0EsZ0JBQUssS0FBSyxLQUFLLGNBQWMsVUFBVSxHQUFHLFVBQVU7QUFFakUsYUFBQTtBQUFBLGFBQ0YsT0FBTztBQUNaRSxpQkFBUywyQkFBMkIsS0FBSztBQUN6QyxhQUFPLENBQUM7QUFBQSxJQUFBO0FBQUEsRUFDWjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUosTUFBTSwwQkFDRixjQUNBLGFBQ0EsYUFDMkU7QUFDdkUsUUFBQTtBQUNBLFlBQU0sS0FBSyx1QkFBdUI7QUFHbEMsWUFBTSxhQUFhRixnQkFBSyxLQUFLLEtBQUssY0FBYyxZQUFZLFlBQVk7QUFDaEVHLGdCQUFBLGlEQUFpRCxZQUFZLEVBQUU7QUFFdkUsVUFBSSxDQUFDRixjQUFHLFdBQVcsVUFBVSxHQUFHO0FBQzVCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyxZQUFZLFlBQVksa0JBQWtCO0FBQUEsTUFBQTtBQUloRixZQUFNLGtCQUFrQkQsZ0JBQUssS0FBSyxZQUFZLG9CQUFvQjtBQUNsRSxVQUFJLENBQUNDLGNBQUcsV0FBVyxlQUFlLEdBQUc7QUFDakMsZUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLDJCQUEyQixZQUFZLGFBQWE7QUFBQSxNQUFBO0FBSTFGRSxnQkFBUSxxRUFBcUU7QUFDdkUsWUFBQSxZQUFZLE1BQU0sS0FBSyxjQUFjO0FBQzNDLFlBQU0scUJBQXFCLFVBQVU7QUFBQSxRQUFPLENBQUEsYUFDeEMsU0FBUyxRQUNULFNBQVMsS0FBSyxTQUFTLFVBQ3ZCLFNBQVMsS0FBSyxxQkFBcUI7QUFBQSxNQUN2QztBQUdBLFlBQU0saUJBQWlCLG1CQUFtQixJQUFJLENBQUEsYUFBWSxTQUFTLElBQUk7QUFDL0RBLGdCQUFBLFNBQVMsZUFBZSxNQUFNLDhCQUE4QixlQUFlLEtBQUssSUFBSSxLQUFLLE1BQU0sRUFBRTtBQUd6RyxZQUFNLFVBQVVGLGNBQUcsYUFBYSxpQkFBaUIsTUFBTTtBQUd2RCxZQUFNLGlCQUFpQixRQUNsQixRQUFRLCtCQUErQix1QkFBdUIsV0FBVyxFQUFFLEVBQzNFLFFBQVEsMkJBQTJCLG1CQUFtQixXQUFXLEVBQUU7QUFHckVBLG9CQUFBLGNBQWMsaUJBQWlCLGdCQUFnQixNQUFNO0FBR3hELFlBQU0sZUFBZUQsZ0JBQUssS0FBSyxZQUFZLG9CQUFvQjtBQUMzRCxVQUFBQyxjQUFHLFdBQVcsWUFBWSxHQUFHO0FBQzdCLGNBQU0sY0FBY0EsY0FBRyxhQUFhLGNBQWMsTUFBTTtBQUNsRCxjQUFBLE9BQU8sS0FBSyxNQUFNLFdBQVc7QUFHbkMsYUFBSyxXQUFXO0FBQ2hCLGFBQUssV0FBVztBQUNoQixhQUFLLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFFckNBLHNCQUFBLGNBQWMsY0FBYyxLQUFLLFVBQVUsTUFBTSxNQUFNLENBQUMsR0FBRyxNQUFNO0FBQUEsTUFBQTtBQUlsRSxZQUFBLGlCQUFpQixNQUFNLEtBQUssa0JBQWtCO0FBRzVDRSxnQkFBQSxtQ0FBbUMsWUFBWSxFQUFFO0FBQ3pELFlBQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLFlBQVksY0FBYyxRQUFRO0FBR3pGLFlBQU0sbUJBQW1CLENBQUM7QUFDMUIsWUFBTSxnQkFBZ0IsQ0FBQztBQUV2QixpQkFBVyxnQkFBZ0Isb0JBQW9CO0FBQ3ZDLFlBQUE7QUFDUUEsb0JBQUEsZ0RBQWdELGFBQWEsSUFBSSxFQUFFO0FBRzNFLGdCQUFNLFVBQVVILGdCQUFLLEtBQUssS0FBSyxjQUFjLFFBQVEsYUFBYSxJQUFJO0FBR3RFLGdCQUFNLFlBQVlBLGdCQUFLLEtBQUssU0FBUyxRQUFRO0FBQzdDLGdCQUFNLGVBQWVBLGdCQUFLLEtBQUssV0FBVyxXQUFXO0FBRWpELGNBQUFDLGNBQUcsV0FBVyxZQUFZLEdBQUc7QUFDN0IsZ0JBQUksa0JBQWtCQSxjQUFHLGFBQWEsY0FBYyxNQUFNO0FBR3hDLDhCQUFBLGdCQUNiLFFBQVEsaUJBQWlCLGFBQWEsV0FBVyxFQUFFLEVBQ25ELFFBQVEscUJBQXFCLGlCQUFpQixXQUFXLEVBQUU7QUFHN0RBLDBCQUFBLGNBQWMsY0FBYyxpQkFBaUIsTUFBTTtBQUM5Q0Usc0JBQUEseUJBQXlCLGFBQWEsSUFBSSxFQUFFO0FBR3BELGtCQUFNLGVBQWVILGdCQUFLLEtBQUssU0FBUyxvQkFBb0I7QUFDeEQsZ0JBQUFDLGNBQUcsV0FBVyxZQUFZLEdBQUc7QUFDN0Isb0JBQU0sV0FBVyxLQUFLLE1BQU1BLGNBQUcsYUFBYSxjQUFjLE1BQU0sQ0FBQztBQUdqRSxrQkFBSSxDQUFDLFNBQVMsY0FBZSxVQUFTLGdCQUFnQixDQUFDO0FBQ3ZELHVCQUFTLGNBQWMsV0FBVztBQUNsQyx1QkFBUyxjQUFjLFdBQVc7QUFDbEMsdUJBQVMsYUFBWSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUV6Q0EsNEJBQUEsY0FBYyxjQUFjLEtBQUssVUFBVSxVQUFVLE1BQU0sQ0FBQyxHQUFHLE1BQU07QUFDaEVFLHdCQUFBLGtDQUFrQyxhQUFhLElBQUksRUFBRTtBQUFBLFlBQUE7QUFJakUsZ0JBQUksYUFBYSxPQUFPLFlBQWMsRUFBQSxTQUFTLElBQUksR0FBRztBQUMxQ0Esd0JBQUEsdUNBQXVDLGFBQWEsSUFBSSxFQUFFO0FBQzlELGtCQUFBO0FBQ0Esc0JBQU0sVUFBVSxPQUFPLE9BQU8sUUFBUSxjQUFjLFlBQVksY0FBYyxRQUFRO0FBQzlFQSwwQkFBQSwwQkFBMEIsYUFBYSxJQUFJLEVBQUU7QUFBQSx1QkFDaEQsWUFBWTtBQUNqQkQsMkJBQVMsa0NBQWtDLGFBQWEsSUFBSSxJQUFJLFVBQVU7QUFDMUUsOEJBQWMsS0FBSyxFQUFDLE1BQU0sYUFBYSxNQUFNLE9BQU8sbUJBQWtCO0FBQ3RFO0FBQUEsY0FBQTtBQUFBLFlBQ0osT0FDRztBQUNLQyx3QkFBQSxpQkFBaUIsYUFBYSxJQUFJLHFDQUFxQztBQUFBLFlBQUE7QUFJbEUsNkJBQUEsS0FBSyxhQUFhLElBQUk7QUFBQSxVQUFBLE9BQ3BDO0FBQ0tBLHNCQUFBLGdDQUFnQyxhQUFhLElBQUksbUJBQW1CO0FBQzVFLDBCQUFjLEtBQUssRUFBQyxNQUFNLGFBQWEsTUFBTSxPQUFPLDhCQUE2QjtBQUFBLFVBQUE7QUFBQSxpQkFFaEYsZUFBZTtBQUNwQkQscUJBQVMsZ0NBQWdDLGFBQWEsSUFBSSxJQUFJLGFBQWE7QUFDM0Usd0JBQWMsS0FBSyxFQUFDLE1BQU0sYUFBYSxNQUFNLE9BQU8saUJBQWdCO0FBQUEsUUFBQTtBQUFBLE1BQ3hFO0FBSUEsVUFBQSxpQkFBaUIsbURBQW1ELFlBQVk7QUFFaEYsVUFBQSxpQkFBaUIsU0FBUyxHQUFHO0FBQzdCLDBCQUFrQixZQUFZLGlCQUFpQixNQUFNLGdDQUFnQyxpQkFBaUIsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUFBO0FBR2hILFVBQUEsY0FBYyxTQUFTLEdBQUc7QUFDcEIsY0FBQSxjQUFjLGNBQWMsSUFBSSxDQUFBLE1BQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxJQUFJO0FBQzVELDBCQUFrQixxQkFBcUIsY0FBYyxNQUFNLGlCQUFpQixXQUFXO0FBQUEsTUFBQTtBQUdwRixhQUFBO0FBQUEsUUFDSCxTQUFTO0FBQUEsUUFDVCxTQUFTO0FBQUEsUUFDVDtBQUFBLE1BQ0o7QUFBQSxhQUNLLE9BQU87QUFDWkEsaUJBQVMseUNBQXlDLEtBQUs7QUFDaEQsYUFBQTtBQUFBLFFBQ0gsU0FBUztBQUFBLFFBQ1QsU0FBUywrQkFBK0IsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSyxDQUFDO0FBQUEsTUFDbEc7QUFBQSxJQUFBO0FBQUEsRUFDSjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUosTUFBTSxlQUNGLGNBQ0EsU0FDQSxTQUNBLGVBQ0EsVUFDQSxNQUNBLGFBQ0EsaUJBQ0Esa0JBQ0EsUUFDQSxZQUM2RDtBQUN6RCxRQUFBO0FBQ0FDLGdCQUFRLG9DQUFvQyxZQUFZLGNBQWMsT0FBTyxjQUFjLE9BQU8sRUFBRTtBQUdwRyxZQUFNLEtBQUssdUJBQXVCO0FBR2xDLFlBQU0sYUFBYUgsZ0JBQUssS0FBSyxLQUFLLGNBQWMsUUFBUSxZQUFZO0FBQzVERyxnQkFBQSwyQkFBMkIsVUFBVSxFQUFFO0FBRy9DLFVBQUksQ0FBQyxNQUFNLEtBQUssZUFBZTtBQUMzQixlQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsNERBQTREO0FBQUEsTUFBQTtBQUk1RixZQUFBLFdBQVcsTUFBTSxnQkFBZ0IsYUFBYTtBQUM5QyxZQUFBLGVBQWMscUNBQVUsWUFBVztBQUN6QyxVQUFJLENBQUMsTUFBTSxLQUFLLG9CQUFvQixXQUFXLEdBQUc7QUFDOUMsZUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLHNDQUFzQyxXQUFXLEdBQUc7QUFBQSxNQUFBO0FBSTFGLFVBQUksQ0FBQyxrQkFBa0I7QUFDbkIsZUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLGtDQUFrQztBQUFBLE1BQUE7QUFJcEUsVUFBQTtBQUNNLGNBQUEsRUFBRSxRQUFRLGFBQWEsTUFBTSxVQUFVLDRCQUE0QixnQkFBZ0IsMEJBQTBCO0FBQy9HLFlBQUEsQ0FBQyxZQUFZLENBQUMsU0FBUyxjQUFjLFNBQVMsSUFBSSxHQUFHO0FBQ3JELGlCQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsdUJBQXVCLGdCQUFnQiwwQ0FBMEM7QUFBQSxRQUFBO0FBQUEsZUFFbEgsS0FBSztBQUNWRCxtQkFBUyxvQ0FBb0MsR0FBRztBQUNoRCxlQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsdUJBQXVCLGdCQUFnQixnQ0FBZ0M7QUFBQSxNQUFBO0FBSXpHLFVBQUE7QUFFTSxjQUFBLFlBQVksTUFBTSxLQUFLLGNBQWM7QUFDM0MsY0FBTSxrQkFBa0IsVUFBVTtBQUFBLFVBQU8sQ0FDckMsU0FBQSxLQUFLLFFBQVEsS0FBSyxLQUFLLHFCQUFxQjtBQUFBLFFBQ2hEO0FBRUksWUFBQSxnQkFBZ0IsVUFBVSxHQUFHO0FBQzdCLGlCQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsdUJBQXVCLGdCQUFnQixnRkFBZ0Y7QUFBQSxRQUFBO0FBRTdKQyxrQkFBUSxTQUFTLGdCQUFnQixNQUFNLDZCQUE2QixnQkFBZ0IsRUFBRTtBQUFBLGVBQ2pGLEtBQUs7QUFDVkQsbUJBQVMseUNBQXlDLEdBQUc7QUFBQSxNQUFBO0FBS3pELFlBQU0sY0FBYyxRQUFRO0FBQ3hCLFVBQUE7QUFDTyxlQUFBLE1BQU0sS0FBSyxzQkFBc0IsV0FBVztBQUFBLGVBQzlDLEtBQUs7QUFDSCxlQUFBO0FBQUEsVUFDSCxTQUFTO0FBQUEsVUFDVCxTQUFTLGVBQWUsUUFBUSxJQUFJLFVBQVUsT0FBTyxHQUFHO0FBQUEsUUFDNUQ7QUFBQSxNQUFBO0FBSUEsVUFBQUQsY0FBRyxXQUFXLFVBQVUsR0FBRztBQUNuQkUsa0JBQUEsc0NBQXNDLFVBQVUsRUFBRTtBQUMxRCxlQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsWUFBWSxZQUFZLGtCQUFrQjtBQUFBLE1BQUE7QUFHeEVBLGdCQUFBLCtCQUErQixVQUFVLEVBQUU7QUFDbkRGLG9CQUFHLFVBQVUsWUFBWSxFQUFFLFdBQVcsTUFBTTtBQUc1QyxZQUFNLFlBQVlELGdCQUFLLEtBQUssWUFBWSxRQUFRO0FBQ2hEQyxvQkFBRyxVQUFVLFdBQVcsRUFBRSxXQUFXLE1BQU07QUFHM0MsWUFBTSxZQUFZRCxnQkFBSyxLQUFLLFlBQVksUUFBUTtBQUNoREMsb0JBQUcsVUFBVSxXQUFXLEVBQUUsV0FBVyxNQUFNO0FBRzNDLFlBQU0sZUFBZUQsZ0JBQUssS0FBSyxXQUFXLFdBQVc7QUFDckQsWUFBTSxjQUFjLFdBQVc7QUFBQSxjQUFpQixZQUFZLFFBQVE7QUFHcEUsWUFBTSxZQUFZLFVBQVU7QUFDNUIsWUFBTSxnQkFBZ0IsY0FBYztBQUVwQyxZQUFNLGVBQWUsUUFBUSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBRXpDLFlBQU0sZ0JBQWdCLFlBQVksZUFDNUIsNkNBQTZDLFlBQVksS0FDekQ7QUFFTixZQUFNLGtCQUFrQjtBQUFBLGdCQUNwQixhQUFhO0FBQUE7QUFBQSxpQkFFWixhQUFhLEdBQUcsV0FBVztBQUFBLFlBQ2hDLGdCQUFnQjtBQUFBLGdCQUNaLGFBQWE7QUFBQTtBQUFBO0FBQUEsWUFHakIsU0FBUztBQUFBO0FBQUE7QUFHVEcsZ0JBQVEsb0JBQW9CO0FBQ3pCRixvQkFBQSxjQUFjLGNBQWMsaUJBQWlCLE1BQU07QUFHdEQsWUFBTSxjQUFjLGVBQWUsa0JBQzdCLGVBQWUsZUFBZSxLQUM5QixRQUFRLE9BQU87QUFFYkUsZ0JBQUEsdUJBQXVCLFdBQVcsRUFBRTtBQUc1QyxZQUFNLGlCQUFpQjtBQUFBO0FBQUE7QUFBQSxhQUd0QixXQUFXO0FBQUEsc0JBQ0YsWUFBWTtBQUFBO0FBQUEsV0FFdkIsSUFBSTtBQUFBO0FBQUEsVUFFTCxZQUFZO0FBQUE7QUFBQTtBQUFBLEVBR3BCLFlBQVksZUFBZSxXQUFXLEtBQUssWUFBWSxzQkFBc0IsWUFBWSwyQkFBMkIsWUFBWSxLQUFLLEVBQUU7QUFBQTtBQUFBLHdCQUVqSCxTQUFTO0FBQUEsNEJBQ0wsYUFBYTtBQUFBLHdCQUNqQixnQkFBZ0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxVQUk5QixXQUFXO0FBQUE7QUFBQSxVQUVYLGdCQUFnQixJQUFJLGdCQUFnQjtBQUFBO0FBQUE7QUFBQSxJQUcxQyxXQUFXO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJWCxZQUFZO0FBQUE7QUFBQTtBQUlKLFlBQU0sa0JBQWtCSCxnQkFBSyxLQUFLLFlBQVksb0JBQW9CO0FBQzFERyxnQkFBQSxrQ0FBa0MsZUFBZSxFQUFFO0FBQ3hERixvQkFBQSxjQUFjLGlCQUFpQixnQkFBZ0IsTUFBTTtBQUd4RCxZQUFNLHNCQUFzQkQsZ0JBQUssS0FBSyxLQUFLLGNBQWMscUJBQXFCLE9BQU87QUFDckYsVUFBSSxZQUFZLGdCQUFnQixDQUFDQyxjQUFHLFdBQVcsbUJBQW1CLEdBQUc7QUFDekRFLGtCQUFBLDBDQUEwQyxtQkFBbUIsRUFBRTtBQUd2RUYsc0JBQUcsVUFBVSxxQkFBcUIsRUFBRSxXQUFXLE1BQU07QUFHckQsY0FBTSxhQUFhRCxnQkFBSyxLQUFLLHFCQUFxQixZQUFZO0FBQzNEQyxzQkFBQSxjQUFjLFlBQVksb0VBQW9FLE9BQU87QUFBQSx3R0FDaEIsTUFBTTtBQUFBLE1BQUE7QUFJbEcsWUFBTSxXQUFXRCxnQkFBSyxLQUFLLFlBQVksb0JBQW9CO0FBQ25ERyxnQkFBQSxnQ0FBZ0MsUUFBUSxFQUFFO0FBRWxELFlBQU0sT0FBTztBQUFBLFFBQ1QsTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ047QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxhQUFhLENBQUMsRUFBRSxlQUFlO0FBQUEsUUFDL0IsaUJBQWlCLGVBQWUsa0JBQWtCLGtCQUFrQjtBQUFBLFFBQ3BFO0FBQUEsUUFDQSxZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsTUFDdEM7QUFFR0Ysb0JBQUEsY0FBYyxVQUFVLEtBQUssVUFBVSxNQUFNLE1BQU0sQ0FBQyxHQUFHLE1BQU07QUFHaEVFLGdCQUFRLHlCQUF5QjtBQUMzQixZQUFBLGlCQUFpQixNQUFNLEtBQUssa0JBQWtCO0FBRWhELFVBQUE7QUFDQUEsa0JBQVEsa0JBQWtCLFVBQVUsUUFBUSxjQUFjLFFBQVE7QUFDNUQsY0FBQSxFQUFFLFFBQVEsT0FBVyxJQUFBLE1BQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLFFBQVE7QUFFMUYsWUFBSSxPQUFRQSxXQUFRLDBCQUEwQixNQUFNLEVBQUU7QUFDdEQsWUFBSSxPQUFRQSxXQUFRLDBCQUEwQixNQUFNLEVBQUU7QUFBQSxlQUNqRCxPQUFPO0FBQ1pELG1CQUFTLDRCQUE0QixLQUFLO0FBR3RDLFlBQUE7QUFDTSxnQkFBQSxFQUFFLFFBQVEsS0FBUyxJQUFBLE1BQU0sVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLE9BQU87QUFDL0VDLG9CQUFBLG1CQUFtQixJQUFJLEVBQUU7QUFBQSxpQkFDNUJRLFFBQU87QUFDWlQscUJBQVMsK0JBQStCUyxNQUFLO0FBQUEsUUFBQTtBQUcxQyxlQUFBO0FBQUEsVUFDSCxTQUFTO0FBQUEsVUFDVCxTQUFTLDZCQUE2QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxRQUNoRztBQUFBLE1BQUE7QUFJQSxVQUFBO0FBQ0FSLGtCQUFRLGdDQUFnQztBQUNsQyxjQUFBLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSxVQUFVLDRCQUE0QixZQUFZLDBCQUEwQjtBQUU5R0Esa0JBQUEscUJBQXFCLGVBQWUsRUFBRTtBQUU5QyxZQUFJLENBQUMsZ0JBQWdCLFNBQVMsSUFBSSxHQUFHO0FBQ2pDQSxvQkFBUSx3Q0FBd0M7QUFHNUMsY0FBQTtBQUNNLGtCQUFBLEVBQUUsUUFBUSxrQkFBa0IsTUFBTSxVQUFVLGVBQWUsWUFBWSxZQUFZO0FBQ2pGQSxzQkFBQSxtQkFBbUIsYUFBYSxFQUFFO0FBQUEsbUJBQ3JDLE9BQU87QUFDWkQsdUJBQVMsK0JBQStCLEtBQUs7QUFBQSxVQUFBO0FBRzFDLGlCQUFBO0FBQUEsWUFDSCxTQUFTO0FBQUE7QUFBQSxZQUNULFNBQVM7QUFBQSxZQUNUO0FBQUEsVUFDSjtBQUFBLFFBQUE7QUFBQSxlQUVDLE9BQU87QUFDWkEsbUJBQVMsbUNBQW1DLEtBQUs7QUFBQSxNQUFBO0FBRzdDQyxnQkFBQSx1Q0FBdUMsWUFBWSxFQUFFO0FBQ3RELGFBQUE7QUFBQSxRQUNILFNBQVM7QUFBQSxRQUNULFNBQVMsaUJBQWlCLFlBQVksaUNBQWlDLElBQUk7QUFBQSxRQUMzRTtBQUFBLE1BQ0o7QUFBQSxhQUNLLE9BQU87QUFDSEQsaUJBQUEsZ0NBQWdDLFlBQVksSUFBSSxLQUFLO0FBQ3ZELGFBQUE7QUFBQSxRQUNILFNBQVM7QUFBQSxRQUNULFNBQVMsNEJBQTRCLGlCQUFpQixRQUFRLE1BQU0sVUFBVSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQy9GO0FBQUEsSUFBQTtBQUFBLEVBQ0o7QUFFUjtBQUVBLE1BQWUsdUJBQUEsSUFBSSxxQkFBcUI7QUNsaUN4QyxTQUFTLG9CQUEwQixTQUFpQixTQUFzRTtBQUNsSCxNQUFBO0FBRUEsVUFBTSxXQUFZVSxTQUFBQSxRQUFnQjtBQUNsQyxRQUFJLFlBQVksU0FBUyxPQUFPLFNBQVMsSUFBSSxPQUFPLEdBQUc7QUFDM0NULGdCQUFBLDJDQUEyQyxPQUFPLHlCQUF5QjtBQUNuRjtBQUFBLElBQUE7QUFJQSxRQUFBO0FBQ1FTLHVCQUFBLE9BQU8sU0FBUyxPQUFPO0FBQ3ZCVCxnQkFBQSwyQkFBMkIsT0FBTyxFQUFFO0FBQUEsYUFDdkMsT0FBTztBQUNaLFVBQUssTUFBZ0IsUUFBUSxTQUFTLGdCQUFnQixHQUFHO0FBQzdDQSxrQkFBQSx1Q0FBdUMsT0FBTyx5QkFBeUI7QUFBQSxNQUFBLE9BQzVFO0FBQ0csY0FBQTtBQUFBLE1BQUE7QUFBQSxJQUNWO0FBQUEsV0FFQyxPQUFPO0FBQ0hELGVBQUEsOENBQThDLE9BQU8sSUFBSSxLQUFLO0FBQUEsRUFBQTtBQUUvRTtBQUtPLFNBQVMsd0JBQThCO0FBQzFDQyxZQUFRLDJCQUEyQjtBQUduQyxzQkFBaUQsb0JBQW9CLE9BQU8sUUFBUSxFQUFFLFdBQVcsYUFBYTtBQUNsR0EsY0FBQSwrQkFBK0IsU0FBUyxJQUFJLE1BQU07QUFFdEQsUUFBQTtBQUNJLFVBQUE7QUFFSixjQUFRLFdBQVc7QUFBQSxRQUNmLEtBQUs7QUFDREEsb0JBQVEsaUJBQWlCO0FBQ2hCLG1CQUFBLE1BQU0scUJBQXFCLFlBQVk7QUFDaEQ7QUFBQSxRQUVKLEtBQUs7QUFDRCxtQkFBUyxNQUFNLHFCQUFxQixjQUFjLE9BQU8sZ0JBQWdCLEVBQUU7QUFDM0U7QUFBQSxRQUVKLEtBQUs7QUFDRCxtQkFBUyxNQUFNLHFCQUFxQixhQUFhLE9BQU8sZ0JBQWdCLEVBQUU7QUFDMUU7QUFBQSxRQUVKLEtBQUs7QUFDRCxtQkFBUyxNQUFNLHFCQUFxQixlQUFlLE9BQU8sZ0JBQWdCLElBQUksT0FBTyxTQUFTO0FBQzlGO0FBQUEsUUFFSixLQUFLO0FBQ0QsbUJBQVMsTUFBTSxxQkFBcUI7QUFBQSxZQUNoQyxPQUFPLGdCQUFnQjtBQUFBLFlBQ3ZCLE9BQU87QUFBQSxZQUNQLE9BQU87QUFBQSxVQUNYO0FBQ0E7QUFBQSxRQUVKLEtBQUs7QUFDREEsb0JBQVEsbUJBQW1CO0FBQ2xCLG1CQUFBLE1BQU0scUJBQXFCLGNBQWM7QUFDbEQ7QUFBQSxRQUVKLEtBQUs7QUFDRCxtQkFBUyxNQUFNLHFCQUFxQixvQkFBb0IsaUNBQVEsV0FBVztBQUMzRTtBQUFBLFFBRUo7QUFDSSxnQkFBTSxJQUFJLE1BQU0sNkJBQTZCLFNBQVMsRUFBRTtBQUFBLE1BQUE7QUFHaEVBLGdCQUFRLCtCQUErQixTQUFTLElBQUksRUFBRSxTQUFTLE1BQU07QUFDOUQsYUFBQTtBQUFBLGFBQ0YsT0FBTztBQUNIRCxpQkFBQSxxQ0FBcUMsU0FBUyxJQUFJLEtBQUs7QUFDekQsYUFBQTtBQUFBLFFBQ0gsU0FBUztBQUFBLFFBQ1QsU0FBUyxxQkFBcUIsaUJBQWlCLFFBQVEsTUFBTSxVQUFVLE9BQU8sS0FBSyxDQUFDO0FBQUEsTUFDeEY7QUFBQSxJQUFBO0FBQUEsRUFDSixDQUNIO0FBR0Qsc0JBQThDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxPQUFPLGNBQWM7QUFDdEZBLGVBQUEseUJBQXlCLEtBQUssSUFBSSxPQUFPO0FBQzNDVyxvQkFBQSxhQUFhLE9BQU8sT0FBTztBQUFBLEVBQUEsQ0FDckM7QUFHK0Usc0JBQUEsdUJBQXVCLE9BQU8sUUFBUSxZQUFZO0FBQzlIVixjQUFRLDBCQUEwQixFQUFFLE9BQU8sUUFBUSxPQUFPO0FBQ25ELFdBQUEsTUFBTVUsU0FBQUEsT0FBTyxlQUFlLE9BQU87QUFBQSxFQUFBLENBQzdDO0FBRytFLHNCQUFBLG9CQUFvQixPQUFPLFFBQVEsWUFBWTtBQUMzSFYsY0FBUSx1QkFBdUIsRUFBRSxPQUFPLFFBQVEsT0FBTztBQUNoRCxXQUFBLE1BQU1VLFNBQUFBLE9BQU8sZUFBZSxPQUFPO0FBQUEsRUFBQSxDQUM3QztBQUcrRSxzQkFBQSxvQkFBb0IsT0FBTyxRQUFRLFlBQVk7QUFDM0hWLGNBQVEsdUJBQXVCLEVBQUUsT0FBTyxRQUFRLE9BQU87QUFDaEQsV0FBQSxNQUFNVSxTQUFBQSxPQUFPLGVBQWUsT0FBTztBQUFBLEVBQUEsQ0FDN0M7QUFFRFYsWUFBUSxzQ0FBc0M7QUFDbEQ7QUFNQSxlQUFzQixnQkFBK0I7QUFDN0MsTUFBQTtBQUNBQSxjQUFRLDBCQUEwQjtBQUc1QixVQUFBLGdCQUFnQixNQUFNLHFCQUFxQixZQUFZO0FBQzdELFFBQUksQ0FBQyxlQUFlO0FBQ2hCRCxpQkFBUyx3QkFBd0I7QUFFakM7QUFBQSxJQUFBO0FBSUosVUFBTSxxQkFBcUIsb0JBQW9CO0FBRS9DQyxjQUFRLHNDQUFzQztBQUFBLFdBQ3pDLE9BQU87QUFDSEQsZUFBQSxvQ0FBb0MsaUJBQWlCLFFBQVEsUUFBUSxJQUFJLE1BQU0sT0FBTyxLQUFLLENBQUMsQ0FBQztBQUNoRyxVQUFBO0FBQUEsRUFBQTtBQUVkO0FDektBLE1BQU0sa0JBQWtCLE1BQU07QUFDMUIsU0FBT0YsZ0JBQUssS0FBS2MsU0FBQUEsSUFBSSxRQUFRLFVBQVUsR0FBRyxrQkFBa0I7QUFDaEU7QUFHTyxTQUFTLGVBQWVDLGNBQThCO0FBQ3JELE1BQUE7QUFDQSxVQUFNLGVBQWUsZ0JBQWdCO0FBQ3JDLFVBQU0sT0FBTztBQUFBLE1BQ1QsZUFBZUE7QUFBQSxNQUNmLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxNQUNsQyxTQUFTO0FBQUE7QUFBQSxJQUNiO0FBQ0FkLGtCQUFHLGNBQWMsY0FBYyxLQUFLLFVBQVUsSUFBSSxDQUFDO0FBQzVDLFdBQUE7QUFBQSxXQUNGLEtBQUs7QUFDRixZQUFBLE1BQU0sbUNBQW1DLEdBQUc7QUFDN0MsV0FBQTtBQUFBLEVBQUE7QUFFZjtBQUdPLFNBQVMsaUJBQWdDO0FBQ3hDLE1BQUE7QUFDQSxVQUFNLGVBQWUsZ0JBQWdCO0FBQ2pDLFFBQUFBLGNBQUcsV0FBVyxZQUFZLEdBQUc7QUFDN0IsWUFBTSxPQUFPLEtBQUssTUFBTUEsY0FBRyxhQUFhLFlBQVksQ0FBQztBQU9yRCxVQUFJLEtBQUssaUJBQWlCQSxjQUFHLFdBQVcsS0FBSyxhQUFhLEdBQUc7QUFDekQsZUFBTyxLQUFLO0FBQUEsTUFBQSxPQUNUO0FBRUgsWUFBSSxLQUFLLGVBQWU7QUFDaEIsY0FBQTtBQUNBLGtCQUFNLFNBQVNELGdCQUFLLFFBQVEsS0FBSyxhQUFhO0FBQzlDLGdCQUFJLENBQUNDLGNBQUcsV0FBVyxNQUFNLEdBQUc7QUFDeEJBLDRCQUFHLFVBQVUsUUFBUSxFQUFFLFdBQVcsTUFBTTtBQUFBLFlBQUE7QUFBQSxtQkFFdkMsUUFBUTtBQUNMLG9CQUFBLE1BQU0saUNBQWlDLE1BQU07QUFBQSxVQUFBO0FBQUEsUUFDekQ7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUVHLFdBQUE7QUFBQSxXQUNGLEtBQUs7QUFDRixZQUFBLE1BQU0sbUNBQW1DLEdBQUc7QUFDN0MsV0FBQTtBQUFBLEVBQUE7QUFFZjtBQy9DQSxTQUFTLG9CQUFvQjtBQUN2QixNQUFBO0FBRUYsVUFBTSxxQkFBcUI7QUFBQSxNQUN6QixRQUFRO0FBQUEsUUFDTjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQUQsZ0JBQUssS0FBS08sY0FBRyxXQUFXLGFBQWE7QUFBQSxNQUN2QztBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0w7QUFBQSxRQUNBUCxnQkFBSyxLQUFLTyxjQUFHLFdBQVcsZ0RBQWdEO0FBQUEsTUFBQTtBQUFBLElBRTVFO0FBRUEsVUFBTSxXQUFXLFFBQVE7QUFDekIsVUFBTSxnQkFBZ0IsbUJBQW1CLFFBQVEsS0FBSyxDQUFDO0FBR2pELFVBQUEsZ0JBQWdCLGNBQWMsT0FBTyxDQUFLLE1BQUE7QUFDMUMsVUFBQTtBQUNLLGVBQUFOLGNBQUcsV0FBVyxDQUFDO0FBQUEsZUFDZixPQUFPO0FBQ1AsZUFBQTtBQUFBLE1BQUE7QUFBQSxJQUNULENBQ0Q7QUFHSyxVQUFBLGNBQWMsWUFBWSxRQUFRO0FBR2xDLFVBQUEsZ0JBQWdCLGFBQWEsVUFBVSxNQUFNO0FBQ25ELFVBQU0sZUFBZSxDQUFDLEdBQUcsZUFBZSxXQUFXLEVBQUUsS0FBSyxhQUFhO0FBR3ZFLFlBQUEsSUFBWSxPQUFPO0FBRW5CLFlBQVEsSUFBSSxzQ0FBc0MsUUFBWSxJQUFBLElBQUksRUFBRTtBQUM3RCxXQUFBO0FBQUEsV0FDQSxPQUFPO0FBQ04sWUFBQSxNQUFNLGdDQUFnQyxLQUFLO0FBQzVDLFdBQUEsWUFBWSxRQUFRO0FBQUEsRUFBQTtBQUUvQjtBQUdBLGtCQUFrQjtBQUdsQixJQUFJLFNBQVM7QUFDYixJQUFJO0FBRU8sV0FBQTtBQUNELFVBQUEsSUFBSSw2QkFBNkIsTUFBTTtBQUNqRCxTQUFTLEdBQUc7QUFFTixNQUFBO0FBQ0YsWUFBUSxJQUFJLGtEQUFrRDtBQUM5RCxhQUFTYSxhQUFJLFdBQVc7QUFDaEIsWUFBQSxJQUFJLDRCQUE0QixNQUFNO0FBQUEsV0FDdkMsSUFBSTtBQUVILFlBQUEsTUFBTSwrQ0FBK0MsRUFBRTtBQUMvRCxhQUFTLFFBQVEsSUFBSTtBQUNiLFlBQUEsSUFBSSx1QkFBdUIsTUFBTTtBQUFBLEVBQUE7QUFFN0M7QUFHQSxRQUFRLElBQUkscUJBQXFCLFlBQW9CO0FBQ3JELFFBQVEsSUFBSSw4QkFBOEIsUUFBUSxJQUFBLENBQUs7QUFDdkQsUUFBUSxJQUFJLGtCQUFrQixNQUFNO0FBRXBDLElBQUksa0JBQWlDO0FBR3JDLE1BQU0sc0JBQXNCLElBQUksT0FBTztBQUN2QyxNQUFNLGdCQUFnQjtBQUl0QixNQUFNLFVBQVUsQ0FBQyxTQUFpQixTQUFlO0FBQy9DLFFBQU0sYUFBYSxLQUFJLG9CQUFJLEtBQUssR0FBRSxnQkFBZ0IsWUFBWSxPQUFPLEdBQXVDLEVBQUU7QUFDOUcsVUFBUSxJQUFJLFVBQVU7QUFDdEIsa0JBQWdCLFVBQVU7QUFDNUI7QUFFQSxNQUFNLFdBQVcsQ0FBQyxTQUFpQixVQUFnQjtBQUNqRCxNQUFJLFdBQVc7QUFDZixNQUFJLE9BQU87QUFDVCxRQUFJLGlCQUFpQixPQUFPO0FBQ2YsaUJBQUE7QUFBQSxFQUFLLE1BQU0sU0FBUyxNQUFNLE9BQU87QUFBQSxJQUFBLE9BQ3ZDO0FBQ0QsVUFBQTtBQUNTLG1CQUFBO0FBQUEsRUFBSyxLQUFLLFVBQVUsS0FBSyxDQUFDO0FBQUEsTUFBQSxRQUMvQjtBQUNLLG1CQUFBO0FBQUEsRUFBSyxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQUE7QUFBQSxJQUMvQjtBQUFBLEVBQ0Y7QUFHSSxRQUFBLGFBQWEsS0FBSSxvQkFBSSxLQUFLLEdBQUUsZ0JBQWdCLGFBQWEsT0FBTyxHQUFHLFFBQVE7QUFDakYsVUFBUSxNQUFNLFVBQVU7QUFDeEIsa0JBQWdCLFVBQVU7QUFDNUI7QUFHQSxTQUFTLGlCQUFpQjtBQUNwQixNQUFBO0FBQ0ksVUFBQSxjQUFjQSxTQUFBQSxJQUFJLFFBQVEsVUFBVTtBQUMxQyxRQUFJLGNBQWM7QUFHbEIsVUFBTSxrQkFBa0JkLGdCQUFLLEtBQUssYUFBYSxjQUFjO0FBQ3pELFFBQUFDLGNBQUcsV0FBVyxlQUFlLEdBQUc7QUFDOUIsVUFBQTtBQUNGLGNBQU0sT0FBTyxLQUFLLE1BQU1BLGNBQUcsYUFBYSxpQkFBaUIsT0FBTyxDQUFDO0FBQ2pFLHNCQUFjLEtBQUs7QUFBQSxlQUNaLEtBQUs7QUFDSixnQkFBQSxNQUFNLCtCQUErQixHQUFHO0FBQUEsTUFBQTtBQUFBLElBQ2xEO0FBSUksVUFBQSxXQUFXLGNBQWNELGdCQUFLLEtBQUssYUFBYSxNQUFNLElBQUlBLGdCQUFLLEtBQUssYUFBYSxNQUFNO0FBQzdGLFFBQUksQ0FBQ0MsY0FBRyxXQUFXLFFBQVEsR0FBRztBQUM1QkEsb0JBQUcsVUFBVSxVQUFVLEVBQUUsV0FBVyxNQUFNO0FBQUEsSUFBQTtBQUlyQyxXQUFBRCxnQkFBSyxLQUFLLFVBQVUsU0FBUztBQUFBLFdBQzdCLEtBQUs7QUFDSixZQUFBLE1BQU0sZ0NBQWdDLEdBQUc7QUFDMUMsV0FBQTtBQUFBLEVBQUE7QUFFWDtBQUdBLElBQUksY0FBNkI7QUFHakMsU0FBUyxjQUFjO0FBQ2pCLE1BQUE7QUFDRixrQkFBYyxlQUFlO0FBQzdCLFFBQUksYUFBYTtBQUNmLFVBQUksQ0FBQ0MsY0FBRyxXQUFXLFdBQVcsR0FBRztBQUUvQixjQUFNLGlCQUNGO0FBQUE7QUFBQSxZQUVnQixvQkFBQSxLQUFPLEdBQUEsZUFBZ0IsQ0FBQTtBQUFBLGVBQ3ZCLFlBQWlDO0FBQUE7QUFBQTtBQUdsREEsc0JBQUEsY0FBYyxhQUFhLGNBQWM7QUFDcEMsZ0JBQUEsSUFBSSx3QkFBd0IsV0FBVyxFQUFFO0FBQUEsTUFBQSxPQUM1QztBQUVMLGNBQU0saUJBQ0Y7QUFBQTtBQUFBLG9CQUN3QixvQkFBQSxLQUFPLEdBQUEsZUFBZ0IsQ0FBQTtBQUFBO0FBQUE7QUFJN0IsOEJBQUE7QUFFbkJBLHNCQUFBLGVBQWUsYUFBYSxjQUFjO0FBQ3JDLGdCQUFBLElBQUksK0JBQStCLFdBQVcsRUFBRTtBQUFBLE1BQUE7QUFBQSxJQUMxRDtBQUFBLFdBRUssS0FBSztBQUNKLFlBQUEsTUFBTSxnQ0FBZ0MsR0FBRztBQUFBLEVBQUE7QUFFckQ7QUFNQSxTQUFTLHdCQUFpQztBQUN4QyxNQUFJLENBQUMsZUFBZSxDQUFDQSxjQUFHLFdBQVcsV0FBVyxHQUFHO0FBQ3hDLFdBQUE7QUFBQSxFQUFBO0FBR0wsTUFBQTtBQUNJLFVBQUEsUUFBUUEsY0FBRyxTQUFTLFdBQVc7QUFDakMsUUFBQSxNQUFNLE9BQU8scUJBQXFCO0FBQzdCLGFBQUE7QUFBQSxJQUFBO0FBR1QsWUFBUSxJQUFJLGtCQUFrQixNQUFNLElBQUksMEJBQTBCLG1CQUFtQiwyQkFBMkI7QUFHMUcsVUFBQSxVQUFVRCxnQkFBSyxRQUFRLFdBQVc7QUFHeEMsVUFBTSxjQUFjQSxnQkFBSyxTQUFTLGFBQWEsTUFBTTtBQUNyRCxVQUFNLGNBQWNDLGNBQUcsWUFBWSxPQUFPLEVBQ3ZDLE9BQU8sT0FBSyxFQUFFLFdBQVcsR0FBRyxXQUFXLEdBQUcsS0FBSyxFQUFFLFNBQVMsTUFBTSxDQUFDLEVBQ2pFLEtBQUs7QUFHUixhQUFTLElBQUksWUFBWSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDMUMsWUFBQSxRQUFRLFlBQVksQ0FBQyxFQUFFLE1BQU0sSUFBSSxPQUFPLEdBQUcsV0FBVyxXQUFjLENBQUM7QUFDM0UsVUFBSSxPQUFPO0FBQ1QsY0FBTSxpQkFBaUIsU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQ3hDLFlBQUEsa0JBQWtCLGdCQUFnQixHQUFHO0FBRXZDLGdCQUFNLFlBQVlELGdCQUFLLEtBQUssU0FBUyxZQUFZLENBQUMsQ0FBQztBQUNuREMsd0JBQUcsV0FBVyxTQUFTO0FBQ2Ysa0JBQUEsSUFBSSx5QkFBeUIsU0FBUyxFQUFFO0FBQUEsUUFBQSxPQUMzQztBQUVMLGdCQUFNLFVBQVVELGdCQUFLLEtBQUssU0FBUyxZQUFZLENBQUMsQ0FBQztBQUMzQyxnQkFBQSxVQUFVQSxnQkFBSyxLQUFLLFNBQVMsR0FBRyxXQUFXLElBQUksaUJBQWlCLENBQUMsTUFBTTtBQUMxRUMsd0JBQUEsV0FBVyxTQUFTLE9BQU87QUFDOUIsa0JBQVEsSUFBSSxxQkFBcUIsT0FBTyxPQUFPLE9BQU8sRUFBRTtBQUFBLFFBQUE7QUFBQSxNQUMxRDtBQUFBLElBQ0Y7QUFJRixVQUFNLGlCQUFpQkQsZ0JBQUssS0FBSyxTQUFTLEdBQUcsV0FBVyxRQUFRO0FBQzdEQyxrQkFBQSxXQUFXLGFBQWEsY0FBYztBQUN6QyxZQUFRLElBQUksMEJBQTBCLFdBQVcsT0FBTyxjQUFjLEVBQUU7QUFHbEUsVUFBQSwwQkFBVSxLQUFLO0FBQ3JCLFVBQU0saUJBQ0o7QUFBQTtBQUFBLFdBRVksSUFBSSxlQUFnQixDQUFBO0FBQUEsZUFDaEIsWUFBaUM7QUFBQTtBQUFBO0FBRWhEQSxrQkFBQSxjQUFjLGFBQWEsY0FBYztBQUVyQyxXQUFBO0FBQUEsV0FDQSxLQUFLO0FBQ0osWUFBQSxNQUFNLDRCQUE0QixHQUFHO0FBQ3RDLFdBQUE7QUFBQSxFQUFBO0FBRVg7QUFHQSxTQUFTLGdCQUFnQixTQUFpQjtBQUN4QyxNQUFJLENBQUMsWUFBYTtBQUVkLE1BQUE7QUFFb0IsMEJBQUE7QUFFbkJBLGtCQUFBLGVBQWUsYUFBYSxVQUFVLElBQUk7QUFBQSxXQUN0QyxLQUFLO0FBQ0osWUFBQSxNQUFNLDhCQUE4QixHQUFHO0FBQUEsRUFBQTtBQUVuRDtBQUtBYSxTQUFBQSxJQUFJLFFBQVEsY0FBYztBQUMxQkEsU0FBQSxJQUFJLHFCQUFxQjtBQUFBLEVBQ3ZCLGlCQUFpQjtBQUFBLEVBQ2pCLG9CQUFvQkEsYUFBSSxXQUFXO0FBQUEsRUFDbkMsU0FBU0EsYUFBSSxXQUFXO0FBQUEsRUFDeEIsV0FBVztBQUFBLEVBQ1gsU0FBUyxDQUFDLFlBQVk7QUFBQSxFQUN0QixTQUFTO0FBQUEsRUFDVCxTQUFTO0FBQ1gsQ0FBQztBQVdELE9BQU8sbUJBQW1CO0FBQzFCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sbUJBQW1CO0FBQzFCLE9BQU8sd0JBQXdCO0FBUS9CLE1BQU0sZUFBZUYsU0FBQTtBQUVyQkEsU0FBQSxRQUFRLEdBQUcscUJBQXFCLENBQUMsUUFBUUcsaUJBQWdCO0FBQ25ELE1BQUE7QUFDRixRQUFJLENBQUMsbUJBQW1CQSxnQkFBZWQsY0FBRyxXQUFXYyxZQUFXLEdBQUc7QUFDL0NBLHdCQUFBQTtBQUNsQixxQkFBZUEsWUFBVztBQUNsQixjQUFBLCtCQUErQkEsWUFBVyxFQUFFO0FBQUEsSUFBQTtBQUFBLFdBRS9DLEtBQUs7QUFDSixZQUFBLE1BQU0sK0JBQStCLEdBQUc7QUFBQSxFQUFBO0FBRXBELENBQUM7QUFFREgsU0FBQUEsUUFBUSxPQUFPLHVCQUF1QixNQUFNO0FBQ3RDLE1BQUE7QUFFRixzQkFBa0IsZUFBZTtBQUMxQixXQUFBO0FBQUEsV0FDQSxLQUFLO0FBQ0osWUFBQSxNQUFNLGtDQUFrQyxHQUFHO0FBQzVDLFdBQUE7QUFBQSxFQUFBO0FBRVgsQ0FBQztBQUdEQSxTQUFBQSxRQUFRLE9BQU8scUJBQXFCLFlBQVk7QUFDMUMsTUFBQTtBQUNJLFVBQUEsY0FBY0UsU0FBQUEsSUFBSSxRQUFRLFVBQVU7QUFDMUMsUUFBSSxjQUFjO0FBR2xCLFVBQU0sa0JBQWtCZCxnQkFBSyxLQUFLLGFBQWEsY0FBYztBQUN6RCxRQUFBQyxjQUFHLFdBQVcsZUFBZSxHQUFHO0FBQzlCLFVBQUE7QUFDRixjQUFNLE9BQU8sS0FBSyxNQUFNQSxjQUFHLGFBQWEsaUJBQWlCLE9BQU8sQ0FBQztBQUNqRSxzQkFBYyxLQUFLO0FBQUEsZUFDWixLQUFLO0FBQ1osaUJBQVMsOEJBQThCLEdBQUc7QUFBQSxNQUFBO0FBQUEsSUFDNUM7QUFJRixVQUFNLFdBQVcsZUFBZUEsY0FBRyxXQUFXLFdBQVcsSUFDckRELGdCQUFLLEtBQUssYUFBYSxNQUFNLElBQzdCQSxnQkFBSyxLQUFLLGFBQWEsTUFBTTtBQUVqQyxRQUFJLENBQUNDLGNBQUcsV0FBVyxRQUFRLEdBQUc7QUFDckIsYUFBQTtBQUFBLElBQUE7QUFJVCxVQUFNLGNBQWNELGdCQUFLLEtBQUssVUFBVSxTQUFTO0FBQzdDLFFBQUFDLGNBQUcsV0FBVyxXQUFXLEdBQUc7QUFDdkIsYUFBQTtBQUFBLElBQUE7QUFJSCxVQUFBLFdBQVdBLGNBQUcsWUFBWSxRQUFRLEVBQ3JDLE9BQU8sVUFBUSxLQUFLLFNBQVMsTUFBTSxDQUFDLEVBQ3BDLElBQUksQ0FBQSxTQUFRRCxnQkFBSyxLQUFLLFVBQVUsSUFBSSxDQUFDO0FBRXBDLFFBQUEsU0FBUyxXQUFXLEdBQUc7QUFDbEIsYUFBQTtBQUFBLElBQUE7QUFJVCxXQUFPLFNBQVMsS0FBSyxDQUFDLEdBQUcsTUFBTTtBQUN2QixZQUFBLFFBQVFDLGNBQUcsU0FBUyxDQUFDO0FBQ3JCLFlBQUEsUUFBUUEsY0FBRyxTQUFTLENBQUM7QUFDcEIsYUFBQSxNQUFNLGNBQWMsTUFBTTtBQUFBLElBQ2xDLENBQUEsRUFBRSxDQUFDO0FBQUEsV0FDRyxPQUFPO0FBQ2QsYUFBUyxzQ0FBc0MsS0FBSztBQUM3QyxXQUFBO0FBQUEsRUFBQTtBQUVYLENBQUM7QUFHRFcsU0FBQUEsUUFBUSxPQUFPLGlCQUFpQixPQUFPLFFBQVEsRUFBRSxhQUFBRyxtQkFBa0I7QUFDN0QsTUFBQTtBQUNGLFFBQUksQ0FBQ0EsZ0JBQWUsQ0FBQ2QsY0FBRyxXQUFXYyxZQUFXLEdBQUc7QUFDdEMsZUFBQSx1QkFBdUJBLFlBQVcsRUFBRTtBQUN0QyxhQUFBO0FBQUEsSUFBQTtBQUdILFVBQUFDLFNBQUEsTUFBTSxTQUFTRCxZQUFXO0FBQ3pCLFdBQUE7QUFBQSxXQUNBLE9BQU87QUFDZCxhQUFTLGtDQUFrQyxLQUFLO0FBQ3pDLFdBQUE7QUFBQSxFQUFBO0FBRVgsQ0FBQztBQUdELFNBQVMsc0JBQXNCRSxTQUFtRDtBQUNoRixNQUFJLENBQUNBLFdBQVVBLFFBQU8sY0FBZTtBQUVyQyxhQUFXLE1BQU07QUFDZixRQUFJQSxXQUFVLENBQUNBLFFBQU8sZUFBZTtBQUM1QixNQUFBQSxRQUFBLFlBQVksS0FBSyxxQkFBcUI7QUFBQSxJQUFBO0FBQUEsS0FFOUMsR0FBRztBQUNSO0FBR0EsZUFBZSxxQkFBcUIsWUFBZ0U7QUFDbEcsTUFBSSxDQUFDLGNBQWMsV0FBVyxlQUFlO0FBQ3BDLFdBQUE7QUFBQSxFQUFBO0FBR0wsTUFBQTtBQUVLLFdBQUEsSUFBSSxRQUFpQixDQUFDLFlBQVk7QUFFdkMsWUFBTSxrQkFBa0IsQ0FBQyxRQUFhLEVBQUUsY0FBYyx1QkFBOEU7QUFDMUhMLHlCQUFBLGVBQWUsOEJBQThCLGVBQWU7QUFHcEUsWUFBSSxrQkFBa0I7QUFDcEIsa0JBQVEsc0RBQXNEO0FBQzlELGtCQUFRLElBQUk7QUFDWjtBQUFBLFFBQUE7QUFHRixnQkFBUSxZQUFZO0FBQUEsTUFDdEI7QUFFUUEsdUJBQUEsS0FBSyw4QkFBOEIsZUFBZTtBQUcvQyxpQkFBQSxZQUFZLEtBQUssMEJBQTBCO0FBR3RELGlCQUFXLE1BQU07QUFDUEEseUJBQUEsZUFBZSw4QkFBOEIsZUFBZTtBQUNwRSxnQkFBUSwwRUFBMEU7QUFDbEYsZ0JBQVEsSUFBSTtBQUFBLFNBQ1gsR0FBSTtBQUFBLElBQUEsQ0FDUjtBQUFBLFdBQ00sT0FBTztBQUNkLGFBQVMseUNBQXlDLEtBQUs7QUFDaEQsV0FBQTtBQUFBLEVBQUE7QUFFWDtBQXlCQSxTQUFTLHNCQUFzQkssU0FBZ0M7QUFDN0QsTUFBSSxDQUFDQSxXQUFVQSxRQUFPLGNBQWU7QUFHckMsUUFBTSxXQUFXakIsZ0JBQUssUUFBUSxRQUFRLG9CQUFvQjtBQUNsRCxVQUFBLDJCQUEyQixRQUFRLEVBQUU7QUFFdEMsRUFBQWlCLFFBQUEsU0FBUyxVQUFVLEVBQUUsTUFBTSxPQUFRLENBQUEsRUFBRSxLQUFLLE1BQU07QUFDckQsUUFBSSxDQUFDQSxXQUFVQSxRQUFPLGNBQWU7QUFDckMsSUFBQUEsUUFBTyxLQUFLO0FBQ1osSUFBQUEsUUFBTyxNQUFNO0FBQ2IsMEJBQXNCQSxPQUFNO0FBQUEsRUFBQSxDQUM3QixFQUFFLE1BQU0sQ0FBTyxRQUFBO0FBQ2QsYUFBUyw0QkFBNEIsR0FBRztBQUN4QyxRQUFJLENBQUNBLFdBQVVBLFFBQU8sY0FBZTtBQUNyQyxJQUFBQSxRQUFPLEtBQUs7QUFDWixJQUFBQSxRQUFPLE1BQU07QUFDYiwwQkFBc0JBLE9BQU07QUFBQSxFQUFBLENBQzdCO0FBQ0g7QUFHQSxTQUFTLGtCQUFrQkEsU0FBMEM7QUFDbkUsTUFBSSxDQUFDQSxTQUFRO0FBQ1gsYUFBUyxrREFBa0Q7QUFDM0Q7QUFBQSxFQUFBO0FBS0s7QUFDTCwwQkFBc0JBLE9BQU07QUFBQSxFQUFBO0FBRWhDO0FBcUJBLE1BQU0sZ0JBQThDO0FBQUEsRUFDbEQsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsVUFBVTtBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUNBLFVBQVU7QUFBQSxJQUNSLE9BQU87QUFBQSxJQUNQLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxVQUFVO0FBQUEsSUFDVixXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsVUFBVTtBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUNBLFlBQVk7QUFBQSxJQUNWLE9BQU87QUFBQSxJQUNQLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxnQkFBZ0I7QUFBQSxJQUNkLE9BQU87QUFBQSxJQUNQLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxnQkFBZ0I7QUFBQSxJQUNkLE9BQU87QUFBQSxJQUNQLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFVBQVU7QUFBQSxJQUNWLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxFQUNUO0FBQUEsRUFDQSxrQkFBa0I7QUFBQSxJQUNoQixPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxVQUFVO0FBQUEsSUFDVixXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0Esa0JBQWtCO0FBQUEsSUFDaEIsT0FBTztBQUFBLElBQ1AsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsVUFBVTtBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLEVBQUE7QUFFWDtBQUdBLFNBQVMsZ0JBQWdCLE1BQTRCO0FBQzVDLFNBQUEsY0FBYyxJQUFJLEtBQUs7QUFBQSxJQUM1QixPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxPQUFPLGtCQUFrQixJQUFJO0FBQUEsRUFDL0I7QUFDRjtBQUVBLE1BQU0sVUFBMkIsQ0FBQztBQUdsQyxlQUFlLG1CQUFrRDtBQUMzRCxNQUFBO0FBRUYsVUFBTSxrQkFBa0JqQixnQkFBSyxLQUFLYyxhQUFJLFFBQVEsVUFBVSxHQUFHLGNBQWM7QUFFekUsUUFBSSxDQUFDYixjQUFHLFdBQVcsZUFBZSxHQUFHO0FBQ25DLGNBQVEseURBQXlEO0FBQzFELGFBQUEsRUFBRSxXQUFXLE1BQU07QUFBQSxJQUFBO0FBRzVCLFVBQU0sY0FBYyxLQUFLLE1BQU1BLGNBQUcsYUFBYSxpQkFBaUIsTUFBTSxDQUFDO0FBQ3ZFLFVBQU0sVUFBVSxZQUFZO0FBRTVCLFFBQUksQ0FBQyxXQUFXLENBQUNBLGNBQUcsV0FBVyxPQUFPLEdBQUc7QUFDdkMsY0FBUSxvREFBb0Q7QUFDckQsYUFBQSxFQUFFLFdBQVcsTUFBTTtBQUFBLElBQUE7QUFHNUIsVUFBTSxlQUFlRCxnQkFBSyxLQUFLLFNBQVMsZUFBZTtBQUN2RCxRQUFJLENBQUNDLGNBQUcsV0FBVyxZQUFZLEdBQUc7QUFDaEMsY0FBUSxtREFBbUQ7QUFDcEQsYUFBQSxFQUFFLFdBQVcsTUFBTTtBQUFBLElBQUE7QUFHckIsV0FBQSxFQUFFLFdBQVcsS0FBSztBQUFBLFdBQ2xCLE9BQU87QUFDZCxhQUFTLCtCQUErQixLQUFLO0FBQ3RDLFdBQUEsRUFBRSxXQUFXLE1BQU07QUFBQSxFQUFBO0FBRTlCO0FBR0EsU0FBUyxvQkFBb0I7QUFDM0IsVUFBUSx1QkFBdUI7QUFFekIsUUFBQSxhQUFhLGdCQUFnQixNQUFNO0FBQ25DLFFBQUEsY0FBYyxnQkFBZ0IsT0FBTztBQUczQyxRQUFNLGNBRUZELGdCQUFLLEtBQUssUUFBUSxZQUFZO0FBRTFCLFVBQUEsd0NBQXdDLFdBQVcsRUFBRTtBQUV2RCxRQUFBLGNBQWMsSUFBSWtCLHVCQUFjO0FBQUEsSUFDcEMsT0FBTyxXQUFXO0FBQUEsSUFDbEIsUUFBUSxXQUFXO0FBQUEsSUFDbkIsVUFBVSxXQUFXO0FBQUEsSUFDckIsV0FBVyxXQUFXO0FBQUEsSUFDdEIsUUFBUTtBQUFBLElBQ1IsTUFBTTtBQUFBLElBQ04saUJBQWlCO0FBQUEsSUFDakIsT0FBTyxZQUFZO0FBQUEsSUFDbkIsZUFBZTtBQUFBLElBQ2YsZ0JBQWdCO0FBQUEsTUFDZCxTQUFTO0FBQUEsTUFDVCxpQkFBaUI7QUFBQSxNQUNqQixrQkFBa0I7QUFBQSxJQUFBO0FBQUEsRUFDcEIsQ0FDRDtBQUVXLGNBQUEsU0FBUyxZQUFZLEtBQUs7QUFFMUIsY0FBQSxZQUFZLEdBQUcsbUJBQW1CLE1BQU07QUFDdEMsZ0JBQUEsU0FBUyxZQUFZLEtBQUs7QUFBQSxFQUFBLENBQ3ZDO0FBRVcsY0FBQSxLQUFLLGlCQUFpQixNQUFNO0FBQ3RDLGdCQUFZLEtBQUs7QUFDakIsZ0JBQVksTUFBTTtBQUFBLEVBQUEsQ0FDbkI7QUFPTTtBQUNMLGdCQUFZLFNBQVNsQixnQkFBSyxLQUFLLFdBQVcsb0JBQW9CLEdBQUcsRUFBRSxNQUFNLFFBQVMsQ0FBQSxFQUFFLE1BQU0sQ0FBTyxRQUFBO0FBQy9GLGVBQVMsNkJBQTZCLEdBQUc7QUFBQSxJQUFBLENBQzFDO0FBQUEsRUFBQTtBQUdILGNBQVksWUFBWSxxQkFBcUIsQ0FBQyxFQUFFLFVBQVU7QUFDeERnQixhQUFBQSxNQUFNLGFBQWEsR0FBRyxFQUFFLE1BQU0sQ0FBTyxRQUFBO0FBQzFCLGVBQUEsZ0NBQWdDLEdBQUcsSUFBSSxHQUFHO0FBQUEsSUFBQSxDQUNwRDtBQUNNLFdBQUEsRUFBRSxRQUFRLE9BQU87QUFBQSxFQUFBLENBQ3pCO0FBRUQsVUFBUSxRQUFRO0FBRVQsU0FBQTtBQUNUO0FBR0EsU0FBUyxxQkFBcUI7QUFDNUIsVUFBUSx3QkFBd0I7QUFDMUIsUUFBQSxTQUFTLGdCQUFnQixRQUFRO0FBR3ZDLFFBQU0sY0FFRmhCLGdCQUFLLEtBQUssUUFBUSxZQUFZO0FBRTFCLFVBQUEsdUJBQXVCLFdBQVcsRUFBRTtBQUV0QyxRQUFBLFNBQVMsSUFBSWtCLHVCQUFjO0FBQUEsSUFDL0IsT0FBTztBQUFBLElBQ1AsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsT0FBTztBQUFBLElBQ1AsYUFBYSxRQUFRLGFBQWE7QUFBQSxJQUNsQyxpQkFBaUIsUUFBUSxhQUFhLFVBQVUsWUFBWTtBQUFBLElBQzVELFdBQVc7QUFBQSxJQUNYLFNBQVM7QUFBQSxJQUNULE9BQU8sT0FBTztBQUFBLElBQ2QsTUFBTTtBQUFBLElBQ04sZ0JBQWdCO0FBQUEsTUFDZCxTQUFTO0FBQUEsTUFDVCxpQkFBaUI7QUFBQSxNQUNqQixrQkFBa0I7QUFBQSxNQUNsQixVQUFVO0FBQUEsSUFBQTtBQUFBLEVBQ1osQ0FDRDtBQU1NLFNBQUEsR0FBRyxTQUFTLENBQUMsVUFBVTtBQUM1QixRQUFJLE9BQU8sa0JBQWtCO0FBQzNCO0FBQUEsSUFBQTtBQUdGLFVBQU0sZUFBZTtBQUNyQkosYUFBQSxJQUFJLEtBQUssdUJBQThCO0FBQUEsRUFBQSxDQUN4QztBQUVNLFNBQUEsS0FBSyxpQkFBaUIsTUFBTTtBQUNqQyxXQUFPLEtBQUs7QUFBQSxFQUFBLENBQ2I7QUFNTTtBQUVMLFVBQU0sV0FBV2QsZ0JBQUssUUFBUSxRQUFRLG9CQUFvQjtBQUNsRCxZQUFBLDZCQUE2QixRQUFRLEVBQUU7QUFDeEMsV0FBQSxTQUFTLFVBQVUsRUFBRSxNQUFNLFVBQVUsRUFBRSxNQUFNLENBQU8sUUFBQTtBQUN6RCxlQUFTLDhCQUE4QixHQUFHO0FBQUEsSUFBQSxDQUMzQztBQUFBLEVBQUE7QUFHSCxVQUFRLFNBQVM7QUFFVixTQUFBO0FBQ1Q7QUFHQSxTQUFTLG1CQUFtQjtBQUMxQixVQUFRLHNCQUFzQjtBQUV4QixRQUFBLFNBQVMsZ0JBQWdCLE1BQU07QUFHckMsUUFBTSxjQUVGQSxnQkFBSyxLQUFLLFFBQVEsWUFBWTtBQUUxQixVQUFBLHVDQUF1QyxXQUFXLEVBQUU7QUFFdEQsUUFBQSxhQUFhLElBQUlrQix1QkFBYztBQUFBLElBQ25DLE9BQU8sT0FBTztBQUFBLElBQ2QsUUFBUSxPQUFPO0FBQUEsSUFDZixVQUFVLE9BQU87QUFBQSxJQUNqQixXQUFXLE9BQU87QUFBQSxJQUNsQixRQUFRO0FBQUEsSUFDUixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixpQkFBaUI7QUFBQSxJQUNqQixlQUFlO0FBQUEsSUFDZixPQUFPLE9BQU87QUFBQSxJQUNkLGdCQUFnQjtBQUFBLE1BQ2QsU0FBUztBQUFBLE1BQ1QsaUJBQWlCO0FBQUEsTUFDakIsa0JBQWtCO0FBQUEsSUFBQTtBQUFBLEVBQ3BCLENBQ0Q7QUFFVSxhQUFBLFNBQVMsT0FBTyxLQUFLO0FBRXJCLGFBQUEsWUFBWSxHQUFHLG1CQUFtQixNQUFNO0FBQ3RDLGVBQUEsU0FBUyxPQUFPLEtBQUs7QUFBQSxFQUFBLENBQ2pDO0FBR0QsTUFBSSx3QkFBd0I7QUFFakIsYUFBQSxHQUFHLFNBQVMsT0FBTyxVQUFVO0FBRXRDLFFBQUksdUJBQXVCO0FBQ3pCO0FBQUEsSUFBQTtBQUdGLFVBQU0sZUFBZTtBQUNHLDRCQUFBO0FBRWxCLFVBQUEsa0JBQWtCLE1BQU0scUJBQXFCLFVBQVU7QUFFN0QsUUFBSSxpQkFBaUI7QUFDbkIsY0FBUSx1Q0FBdUM7QUFDdkIsOEJBQUE7QUFDeEIsaUJBQVcsbUJBQW1CLE9BQU87QUFDckNKLGVBQUFBLElBQUksS0FBSztBQUFBLElBQUEsT0FDSjtBQUNMLGNBQVEsbUNBQW1DO0FBQ25CLDhCQUFBO0FBQUEsSUFBQTtBQUFBLEVBQzFCLENBQ0Q7QUFFRCxhQUFXLFlBQVkscUJBQXFCLENBQUMsRUFBRSxVQUFVO0FBQ3ZERSxhQUFBQSxNQUFNLGFBQWEsR0FBRyxFQUFFLE1BQU0sQ0FBTyxRQUFBO0FBQzFCLGVBQUEsZ0NBQWdDLEdBQUcsSUFBSSxHQUFHO0FBQUEsSUFBQSxDQUNwRDtBQUNNLFdBQUEsRUFBRSxRQUFRLE9BQU87QUFBQSxFQUFBLENBQ3pCO0FBRUQsVUFBUSxPQUFPO0FBRVIsU0FBQTtBQUNUO0FBR0EsU0FBUyxhQUFhLFlBQW9CLFVBQWUsSUFBSTtBQUNuRCxVQUFBLG9CQUFvQixVQUFVLEVBQUU7QUFFbEMsUUFBQSxnQkFBZ0IsZ0JBQWdCLFVBQVU7QUFHaEQsUUFBTSxjQUVGaEIsZ0JBQUssS0FBSyxRQUFRLFlBQVk7QUFFbEMsVUFBUSwwQkFBMEIsVUFBVSxZQUFZLFdBQVcsRUFBRTtBQUUvRCxRQUFBaUIsVUFBUyxJQUFJQyx1QkFBYztBQUFBLElBQy9CLE9BQU8sUUFBUSxTQUFTLGNBQWM7QUFBQSxJQUN0QyxRQUFRLFFBQVEsVUFBVSxjQUFjO0FBQUEsSUFDeEMsVUFBVSxRQUFRLFlBQVksY0FBYztBQUFBLElBQzVDLFdBQVcsUUFBUSxhQUFhLGNBQWM7QUFBQSxJQUM5QyxXQUFXLFFBQVEsZUFBZSxXQUFXLElBQUksUUFBUSxZQUFZLGNBQWM7QUFBQSxJQUNuRixRQUFRO0FBQUEsSUFDUixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxPQUFPLFFBQVEsU0FBUyxjQUFjO0FBQUEsSUFDdEMsaUJBQWlCLFFBQVEsYUFBYTtBQUFBLElBQ3RDLGVBQWU7QUFBQSxJQUNmLE9BQU8sUUFBUSxVQUFVO0FBQUEsSUFDekIsaUJBQWlCO0FBQUEsSUFDakIsUUFBUSxRQUFRLFVBQVUsUUFBUSxRQUFRLE1BQU0sSUFBSSxRQUFRLFFBQVEsTUFBTSxJQUFJO0FBQUEsSUFDOUUsZ0JBQWdCO0FBQUEsTUFDZCxTQUFTO0FBQUEsTUFDVCxpQkFBaUI7QUFBQSxNQUNqQixrQkFBa0I7QUFBQSxNQUNsQixxQkFBcUIsUUFBUSxPQUFPLENBQUMsaUJBQWlCLEtBQUssVUFBVSxRQUFRLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQTtBQUFBLElBQUM7QUFBQSxFQUMzRixDQUNEO0FBRUssUUFBQSxjQUFjLFFBQVEsU0FBUyxjQUFjO0FBQ25ELEVBQUFELFFBQU8sU0FBUyxXQUFXO0FBRXBCLEVBQUFBLFFBQUEsWUFBWSxHQUFHLG1CQUFtQixNQUFNO0FBQzdDLElBQUFBLFFBQU8sU0FBUyxXQUFXO0FBQUEsRUFBQSxDQUM1QjtBQUVHLE1BQUEsQ0FBQyxRQUFRLE9BQU87QUFDbEIsSUFBQUEsUUFBTyxnQkFBZ0IsSUFBSTtBQUFBLEVBQUE7QUFHdEIsRUFBQUEsUUFBQSxLQUFLLGlCQUFpQixNQUFNO0FBQzdCLFFBQUEsQ0FBQ0EsUUFBTyxlQUFlO0FBQ3pCLE1BQUFBLFFBQU8sS0FBSztBQUFBLElBQUE7QUFBQSxFQUNkLENBQ0Q7QUFhTTtBQUNMLElBQUFBLFFBQU8sU0FBU2pCLGdCQUFLLEtBQUssUUFBUSxvQkFBb0IsR0FBRyxFQUFFLE1BQU0sV0FBWSxDQUFBLEVBQUUsTUFBTSxDQUFPLFFBQUE7QUFDakYsZUFBQSxrQkFBa0IsVUFBVSxTQUFTLEdBQUc7QUFDN0MsVUFBQSxDQUFDaUIsUUFBTyxlQUFlO0FBQ3pCLFFBQUFBLFFBQU8sS0FBSztBQUFBLE1BQUE7QUFBQSxJQUNkLENBQ0Q7QUFBQSxFQUFBO0FBR0gsVUFBUSxVQUFVLElBQUlBO0FBR3JCLEVBQUFBLFFBQWUsWUFBWTtBQUc1QixRQUFNLGdCQUFnQkEsUUFBTyxNQUFNLEtBQUtBLE9BQU07QUFDN0MsRUFBQUEsUUFBZSxnQkFBZ0I7QUFDaEMsRUFBQUEsUUFBTyxRQUFRLFdBQVc7QUFDeEIsUUFBSUEsUUFBTyxpQkFBa0JBLFFBQWUsV0FBVztBQUNyRCxhQUFPLGNBQWM7QUFBQSxJQUFBO0FBR3RCLElBQUFBLFFBQWUsWUFBWTtBQUU1QixRQUFJLENBQUNBLFFBQU8saUJBQWlCQSxRQUFPLGFBQWE7QUFDeEMsTUFBQUEsUUFBQSxZQUFZLEtBQUssaUJBQWlCO0FBRWpDTCx1QkFBQSxLQUFLLDJCQUEyQixNQUFNO0FBQzVDLFlBQUksVUFBVTtBQUNkLGNBQU0sV0FBVztBQUNYLGNBQUEsZUFBZSxZQUFZLE1BQU07QUFDakMsY0FBQUssUUFBTyxlQUFlO0FBQ3hCLDBCQUFjLFlBQVk7QUFDMUI7QUFBQSxVQUFBO0FBR1MscUJBQUE7QUFDWCxjQUFJLFdBQVcsR0FBRztBQUNoQiwwQkFBYyxZQUFZO0FBQ3RCLGdCQUFBLENBQUNBLFFBQU8sZUFBZTtBQUNYLDRCQUFBO0FBQUEsWUFBQTtBQUFBLFVBQ2hCLE9BQ0s7QUFDTCxZQUFBQSxRQUFPLFdBQVcsT0FBTztBQUFBLFVBQUE7QUFBQSxXQUUxQixFQUFFO0FBQUEsTUFBQSxDQUNOO0FBRUQsaUJBQVcsTUFBTTtBQUNmLFlBQUksQ0FBQ0EsUUFBTyxpQkFBa0JBLFFBQWUsV0FBVztBQUN4Qyx3QkFBQTtBQUFBLFFBQUE7QUFBQSxTQUVmLEdBQUc7QUFBQSxJQUFBLE9BQ0Q7QUFDUyxvQkFBQTtBQUFBLElBQUE7QUFFVCxXQUFBO0FBQUEsRUFDVDtBQUVPLEVBQUFBLFFBQUEsR0FBRyxTQUFTLENBQUMsVUFBVTtBQUN4QixRQUFBLENBQUVBLFFBQWUsV0FBVztBQUM5QixZQUFNLGVBQWU7QUFDckIsTUFBQUEsUUFBTyxNQUFNO0FBQUEsSUFBQTtBQUFBLEVBQ2YsQ0FDRDtBQUVNLEVBQUFBLFFBQUEsR0FBRyxVQUFVLE1BQU07QUFDeEIsWUFBUSxVQUFVLElBQUk7QUFBQSxFQUFBLENBQ3ZCO0FBRU0sU0FBQUE7QUFDVDtBQUVBLFNBQVMsaUJBQWlCO0FBQ3hCLFVBQVEsZ0NBQWdDO0FBRXBDLE1BQUE7QUFDRixXQUFPLG1CQUFtQjtBQUUxQixVQUFNLGFBQWEsUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLFlBQVk7QUFDN0QsVUFBTSxlQUFlLFFBQVEsVUFBVSxDQUFDLFFBQVEsT0FBTyxZQUFZO0FBRS9ELFFBQUEsY0FBYyxRQUFRLE1BQU07QUFDOUIsY0FBUSxLQUFLLEtBQUs7QUFFZCxVQUFBLGdCQUFnQixRQUFRLFFBQVE7QUFDbEMsWUFBSSxnQkFBZ0I7QUFDZCxjQUFBLGVBQWUsWUFBWSxNQUFNO0FBQ3BCLDJCQUFBO0FBRWpCLGNBQUksaUJBQWlCLEdBQUc7QUFDdEIsMEJBQWMsWUFBWTtBQUUxQixnQkFBSSxRQUFRLFVBQVUsQ0FBQyxRQUFRLE9BQU8sZUFBZTtBQUMvQyxrQkFBQTtBQUNGLHdCQUFRLE9BQU8sTUFBTTtBQUVyQiwyQkFBVyxNQUFNO0FBQ2Ysc0JBQUksUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWU7QUFDL0MsMEJBQU0sYUFBYSxRQUFRO0FBQzNCLHdCQUFJLGNBQWMsQ0FBQyxXQUFXLGVBQWU7QUFDM0Msd0NBQWtCLFVBQVU7QUFBQSxvQkFBQTtBQUFBLGtCQUM5QjtBQUFBLG1CQUVELEdBQUc7QUFBQSx1QkFDQyxLQUFLO0FBQ1oseUJBQVMsK0JBQStCLEdBQUc7QUFDM0Msb0JBQUksUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWU7QUFDL0Msd0JBQU0sYUFBYSxRQUFRO0FBQzNCLG9DQUFrQixVQUFVO0FBQUEsZ0JBQUE7QUFBQSxjQUM5QjtBQUFBLFlBQ0YsT0FDSztBQUNMLGtCQUFJLFFBQVEsUUFBUSxDQUFDLFFBQVEsS0FBSyxlQUFlO0FBQy9DLHNCQUFNLGFBQWEsUUFBUTtBQUMzQixrQ0FBa0IsVUFBVTtBQUFBLGNBQUE7QUFBQSxZQUM5QjtBQUFBLFVBQ0YsV0FDUyxRQUFRLFVBQVUsQ0FBQyxRQUFRLE9BQU8sZUFBZTtBQUNsRCxvQkFBQSxPQUFPLFdBQVcsYUFBYTtBQUFBLFVBQUEsT0FDbEM7QUFDTCwwQkFBYyxZQUFZO0FBQzFCLGdCQUFJLFFBQVEsUUFBUSxDQUFDLFFBQVEsS0FBSyxlQUFlO0FBQy9DLG9CQUFNLGFBQWEsUUFBUTtBQUMzQixnQ0FBa0IsVUFBVTtBQUFBLFlBQUE7QUFBQSxVQUM5QjtBQUFBLFdBRUQsRUFBRTtBQUFBLE1BQUEsT0FDQTtBQUNMLFlBQUksUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWU7QUFDL0MsZ0JBQU0sYUFBYSxRQUFRO0FBQzNCLDRCQUFrQixVQUFVO0FBQUEsUUFBQTtBQUFBLE1BQzlCO0FBR0YsaUJBQVcsTUFBTTtBQUNmLGVBQU8sbUJBQW1CO0FBQUEsU0FDekIsR0FBSTtBQUFBLElBQUEsT0FFRjtBQUNMLFlBQU0sVUFBVSxpQkFBaUI7QUFFN0IsVUFBQSxnQkFBZ0IsUUFBUSxRQUFRO0FBQzlCLFlBQUE7QUFDRixjQUFJLGdCQUFnQjtBQUNkLGdCQUFBLGVBQWUsWUFBWSxNQUFNO0FBQ3BCLDZCQUFBO0FBRWpCLGdCQUFJLGlCQUFpQixHQUFHO0FBQ3RCLDRCQUFjLFlBQVk7QUFDMUIsa0JBQUksUUFBUSxVQUFVLENBQUMsUUFBUSxPQUFPLGVBQWU7QUFDbkQsd0JBQVEsT0FBTyxNQUFNO0FBQ3JCLDJCQUFXLE1BQU07QUFDZixvQ0FBa0IsT0FBTztBQUFBLG1CQUN4QixFQUFFO0FBQUEsY0FBQSxPQUNBO0FBQ0wsa0NBQWtCLE9BQU87QUFBQSxjQUFBO0FBQUEsWUFDM0IsV0FDUyxRQUFRLFVBQVUsQ0FBQyxRQUFRLE9BQU8sZUFBZTtBQUNsRCxzQkFBQSxPQUFPLFdBQVcsYUFBYTtBQUFBLFlBQUEsT0FDbEM7QUFDTCw0QkFBYyxZQUFZO0FBQzFCLGdDQUFrQixPQUFPO0FBQUEsWUFBQTtBQUFBLGFBRTFCLEVBQUU7QUFBQSxpQkFDRSxLQUFLO0FBQ1osbUJBQVMsK0JBQStCLEdBQUc7QUFDdkMsY0FBQSxDQUFDLFFBQVEsZUFBZTtBQUMxQixvQkFBUSxLQUFLO0FBQ2Isa0NBQXNCLE9BQU87QUFBQSxVQUFBO0FBQUEsUUFDL0I7QUFBQSxNQUNGLE9BQ0s7QUFDTCxnQkFBUSxLQUFLO0FBQ2IsOEJBQXNCLE9BQU87QUFBQSxNQUFBO0FBQUEsSUFDL0I7QUFBQSxXQUVLLE9BQU87QUFDZCxhQUFTLDJCQUEyQixLQUFLO0FBQ3JDLFFBQUE7QUFDRixZQUFNLFVBQVUsaUJBQWlCO0FBRWpDLFVBQUksUUFBUSxVQUFVLENBQUMsUUFBUSxPQUFPLGVBQWU7QUFDL0MsWUFBQTtBQUNGLGtCQUFRLE9BQU8sTUFBTTtBQUNyQixxQkFBVyxNQUFNO0FBQ2Ysb0JBQVEsS0FBSztBQUNiLGtDQUFzQixPQUFPO0FBQUEsYUFDNUIsR0FBRztBQUFBLGlCQUNDLEtBQUs7QUFDWixtQkFBUywrQkFBK0IsR0FBRztBQUMzQyxrQkFBUSxLQUFLO0FBQ2IsZ0NBQXNCLE9BQU87QUFBQSxRQUFBO0FBQUEsTUFDL0IsT0FDSztBQUNMLGdCQUFRLEtBQUs7QUFDYiw4QkFBc0IsT0FBTztBQUFBLE1BQUE7QUFBQSxhQUV4QixlQUFlO0FBQ3RCLGVBQVMseUNBQXlDLGFBQWE7QUFBQSxJQUFBO0FBQUEsRUFDakU7QUFFSjtBQUdBLFNBQVMsZ0JBQWdCO0FBQ25CLE1BQUEsUUFBUSxhQUFhLFNBQVU7QUFFbkMsVUFBUSxpQ0FBaUM7QUFFekMsUUFBTSxXQUFrRDtBQUFBLElBQ3REO0FBQUEsTUFDRSxPQUFPSCxTQUFJLElBQUE7QUFBQSxNQUNYLFNBQVM7QUFBQSxRQUNQLEVBQUUsTUFBTSxRQUFRO0FBQUEsUUFDaEIsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQjtBQUFBLFVBQ0UsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFVBQ2IsT0FBTyxNQUFNO0FBQ1gsZ0JBQUksUUFBUSxZQUFZLENBQUMsUUFBUSxTQUFTLGVBQWU7QUFDdkQsc0JBQVEsU0FBUyxNQUFNO0FBQUEsWUFBQSxPQUNsQjtBQUNMLDJCQUFhLFVBQVU7QUFBQSxZQUFBO0FBQUEsVUFDekI7QUFBQSxRQUVKO0FBQUEsUUFDQSxFQUFFLE1BQU0sWUFBWTtBQUFBLFFBQ3BCLEVBQUUsTUFBTSxXQUFXO0FBQUEsUUFDbkIsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQixFQUFFLE1BQU0sT0FBTztBQUFBLFFBQ2YsRUFBRSxNQUFNLGFBQWE7QUFBQSxRQUNyQixFQUFFLE1BQU0sU0FBUztBQUFBLFFBQ2pCLEVBQUUsTUFBTSxZQUFZO0FBQUEsUUFDcEIsRUFBRSxNQUFNLE9BQU87QUFBQSxNQUFBO0FBQUEsSUFFbkI7QUFBQSxJQUNBO0FBQUEsTUFDRSxPQUFPO0FBQUEsTUFDUCxTQUFTO0FBQUEsUUFDUDtBQUFBLFVBQ0UsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFVBQ2IsT0FBTyxNQUFNO0FBQ1gsZ0JBQUksUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWU7QUFDL0MsMkJBQWEsY0FBYztBQUFBLFlBQUE7QUFBQSxVQUM3QjtBQUFBLFFBRUo7QUFBQSxRQUNBO0FBQUEsVUFDRSxPQUFPO0FBQUEsVUFDUCxhQUFhO0FBQUEsVUFDYixPQUFPLE1BQU07QUFDWCxnQkFBSSxRQUFRLFFBQVEsQ0FBQyxRQUFRLEtBQUssZUFBZTtBQUMvQywyQkFBYSxjQUFjO0FBQUEsWUFBQTtBQUFBLFVBQzdCO0FBQUEsUUFFSjtBQUFBLFFBQ0EsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQixFQUFFLE1BQU0sUUFBUTtBQUFBLE1BQUE7QUFBQSxJQUVwQjtBQUFBLElBQ0E7QUFBQSxNQUNFLE9BQU87QUFBQSxNQUNQLFNBQVM7QUFBQSxRQUNQLEVBQUUsTUFBTSxPQUFPO0FBQUEsUUFDZixFQUFFLE1BQU0sT0FBTztBQUFBLFFBQ2YsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQixFQUFFLE1BQU0sTUFBTTtBQUFBLFFBQ2QsRUFBRSxNQUFNLE9BQU87QUFBQSxRQUNmLEVBQUUsTUFBTSxRQUFRO0FBQUEsUUFDaEIsRUFBRSxNQUFNLFNBQVM7QUFBQSxRQUNqQixFQUFFLE1BQU0sWUFBWTtBQUFBLFFBQ3BCLEVBQUUsTUFBTSxZQUFZO0FBQUEsTUFBQTtBQUFBLElBRXhCO0FBQUEsSUFDQTtBQUFBLE1BQ0UsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLFFBQ1AsRUFBRSxNQUFNLFNBQVM7QUFBQSxRQUNqQixFQUFFLE1BQU0sY0FBYztBQUFBLFFBQ3RCLEVBQUUsTUFBTSxZQUFZO0FBQUEsUUFDcEIsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQixFQUFFLE1BQU0sU0FBUztBQUFBLFFBQ2pCLEVBQUUsTUFBTSxVQUFVO0FBQUEsUUFDbEIsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQixFQUFFLE1BQU0sbUJBQW1CO0FBQUEsTUFBQTtBQUFBLElBRS9CO0FBQUEsSUFDQTtBQUFBLE1BQ0UsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLFFBQ1AsRUFBRSxNQUFNLFdBQVc7QUFBQSxRQUNuQixFQUFFLE1BQU0sT0FBTztBQUFBLFFBQ2YsRUFBRSxNQUFNLFlBQVk7QUFBQSxRQUNwQixFQUFFLE1BQU0sUUFBUTtBQUFBLFFBQ2hCLEVBQUUsTUFBTSxZQUFZO0FBQUEsUUFDcEIsRUFBRSxNQUFNLFNBQVM7QUFBQSxNQUFBO0FBQUEsSUFFckI7QUFBQSxJQUNBO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsUUFDUDtBQUFBLFVBQ0UsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFVBQ2IsT0FBTyxNQUFNO0FBQ1gsZ0JBQUksUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWU7QUFDL0Msc0JBQVEsS0FBSyxNQUFNO0FBQUEsWUFBQSxPQUNkO0FBQ0wsMkJBQWEsTUFBTTtBQUFBLFlBQUE7QUFBQSxVQUNyQjtBQUFBLFFBRUo7QUFBQSxRQUNBLEVBQUUsTUFBTSxZQUFZO0FBQUEsUUFDcEI7QUFBQSxVQUNFLE9BQU87QUFBQSxVQUNQLE9BQU8sWUFBWTs7QUFDYixnQkFBQTtBQUNGLG9CQUFNLFFBQVE7QUFBQSxnQkFDWixTQUFRLGFBQVEsU0FBUixtQkFBYztBQUFBLGNBQ3hCO0FBR00sb0JBQUEsV0FBVSxrQkFBYSxhQUFiLG1CQUF3QjtBQUN4QyxrQkFBSSxTQUFTO0FBQ0xDLHNCQUFBQSxlQUFjLE1BQU0sUUFBUSxLQUFLO0FBQ3ZDLG9CQUFJQSxjQUFhO0FBQ1Qsd0JBQUFDLFNBQUEsTUFBTSxTQUFTRCxZQUFXO0FBQUEsZ0JBQUEsT0FDM0I7QUFDTEYsMkJBQUFBLE9BQU8sZUFBZTtBQUFBLG9CQUNwQixNQUFNO0FBQUEsb0JBQ04sT0FBTztBQUFBLG9CQUNQLFNBQVM7QUFBQSxrQkFBQSxDQUNWO0FBQUEsZ0JBQUE7QUFBQSxjQUNIO0FBQUEscUJBRUssT0FBTztBQUNkLHVCQUFTLGtDQUFrQyxLQUFLO0FBQUEsWUFBQTtBQUFBLFVBQ2xEO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFFSjtBQUVNLFFBQUEsT0FBT00sU0FBQUEsS0FBSyxrQkFBa0IsUUFBUTtBQUM1Q0EsV0FBQSxLQUFLLG1CQUFtQixJQUFJO0FBQzlCO0FBRUFMLFNBQUFBLElBQUksVUFBQSxFQUFZLEtBQUssWUFBWTtBQUVuQixjQUFBO0FBRVosVUFBUSxvQ0FBb0M7QUFFNUMsb0JBQWtCLGVBQWU7QUFDakMsTUFBSSxpQkFBaUI7QUFDWCxZQUFBLHNDQUFzQyxlQUFlLEVBQUU7QUFBQSxFQUFBO0FBRzNDLHdCQUFBO0FBQ1IsZ0JBQUE7QUFLZEYsV0FBQUEsUUFBUSxHQUFHLG1CQUFtQixPQUFPLE9BQU8sU0FBUztBQUNuRCxZQUFRLGtEQUFrRDtBQUV0RCxRQUFBO0FBQ0YsWUFBTSxvQkFBb0IsWUFBWTtBQUNwQyxlQUFPLElBQUksUUFBYSxDQUFDLFNBQVMsV0FBVztBQUNyQyxnQkFBQSxVQUFVLFdBQVcsTUFBTTtBQUN4QixtQkFBQSxJQUFJLE1BQU0sMkVBQTJFLENBQUM7QUFBQSxhQUM1RixHQUFLO0FBRVIsZ0JBQU0sZ0JBQWdCLFlBQVk7QUFDNUIsZ0JBQUE7QUFDRSxrQkFBQSxLQUFLLGlCQUFpQixZQUFZO0FBQ3BDLHVCQUFPLE1BQU0scUJBQXFCO0FBQUEsa0JBQzlCLEtBQUs7QUFBQSxrQkFDTCxLQUFLO0FBQUEsa0JBQ0wsU0FBUyxLQUFLLE1BQU0sRUFBRSxLQUFLO0FBQUEsa0JBQzNCLEtBQUssWUFBWTtBQUFBLGtCQUNqQixLQUFLLFlBQVk7QUFBQSxnQkFDckI7QUFBQSxjQUFBLE9BQ0s7QUFDTCx1QkFBTyxNQUFNLHFCQUFxQjtBQUFBLGtCQUM5QixLQUFLO0FBQUEsa0JBQ0wsS0FBSztBQUFBLGtCQUNMLEtBQUs7QUFBQSxrQkFDTCxLQUFLO0FBQUEsa0JBQ0wsS0FBSztBQUFBLGtCQUNMLFNBQVMsS0FBSyxNQUFNLEVBQUUsS0FBSztBQUFBLGtCQUMzQixLQUFLO0FBQUEsa0JBQ0wsS0FBSztBQUFBLGtCQUNMLEtBQUs7QUFBQSxrQkFDTCxLQUFLO0FBQUEsa0JBQ0wsS0FBSztBQUFBLGtCQUNMLEtBQUs7QUFBQSxnQkFDVDtBQUFBLGNBQUE7QUFBQSxxQkFFSyxPQUFPO0FBQ2QsdUJBQVMsd0NBQXdDLEtBQUs7QUFDaEQsb0JBQUE7QUFBQSxZQUFBO0FBQUEsVUFFVjtBQUVjLHdCQUFBLEVBQ1QsS0FBSyxDQUFPLFFBQUE7QUFDWCx5QkFBYSxPQUFPO0FBQ3BCLG9CQUFRLEdBQUc7QUFBQSxVQUFBLENBQ1osRUFDQSxNQUFNLENBQU8sUUFBQTtBQUNaLHlCQUFhLE9BQU87QUFDcEIsbUJBQU8sR0FBRztBQUFBLFVBQUEsQ0FDWDtBQUFBLFFBQUEsQ0FDTjtBQUFBLE1BQ0g7QUFFTSxZQUFBLFNBQVMsTUFBTSxrQkFBa0I7QUFDdkMsY0FBUSxzREFBc0Q7QUFFOUQsVUFBSSxPQUFPLFNBQVM7QUFDWixjQUFBLE9BQU8sS0FBSyxvQkFBb0I7QUFBQSxVQUNwQyxHQUFHO0FBQUEsVUFDSCxNQUFNLE9BQU87QUFBQSxVQUNiLGNBQWMsS0FBSztBQUFBLFFBQUEsQ0FDcEI7QUFFRyxZQUFBLFFBQVEsUUFBUSxDQUFDLFFBQVEsS0FBSyxpQkFDOUIsTUFBTSxXQUFXLFFBQVEsS0FBSyxhQUFhO0FBQ3JDLGtCQUFBLEtBQUssWUFBWSxLQUFLLG9CQUFvQjtBQUFBLFlBQ2hELEdBQUc7QUFBQSxZQUNILE1BQU0sT0FBTztBQUFBLFlBQ2IsY0FBYyxLQUFLO0FBQUEsVUFBQSxDQUNwQjtBQUFBLFFBQUE7QUFBQSxNQUNILE9BQ0s7QUFDSSxpQkFBQSwyQkFBMkIsT0FBTyxPQUFPO0FBQzVDLGNBQUEsT0FBTyxLQUFLLDJCQUEyQjtBQUFBLFVBQzNDLGNBQWMsS0FBSztBQUFBLFVBQ25CLE9BQU8sT0FBTyxXQUFXO0FBQUEsUUFBQSxDQUMxQjtBQUFBLE1BQUE7QUFBQSxhQUVJLE9BQU87QUFDZCxlQUFTLDRDQUE0QyxLQUFLO0FBQ3BELFlBQUEsT0FBTyxLQUFLLDJCQUEyQjtBQUFBLFFBQzNDLGNBQWMsS0FBSyxnQkFBZ0I7QUFBQSxRQUNuQyxPQUFPLGlCQUFpQixRQUFRLE1BQU0sVUFBVTtBQUFBLE1BQUEsQ0FDakQ7QUFBQSxJQUFBO0FBQUEsRUFDSCxDQUNEO0FBR0RBLFdBQUFBLFFBQVEsT0FBTywrQkFBK0IsT0FBTyxRQUFRLFNBQVM7QUFDcEUsWUFBUSx1REFBdUQ7QUFDM0QsUUFBQTtBQUNGLFlBQU0sRUFBRSxjQUFjLFVBQVUsU0FBYSxJQUFBO0FBQzdDLFlBQU0sU0FBUyxNQUFNLHFCQUFxQiwwQkFBMEIsY0FBYyxVQUFVLFFBQVE7QUFFcEcsVUFBSSxPQUFPLG9CQUFvQixPQUFPLGlCQUFpQixTQUFTLEdBQUc7QUFDakUsZ0JBQVEseUNBQXlDLE9BQU8saUJBQWlCLE1BQU0sMkJBQTJCO0FBQUEsTUFBQTtBQUdyRyxhQUFBO0FBQUEsYUFDQSxPQUFPO0FBQ2QsZUFBUyw0REFBNEQsS0FBSztBQUNuRSxhQUFBO0FBQUEsUUFDTCxTQUFTO0FBQUEsUUFDVCxTQUFTLGlCQUFpQixRQUFRLE1BQU0sVUFBVTtBQUFBLE1BQ3BEO0FBQUEsSUFBQTtBQUFBLEVBQ0YsQ0FDRDtBQUVELFVBQVEsbUNBQW1DO0FBRTNDLFFBQU0sRUFBRSxjQUFjLE1BQU0saUJBQWlCO0FBRTdDLE1BQUksQ0FBQyxXQUFXO0FBQ2QsWUFBUSw4Q0FBOEM7QUFFdEQsVUFBTSxjQUFjLGtCQUFrQjtBQUVoQyxVQUFBLGFBQWEsZ0JBQWdCLE1BQU07QUFDekMsZ0JBQVksUUFBUSxXQUFXLE9BQU8sV0FBVyxNQUFNO0FBQ25ELFFBQUEsV0FBVyxZQUFZLFdBQVcsV0FBVztBQUMvQyxrQkFBWSxlQUFlLFdBQVcsVUFBVSxXQUFXLFNBQVM7QUFBQSxJQUFBO0FBRXRFLGdCQUFZLE9BQU87QUFBQSxFQUFBLE9BRWhCO0FBQ0gsWUFBUSwwQ0FBMEM7QUFFL0IsdUJBQUE7QUFDRixxQkFBQTtBQUNILGtCQUFBO0FBRVZFLGlCQUFBLFlBQVkseUJBQWdDLE1BQU07QUFDcEQsY0FBUSxrREFBa0Q7QUFDM0MscUJBQUE7QUFBQSxJQUFBLENBQ2hCO0FBRU9GLHFCQUFBLEdBQUcseUJBQXlCLE1BQU07QUFDeEMsY0FBUSxrREFBa0Q7QUFDM0MscUJBQUE7QUFBQSxJQUFBLENBQ2hCO0FBQUEsRUFBQTtBQUdIQSxXQUFBLFFBQVEsR0FBRyxjQUFjLENBQUMsUUFBUSxFQUFFLE1BQU0sYUFBYTtBQUNyRCxRQUFJLE9BQU8sdUJBQXVCO0FBQ2hDLGNBQVEsc0NBQXNDLElBQUksU0FBUyxVQUFVLFNBQVMsRUFBRTtBQUNoRjtBQUFBLElBQUE7QUFHRixXQUFPLHdCQUF3QjtBQUUvQixZQUFRLGlDQUFpQyxJQUFJLFNBQVMsVUFBVSxTQUFTLEVBQUU7QUFFdkUsUUFBQSxPQUFPLHFCQUFxQixNQUFNO0FBQ3BDLGFBQU8sbUJBQW1CO0FBRVpNLGVBQUFBLGNBQUEsY0FBYyxFQUFFLFFBQVEsQ0FBVUQsWUFBQTtBQUMxQyxZQUFBLENBQUNBLFFBQU8sZUFBZTtBQUN6QixjQUFJLFVBQVVBLFFBQU8sWUFBWSxPQUFPLFNBQVMsTUFBTSxHQUFHO0FBQ2hELG9CQUFBLDJDQUEyQyxNQUFNLEVBQUU7QUFBQSxVQUFBLE9BQ3REO0FBQ0UsWUFBQUEsUUFBQSxZQUFZLEtBQUssaUJBQWlCLElBQUk7QUFBQSxVQUFBO0FBQUEsUUFDL0M7QUFBQSxNQUNGLENBQ0Q7QUFBQSxJQUFBLE9BQ0k7QUFDRyxjQUFBLHdCQUF3QixJQUFJLHVCQUF1QjtBQUFBLElBQUE7QUFHN0QsZUFBVyxNQUFNO0FBQ2YsYUFBTyx3QkFBd0I7QUFBQSxPQUM5QixHQUFHO0FBQUEsRUFBQSxDQUNQO0FBR09MLG1CQUFBLEdBQUcsYUFBYSxDQUFDLE9BQU8sRUFBRSxjQUFjLGNBQWMsZUFBZTtBQUMzRSxZQUFRLDhCQUE4QixZQUFZLFdBQVcsUUFBUSxFQUFFO0FBRW5FLFFBQUE7QUFDSSxZQUFBLGNBQWNFLFNBQUFBLElBQUksUUFBUSxVQUFVO0FBQzFDLFlBQU0sV0FBV2QsZ0JBQUssS0FBSyxhQUFhLGNBQWMsY0FBYyxRQUFRO0FBRXhFLFVBQUFDLGNBQUcsV0FBVyxRQUFRLEdBQUc7QUFDM0JlLGlCQUFBQSxNQUFNLFNBQVMsUUFBUSxFQUFFLE1BQU0sQ0FBTyxRQUFBO0FBQ3BDLG1CQUFTLHNCQUFzQixHQUFHO0FBQzVCLGdCQUFBLE9BQU8sS0FBSyxxQkFBcUI7QUFBQSxZQUNyQyxPQUFPO0FBQUEsWUFDUCxTQUFTLHdCQUF3QixJQUFJLE9BQU87QUFBQSxVQUFBLENBQzdDO0FBQUEsUUFBQSxDQUNGO0FBQUEsTUFBQSxPQUNJO0FBQ0wsY0FBTSxrQkFBa0JoQixnQkFBSyxLQUFLYyxhQUFJLFFBQVEsVUFBVSxHQUFHLGNBQWM7QUFDckUsWUFBQWIsY0FBRyxXQUFXLGVBQWUsR0FBRztBQUM5QixjQUFBO0FBQ0Ysa0JBQU0sY0FBYyxLQUFLLE1BQU1BLGNBQUcsYUFBYSxpQkFBaUIsTUFBTSxDQUFDO0FBQ3ZFLGtCQUFNLGtCQUFrQkQsZ0JBQUssS0FBSyxZQUFZLFNBQVMsY0FBYyxjQUFjLFFBQVE7QUFFdkYsZ0JBQUFDLGNBQUcsV0FBVyxlQUFlLEdBQUc7QUFDbENlLHVCQUFBQSxNQUFNLFNBQVMsZUFBZSxFQUFFLE1BQU0sQ0FBTyxRQUFBO0FBQzNDLHlCQUFTLHNCQUFzQixHQUFHO0FBQzVCLHNCQUFBLE9BQU8sS0FBSyxxQkFBcUI7QUFBQSxrQkFDckMsT0FBTztBQUFBLGtCQUNQLFNBQVMsd0JBQXdCLElBQUksT0FBTztBQUFBLGdCQUFBLENBQzdDO0FBQUEsY0FBQSxDQUNGO0FBQUEsWUFBQSxPQUNJO0FBQ0Msb0JBQUEsT0FBTyxLQUFLLHFCQUFxQjtBQUFBLGdCQUNyQyxPQUFPO0FBQUEsZ0JBQ1AsU0FBUyx3QkFBd0IsUUFBUTtBQUFBLGNBQUEsQ0FDMUM7QUFBQSxZQUFBO0FBQUEsbUJBRUksT0FBTztBQUNkLHFCQUFTLDhCQUE4QixLQUFLO0FBQ3RDLGtCQUFBLE9BQU8sS0FBSyxxQkFBcUI7QUFBQSxjQUNyQyxPQUFPO0FBQUEsY0FDUCxTQUFTO0FBQUEsWUFBQSxDQUNWO0FBQUEsVUFBQTtBQUFBLFFBQ0g7QUFBQSxNQUNGO0FBQUEsYUFFSyxPQUFPO0FBQ2QsZUFBUyxvQ0FBb0MsS0FBSztBQUM1QyxZQUFBLE9BQU8sS0FBSyxxQkFBcUI7QUFBQSxRQUNyQyxPQUFPO0FBQUEsUUFDUCxTQUFTLHdCQUF3QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUFBLENBQ3hGO0FBQUEsSUFBQTtBQUFBLEVBQ0gsQ0FDRDtBQUdESixXQUFBLFFBQVEsT0FBTyxzQkFBc0IsT0FBTyxRQUFRLEVBQUUsY0FBYyxlQUFlO0FBQ2pGLFlBQVEsb0NBQW9DLFlBQVksWUFBWSxRQUFRLEVBQUU7QUFFMUUsUUFBQTtBQUNGLFlBQU0sY0FBYyxNQUFNLGdCQUFnQixlQUFvQixLQUFBRSxTQUFBLElBQUksUUFBUSxVQUFVO0FBQ3BGLFlBQU0sY0FBY2QsZ0JBQUssS0FBSyxhQUFhLFFBQVEsWUFBWTtBQUMvRCxZQUFNLGFBQWFBLGdCQUFLLEtBQUssYUFBYSxVQUFVLFdBQVc7QUFFL0QsVUFBSSxDQUFDQyxjQUFHLFdBQVcsVUFBVSxHQUFHO0FBQzlCLGVBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyx3QkFBd0I7QUFBQSxNQUFBO0FBRzVELFVBQUksZ0JBQWdCQSxjQUFHLGFBQWEsWUFBWSxNQUFNO0FBRXRELFVBQUksVUFBVTtBQUNSLFlBQUEsY0FBYyxTQUFTLFlBQVksR0FBRztBQUN4QywwQkFBZ0IsY0FBYyxRQUFRLGtCQUFrQixlQUFlLFlBQVk7QUFBQSxDQUFPO0FBQUEsUUFBQSxPQUNyRjtBQUNZLDJCQUFBO0FBQUEsY0FBaUIsWUFBWTtBQUFBLFFBQUE7QUFBQSxNQUNoRCxPQUNLO0FBQ1csd0JBQUEsY0FBYyxRQUFRLGtCQUFrQixFQUFFO0FBQUEsTUFBQTtBQUd6REEsb0JBQUEsY0FBYyxZQUFZLGVBQWUsTUFBTTtBQUVsRCxZQUFNLFdBQVdELGdCQUFLLEtBQUssYUFBYSxvQkFBb0I7QUFDeEQsVUFBQUMsY0FBRyxXQUFXLFFBQVEsR0FBRztBQUN2QixZQUFBO0FBQ0YsZ0JBQU0sY0FBYyxLQUFLLE1BQU1BLGNBQUcsYUFBYSxVQUFVLE1BQU0sQ0FBQztBQUNoRSxzQkFBWSxXQUFXO0FBQ3ZCLHNCQUFZLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDNUNBLHdCQUFBLGNBQWMsVUFBVSxLQUFLLFVBQVUsYUFBYSxNQUFNLENBQUMsR0FBRyxNQUFNO0FBQUEsaUJBQ2hFLE9BQU87QUFDZCxtQkFBUyxnQ0FBZ0MsS0FBSztBQUFBLFFBQUE7QUFBQSxNQUNoRDtBQUdGLGFBQU8sRUFBRSxTQUFTLE1BQU0sU0FBUyxpQ0FBaUM7QUFBQSxhQUMzRCxPQUFPO0FBQ2QsZUFBUyw0QkFBNEIsS0FBSztBQUNuQyxhQUFBO0FBQUEsUUFDTCxTQUFTO0FBQUEsUUFDVCxTQUFTLDZCQUE2QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUM5RjtBQUFBLElBQUE7QUFBQSxFQUNGLENBQ0Q7QUFFRFcsV0FBQSxRQUFRLEdBQUcsd0JBQXdCLENBQUMsT0FBTyxFQUFFLGNBQWMsbUJBQW1CO0FBQzVFLFlBQVEsV0FBVyxZQUFZLHlCQUF5QixZQUFZLEVBQUU7QUFFbEUsUUFBQTtBQUNGLFlBQU0sY0FBY1osZ0JBQUssS0FBS2MsU0FBQUEsSUFBSSxRQUFRLFVBQVUsQ0FBQztBQUNyRCxZQUFNLGVBQWVkLGdCQUFLLEtBQUssYUFBYSxjQUFjLFlBQVk7QUFFbEUsVUFBQUMsY0FBRyxXQUFXLFlBQVksR0FBRztBQUMvQmUsaUJBQUFBLE1BQU0sU0FBUyxZQUFZLEVBQUUsTUFBTSxDQUFPLFFBQUE7QUFDL0IsbUJBQUEsaUJBQWlCLFlBQVksV0FBVyxHQUFHO0FBQzlDLGdCQUFBLE9BQU8sS0FBSyxxQkFBcUI7QUFBQSxZQUNyQyxPQUFPO0FBQUEsWUFDUCxTQUFTLDBCQUEwQixJQUFJLE9BQU87QUFBQSxVQUFBLENBQy9DO0FBQUEsUUFBQSxDQUNGO0FBQUEsTUFBQSxPQUNJO0FBQ0wsY0FBTSxrQkFBa0JoQixnQkFBSyxLQUFLYyxhQUFJLFFBQVEsVUFBVSxHQUFHLGNBQWM7QUFDckUsWUFBQWIsY0FBRyxXQUFXLGVBQWUsR0FBRztBQUM5QixjQUFBO0FBQ0Ysa0JBQU0sY0FBYyxLQUFLLE1BQU1BLGNBQUcsYUFBYSxpQkFBaUIsTUFBTSxDQUFDO0FBQ3ZFLGtCQUFNLGtCQUFrQkQsZ0JBQUssS0FBSyxZQUFZLFNBQVMsY0FBYyxZQUFZO0FBRTdFLGdCQUFBQyxjQUFHLFdBQVcsZUFBZSxHQUFHO0FBQ2xDZSx1QkFBQUEsTUFBTSxTQUFTLGVBQWUsRUFBRSxNQUFNLENBQU8sUUFBQTtBQUNsQyx5QkFBQSw2QkFBNkIsWUFBWSxXQUFXLEdBQUc7QUFDMUQsc0JBQUEsT0FBTyxLQUFLLHFCQUFxQjtBQUFBLGtCQUNyQyxPQUFPO0FBQUEsa0JBQ1AsU0FBUywwQkFBMEIsSUFBSSxPQUFPO0FBQUEsZ0JBQUEsQ0FDL0M7QUFBQSxjQUFBLENBQ0Y7QUFBQSxZQUFBLE9BQ0k7QUFDQyxvQkFBQSxPQUFPLEtBQUsscUJBQXFCO0FBQUEsZ0JBQ3JDLE9BQU87QUFBQSxnQkFDUCxTQUFTLG1DQUFtQyxZQUFZO0FBQUEsY0FBQSxDQUN6RDtBQUFBLFlBQUE7QUFBQSxtQkFFSSxPQUFPO0FBQ2QscUJBQVMsOEJBQThCLEtBQUs7QUFDdEMsa0JBQUEsT0FBTyxLQUFLLHFCQUFxQjtBQUFBLGNBQ3JDLE9BQU87QUFBQSxjQUNQLFNBQVM7QUFBQSxZQUFBLENBQ1Y7QUFBQSxVQUFBO0FBQUEsUUFDSCxPQUNLO0FBQ0MsZ0JBQUEsT0FBTyxLQUFLLHFCQUFxQjtBQUFBLFlBQ3JDLE9BQU87QUFBQSxZQUNQLFNBQVMsbUNBQW1DLFlBQVk7QUFBQSxVQUFBLENBQ3pEO0FBQUEsUUFBQTtBQUFBLE1BQ0g7QUFBQSxhQUVLLE9BQU87QUFDZCxlQUFTLHNDQUFzQyxLQUFLO0FBQzlDLFlBQUEsT0FBTyxLQUFLLHFCQUFxQjtBQUFBLFFBQ3JDLE9BQU87QUFBQSxRQUNQLFNBQVMsMEJBQTBCLGlCQUFpQixRQUFRLE1BQU0sVUFBVSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQUEsQ0FDMUY7QUFBQSxJQUFBO0FBQUEsRUFDSCxDQUNEO0FBRU9KLFdBQUFBLFFBQUEsT0FBTyxxQkFBcUIsQ0FBQyxXQUFXO0FBQzlDLFlBQVEsdUNBQXVDLE9BQU8sb0JBQW9CLE1BQU0sRUFBRTtBQUNsRixXQUFPLE9BQU87QUFBQSxFQUFBLENBQ2Y7QUFFT0EsV0FBQUEsUUFBQSxPQUFPLGlCQUFpQixDQUFDLFVBQVU7QUFDckMsUUFBQTtBQUNGLFlBQU0sY0FBYyxNQUFNO0FBQ3BCLFlBQUEsTUFBTU0sU0FBQUEsY0FBYyxnQkFBZ0IsV0FBVztBQUNyRCxVQUFJLEtBQUs7QUFDUCxjQUFNLEtBQUssSUFBSTtBQUNQLGdCQUFBLHdCQUF3QixFQUFFLEVBQUU7QUFDN0IsZUFBQTtBQUFBLE1BQUE7QUFFVCxlQUFTLHdDQUF3QztBQUMxQyxhQUFBO0FBQUEsYUFDQSxPQUFPO0FBQ2QsZUFBUywyQkFBMkIsS0FBSztBQUNsQyxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1QsQ0FDRDtBQUdELE1BQUksa0JBQWlDO0FBR3JDTixXQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsZUFBZTtBQUN2RCxZQUFRLHNDQUFzQyxRQUFRO0FBRXBDLHNCQUFBO0FBRUpNLGFBQUFBLGNBQUEsY0FBYyxFQUFFLFFBQVEsQ0FBVUQsWUFBQTtBQUMxQyxVQUFBLENBQUNBLFFBQU8sZUFBZTtBQUNsQixRQUFBQSxRQUFBLFlBQVksS0FBSyxvQkFBb0IsUUFBUTtBQUFBLE1BQUE7QUFBQSxJQUN0RCxDQUNEO0FBQUEsRUFBQSxDQUNGO0FBR09MLG1CQUFBLE9BQU8sd0JBQXdCLE1BQU07QUFDcEMsV0FBQTtBQUFBLEVBQUEsQ0FDUjtBQUdEQSxXQUFBLFFBQVEsR0FBRyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsWUFBWTtBQUN2RCxhQUFTLHVCQUF1QixLQUFLO0FBQ3JDQyxhQUFBLE9BQU8sYUFBYSx1QkFBdUIsVUFBVSxLQUFLLEVBQUU7QUFBQSxFQUFBLENBQzdEO0FBR0RELFdBQUEsUUFBUSxHQUFHLGVBQWUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxjQUFjO0FBQy9DLFlBQUEsMkJBQTJCLElBQUksRUFBRTtBQUN6QyxpQkFBYSxNQUFNLE9BQU87QUFBQSxFQUFBLENBQzNCO0FBR0RBLFdBQUEsUUFBUSxHQUFHLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxXQUFXOztBQUN2QyxZQUFBLDRCQUE0QixJQUFJLEVBQUU7QUFDdEMsUUFBQSxRQUFRLElBQUksS0FBSyxHQUFDLGFBQVEsSUFBSSxNQUFaLG1CQUFlLGdCQUFlO0FBQzFDLG9CQUFBLElBQUksTUFBSixtQkFBTztBQUFBLElBQU07QUFBQSxFQUN2QixDQUNEO0FBR0RBLFdBQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQyxPQUFPLFVBQVU7QUFDL0MsVUFBTSxNQUFNTSxTQUFBLGNBQWMsZ0JBQWdCLE1BQU0sTUFBTTtBQUN0RCxRQUFJLEtBQUs7QUFDUCxVQUFJLFNBQVMsS0FBSztBQUFBLElBQUE7QUFBQSxFQUNwQixDQUNEO0FBR0ROLFdBQUFBLFFBQVEsT0FBTyx1QkFBdUIsT0FBTyxPQUFPLFlBQVk7QUFDOUQsVUFBTSxTQUFTLE1BQU1DLGdCQUFPLGVBQWUsT0FBTztBQUNsRCxVQUFNLE9BQU8sS0FBSyxtQkFBbUIsT0FBTyxRQUFRO0FBQzdDLFdBQUE7QUFBQSxFQUFBLENBQ1I7QUFHREQsV0FBQUEsUUFBUSxPQUFPLG9CQUFvQixPQUFPLFFBQVEsWUFBWTtBQUNyRCxXQUFBLE1BQU1DLFNBQUFBLE9BQU8sZUFBZSxPQUFPO0FBQUEsRUFBQSxDQUMzQztBQUdERCxXQUFBQSxRQUFRLE9BQU8sb0JBQW9CLE9BQU8sUUFBUSxZQUFZO0FBQ3JELFdBQUEsTUFBTUMsU0FBQUEsT0FBTyxlQUFlLE9BQU87QUFBQSxFQUFBLENBQzNDO0FBR09ELG1CQUFBLEdBQUcsd0JBQXdCLE1BQU07QUFDdkMsWUFBUSxvREFBb0Q7QUFDNUQsV0FBTyxrQkFBa0I7QUFBQSxFQUFBLENBQzFCO0FBR09BLG1CQUFBLEdBQUcsMkJBQTJCLE1BQU07QUFDMUMsWUFBUSwyQ0FBMkM7QUFFL0MsUUFBQTtBQUNJLFlBQUEsZ0JBQWdCTSx1QkFBYyxpQkFBaUI7QUFDckQsVUFBSSxDQUFDLGVBQWU7QUFDbEIsaUJBQVMsMEJBQTBCO0FBQ25DO0FBQUEsTUFBQTtBQUdJLFlBQUEsYUFBYSxnQkFBZ0IsTUFBTTtBQUV6QyxvQkFBYyxRQUFRLFdBQVcsT0FBTyxXQUFXLE1BQU07QUFFckQsVUFBQSxXQUFXLFlBQVksV0FBVyxXQUFXO0FBQy9DLHNCQUFjLGVBQWUsV0FBVyxVQUFVLFdBQVcsU0FBUztBQUFBLE1BQUE7QUFHMUQsb0JBQUEsYUFBYSxXQUFXLFNBQVM7QUFDakMsb0JBQUEsU0FBUyxXQUFXLEtBQUs7QUFDdkMsb0JBQWMsT0FBTztBQUVyQixjQUFRLGlDQUFpQztBQUFBLGFBQ2xDLE9BQU87QUFDZCxlQUFTLDBDQUEwQyxLQUFLO0FBQUEsSUFBQTtBQUFBLEVBQzFELENBQ0Q7QUFHT04sbUJBQUEsR0FBRyxZQUFZLE9BQU8sT0FBTyxFQUFFLGNBQWMsWUFBWSxXQUFXO0FBQzFFLFlBQVEsb0JBQW9CLFlBQVksaUJBQWlCLFVBQVUsV0FBVyxJQUFJLEVBQUU7QUFFaEYsUUFBQTtBQUNGLFVBQUksYUFBYTtBQUNqQixjQUFRLFlBQVk7QUFBQSxRQUNsQixLQUFLO0FBQ1UsdUJBQUE7QUFDYjtBQUFBLFFBQ0YsS0FBSztBQUNVLHVCQUFBO0FBQ2I7QUFBQSxRQUNGLEtBQUs7QUFDVSx1QkFBQTtBQUNiO0FBQUEsUUFDRixLQUFLO0FBQ1UsdUJBQUE7QUFDYjtBQUFBLE1BQUE7QUFHRSxZQUFBLE1BQU0sZUFBZSxRQUNyQixzQkFBc0IsSUFBSSxJQUFJLFlBQVksS0FDMUMsZUFBZSxVQUFVLElBQUksWUFBWTtBQUUvQyxZQUFNLEVBQUUsTUFBQSxJQUFVLFFBQVEsZUFBZTtBQUNuQyxZQUFBLGdCQUFnQixNQUFNLEtBQUssSUFBSSxFQUFFLE9BQU8sTUFBTTtBQUVwRCxVQUFJLE9BQU87QUFDWCxVQUFJLFFBQVE7QUFDWixVQUFJLFVBQWlDO0FBRXJDLGdCQUFVLFdBQVcsTUFBTTtBQUN6QixzQkFBYyxLQUFLO0FBQ2IsY0FBQSxPQUFPLEtBQUssaUJBQWlCO0FBQUEsVUFDakMsU0FBUztBQUFBLFVBQ1QsU0FBUztBQUFBLFFBQUEsQ0FDVjtBQUFBLFNBQ0EsR0FBSztBQUVSLG9CQUFjLE9BQU8sR0FBRyxRQUFRLENBQUMsU0FBaUI7QUFDaEQsWUFBSSxTQUFTO0FBQ1gsdUJBQWEsT0FBTztBQUNWLG9CQUFBO0FBQUEsUUFBQTtBQUdaLGdCQUFRLEtBQUssU0FBUztBQUFBLE1BQUEsQ0FDdkI7QUFFRCxvQkFBYyxPQUFPLEdBQUcsUUFBUSxDQUFDLFNBQWlCO0FBQ2hELGlCQUFTLEtBQUssU0FBUztBQUFBLE1BQUEsQ0FDeEI7QUFFYSxvQkFBQSxHQUFHLFNBQVMsQ0FBQyxTQUFpQjtBQUMxQyxZQUFJLFNBQVM7QUFDWCx1QkFBYSxPQUFPO0FBQ1Ysb0JBQUE7QUFBQSxRQUFBO0FBR1osWUFBSSxTQUFTLEdBQUc7QUFDUixnQkFBQSxPQUFPLEtBQUssaUJBQWlCO0FBQUEsWUFDakMsU0FBUztBQUFBLFlBQ1Q7QUFBQSxVQUFBLENBQ0Q7QUFBQSxRQUFBLE9BQ0k7QUFDQyxnQkFBQSxPQUFPLEtBQUssaUJBQWlCO0FBQUEsWUFDakMsU0FBUztBQUFBLFlBQ1QsU0FBUyxTQUFTLDRCQUE0QixJQUFJO0FBQUEsVUFBQSxDQUNuRDtBQUFBLFFBQUE7QUFBQSxNQUNILENBQ0Q7QUFFYSxvQkFBQSxHQUFHLFNBQVMsQ0FBQyxRQUFlO0FBQ3hDLFlBQUksU0FBUztBQUNYLHVCQUFhLE9BQU87QUFDVixvQkFBQTtBQUFBLFFBQUE7QUFHWixpQkFBUyx1Q0FBdUMsR0FBRztBQUM3QyxjQUFBLE9BQU8sS0FBSyxpQkFBaUI7QUFBQSxVQUNqQyxTQUFTO0FBQUEsVUFDVCxTQUFTLHdDQUF3QyxJQUFJLE9BQU87QUFBQSxRQUFBLENBQzdEO0FBQUEsTUFBQSxDQUNGO0FBQUEsYUFFTSxPQUFPO0FBQ2QsZUFBUyxzQkFBc0IsS0FBSztBQUM5QixZQUFBLE9BQU8sS0FBSyxpQkFBaUI7QUFBQSxRQUNqQyxTQUFTO0FBQUEsUUFDVCxTQUFTLHVCQUF1QixpQkFBaUIsUUFBUSxNQUFNLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFBQSxNQUFBLENBQ3ZGO0FBQUEsSUFBQTtBQUFBLEVBQ0gsQ0FDRDtBQUdELGFBQVcsTUFBTTtBQUNmLFFBQUksUUFBUSxRQUFRLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxVQUFVLFFBQVEsT0FBTyxVQUFBLEdBQWE7QUFDN0YsY0FBUSxrREFBa0Q7QUFDM0MscUJBQUE7QUFBQSxJQUFBO0FBQUEsS0FFaEIsR0FBSztBQUNWLENBQUM7QUFHREUsU0FBQUEsSUFBSSxHQUFHLHFCQUFxQixNQUFNO0FBQ2hDLE1BQUksUUFBUSxhQUFhLFNBQVVBLFVBQUFBLElBQUksS0FBSztBQUM5QyxDQUFDO0FBR0RBLFNBQUFBLElBQUksR0FBRyxZQUFZLE1BQU07QUFDdkIsTUFBSUksdUJBQWMsZ0JBQWdCLFdBQVcsR0FBRztBQUM5QyxZQUFRLHFEQUFxRDtBQUM3RCx1QkFBbUIsS0FBSyxDQUFDLEVBQUUsZ0JBQWdCO0FBQ3pDLFVBQUksV0FBVztBQUNiLGNBQU0sYUFBYSxpQkFBaUI7QUFDcEMsMEJBQWtCLFVBQVU7QUFBQSxNQUFBLE9BQ3ZCO0FBQ2EsMEJBQUE7QUFBQSxNQUFBO0FBQUEsSUFDcEIsQ0FDRCxFQUFFLE1BQU0sQ0FBUyxVQUFBO0FBQ2hCLGVBQVMsMkNBQTJDLEtBQUs7QUFDekQsWUFBTSxhQUFhLGlCQUFpQjtBQUNwQyx3QkFBa0IsVUFBVTtBQUFBLElBQUEsQ0FDN0I7QUFBQSxFQUFBLE9BQ0k7QUFDQ0UsVUFBQUEsV0FBVUYsdUJBQWMsY0FBYztBQUM1QyxVQUFNLGlCQUFpQkUsU0FBUSxPQUFPLENBQU8sUUFBQSxJQUFJLFdBQVc7QUFDeEQsUUFBQSxlQUFlLFNBQVMsR0FBRztBQUNkLHFCQUFBLENBQUMsRUFBRSxNQUFNO0FBQUEsSUFBQSxXQUNmQSxTQUFRLFNBQVMsR0FBRztBQUNyQixlQUFBLENBQUMsRUFBRSxLQUFLO0FBQ1IsZUFBQSxDQUFDLEVBQUUsTUFBTTtBQUFBLElBQUE7QUFBQSxFQUNuQjtBQUVKLENBQUM7QUFHRFIsU0FBQSxRQUFRLEdBQUcscUJBQXFCLENBQUMsUUFBUSxRQUFRO0FBQzNDLE1BQUEsT0FBTyxRQUFRLFVBQVU7QUFDM0JJLGFBQUFBLE1BQU0sYUFBYSxHQUFHLEVBQUUsTUFBTSxDQUFPLFFBQUE7QUFDMUIsZUFBQSwrQkFBK0IsR0FBRyxJQUFJLEdBQUc7QUFBQSxJQUFBLENBQ25EO0FBQUEsRUFBQTtBQUVMLENBQUM7QUFHREosU0FBQUEsUUFBUSxPQUFPLG1CQUFtQixNQUFNO0FBQ3RDLFNBQU9FLFNBQUFBLElBQUksV0FBVztBQUN4QixDQUFDO0FBR0RGLFNBQUEsUUFBUSxPQUFPLGdCQUFnQixDQUFDLFFBQVEsU0FBUztBQUN4QyxTQUFBRSxhQUFJLFFBQVEsUUFBZSxVQUFVO0FBQzlDLENBQUM7QUFNREYsU0FBQUEsUUFBUSxPQUFPLHlCQUF5QixZQUFZO0FBQzlDLE1BQUE7QUFDRixZQUFRLDJDQUEyQztBQUluRCxVQUFNLFNBQVM7QUFHVCxVQUFBLFVBQVVTLGFBQUksUUFBUTtBQUFBLE1BQzFCLFFBQVE7QUFBQSxNQUNSLEtBQUs7QUFBQSxNQUNMLFVBQVU7QUFBQSxJQUFBLENBQ1g7QUFHRCxZQUFRLFVBQVUsY0FBYyxnQkFBZ0JQLGFBQUksV0FBWSxDQUFBLEVBQUU7QUFHbEUsVUFBTSxrQkFBa0IsSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3ZELFVBQUksZUFBZTtBQUVYLGNBQUEsR0FBRyxZQUFZLENBQUMsYUFBYTtBQUMxQixpQkFBQSxHQUFHLFFBQVEsQ0FBQyxVQUFVO0FBQzdCLDBCQUFnQixNQUFNLFNBQVM7QUFBQSxRQUFBLENBQ2hDO0FBRVEsaUJBQUEsR0FBRyxPQUFPLE1BQU07QUFDbkIsY0FBQSxTQUFTLGVBQWUsS0FBSztBQUMzQixnQkFBQTtBQUNJLG9CQUFBLFdBQVcsS0FBSyxNQUFNLFlBQVk7QUFFeEMsb0JBQU0sZ0JBQWdCLFNBQVMsS0FBSyxDQUFDLFlBQWlCLENBQUMsUUFBUSxLQUFLO0FBQ3BFLGtCQUFJLGVBQWU7QUFDVCx3QkFBQSxnQ0FBZ0MsY0FBYyxRQUFRLEVBQUU7QUFDaEUsd0JBQVEsYUFBYTtBQUFBLGNBQUEsT0FDaEI7QUFDTCx5QkFBUyx5QkFBeUI7QUFDM0IsdUJBQUEsSUFBSSxNQUFNLHlCQUF5QixDQUFDO0FBQUEsY0FBQTtBQUFBLHFCQUV0QyxPQUFPO0FBQ2QsdUJBQVMscUNBQXFDLEtBQUs7QUFDbkQscUJBQU8sS0FBSztBQUFBLFlBQUE7QUFBQSxVQUNkLE9BQ0s7QUFDSSxxQkFBQSxtQ0FBbUMsU0FBUyxVQUFVLEVBQUU7QUFDakUsbUJBQU8sSUFBSSxNQUFNLG1DQUFtQyxTQUFTLFVBQVUsRUFBRSxDQUFDO0FBQUEsVUFBQTtBQUFBLFFBQzVFLENBQ0Q7QUFBQSxNQUFBLENBQ0Y7QUFFTyxjQUFBLEdBQUcsU0FBUyxDQUFDLFVBQVU7QUFDN0IsaUJBQVMsa0NBQWtDLEtBQUs7QUFDaEQsZUFBTyxLQUFLO0FBQUEsTUFBQSxDQUNiO0FBR0QsaUJBQVcsTUFBTTtBQUNSLGVBQUEsSUFBSSxNQUFNLG9DQUFvQyxDQUFDO0FBQUEsU0FDckQsR0FBSztBQUFBLElBQUEsQ0FDVDtBQUdELFlBQVEsSUFBSTtBQUVaLFdBQU8sTUFBTTtBQUFBLFdBQ04sT0FBTztBQUNkLGFBQVMsMENBQTBDLEtBQUs7QUFDakQsV0FBQTtBQUFBLEVBQUE7QUFFWCxDQUFDO0FBS0RGLFNBQUFBLFFBQVEsR0FBRyw0QkFBNEIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxXQUFXO0FBQzlELE1BQUE7QUFFRSxRQUFBLFFBQVEsYUFBYSxTQUFTO0FBQ2hDLGNBQVEsZ0RBQWdEO0FBQ3hEO0FBQUEsSUFBQTtBQUdNLFlBQUEsZ0NBQWdDLEtBQUssRUFBRTtBQUd6QyxVQUFBLGVBQWUsSUFBSVUsc0JBQWE7QUFBQSxNQUNwQyxPQUFPLFNBQVM7QUFBQSxNQUNoQixNQUFNLFFBQVE7QUFBQSxNQUNkLFFBQVE7QUFBQSxJQUFBLENBQ1Q7QUFHRCxpQkFBYSxLQUFLO0FBR0wsaUJBQUEsR0FBRyxTQUFTLE1BQU07QUFDN0IsY0FBUSw2QkFBNkI7QUFDckMsVUFBSSxRQUFRLFFBQVEsQ0FBQyxRQUFRLEtBQUssZUFBZTtBQUN2QyxnQkFBQSxLQUFLLFlBQVksS0FBSyxxQkFBcUI7QUFDbkQsWUFBSSxDQUFDLFFBQVEsS0FBSyxhQUFhO0FBQzdCLGtCQUFRLEtBQUssS0FBSztBQUFBLFFBQUE7QUFFcEIsZ0JBQVEsS0FBSyxNQUFNO0FBQUEsTUFBQTtBQUFBLElBQ3JCLENBQ0Q7QUFBQSxXQUNNLE9BQU87QUFDZCxhQUFTLHFDQUFxQyxLQUFLO0FBQUEsRUFBQTtBQUV2RCxDQUFDO0FBR0RWLFNBQUEsUUFBUSxPQUFPLDBCQUEwQixPQUFPLFFBQVEsU0FBUztBQUMzRCxNQUFBO0FBQ00sWUFBQSxnQkFBZ0IsSUFBSSxlQUFlO0FBQ3JDUyxVQUFBQSxPQUFNLFFBQVEsS0FBSztBQUNuQixVQUFBLFNBQVNBLEtBQUksYUFBYTtBQUVoQyxVQUFNLGNBQWMsTUFBTSxJQUFJLFFBQWlCLENBQUMsWUFBWTtBQUNuRCxhQUFBLEtBQUssU0FBUyxDQUFDLFFBQWE7QUFDN0IsWUFBQSxJQUFJLFNBQVMsY0FBYztBQUM3QixrQkFBUSxLQUFLO0FBQUEsUUFBQSxPQUNSO0FBQ0wsbUJBQVMsbUNBQW1DLElBQUksT0FBTyxJQUFJLEdBQUc7QUFDOUQsa0JBQVEsS0FBSztBQUFBLFFBQUE7QUFBQSxNQUNmLENBQ0Q7QUFFTSxhQUFBLEtBQUssYUFBYSxNQUFNO0FBQzdCLGVBQU8sTUFBTSxNQUFNLFFBQVEsSUFBSSxDQUFDO0FBQUEsTUFBQSxDQUNqQztBQUVNLGFBQUEsT0FBTyxNQUFNLFNBQVM7QUFBQSxJQUFBLENBQzlCO0FBRU0sV0FBQTtBQUFBLFdBQ0EsT0FBTztBQUNkLGFBQVMsbUNBQW1DLEtBQUs7QUFDMUMsV0FBQTtBQUFBLEVBQUE7QUFFWCxDQUFDO0FBR0RULFNBQUFBLFFBQVEsR0FBRyxlQUFlLE1BQU07QUFDOUJFLFdBQUFBLElBQUksU0FBUztBQUNiQSxXQUFBQSxJQUFJLEtBQUs7QUFDWCxDQUFDO0FBR0RGLFNBQUFBLFFBQVEsR0FBRyxZQUFZLE1BQU07QUFDM0JFLFdBQUFBLElBQUksS0FBSztBQUNYLENBQUM7QUFHREYsU0FBQUEsUUFBUSxPQUFPLDJCQUEyQixZQUFZO0FBQ2hELE1BQUE7QUFDRixVQUFNLGNBQWNaLGdCQUFLLEtBQUtjLGFBQUksUUFBUSxVQUFVLEdBQUcsY0FBYztBQUNyRSxRQUFJLENBQUNiLGNBQUcsV0FBVyxXQUFXLEdBQUc7QUFDeEIsYUFBQTtBQUFBLElBQUE7QUFHVCxVQUFNLGNBQWMsS0FBSyxNQUFNQSxjQUFHLGFBQWEsYUFBYSxNQUFNLENBQUM7QUFDbkUsVUFBTSxVQUFVLFlBQVk7QUFFNUIsUUFBSSxDQUFDLFdBQVcsQ0FBQ0EsY0FBRyxXQUFXLE9BQU8sR0FBRztBQUNoQyxhQUFBO0FBQUEsSUFBQTtBQUdULFVBQU0sZUFBZUQsZ0JBQUssS0FBSyxTQUFTLGVBQWU7QUFDdkQsUUFBSSxDQUFDQyxjQUFHLFdBQVcsWUFBWSxHQUFHO0FBQ3pCLGFBQUE7QUFBQSxJQUFBO0FBR1QsVUFBTSxXQUFXLEtBQUssTUFBTUEsY0FBRyxhQUFhLGNBQWMsTUFBTSxDQUFDO0FBQ2pFLFdBQU8sU0FBUyxxQkFBcUI7QUFBQSxXQUM5QixPQUFPO0FBQ2QsYUFBUyxzQ0FBc0MsS0FBSztBQUM3QyxXQUFBO0FBQUEsRUFBQTtBQUVYLENBQUM7In0=
