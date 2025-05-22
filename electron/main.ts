import { app, BrowserWindow, shell, ipcMain, dialog, Menu, net, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { initializeIpcHandlers, initializeApp } from '../src/services/electron/mainProcessService';
import dockerComposeService from '../src/services/docker/dockerComposeService';
import settingsService from "../src/services/settings/settingsService";
import { setLogFileLock, getLogFileLock } from './logger-lock';
import { fileURLToPath } from 'url';

// Docker path enhancement to ensure Docker commands work
// This fixes the "docker: command not found" issue on macOS
function enhanceDockerPath() {
  try {
    // Docker path configuration for different platforms
    const DOCKER_PATH_CONFIG = {
      darwin: [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/Applications/Docker.app/Contents/Resources/bin',
        path.join(os.homedir(), '.docker/bin')
      ],
      linux: [
        '/usr/bin',
        '/usr/local/bin'
      ],
      win32: [
        'C:\\Program Files\\Docker\\Docker\\resources\\bin',
        path.join(os.homedir(), 'AppData\\Local\\Docker\\Docker\\resources\\bin')
      ]
    };

    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const possiblePaths = DOCKER_PATH_CONFIG[platform] || [];
    
    // Filter paths that actually exist
    const existingPaths = possiblePaths.filter(p => {
      try {
        return fs.existsSync(p);
      } catch (error) {
        return false;
      }
    });
    
    // Get current PATH
    const currentPath = process.env.PATH || '';
    
    // Create new PATH with platform-specific separator
    const pathSeparator = platform === 'win32' ? ';' : ':';
    const enhancedPath = [...existingPaths, currentPath].join(pathSeparator);
    
    // Set the enhanced PATH
    process.env.PATH = enhancedPath;
    
    console.log(`Enhanced PATH for Docker commands: ${process.env.PATH}`);
    return enhancedPath;
  } catch (error) {
    console.error('Error enhancing Docker PATH:', error);
    return process.env.PATH || '';
  }
}

// Apply the Docker PATH enhancement immediately
enhanceDockerPath();

// Get app directory - for both CommonJS and ESM environments
let appDir = '';
try {
  // Try regular dirname first (CommonJS)
  appDir = __dirname;
  console.log('Using CommonJS __dirname:', appDir);
} catch (e) {
  // If that fails, try to use app.getAppPath() as fallback
  try {
    console.log('CommonJS __dirname not available, using fallback');
    appDir = app.getAppPath();
    console.log('Using app path fallback:', appDir);
  } catch (e2) {
    // Last resort - use current working directory
    console.error('Both __dirname and app.getAppPath() failed:', e2);
    appDir = process.cwd();
    console.log('Using cwd fallback:', appDir);
  }
}

// Log the environment and paths for easier debugging
console.log('Node environment:', process.env.NODE_ENV);
console.log('Current working directory:', process.cwd());
console.log('App directory:', appDir);

let ACTIVE_LOG_FILE: string | null = null;

// Log rotation configuration
const LOG_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB in bytes
const MAX_LOG_FILES = 5; // Maximum number of rotated log files to keep


// Simple inline logger for the main process
const logInfo = (message: string, data?: any) => {
  const logMessage = `[${new Date().toLocaleString()}] [INFO] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(logMessage);
  appendToLogFile(logMessage);
};

const logError = (message: string, error?: any) => {
  let errorStr = '';
  if (error) {
    if (error instanceof Error) {
      errorStr = `\n${error.stack || error.message}`;
    } else {
      try {
        errorStr = `\n${JSON.stringify(error)}`;
      } catch {
        errorStr = `\n${String(error)}`;
      }
    }
  }

  const logMessage = `[${new Date().toLocaleString()}] [ERROR] ${message}${errorStr}`;
  console.error(logMessage);
  appendToLogFile(logMessage);
};

// Get log file path
function getLogFilePath() {
  try {
    const appDataPath = app.getPath('userData');
    let workDirPath = null;

    // Try to get work directory path
    const workDirFilePath = path.join(appDataPath, 'workdir.json');
    if (fs.existsSync(workDirFilePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(workDirFilePath, 'utf-8'));
        workDirPath = data.workDir;
      } catch (err) {
        console.error('Error parsing workdir.json:', err);
      }
    }

    // Create logs directory
    const logsPath = workDirPath ? path.join(workDirPath, 'logs') : path.join(appDataPath, 'logs');
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }

    // Using a fixed log file name instead of timestamp-based
    return path.join(logsPath, 'app.log');
  } catch (err) {
    console.error('Error getting log file path:', err);
    return null;
  }
}

// Global log file path
let logFilePath: string | null = null;

// Initialize log file
function initLogFile() {
  try {
    logFilePath = getLogFilePath();
    if (logFilePath) {
      if (!fs.existsSync(logFilePath)) {
        // Create new log file if it doesn't exist
        const initialMessage =
            `===============================================\n` +
            `Odoo Manager - Application Log (Main Process)\n` +
            `Started: ${new Date().toLocaleString()}\n` +
            `Environment: ${process.env.NODE_ENV || 'unknown'}\n` +
            `===============================================\n`;

        fs.writeFileSync(logFilePath, initialMessage);
        console.log(`Log file created at: ${logFilePath}`);
      } else {
        // Add a session separator to existing log file
        const sessionMessage =
            `\n===============================================\n` +
            `Session started: ${new Date().toLocaleString()}\n` +
            `===============================================\n`;
        
        // Check if log file needs rotation before appending
        checkAndRotateLogFile();
        
        fs.appendFileSync(logFilePath, sessionMessage);
        console.log(`Using existing log file at: ${logFilePath}`);
      }
    }
  } catch (err) {
    console.error('Error initializing log file:', err);
  }
}

/**
 * Check if log file needs rotation based on size
 * @returns true if log rotation was performed, false otherwise
 */
function checkAndRotateLogFile(): boolean {
  if (!logFilePath || !fs.existsSync(logFilePath)) {
    return false;
  }

  try {
    const stats = fs.statSync(logFilePath);
    if (stats.size < LOG_FILE_SIZE_LIMIT) {
      return false; // No rotation needed
    }

    console.log(`Log file size (${stats.size} bytes) exceeds limit (${LOG_FILE_SIZE_LIMIT} bytes), rotating logs...`);
    
    // Get the logs directory
    const logsDir = path.dirname(logFilePath);
    
    // Get existing rotated log files
    const baseLogName = path.basename(logFilePath, '.log');
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
    fs.renameSync(logFilePath, rotatedLogPath);
    console.log(`Rotated main log file: ${logFilePath} -> ${rotatedLogPath}`);
    
    // Create a new empty log file
    const now = new Date();
    const initialMessage =
      `===============================================\n` +
      `Odoo Manager - Application Log (Rotated)\n` +
      `Started: ${now.toLocaleString()}\n` +
      `Environment: ${process.env.NODE_ENV || 'unknown'}\n` +
      `===============================================\n`;
    fs.writeFileSync(logFilePath, initialMessage);
    
    return true;
  } catch (err) {
    console.error('Error rotating log file:', err);
    return false;
  }
}

// Append to log file
function appendToLogFile(message: string) {
  if (!logFilePath) return;

  try {
    // Check if log file needs rotation before appending
    checkAndRotateLogFile();
    
    fs.appendFileSync(logFilePath, message + '\n');
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}

// Log cleanup functionality removed as log rotation handles this now

// Set application metadata
app.setName('odoo-manager');
app.setAboutPanelOptions({
  applicationName: 'Odoo Manager',
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
  copyright: '© 2025 WebGraphix',
  authors: ['WebGraphix'],
  website: 'https://odoo.webgraphix.online',
  credits: 'Professional Odoo instance management tool for Docker environments'
});

// Global declarations for TypeScript
declare global {
  var allowSplashClose: boolean;
  var comingFromSetup: boolean;
  var currentThemeMode: string | null;
  var themeUpdateInProgress: boolean;
}

// Initialize global variables
global.allowSplashClose = false;
global.comingFromSetup = false;
global.currentThemeMode = null;
global.themeUpdateInProgress = false;

// Define interface for ipcMain with handlers property
interface IpcMainWithHandlers extends Electron.IpcMain {
  handlers?: Record<string, (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>>;
}

// Cast ipcMain to our extended interface
const typedIpcMain = ipcMain as IpcMainWithHandlers;

ipcMain.on('register-log-file', (_event, logFilePath) => {
  try {
    if (!ACTIVE_LOG_FILE && logFilePath && fs.existsSync(logFilePath)) {
      ACTIVE_LOG_FILE = logFilePath;
      setLogFileLock(logFilePath);
      logInfo(`Registered active log file: ${logFilePath}`);
    }
  } catch (err) {
    console.error('Error registering log file:', err);
  }
});

ipcMain.handle('get-active-log-file', () => {
  try {
    // Always get fresh from lock file to ensure we're not using a stale lock
    ACTIVE_LOG_FILE = getLogFileLock();
    return ACTIVE_LOG_FILE;
  } catch (err) {
    console.error('Error getting active log file:', err);
    return null;
  }
});

// Get log file path handler
ipcMain.handle('get-log-file-path', async () => {
  try {
    const appDataPath = app.getPath('userData');
    let workDirPath = null;
    
    // Try to get work directory path
    const workDirFilePath = path.join(appDataPath, 'workdir.json');
    if (fs.existsSync(workDirFilePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(workDirFilePath, 'utf-8'));
        workDirPath = data.workDir;
      } catch (err) {
        logError('Error parsing workdir.json', err);
      }
    }
    
    // Get the logs directory
    const logsPath = workDirPath && fs.existsSync(workDirPath) 
      ? path.join(workDirPath, 'logs') 
      : path.join(appDataPath, 'logs');
    
    if (!fs.existsSync(logsPath)) {
      return null;
    }
    
    // Always return the main app.log file if it exists
    const mainLogPath = path.join(logsPath, 'app.log');
    if (fs.existsSync(mainLogPath)) {
      return mainLogPath;
    }
    
    // As a fallback, get the most recent log file
    const logFiles = fs.readdirSync(logsPath)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(logsPath, file));
    
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
    logError('Error in get-log-file-path handler', error);
    return null;
  }
});

// Open log file handler
ipcMain.handle('open-log-file', async (_event, { logFilePath }) => {
  try {
    if (!logFilePath || !fs.existsSync(logFilePath)) {
      logError(`Log file not found: ${logFilePath}`);
      return false;
    }

    await shell.openPath(logFilePath);
    return true;
  } catch (error) {
    logError('Error in open-log-file handler', error);
    return false;
  }
});

// Helper function to emit main-window-visible event
function emitMainWindowVisible(window: Electron.BrowserWindow | null | undefined) {
  if (!window || window.isDestroyed()) return;

  setTimeout(() => {
    if (window && !window.isDestroyed()) {
      window.webContents.send('main-window-visible');
    }
  }, 200);
}

// Handle app termination with confirmation when needed
async function handleAppTermination(mainWindow: BrowserWindow | undefined | null): Promise<boolean> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true; // Allow termination if window doesn't exist
  }

  try {
    // Create a promise that will resolve based on IPC communication
    return new Promise<boolean>((resolve) => {
      // Set up a one-time listener for the response
      const responseHandler = (_event: any, { canTerminate, alreadyConfirmed }: { canTerminate: boolean, alreadyConfirmed?: boolean }) => {
        ipcMain.removeListener('exit-confirmation-response', responseHandler);
        
        // If already confirmed by renderer (user clicked "Exit Anyway"), we don't need further checks
        if (alreadyConfirmed) {
          logInfo('Exit already confirmed by user, allowing termination');
          resolve(true);
          return;
        }
        
        resolve(canTerminate);
      };

      ipcMain.once('exit-confirmation-response', responseHandler);

      // Send the request to check if termination is allowed
      mainWindow.webContents.send('check-running-containers');

      // Set a timeout in case we don't get a response
      setTimeout(() => {
        ipcMain.removeListener('exit-confirmation-response', responseHandler);
        logInfo('No response from renderer about running containers, allowing termination');
        resolve(true);
      }, 2000);
    });
  } catch (error) {
    logError('Error checking for running containers', error);
    return true; // In case of error, allow termination
  }
}

// Helper function for development environment
function loadAndShowDevWindow(window: Electron.BrowserWindow) {
  if (!window || window.isDestroyed()) return;

  window.loadURL('http://localhost:5173/#/main').then(() => {
    if (!window || window.isDestroyed()) return;
    window.show();
    window.focus();
    emitMainWindowVisible(window);
  }).catch(err => {
    logError('Failed to load main URL', err);
    if (!window || window.isDestroyed()) return;
    window.show();
    window.focus();
    emitMainWindowVisible(window);
  });

  if (!window.isDestroyed()) {
    window.webContents.openDevTools({ mode: 'detach' });
  }
}

// Helper function for production environment
function loadAndShowProdWindow(window: Electron.BrowserWindow) {
  if (!window || window.isDestroyed()) return;

  // Use path.resolve for consistent path resolution
  const htmlPath = path.resolve(appDir, '../dist/index.html');
  logInfo(`Loading main file from: ${htmlPath}`);
  
  window.loadFile(htmlPath, { hash: 'main' }).then(() => {
    if (!window || window.isDestroyed()) return;
    window.show();
    window.focus();
    emitMainWindowVisible(window);
  }).catch(err => {
    logError('Failed to load main file', err);
    if (!window || window.isDestroyed()) return;
    window.show();
    window.focus();
    emitMainWindowVisible(window);
  });
}

// Helper function to safely load and show a window based on the environment
function loadAndShowWindow(window: BrowserWindow | null | undefined) {
  if (!window) {
    logError('Cannot load and show a null or undefined window!');
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    loadAndShowDevWindow(window);
  } else {
    loadAndShowProdWindow(window);
  }
}

// Store window references to prevent garbage collection
interface WindowsRegistry {
  splash?: BrowserWindow | undefined;
  main?: BrowserWindow | undefined;
  setup?: BrowserWindow | undefined;
  [key: string]: BrowserWindow | undefined;
}

// Window configuration by type
interface WindowConfig {
  width: number;
  height: number;
  resizable: boolean;
  minWidth?: number;
  minHeight?: number;
  title: string;
}

// Define default window configurations
const windowConfigs: Record<string, WindowConfig> = {
  'main': {
    width: 1200,
    height: 900,
    resizable: true,
    minWidth: 1200,
    minHeight: 750,
    title: 'Odoo Manager'
  },
  'splash': {
    width: 500,
    height: 400,
    resizable: false,
    title: 'Odoo Manager'
  },
  'setup': {
    width: 950,
    height: 800,
    resizable: true,
    minWidth: 800,
    minHeight: 600,
    title: 'Odoo Manager'
  },
  'help': {
    width: 750,
    height: 700,
    resizable: true,
    minWidth: 600,
    minHeight: 500,
    title: 'Odoo Manager - Help'
  },
  "settings": {
    width: 900,
    height: 700,
    resizable: true,
    minWidth: 800,
    minHeight: 600,
    title: "Odoo Manager - Settings"
  },
  'new-instance': {
    width: 600,
    height: 870,
    resizable: true,
    minWidth: 500,
    minHeight: 700,
    title: 'Odoo Manager - New Instance'
  },
  "new-postgres": {
    width: 600,
    height: 820,
    resizable: true,
    minWidth: 500,
    minHeight: 700,
    title: 'Odoo Manager - New PostgreSQL Instance'
  },
  'container-info': {
    width: 700,
    height: 850,
    resizable: true,
    minWidth: 700,
    minHeight: 850,
    title: 'Odoo Manager - Container Info'
  },
  'container-logs': {
    width: 800,
    height: 860,
    resizable: true,
    minWidth: 600,
    minHeight: 700,
    title: 'Odoo Manager - Container Logs'
  }
};

// Get window config with fallback to default
function getWindowConfig(type: string): WindowConfig {
  return windowConfigs[type] || {
    width: 800,
    height: 600,
    resizable: true,
    title: `Odoo Manager - ${type}`
  };
}

const windows: WindowsRegistry = {};

// Check if setup is completed
async function isSetupCompleted(): Promise<{completed: boolean}> {
  try {
    // Windows-specific behavior - only check if workdir.json exists in AppData
    if (process.platform === 'win32') {
      const appDataPath = app.getPath('userData');
      const workDirFilePath = path.join(appDataPath, 'workdir.json');
      
      // For Windows, we consider setup complete if the workdir.json file exists
      // This simplifies the Windows setup process
      if (fs.existsSync(workDirFilePath)) {
        logInfo('Windows: workdir.json exists, setup completed');
        
        // Additional verification - check if settings.json also exists
        try {
          const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, 'utf8'));
          const workDir = workDirData.workDir;
          
          // Log the actual path stored in workdir.json
          logInfo(`Windows: workdir.json points to: ${workDir}`);
          
          // Check if the workDir exists and contains settings.json
          const settingsPath = path.join(workDir, 'settings.json');
          const settingsExists = fs.existsSync(settingsPath);
          logInfo(`Windows: Settings file exists at ${settingsPath}? ${settingsExists}`);
          
          return { completed: settingsExists };
        } catch (err) {
          logError('Windows: Error parsing workdir.json or checking settings', err);
          return { completed: false };
        }
      } else {
        logInfo('Windows: workdir.json does not exist, setup not completed');
        return { completed: false };
      }
    }
    
    // Original behavior for other platforms
    const workDirFilePath = path.join(app.getPath('userData'), 'workdir.json');

    if (!fs.existsSync(workDirFilePath)) {
      logInfo('Work directory file does not exist, setup not completed');
      return { completed: false };
    }

    const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, 'utf8'));
    const workDir = workDirData.workDir;

    if (!workDir || !fs.existsSync(workDir)) {
      logInfo('Work directory does not exist, setup not completed');
      return { completed: false };
    }

    const settingsPath = path.join(workDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      logInfo('Settings file does not exist, setup not completed');
      return { completed: false };
    }

    return { completed: true };
  } catch (error) {
    logError('Error checking setup status', error);
    return { completed: false };
  }
}

// Create setup window
function createSetupWindow() {
  logInfo("Creating setup window");

  const mainConfig = getWindowConfig("main");
  const setupConfig = getWindowConfig("setup");

  // Define preloadPath based on environment - ensure path resolution works correctly
  const preloadPath = process.env.NODE_ENV === 'development' 
    ? path.join(process.cwd(), 'dist-electron', 'preload.js')
    : path.join(appDir, 'preload.js');
  
  logInfo(`Using preload path for setup window: ${preloadPath}`);

  const setupWindow = new BrowserWindow({
    width: mainConfig.width,
    height: mainConfig.height,
    minWidth: mainConfig.minWidth,
    minHeight: mainConfig.minHeight,
    center: true,
    show: false,
    backgroundColor: '#121212',
    title: setupConfig.title,
    titleBarStyle: 'default',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  setupWindow.setTitle(setupConfig.title);

  setupWindow.webContents.on('did-finish-load', () => {
    setupWindow.setTitle(setupConfig.title);
  });

  setupWindow.once('ready-to-show', () => {
    setupWindow.show();
    setupWindow.focus();
  });

  if (process.env.NODE_ENV === 'development') {
    setupWindow.loadURL('http://localhost:5173/#/setup').catch(err => {
      logError('Failed to load setup URL', err);
    });
    setupWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    setupWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'setup' }).catch(err => {
      logError('Failed to load setup file', err);
    });
  }

  setupWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(err => {
      logError(`Failed to open external URL: ${url}`, err);
    });
    return { action: 'deny' };
  });

  windows.setup = setupWindow;

  return setupWindow;
}

// Create splash window
function createSplashWindow() {
  logInfo("Creating splash window");
  const config = getWindowConfig("splash");

  // Define preloadPath based on environment - ensure path resolution works correctly
  const preloadPath = process.env.NODE_ENV === 'development' 
    ? path.join(process.cwd(), 'dist-electron', 'preload.js')
    : path.join(appDir, 'preload.js');
  
  logInfo(`Using preload path: ${preloadPath}`);

  const splash = new BrowserWindow({
    width: 500,
    height: 600,
    center: true,
    frame: false,
    transparent: process.platform !== 'linux',
    backgroundColor: process.platform === 'linux' ? '#121212' : undefined,
    resizable: false,
    movable: true,
    title: config.title,
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
      devTools: process.env.NODE_ENV === 'development'
    }
  });

  if (process.env.NODE_ENV === 'development') {
    splash.webContents.openDevTools({ mode: 'detach' });
  }

  splash.on('close', (event) => {
    if (global.allowSplashClose) {
      return;
    }

    event.preventDefault();
    app.emit('verification-complete' as any);
  });

  splash.once('ready-to-show', () => {
    splash.show();
  });

  if (process.env.NODE_ENV === 'development') {
    splash.loadURL('http://localhost:5173/#/splash').catch(err => {
      logError('Failed to load splash URL', err);
    });
  } else {
    // Use path.resolve rather than path.join to ensure correct path resolution
    const htmlPath = path.resolve(appDir, '../dist/index.html');
    logInfo(`Loading splash file from: ${htmlPath}`);
    splash.loadFile(htmlPath, { hash: 'splash' }).catch(err => {
      logError('Failed to load splash file', err);
    });
  }

  windows.splash = splash;

  return splash;
}

// Create main window
function createMainWindow() {
  logInfo('Creating main window');

  const config = getWindowConfig('main');

  // Define preloadPath based on environment - ensure path resolution works correctly
  const preloadPath = process.env.NODE_ENV === 'development' 
    ? path.join(process.cwd(), 'dist-electron', 'preload.js')
    : path.join(appDir, 'preload.js');
  
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
    backgroundColor: '#121212',
    titleBarStyle: 'default',
    title: config.title,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setTitle(config.title);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle(config.title);
  });

  // Track if we're in the termination process
  let terminationInProgress = false;

  mainWindow.on('close', async (event) => {
    // If we're already handling termination, don't trigger again
    if (terminationInProgress) {
      return;
    }

    event.preventDefault();
    terminationInProgress = true;

    const shouldTerminate = await handleAppTermination(mainWindow);

    if (shouldTerminate) {
      logInfo('App termination approved, quitting...');
      terminationInProgress = false;
      mainWindow.removeAllListeners('close');
      app.quit();
    } else {
      logInfo('App termination cancelled by user');
      terminationInProgress = false;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(err => {
      logError(`Failed to open external URL: ${url}`, err);
    });
    return { action: 'deny' };
  });

  windows.main = mainWindow;

  return mainWindow;
}

// Create a new window of specified type
function createWindow(windowType: string, options: any = {}) {
  logInfo(`Creating window: ${windowType}`);

  const defaultConfig = getWindowConfig(windowType);

  // Define preloadPath based on environment - ensure path resolution works correctly
  const preloadPath = process.env.NODE_ENV === 'development' 
    ? path.join(process.cwd(), 'dist-electron', 'preload.js')
    : path.join(appDir, 'preload.js');
  
  logInfo(`Using preload path for ${windowType} window: ${preloadPath}`);

  const window = new BrowserWindow({
    width: options.width || defaultConfig.width,
    height: options.height || defaultConfig.height,
    minWidth: options.minWidth || defaultConfig.minWidth,
    minHeight: options.minHeight || defaultConfig.minHeight,
    resizable: options.hasOwnProperty('resizable') ? options.resizable : defaultConfig.resizable,
    center: true,
    show: false,
    frame: true,
    title: options.title || defaultConfig.title,
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: 'default',
    modal: options.modal === true,
    backgroundColor: '#121212',
    parent: options.parent && windows[options.parent] ? windows[options.parent] : undefined,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false,
      additionalArguments: options.data ? [`--window-data=${JSON.stringify(options.data)}`] : []
    },
  });

  const windowTitle = options.title || defaultConfig.title;
  window.setTitle(windowTitle);

  window.webContents.on('did-finish-load', () => {
    window.setTitle(windowTitle);
  });

  if (!options.modal) {
    window.setParentWindow(null);
  }

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    window.loadURL(`http://localhost:5173/#/${windowType}`).catch(err => {
      logError(`Failed to load ${windowType} URL`, err);
      if (!window.isDestroyed()) {
        window.show();
      }
    });

    if (options.openDevTools) {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    window.loadFile(path.join(appDir, '../dist/index.html'), { hash: windowType }).catch(err => {
      logError(`Failed to load ${windowType} file`, err);
      if (!window.isDestroyed()) {
        window.show();
      }
    });
  }

  windows[windowType] = window;

  // Add isClosing property to BrowserWindow
  (window as any).isClosing = false;

  // Add custom close method with animation
  const originalClose = window.close.bind(window);
  (window as any).originalClose = originalClose;
  window.close = function() {
    if (window.isDestroyed() || (window as any).isClosing) {
      return originalClose();
    }

    (window as any).isClosing = true;

    if (!window.isDestroyed() && window.webContents) {
      window.webContents.send('window-fade-out');

      ipcMain.once('window-fade-out-confirm', () => {
        let opacity = 1.0;
        const fadeStep = 0.1;
        const fadeInterval = setInterval(() => {
          if (window.isDestroyed()) {
            clearInterval(fadeInterval);
            return;
          }

          opacity -= fadeStep;
          if (opacity <= 0) {
            clearInterval(fadeInterval);
            if (!window.isDestroyed()) {
              originalClose();
            }
          } else {
            window.setOpacity(opacity);
          }
        }, 10);
      });

      setTimeout(() => {
        if (!window.isDestroyed() && (window as any).isClosing) {
          originalClose();
        }
      }, 800);
    } else {
      originalClose();
    }
    return undefined;
  };

  window.on('close', (event) => {
    if (!(window as any).isClosing) {
      event.preventDefault();
      window.close();
    }
  });

  window.on('closed', () => {
    windows[windowType] = undefined;
  });

  return window;
}

function showMainWindow() {
  logInfo('showMainWindow function called');

  try {
    global.allowSplashClose = true;

    const mainExists = windows.main && !windows.main.isDestroyed();
    const splashExists = windows.splash && !windows.splash.isDestroyed();
    
    logInfo(`Window state: main exists=${mainExists}, splash exists=${splashExists}`);

    // Special handling for Windows platform to debug issues
    if (process.platform === 'win32') {
      logInfo('Windows platform: executing showMainWindow');
      
      // Force-close the splash window if it exists
      if (splashExists && windows.splash) {
        try {
          logInfo('Windows: Force-closing splash window');
          windows.splash.destroy(); // Use destroy instead of close to ensure it closes
        } catch (err) {
          logError('Windows: Error force-closing splash window', err);
        }
      }
      
      // Show the main window immediately
      if (mainExists && windows.main) {
        logInfo('Windows: Showing existing main window');
        loadAndShowWindow(windows.main);
        return;
      } else {
        logInfo('Windows: Creating and showing new main window');
        const newMain = createMainWindow();
        setTimeout(() => {
          loadAndShowWindow(newMain);
        }, 100);
        return;
      }
    }

    // Original code for non-Windows platforms
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
                logError('Error closing splash window', err);
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
      }, 2000);

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
          logError('Error closing splash window', err);
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
    logError('Error in showMainWindow', error);
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
          logError('Error closing splash window', err);
          newMain.show();
          emitMainWindowVisible(newMain);
        }
      } else {
        newMain.show();
        emitMainWindowVisible(newMain);
      }
    } catch (fallbackError) {
      logError('Failed to create fallback main window', fallbackError);
    }
  }
}

// Create the macOS application menu
function createAppMenu() {
  if (process.platform !== 'darwin') return;

  logInfo('Creating macOS application menu');

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => {
            if (windows.settings && !windows.settings.isDestroyed()) {
              windows.settings.focus();
            } else {
              createWindow('settings');
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Odoo Instance',
          accelerator: 'Cmd+N',
          click: () => {
            if (windows.main && !windows.main.isDestroyed()) {
              createWindow('new-instance');
            }
          }
        },
        {
          label: 'New PostgreSQL Instance',
          accelerator: 'Shift+Cmd+N',
          click: () => {
            if (windows.main && !windows.main.isDestroyed()) {
              createWindow('new-postgres');
            }
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Help',
          accelerator: 'Cmd+H',
          click: () => {
            if (windows.help && !windows.help.isDestroyed()) {
              windows.help.focus();
            } else {
              createWindow('help');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Open Application Logs',
          click: async () => {
            try {
              const event = {
                sender: windows.main?.webContents
              } as Electron.IpcMainInvokeEvent;

              // Type assertion to access handlers
              const handler = typedIpcMain.handlers?.['get-log-file-path'];
              if (handler) {
                const logFilePath = await handler(event);
                if (logFilePath) {
                  await shell.openPath(logFilePath);
                } else {
                  dialog.showMessageBox({
                    type: 'info',
                    title: 'No Logs Available',
                    message: 'No application logs were found.'
                  });
                }
              }
            } catch (error) {
              logError('Error opening application logs', error);
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Setup Windows-specific defaults to ensure app works properly on Windows 
 * This function handles the Windows-specific configuration to address path issues
 */
async function setupWindowsDefaults(): Promise<boolean> {
  try {
    logInfo('Setting up Windows-specific default configuration');
    const appDataPath = app.getPath('userData');
    logInfo(`Using AppData path: ${appDataPath}`);

    // Debug - show directory contents
    try {
      const appDataContents = fs.readdirSync(appDataPath);
      logInfo(`AppData contents: ${JSON.stringify(appDataContents)}`);
    } catch (err) {
      logError('Error reading AppData directory', err);
    }

    // Create workdir.json in AppData pointing to itself
    const workDirFilePath = path.join(appDataPath, 'workdir.json');
    if (!fs.existsSync(workDirFilePath)) {
      try {
        fs.writeFileSync(workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
        logInfo(`Created workdir.json in AppData pointing to itself: ${appDataPath}`);
      } catch (err) {
        logError('Error creating workdir.json', err);
        return false;
      }
    } else {
      logInfo(`workdir.json already exists in AppData`);
      try {
        // Validate the existing workdir.json
        const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, 'utf8'));
        logInfo(`Existing workdir.json contents: ${JSON.stringify(workDirData)}`);
        
        // Ensure workDir is set to appDataPath
        if (workDirData.workDir !== appDataPath) {
          logInfo(`Updating workdir.json to point to correct AppData path`);
          workDirData.workDir = appDataPath;
          fs.writeFileSync(workDirFilePath, JSON.stringify(workDirData, null, 2));
        }
      } catch (err) {
        logError('Error reading/updating existing workdir.json', err);
        // Try to recreate it
        try {
          fs.writeFileSync(workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
          logInfo(`Recreated workdir.json after error`);
        } catch (writeErr) {
          logError('Failed to recreate workdir.json', writeErr);
          return false;
        }
      }
    }

    // Create default settings.json in the AppData directory
    const settingsPath = path.join(appDataPath, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      try {
        const defaultSettings = {
          theme: 'dark',
          language: 'en',
          network: 'odoo-network',
          showWelcomeScreen: true,
          autoCheckUpdates: true,
          updateCheckFrequency: 'daily',
          showUpdateNotifications: true,
          lastUpdateCheck: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
        logInfo(`Created default settings.json in AppData`);
      } catch (err) {
        logError('Error creating settings.json', err);
        return false;
      }
    } else {
      logInfo(`settings.json already exists in AppData at: ${settingsPath}`);
      try {
        const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        logInfo(`Existing settings.json contents: ${JSON.stringify(settingsData)}`);
      } catch (err) {
        logError('Error reading existing settings.json', err);
        // Try to recreate it
        try {
          const defaultSettings = {
            theme: 'dark',
            language: 'en',
            network: 'odoo-network',
            showWelcomeScreen: true,
            autoCheckUpdates: true,
            updateCheckFrequency: 'daily',
            showUpdateNotifications: true,
            lastUpdateCheck: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
          logInfo(`Recreated settings.json after error`);
        } catch (writeErr) {
          logError('Failed to recreate settings.json', writeErr);
          return false;
        }
      }
    }

    // Ensure necessary directories exist (odoo, postgres, logs)
    const odooDir = path.join(appDataPath, 'odoo');
    const postgresDir = path.join(appDataPath, 'postgres');
    const logsDir = path.join(appDataPath, 'logs');

    try {
      if (!fs.existsSync(odooDir)) {
        fs.mkdirSync(odooDir, { recursive: true });
        logInfo(`Created odoo directory in AppData: ${odooDir}`);
      } else {
        logInfo(`odoo directory already exists: ${odooDir}`);
      }
    } catch (err) {
      logError('Error creating odoo directory', err);
      return false;
    }

    try {
      if (!fs.existsSync(postgresDir)) {
        fs.mkdirSync(postgresDir, { recursive: true });
        logInfo(`Created postgres directory in AppData: ${postgresDir}`);
      } else {
        logInfo(`postgres directory already exists: ${postgresDir}`);
      }
    } catch (err) {
      logError('Error creating postgres directory', err);
      return false;
    }

    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
        logInfo(`Created logs directory in AppData: ${logsDir}`);
      } else {
        logInfo(`logs directory already exists: ${logsDir}`);
      }
    } catch (err) {
      logError('Error creating logs directory', err);
      return false;
    }

    // Verify everything was created correctly
    let setupSuccessful = true;
    if (!fs.existsSync(workDirFilePath)) {
      logError('workdir.json was not created successfully');
      setupSuccessful = false;
    }
    if (!fs.existsSync(settingsPath)) {
      logError('settings.json was not created successfully');
      setupSuccessful = false;
    }
    if (!fs.existsSync(odooDir)) {
      logError('odoo directory was not created successfully');
      setupSuccessful = false;
    }
    if (!fs.existsSync(postgresDir)) {
      logError('postgres directory was not created successfully');
      setupSuccessful = false;
    }
    if (!fs.existsSync(logsDir)) {
      logError('logs directory was not created successfully');
      setupSuccessful = false;
    }

    logInfo(`Windows-specific default configuration completed successfully: ${setupSuccessful}`);
    return setupSuccessful;
  } catch (error) {
    logError('Error setting up Windows-specific defaults', error);
    return false;
  }
}

app.whenReady().then(async () => {
  // Initialize log file
  initLogFile();

  logInfo('Application ready, initializing...');

  ACTIVE_LOG_FILE = getLogFileLock();
  if (ACTIVE_LOG_FILE) {
    logInfo(`Found existing log file from lock: ${ACTIVE_LOG_FILE}`);
  }

  initializeIpcHandlers();
  createAppMenu();

  // Log cleanup code removed - now handled by log rotation

  // Handle create-instance message from renderer
  ipcMain.on('create-instance', async (event, data) => {
    logInfo('[CREATE-INSTANCE] Received create-instance event');

    try {
      const createWithTimeout = async () => {
        return new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Instance creation timed out after 60 seconds. Please check Docker status.'));
          }, 60000);

          const execOperation = async () => {
            try {
              if (data.instanceType === 'postgres') {
                return await dockerComposeService.createPostgresInstance(
                    data.instanceName,
                    data.version,
                    parseInt(data.port, 10) || 5432,
                    data.username || 'postgres',
                    data.password || 'postgres'
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
              logError('[CREATE-INSTANCE] Error in execution', error);
              throw error;
            }
          };

          execOperation()
              .then(res => {
                clearTimeout(timeout);
                resolve(res);
              })
              .catch(err => {
                clearTimeout(timeout);
                reject(err);
              });
        });
      };

      const result = await createWithTimeout();
      logInfo('[CREATE-INSTANCE] Docker Compose operation completed');

      if (result.success) {
        event.sender.send('instance-created', {
          ...data,
          port: result.port,
          instanceType: data.instanceType
        });

        if (windows.main && !windows.main.isDestroyed() &&
            event.sender !== windows.main.webContents) {
          windows.main.webContents.send('instance-created', {
            ...data,
            port: result.port,
            instanceType: data.instanceType
          });
        }
      } else {
        logError('[CREATE-INSTANCE] Error', result.message);
        event.sender.send('instance-creation-error', {
          instanceType: data.instanceType,
          error: result.message || 'Unknown error during instance creation'
        });
      }
    } catch (error) {
      logError('[CREATE-INSTANCE] Error handling request', error);
      event.sender.send('instance-creation-error', {
        instanceType: data.instanceType || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error occurred during instance creation'
      });
    }
  });

  // Handle update-postgres-credentials message from renderer
  ipcMain.handle('update-postgres-credentials', async (_event, data) => {
    logInfo('[UPDATE-POSTGRES-CREDENTIALS] Received update request');
    try {
      const { instanceName, username, password } = data;
      const result = await dockerComposeService.updatePostgresCredentials(instanceName, username, password);

      if (result.updatedInstances && result.updatedInstances.length > 0) {
        logInfo(`[UPDATE-POSTGRES-CREDENTIALS] Updated ${result.updatedInstances.length} dependent Odoo instances`);
      }

      return result;
    } catch (error) {
      logError('[UPDATE-POSTGRES-CREDENTIALS] Error updating credentials', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error updating credentials'
      };
    }
  });

  // Windows-specific behavior
  if (process.platform === 'win32') {
    logInfo('Windows platform detected, checking for automatic setup...');
    
    // Set up Windows defaults
    const windowsSetupResult = await setupWindowsDefaults();
    logInfo(`Windows defaults setup result: ${windowsSetupResult ? 'success' : 'failed'}`);
    
    // Check if setup completed (this will use Windows-specific logic we added)
    const { completed } = await isSetupCompleted();
    logInfo(`Windows: Is setup completed? ${completed}`);
    
    if (completed) {
      logInfo('Windows: Setup completed, showing splash screen...');
      
      createSplashWindow();
      createMainWindow();
      initializeApp();
      
      app.addListener('verification-complete' as any, () => {
        logInfo('App event: verification complete signal received');
        showMainWindow();
      });
      
      ipcMain.on('verification-complete', (event) => {
        logInfo('IPC event: verification complete signal received');
        logInfo(`Verification complete received from window ID: ${event.sender.id}`);
        
        // Debug verification path on Windows
        if (process.platform === 'win32') {
          logInfo('Windows platform: Processing verification-complete signal');
          
          if (windows.splash && !windows.splash.isDestroyed()) {
            logInfo('Splash window exists and will be closed');
          } else {
            logInfo('Splash window does not exist or is already destroyed');
          }
          
          if (windows.main && !windows.main.isDestroyed()) {
            logInfo('Main window exists and will be shown');
          } else {
            logInfo('Main window does not exist or is already destroyed');
          }
        }
        
        showMainWindow();
      });
    } else {
      logInfo('Windows: Setup not completed, showing setup screen (this should be rare)...');
      
      const setupWindow = createSetupWindow();
      
      const mainConfig = getWindowConfig('main');
      setupWindow.setSize(mainConfig.width, mainConfig.height);
      if (mainConfig.minWidth && mainConfig.minHeight) {
        setupWindow.setMinimumSize(mainConfig.minWidth, mainConfig.minHeight);
      }
      setupWindow.center();
    }
  } else {
    // Original behavior for non-Windows platforms
    logInfo('Checking if setup is completed...');
    
    const { completed } = await isSetupCompleted();
    
    if (!completed) {
      logInfo('Setup not completed, showing setup screen...');
      
      const setupWindow = createSetupWindow();
      
      const mainConfig = getWindowConfig('main');
      setupWindow.setSize(mainConfig.width, mainConfig.height);
      if (mainConfig.minWidth && mainConfig.minHeight) {
        setupWindow.setMinimumSize(mainConfig.minWidth, mainConfig.minHeight);
      }
      setupWindow.center();
    }
    else {
      logInfo('Normal startup, showing splash screen...');
      
      createSplashWindow();
      createMainWindow();
      initializeApp();
      
      app.addListener('verification-complete' as any, () => {
        logInfo('App event: verification complete signal received');
        showMainWindow();
      });
      
      ipcMain.on('verification-complete', (event) => {
        logInfo('IPC event: verification complete signal received');
        logInfo(`Verification complete received from window ID: ${event.sender.id}`);
        
        // Debug verification path on Windows
        if (process.platform === 'win32') {
          logInfo('Windows platform: Processing verification-complete signal');
          
          if (windows.splash && !windows.splash.isDestroyed()) {
            logInfo('Splash window exists and will be closed');
          } else {
            logInfo('Splash window does not exist or is already destroyed');
          }
          
          if (windows.main && !windows.main.isDestroyed()) {
            logInfo('Main window exists and will be shown');
          } else {
            logInfo('Main window does not exist or is already destroyed');
          }
        }
        
        showMainWindow();
      });
    }
  }

  ipcMain.on('sync-theme', (_event, { mode, source }) => {
    if (global.themeUpdateInProgress) {
      logInfo(`Ignoring theme sync during update: ${mode} from ${source || 'unknown'}`);
      return;
    }

    global.themeUpdateInProgress = true;

    logInfo(`Syncing theme to all windows: ${mode} from ${source || 'unknown'}`);

    if (global.currentThemeMode !== mode) {
      global.currentThemeMode = mode;

      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          if (source && window.webContents.id === parseInt(source)) {
            logInfo(`Skipping theme update to source window: ${source}`);
          } else {
            window.webContents.send('theme-changed', mode);
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

  // Handle open-file message from renderer
  ipcMain.on('open-file', (event, { instanceName, instanceType, filePath }) => {
    logInfo(`Opening file for instance: ${instanceName}, file: ${filePath}`);

    try {
      const workDirPath = app.getPath('userData');
      const fullPath = path.join(workDirPath, instanceType, instanceName, filePath);

      if (fs.existsSync(fullPath)) {
        shell.openPath(fullPath).catch(err => {
          logError('Error opening file', err);
          event.sender.send('show-error-dialog', {
            title: 'Error',
            message: `Could not open file: ${err.message}`
          });
        });
      } else {
        const workDirFilePath = path.join(app.getPath('userData'), 'workdir.json');
        if (fs.existsSync(workDirFilePath)) {
          try {
            const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, 'utf8'));
            const alternativePath = path.join(workDirData.workDir, instanceType, instanceName, filePath);

            if (fs.existsSync(alternativePath)) {
              shell.openPath(alternativePath).catch(err => {
                logError('Error opening file', err);
                event.sender.send('show-error-dialog', {
                  title: 'Error',
                  message: `Could not open file: ${err.message}`
                });
              });
            } else {
              event.sender.send('show-error-dialog', {
                title: 'File Not Found',
                message: `File does not exist: ${filePath}`
              });
            }
          } catch (error) {
            logError('Error parsing workdir.json', error);
            event.sender.send('show-error-dialog', {
              title: 'Error',
              message: 'Could not determine work directory path'
            });
          }
        }
      }
    } catch (error) {
      logError('Error handling open file request', error);
      event.sender.send('show-error-dialog', {
        title: 'Error',
        message: `Could not open file: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  // Add handler for updating DB filter
  ipcMain.handle('update-odoo-config', async (_event, { instanceName, dbFilter }) => {
    logInfo(`Updating DB filter for instance: ${instanceName}, value: ${dbFilter}`);

    try {
      const workDirPath = await settingsService.getWorkDirPath() || app.getPath('userData');
      const instanceDir = path.join(workDirPath, 'odoo', instanceName);
      const configFile = path.join(instanceDir, 'config', 'odoo.conf');

      if (!fs.existsSync(configFile)) {
        return { success: false, message: 'Config file not found' };
      }

      let configContent = fs.readFileSync(configFile, 'utf8');

      if (dbFilter) {
        if (configContent.includes('dbfilter =')) {
          configContent = configContent.replace(/dbfilter =.*\n/, `dbfilter = ^${instanceName}.*$\n`);
        } else {
          configContent += `\ndbfilter = ^${instanceName}.*$`;
        }
      } else {
        configContent = configContent.replace(/dbfilter =.*\n/, '');
      }

      fs.writeFileSync(configFile, configContent, 'utf8');

      const infoFile = path.join(instanceDir, 'instance-info.json');
      if (fs.existsSync(infoFile)) {
        try {
          const infoContent = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
          infoContent.dbFilter = dbFilter;
          infoContent.updatedAt = new Date().toISOString();
          fs.writeFileSync(infoFile, JSON.stringify(infoContent, null, 2), 'utf8');
        } catch (error) {
          logError('Error updating instance info', error);
        }
      }

      return { success: true, message: 'DB filter updated successfully' };
    } catch (error) {
      logError('Error updating DB filter', error);
      return {
        success: false,
        message: `Error updating DB filter: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });

  ipcMain.on('open-instance-folder', (event, { instanceName, instanceType }) => {
    logInfo(`Opening ${instanceType} folder for instance: ${instanceName}`);

    try {
      const workDirPath = path.join(app.getPath('userData'));
      const instancePath = path.join(workDirPath, instanceType, instanceName);

      if (fs.existsSync(instancePath)) {
        shell.openPath(instancePath).catch(err => {
          logError(`Error opening ${instanceType} folder`, err);
          event.sender.send('show-error-dialog', {
            title: 'Error',
            message: `Could not open folder: ${err.message}`
          });
        });
      } else {
        const workDirFilePath = path.join(app.getPath('userData'), 'workdir.json');
        if (fs.existsSync(workDirFilePath)) {
          try {
            const workDirData = JSON.parse(fs.readFileSync(workDirFilePath, 'utf8'));
            const alternativePath = path.join(workDirData.workDir, instanceType, instanceName);

            if (fs.existsSync(alternativePath)) {
              shell.openPath(alternativePath).catch(err => {
                logError(`Error opening alternative ${instanceType} folder`, err);
                event.sender.send('show-error-dialog', {
                  title: 'Error',
                  message: `Could not open folder: ${err.message}`
                });
              });
            } else {
              event.sender.send('show-error-dialog', {
                title: 'Folder Not Found',
                message: `Instance folder does not exist: ${instanceName}`
              });
            }
          } catch (error) {
            logError('Error parsing workdir.json', error);
            event.sender.send('show-error-dialog', {
              title: 'Error',
              message: 'Could not determine work directory path'
            });
          }
        } else {
          event.sender.send('show-error-dialog', {
            title: 'Folder Not Found',
            message: `Instance folder does not exist: ${instanceName}`
          });
        }
      }
    } catch (error) {
      logError('Error handling open folder request', error);
      event.sender.send('show-error-dialog', {
        title: 'Error',
        message: `Could not open folder: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  ipcMain.handle('get-current-theme', (_event) => {
    logInfo(`Current theme requested, returning: ${global.currentThemeMode || 'null'}`);
    return global.currentThemeMode;
  });

  ipcMain.handle('get-window-id', (event) => {
    try {
      const webContents = event.sender;
      const win = BrowserWindow.fromWebContents(webContents);
      if (win) {
        const id = win.id;
        logInfo(`Window ID requested: ${id}`);
        return id;
      }
      logError('Could not find window from webContents');
      return null;
    } catch (error) {
      logError('Error getting window ID', error);
      return null;
    }
  });

  // Global language storage
  let currentLanguage: string | null = null;

  // Handle language change sync
  ipcMain.on('language-changed', (_event, { language }) => {
    logInfo('Syncing language to all windows: ' + language);

    currentLanguage = language;

    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('language-changed', language);
      }
    });
  });

  // Handler to get current language
  ipcMain.handle('get-current-language', () => {
    return currentLanguage;
  });

  // Handle verification failures
  ipcMain.on('verification-failed', (_event, { error }) => {
    logError('Verification failed', error);
    dialog.showErrorBox('Verification Failed', `Error: ${error}`);
  });

  // Handle window creation requests from renderers
  ipcMain.on('open-window', (_event, { type, options }) => {
    logInfo(`Request to open window: ${type}`);
    createWindow(type, options);
  });

  // Handle window closing requests from renderers
  ipcMain.on('close-window', (_event, { type }) => {
    logInfo(`Request to close window: ${type}`);
    if (windows[type] && !windows[type]?.isDestroyed()) {
      windows[type]?.close();
    }
  });

  // Handle explicit window title setting from renderer
  ipcMain.on('set-window-title', (event, title) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setTitle(title);
    }
  });

  // Handle message dialog requests
  ipcMain.handle('show-message-dialog', async (event, options) => {
    const result = await dialog.showMessageBox(options);
    event.sender.send('dialog-response', result.response);
    return result;
  });

  // Handle open file dialog requests
  ipcMain.handle('show-open-dialog', async (_event, options) => {
    return await dialog.showOpenDialog(options);
  });

  // Handle save file dialog requests
  ipcMain.handle('show-save-dialog', async (_event, options) => {
    return await dialog.showSaveDialog(options);
  });

  // This handler will be called when the setup window signals it's about to close itself
  ipcMain.on('setup-window-closing', () => {
    logInfo('[SETUP-CLOSE] Received setup-window-closing signal');
    global.comingFromSetup = true;
  });

  // Message to resize and prepare the window for main screen
  ipcMain.on('prepare-for-main-screen', () => {
    logInfo('======= PREPARING FOR MAIN SCREEN =======');

    try {
      const currentWindow = BrowserWindow.getFocusedWindow();
      if (!currentWindow) {
        logError('No focused window found!');
        return;
      }

      const mainConfig = getWindowConfig('main');

      currentWindow.setSize(mainConfig.width, mainConfig.height);

      if (mainConfig.minWidth && mainConfig.minHeight) {
        currentWindow.setMinimumSize(mainConfig.minWidth, mainConfig.minHeight);
      }

      currentWindow.setResizable(mainConfig.resizable);
      currentWindow.setTitle(mainConfig.title);
      currentWindow.center();

      logInfo('Window prepared for main screen');
    } catch (error) {
      logError('Error preparing window for main screen', error);
    }
  });

  // Handle get-logs message from renderer with DIRECT method call rather than invoke
  ipcMain.on('get-logs', async (event, { instanceName, timeFilter, tail }) => {
    logInfo(`Getting logs for ${instanceName}, timeFilter: ${timeFilter}, tail: ${tail}`);

    try {
      let sinceParam = '';
      switch (timeFilter) {
        case 'last_hour':
          sinceParam = '--since=1h';
          break;
        case 'last_2_hours':
          sinceParam = '--since=2h';
          break;
        case 'last_6_hours':
          sinceParam = '--since=6h';
          break;
        case 'all':
          sinceParam = '';
          break;
      }

      const cmd = timeFilter === 'all'
          ? `docker logs --tail=${tail} ${instanceName}`
          : `docker logs ${sinceParam} ${instanceName}`;

      const { spawn } = require('child_process');
      const dockerProcess = spawn(cmd, [], { shell: true });

      let logs = '';
      let error = '';
      let timeout: NodeJS.Timeout | null = null;

      timeout = setTimeout(() => {
        dockerProcess.kill();
        event.sender.send('logs-response', {
          success: false,
          message: 'Timeout waiting for logs. The container might not have any logs.'
        });
      }, 10000);

      dockerProcess.stdout.on('data', (data: Buffer) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        logs += data.toString();
      });

      dockerProcess.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });

      dockerProcess.on('close', (code: number) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        if (code === 0) {
          event.sender.send('logs-response', {
            success: true,
            logs: logs
          });
        } else {
          event.sender.send('logs-response', {
            success: false,
            message: error || `Process exited with code ${code}`
          });
        }
      });

      dockerProcess.on('error', (err: Error) => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        logError('Error executing docker logs command', err);
        event.sender.send('logs-response', {
          success: false,
          message: `Error executing docker logs command: ${err.message}`
        });
      });

    } catch (error) {
      logError('Error getting logs', error);
      event.sender.send('logs-response', {
        success: false,
        message: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  // Debugging - show all windows after a timeout if still in splash
  setTimeout(() => {
    if (windows.main && !windows.main.isVisible() && windows.splash && windows.splash.isVisible()) {
      logInfo('DEBUG: Forcing main window to show after timeout');
      showMainWindow();
    }
  }, 10000);
});

// Quit application when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// On macOS, recreate application window when dock icon is clicked and no windows are available
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    logInfo('App activated with no windows, creating main window');
    isSetupCompleted().then(({ completed }) => {
      if (completed) {
        const mainWindow = createMainWindow();
        loadAndShowWindow(mainWindow);
      } else {
        createSetupWindow();
      }
    }).catch(error => {
      logError('Error checking setup status on activate', error);
      const mainWindow = createMainWindow();
      loadAndShowWindow(mainWindow);
    });
  } else {
    const windows = BrowserWindow.getAllWindows();
    const visibleWindows = windows.filter(win => win.isVisible());
    if (visibleWindows.length > 0) {
      visibleWindows[0].focus();
    } else if (windows.length > 0) {
      windows[0].show();
      windows[0].focus();
    }
  }
});

// Handle external URL opening
ipcMain.on('open-external-url', (_event, url) => {
  if (typeof url === 'string') {
    shell.openExternal(url).catch(err => {
      logError(`Error opening external URL: ${url}`, err);
    });
  }
});

// Get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Get app path
ipcMain.handle('get-app-path', (_event, name) => {
  const appPath = app.getPath(name as any || 'userData');
  logInfo(`Sending app path via handle: ${name || 'userData'} = ${appPath}`);
  return appPath;
});

// Get app path (synchronous version for more reliable startup)
ipcMain.on('get-app-path-sync', (event, name) => {
  try {
    const appPath = app.getPath(name as any || 'userData');
    logInfo(`Sending app path via sync: ${name || 'userData'} = ${appPath}`);
    event.returnValue = appPath;
  } catch (error) {
    logError('Error handling get-app-path-sync', error);
    event.returnValue = '';
  }
});

/**
 * Fetch GitHub releases for the application
 * Used for the manual update checking system
 */
ipcMain.handle('fetch-github-releases', async () => {
  try {
    logInfo('Fetching GitHub releases for update check');
    
    // GitHub API endpoint - replace with your actual repository info
    // This is a placeholder - replace with your actual GitHub repository
    const apiUrl = 'https://api.github.com/repos/danielmederos2424/odoo-manager/releases';
    
    // Create request
    const request = net.request({
      method: 'GET',
      url: apiUrl,
      redirect: 'follow'
    });
    
    // Set headers
    request.setHeader('User-Agent', `Odoo-Manager/${app.getVersion()}`);
    
    // Create promise to handle response
    const responsePromise = new Promise((resolve, reject) => {
      let responseData = '';
      
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const releases = JSON.parse(responseData);
              // Get latest non-draft release
              const latestRelease = releases.find((release: any) => !release.draft);
              if (latestRelease) {
                logInfo(`Found latest GitHub release: ${latestRelease.tag_name}`);
                resolve(latestRelease);
              } else {
                logError('No valid releases found');
                reject(new Error('No valid releases found'));
              }
            } catch (error) {
              logError('Error parsing GitHub API response', error);
              reject(error);
            }
          } else {
            logError(`GitHub API returned status code ${response.statusCode}`);
            reject(new Error(`GitHub API returned status code ${response.statusCode}`));
          }
        });
      });
      
      request.on('error', (error) => {
        logError('Error fetching GitHub releases', error);
        reject(error);
      });
      
      // Set timeout (10 seconds)
      setTimeout(() => {
        reject(new Error('Request timed out after 10 seconds'));
      }, 10000);
    });
    
    // Send request
    request.end();
    
    return await responsePromise;
  } catch (error) {
    logError('Error in fetch-github-releases handler', error);
    return null;
  }
});

/**
 * Show system notification for new updates
 */
ipcMain.on('show-update-notification', (_event, { title, body }) => {
  try {
    // Only proceed if we're not on Linux as some Linux distros don't support notifications well
    if (process.platform === 'linux') {
      logInfo('Skipping update notification on Linux platform');
      return;
    }
    
    logInfo(`Showing update notification: ${title}`);
    
    // Create notification
    const notification = new Notification({
      title: title || 'Update Available',
      body: body || 'A new version of Odoo Manager is available.',
      silent: false
    });
    
    // Show notification
    notification.show();
    
    // Handle click
    notification.on('click', () => {
      logInfo('Update notification clicked');
      if (windows.main && !windows.main.isDestroyed()) {
        windows.main.webContents.send('open-update-section');
        if (!windows.main.isVisible()) {
          windows.main.show();
        }
        windows.main.focus();
      }
    });
  } catch (error) {
    logError('Error showing update notification', error);
  }
});

// Test port availability using a direct socket test
ipcMain.handle('test-port-availability', async (_event, port) => {
  try {
    logInfo(`Testing port ${port} availability`);
    const net = require('net');
    const tester = net.createServer();

    const isAvailable = await new Promise<boolean>((resolve) => {
      tester.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          logError(`Port test encountered an error: ${err.message}`, err);
          resolve(false);
        }
      });

      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });

      tester.listen(port, '0.0.0.0');
    });

    return isAvailable;
  } catch (error) {
    logError(`Error testing port availability`, error);
    return false;
  }
});

// Restart app
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit();
});

// Quit app
ipcMain.on('quit-app', () => {
  app.quit();
});

// Check if auto update is enabled in settings
ipcMain.handle('get-auto-update-enabled', async () => {
  try {
    const workDirPath = path.join(app.getPath('userData'), 'workdir.json');
    if (!fs.existsSync(workDirPath)) {
      return false;
    }

    const workDirData = JSON.parse(fs.readFileSync(workDirPath, 'utf8'));
    const workDir = workDirData.workDir;

    if (!workDir || !fs.existsSync(workDir)) {
      return false;
    }

    const settingsPath = path.join(workDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return false;
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings.autoCheckUpdates === true;
  } catch (error) {
    logError('Error checking auto update setting', error);
    return false;
  }
});