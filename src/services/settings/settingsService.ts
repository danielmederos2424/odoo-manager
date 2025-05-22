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
            // Windows-specific behavior - always use AppData
            if (process.platform === 'win32') {
                // For Windows, we always use the AppData location for consistency
                const appDataPath = getAppDataPath();
                
                // If workdir.json exists, read it for compatibility, but prefer AppData
                if (fs.existsSync(this.workDirFilePath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(this.workDirFilePath, 'utf-8'));
                        
                        // Validate that the path exists
                        if (data.workDir && fs.existsSync(data.workDir)) {
                            // If it's not AppData, log info but still return AppData
                            if (data.workDir !== appDataPath) {
                                logInfo(`Windows: workdir.json points to ${data.workDir}, but using ${appDataPath} for consistency`);
                            }
                        }
                    } catch (parseError) {
                        logError('Windows: Error parsing workdir.json', parseError);
                    }
                } else {
                    // Create workdir.json if it doesn't exist
                    try {
                        fs.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
                        logInfo(`Windows: Created workdir.json pointing to AppData: ${appDataPath}`);
                    } catch (writeError) {
                        logError('Windows: Error creating workdir.json', writeError);
                    }
                }
                
                return appDataPath;
            }
            
            // Original behavior for other platforms
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
            // Windows-specific behavior - always use AppData
            if (process.platform === 'win32') {
                const appDataPath = getAppDataPath();
                
                // For Windows, we always save AppData as the work directory
                // This ensures consistency across different installations
                ensureDir(path.dirname(this.workDirFilePath));
                fs.writeFileSync(this.workDirFilePath, JSON.stringify({ workDir: appDataPath }, null, 2));
                
                logInfo(`Windows: Ignoring custom work directory, using AppData instead: ${appDataPath}`);
                
                // Ensure any settings or directories that would have been in the custom workDir
                // are created in AppData too
                try {
                    // Ensure settings.json exists in AppData
                    const settingsPath = path.join(appDataPath, 'settings.json');
                    if (!fs.existsSync(settingsPath)) {
                        // Create with default settings
                        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
                        logInfo(`Windows: Created settings.json in AppData`);
                    }
                    
                    // Ensure odoo and postgres directories exist
                    const odooDir = path.join(appDataPath, 'odoo');
                    const postgresDir = path.join(appDataPath, 'postgres');
                    
                    if (!fs.existsSync(odooDir)) {
                        fs.mkdirSync(odooDir, { recursive: true });
                    }
                    
                    if (!fs.existsSync(postgresDir)) {
                        fs.mkdirSync(postgresDir, { recursive: true });
                    }
                } catch (setupError) {
                    logError('Windows: Error setting up AppData directories', setupError);
                }
                
                return true;
            }
            
            // Original behavior for other platforms
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
            // Windows-specific behavior - always use AppData
            if (process.platform === 'win32') {
                const appDataPath = getAppDataPath();
                const settingsPath = path.join(appDataPath, 'settings.json');
                
                if (!fs.existsSync(settingsPath)) {
                    // Create default settings file if it doesn't exist
                    try {
                        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
                        logInfo(`Windows: Created default settings.json in AppData`);
                    } catch (writeError) {
                        logError('Windows: Error creating settings.json', writeError);
                        return defaultSettings; // Return defaults even if we couldn't write the file
                    }
                    return defaultSettings;
                }
                
                try {
                    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                    logInfo('Windows: Loaded settings from AppData');
                    return { ...defaultSettings, ...settings };
                } catch (readError) {
                    logError('Windows: Error reading settings.json, using defaults', readError);
                    return defaultSettings;
                }
            }
            
            // Original behavior for other platforms
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
            // Windows-specific behavior - always use AppData
            if (process.platform === 'win32') {
                const appDataPath = getAppDataPath();
                const settingsPath = path.join(appDataPath, 'settings.json');
                
                // Get current settings or defaults
                let currentSettings: Settings;
                try {
                    if (fs.existsSync(settingsPath)) {
                        currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                    } else {
                        currentSettings = { ...defaultSettings };
                    }
                } catch (readError) {
                    logError('Windows: Error reading settings.json, using defaults', readError);
                    currentSettings = { ...defaultSettings };
                }
                
                // Merge updates with current settings
                const updatedSettings = {
                    ...currentSettings,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                
                // Ensure directory exists
                ensureDir(path.dirname(settingsPath));
                
                // Write updated settings
                fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
                logInfo('Windows: Updated settings in AppData');
                
                return true;
            }
            
            // Original behavior for other platforms
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