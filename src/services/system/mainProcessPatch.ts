// src/services/system/mainProcessPatch.ts
import { ipcRenderer } from 'electron';
import * as os from 'os';
import { logInfo, logError } from '../utils/logger';

/**
 * This file contains functions to patch environment variables in the main process
 * to ensure Docker commands can be found on all platforms, especially macOS.
 */

/**
 * Possible Docker installation paths for different operating systems
 */
const DOCKER_PATHS = {
  darwin: [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/Applications/Docker.app/Contents/Resources/bin',
    `${os.homedir()}/.docker/bin`
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

/**
 * Send the enhanced PATH to the main process
 */
export async function enhanceMainProcessPath(): Promise<boolean> {
  try {
    if (!ipcRenderer) {
      logError('IPC Renderer not available');
      return false;
    }

    logInfo('Enhancing main process PATH for Docker commands');
    
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const possiblePaths = DOCKER_PATHS[platform] || [];
    
    // Filter paths that actually exist
    const existingPaths = possiblePaths.filter(p => {
      try {
        return fs.existsSync(p);
      } catch (error) {
        return false;
      }
    });
    
    // Send message to main process to enhance PATH
    await ipcRenderer.invoke('enhance-path', { 
      paths: existingPaths,
      platform
    });
    
    logInfo('PATH enhancement request sent to main process');
    return true;
  } catch (error) {
    logError('Error enhancing main process PATH', error);
    return false;
  }
}

// Export default for easier imports
export default {
  enhanceMainProcessPath
};