// src/utils/electron.ts
// Initialize the API at the module level
let electronAPI: any = null;

export const isElectron = () => {
    // Check if we're in a browser environment
    return typeof window !== 'undefined' && window.process && window.process.type;
};

// Initialize during module load if possible
try {
    if (typeof window !== 'undefined' && window.process && window.process.type) {
        electronAPI = window.require('electron');
    }
} catch (e) {
    // Silently fail - will initialize on first call
}

export const getElectronAPI = () => {
    if (electronAPI) {
        return electronAPI;
    }
    
    if (isElectron()) {
        electronAPI = window.require('electron');
        return electronAPI;
    }
    return null;
};
