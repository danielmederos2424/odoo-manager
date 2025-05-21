/**
 * This script adds Docker path resolution to the Electron main process.
 * It's designed to be run as part of the build process to ensure Docker
 * can be found on all platforms, especially on macOS.
 */

const fs = require('fs');
const path = require('path');

// Path to the main process file
const mainFilePath = path.join(__dirname, '..', 'dist-electron', 'main.js');

// Check if the file exists
if (!fs.existsSync(mainFilePath)) {
  console.error(`Error: Main process file not found at ${mainFilePath}`);
  process.exit(1);
}

// Read the file
const mainFile = fs.readFileSync(mainFilePath, 'utf8');

// Check if the patch has already been applied
if (mainFile.includes('DOCKER_PATH_PATCH_APPLIED')) {
  console.log('Docker path patch already applied, skipping');
  process.exit(0);
}

// Docker path resolution function to add
const patchCode = `
// DOCKER_PATH_PATCH_APPLIED
// Docker path resolution for different platforms
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
    'C:\\\\Program Files\\\\Docker\\\\Docker\\\\resources\\\\bin',
    path.join(os.homedir(), 'AppData\\\\Local\\\\Docker\\\\Docker\\\\resources\\\\bin')
  ]
};

// Enhance PATH to include Docker paths
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
    process.env.PATH = [...existingPaths, currentPath].join(pathSeparator);
    
    console.log(\`Enhanced PATH for Docker commands: \${process.env.PATH}\`);
    return true;
  } catch (error) {
    console.error('Error enhancing Docker PATH:', error);
    return false;
  }
}

// Call the function to enhance PATH early
enhanceDockerPath();

// Add handler for enhancing PATH from renderer process
ipcMain.handle('enhance-path', (_event, { paths, platform }) => {
  try {
    if (!Array.isArray(paths) || paths.length === 0) {
      return { success: false, message: 'Invalid paths' };
    }
    
    // Get current PATH
    const currentPath = process.env.PATH || '';
    
    // Create new PATH with platform-specific separator
    const pathSeparator = platform === 'win32' ? ';' : ':';
    process.env.PATH = [...paths, currentPath].join(pathSeparator);
    
    console.log(\`PATH enhanced by renderer process: \${process.env.PATH}\`);
    return { success: true };
  } catch (error) {
    console.error('Error handling enhance-path:', error);
    return { success: false, message: error.message };
  }
});
`;

// Find a good insertion point - just after imports but within scope
const importSection = mainFile.indexOf('import {');
let insertionPoint = -1;

if (importSection !== -1) {
  // Find the end of the import section
  const importSectionEnd = mainFile.indexOf('\n\n', importSection);
  if (importSectionEnd !== -1) {
    insertionPoint = importSectionEnd + 2; // Move past the double newline
  }
}

// If we couldn't find a good spot, try a different approach
if (insertionPoint === -1) {
  // Look for app declaration
  const appDeclaration = mainFile.indexOf('const app = ') || mainFile.indexOf('app.setName');
  if (appDeclaration !== -1) {
    // Find the start of the line
    const lineStart = mainFile.lastIndexOf('\n', appDeclaration) + 1;
    insertionPoint = lineStart;
  } else {
    console.error('Error: Could not find appropriate insertion point in main.js');
    process.exit(1);
  }
}

// Insert the patch code at the appropriate point
const patchedFile = mainFile.slice(0, insertionPoint) + patchCode + mainFile.slice(insertionPoint);

// Write the patched file
fs.writeFileSync(mainFilePath, patchedFile, 'utf8');
console.log('Docker path patch successfully applied to main.js');