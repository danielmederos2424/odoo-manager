// src/components/BackgroundUpdateCheck.tsx
import { useEffect, useState } from 'react';
import { isElectron, getElectronAPI } from '../utils/electron';
import manualUpdateService from '../services/update/manualUpdateService';
import settingsService from '../services/settings/settingsService';
import { logDebug, logError, logInfo } from '../services/utils/logger';
import { useTranslation } from 'react-i18next';

// Use a global variable to track if update check has been initialized across windows
// This helps prevent multiple initializations when the component mounts in different windows
let GLOBAL_UPDATE_CHECK_INITIALIZED = false;

/**
 * Component that performs background update checks
 * with no visible UI - designed to be included in App.tsx
 */
export default function BackgroundUpdateCheck() {
  const { t } = useTranslation();
  const [initialized, setInitialized] = useState(false);
  const [windowId, setWindowId] = useState<number | null>(null);
  
  // First effect - get window ID to track which instance we're in
  useEffect(() => {
    const getWindowId = async () => {
      if (isElectron()) {
        const electron = getElectronAPI();
        if (electron && electron.ipcRenderer) {
          try {
            const id = await electron.ipcRenderer.invoke('get-window-id');
            setWindowId(id);
          } catch (error) {
            console.error('Failed to get window ID:', error);
          }
        }
      }
    };
    
    getWindowId();
  }, []);
  
  // Second effect - run update check only when window ID is known
  useEffect(() => {
    if (windowId === null) return; // Wait until we know our window ID
    
    // Initialize update service and check settings
    const initUpdateCheck = async () => {
      try {
        if (!isElectron()) return;
        
        // Prevent multiple initializations in the same app instance
        if (GLOBAL_UPDATE_CHECK_INITIALIZED) {
          logDebug(`Update check already initialized in another window, skipping in window ${windowId}`);
          setInitialized(true);
          return;
        }
        
        GLOBAL_UPDATE_CHECK_INITIALIZED = true;
        logDebug(`Initializing update check in window ${windowId}`);
        
        // Ensure manual update service is initialized
        await manualUpdateService.initialize();
        setInitialized(true);
        
        // Get settings
        const settings = await settingsService.loadSettings();
        if (!settings) return;
        
        // Only proceed if auto updates are enabled
        if (settings.autoCheckUpdates !== true) {
          logDebug('Auto update checking is disabled in settings');
          return;
        }
        
        // Check when the last update check was performed
        if (settings.lastUpdateCheck) {
          const lastCheck = new Date(settings.lastUpdateCheck);
          const now = new Date();
          
          // Calculate time since last check
          const hoursSinceLastCheck = 
            (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);
          
          // Define check interval based on settings
          const checkIntervalHours = 
            settings.updateCheckFrequency === 'daily' ? 24 : 24 * 7;
          
          // Check if we should perform a new check
          if (hoursSinceLastCheck < checkIntervalHours) {
            logDebug(`Last update check was ${hoursSinceLastCheck.toFixed(1)} hours ago, skipping check`);
            return;
          }
        }
        
        // Perform update check with a delay to avoid slowing down app startup
        setTimeout(async () => {
          logInfo('Performing background update check');
          
          try {
            const result = await manualUpdateService.checkForUpdates();
            
            // If there's an update and notifications are enabled, show a notification
            if (result.hasUpdate && settings.showUpdateNotifications) {
              logInfo(`Found update: ${result.latestVersion}, showing notification`);
              
              // Use electron to show a system notification
              const electron = getElectronAPI();
              if (electron && electron.ipcRenderer) {
                electron.ipcRenderer.send('show-update-notification', {
                  title: t('updateNotificationTitle'),
                  body: t('updateNotificationBody', { version: result.latestVersion })
                });
              }
            }
          } catch (error) {
            logError('Error checking for updates', error);
          }
        }, 10000); // Delay update check by 10 seconds to allow app to initialize
      } catch (error) {
        logError('Error initializing background update check', error);
      }
    };
    
    initUpdateCheck();
    
    // When this component unmounts in the window that initialized the check
    return () => {
      if (GLOBAL_UPDATE_CHECK_INITIALIZED && initialized) {
        logDebug(`Update check component unmounting in window ${windowId}`);
      }
    };
  }, [windowId, t]);
  
  // Setup IPC listener only once and only in the window that initialized the update check
  useEffect(() => {
    if (!initialized || !windowId) return;
    if (!GLOBAL_UPDATE_CHECK_INITIALIZED) return;
    
    // Set up IPC listener for opening the update section
    if (isElectron()) {
      const electron = getElectronAPI();
      if (electron && electron.ipcRenderer) {
        const handler = () => {
          // Redirect to settings page with updates section
          window.location.hash = '/settings/updates';
        };
        
        // Use a specific channel name that includes the window ID to prevent duplicate listeners
        const channelName = 'open-update-section';
        
        // Remove any existing listener first to prevent duplicates
        electron.ipcRenderer.removeAllListeners(channelName);
        
        // Add the listener
        electron.ipcRenderer.on(channelName, handler);
        
        return () => {
          electron.ipcRenderer.removeListener(channelName, handler);
        };
      }
    }
  }, [initialized, windowId]);
  
  // This component doesn't render anything
  return null;
}