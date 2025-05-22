// src/services/docker/dockerComposeService.ts
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { getAppDataPath } from '../system/pathService';
import settingsService from '../settings/settingsService';
import { logInfo, logError } from '../utils/logger';
import dockerPathService from '../system/dockerPathService';

const execAsync = promisify(exec);

/**
 * Service for managing Docker Compose operations for Odoo instances
 */
class DockerComposeService {
    private projectsPath: string;

    constructor() {
        this.projectsPath = path.join(getAppDataPath(), 'projects');

        // Ensure projects directory exists
        if (!fs.existsSync(this.projectsPath)) {
            try {
                fs.mkdirSync(this.projectsPath, { recursive: true });
                logInfo(`Created projects directory: ${this.projectsPath}`);
            } catch (err) {
                logError(`Failed to create projects directory`, err instanceof Error ? err : new Error(String(err)));
            }
        }
        
        // For Windows, we want to initialize immediately to ensure paths are set correctly
        if (process.platform === 'win32') {
            setTimeout(() => {
                this.initializeWindowsProjectsPath();
            }, 0);
        }
    }
    
    /**
     * Initialize projects path specifically for Windows platform
     * This ensures we always use AppData directory on Windows
     */
    async initializeWindowsProjectsPath(): Promise<void> {
        if (process.platform !== 'win32') return;
        
        try {
            const appDataPath = getAppDataPath();
            logInfo(`Windows: Setting projects path to AppData: ${appDataPath}`);
            this.projectsPath = appDataPath;
            
            // Create odoo and postgres directories if they don't exist
            const odooPath = path.join(this.projectsPath, 'odoo');
            const postgresPath = path.join(this.projectsPath, 'postgres');
            
            if (!fs.existsSync(odooPath)) {
                fs.mkdirSync(odooPath, { recursive: true });
                logInfo(`Windows: Created odoo directory in AppData`);
            }
            
            if (!fs.existsSync(postgresPath)) {
                fs.mkdirSync(postgresPath, { recursive: true });
                logInfo(`Windows: Created postgres directory in AppData`);
            }
            
            logInfo(`Windows: Projects paths initialized: ${this.projectsPath}`);
        } catch (error) {
            logError(`Windows: Error initializing projects paths`, error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Initialize or update the projects path based on workdir
     */
    async initializeProjectsPath(): Promise<void> {
        try {
            // Windows-specific behavior - always use AppData
            if (process.platform === 'win32') {
                await this.initializeWindowsProjectsPath();
                return;
            }
            
            // Original behavior for other platforms
            const workDirPath = await settingsService.getWorkDirPath();
            if (workDirPath) {
                this.projectsPath = workDirPath;

                // Create odoo and postgres directories
                const odooPath = path.join(this.projectsPath, 'odoo');
                const postgresPath = path.join(this.projectsPath, 'postgres');

                // Ensure both directories exist
                if (!fs.existsSync(odooPath)) {
                    fs.mkdirSync(odooPath, { recursive: true });
                }
                if (!fs.existsSync(postgresPath)) {
                    fs.mkdirSync(postgresPath, { recursive: true });
                }

                logInfo(`Updated project paths: ${this.projectsPath}`);
            } else {
                logInfo(`No workdir found, using default path: ${this.projectsPath}`);
            }
        } catch (error) {
            logError(`Error initializing project paths`, error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Check if Docker is running
     */
    async checkDocker(): Promise<boolean> {
        try {
            logInfo('Checking Docker engine status');
            
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
            logInfo('Docker engine is running');
            return true;
        } catch (err) {
            logError('Docker engine is not running or not installed', err instanceof Error ? err : new Error(String(err)));
            return false;
        }
    }

    /**
     * Ensure Docker network exists
     */
    async ensureNetworkExists(networkName: string = 'odoo-network'): Promise<boolean> {
        try {
            logInfo(`Checking if network exists: ${networkName}`);
            const { stdout } = await dockerPathService.executeDockerCommand(`docker network ls --format "{{.Name}}"`);

            if (!stdout.includes(networkName)) {
                logInfo(`Creating network: ${networkName}`);
                await dockerPathService.executeDockerCommand(`docker network create ${networkName}`);
                logInfo(`Network created successfully: ${networkName}`);
            } else {
                logInfo(`Network ${networkName} already exists`);
            }
            return true;
        } catch (err) {
            logError(`Error ensuring network ${networkName} exists`, err instanceof Error ? err : new Error(String(err)));
            return false;
        }
    }

    /**
     * Check if a port is available and find an alternative if needed
     * Improved implementation for better cross-platform support, especially on Windows
     */
    private async checkPortAvailability(port: number): Promise<number> {
        try {
            logInfo(`Testing port ${port} availability`);
            const net = require('net');
            const tester = net.createServer();

            // Check port function - more reliable across platforms
            const checkPort = (port: number): Promise<boolean> => {
                return new Promise((resolve) => {
                    const server = net.createServer()
                        .once('error', (err: any) => {
                            if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
                                logInfo(`Port ${port} is in use or access denied`);
                                resolve(false);
                            } else {
                                // For any other error, we'll still try to use another port
                                logInfo(`Port ${port} check error: ${err.code}`);
                                resolve(false);
                            }
                        })
                        .once('listening', () => {
                            server.close();
                            logInfo(`Port ${port} is available`);
                            resolve(true);
                        });

                    // First try to listen on localhost (more reliable detection on Windows)
                    server.listen(port, '127.0.0.1');
                });
            };

            // Check the requested port
            const isAvailable = await checkPort(port);
            if (isAvailable) {
                return port; // Port is available, use it
            } else {
                throw new Error(`Port ${port} is already in use`);
            }
        } catch (err) {
            logInfo(`Finding alternative port to ${port}`);
            let newPort = null;

            // Try next 20 ports
            for (let testPort = port + 1; testPort < port + 20; testPort++) {
                const net = require('net');
                
                // More reliable port checking function
                const isAvailable = await new Promise<boolean>((resolve) => {
                    const server = net.createServer()
                        .once('error', () => {
                            resolve(false);
                        })
                        .once('listening', () => {
                            server.close();
                            resolve(true);
                        });
                    
                    // On Windows, listen on localhost for more reliable detection
                    server.listen(testPort, '127.0.0.1');
                });

                if (isAvailable) {
                    newPort = testPort;
                    logInfo(`Found available port: ${newPort}`);
                    break;
                } else {
                    logInfo(`Port ${testPort} is in use, trying next one`);
                }
            }

            if (newPort) {
                return newPort;
            }

            throw new Error(`Port ${port} is in use and no alternative ports are available. Please specify a different port.`);
        }
    }

    /**
     * Get the correct Docker Compose command
     */
    async getComposeCommand(): Promise<string> {
        try {
            await dockerPathService.executeDockerCommand('docker compose version');
            return 'docker compose';
        } catch (error) {
            try {
                // Try the old docker-compose command
                await execAsync('docker-compose --version');
                return 'docker-compose';
            } catch (composeError) {
                throw new Error('Docker Compose is not available');
            }
        }
    }

    /**
     * Create a PostgreSQL instance with Docker Compose
     */
    async createPostgresInstance(
        instanceName: string,
        version: string,
        port: number = 5432,
        username: string = 'postgres',
        password: string = 'postgres'
    ): Promise<{ success: boolean; message: string; port?: number }> {
        try {
            logInfo(`Starting PostgreSQL instance creation: ${instanceName}, version: ${version}, port: ${port}`);

            // Make sure we're using the correct path
            await this.initializeProjectsPath();

            // Log where files will be saved
            const projectDir = path.join(this.projectsPath, 'postgres', instanceName);
            logInfo(`Files will be saved to: ${projectDir}`);

            // Check if Docker is running
            if (!await this.checkDocker()) {
                return { success: false, message: 'Docker is not running. Please start Docker and try again.' };
            }

            // Ensure the network exists
            const settings = await settingsService.loadSettings();
            const networkName = settings?.network || 'odoo-network';
            if (!await this.ensureNetworkExists(networkName)) {
                return { success: false, message: `Failed to create or verify network ${networkName}` };
            }

            // Check port availability
            try {
                port = await this.checkPortAvailability(port);
            } catch (error) {
                return {
                    success: false,
                    message: error instanceof Error ? error.message : String(error)
                };
            }

            // Create project directory if it doesn't exist
            if (fs.existsSync(projectDir)) {
                logInfo(`Instance directory already exists: ${projectDir}`);
                return { success: false, message: `Instance ${instanceName} already exists` };
            }

            logInfo(`Creating project directory: ${projectDir}`);
            fs.mkdirSync(projectDir, { recursive: true });

            // Create Docker Compose file
            logInfo(`Generating Docker Compose file with port ${port}`);

            const composeContent = `
services:
  postgres:
    image: postgres:${version}
    container_name: ${instanceName}
    environment:
      - POSTGRES_PASSWORD=${password}
      - POSTGRES_USER=${username}
      - POSTGRES_DB=postgres
    ports:
      - "${port}:5432"
    volumes:
      - ${instanceName}_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - ${networkName}

networks:
  ${networkName}:
    external: true

volumes:
  ${instanceName}_data:
    driver: local
`;

            const composeFilePath = path.join(projectDir, 'docker-compose.yml');
            logInfo(`Writing Docker Compose file to ${composeFilePath}`);
            fs.writeFileSync(composeFilePath, composeContent, 'utf8');

            // Verify file was created
            if (!fs.existsSync(composeFilePath)) {
                logError(`Compose file not created: ${composeFilePath}`);
                return { success: false, message: 'Failed to create Docker Compose file' };
            }

            // Create instance info file
            const infoFile = path.join(projectDir, 'instance-info.json');
            logInfo(`Creating instance info file: ${infoFile}`);

            const info = {
                name: instanceName,
                type: 'postgres',
                version,
                port,
                username,
                password,
                createdAt: new Date().toISOString()
            };

            fs.writeFileSync(infoFile, JSON.stringify(info, null, 2), 'utf8');

            // Start the container with Docker Compose
            logInfo(`Starting PostgreSQL container`);
            const composeCommand = await this.getComposeCommand();

            try {
                logInfo(`Executing: cd "${projectDir}" && ${composeCommand} up -d`);
                const { stdout, stderr } = await execAsync(`cd "${projectDir}" && ${composeCommand} up -d`);

                if (stdout) logInfo(`Docker Compose stdout: ${stdout}`);
                if (stderr) logInfo(`Docker Compose stderr: ${stderr}`);
            } catch (error) {
                logError(`Error starting container`, error);

                // Try to get more error details
                try {
                    const { stdout: logs } = await execAsync(`cd "${projectDir}" && ${composeCommand} logs`);
                    logInfo(`Container logs: ${logs}`);
                } catch (error) {
                    logError(`Couldn't get container logs`, error);
                }

                return {
                    success: false,
                    message: `Error starting container: ${error instanceof Error ? error.message : String(error)}`
                };
            }

            // Verify the container is running
            try {
                logInfo(`Verifying container is running`);
                const { stdout: containerStatus } = await execAsync(`docker ps --filter "name=${instanceName}" --format "{{.Status}}"`);

                logInfo(`Container status: ${containerStatus}`);

                if (!containerStatus.includes('Up')) {
                    logInfo(`Container may not be running correctly`);

                    // Get container logs for debugging
                    try {
                        const { stdout: containerLogs } = await execAsync(`docker logs ${instanceName} --tail 20`);
                        logInfo(`Container logs: ${containerLogs}`);
                    } catch (error) {
                        logError(`Couldn't get container logs`, error);
                    }

                    return {
                        success: true, // Still return success since files were created
                        message: `PostgreSQL instance created, but container may not be running correctly. Check logs.`,
                        port
                    };
                }
            } catch (error) {
                logError(`Error checking container status`, error);
            }

            logInfo(`Successfully created PostgreSQL instance: ${instanceName}`);
            return {
                success: true,
                message: `PostgreSQL instance ${instanceName} created successfully on port ${port}!`,
                port
            };
        } catch (error) {
            logError(`Error creating PostgreSQL instance ${instanceName}`, error);
            return {
                success: false,
                message: `Error creating instance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Start a Docker Compose instance
     */
    async startInstance(instanceName: string): Promise<{ success: boolean; message: string }> {
        try {
            await this.initializeProjectsPath();

            // Determine the correct directory based on instance type
            let projectDir;
            if (instanceName.includes('postgres_')) {
                projectDir = path.join(this.projectsPath, 'postgres', instanceName);
            } else {
                projectDir = path.join(this.projectsPath, 'odoo', instanceName);
            }

            if (!fs.existsSync(projectDir)) {
                return { success: false, message: `Instance ${instanceName} does not exist` };
            }

            const composeFile = path.join(projectDir, 'docker-compose.yml');
            if (!fs.existsSync(composeFile)) {
                return { success: false, message: `Compose file for ${instanceName} not found` };
            }

            const composeCommand = await this.getComposeCommand();
            logInfo(`Starting instance: ${instanceName}`);
            await execAsync(`cd "${projectDir}" && ${composeCommand} up -d`);

            return { success: true, message: `Instance ${instanceName} started successfully` };
        } catch (error) {
            logError(`Error starting instance: ${instanceName}`, error);
            return {
                success: false,
                message: `Error starting instance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Stop a Docker Compose instance
     */
    async stopInstance(instanceName: string): Promise<{ success: boolean; message: string }> {
        try {
            await this.initializeProjectsPath();

            // Determine the correct directory based on instance type
            const instanceType = instanceName.includes('postgres') ? 'postgres' : 'odoo';
            const projectDir = path.join(this.projectsPath, instanceType, instanceName);

            logInfo(`Stopping instance: ${instanceName}`);

            if (!fs.existsSync(projectDir)) {
                return { success: false, message: `Instance ${instanceName} does not exist` };
            }

            const composeFile = path.join(projectDir, 'docker-compose.yml');
            if (!fs.existsSync(composeFile)) {
                return { success: false, message: `Compose file for ${instanceName} not found` };
            }

            // If it's a PostgreSQL instance, check for dependent Odoo instances
            if (instanceType === 'postgres') {
                logInfo(`Checking for dependent Odoo instances before stopping PostgreSQL: ${instanceName}`);

                // List all instances to find dependent ones
                const instances = await this.listInstances();

                // Filter for active Odoo instances that depend on this PostgreSQL instance
                const dependentInstances = instances.filter(instance =>
                    instance.info &&
                    instance.info.type === 'odoo' &&
                    instance.info.postgresInstance === instanceName &&
                    instance.status.toLowerCase().includes('up')
                );

                if (dependentInstances.length > 0) {
                    const dependentNames = dependentInstances.map(instance => instance.name).join(', ');
                    logInfo(`Found running dependent Odoo instances: ${dependentNames}`);
                    return {
                        success: false,
                        message: `Cannot stop PostgreSQL instance "${instanceName}" because it has running Odoo instances that depend on it: ${dependentNames}. Please stop these instances first.`
                    };
                }

                logInfo('No running dependent Odoo instances found, proceeding with stop');
            }

            const composeCommand = await this.getComposeCommand();
            logInfo(`Stopping instance with: ${composeCommand} stop`);
            await execAsync(`cd "${projectDir}" && ${composeCommand} stop`);

            return { success: true, message: `Instance ${instanceName} stopped successfully` };
        } catch (error) {
            logError(`Error stopping instance: ${instanceName}`, error);
            return {
                success: false,
                message: `Error stopping instance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Delete a Docker Compose instance
     */
    async deleteInstance(instanceName: string, keepFiles: boolean = false): Promise<{ success: boolean; message: string }> {
        try {
            await this.initializeProjectsPath();

            // Determine the correct directory based on instance type
            const instanceType = instanceName.includes('postgres') ? 'postgres' : 'odoo';
            const projectDir = path.join(this.projectsPath, instanceType, instanceName);

            logInfo(`Deleting instance: ${instanceName}`);

            if (!fs.existsSync(projectDir)) {
                return { success: false, message: `Instance ${instanceName} does not exist` };
            }

            // If it's a PostgreSQL instance, check for dependent Odoo instances
            if (instanceType === 'postgres') {
                logInfo(`Checking for dependent Odoo instances before deleting PostgreSQL: ${instanceName}`);

                // List all instances to find dependent ones
                const instances = await this.listInstances();

                // Get all Odoo instances that depend on this PostgreSQL instance
                const dependentInstances = instances.filter(instance =>
                    instance.info &&
                    instance.info.type === 'odoo' &&
                    instance.info.postgresInstance === instanceName
                );

                if (dependentInstances.length > 0) {
                    const dependentNames = dependentInstances.map(instance => instance.name).join(', ');
                    logInfo(`Found dependent Odoo instances: ${dependentNames}`);
                    return {
                        success: false,
                        message: `Cannot delete PostgreSQL instance "${instanceName}" because it has Odoo instances that depend on it: ${dependentNames}. Please delete these instances first.`
                    };
                }

                logInfo('No dependent Odoo instances found, proceeding with delete');
            }

            const composeCommand = await this.getComposeCommand();

            // Stop and remove containers
            logInfo(`Stopping containers with ${composeCommand} down`);
            await execAsync(`cd "${projectDir}" && ${composeCommand} down -v`);

            // Delete the directory if keepFiles is false
            if (!keepFiles) {
                logInfo(`Removing directory: ${projectDir}`);
                fs.rmSync(projectDir, { recursive: true, force: true });
            } else {
                logInfo(`Keeping files in: ${projectDir}`);
            }

            return { success: true, message: `Instance ${instanceName} deleted successfully` };
        } catch (error) {
            logError(`Error deleting instance: ${instanceName}`, error);
            return {
                success: false,
                message: `Error deleting instance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Get logs from a Docker container
     */
    async getLogs(instanceName: string, service: string = 'auto', tail: number = 100): Promise<{ success: boolean; logs?: string; message?: string }> {
        try {
            await this.initializeProjectsPath();

            // Determine the correct directory based on instance type
            const instanceType = instanceName.includes('postgres') ? 'postgres' : 'odoo';
            const projectDir = path.join(this.projectsPath, instanceType, instanceName);

            logInfo(`Getting logs for instance: ${instanceName}`);

            if (!fs.existsSync(projectDir)) {
                return { success: false, message: `Instance ${instanceName} does not exist` };
            }

            // If service is auto, determine the default service based on instance type
            if (service === 'auto') {
                service = instanceType === 'postgres' ? 'postgres' : 'odoo';
            }

            logInfo(`Using service: ${service} for logs`);

            const composeCommand = await this.getComposeCommand();
            const { stdout } = await execAsync(`cd "${projectDir}" && ${composeCommand} logs --tail=${tail} ${service}`);
            return { success: true, logs: stdout };
        } catch (error) {
            logError(`Error getting logs for ${instanceName}`, error);
            return {
                success: false,
                message: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * List all Docker Compose instances
     */
    async listInstances(): Promise<Array<{ name: string; status: string; info: any }>> {
        try {
            await this.initializeProjectsPath();
            logInfo('Listing instances from both odoo and postgres directories');
            const instances: Array<{ name: string; status: string; info: any }> = [];

            // Check if base path exists
            if (!fs.existsSync(this.projectsPath)) {
                logInfo('Base directory does not exist');
                return instances;
            }

            // Function to scan a directory for instances
            const scanDirectory = async (dirPath: string, instanceType: string) => {
                if (!fs.existsSync(dirPath)) {
                    logInfo(`${instanceType} directory does not exist: ${dirPath}`);
                    return;
                }

                const dirs = fs.readdirSync(dirPath);
                logInfo(`Found ${dirs.length} directories in ${instanceType} path`);

                for (const dir of dirs) {
                    const instanceDir = path.join(dirPath, dir);
                    const composeFile = path.join(instanceDir, 'docker-compose.yml');
                    const infoFile = path.join(instanceDir, 'instance-info.json');

                    if (fs.existsSync(composeFile) && fs.lstatSync(instanceDir).isDirectory()) {
                        let status = 'Unknown';
                        let info: { [key: string]: any } = {};

                        try {
                            const { stdout } = await execAsync(`docker ps --filter "name=${dir}" --format "{{.Status}}"`);
                            status = stdout.trim() ? stdout.trim() : 'Not running';
                        } catch (error) {
                            status = 'Not running';
                        }

                        if (fs.existsSync(infoFile)) {
                            try {
                                info = JSON.parse(fs.readFileSync(infoFile, 'utf-8'));
                                // Add type information if not present
                                if (!info.type) {
                                    info.type = instanceType === 'odoo' ? 'odoo' : 'postgres';
                                }
                            } catch (error) {
                                info = { name: dir, error: 'Invalid info file', type: instanceType };
                            }
                        } else {
                            info = { name: dir, type: instanceType };
                        }

                        instances.push({
                            name: dir,
                            status,
                            info
                        });

                        logInfo(`Added ${instanceType} instance: ${dir}, status: ${status}`);
                    }
                }
            };

            // Scan both directories
            await scanDirectory(path.join(this.projectsPath, 'odoo'), 'odoo');
            await scanDirectory(path.join(this.projectsPath, 'postgres'), 'postgres');

            return instances;
        } catch (error) {
            logError(`Error listing instances`, error);
            return [];
        }
    }

    /**
     * Update PostgreSQL credentials
     */
    async updatePostgresCredentials(
        instanceName: string,
        newUsername: string,
        newPassword: string
    ): Promise<{ success: boolean; message: string; updatedInstances?: string[] }> {
        try {
            await this.initializeProjectsPath();

            // Find the instance directory
            const projectDir = path.join(this.projectsPath, 'postgres', instanceName);
            logInfo(`Updating PostgreSQL credentials for instance: ${instanceName}`);

            if (!fs.existsSync(projectDir)) {
                return { success: false, message: `Instance ${instanceName} does not exist` };
            }

            // Get existing compose file
            const composeFilePath = path.join(projectDir, 'docker-compose.yml');
            if (!fs.existsSync(composeFilePath)) {
                return { success: false, message: `Docker Compose file for ${instanceName} not found` };
            }

            // Find dependent Odoo instances
            logInfo(`Checking for dependent Odoo instances that need updated credentials`);
            const instances = await this.listInstances();
            const dependentInstances = instances.filter(instance =>
                instance.info &&
                instance.info.type === 'odoo' &&
                instance.info.postgresInstance === instanceName
            );

            // Store dependent instances for reporting
            const dependentNames = dependentInstances.map(instance => instance.name);
            logInfo(`Found ${dependentNames.length} dependent Odoo instances: ${dependentNames.join(', ') || 'none'}`);

            // Read and update the compose file
            const content = fs.readFileSync(composeFilePath, 'utf8');

            // Update environment variables
            const updatedContent = content
                .replace(/- POSTGRES_PASSWORD=[^\n]+/g, `- POSTGRES_PASSWORD=${newPassword}`)
                .replace(/- POSTGRES_USER=[^\n]+/g, `- POSTGRES_USER=${newUsername}`);

            // Write back updated content
            fs.writeFileSync(composeFilePath, updatedContent, 'utf8');

            // Update the instance info file
            const infoFilePath = path.join(projectDir, 'instance-info.json');
            if (fs.existsSync(infoFilePath)) {
                const infoContent = fs.readFileSync(infoFilePath, 'utf8');
                const info = JSON.parse(infoContent);

                // Update credentials
                info.username = newUsername;
                info.password = newPassword;
                info.updatedAt = new Date().toISOString();

                fs.writeFileSync(infoFilePath, JSON.stringify(info, null, 2), 'utf8');
            }

            // Get the compose command for restarting
            const composeCommand = await this.getComposeCommand();

            // Restart the PostgreSQL container
            logInfo(`Restarting PostgreSQL instance: ${instanceName}`);
            await execAsync(`cd "${projectDir}" && ${composeCommand} down && ${composeCommand} up -d`);

            // Update each dependent Odoo instance
            const updatedInstances = [];
            const failedUpdates = [];

            for (const odooInstance of dependentInstances) {
                try {
                    logInfo(`Updating config for dependent Odoo instance: ${odooInstance.name}`);

                    // Path to the Odoo instance directory
                    const odooDir = path.join(this.projectsPath, 'odoo', odooInstance.name);

                    // Update odoo.conf file
                    const configDir = path.join(odooDir, 'config');
                    const odooConfPath = path.join(configDir, 'odoo.conf');

                    if (fs.existsSync(odooConfPath)) {
                        let odooConfContent = fs.readFileSync(odooConfPath, 'utf8');

                        // Update database credentials in configuration
                        odooConfContent = odooConfContent
                            .replace(/db_user = .*/g, `db_user = ${newUsername}`)
                            .replace(/db_password = .*/g, `db_password = ${newPassword}`);

                        // Write back updated odoo.conf
                        fs.writeFileSync(odooConfPath, odooConfContent, 'utf8');
                        logInfo(`Updated odoo.conf for ${odooInstance.name}`);

                        // Update instance-info.json if it exists
                        const odooInfoPath = path.join(odooDir, 'instance-info.json');
                        if (fs.existsSync(odooInfoPath)) {
                            const odooInfo = JSON.parse(fs.readFileSync(odooInfoPath, 'utf8'));

                            // Update PostgreSQL credentials reference
                            if (!odooInfo.pgCredentials) odooInfo.pgCredentials = {};
                            odooInfo.pgCredentials.username = newUsername;
                            odooInfo.pgCredentials.password = newPassword;
                            odooInfo.updatedAt = new Date().toISOString();

                            fs.writeFileSync(odooInfoPath, JSON.stringify(odooInfo, null, 2), 'utf8');
                            logInfo(`Updated instance-info.json for ${odooInstance.name}`);
                        }

                        // Restart the Odoo instance if it's running
                        if (odooInstance.status.toLowerCase().includes('up')) {
                            logInfo(`Restarting dependent Odoo instance: ${odooInstance.name}`);
                            try {
                                await execAsync(`cd "${odooDir}" && ${composeCommand} down && ${composeCommand} up -d`);
                                logInfo(`Successfully restarted ${odooInstance.name}`);
                            } catch (restartErr) {
                                logError(`Error restarting Odoo instance ${odooInstance.name}`, restartErr);
                                failedUpdates.push({name: odooInstance.name, error: 'restart failure'});
                                continue;
                            }
                        } else {
                            logInfo(`Odoo instance ${odooInstance.name} is not running, no need to restart`);
                        }

                        // Mark as successfully updated
                        updatedInstances.push(odooInstance.name);
                    } else {
                        logInfo(`Could not find odoo.conf for ${odooInstance.name}, skipping update`);
                        failedUpdates.push({name: odooInstance.name, error: 'missing configuration file'});
                    }
                } catch (instanceError) {
                    logError(`Error updating Odoo instance ${odooInstance.name}`, instanceError);
                    failedUpdates.push({name: odooInstance.name, error: 'general error'});
                }
            }

            // Prepare detailed success message
            let successMessage = `PostgreSQL credentials updated successfully for ${instanceName}.`;

            if (updatedInstances.length > 0) {
                successMessage += ` Updated ${updatedInstances.length} dependent Odoo instance(s): ${updatedInstances.join(', ')}.`;
            }

            if (failedUpdates.length > 0) {
                const failedNames = failedUpdates.map(f => f.name).join(', ');
                successMessage += ` Failed to update ${failedUpdates.length} instance(s): ${failedNames}.`;
            }

            return {
                success: true,
                message: successMessage,
                updatedInstances
            };
        } catch (error) {
            logError(`Error updating PostgreSQL credentials`, error);
            return {
                success: false,
                message: `Error updating credentials: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Create an Odoo instance with Docker Compose
     */
    async createInstance(
        instanceName: string,
        version: string,
        edition?: string,
        adminPassword?: string,
        dbFilter?: boolean,
        port?: number,
        customImage?: boolean,
        customImageName?: string,
        postgresInstance?: string,
        pgUser?: string,
        pgPassword?: string
    ): Promise<{ success: boolean; message: string; port?: number }> {
        try {
            logInfo(`Starting Odoo instance creation: ${instanceName}, version: ${version}, edition: ${edition}`);

            // Make sure we're using the correct path
            await this.initializeProjectsPath();

            // Log where files will be saved
            const projectDir = path.join(this.projectsPath, 'odoo', instanceName);
            logInfo(`Files will be saved to: ${projectDir}`);

            // Check if Docker is running
            if (!await this.checkDocker()) {
                return { success: false, message: 'Docker is not running. Please start Docker and try again.' };
            }

            // Ensure network exists
            const settings = await settingsService.loadSettings();
            const networkName = settings?.network || 'odoo-network';
            if (!await this.ensureNetworkExists(networkName)) {
                return { success: false, message: `Failed to create or verify network ${networkName}` };
            }

            // Validate PostgreSQL instance
            if (!postgresInstance) {
                return { success: false, message: 'PostgreSQL instance is required' };
            }

            // Verify if PostgreSQL instance exists and is running
            try {
                const { stdout: pgStatus } = await execAsync(`docker ps --filter "name=${postgresInstance}" --format "{{.Status}}"`);
                if (!pgStatus || !pgStatus.toLowerCase().includes('up')) {
                    return { success: false, message: `PostgreSQL instance ${postgresInstance} is not running. Please start it first.` };
                }
            } catch (err) {
                logError(`Error checking PostgreSQL status`, err);
                return { success: false, message: `PostgreSQL instance ${postgresInstance} not found or not accessible.` };
            }

            // Verify linked instances count
            try {
                // List all instances to find linked ones
                const instances = await this.listInstances();
                const linkedInstances = instances.filter(inst =>
                    inst.info && inst.info.postgresInstance === postgresInstance
                );

                if (linkedInstances.length >= 4) {
                    return { success: false, message: `PostgreSQL instance ${postgresInstance} already has 4 linked Odoo instances. Please use another PostgreSQL instance.` };
                }
                logInfo(`Found ${linkedInstances.length} Odoo instances linked to ${postgresInstance}`);
            } catch (err) {
                logError(`Error checking linked instances count`, err);
                // Continue anyway, just log the error
            }

            // Check port availability
            const defaultPort = port || 8069;
            try {
                port = await this.checkPortAvailability(defaultPort);
            } catch (err) {
                return {
                    success: false,
                    message: err instanceof Error ? err.message : String(err)
                };
            }

            // Create project directory if it doesn't exist
            if (fs.existsSync(projectDir)) {
                logInfo(`Instance directory already exists: ${projectDir}`);
                return { success: false, message: `Instance ${instanceName} already exists` };
            }

            logInfo(`Creating project directory: ${projectDir}`);
            fs.mkdirSync(projectDir, { recursive: true });

            // Create config directory for odoo.conf
            const configDir = path.join(projectDir, 'config');
            fs.mkdirSync(configDir, { recursive: true });

            // Create addons directory
            const addonsDir = path.join(projectDir, 'addons');
            fs.mkdirSync(addonsDir, { recursive: true });

            // Create odoo.conf file with the proper configuration
            const odooConfPath = path.join(configDir, 'odoo.conf');
            const dbFilterStr = dbFilter ? `\ndbfilter = ^${instanceName}.*$` : '';

            // Use provided PostgreSQL credentials or defaults
            const pgUserVal = pgUser || 'postgres';
            const pgPasswordVal = pgPassword || 'postgres';

            const majorVersion = version.split('.')[0];

            const addonsPathStr = edition === 'Enterprise'
                ? `/mnt/extra-addons, /mnt/enterprise-addons/${majorVersion}`
                : `/mnt/extra-addons`;

            const odooConfContent = `[options]
addons_path = ${addonsPathStr}
data_dir = /var/lib/odoo
admin_passwd = ${adminPassword}${dbFilterStr}
db_host = ${postgresInstance}
db_password = ${pgPasswordVal}
db_port = 5432
db_template = template0
db_user = ${pgUserVal}
list_db = True
`;
            logInfo(`Creating odoo.conf`);
            fs.writeFileSync(odooConfPath, odooConfContent, 'utf8');

            // Determine the Docker image to use
            const dockerImage = customImage && customImageName
                ? `odoo-custom:${customImageName}`
                : `odoo:${version}`;

            logInfo(`Using Docker image: ${dockerImage}`);

            // Create Docker Compose file
            const composeContent = `
services:
  odoo:
    image: ${dockerImage}
    container_name: ${instanceName}
    ports:
      - "${port}:8069"
    volumes:
      - ${instanceName}_data:/var/lib/odoo
      - ./config:/etc/odoo
      - ./addons:/mnt/extra-addons
${edition === 'Enterprise' ? `      - ${this.projectsPath}/enterprise_addons/${majorVersion}:/mnt/enterprise-addons/${majorVersion}` : ''}
    environment:
      - POSTGRES_USER=${pgUserVal}
      - POSTGRES_PASSWORD=${pgPasswordVal}
      - POSTGRES_HOST=${postgresInstance}
      - POSTGRES_PORT=5432
    restart: unless-stopped
    networks:
      - ${networkName}
    external_links:
      - ${postgresInstance}:${postgresInstance}

networks:
  ${networkName}:
    external: true

volumes:
  ${instanceName}_data:
    driver: local
`;

            const composeFilePath = path.join(projectDir, 'docker-compose.yml');
            logInfo(`Writing Docker Compose file to ${composeFilePath}`);
            fs.writeFileSync(composeFilePath, composeContent, 'utf8');

            // Verify if enterprise_addons directory exists and warn if not
            const enterpriseAddonsDir = path.join(this.projectsPath, 'enterprise_addons', version);
            if (edition === 'Enterprise' && !fs.existsSync(enterpriseAddonsDir)) {
                logInfo(`Enterprise addons directory not found: ${enterpriseAddonsDir}`);

                // Create the directory so Docker Compose doesn't fail
                fs.mkdirSync(enterpriseAddonsDir, { recursive: true });

                // Add a README file to explain what to do
                const readmePath = path.join(enterpriseAddonsDir, 'README.txt');
                fs.writeFileSync(readmePath, `This directory should contain Odoo Enterprise addons for version ${version}.
If you have access to Odoo Enterprise repository, please clone or copy those addons to this location.`, 'utf8');
            }

            // Create instance info file
            const infoFile = path.join(projectDir, 'instance-info.json');
            logInfo(`Creating instance info file: ${infoFile}`);

            const info = {
                name: instanceName,
                type: 'odoo',
                version,
                edition,
                port,
                adminPassword,
                dbFilter,
                customImage: !!(customImage && customImageName),
                customImageName: customImage && customImageName ? customImageName : undefined,
                postgresInstance,
                createdAt: new Date().toISOString()
            };

            fs.writeFileSync(infoFile, JSON.stringify(info, null, 2), 'utf8');

            // Start the container
            logInfo(`Starting Odoo container`);
            const composeCommand = await this.getComposeCommand();

            try {
                logInfo(`Executing: cd "${projectDir}" && ${composeCommand} up -d`);
                const { stdout, stderr } = await execAsync(`cd "${projectDir}" && ${composeCommand} up -d`);

                if (stdout) logInfo(`Docker Compose stdout: ${stdout}`);
                if (stderr) logInfo(`Docker Compose stderr: ${stderr}`);
            } catch (error) {
                logError(`Error starting container`, error);

                // Try to get more error details
                try {
                    const { stdout: logs } = await execAsync(`cd "${projectDir}" && ${composeCommand} logs`);
                    logInfo(`Container logs: ${logs}`);
                } catch (error) {
                    logError(`Couldn't get container logs`, error);
                }

                return {
                    success: false,
                    message: `Error starting container: ${error instanceof Error ? error.message : String(error)}`
                };
            }

            // Verify the container is running
            try {
                logInfo(`Verifying container is running`);
                const { stdout: containerStatus } = await execAsync(`docker ps --filter "name=${instanceName}" --format "{{.Status}}"`);

                logInfo(`Container status: ${containerStatus}`);

                if (!containerStatus.includes('Up')) {
                    logInfo(`Container may not be running correctly`);

                    // Get container logs for debugging
                    try {
                        const { stdout: containerLogs } = await execAsync(`docker logs ${instanceName} --tail 20`);
                        logInfo(`Container logs: ${containerLogs}`);
                    } catch (error) {
                        logError(`Couldn't get container logs`, error);
                    }

                    return {
                        success: true, // Still return success since files were created
                        message: `Odoo instance created, but container may not be running correctly. Check logs.`,
                        port
                    };
                }
            } catch (error) {
                logError(`Error checking container status`, error);
            }

            logInfo(`Successfully created Odoo instance: ${instanceName}`);
            return {
                success: true,
                message: `Odoo instance ${instanceName} created successfully on port ${port}!`,
                port
            };
        } catch (error) {
            logError(`Error creating Odoo instance ${instanceName}`, error);
            return {
                success: false,
                message: `Error creating instance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

export default new DockerComposeService();