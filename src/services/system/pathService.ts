// src/services/system/pathService.ts
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { getElectronAPI } from '../../utils/electron';

// Local logger to avoid circular dependencies
const localLogInfo = (message: string, data?: any): void => {
    console.log(`[INFO] ${message}${data ? ` ${JSON.stringify(data)}` : ''}`);
};

const localLogError = (message: string, error?: any): void => {
    console.error(`[ERROR] ${message}`, error);
};

/**
 * Get the app data directory path
 */
export function getAppDataPath(): string {
    const appName = 'odoo-manager';
    
    try {
        // First try to get path from Electron if available (more reliable)
        const electron = getElectronAPI();
        if (electron?.ipcRenderer) {
            try {
                // Try invoke method to get app path from main process
                const electronPath = electron.ipcRenderer.sendSync('get-app-path-sync', 'userData');
                if (electronPath) {
                    localLogInfo(`Got app data path from Electron: ${electronPath}`);
                    return electronPath;
                }
            } catch (electronError) {
                localLogError('Failed to get app data path from Electron:', electronError);
                // Fall through to platform-specific logic
            }
        }
        
        // Fallback to platform-specific logic
        let appDataPath = '';
        switch (process.platform) {
            case 'win32':
                appDataPath = path.join(process.env.APPDATA || '', appName);
                break;
            case 'darwin':
                appDataPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
                break;
            case 'linux':
                appDataPath = path.join(os.homedir(), '.config', appName);
                break;
            default:
                appDataPath = path.join(os.homedir(), `.${appName}`);
        }
        
        localLogInfo(`Using platform-specific app data path: ${appDataPath}`);
        return appDataPath;
    } catch (error) {
        localLogError('Error getting app data path:', error);
        
        // Last resort fallback
        const fallbackPath = path.join(os.homedir(), appName);
        localLogInfo(`Falling back to home directory path: ${fallbackPath}`);
        return fallbackPath;
    }
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Get the logs directory path
 * @param customWorkDirPath Optional custom work directory path
 */
export function getLogsPath(customWorkDirPath?: string): string {
    // If a specific work directory is provided, use it
    const basePath = customWorkDirPath || getWorkDirPath() || getAppDataPath();
    const logsPath = path.join(basePath, 'logs');
    ensureDir(logsPath);
    return logsPath;
}

/**
 * Get the user work directory path
 */
export function getWorkDirPath(): string | null {
    try {
        // Windows-specific behavior - always use AppData
        if (process.platform === 'win32') {
            const appDataPath = getAppDataPath();
            
            // Create workdir.json if it doesn't exist, pointing to AppData
            const workDirFilePath = path.join(appDataPath, 'workdir.json');
            if (!fs.existsSync(workDirFilePath)) {
                try {
                    ensureDir(path.dirname(workDirFilePath));
                    fs.writeFileSync(workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
                } catch (writeError) {
                    localLogError('Windows: Error creating workdir.json', writeError);
                }
            }
            
            return appDataPath;
        }
        
        // Original behavior for other platforms
        const workDirFilePath = path.join(getAppDataPath(), 'workdir.json');
        if (!fs.existsSync(workDirFilePath)) {
            return null;
        }

        const data = JSON.parse(fs.readFileSync(workDirFilePath, 'utf-8'));
        return data.workDir || null;
    } catch (error) {
        localLogError('Error getting work directory path:', error);
        return null;
    }
}

/**
 * Set the user work directory path
 */
export function setWorkDirPath(workDirPath: string): boolean {
    try {
        // Windows-specific behavior - always use AppData
        if (process.platform === 'win32') {
            const appDataPath = getAppDataPath();
            ensureDir(appDataPath);
            
            // For Windows, we always save AppData as the work directory regardless of input
            const workDirFilePath = path.join(appDataPath, 'workdir.json');
            fs.writeFileSync(workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
            
            // Ensure the necessary directories exist
            ['odoo', 'postgres', 'logs'].forEach(dir => {
                const dirPath = path.join(appDataPath, dir);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
            });
            
            return true;
        }
        
        // Original behavior for other platforms
        const appDataPath = getAppDataPath();
        ensureDir(appDataPath);

        const workDirFilePath = path.join(appDataPath, 'workdir.json');
        fs.writeFileSync(workDirFilePath, JSON.stringify({ workDir: workDirPath }, null, 2));
        return true;
    } catch (error) {
        localLogError('Error setting work directory path:', error);
        return false;
    }
}