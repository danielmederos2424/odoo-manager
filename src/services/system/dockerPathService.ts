// src/services/system/dockerPathService.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logInfo, logError } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Possible Docker installation paths for different operating systems
 */
const DOCKER_PATHS = {
  darwin: [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
    path.join(os.homedir(), '.docker/bin/docker')
  ],
  linux: [
    '/usr/bin/docker',
    '/usr/local/bin/docker'
  ],
  win32: [
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe',
    path.join(os.homedir(), 'AppData\\Local\\Docker\\Docker\\resources\\bin\\docker.exe')
  ]
};

/**
 * Class to handle Docker command path resolution
 */
class DockerPathService {
  private dockerPath: string | null = null;
  private dockerComposePath: string | null = null;

  /**
   * Find the Docker executable path
   */
  async findDockerPath(): Promise<string | null> {
    if (this.dockerPath) {
      return this.dockerPath;
    }

    logInfo('Searching for Docker executable...');
    
    // Try to execute docker directly in case it's in the PATH
    try {
      await execAsync('docker --version');
      this.dockerPath = 'docker';
      logInfo('Docker executable found in PATH');
      return this.dockerPath;
    } catch (error) {
      logInfo('Docker not found in PATH, checking common installation locations');
    }

    // Check common installation paths based on platform
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const possiblePaths = DOCKER_PATHS[platform] || [];

    for (const dockerPath of possiblePaths) {
      try {
        if (fs.existsSync(dockerPath)) {
          logInfo(`Found Docker executable at: ${dockerPath}`);
          this.dockerPath = dockerPath;
          return dockerPath;
        }
      } catch (error) {
        // Ignore errors and continue checking other paths
      }
    }

    // If we get here, Docker executable wasn't found
    logError('Docker executable not found in any common location');
    return null;
  }

  /**
   * Execute a Docker command with the full path to Docker
   */
  async executeDockerCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const dockerPath = await this.findDockerPath();
    
    if (!dockerPath) {
      throw new Error('Docker executable not found. Please ensure Docker is installed and in your PATH.');
    }

    const fullCommand = dockerPath === 'docker' 
      ? `${command}`  // Docker is in PATH
      : `"${dockerPath}" ${command.replace(/^docker\s+/, '')}`;  // Use full path and remove 'docker' prefix
    
    logInfo(`Executing Docker command: ${fullCommand}`);
    return await execAsync(fullCommand);
  }

  /**
   * Check if Docker is running by executing 'docker info'
   */
  async isDockerRunning(): Promise<boolean> {
    try {
      await this.executeDockerCommand('docker info');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the modified PATH including common Docker installation directories
   */
  getEnhancedPath(): string {
    const platform = process.platform;
    const currentPath = process.env.PATH || '';
    let additionalPaths: string[] = [];

    switch (platform) {
      case 'darwin':
        additionalPaths = [
          '/usr/local/bin',
          '/opt/homebrew/bin',
          '/Applications/Docker.app/Contents/Resources/bin',
          path.join(os.homedir(), '.docker/bin')
        ];
        break;
      case 'linux':
        additionalPaths = [
          '/usr/bin',
          '/usr/local/bin'
        ];
        break;
      case 'win32':
        additionalPaths = [
          'C:\\Program Files\\Docker\\Docker\\resources\\bin',
          path.join(os.homedir(), 'AppData\\Local\\Docker\\Docker\\resources\\bin')
        ];
        break;
    }

    // Filter paths that actually exist
    const existingPaths = additionalPaths.filter(p => {
      try {
        return fs.existsSync(p);
      } catch (error) {
        return false;
      }
    });

    // Create the new PATH string with platform-specific separator
    const pathSeparator = platform === 'win32' ? ';' : ':';
    return [...existingPaths, currentPath].join(pathSeparator);
  }
}

export default new DockerPathService();