// src/utils/dockerUtils.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { logError } from '../services/utils/logger';

const execAsync = promisify(exec);

/**
 * Check if a container name already exists in Docker
 * @param name Container name to check
 * @returns Promise resolving to boolean indicating if name exists
 */
export async function containerNameExists(name: string): Promise<boolean> {
    try {
        // Get all container names including stopped ones
        const { stdout } = await execAsync('docker ps -a --format "{{.Names}}"');

        // Split by newline and check if name exists
        const containerNames = stdout.trim().split('\n');
        return containerNames.includes(name);
    } catch (error) {
        logError(`Error checking container name ${name}:`, error);
        return false; // Default to not existing if there's an error
    }
}

/**
 * Get a suggested unique container name
 * @param baseName Base name for the container
 * @param version PostgreSQL version
 * @returns Promise resolving to a unique container name
 */
export async function getSuggestedContainerName(baseName: string, version: string): Promise<string> {
    // Start with the base name
    let suggestedName = `postgres_${version}_${baseName}`;

    // Check if the name exists
    let nameExists = await containerNameExists(suggestedName);
    let counter = 1;

    // If name exists, append a counter until we find a unique name
    while (nameExists && counter < 100) {
        suggestedName = `postgres_${version}_${baseName}_${counter}`;
        nameExists = await containerNameExists(suggestedName);
        counter++;
    }

    return suggestedName;
}