// src/services/update/manualUpdateService.ts

import { isElectron, getElectronAPI } from '../../utils/electron';
import { logDebug, logError, logInfo } from '../utils/logger';
import settingsService from '../settings/settingsService';

/**
 * Interface for GitHub release asset
 */
export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interface for GitHub release
 */
export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GithubReleaseAsset[];
  html_url: string;
}

/**
 * Interface for update check result
 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  latestRelease: GithubRelease | null;
  lastChecked: Date;
  releaseNotes: string;
  downloadUrl: string | null;
  platformAssets: GithubReleaseAsset[];
}

/**
 * Platform types for asset filtering
 */
export type Platform = 'win' | 'mac' | 'linux';

/**
 * Manual Update Service for GitHub release-based updates
 */
class ManualUpdateService {
  // Private properties
  private currentVersion: string = '0.0.0';
  private lastChecked: Date | null = null;
  private currentPlatform: Platform = 'mac'; // Default, will be detected

  /**
   * Initialize the service
   */
  constructor() {
    this.detectPlatform();
  }

  /**
   * Detect the current platform
   */
  private detectPlatform(): void {
    if (!isElectron()) return;

    const platform = window.process.platform;
    if (platform === 'win32') {
      this.currentPlatform = 'win';
    } else if (platform === 'darwin') {
      this.currentPlatform = 'mac';
    } else if (platform === 'linux') {
      this.currentPlatform = 'linux';
    }

    logDebug(`Update service detected platform: ${this.currentPlatform}`);
  }

  /**
   * Initialize the service with the current version
   */
  async initialize(): Promise<void> {
    try {
      if (isElectron()) {
        const electron = getElectronAPI();
        if (electron && electron.ipcRenderer) {
          this.currentVersion = await electron.ipcRenderer.invoke('get-app-version');
          logDebug(`Update service initialized with app version: ${this.currentVersion}`);
        }
      }

      // Load last checked time from settings
      const settings = await settingsService.loadSettings();
      if (settings && settings.lastUpdateCheck) {
        this.lastChecked = new Date(settings.lastUpdateCheck);
        logDebug(`Loaded last update check time: ${this.lastChecked}`);
      }
    } catch (error) {
      logError('Error initializing update service', error);
    }
  }

  /**
   * Check for updates by fetching the latest release from GitHub
   * @returns Promise resolving to update check result
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      logInfo('Checking for updates...');
      if (!isElectron()) {
        throw new Error('Not running in Electron environment');
      }

      const electron = getElectronAPI();
      if (!electron || !electron.ipcRenderer) {
        throw new Error('Electron IPC renderer not available');
      }

      // Get current app version if not already set
      if (this.currentVersion === '0.0.0') {
        this.currentVersion = await electron.ipcRenderer.invoke('get-app-version');
      }

      // Fetch the latest release from GitHub using the main process
      const latestRelease: GithubRelease = await electron.ipcRenderer.invoke('fetch-github-releases');
      
      if (!latestRelease) {
        throw new Error('Failed to fetch GitHub releases');
      }

      // Extract version number from tag (remove 'v' prefix if present)
      const latestVersion = latestRelease.tag_name.replace(/^v/, '');

      // Check if the latest version is newer than current version
      const hasUpdate = this.isNewerVersion(latestVersion, this.currentVersion);
      
      // Filter assets for current platform
      const platformAssets = this.filterPlatformAssets(latestRelease.assets, this.currentPlatform);
      
      // Determine download URL
      let downloadUrl = null;
      if (platformAssets.length > 0) {
        downloadUrl = platformAssets[0].browser_download_url;
      } else if (latestRelease.html_url) {
        // If no platform-specific assets found, use the release page URL
        downloadUrl = latestRelease.html_url;
      }

      // Update last checked time
      this.lastChecked = new Date();
      
      // Save last checked time to settings
      await settingsService.updateSettings({
        lastUpdateCheck: this.lastChecked.toISOString()
      });

      const result: UpdateCheckResult = {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion,
        latestRelease,
        lastChecked: this.lastChecked,
        releaseNotes: latestRelease.body || '',
        downloadUrl,
        platformAssets
      };

      logInfo(`Update check result: hasUpdate=${hasUpdate}, latestVersion=${latestVersion}`);
      return result;
    } catch (error) {
      logError('Error checking for updates', error);
      
      // Return a default result on error
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        latestRelease: null,
        lastChecked: this.lastChecked || new Date(),
        releaseNotes: '',
        downloadUrl: null,
        platformAssets: []
      };
    }
  }

  /**
   * Determine if version2 is newer than version1 using semantic versioning comparison
   * @param version1 First version to compare
   * @param version2 Second version to compare
   * @returns True if version2 is newer than version1
   */
  isNewerVersion(version1: string, version2: string): boolean {
    try {
      // Parse versions into components
      const v1Parts = version1.split('.').map(Number);
      const v2Parts = version2.split('.').map(Number);
      
      // Pad arrays to ensure equal length
      while (v1Parts.length < 3) v1Parts.push(0);
      while (v2Parts.length < 3) v2Parts.push(0);
      
      // Compare major, minor, patch versions
      if (v1Parts[0] !== v2Parts[0]) return v1Parts[0] > v2Parts[0];
      if (v1Parts[1] !== v2Parts[1]) return v1Parts[1] > v2Parts[1];
      if (v1Parts[2] !== v2Parts[2]) return v1Parts[2] > v2Parts[2];
      
      // If we get here, versions are equal
      return false;
    } catch (error) {
      logError('Error comparing versions', error);
      return false;
    }
  }

  /**
   * Filter assets for the current platform
   * @param assets List of GitHub release assets
   * @param platform Current platform
   * @returns Filtered list of assets for the current platform
   */
  private filterPlatformAssets(assets: GithubReleaseAsset[], platform: Platform): GithubReleaseAsset[] {
    if (!assets || !Array.isArray(assets)) return [];

    // Platform-specific file extensions and patterns
    const platformPatterns: Record<Platform, string[]> = {
      win: ['.exe', '.msi', 'win', 'windows'],
      mac: ['.dmg', '.pkg', 'mac', 'darwin', 'osx'],
      linux: ['.AppImage', '.deb', '.rpm', 'linux']
    };

    const patterns = platformPatterns[platform];
    
    return assets.filter(asset => {
      const name = asset.name.toLowerCase();
      return patterns.some(pattern => name.includes(pattern));
    });
  }

  /**
   * Open the download URL in the default browser
   * @param url URL to open
   */
  async openDownloadPage(url: string): Promise<void> {
    try {
      if (!isElectron()) {
        window.open(url, '_blank');
        return;
      }

      const electron = getElectronAPI();
      if (electron && electron.ipcRenderer) {
        // Use the existing open-external-url IPC event
        electron.ipcRenderer.send('open-external-url', url);
        logInfo(`Opened download URL: ${url}`);
      }
    } catch (error) {
      logError('Error opening download page', error);
      throw error;
    }
  }

  /**
   * Get the last checked date
   * @returns Date object or null if never checked
   */
  getLastCheckedDate(): Date | null {
    return this.lastChecked;
  }

  /**
   * Get the last checked time as a formatted string
   * @returns Formatted date string or 'Never' if never checked
   */
  getLastCheckedString(): string {
    if (!this.lastChecked) return 'Never';
    
    try {
      return this.lastChecked.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return this.lastChecked.toISOString();
    }
  }
}

// Create singleton instance
const manualUpdateService = new ManualUpdateService();

export { manualUpdateService };
export default manualUpdateService;