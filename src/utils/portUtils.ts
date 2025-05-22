// src/utils/portUtils.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { logError, logInfo } from '../services/utils/logger';
import * as net from 'net';

const execAsync = promisify(exec);

/**
 * Check if a port is available system-wide using a more reliable cross-platform approach
 * @param port Port number to check
 * @returns Promise resolving to boolean indicating if port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    try {
        // Try both TCP socket method and system command method for better reliability
        const socketAvailable = await checkPortWithSocket(port);
        
        // If the socket check determines the port is in use, return false immediately
        if (!socketAvailable) {
            logInfo(`Port ${port} is in use (determined by socket check)`);
            return false;
        }
        
        // Double-check with system commands for more reliability
        const commandAvailable = await checkPortWithSystemCommand(port);
        
        // Return result from system command check
        return commandAvailable;
    } catch (error) {
        logError(`Error checking port ${port}:`, error);
        return false; // Default to unavailable if there's an error
    }
}

/**
 * Check port availability using Node.js net module (socket approach)
 * More reliable across platforms, especially for Windows
 */
async function checkPortWithSocket(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer()
            .once('error', (err: any) => {
                if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
                    logInfo(`Port ${port} is in use or access denied (socket check)`);
                    resolve(false);
                } else {
                    // For any other error, we'll still consider it unavailable
                    logInfo(`Port ${port} check error: ${err.code}`);
                    resolve(false);
                }
            })
            .once('listening', () => {
                server.close();
                logInfo(`Port ${port} is available (socket check)`);
                resolve(true);
            });

        // For Windows, explicitly using 127.0.0.1 is more reliable
        if (process.platform === 'win32') {
            server.listen(port, '127.0.0.1');
        } else {
            server.listen(port);
        }
    });
}

/**
 * Check port availability using system commands
 * This adds a layer of verification and handles some edge cases
 */
async function checkPortWithSystemCommand(port: number): Promise<boolean> {
    try {
        // Different commands for different platforms
        let command: string;

        switch (process.platform) {
            case 'win32':
                // Windows - use netstat with more specific filtering
                // The TCP IPv4 filter ensures we check only TCP ports
                command = `netstat -ano | findstr "TCP.*:${port} "`;
                break;
            default:
                // Linux/macOS - use lsof
                command = `lsof -i:${port} -sTCP:LISTEN`;
                break;
        }

        const { stdout } = await execAsync(command);

        // If the output contains the port, it's in use
        const isAvailable = stdout.trim() === '';
        logInfo(`Port ${port} is ${isAvailable ? 'available' : 'in use'} (system command check)`);
        return isAvailable;
    } catch (error) {
        // In some cases, if the command fails, it means the port is not in use
        // This is especially true for lsof, which returns an error if no processes are using the port
        // @ts-ignore
        if (error.code === 1 && process.platform !== 'win32') {
            logInfo(`Port ${port} is available (lsof returned exit code 1)`);
            return true;
        }

        // For Windows, if the command fails, we'll trust the socket check result
        if (process.platform === 'win32') {
            logInfo(`Port ${port} system command check failed, trusting socket check`);
            return true;
        }

        logError(`Error in system command check for port ${port}:`, error);
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