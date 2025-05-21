// src/hooks/useAppVersion.ts
import { useState, useEffect } from 'react';
import { isElectron, getElectronAPI } from '../utils/electron';

/**
 * Hook to get the application version from package.json
 * @returns {string} The application version
 */
export function useAppVersion(): string {
    const [version, setVersion] = useState<string>('0.0.0');

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                if (isElectron()) {
                    const electron = getElectronAPI();
                    if (electron && electron.ipcRenderer) {
                        // Get version from the main process using IPC
                        const appVersion = await electron.ipcRenderer.invoke('get-app-version');
                        setVersion(appVersion);
                    }
                } else {
                    // In a browser environment, we could fetch package.json directly
                    // For development purposes, you could use a placeholder or try to fetch it
                    console.log('Running in browser, cannot get app version from Electron');

                    // Optional: Try to fetch the package.json (works in some dev environments)
                    try {
                        const response = await fetch('/package.json');
                        const packageJson = await response.json();
                        if (packageJson && packageJson.version) {
                            setVersion(packageJson.version);
                        }
                    } catch (err) {
                        console.log('Could not fetch package.json', err);
                    }
                }
            } catch (error) {
                console.error('Error fetching application version:', error);
            }
        };

        fetchVersion();
    }, []);

    return version;
}