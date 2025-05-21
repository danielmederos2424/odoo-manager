// docker-path.js - Docker path enhancement for Electron main process
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Docker path configuration for different platforms
 */
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

/**
 * Enhance the PATH environment variable to include Docker directories
 * @returns {string} The enhanced PATH
 */
function enhanceDockerPath() {
  try {
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
    
    console.log(`Enhanced PATH for Docker commands: ${process.env.PATH}`);
    return enhancedPath;
  } catch (error) {
    console.error('Error enhancing Docker PATH:', error);
    return process.env.PATH || '';
  }
}

// Apply the PATH enhancement immediately when this module is loaded
enhanceDockerPath();

// Export the functions
module.exports = {
  enhanceDockerPath
};