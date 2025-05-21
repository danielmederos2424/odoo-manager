// src/services/settings/settingsService.ts
import * as fs from 'fs';
import * as path from 'path';
import { getAppDataPath, ensureDir } from '../system/pathService';
import { logError, logInfo } from '../utils/logger';

// Settings interface
export interface Settings {
    theme: 'light' | 'dark';
    language: string;
    network: string;
    showWelcomeScreen: boolean;
    autoCheckUpdates: boolean;
    updateCheckFrequency: 'daily' | 'weekly';
    showUpdateNotifications: boolean;
    lastUpdateCheck: string | null;
    createdAt: string;
    updatedAt: string;
    [key: string]: any; // Allow for extension
}

// Default settings
const defaultSettings: Settings = {
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

class SettingsService {
    private workDirFilePath: string;

    constructor() {
        // Path to the file that stores the work directory path
        this.workDirFilePath = path.join(getAppDataPath(), 'workdir.json');
    }

    /**
     * Check if setup has been completed
     * @returns Promise resolving to boolean indicating if setup is complete
     */
    async isSetupCompleted(): Promise<boolean> {
        try {
            const workDirPath = await this.getWorkDirPath();
            if (!workDirPath) {
                return false;
            }

            const settingsPath = path.join(workDirPath, 'settings.json');
            if (!fs.existsSync(settingsPath)) {
                return false;
            }

            // If we have valid settings.json file, it means setup was completed
            return true;
        } catch (error) {
            logError('Error checking if setup is completed', error);
            return false;
        }
    }

    /**
     * Get the work directory path from app data
     * @returns Promise resolving to work directory path or null if not set
     */
    async getWorkDirPath(): Promise<string | null> {
        try {
            if (!fs.existsSync(this.workDirFilePath)) {
                return null;
            }

            const data = JSON.parse(fs.readFileSync(this.workDirFilePath, 'utf-8'));
            if (!data.workDir || !fs.existsSync(data.workDir)) {
                return null;
            }

            return data.workDir;
        } catch (error) {
            logError('Error getting work directory path', error);
            return null;
        }
    }

    /**
     * Save the work directory path to app data
     * @param workDirPath Path to save as work directory
     * @returns Promise resolving to boolean indicating success
     */
    async saveWorkDirPath(workDirPath: string): Promise<boolean> {
        try {
            ensureDir(path.dirname(this.workDirFilePath));
            fs.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: workDirPath }, null, 2));
            logInfo(`Saved work directory path: ${workDirPath}`);
            return true;
        } catch (error) {
            logError('Error saving work directory path', error);
            return false;
        }
    }

    /**
     * Load settings from the work directory
     * @returns Promise resolving to Settings object or null if not found
     */
    async loadSettings(): Promise<Settings | null> {
        try {
            const workDirPath = await this.getWorkDirPath();
            if (!workDirPath) {
                return null;
            }

            const settingsPath = path.join(workDirPath, 'settings.json');
            if (!fs.existsSync(settingsPath)) {
                return null;
            }

            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            logInfo('Loaded settings from work directory');
            return { ...defaultSettings, ...settings };
        } catch (error) {
            logError('Error loading settings', error);
            return null;
        }
    }

    /**
     * Save settings to the work directory
     * @param settings Settings object to save
     * @param workDirPath Work directory path where settings should be saved
     * @returns Promise resolving to boolean indicating success
     */
    async saveSettings(settings: Partial<Settings>, workDirPath: string): Promise<boolean> {
        try {
            // Ensure work directory exists
            ensureDir(workDirPath);

            // Merge with default settings
            const mergedSettings = { ...defaultSettings, ...settings };
            mergedSettings.updatedAt = new Date().toISOString();

            // Write settings file
            const settingsPath = path.join(workDirPath, 'settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));

            logInfo(`Saved settings to work directory: ${workDirPath}`);
            return true;
        } catch (error) {
            logError('Error saving settings', error);
            return false;
        }
    }

    /**
     * Update settings in the work directory
     * @param updates Partial settings object with updates
     * @returns Promise resolving to boolean indicating success
     */
    async updateSettings(updates: Partial<Settings>): Promise<boolean> {
        try {
            const currentSettings = await this.loadSettings();
            if (!currentSettings) {
                return false;
            }

            const workDirPath = await this.getWorkDirPath();
            if (!workDirPath) {
                return false;
            }

            // Merge updates with current settings
            const updatedSettings = {
                ...currentSettings,
                ...updates,
                updatedAt: new Date().toISOString()
            };

            // Write updated settings
            const settingsPath = path.join(workDirPath, 'settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));

            logInfo('Updated settings');
            return true;
        } catch (error) {
            logError('Error updating settings', error);
            return false;
        }
    }
}

// Create instance
const settingsService = new SettingsService();

export { settingsService };
export default settingsService;