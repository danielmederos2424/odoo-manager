// src/services/docker/customImagesService.ts
import * as fs from 'fs';
import * as path from 'path';
// import { exec } from 'child_process';
// import { promisify } from 'util';
import { logError } from '../utils/logger';
import {  ensureDir } from '../system/pathService';
import settingsService from '../settings/settingsService';

// const execAsync = promisify(exec);

// Custom Docker image information
export interface CustomImage {
    id: string;            // Unique identifier for the image
    name: string;          // Custom image name
    baseVersion: string;   // Base Odoo version (e.g., 16.0)
    pythonLibraries: string[]; // List of Python libraries to install
    systemPackages: string[]; // List of system packages to install
    createdAt: string;     // Creation timestamp
    updatedAt: string;     // Last update timestamp
    imageName: string;     // Docker image name (odoo-custom:name)
    imageTag: string;      // Docker image tag
    built: boolean;        // Whether the image has been successfully built
}

// Custom image build options
export interface BuildImageOptions {
    name: string;
    baseVersion: string;
    pythonLibraries: string[];
    systemPackages: string[];
    onProgress?: (message: string) => void;
    onError?: (error: string) => void;
    onComplete?: (success: boolean, message: string) => void;
}

class CustomImagesService {
    private customImagesFilePath: string = '';
    // Keep track of active builds to prevent duplicates
    private activeBuilds: Set<string> = new Set();

    constructor() {
        this.initialize();
    }

    /**
     * Initialize the service
     */
    private async initialize(): Promise<void> {
        try {
            // Get work directory path from settings service
            const workDirPath = await settingsService.getWorkDirPath();
            if (workDirPath) {
                this.customImagesFilePath = path.join(workDirPath, 'custom-images.json');
                ensureDir(workDirPath);

                // Create the file if it doesn't exist
                if (!fs.existsSync(this.customImagesFilePath)) {
                    fs.writeFileSync(this.customImagesFilePath, JSON.stringify([], null, 2));
                }
            }
        } catch (error) {
            logError('Error initializing custom images service', error);
        }
    }

    /**
     * Get list of custom images
     */
    async getCustomImages(): Promise<CustomImage[]> {
        try {
            // Make sure we have the latest path
            await this.initialize();

            if (!fs.existsSync(this.customImagesFilePath)) {
                return [];
            }

            const data = fs.readFileSync(this.customImagesFilePath, 'utf-8');
            return JSON.parse(data) as CustomImage[];
        } catch (error) {
            logError('Error getting custom images', error);
            return [];
        }
    }

    /**
     * Save custom image
     */
    async saveCustomImage(customImage: CustomImage): Promise<boolean> {
        try {
            // Make sure we have the latest path
            await this.initialize();

            const customImages = await this.getCustomImages();

            // Update existing or add new
            const existingIndex = customImages.findIndex(img => img.id === customImage.id);
            if (existingIndex >= 0) {
                customImages[existingIndex] = {
                    ...customImage,
                    updatedAt: new Date().toISOString()
                };
            } else {
                customImages.push({
                    ...customImage,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }

            // Save to file
            fs.writeFileSync(this.customImagesFilePath, JSON.stringify(customImages, null, 2));
            return true;
        } catch (error) {
            logError('Error saving custom image', error);
            return false;
        }
    }

    /**
     * Delete custom image
     */
    async deleteCustomImage(id: string): Promise<boolean> {
        try {
            // Make sure we have the latest path
            await this.initialize();

            const customImages = await this.getCustomImages();
            const newCustomImages = customImages.filter(img => img.id !== id);

            // Save to file
            fs.writeFileSync(this.customImagesFilePath, JSON.stringify(newCustomImages, null, 2));
            return true;
        } catch (error) {
            logError('Error deleting custom image', error);
            return false;
        }
    }

    /**
     * Check if image name is available (not used by any existing custom image)
     */
    async isImageNameAvailable(name: string): Promise<boolean> {
        const customImages = await this.getCustomImages();
        return !customImages.some(img => img.name === name);
    }

    /**
     * Validate image name
     */
    validateImageName(name: string): { valid: boolean; message: string } {
        // Check if name is empty
        if (!name.trim()) {
            return { valid: false, message: 'Image name is required' };
        }

        // Check length
        if (name.length < 2 || name.length > 64) {
            return { valid: false, message: 'Image name must be between 2 and 64 characters' };
        }

        // Check format using regex
        // Allow letters, numbers, underscores, and hyphens
        const validFormat = /^[a-zA-Z0-9_-]+$/;
        if (!validFormat.test(name)) {
            return {
                valid: false,
                message: 'Image name can only contain letters, numbers, underscores, and hyphens'
            };
        }

        return { valid: true, message: '' };
    }

    /**
     * Generate Dockerfile content for custom Odoo image
     */
    generateDockerfile(
        baseVersion: string,
        pythonLibraries: string[],
        systemPackages: string[]
    ): string {
        // Start with the base image
        let dockerfileContent = `FROM odoo:${baseVersion}\n\n`;

        // Add system packages if any
        if (systemPackages && systemPackages.length > 0) {
            dockerfileContent += `# Install system packages\n`;
            dockerfileContent += `RUN apt-get update && apt-get install -y --no-install-recommends \\\n`;
            dockerfileContent += `    ${systemPackages.join(' \\\n    ')} \\\n`;
            dockerfileContent += `    && apt-get clean \\\n`;
            dockerfileContent += `    && rm -rf /var/lib/apt/lists/*\n\n`;
        }

        // Add Python libraries if any
        if (pythonLibraries && pythonLibraries.length > 0) {
            dockerfileContent += `# Install Python dependencies\n`;
            dockerfileContent += `COPY requirements.txt /tmp/requirements.txt\n`;
            dockerfileContent += `RUN pip3 install --no-cache-dir -r /tmp/requirements.txt && \\\n`;
            dockerfileContent += `    rm /tmp/requirements.txt\n\n`;
        }

        // Add a label to identify this as a custom Odoo image
        dockerfileContent += `# Add custom labels\n`;
        dockerfileContent += `LABEL org.odoo-manager.custom="true"\n`;
        dockerfileContent += `LABEL org.odoo-manager.base-version="${baseVersion}"\n`;

        return dockerfileContent;
    }

    /**
     * Generate requirements.txt content
     */
    generateRequirementsTxt(pythonLibraries: string[]): string {
        return pythonLibraries.join('\n');
    }

    /**
     * Build custom Docker image
     */
    async buildImage(options: BuildImageOptions): Promise<{ success: boolean; message: string }> {
        const {
            name,
            baseVersion,
            pythonLibraries,
            systemPackages,
            onProgress,
            onError,
            onComplete
        } = options;

        // Check if this image is already being built - prevent duplicate builds
        const buildKey = `${name}-${baseVersion}`;
        if (this.activeBuilds.has(buildKey)) {
            const errorMsg = `Build for ${name} already in progress`;
            if (onError) onError(errorMsg);
            return { success: false, message: errorMsg };
        }

        // Mark this build as active
        this.activeBuilds.add(buildKey);

        try {
            // Make sure we have the latest path
            await this.initialize();

            // Get work directory path
            const workDirPath = await settingsService.getWorkDirPath();
            if (!workDirPath) {
                const errorMsg = 'Work directory path not found';
                if (onError) onError(errorMsg);
                this.activeBuilds.delete(buildKey); // Remove from active builds
                return { success: false, message: errorMsg };
            }

            // Create build directory
            const buildDirPath = path.join(workDirPath, 'builds', name);
            ensureDir(buildDirPath);

            // Generate Dockerfile
            const dockerfileContent = this.generateDockerfile(baseVersion, pythonLibraries, systemPackages);
            fs.writeFileSync(path.join(buildDirPath, 'Dockerfile'), dockerfileContent);

            // Generate requirements.txt if needed
            if (pythonLibraries && pythonLibraries.length > 0) {
                const requirementsTxtContent = this.generateRequirementsTxt(pythonLibraries);
                fs.writeFileSync(path.join(buildDirPath, 'requirements.txt'), requirementsTxtContent);
            }

            // Create a unique image tag
            const imageTag = `odoo-custom:${name.toLowerCase()}`;

            if (onProgress) onProgress(`Starting build for ${imageTag}...`);

            // Build the image using the Docker CLI
            const { spawn } = require('child_process');
            const buildProcess = spawn('docker', ['build', '-t', imageTag, '.'], {
                cwd: buildDirPath,
                shell: true
            });

            let buildOutput = '';
            let hasCompleted = false;

            // Handle process stdout
            buildProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                buildOutput += output;
                if (onProgress) onProgress(output);
            });

            // Handle process stderr
            buildProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                buildOutput += output;
                if (onProgress) onProgress(output);
            });

            // Return a promise that resolves when the build completes
            return new Promise((resolve) => {
                buildProcess.on('close', async (code: number) => {
                    // Make sure we only complete once
                    if (hasCompleted) {
                        return;
                    }

                    hasCompleted = true;
                    // Remove from active builds
                    this.activeBuilds.delete(buildKey);

                    if (code === 0) {
                        // Build successful
                        if (onProgress) onProgress(`Build completed successfully!`);

                        // Save custom image info
                        const customImage: CustomImage = {
                            id: `${Date.now()}`,
                            name,
                            baseVersion,
                            pythonLibraries,
                            systemPackages,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            imageName: imageTag.split(':')[0],
                            imageTag: imageTag.split(':')[1],
                            built: true
                        };

                        await this.saveCustomImage(customImage);

                        const successMsg = `Custom image ${imageTag} built successfully`;
                        if (onComplete) onComplete(true, successMsg);
                        resolve({ success: true, message: successMsg });
                    } else {
                        // Build failed
                        const errorMsg = `Build failed with exit code ${code}`;
                        if (onError) onError(errorMsg);
                        if (onComplete) onComplete(false, errorMsg);
                        resolve({ success: false, message: errorMsg });
                    }
                });

                buildProcess.on('error', (err: Error) => {
                    // Make sure we only complete once
                    if (hasCompleted) {
                        return;
                    }

                    hasCompleted = true;
                    // Remove from active builds
                    this.activeBuilds.delete(buildKey);

                    const errorMsg = `Build process error: ${err.message}`;
                    if (onError) onError(errorMsg);
                    if (onComplete) onComplete(false, errorMsg);
                    resolve({ success: false, message: errorMsg });
                });
            });

        } catch (error) {
            // Remove from active builds in case of error
            this.activeBuilds.delete(buildKey);

            const errorMsg = `Error building custom image: ${error instanceof Error ? error.message : String(error)}`;
            logError(errorMsg, error);
            if (onError) onError(errorMsg);
            if (onComplete) onComplete(false, errorMsg);
            return { success: false, message: errorMsg };
        }
    }
}

export default new CustomImagesService();