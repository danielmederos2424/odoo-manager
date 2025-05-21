// src/services/electron/mainProcessService.ts
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import dockerComposeService from '../docker/dockerComposeService';
import { logInfo, logError } from '../utils/logger';

// Define types for the operations
interface DockerOperationParams {
    instanceName?: string;
    version?: string;
    edition?: string;
    adminPassword?: string;
    dbFilter?: boolean;
    service?: string;
    tail?: number;
    keepFiles?: boolean;
    networkName?: string;
    instanceType?: string;
    port?: number;
}

interface DockerOperationRequest {
    operation: string;
    params: DockerOperationParams;
}

interface ErrorDialogOptions {
    title: string;
    message: string;
}

/**
 * Safe handler registration - checks if a handler exists before registering
 * @param channel IPC channel name
 * @param handler Function to handle the IPC request
 */
function safeRegisterHandler<T, R>(channel: string, handler: (event: IpcMainInvokeEvent, arg: T) => Promise<R> | R): void {
    try {
        // Check if a handler already exists for this channel
        const handlers = (ipcMain as any)._invokeHandlers;
        if (handlers && handlers.has && handlers.has(channel)) {
            logInfo(`IPC handler already exists for channel: ${channel}, not registering again`);
            return;
        }

        // If we can't check properly, try a more reliable way
        try {
            ipcMain.handle(channel, handler);
            logInfo(`Registered IPC handler: ${channel}`);
        } catch (error) {
            if ((error as Error).message.includes('second handler')) {
                logInfo(`Handler already exists for channel: ${channel}, skipping registration`);
            } else {
                throw error; // Re-throw unexpected errors
            }
        }
    } catch (error) {
        logError(`Error while trying to register handler for ${channel}`, error);
    }
}

/**
 * Initialize all IPC handlers for the main process
 */
export function initializeIpcHandlers(): void {
    logInfo('Initializing IPC handlers');

    // Docker operation handler with improved logging and error handling
    safeRegisterHandler<DockerOperationRequest, any>('docker-operation', async (_event, { operation, params }) => {
        logInfo(`Executing Docker operation: ${operation}`, params);

        try {
            let result;

            switch (operation) {
                case 'check-docker':
                    logInfo('Checking Docker');
                    result = await dockerComposeService.checkDocker();
                    break;

                case 'start-instance':
                    result = await dockerComposeService.startInstance(params.instanceName || '');
                    break;

                case 'stop-instance':
                    result = await dockerComposeService.stopInstance(params.instanceName || '');
                    break;

                case 'delete-instance':
                    result = await dockerComposeService.deleteInstance(params.instanceName || '', params.keepFiles);
                    break;

                case 'get-logs':
                    result = await dockerComposeService.getLogs(
                        params.instanceName || '',
                        params.service,
                        params.tail
                    );
                    break;

                case 'list-instances':
                    logInfo('Listing instances');
                    result = await dockerComposeService.listInstances();
                    break;

                case 'ensure-network':
                    result = await dockerComposeService.ensureNetworkExists(params?.networkName);
                    break;

                default:
                    throw new Error(`Unknown Docker operation: ${operation}`);
            }

            logInfo(`Docker operation completed: ${operation}`, { success: true });
            return result;
        } catch (error) {
            logError(`Error executing Docker operation: ${operation}`, error);
            return {
                success: false,
                message: `Operation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    });

    // Show error dialog
    safeRegisterHandler<ErrorDialogOptions, void>('show-error-dialog', (_event, { title, message }) => {
        logError(`Showing error dialog: ${title}`, message);
        dialog.showErrorBox(title, message);
    });

    // Show message dialog
    safeRegisterHandler<Electron.MessageBoxOptions, Electron.MessageBoxReturnValue>('show-message-dialog', async (_event, options) => {
        logInfo('Showing message dialog', { title: options.title });
        return await dialog.showMessageBox(options);
    });

    // Show save dialog
    safeRegisterHandler<Electron.SaveDialogOptions, Electron.SaveDialogReturnValue>('show-save-dialog', async (_event, options) => {
        logInfo('Showing save dialog', { title: options.title });
        return await dialog.showSaveDialog(options);
    });

    // Show open dialog
    safeRegisterHandler<Electron.OpenDialogOptions, Electron.OpenDialogReturnValue>('show-open-dialog', async (_event, options) => {
        logInfo('Showing open dialog', { title: options.title });
        return await dialog.showOpenDialog(options);
    });

    logInfo('IPC handlers initialization complete');
}

/**
 * Initialize the application and perform startup tasks
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeApp(): Promise<void> {
    try {
        logInfo('Initializing application');

        // Check if Docker is running
        const dockerRunning = await dockerComposeService.checkDocker();
        if (!dockerRunning) {
            logError('Docker is not running!');
            // This will be handled by the splash screen
            return;
        }

        // Ensure Odoo network exists
        await dockerComposeService.ensureNetworkExists();

        logInfo('Application initialized successfully');
    } catch (error) {
        logError('Failed to initialize application', error instanceof Error ? error : new Error(String(error)));
        throw error; // Re-throw to allow caller to handle the error
    }
}