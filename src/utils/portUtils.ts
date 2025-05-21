// src/utils/portUtils.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { logError, logInfo } from '../services/utils/logger';

const execAsync = promisify(exec);

/**
 * Check if a port is available system-wide
 * @param port Port number to check
 * @returns Promise resolving to boolean indicating if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    try {
        // Different commands for different platforms
        let command: string;

        switch (process.platform) {
            case 'win32':
                // Windows - use netstat
                command = `netstat -an | findstr :${port}`;
                break;
            default:
                // Linux/macOS - use lsof
                command = `lsof -i:${port}`;
                break;
        }

        const { stdout } = await execAsync(command);

        // If the output contains the port, it's in use
        return stdout.trim() === '';
    } catch (error) {
        // In some cases, if the command fails, it means the port is not in use
        // This is especially true for lsof, which returns an error if no processes are using the port
        // @ts-ignore
        if (error.code === 1 && process.platform !== 'win32') {
            return true;
        }

        logError(`Error checking port ${port}:`, error);
        return false; // Default to unavailable if there's an error
    }
}

/**
 * Find the next available port starting from a base port
 * @param basePort Starting port number to check from
 * @param maxAttempts Maximum number of ports to check before giving up
 * @returns Promise resolving to available port number or null if none found
 */
export async function findAvailablePort(basePort: number, maxAttempts: number = 20): Promise<number | null> {
    let currentPort = basePort;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        logInfo(`Checking port ${currentPort} for availability`);

        const available = await isPortAvailable(currentPort);

        if (available) {
            logInfo(`Port ${currentPort} is available`);
            return currentPort;
        }

        logInfo(`Port ${currentPort} is in use, trying next port`);
        currentPort++;
    }

    logError(`No available ports found after ${maxAttempts} attempts starting from ${basePort}`);
    return null;
}