// src/utils/electron.ts
export const isElectron = () => {
    // Check if we're in a browser environment
    return typeof window !== 'undefined' && window.process && window.process.type;
};

export const getElectronAPI = () => {
    if (isElectron()) {
        return window.require('electron');
    }
    return null;
};
