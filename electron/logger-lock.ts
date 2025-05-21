import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Path to store the lock file
const getLockFilePath = () => {
    return path.join(app.getPath('userData'), 'logger-lock.json');
};

// Write current log file info to lock file
export function setLogFileLock(logFilePath: string): boolean {
    try {
        const lockFilePath = getLockFilePath();
        const data = { 
            activeLogFile: logFilePath, 
            timestamp: new Date().toISOString(),
            version: 2, // Version to identify single log file strategy
        };
        fs.writeFileSync(lockFilePath, JSON.stringify(data));
        return true;
    } catch (err) {
        console.error('Error writing logger lock file:', err);
        return false;
    }
}

// Read current log file info from lock file
export function getLogFileLock(): string | null {
    try {
        const lockFilePath = getLockFilePath();
        if (fs.existsSync(lockFilePath)) {
            const data = JSON.parse(fs.readFileSync(lockFilePath));

            // With the new single log file approach, we always want to use
            // the same log file, so we don't need to check for staleness anymore
            // We just need to ensure the path exists
            
            // Validate the path exists
            if (data.activeLogFile && fs.existsSync(data.activeLogFile)) {
                return data.activeLogFile;
            } else {
                // If the log file doesn't exist, create its directory
                if (data.activeLogFile) {
                    try {
                        const logDir = path.dirname(data.activeLogFile);
                        if (!fs.existsSync(logDir)) {
                            fs.mkdirSync(logDir, { recursive: true });
                        }
                    } catch (dirErr) {
                        console.error('Error creating log directory:', dirErr);
                    }
                }
            }
        }
        return null;
    } catch (err) {
        console.error('Error reading logger lock file:', err);
        return null;
    }
}