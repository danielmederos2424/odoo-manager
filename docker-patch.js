/**
 * Docker PATH Patch for Odoo Manager
 * This script fixes the Docker detection issue on macOS by enhancing the PATH environment variable.
 * 
 * Copy this file to the same directory as main.js and require it at the top of main.js.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('[DOCKER-PATCH] Applying Docker PATH patch...');

// Docker path enhancement to ensure Docker commands work
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

    const platform = process.platform;
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
    
    console.log(`[DOCKER-PATCH] Enhanced PATH: ${process.env.PATH}`);
    return enhancedPath;
  } catch (error) {
    console.error('[DOCKER-PATCH] Error enhancing Docker PATH:', error);
    return process.env.PATH || '';
  }
}

// Apply the Docker PATH enhancement immediately
enhanceDockerPath();

module.exports = { enhanceDockerPath };