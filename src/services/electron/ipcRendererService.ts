// src/services/electron/ipcRendererService.ts
import { ipcRenderer } from 'electron';
import { logInfo, logError } from '../utils/logger';

/**
 * Service for handling IPC communication between renderer and main process
 */
class IpcRendererService {
    /**
     * Signal verification complete to main process
     */
    signalVerificationComplete(): void {
        logInfo('Signaling verification complete to main process');
        ipcRenderer.send('verification-complete');
    }

    /**
     * Signal verification failed to main process
     */
    signalVerificationFailed(error: string): void {
        logError(`Verification failed: ${error}`);
        ipcRenderer.send('verification-failed', { error });
    }

    /**
     * Open external URL using Electron's shell
     */
    async openExternalUrl(url: string): Promise<boolean> {
        try {
            await ipcRenderer.invoke('open-external-url', url);
            return true;
        } catch (error) {
            logError(`Failed to open external URL: ${url}`, error);
            return false;
        }
    }

    /**
     * Create a new window
     */
    openWindow(type: string, options = {}): void {
        ipcRenderer.send('open-window', { type, options });
    }

    /**
     * Close a window
     */
    closeWindow(type: string): void {
        ipcRenderer.send('close-window', { type });
    }

    /**
     * Register handler for Docker events
     */
    onDockerEvent(callback: (event: any) => void): () => void {
        const handler = (_event: any, data: any) => {
            callback(data);
        };

        ipcRenderer.on('docker-event', handler);

        return () => {
            ipcRenderer.removeListener('docker-event', handler);
        };
    }
    
    /**
     * Register handler for main window visible event
     * This event is emitted when the main window is fully visible
     */
    onMainWindowVisible(callback: () => void): () => void {
        const handler = () => {
            callback();
        };

        ipcRenderer.on('main-window-visible', handler);

        return () => {
            ipcRenderer.removeListener('main-window-visible', handler);
        };
    }

    /**
     * Execute Docker operation via main process
     */
    async executeDockerOperation(operation: string, params: any): Promise<any> {
        try {
            return await ipcRenderer.invoke('docker-operation', { operation, params });
        } catch (error) {
            logError(`Failed to execute Docker operation: ${operation}`, error);
            throw error;
        }
    }
}

export default new IpcRendererService();
