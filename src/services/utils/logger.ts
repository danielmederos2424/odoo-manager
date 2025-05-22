// src/services/utils/logger.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import settingsService from '../settings/settingsService';
import { isElectron } from '../../utils/electron';

// Helper function to avoid circular dependency with pathService
function getLocalLogsPath(customWorkDirPath?: string): string {
    // If a specific work directory is provided, use it
    const appName = 'odoo-manager';
    try {
        const basePath = customWorkDirPath || path.join(os.homedir(), 'Library', 'Application Support', appName);
        const logsPath = path.join(basePath, 'logs');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(logsPath)) {
            fs.mkdirSync(logsPath, { recursive: true });
        }
        
        return logsPath;
    } catch (error) {
        console.error('Error getting logs path:', error);
        // Fallback to temp directory
        return path.join(os.tmpdir(), appName, 'logs');
    }
}

// Global flags to prevent multiple logger initializations across all instances
let GLOBAL_LOGGER_INITIALIZED = false;
let ACTIVE_LOG_FILE_PATH: string | null = null;
let SESSION_HEADERS_WRITTEN: { [key: string]: boolean } = {};

// Log rotation configuration
const LOG_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB in bytes
const MAX_LOG_FILES = 5; // Maximum number of rotated log files to keep

// Log levels enum
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// Type definition for log entry
interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
}

/**
 * Application logger with file and console output
 */
class Logger {
    private logLevel: LogLevel = LogLevel.INFO;
    private logFile: string = '';
    private static instance: Logger | null = null;
    private initialized: boolean = false;
    private windowId: number | null = null;

    constructor() {
        // Default to INFO in production, DEBUG in development
        this.logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    }

    /**
     * Set the window ID for this logger instance
     * @param id Window ID
     */
    setWindowId(id: number): void {
        this.windowId = id;
    }

    /**
     * Get the window ID for this logger instance
     * @returns Window ID or null if not set
     */
    getWindowId(): number | null {
        return this.windowId;
    }

    /**
     * Fetch the window ID from the main process
     * @returns Promise that resolves to window ID or null
     */
    async fetchWindowId(): Promise<number | null> {
        if (!isElectron() || this.windowId !== null) return this.windowId;

        try {
            const ipcRenderer = window.ipcRenderer;
            if (ipcRenderer && ipcRenderer.invoke) {
                this.windowId = await ipcRenderer.invoke('get-window-id');
                return this.windowId;
            }
        } catch (error) {
            console.error('Failed to get window ID:', error);
        }
        return null;
    }

    /**
     * Check with main process if there's already an active log file
     * @returns Path to existing log file or null
     */
    static getExistingLogFile(): string | null {
        if (isElectron()) {
            try {
                // Access ipcRenderer directly when contextIsolation is disabled
                const ipcRenderer = window.ipcRenderer;
                if (ipcRenderer && ipcRenderer.invoke) {
                    // Use async invoke instead of sync call to avoid blocking renderer process
                    // We'll handle this asynchronously in initialize() method
                    return null;
                }
            } catch (error) {
                console.error('Failed to get existing log file:', error);
            }
        }
        return null;
    }

    /**
     * Register log file with main process
     * @param logFile Path to log file
     */
    static registerLogFile(logFile: string): void {
        if (isElectron() && logFile && fs.existsSync(logFile)) {
            try {
                const ipcRenderer = window.ipcRenderer;
                if (ipcRenderer && ipcRenderer.send) {
                    ipcRenderer.send('register-log-file', logFile);
                    ACTIVE_LOG_FILE_PATH = logFile;
                }
            } catch (error) {
                console.error('Failed to register log file with main process:', error);
            }
        }
    }

    /**
     * Clean up old log files older than specified days
     * This is kept for compatibility but not actively used with rotation-based approach
     * @param days Number of days to keep logs (default: 7)
     * @returns Promise that resolves when cleanup is complete
     */
    async cleanupOldLogFiles(days: number = 7): Promise<void> {
        try {
            // Get all log files
            const logFiles = this.getLogFiles();
            if (logFiles.length === 0) {
                return;
            }

            console.log(`Checking for log files older than ${days} days to clean up`);

            // Current time
            const now = new Date().getTime();
            // Max age in milliseconds
            const maxAge = days * 24 * 60 * 60 * 1000;
            // Threshold date
            const threshold = now - maxAge;

            // Filter files older than threshold
            const oldFiles = logFiles.filter(file => {
                // Don't delete current log file or its rotations
                if (file === this.logFile || file === ACTIVE_LOG_FILE_PATH) {
                    return false;
                }
                
                // Don't delete rotated versions of the active log file
                const baseLogName = path.basename(this.logFile || '', '.log');
                if (path.basename(file).startsWith(`${baseLogName}.`) && 
                    path.basename(file).endsWith('.log')) {
                    return false;
                }

                try {
                    const stats = fs.statSync(file);
                    // Use creation time or modified time, whichever is older
                    const fileTime = Math.min(stats.birthtimeMs, stats.mtimeMs);
                    return fileTime < threshold;
                } catch (err) {
                    console.error(`Error checking file age for ${file}:`, err);
                    return false;
                }
            });

            // Delete old files
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
            console.error('Error during log file cleanup:', err);
        }
    }

    /**
     * Check if we've already written session headers for the current log file
     * @param sessionType Type of session header (start, resume)
     * @returns True if headers already written, false otherwise
     */
    private isSessionHeaderWritten(sessionType: string): boolean {
        if (!this.logFile) return false;
        const key = `${this.logFile}:${sessionType}:${this.windowId || 'unknown'}`;
        return SESSION_HEADERS_WRITTEN[key] === true;
    }

    /**
     * Mark session headers as written for the current log file
     * @param sessionType Type of session header (start, resume)
     */
    private markSessionHeaderWritten(sessionType: string): void {
        if (!this.logFile) return;
        const key = `${this.logFile}:${sessionType}:${this.windowId || 'unknown'}`;
        SESSION_HEADERS_WRITTEN[key] = true;
    }

    /**
     * Initialize the logger with settings
     * @returns Promise that resolves when initialization is complete
     */
    async initialize(): Promise<void> {
        // Get window ID first if we're in Electron
        if (isElectron() && this.windowId === null) {
            await this.fetchWindowId();
        }
    
        // Check for global initialization flag first
        if (GLOBAL_LOGGER_INITIALIZED) {
            console.log(`Logger already initialized globally, using existing instance (window ${this.windowId})`);

            // If there's an active log file path, use it
            if (ACTIVE_LOG_FILE_PATH && fs.existsSync(ACTIVE_LOG_FILE_PATH)) {
                this.logFile = ACTIVE_LOG_FILE_PATH;
                this.initialized = true;
                
                // Only write resume header if we haven't written it for this window/file combo
                if (!this.isSessionHeaderWritten('resume')) {
                    try {
                        const sessionMessage =
                            `\n===============================================\n` +
                            `Session resumed: ${this.formatTimestamp(new Date())}\n` +
                            `===============================================\n`;
                        fs.appendFileSync(this.logFile, sessionMessage);
                        this.markSessionHeaderWritten('resume');
                    } catch (err) {
                        console.error('Error writing session separator to log file:', err);
                    }
                }
            }
            return;
        }

        // Check if there's already a global active log file (from main process)
        // Use async invoke instead of blocking synchronous IPC
        let existingLogFile = null;
        if (isElectron()) {
            try {
                // Use async invoke and just wait a max of 500ms to avoid blocking startup
                const ipcRenderer = window.ipcRenderer;
                if (ipcRenderer && ipcRenderer.invoke) {
                    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
                    existingLogFile = await Promise.race([
                        ipcRenderer.invoke('get-active-log-file'),
                        timeoutPromise
                    ]);
                }
            } catch (error) {
                console.error('Failed to get existing log file asynchronously:', error);
            }
        }
        
        if (existingLogFile && fs.existsSync(existingLogFile)) {
            console.log(`Using existing global log file: ${existingLogFile} (window ${this.windowId})`);
            this.logFile = existingLogFile;
            this.initialized = true;
            GLOBAL_LOGGER_INITIALIZED = true;

            // Only write resume header if we haven't written it for this window/file combo
            if (!this.isSessionHeaderWritten('resume')) {
                try {
                    const sessionMessage =
                        `\n===============================================\n` +
                        `Session resumed: ${this.formatTimestamp(new Date())}\n` +
                        `===============================================\n`;
                    fs.appendFileSync(this.logFile, sessionMessage);
                    this.markSessionHeaderWritten('resume');
                } catch (err) {
                    console.error('Error writing session separator to log file:', err);
                }
            }
            return;
        }

        console.log(`Initializing logger for window ${this.windowId}...`);

        try {
            // Get work directory path from settings service
            const workDirPath = await settingsService.getWorkDirPath();
            console.log(`Work directory: ${workDirPath || 'not set'}`);

            // Get logs path using our local function
            const logsPath = getLocalLogsPath(workDirPath || undefined);
            console.log(`Logs directory: ${logsPath}`);
            
            // Get or create main log file
            this.logFile = path.join(logsPath, 'app.log');
            console.log(`Using main log file at: ${this.logFile}`);

            // Check if the file exists, if not create it with initial content
            if (!fs.existsSync(this.logFile)) {
                // Write initial log entry
                const now = new Date();
                const initialMessage =
                    `===============================================\n` +
                    `Odoo Manager - Application Log (Main Process)\n` +
                    `Started: ${this.formatTimestamp(now)}\n` +
                    `Environment: ${process.env.NODE_ENV || 'unknown'}\n` +
                    `===============================================\n`;

                fs.writeFileSync(this.logFile, initialMessage);
                this.markSessionHeaderWritten('start');
            } else if (!this.isSessionHeaderWritten('start')) {
                // Write a session separator to existing log file only if we haven't written one
                const sessionMessage =
                    `\n===============================================\n` +
                    `Session started: ${this.formatTimestamp(new Date())}\n` +
                    `===============================================\n`;
                fs.appendFileSync(this.logFile, sessionMessage);
                this.markSessionHeaderWritten('start');
            }

            // Store the active log file path globally
            ACTIVE_LOG_FILE_PATH = this.logFile;

            // Register with main process
            Logger.registerLogFile(this.logFile);

            console.log(`Logger initialized with file: ${this.logFile}`);
            this.initialized = true;
            GLOBAL_LOGGER_INITIALIZED = true;
            this.info('Logger initialized successfully');
            this.info(`Log files will be rotated when they reach ${LOG_FILE_SIZE_LIMIT / (1024 * 1024)} MB`);
            this.info(`Registered active log file: ${this.logFile}`);
        } catch (err) {
            console.error('Failed to initialize logger:', err);
        }
    }

    /**
     * Format date for log filename (YYYY-MM-DD-HH-MM-SS)
     * @param date Date object to format
     * @returns Formatted date string suitable for filenames
     */
    private formatDateForFilename(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
    }

    /**
     * Format timestamp for log entries
     * @param date Date object to format
     * @returns Formatted timestamp string
     */
    private formatTimestamp(date: Date): string {
        return date.toLocaleString();
    }

    /**
     * Get logger instance (singleton pattern)
     * @returns Logger instance
     */
    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Set the log level
     * @param level LogLevel to set
     */
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Get the current log file path
     * @returns Path to the active log file
     */
    getLogFilePath(): string {
        return this.logFile;
    }

    /**
     * Check if log file needs rotation based on size
     * @returns true if log rotation was performed, false otherwise
     */
    private checkAndRotateLogFile(): boolean {
        if (!this.initialized || !this.logFile || !fs.existsSync(this.logFile)) {
            return false;
        }

        try {
            const stats = fs.statSync(this.logFile);
            if (stats.size < LOG_FILE_SIZE_LIMIT) {
                return false; // No rotation needed
            }

            console.log(`Log file size (${stats.size} bytes) exceeds limit (${LOG_FILE_SIZE_LIMIT} bytes), rotating logs...`);
            
            // Get the logs directory
            const logsDir = path.dirname(this.logFile);
            
            // Get existing rotated log files
            const baseLogName = path.basename(this.logFile, '.log');
            const rotatedLogs = fs.readdirSync(logsDir)
                .filter(f => f.startsWith(`${baseLogName}.`) && f.endsWith('.log'))
                .sort(); // Sort to find highest rotation number
            
            // Shift older logs to make room for new rotation
            for (let i = rotatedLogs.length - 1; i >= 0; i--) {
                const match = rotatedLogs[i].match(new RegExp(`${baseLogName}\.(\d+)\.log`));
                if (match) {
                    const rotationNumber = parseInt(match[1], 10);
                    if (rotationNumber >= MAX_LOG_FILES - 1) {
                        // Delete the oldest log file if we already have max number of rotations
                        const oldestLog = path.join(logsDir, rotatedLogs[i]);
                        fs.unlinkSync(oldestLog);
                        console.log(`Deleted old log file: ${oldestLog}`);
                    } else {
                        // Rename to the next rotation number
                        const oldPath = path.join(logsDir, rotatedLogs[i]);
                        const newPath = path.join(logsDir, `${baseLogName}.${rotationNumber + 1}.log`);
                        fs.renameSync(oldPath, newPath);
                        console.log(`Rotated log file: ${oldPath} -> ${newPath}`);
                    }
                }
            }
            
            // Rename the current log file to be .1.log
            const rotatedLogPath = path.join(logsDir, `${baseLogName}.1.log`);
            fs.renameSync(this.logFile, rotatedLogPath);
            console.log(`Rotated main log file: ${this.logFile} -> ${rotatedLogPath}`);
            
            // Create a new empty log file
            const now = new Date();
            const initialMessage =
                `===============================================\n` +
                `Odoo Manager - Application Log (Rotated)\n` +
                `Started: ${this.formatTimestamp(now)}\n` +
                `Environment: ${process.env.NODE_ENV || 'unknown'}\n` +
                `===============================================\n`;
            fs.writeFileSync(this.logFile, initialMessage);
            
            // Reset session headers tracking when rotated
            SESSION_HEADERS_WRITTEN = {};
            this.markSessionHeaderWritten('start');
            
            return true;
        } catch (err) {
            console.error('Error rotating log file:', err);
            return false;
        }
    }

    /**
     * Write a log entry to console and file
     * @param level LogLevel of the entry
     * @param message Message to log
     * @param error Optional error object to include
     */
    private log(level: LogLevel, message: string, error?: Error | unknown): void {
        if (level < this.logLevel) return;

        const timestamp = this.formatTimestamp(new Date());
        const levelStr = LogLevel[level];
        const windowPrefix = this.windowId !== null ? `[WINDOW-${this.windowId}] ` : '';

        let logMessage = `[${timestamp}] [${levelStr}] ${windowPrefix}${message}`;
        if (error) {
            let errorMsg: string;
            if (error instanceof Error) {
                errorMsg = error.stack || error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            } else {
                try {
                    errorMsg = JSON.stringify(error);
                } catch {
                    errorMsg = String(error);
                }
            }
            logMessage += `\n${errorMsg}`;
        }

        // Write to console
        const consoleMethod = level === LogLevel.ERROR ? 'error' :
            level === LogLevel.WARN ? 'warn' :
                level === LogLevel.DEBUG ? 'debug' : 'log';
        console[consoleMethod](logMessage);

        // Write to file if initialized
        if (this.initialized && this.logFile) {
            try {
                // Check if log file needs rotation
                this.checkAndRotateLogFile();
                
                // Write to log file (which might be newly rotated)
                fs.appendFileSync(this.logFile, logMessage + '\n');
            } catch (err) {
                console.error('Failed to write to log file:', err);
            }
        }
    }

    /**
     * Log debug message
     * @param message Message to log
     * @param data Optional data to include
     */
    debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    /**
     * Log info message
     * @param message Message to log
     * @param data Optional data to include
     */
    info(message: string, data?: any): void {
        this.log(LogLevel.INFO, message, data);
    }

    /**
     * Log warning message
     * @param message Message to log
     * @param error Optional error to include
     */
    warn(message: string, error?: Error | unknown): void {
        this.log(LogLevel.WARN, message, error);
    }

    /**
     * Log error message
     * @param message Message to log
     * @param error Optional error to include
     */
    error(message: string, error?: Error | unknown): void {
        this.log(LogLevel.ERROR, message, error);
    }

    /**
     * Get all log files in the logs directory
     * @returns Array of log file paths
     */
    getLogFiles(): string[] {
        try {
            // Use our local function to get logs path
            const logsPath = getLocalLogsPath();

            if (!fs.existsSync(logsPath)) {
                return [];
            }

            return fs.readdirSync(logsPath)
                .filter(file => file.endsWith('.log'))
                .map(file => path.join(logsPath, file));
        } catch (error) {
            console.error('Failed to get log files:', error);
            return [];
        }
    }

    /**
     * Get the most recent log file
     * @returns Path to the most recent log file or null if none found
     */
    getMostRecentLogFile(): string | null {
        try {
            const logFiles = this.getLogFiles();
            if (logFiles.length === 0) {
                return null;
            }

            // Sort by file creation time (most recent first)
            return logFiles.sort((a, b) => {
                const statA = fs.statSync(a);
                const statB = fs.statSync(b);
                return statB.birthtimeMs - statA.birthtimeMs;
            })[0];
        } catch (error) {
            console.error('Failed to get most recent log file:', error);
            return null;
        }
    }
}

// Create singleton logger instance
const logger = Logger.getInstance();

// Initialize the window ID for the logger
if (isElectron()) {
    const ipcRenderer = window.ipcRenderer;
    if (ipcRenderer && ipcRenderer.invoke) {
        ipcRenderer.invoke('get-window-id')
            .then(id => {
                if (id !== null) {
                    logger.setWindowId(id);
                }
            })
            .catch(err => console.error('Failed to get window ID for logger:', err));
    }
}

// Export convenience methods
export const initializeLogger = async (): Promise<void> => await logger.initialize();
export const logDebug = (message: string, data?: any): void => logger.debug(message, data);
export const logInfo = (message: string, data?: any): void => logger.info(message, data);
export const logWarn = (message: string, error?: Error | unknown): void => logger.warn(message, error);
export const logError = (message: string, error?: Error | unknown): void => logger.error(message, error);
export const getLogFiles = (): string[] => logger.getLogFiles();
export const getLogFilePath = (): string => logger.getLogFilePath();
export const getMostRecentLogFile = (): string | null => logger.getMostRecentLogFile();
export const setLogLevel = (level: number): void => logger.setLogLevel(level);
export const cleanupOldLogFiles = async (days: number = 7): Promise<void> => await logger.cleanupOldLogFiles(days);

// Export logger and LogLevel enum for advanced usage
export { LogLevel };
export default logger;