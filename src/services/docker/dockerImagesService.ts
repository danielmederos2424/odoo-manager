// src/services/docker/dockerImagesService.ts
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { logError, logInfo } from '../utils/logger';
import dockerPathService from '../system/dockerPathService';

const execAsync = promisify(exec);

// Docker image information
export interface DockerImage {
    name: string;
    installed: boolean;
    downloading: boolean;
    size: string;
}

// Docker network information
export interface DockerNetwork {
    name: string;
    default: boolean;
    driver?: string;
    scope?: string;
}

class DockerImagesService {
    /**
     * Check if Docker is running
     */
    async checkDocker(): Promise<boolean> {
        try {
            // First, enhance the PATH environment to include common Docker installation locations
            process.env.PATH = dockerPathService.getEnhancedPath();
            logInfo(`Enhanced PATH: ${process.env.PATH}`);
            
            // Try to find Docker path first
            const dockerPath = await dockerPathService.findDockerPath();
            if (!dockerPath) {
                logError('Docker executable not found in common locations');
                return false;
            }
            
            // Execute docker info command to check if Docker is running
            await dockerPathService.executeDockerCommand('docker info');
            logInfo('Docker is running');
            return true;
        } catch (error) {
            logError('Docker is not running or not installed', error);
            return false;
        }
    }

    /**
     * Check if Docker Compose is installed
     */
    async checkDockerCompose(): Promise<boolean> {
        try {
            // Try the new Docker Compose V2 command first
            await dockerPathService.executeDockerCommand('docker compose version');
            logInfo('Docker Compose V2 is installed');
            return true;
        } catch (error) {
            try {
                // Fall back to the old docker-compose command
                await execAsync('docker-compose version');
                logInfo('Docker Compose V1 is installed');
                return true;
            } catch (error) {
                logError('Docker Compose is not installed', error);
                return false;
            }
        }
    }

    /**
     * Get available Docker images
     */
    async getImages(): Promise<DockerImage[]> {
        try {
            // Get list of installed images
            const { stdout } = await dockerPathService.executeDockerCommand('docker images --format "{{.Repository}}:{{.Tag}}|{{.Size}}"');
            const installedImages = stdout.trim().split('\n').map(line => {
                const [name, size] = line.split('|');
                return { name, size };
            });

            // Define recommended images
            const recommendedImages = [
                { name: 'odoo:14', size: '1.2 GB' },
                { name: 'odoo:15', size: '1.3 GB' },
                { name: 'odoo:16', size: '1.4 GB' },
                { name: 'odoo:17', size: '1.5 GB' },
                { name: 'odoo:18', size: '1.6 GB' },
                { name: 'odoo:19', size: '1.7 GB' },
                { name: 'postgres:13', size: '0.4 GB' },
                { name: 'postgres:14', size: '0.5 GB' },
                { name: 'postgres:15', size: '0.5 GB' },
                { name: 'postgres:16', size: '0.6 GB' },
            ];

            // Combine lists and mark installed images
            const images: DockerImage[] = recommendedImages.map(recommended => {
                const installed = installedImages.find(i => i.name === recommended.name);
                return {
                    name: recommended.name,
                    installed: !!installed,
                    downloading: false,
                    size: installed ? installed.size : recommended.size
                };
            });

            return images;
        } catch (error) {
            logError('Error getting Docker images', error);
            return [];
        }
    }

    /**
     * Pull a Docker image
     * @param imageName The name of the Docker image to pull
     * @param progressCallback Optional callback to track download progress
     * @param sizeCallback Optional callback to receive size information
     * @returns Promise resolving to true if successful, false otherwise
     */
    async pullImage(
        imageName: string,
        progressCallback?: (percent: number) => void,
        sizeCallback?: (size: { current: string, total: string }) => void
    ): Promise<boolean> {
        try {
            logInfo(`Pulling Docker image: ${imageName}`);

            // Find Docker path
            const dockerPath = await dockerPathService.findDockerPath();
            if (!dockerPath) {
                throw new Error('Docker executable not found');
            }
            
            // Use spawn to stream the output and track progress
            const dockerCommand = dockerPath === 'docker' ? 'docker' : dockerPath;
            const child = spawn(dockerCommand, ['pull', imageName], { 
                shell: true,
                env: { ...process.env, PATH: dockerPathService.getEnhancedPath() }
            });

            // We'll only track progress if callbacks are provided
            if (progressCallback || sizeCallback) {
                let lastPercent = 0;

                // Parse Docker's progress output
                child.stdout.on('data', (data: Buffer) => {
                    const output = data.toString();

                    // Extract progress from Docker output
                    if (progressCallback) {
                        const percentMatch = output.match(/(\d+)%/);
                        if (percentMatch && percentMatch[1]) {
                            const percent = parseInt(percentMatch[1], 10);
                            if (percent !== lastPercent) {
                                progressCallback(percent);
                                lastPercent = percent;
                            }
                        }
                    }

                    // Extract size information if available
                    if (sizeCallback) {
                        // Format is typically like: "5.1MB/10.7MB" or similar
                        const sizeMatch = output.match(/(\d+\.?\d*\s*[KMGT]?B)\/(\d+\.?\d*\s*[KMGT]?B)/);
                        if (sizeMatch && sizeMatch.length >= 3) {
                            sizeCallback({
                                current: sizeMatch[1],
                                total: sizeMatch[2]
                            });
                        }
                    }
                });
            } else {
                // Just log the output
                child.stdout.on('data', (data: Buffer) => {
                    logInfo(`Docker pull output: ${data.toString().trim()}`);
                });
            }

            return new Promise((resolve, reject) => {
                child.on('close', (code: number) => {
                    if (code === 0) {
                        logInfo(`Successfully pulled image: ${imageName}`);
                        if (progressCallback) {
                            progressCallback(100);
                        }
                        resolve(true);
                    } else {
                        logError(`Failed to pull image: ${imageName}, exit code: ${code}`);
                        reject(new Error(`Docker pull failed with exit code ${code}`));
                    }
                });

                child.on('error', (err: Error) => {
                    logError(`Error pulling image: ${imageName}`, err);
                    reject(err);
                });
            });
        } catch (error) {
            logError(`Error pulling image: ${imageName}`, error);
            return false;
        }
    }

    /**
     * Get available Docker networks
     */
    async getNetworks(): Promise<DockerNetwork[]> {
        try {
            // Get list of networks using the format that includes all needed fields
            const { stdout } = await dockerPathService.executeDockerCommand('docker network ls --format "{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}"');

            if (!stdout.trim()) {
                return [{ name: 'bridge', driver: 'bridge', default: true }];
            }

            // Parse networks
            const networks: DockerNetwork[] = stdout.trim().split('\n').map(line => {
                const [id, name, driver, scope] = line.split('|');
                return {
                    name,
                    driver,
                    default: name === 'bridge',
                    scope
                };
            }).filter(network =>
                // Filter out networks we don't want to show
                network.name !== 'none' &&
                network.name !== 'host' &&
                network.name !== 'null'
            );

            // Always include bridge, host networks for selection
            const hasHost = networks.some(n => n.name === 'host');
            const hasBridge = networks.some(n => n.name === 'bridge');

            if (!hasBridge) {
                networks.unshift({ name: 'bridge', driver: 'bridge', default: true, scope: 'local' });
            }

            if (!hasHost) {
                networks.push({ name: 'host', driver: 'host', default: false, scope: 'local' });
            }

            // Sort networks: odoo-network first (if exists), then bridge, then others alphabetically
            return networks.sort((a, b) => {
                if (a.name === 'odoo-network') return -1;
                if (b.name === 'odoo-network') return 1;
                if (a.name === 'bridge') return -1;
                if (b.name === 'bridge') return 1;
                return a.name.localeCompare(b.name);
            });

        } catch (error) {
            logError('Error getting Docker networks', error);
            // Return default networks as fallback
            return [
                { name: 'bridge', driver: 'bridge', default: true, scope: 'local' },
                { name: 'host', driver: 'host', default: false, scope: 'local' }
            ];
        }
    }

    /**
     * Create a new Docker network
     */
    async createNetwork(networkName: string): Promise<boolean> {
        try {
            await dockerPathService.executeDockerCommand(`docker network create ${networkName}`);
            logInfo(`Created Docker network: ${networkName}`);
            return true;
        } catch (error) {
            logError(`Error creating Docker network: ${networkName}`, error);
            throw error;
        }
    }
}

export default new DockerImagesService();