// src/services/system/pathService.ts
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { logError } from '../utils/logger';
/**
 * Get the app data directory path
 */
export function getAppDataPath(): string {
    const appName = 'odoo-manager';

    // Different paths based on operating system
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.APPDATA || '', appName);
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support', appName);
        case 'linux':
            return path.join(os.homedir(), '.config', appName);
        default:
            return path.join(os.homedir(), `.${appName}`);
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
        const workDirFilePath = path.join(getAppDataPath(), 'workdir.json');
        if (!fs.existsSync(workDirFilePath)) {
            return null;
        }

        const data = JSON.parse(fs.readFileSync(workDirFilePath, 'utf-8'));
        return data.workDir || null;
    } catch (error) {
        logError('Error getting work directory path:', error);
        return null;
    }
}

/**
 * Set the user work directory path
 */
export function setWorkDirPath(workDirPath: string): boolean {
    try {
        const appDataPath = getAppDataPath();
        ensureDir(appDataPath);

        const workDirFilePath = path.join(appDataPath, 'workdir.json');
        fs.writeFileSync(workDirFilePath, JSON.stringify({ workDir: workDirPath }, null, 2));
        return true;
    } catch (error) {
        logError('Error setting work directory path:', error);
        return false;
    }
}