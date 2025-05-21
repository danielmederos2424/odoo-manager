// src/components/screens/SplashScreen.tsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Button, useTheme, Alert, Snackbar } from '@mui/material';
import { RefreshRounded as RefreshIcon } from '@mui/icons-material';
import odooLogo from '../../assets/imgs/odoo.png';
import dockerLogo from '../../assets/imgs/docker.png';
import { useAppVersion } from '../../hooks/useAppVersion';
import dockerImagesService from '../../services/docker/dockerImagesService';
import settingsService from '../../services/settings/settingsService';
import * as fs from 'fs';
import * as path from 'path';
import { getElectronAPI } from '../../utils/electron';
import { useTranslation } from 'react-i18next';
import { logInfo, logError, logWarn } from '../../services/utils/logger';

interface VerificationStatus {
    docker: 'idle' | 'checking' | 'success' | 'error';
    network: 'idle' | 'checking' | 'success' | 'error';
    postgres: 'idle' | 'checking' | 'success' | 'error';
}

interface ErrorState {
    docker?: string;
    network?: string;
    postgres?: string;
    general?: string;
}

const SplashScreen: React.FC = () => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const { t } = useTranslation();
    const electron = getElectronAPI();

    // State to track if IPC is available
    const [isIpcAvailable, setIsIpcAvailable] = useState(true);
    const [verificationStarted, setVerificationStarted] = useState(false);
    const [status, setStatus] = useState<VerificationStatus>({
        docker: 'idle',
        network: 'idle',
        postgres: 'idle'
    });
    const [progress, setProgress] = useState(0);
    const [errorState, setErrorState] = useState<ErrorState>({});
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [readyToComplete, setReadyToComplete] = useState(false);
    const [workDir, setWorkDir] = useState<string | null>(null);
    const [networkName, setNetworkName] = useState('odoo-network');
    const [composeFilesExist, setComposeFilesExist] = useState(false);
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'success' as 'success' | 'error' | 'info' | 'warning'
    });

    // Check if ipcRenderer is available
    useEffect(() => {
        if (!electron?.ipcRenderer) {
            logError('IPC Renderer is not available. Verification may not complete properly.');
            setNotification({
                open: true,
                message: t('ipcNotAvailable'),
                severity: 'error'
            });
            setIsIpcAvailable(false);
        } else {
            logInfo('IPC Renderer is available.');
        }
    }, []);

    // Critical function to signal completion
    const signalComplete = () => {
        try {
            logInfo('Signaling verification complete');
            const rootEl = document.getElementById('root');
            if (rootEl) {
                try {
                    rootEl.classList.add('splash-fade-out');
                } catch (e) {
                    logWarn('Failed to add fade-out class', e);
                }

                // Create a style for the fade-out if it doesn't exist
                try {
                    if (!document.getElementById('splash-fade-style')) {
                        const style = document.createElement('style');
                        style.id = 'splash-fade-style';
                        style.textContent = `
                            .splash-fade-out {
                                opacity: 0 !important;
                                transition: opacity 400ms ease-out !important;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                } catch (e) {
                    logWarn('Failed to create fade-out style', e);
                }

                // Use setTimeout to wait for animation before signaling
                setTimeout(() => {
                    try {
                        if (electron?.ipcRenderer) {
                            logInfo('Sending verification-complete signal');
                            electron.ipcRenderer.send('verification-complete');
                        } else {
                            logError('IPC Renderer not available for sending completion signal');
                            window.location.hash = '#/main';
                        }
                    } catch (innerErr) {
                        logError('Error in delayed signal completion', innerErr);
                        window.location.hash = '#/main';
                    }
                }, 200);
            } else {
                logWarn('Root element not found when signaling completion');
                if (electron?.ipcRenderer) {
                    electron.ipcRenderer.send('verification-complete');
                } else {
                    window.location.hash = '#/main';
                }
            }
        } catch (err) {
            logError('Error sending verification signal', err);

            try {
                if (electron?.ipcRenderer) {
                    electron.ipcRenderer.send('verification-complete');
                } else {
                    window.location.hash = '#/main';
                }
            } catch (e) {
                logError('Final fallback - redirecting to main', e);
                window.location.hash = '#/main';
            }
        }
    };

    // Function to restart all checks from the beginning
    const restartAllChecks = async () => {
        logInfo('Restarting all verification checks');
        setErrorState({});
        setStatus({
            docker: 'idle',
            network: 'idle',
            postgres: 'idle'
        });

        setCurrentVerificationStep(0);
        setVerificationStarted(false);

        await new Promise(resolve => setTimeout(resolve, 300));
    };

    // Check if Docker is running
    const checkDocker = async (): Promise<boolean> => {
        try {
            logInfo('Starting Docker verification');
            setProgress(10);

            await new Promise(resolve => setTimeout(resolve, 150));

            const dockerRunning = await dockerImagesService.checkDocker();

            if (!dockerRunning) {
                logError('Docker is not running');
                setErrorState(prev => ({
                    ...prev,
                    docker: t('dockerNotRunning')
                }));
                setStatus(prev => ({ ...prev, docker: 'error' }));
                return false;
            }

            setProgress(20);
            logInfo('Docker is running, checking Docker Compose');

            await new Promise(resolve => setTimeout(resolve, 100));

            const composeInstalled = await dockerImagesService.checkDockerCompose();

            if (!composeInstalled) {
                logError('Docker Compose is not installed');
                setErrorState(prev => ({
                    ...prev,
                    docker: t('dockerComposeNotInstalled')
                }));
                setStatus(prev => ({ ...prev, docker: 'error' }));
                return false;
            }

            logInfo('Docker and Docker Compose verification completed successfully');
            setProgress(30);
            setStatus(prev => ({ ...prev, docker: 'success' }));
            return true;
        } catch (err) {
            const error = err as Error;
            logError('Error checking Docker', error);
            setErrorState(prev => ({
                ...prev,
                docker: `Error checking Docker: ${error.message}`
            }));
            setStatus(prev => ({ ...prev, docker: 'error' }));
            return false;
        }
    };

    // Check Docker network
    const checkNetwork = async (): Promise<boolean> => {
        try {
            if (status.docker !== 'success') {
                logWarn('Cannot check network because Docker verification failed');
                setStatus(prev => ({ ...prev, network: 'idle' }));
                setErrorState(prev => ({
                    ...prev,
                    network: t('dockerVerificationFailed')
                }));
                return false;
            }

            logInfo('Starting network verification');
            setStatus(prev => ({ ...prev, network: 'checking' }));
            setProgress(40);

            const settings = await settingsService.loadSettings();
            const targetNetwork = settings?.network || 'odoo-network';
            setNetworkName(targetNetwork);
            logInfo(`Target network name: ${targetNetwork}`);

            const networks = await dockerImagesService.getNetworks();
            const networkExists = networks.some(n => n.name === targetNetwork);

            if (!networkExists) {
                try {
                    logInfo(`Network ${targetNetwork} does not exist, creating it`);
                    setNotification({
                        open: true,
                        message: t('creatingRequiredNetwork', { name: targetNetwork }),
                        severity: 'info'
                    });

                    await dockerImagesService.createNetwork(targetNetwork);
                    logInfo(`Created Docker network: ${targetNetwork}`);

                    setNotification({
                        open: true,
                        message: t('createdDockerNetwork', { name: targetNetwork }),
                        severity: 'success'
                    });
                } catch (err) {
                    const error = err as Error;
                    logError(`Failed to create network ${targetNetwork}`, error);
                    setErrorState(prev => ({
                        ...prev,
                        network: t('failedToCreateNetwork', { name: targetNetwork, message: error.message })
                    }));
                    setStatus(prev => ({ ...prev, network: 'error' }));
                    return false;
                }
            } else {
                logInfo(`Network ${targetNetwork} already exists`);
            }

            logInfo('Network verification completed successfully');
            setProgress(60);
            setStatus(prev => ({ ...prev, network: 'success' }));
            return true;
        } catch (err) {
            const error = err as Error;
            logError('Error checking network', error);
            setErrorState(prev => ({
                ...prev,
                network: `Error checking network: ${error.message}`
            }));
            setStatus(prev => ({ ...prev, network: 'error' }));
            return false;
        }
    };

    // Check PostgreSQL
    const checkPostgres = async (): Promise<boolean> => {
        try {
            if (status.network !== 'success') {
                logWarn('Cannot check PostgreSQL because network verification failed');
                setStatus(prev => ({ ...prev, postgres: 'idle' }));
                setErrorState(prev => ({
                    ...prev,
                    postgres: t('networkVerificationFailed')
                }));
                return false;
            }

            logInfo('Starting PostgreSQL verification');
            setStatus(prev => ({ ...prev, postgres: 'checking' }));
            setProgress(70);

            if (!workDir) {
                logInfo('No work directory set, skipping PostgreSQL check');
                setProgress(100);
                setStatus(prev => ({ ...prev, postgres: 'success' }));
                return true; // Not an error, just skip
            }

            // Check both old project directory structure and new postgres directory structure
            const projectsPath = path.join(workDir, 'projects');
            const postgresPath = path.join(workDir, 'postgres');

            let hasPostgresInstances = false;
            let postgresInstancePaths: Array<{dir: string, path: string}> = [];

            // Check old structure (projects/*)
            if (fs.existsSync(projectsPath)) {
                const projectDirs = fs.readdirSync(projectsPath);

                // Find docker-compose files in projects directory
                projectDirs.forEach(dir => {
                    const composePath = path.join(projectsPath, dir, 'docker-compose.yml');
                    if (fs.existsSync(composePath)) {
                        try {
                            const composeContent = fs.readFileSync(composePath, 'utf-8');
                            if (composeContent.includes('image: postgres:') ||
                                composeContent.includes('container_name: db')) {
                                postgresInstancePaths.push({dir, path: path.join(projectsPath, dir)});
                                hasPostgresInstances = true;
                            }
                        } catch (err) {
                            logWarn(`Error reading docker-compose file for ${dir}`, err);
                        }
                    }
                });
            }

            // Check new structure (postgres/*)
            if (fs.existsSync(postgresPath)) {
                const pgInstances = fs.readdirSync(postgresPath);

                // Find docker-compose files in postgres directory
                pgInstances.forEach(dir => {
                    const composePath = path.join(postgresPath, dir, 'docker-compose.yml');
                    if (fs.existsSync(composePath)) {
                        postgresInstancePaths.push({dir, path: path.join(postgresPath, dir)});
                        hasPostgresInstances = true;
                    }
                });
            }

            logInfo(`Found ${postgresInstancePaths.length} PostgreSQL instances`);
            setComposeFilesExist(hasPostgresInstances);

            if (!hasPostgresInstances) {
                logInfo('No PostgreSQL instances found, skipping further checks');
                setProgress(100);
                setStatus(prev => ({ ...prev, postgres: 'success' }));
                return true; // Not an error, just skip
            }

            try {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);

                const { stdout } = await execAsync('docker ps --format "{{.Names}}"');
                const runningContainers = stdout.trim().split('\n');
                logInfo(`Found ${runningContainers.length} running containers`);

                // Check if any PostgreSQL instances are not running
                const notRunningInstances = postgresInstancePaths.filter(instance => {
                    return !runningContainers.some(container =>
                        container === instance.dir ||
                        container.includes(instance.dir) ||
                        container.includes('postgres') ||
                        container.includes('db')
                    );
                });

                if (notRunningInstances.length > 0) {
                    logWarn(`Found ${notRunningInstances.length} PostgreSQL containers that are not running`);
                    setStatus(prev => ({ ...prev, postgres: 'error' }));
                    setErrorState(prev => ({
                        ...prev,
                        postgres: t('foundPostgresContainers', { count: notRunningInstances.length })
                    }));

                    // Store the list of containers to start
                    sessionStorage.setItem('postgresContainersToStart', JSON.stringify({
                        instances: notRunningInstances.map(instance => ({
                            path: instance.path,
                            name: instance.dir
                        }))
                    }));

                    return false;
                }
            } catch (err) {
                logWarn('Error checking running containers', err);
                // This is not a fatal error, continue
            }

            logInfo('PostgreSQL verification completed successfully');
            setProgress(100);
            setStatus(prev => ({ ...prev, postgres: 'success' }));
            return true;
        } catch (err) {
            const error = err as Error;
            logError('Error checking PostgreSQL', error);
            setErrorState(prev => ({
                ...prev,
                postgres: `Error checking PostgreSQL: ${error.message}`
            }));
            setStatus(prev => ({ ...prev, postgres: 'error' }));
            return false;
        }
    };

    // Step-based verification
    const [currentVerificationStep, setCurrentVerificationStep] = useState<number>(0);

    // Initial preparation function
    const prepareVerification = async (): Promise<void> => {
        try {
            logInfo('Preparing verification process');
            setVerificationStarted(true);
            setProgress(5);
            setErrorState({});

            const dir = await settingsService.getWorkDirPath();
            logInfo(`Work directory: ${dir || 'not set'}`);
            setWorkDir(dir);

            setCurrentVerificationStep(1); // Move to step 1 (Docker)
        } catch (err) {
            const error = err as Error;
            logError('Error during verification preparation', error);
            setErrorState(prev => ({ ...prev, general: `Error during preparation: ${error.message}` }));
        }
    };

    // Docker check (Step 1)
    const runDockerCheck = async (): Promise<void> => {
        if (currentVerificationStep !== 1) return;

        try {
            setProgress(10);
            setStatus(prev => ({ ...prev, docker: 'checking' }));

            const dockerOk = await checkDocker();

            await new Promise(resolve => setTimeout(resolve, 750));

            if (dockerOk) {
                setCurrentVerificationStep(2); // Move to step 2 (Network)
            }
        } catch (err) {
            const error = err as Error;
            logError('Error during Docker check step', error);
            setErrorState(prev => ({ ...prev, docker: `Error during Docker check: ${error.message}` }));
            setStatus(prev => ({ ...prev, docker: 'error' }));
        }
    };

    // Network check (Step 2)
    const runNetworkCheck = async (): Promise<void> => {
        if (currentVerificationStep !== 2) return;

        try {
            setProgress(40);
            setStatus(prev => ({ ...prev, network: 'checking' }));

            const networkOk = await checkNetwork();

            await new Promise(resolve => setTimeout(resolve, 750));

            if (networkOk) {
                setCurrentVerificationStep(3); // Move to step 3 (Postgres)
            }
        } catch (err) {
            const error = err as Error;
            logError('Error during Network check step', error);
            setErrorState(prev => ({ ...prev, network: `Error during Network check: ${error.message}` }));
            setStatus(prev => ({ ...prev, network: 'error' }));
        }
    };

    // PostgreSQL check (Step 3)
    const runPostgresCheck = async (): Promise<void> => {
        if (currentVerificationStep !== 3) return;

        try {
            setProgress(70);
            setStatus(prev => ({ ...prev, postgres: 'checking' }));

            await checkPostgres();

            await new Promise(resolve => setTimeout(resolve, 750));

            setCurrentVerificationStep(4); // Move to final step (Completion)
        } catch (err) {
            const error = err as Error;
            logError('Error during PostgreSQL check step', error);
            setErrorState(prev => ({ ...prev, postgres: `Error during PostgreSQL check: ${error.message}` }));
            setStatus(prev => ({ ...prev, postgres: 'error' }));
        }
    };

    // Final evaluation (Step 4)
    const completeVerification = async (): Promise<void> => {
        if (currentVerificationStep !== 4) return;

        try {
            logInfo('Completing verification process');
            setProgress(100);
            await new Promise(resolve => setTimeout(resolve, 500));
            setCurrentVerificationStep(5);
        } catch (err) {
            const error = err as Error;
            logError('Error during verification completion', error);
            setErrorState(prev => ({ ...prev, general: `Error during completion: ${error.message}` }));
        }
    };

    // Final notification and completion (Step 5)
    const finalizeAndContinue = async (): Promise<void> => {
        if (currentVerificationStep !== 5) return;

        try {
            const hasErrors =
                status.docker === 'error' ||
                status.network === 'error' ||
                status.postgres === 'error';

            // In debug mode, show the continue button if no errors
            if (isDebugMode && !hasErrors) {
                logInfo('Debug mode active, showing continue button');
                setReadyToComplete(true);
            }
            // In auto mode, continue automatically if no errors
            else if (!isDebugMode && !hasErrors) {
                logInfo('Auto-continuing with verification complete');
                const minimumDisplayTime = 2000;
                await new Promise(resolve => setTimeout(resolve, minimumDisplayTime));
                signalComplete();
            }
            // Otherwise stay on the splash screen so user can fix errors
            else {
                logInfo('Verification has errors, waiting for user action');
            }
        } catch (err) {
            const error = err as Error;
            logError('Error during finalization', error);
            setErrorState(prev => ({ ...prev, general: `Error during finalization: ${error.message}` }));
        }
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                setIsDebugMode(prev => !prev);
                logInfo(`Debug mode ${isDebugMode ? 'deactivated' : 'activated'}`);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDebugMode]);

    // Initial delay before starting the verification
    useEffect(() => {
        if (currentVerificationStep !== 0) return; // Only run when we're at step 0

        const initialDelay = 1500;
        logInfo(`Starting verification process in ${initialDelay}ms`);

        const timer = setTimeout(() => {
            void prepareVerification();
        }, initialDelay);

        return () => clearTimeout(timer);
    }, [currentVerificationStep]);

    // Step 1: Docker check
    useEffect(() => {
        if (currentVerificationStep !== 1) return;
        void runDockerCheck();
    }, [currentVerificationStep]);

    // Step 2: Network check
    useEffect(() => {
        if (currentVerificationStep !== 2) return;
        void runNetworkCheck();
    }, [currentVerificationStep]);

    // Step 3: PostgreSQL check
    useEffect(() => {
        if (currentVerificationStep !== 3) return;
        void runPostgresCheck();
    }, [currentVerificationStep]);

    // Step 4: Completion
    useEffect(() => {
        if (currentVerificationStep !== 4) return;
        void completeVerification();
    }, [currentVerificationStep]);

    // Step 5: Finalization and continue
    useEffect(() => {
        if (currentVerificationStep !== 5) return;
        void finalizeAndContinue();
    }, [currentVerificationStep, status.docker, status.network, status.postgres, isDebugMode]);

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                padding: '0 30px',
                backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5',
            }}
        >
            {/* Logo Section */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
                <img
                    src={odooLogo}
                    alt="Odoo Logo"
                    style={{
                        width: 80,
                        height: 80,
                    }}
                />

                {/* Docker logo */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: -10,
                        right: -10,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5',
                    }}
                >
                    <img
                        src={dockerLogo}
                        alt="Docker Logo"
                        style={{
                            width: 20,
                            height: 20,
                        }}
                    />
                </div>
            </div>

            {/* Title */}
            <Typography
                variant="h4"
                sx={{
                    color: isDarkMode ? '#4fc3f7' : '#1976d2',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    mb: 0.5,
                    letterSpacing: 1,
                }}
            >
                {t('appName')}
            </Typography>

            {/* Version */}
            <Typography
                variant="body2"
                sx={{
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                    textAlign: 'center',
                    mb: 3,
                }}
            >
                v{useAppVersion()}
            </Typography>

            {/* Progress Bar */}
            <Box sx={{ width: '100%', maxWidth: 450, mb: 4, position: 'relative' }}>
                <Box
                    sx={{
                        width: '100%',
                        height: 8,
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        borderRadius: 1,
                    }}
                >
                    <Box
                        sx={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: isDarkMode ? '#4fc3f7' : '#1976d2',
                            borderRadius: 1,
                            transition: 'width 0.5s ease',
                        }}
                    />
                </Box>
                <Typography
                    variant="caption"
                    sx={{
                        position: 'absolute',
                        right: 0,
                        top: -18,
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                    }}
                >
                    {progress}%
                </Typography>
            </Box>

            {/* Verification Status Items */}
            <Box sx={{ width: '100%', maxWidth: 450, mb: 3 }}>
                {/* Docker status */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        backgroundColor:
                            status.docker === 'success'
                                ? isDarkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)'
                                : status.docker === 'error'
                                    ? isDarkMode ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)'
                                    : 'transparent',
                    }}
                >
                    {status.docker === 'checking' ? (
                        <CircularProgress size={20} sx={{ mr: 2 }} />
                    ) : status.docker === 'success' ? (
                        <Box
                            component="span"
                            sx={{
                                color: '#4caf50',
                                mr: 2,
                                fontSize: '20px',
                                fontWeight: 'bold',
                            }}
                        >
                            ✓
                        </Box>
                    ) : status.docker === 'error' ? (
                        <Box
                            component="span"
                            sx={{
                                color: '#f44336',
                                mr: 2,
                                fontSize: '20px',
                                fontWeight: 'bold',
                            }}
                        >
                            ✗
                        </Box>
                    ) : (
                        <Box component="span" sx={{ width: 20, mr: 2 }} />
                    )}
                    <Typography
                        variant="body1"
                        sx={{
                            flex: 1,
                            color:
                                status.docker === 'success'
                                    ? '#4caf50'
                                    : status.docker === 'error'
                                        ? '#f44336'
                                        : isDarkMode
                                            ? 'rgba(255, 255, 255, 0.9)'
                                            : 'rgba(0, 0, 0, 0.9)',
                        }}
                    >
                        {t('checkingDocker')}
                    </Typography>

                    {status.docker === 'error' && (
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={async () => {
                                try {
                                    const dockerRunning = await dockerImagesService.checkDocker();
                                    if (dockerRunning) {
                                        await restartAllChecks();
                                    } else if (process.platform === 'darwin') {
                                        const { exec } = require('child_process');
                                        const { promisify } = require('util');
                                        const execAsync = promisify(exec);

                                        try {
                                            await execAsync('open -a Docker');
                                            setNotification({
                                                open: true,
                                                message: t('attemptingToStartDocker'),
                                                severity: 'info'
                                            });

                                            setTimeout(() => void restartAllChecks(), 5000);
                                        } catch (err) {
                                            logError('Error starting Docker', err);
                                            await restartAllChecks();
                                        }
                                    } else {
                                        await restartAllChecks();
                                    }
                                } catch (error) {
                                    logError('Error during Docker retry', error);
                                    await restartAllChecks();
                                }
                            }}
                            sx={{ ml: 1 }}
                            startIcon={<RefreshIcon />}
                        >
                            {t('retry')}
                        </Button>
                    )}
                </Box>

                {/* Docker error message */}
                {status.docker === 'error' && errorState.docker && (
                    <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>
                        {errorState.docker}
                    </Alert>
                )}

                {/* Network status */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        backgroundColor:
                            status.network === 'success'
                                ? isDarkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)'
                                : status.network === 'error'
                                    ? isDarkMode ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)'
                                    : 'transparent',
                        opacity:
                            status.network === 'idle' && status.docker !== 'success'
                                ? 0.5
                                : 1,
                    }}
                >
                    {status.network === 'checking' ? (
                        <CircularProgress size={20} sx={{ mr: 2 }} />
                    ) : status.network === 'success' ? (
                        <Box
                            component="span"
                            sx={{
                                color: '#4caf50',
                                mr: 2,
                                fontSize: '20px',
                                fontWeight: 'bold',
                            }}
                        >
                            ✓
                        </Box>
                    ) : status.network === 'error' ? (
                        <Box
                            component="span"
                            sx={{
                                color: '#f44336',
                                mr: 2,
                                fontSize: '20px',
                                fontWeight: 'bold',
                            }}
                        >
                            ✗
                        </Box>
                    ) : (
                        <Box component="span" sx={{ width: 20, mr: 2 }} />
                    )}
                    <Typography
                        variant="body1"
                        sx={{
                            flex: 1,
                            color:
                                status.network === 'success'
                                    ? '#4caf50'
                                    : status.network === 'error'
                                        ? '#f44336'
                                        : status.network === 'checking'
                                            ? isDarkMode
                                                ? 'rgba(255, 255, 255, 0.9)'
                                                : 'rgba(0, 0, 0, 0.9)'
                                            : isDarkMode
                                                ? 'rgba(255, 255, 255, 0.7)'
                                                : 'rgba(0, 0, 0, 0.7)',
                        }}
                    >
                        {status.network === 'success'
                            ? t('networkReady', { name: networkName })
                            : t('checkingNetwork', { name: networkName })}
                    </Typography>

                    {status.network === 'error' && (
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={() => {
                                logInfo('Restarting network verification');
                                setStatus(prev => ({
                                    ...prev,
                                    network: 'idle',
                                    postgres: 'idle'
                                }));
                                setErrorState(prev => ({
                                    ...prev,
                                    network: undefined,
                                    postgres: undefined
                                }));
                                setCurrentVerificationStep(2); // Restart from network step
                            }}
                            sx={{ ml: 1 }}
                            startIcon={<RefreshIcon />}
                        >
                            {t('retry')}
                        </Button>
                    )}
                </Box>

                {/* Network error message */}
                {status.network === 'error' && errorState.network && (
                    <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>
                        {errorState.network}
                    </Alert>
                )}

                {/* PostgreSQL status */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor:
                            status.postgres === 'success'
                                ? isDarkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)'
                                : status.postgres === 'error'
                                    ? isDarkMode ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)'
                                    : 'transparent',
                        opacity:
                            status.postgres === 'idle' && status.network !== 'success'
                                ? 0.5
                                : 1,
                    }}
                >
                    {status.postgres === 'checking' ? (
                        <CircularProgress size={20} sx={{ mr: 2 }} />
                    ) : status.postgres === 'success' ? (
                        <Box
                            component="span"
                            sx={{
                                color: '#4caf50',
                                mr: 2,
                                fontSize: '20px',
                                fontWeight: 'bold',
                            }}
                        >
                            ✓
                        </Box>
                    ) : status.postgres === 'error' ? (
                        <Box
                            component="span"
                            sx={{
                                color: '#f44336',
                                mr: 2,
                                fontSize: '20px',
                                fontWeight: 'bold',
                            }}
                        >
                            ✗
                        </Box>
                    ) : (
                        <Box component="span" sx={{ width: 20, mr: 2 }} />
                    )}
                    <Typography
                        variant="body1"
                        sx={{
                            flex: 1,
                            color:
                                status.postgres === 'success'
                                    ? '#4caf50'
                                    : status.postgres === 'error'
                                        ? '#f44336'
                                        : status.postgres === 'checking'
                                            ? isDarkMode
                                                ? 'rgba(255, 255, 255, 0.9)'
                                                : 'rgba(0, 0, 0, 0.9)'
                                            : isDarkMode
                                                ? 'rgba(255, 255, 255, 0.7)'
                                                : 'rgba(0, 0, 0, 0.7)',
                        }}
                    >
                        {status.postgres === 'success' && !composeFilesExist
                            ? t('noPostgresInstances')
                            : status.postgres === 'success'
                                ? t('postgresServiceReady')
                                : t('checkingPostgres')}
                    </Typography>

                    {status.postgres === 'error' && (
                        <Box sx={{ display: 'flex' }}>
                            {/* Add Start Containers button when PostgreSQL containers are found */}
                            {errorState.postgres && errorState.postgres.includes(t('foundPostgresContainers', { count: 1 }).split(' ').pop() || '') && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    color="primary"
                                    onClick={async () => {
                                        try {
                                            logInfo('Starting PostgreSQL containers');
                                            setNotification({
                                                open: true,
                                                message: t('startingPostgres'),
                                                severity: 'info'
                                            });

                                            // Get the stored container information
                                            const containersData = JSON.parse(sessionStorage.getItem('postgresContainersToStart') || '{}');

                                            if (containersData.instances && containersData.instances.length > 0) {
                                                const { exec } = require('child_process');
                                                const { promisify } = require('util');
                                                const execAsync = promisify(exec);

                                                // Determine which Docker Compose command to use
                                                let composeCommand = 'docker compose';
                                                try {
                                                    await execAsync('docker compose version');
                                                } catch (error) {
                                                    logWarn('docker compose command not found, falling back to docker-compose', error);
                                                    composeCommand = 'docker-compose';
                                                }

                                                for (const instance of containersData.instances) {
                                                    try {
                                                        const composePath = instance.path;
                                                        const composeFile = path.join(composePath, 'docker-compose.yml');

                                                        if (fs.existsSync(composeFile)) {
                                                            const composeContent = fs.readFileSync(composeFile, 'utf-8');

                                                            // Start the appropriate service based on compose file content
                                                            if (composeContent.includes('  db:')) {
                                                                logInfo(`Starting db service for ${instance.name}`);
                                                                await execAsync(`cd "${composePath}" && ${composeCommand} up -d db`);
                                                            } else if (composeContent.includes('  postgres:')) {
                                                                logInfo(`Starting postgres service for ${instance.name}`);
                                                                await execAsync(`cd "${composePath}" && ${composeCommand} up -d postgres`);
                                                            } else {
                                                                logInfo(`Starting all services for ${instance.name}`);
                                                                await execAsync(`cd "${composePath}" && ${composeCommand} up -d`);
                                                            }

                                                            logInfo(`Started container for ${instance.name}`);
                                                        }
                                                    } catch (err) {
                                                        logError(`Error starting container ${instance.name}`, err);
                                                        // Continue to next instance, this is not a fatal error
                                                    }
                                                }

                                                // Give containers a moment to start
                                                await new Promise(resolve => setTimeout(resolve, 2000));
                                            }

                                            setNotification({
                                                open: true,
                                                message: t('postgresStarted'),
                                                severity: 'success'
                                            });

                                            // Reset the PostgreSQL check and continue
                                            setStatus(prev => ({
                                                ...prev,
                                                postgres: 'idle'
                                            }));
                                            setErrorState(prev => ({
                                                ...prev,
                                                postgres: undefined
                                            }));
                                            setCurrentVerificationStep(3); // Restart from postgres step
                                        } catch (err) {
                                            const error = err as Error;
                                            logError('Failed to start PostgreSQL containers', error);
                                            setNotification({
                                                open: true,
                                                message: t('failedToStart', { message: error.message }),
                                                severity: 'error'
                                            });
                                        }
                                    }}
                                    sx={{ ml: 1 }}
                                >
                                    {t('startContainers')}
                                </Button>
                            )}

                            <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                onClick={() => {
                                    logInfo('Skipping PostgreSQL verification');
                                    setStatus(prev => ({
                                        ...prev,
                                        postgres: 'idle'
                                    }));
                                    setErrorState(prev => ({
                                        ...prev,
                                        postgres: undefined
                                    }));
                                    setCurrentVerificationStep(3); // Restart from postgres step
                                }}
                                sx={{ ml: 1 }}
                                startIcon={<RefreshIcon />}
                            >
                                {errorState.postgres && errorState.postgres.includes(t('foundPostgresContainers', { count: 1 }).split(' ').pop() || '')
                                    ? t('skip')
                                    : t('retry')
                                }
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* PostgreSQL error message */}
                {status.postgres === 'error' && errorState.postgres && (
                    <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>
                        {errorState.postgres}
                    </Alert>
                )}
            </Box>

            {/* General error message */}
            {errorState.general && (
                <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 450 }}>
                    {errorState.general}
                </Alert>
            )}

            {/* Debug mode or error state - manual continue button */}
            {((isDebugMode && readyToComplete) ||
                (status.docker === 'error' || status.network === 'error' || status.postgres === 'error') ||
                (!isIpcAvailable)) && (
                <Box sx={{ mt: 2, width: '100%', maxWidth: 450 }}>

                    {status.docker === 'error' && (
                        <Button
                            variant="outlined"
                            fullWidth
                            color="primary"
                            onClick={() => {
                                logInfo('Opening Docker installation documentation');
                                try {
                                    const { shell } = window.require('electron');
                                    shell.openExternal('https://docs.docker.com/get-docker/');
                                } catch (err) {
                                    logError('Error opening Docker documentation URL', err);
                                    window.open('https://docs.docker.com/get-docker/', '_blank');
                                }
                            }}
                            sx={{ mb: 2 }}
                        >
                            {t('getDocker')}
                        </Button>
                    )}

                    {/* Display IPC communication error */}
                    {!isIpcAvailable && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {t('ipcError')}
                        </Alert>
                    )}

                    {/* Manual bypass button when IPC is not available */}
                    {!isIpcAvailable && (
                        <Button
                            variant="contained"
                            fullWidth
                            color="error"
                            onClick={() => {
                                logWarn('Bypassing verification due to IPC unavailability');
                                window.location.hash = '#/main';
                            }}
                            sx={{ mb: 2 }}
                        >
                            {t('bypassVerification')}
                        </Button>
                    )}

                    {/* Allow continuing with errors in debug mode */}
                    {isDebugMode && (
                        <>
                            <Button
                                variant="contained"
                                fullWidth
                                color="warning"
                                onClick={() => {
                                    logWarn('Continuing despite verification issues (debug mode)');
                                    setNotification({
                                        open: true,
                                        message: t('bypassWarning'),
                                        severity: 'warning'
                                    });

                                    setTimeout(() => signalComplete(), 1500);
                                }}
                                sx={{ mb: 2 }}
                            >
                                {t('continueAnyway')}
                            </Button>

                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    textAlign: 'center',
                                    color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                                }}
                            >
                                {t('warningIncompleteVerification')}
                            </Typography>

                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    textAlign: 'center',
                                    mt: 1,
                                    color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                                }}
                            >
                                {t('debugModeActive')}
                            </Typography>
                        </>
                    )}
                </Box>
            )}

            {/* Status message - changes based on verification state */}
            {!readyToComplete &&
                !errorState.docker &&
                !errorState.network &&
                !errorState.postgres &&
                !errorState.general && (
                    <Typography
                        variant="caption"
                        sx={{
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                            fontStyle: 'italic',
                        }}
                    >
                        {!verificationStarted
                            ? t('preparingToCheck')
                            : progress < 100
                                ? t('initializingApp')
                                : t('allChecksComplete')}
                    </Typography>
                )}

            {/* Success notification */}
            <Snackbar
                open={notification.open}
                autoHideDuration={4000}
                onClose={() => setNotification({...notification, open: false})}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setNotification({...notification, open: false})}
                    severity={notification.severity}
                    variant="filled"
                >
                    {notification.message}
                </Alert>
            </Snackbar>

            {/* WebGraphix branding at the bottom */}
            <Typography
                variant="caption"
                sx={{
                    position: 'absolute',
                    bottom: 12,
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                    fontSize: '0.7rem',
                    fontWeight: 'normal',
                    letterSpacing: 1,
                }}
            >
                {t('byWebGraphix')}
            </Typography>
        </div>
    );
};

export default SplashScreen;