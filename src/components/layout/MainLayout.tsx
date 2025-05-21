// src/components/layout/MainLayout.tsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import TranslatedText from '../shared/TranslatedText';
import { useAppVersion } from '../../hooks/useAppVersion';
import { Settings as SettingsIcon } from '@mui/icons-material';
import {
    Box,
    IconButton,
    Typography,
    Tooltip,
    useTheme,
    Snackbar,
    Alert,
    Paper,
    Container,
    Divider,
    CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Help as HelpIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    ExitToApp as ExitIcon,
    Terminal as AppLogsIcon,
    Storage as DatabaseIcon,
    Code as OdooIcon
} from '@mui/icons-material';
import { ColorModeContext } from '../../theme/ThemeProvider';
import ContainerList from '../containers/ContainerList';
import Footer from './Footer';
import logoImg from '../../assets/imgs/odoo.png';
import { ipcRenderer } from 'electron';
import { isElectron, getElectronAPI } from '../../utils/electron.ts';
import ipcRendererService from '../../services/electron/ipcRendererService';
import WelcomeScreen from '../screens/WelcomeScreen';
import settingsService from '../../services/settings/settingsService';
import { Container as ContainerType } from '../../types/container';
import ConfirmationDialog from "../shared/ConfirmationDialog.tsx";
import { logError, logInfo } from '../../services/utils/logger';

// Enhanced animation variants for main layout components
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.7,
            when: "beforeChildren",
            staggerChildren: 0.15,
            ease: "easeOut"
        }
    }
};

const sidebarVariants = {
    hidden: {
        opacity: 0,
        x: -40,
    },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            type: "spring",
            damping: 20,
            stiffness: 100,
            duration: 0.6,
            delay: 0.2,
            staggerChildren: 0.12
        }
    }
};

// Sidebar menu item animations
const sidebarItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            type: "spring",
            damping: 15,
            stiffness: 150
        }
    }
};

// Top-right controls animation
const controlsVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.5
        }
    }
};

const controlButtonVariant = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 15
        }
    }
};

const mainContentVariants = {
    hidden: {
        opacity: 0,
        y: 20,
        scale: 0.98
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring",
            damping: 25,
            stiffness: 120,
            duration: 0.7,
            delay: 0.4
        }
    }
};

// Section container animation
const sectionContainerVariants = {
    hidden: {
        opacity: 0,
    },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.3,
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.2
        }
    }
};

// Section header animation
const sectionHeaderVariants = {
    hidden: {
        opacity: 0,
        y: -20
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 25,
            stiffness: 120,
        }
    }
};

// Section header button animations
const headerButtonsVariants = {
    hidden: {
        opacity: 0,
        scale: 0.9,
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            delay: 0.1,
            staggerChildren: 0.1,
            type: "spring",
            damping: 25,
            stiffness: 200,
        }
    }
};

const itemVariants = {
    hidden: {
        opacity: 0,
        y: 15
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 20,
            stiffness: 100
        }
    }
};

const logoVariants = {
    hidden: { opacity: 0, y: -20, rotate: -5 },
    visible: {
        opacity: 1,
        y: 0,
        rotate: 0,
        transition: {
            type: "spring",
            damping: 15,
            stiffness: 90,
            delay: 0.2
        }
    },
    hover: {
        scale: 1.05,
        rotate: 5,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 10
        }
    }
};

const buttonVariants = {
    hidden: {
        opacity: 0,
        y: 10,
        scale: 0.95
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring",
            damping: 15,
            stiffness: 200,
            delay: 0.1
        }
    },
    hover: {
        scale: 1.05,
        transition: {
            type: "spring",
            damping: 10,
            stiffness: 200
        }
    },
    tap: {
        scale: 0.98,
        transition: {
            type: "spring",
            damping: 10,
            stiffness: 200
        }
    }
};

const MainLayout: React.FC = () => {
    const theme = useTheme();
    const colorMode = useContext(ColorModeContext);
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<'odoo' | 'postgres'>('odoo');
    const [odooContainers, setOdooContainers] = useState<ContainerType[]>([]);
    const [postgresContainers, setPostgresContainers] = useState<ContainerType[]>([]);
    const [showWelcome, setShowWelcome] = useState(false);
    const [loading, setLoading] = useState<boolean>(true);

    // Counter to force re-animation of container lists when switching sections
    const [animationKey, setAnimationKey] = useState(0);
    // Add a state to control rendering of content
    const [shouldRenderContent, setShouldRenderContent] = useState(false);
    // Always fetch version regardless of rendering state to avoid React hooks error
    const appVersion = useAppVersion();

    // Notification state
    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'info' | 'warning' | 'error';
    }>({
        open: false,
        message: '',
        severity: 'info'
    });

    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        containerName: string;
    }>({
        open: false,
        containerName: ''
    });

    const [exitDialog, setExitDialog] = useState<{
        open: boolean;
        runningCount: number;
    }>({
        open: false,
        runningCount: 0
    });

    useEffect(() => {
        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');

            // Handler for checking running containers
            const checkContainersHandler = () => {
                try {
                    logInfo('[MainLayout] Received check-running-containers event');

                    // If we're already in the process of exiting, allow termination
                    if (exitingRef.current) {
                        logInfo('[MainLayout] Exit already in progress, allowing termination');
                        ipcRenderer.send('exit-confirmation-response', {
                            canTerminate: true,
                            alreadyExiting: true
                        });
                        return;
                    }

                    // Check if exitDialog is already open to prevent duplicate dialogs
                    if (exitDialog.open) {
                        logInfo('[MainLayout] Exit dialog already open, not showing again');
                        // Respond to the main process but don't allow termination yet
                        ipcRenderer.send('exit-confirmation-response', {
                            canTerminate: false,
                            dialogAlreadyOpen: true
                        });
                        return;
                    }

                    // Check running containers directly from current state
                    const runningOdoos = odooContainers.filter(c => c.status.toLowerCase().includes('up')).length;
                    const runningPostgres = postgresContainers.filter(c => c.status.toLowerCase().includes('up')).length;
                    const totalRunning = runningOdoos + runningPostgres;

                    if (totalRunning > 0) {
                        logInfo(`[MainLayout] Found ${totalRunning} running containers, showing exit dialog`);
                        setExitDialog({
                            open: true,
                            runningCount: totalRunning
                        });
                    } else {
                        logInfo('[MainLayout] No running containers, allowing termination');
                        ipcRenderer.send('exit-confirmation-response', { canTerminate: true });
                    }
                } catch (error) {
                    logError('Error in check-running-containers handler:', error);
                    // Allow termination on error
                    ipcRenderer.send('exit-confirmation-response', { canTerminate: true });
                }
            };

            // Register the handler
            ipcRenderer.on('check-running-containers', checkContainersHandler);

            // Cleanup
            return () => {
                ipcRenderer.removeListener('check-running-containers', checkContainersHandler);
            };
        }
    }, [odooContainers, postgresContainers, exitDialog.open]);

    useEffect(() => {
        if (shouldRenderContent) {
            // Check if settings service is available to get showWelcomeScreen preference
            const checkWelcomeScreenPreference = async () => {
                try {
                    if (isElectron()) {
                        const settings = await settingsService.loadSettings();
                        if (settings?.showWelcomeScreen) {
                            // Show welcome screen after a delay
                            const timer = setTimeout(() => {
                                setShowWelcome(true);
                            }, 1000);
                            return () => clearTimeout(timer);
                        }
                    } else {
                        // Fallback to localStorage for browser
                        const dontShowWelcome = localStorage.getItem('dontShowWelcome') === 'true';
                        if (!dontShowWelcome) {
                            const timer = setTimeout(() => {
                                setShowWelcome(true);
                            }, 1000);
                            return () => clearTimeout(timer);
                        }
                    }
                } catch (error) {
                    logError('Error checking welcome screen preference:', error);
                }
            };

            checkWelcomeScreenPreference().catch(error => {
                logError('Failed to check welcome screen preference:', error);
            });
        }
    }, [shouldRenderContent]);

    // Function to fetch containers using the dockerComposeService
    const fetchContainers = async () => {
        if (!isElectron()) {
            // In browser mode, use dummy data after a brief delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            setOdooContainers([
                { name: 'odoo1_16_Community', status: 'Up 2 hours', port: '8069' },
                { name: 'odoo2_17_Enterprise_test', status: 'Exited (0) 1 hour ago', port: '8070' }
            ]);
            setPostgresContainers([
                { name: 'postgres_13_dev', status: 'Up 3 hours', port: '5432' },
                { name: 'postgres_15_test', status: 'Exited (0) 30 minutes ago', port: '5433' }
            ]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Use IPC to execute Docker operation through the main process
            const electron = getElectronAPI();
            if (electron && electron.ipcRenderer) {
                const containers = await electron.ipcRenderer.invoke('docker-operation', {
                    operation: 'list-instances',
                    params: {}
                });

                // Process containers to separate Odoo and PostgreSQL containers
                const processedContainers = processContainers(containers);
                setOdooContainers(processedContainers.odooContainers);
                setPostgresContainers(processedContainers.postgresContainers);
            }
        } catch (error) {
            logError('Error fetching containers:', error);
            setNotification({
                open: true,
                message: t('errorFetchingContainers', { message: error instanceof Error ? error.message : String(error) }),
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAppLogs = async () => {
        if (!isElectron()) {
            // In browser mode, show a message
            setNotification({
                open: true,
                message: t('appLogsDesktopOnly'),
                severity: 'info'
            });
            return;
        }

        try {
            // Import required modules
            const { ipcRenderer } = window.require('electron');

            // Get the current log file path from the logger
            const logFilePath = await ipcRenderer.invoke('get-log-file-path');

            if (!logFilePath) {
                setNotification({
                    open: true,
                    message: t('noLogFileFound'),
                    severity: 'error'
                });
                return;
            }

            // Open the log file using the Electron shell
            const success = await ipcRenderer.invoke('open-log-file', { logFilePath });

            if (success) {
                setNotification({
                    open: true,
                    message: t('openingAppLogs'),
                    severity: 'info'
                });
            } else {
                setNotification({
                    open: true,
                    message: t('failedToOpenLogFile'),
                    severity: 'error'
                });
            }
        } catch (error) {
            logError('Error opening app logs:', error);
            setNotification({
                open: true,
                message: t('errorOpeningAppLogs', { message: error instanceof Error ? error.message : 'Unknown error' }),
                severity: 'error'
            });
        }
    };

    // Helper function to process the container data
    const processContainers = (containers: any[]) => {
        const odooContainers: ContainerType[] = [];
        const postgresContainers: ContainerType[] = [];

        containers.forEach(container => {
            // Determine if it's an Odoo or PostgreSQL container based on name or info
            const port = container.info?.port?.toString() || '';

            if (container.name.includes('odoo') || (container.info && container.info.edition)) {
                odooContainers.push({
                    name: container.name,
                    status: container.status,
                    port: port
                });
            } else if (container.name.includes('postgres') || (container.info && container.info.type === 'postgres')) {
                postgresContainers.push({
                    name: container.name,
                    status: container.status,
                    port: port
                });
            }
        });

        return { odooContainers, postgresContainers };
    };

    // Smart container update logic
    const updateContainerStatuses = async () => {
        if (!isElectron()) {
            // In browser mode, simulate status updates without full reload
            setOdooContainers(prev => prev.map(container => ({
                ...container,
                status: container.status.includes('Up')
                    ? `Up ${parseInt(container.status.split(' ')[1] || '0') + 30} seconds`
                    : container.status
            })));

            setPostgresContainers(prev => prev.map(container => ({
                ...container,
                status: container.status.includes('Up')
                    ? `Up ${parseInt(container.status.split(' ')[1] || '0') + 30} seconds`
                    : container.status
            })));
            return;
        }

        try {
            // Use IPC to get just container statuses
            const electron = getElectronAPI();
            if (electron && electron.ipcRenderer) {
                const containers = await electron.ipcRenderer.invoke('docker-operation', {
                    operation: 'list-instances',
                    params: {}
                });

                // Process containers for status updates
                const processed = processContainers(containers);

                // Compare with current containers to detect deletions
                const currentOdooIds = new Set(odooContainers.map(c => c.name));
                const currentPostgresIds = new Set(postgresContainers.map(c => c.name));

                const newOdooIds = new Set(processed.odooContainers.map(c => c.name));
                const newPostgresIds = new Set(processed.postgresContainers.map(c => c.name));

                const needsFullRefresh =
                    // Check for deletions (container exists in current but not in new)
                    Array.from(currentOdooIds).some(id => !newOdooIds.has(id)) ||
                    Array.from(currentPostgresIds).some(id => !newPostgresIds.has(id)) ||
                    // Check for additions (container exists in new but not in current)
                    Array.from(newOdooIds).some(id => !currentOdooIds.has(id)) ||
                    Array.from(newPostgresIds).some(id => !currentPostgresIds.has(id));

                if (needsFullRefresh) {
                    // Do a full refresh if containers were added or removed
                    logInfo('Container list changed, performing full refresh');
                    setOdooContainers(processed.odooContainers);
                    setPostgresContainers(processed.postgresContainers);
                } else {
                    // Just update the status of existing containers
                    setOdooContainers(prevContainers => {
                        return prevContainers.map(container => {
                            const updatedContainer = processed.odooContainers.find(c => c.name === container.name);
                            return updatedContainer ? { ...container, status: updatedContainer.status } : container;
                        });
                    });

                    setPostgresContainers(prevContainers => {
                        return prevContainers.map(container => {
                            const updatedContainer = processed.postgresContainers.find(c => c.name === container.name);
                            return updatedContainer ? { ...container, status: updatedContainer.status } : container;
                        });
                    });
                }
            }
        } catch (error) {
            logError('Error updating container statuses:', error);
        }
    };

    // Fetch containers on component mount and when needed
    useEffect(() => {
        if (shouldRenderContent) {
            // Initial full fetch
            fetchContainers().catch(error => {
                logError('Error in initial container fetch:', error);
            });

            // Set up interval to just update statuses periodically
            const refreshInterval = setInterval(() => {
                updateContainerStatuses().catch(error => {
                    logError('Error in container status update:', error);
                });
            }, 30000); // Update every 30 seconds

            return () => clearInterval(refreshInterval);
        }
    }, [shouldRenderContent]);

    // Listen for the main-window-visible event
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        let fallbackTimer: NodeJS.Timeout | null = null;

        if (isElectron()) {
            logInfo('[MAIN] MainLayout component mounted');

            // Check if we're coming from setup
            const setupCompleted = localStorage.getItem('setupCompleted') === 'true';
            const setupTime = localStorage.getItem('setupCompletedTime');

            if (setupCompleted && setupTime) {
                const setupTimeObj = new Date(setupTime);
                const now = new Date();
                const timeSinceSetup = now.getTime() - setupTimeObj.getTime();

                logInfo(`[MAIN] Setup was completed ${Math.round(timeSinceSetup/1000)}s ago`);

                // If setup was completed very recently, render immediately
                if (timeSinceSetup < 30000) { // 30 seconds
                    logInfo('[MAIN] Recent setup detected, rendering immediately');
                    setShouldRenderContent(true);
                    return;
                }
            }

            // Listen for the main-window-visible event from the main process
            unsubscribe = ipcRendererService.onMainWindowVisible(() => {
                logInfo('[MAIN] Received main-window-visible event');
                // Add a short delay to ensure the window is fully ready
                setTimeout(() => {
                    logInfo('[MAIN] Setting shouldRenderContent to true');
                    setShouldRenderContent(true);
                }, 300);
            });

            // Use a more aggressive fallback, especially if coming from setup
            fallbackTimer = setTimeout(() => {
                logInfo('[MAIN] Fallback timer triggered - setting shouldRenderContent to true');
                setShouldRenderContent(true);
            }, 2000); // 2 second fallback (reduced from 3s)

            // Force render after a max of 5 seconds regardless of anything else
            const forceRenderTimer = setTimeout(() => {
                if (!shouldRenderContent) {
                    logInfo('[MAIN] FORCE RENDER: Maximum wait time reached, forcing content to render');
                    setShouldRenderContent(true);
                }
            }, 5000);

            return () => {
                if (unsubscribe) unsubscribe();
                if (fallbackTimer) clearTimeout(fallbackTimer);
                clearTimeout(forceRenderTimer);
            };
        } else {
            // No Electron environment - render immediately
            logInfo('[MAIN] Non-Electron environment, rendering immediately');
            setShouldRenderContent(true);
        }

        return () => {
            // @ts-ignore
            if (unsubscribe) unsubscribe();
            if (fallbackTimer) clearTimeout(fallbackTimer);
        };
    }, [shouldRenderContent]);

    // Load actual containers when implementation is ready
    useEffect(() => {
        if (!shouldRenderContent) return; // Skip if content shouldn't render yet

        // Delay welcome notification to allow animations to complete
        const timer = setTimeout(() => {
            setNotification({
                open: true,
                message: t('welcomeToast'),
                severity: 'info'
            });
        }, 1000);

        return () => clearTimeout(timer);
    }, [shouldRenderContent, t]);

    // Force re-animation when section changes
    useEffect(() => {
        setAnimationKey(prevKey => prevKey + 1);
    }, [activeSection]);

    useEffect(() => {
        // Listen for instance-created events from detached windows
        if (isElectron()) {
            const handleInstanceCreated = (_event: any, data: any) => {
                logInfo('Instance created:', data);

                setNotification({
                    open: true,
                    message: t('instanceCreatedNotification', {
                        type: data.instanceType === 'postgres' ? 'PostgreSQL' : 'Odoo',
                        version: data.version,
                        edition: data.edition || ''
                    }),
                    severity: 'success'
                });

                // For new instance creation, always do a full refresh
                // This is important to get accurate information about the new container
                fetchContainers().catch(error => {
                    logError('Error fetching containers after instance creation:', error);
                });
            };

            ipcRenderer.on('instance-created', handleInstanceCreated);

            return () => {
                ipcRenderer.removeListener('instance-created', handleInstanceCreated);
            };
        }
    }, [t]);

    const handleCloseWelcome = () => {
        setShowWelcome(false);
    };

    const handleDontShowWelcomeAgain = async (dontShow: boolean) => {
        if (isElectron()) {
            try {
                // Update settings in the settings service
                await settingsService.updateSettings({ showWelcomeScreen: !dontShow });
            } catch (error) {
                logError('Error updating welcome screen preference:', error);
                // Fallback to localStorage if settings service fails
                localStorage.setItem('dontShowWelcome', dontShow.toString());
            }
        } else {
            // Use localStorage in browser environment
            localStorage.setItem('dontShowWelcome', dontShow.toString());
        }
    };

    const handleRefreshOdoo = () => {
        setNotification({
            open: true,
            message: t('refreshingOdooList'),
            severity: 'info'
        });

        // Always do a full refresh when manually requested
        fetchContainers()
            .then(() => {
                setNotification({
                    open: true,
                    message: t('odooListRefreshed'),
                    severity: 'success'
                });
            })
            .catch((error) => {
                logError('Error refreshing Odoo list:', error);
                setNotification({
                    open: true,
                    message: t('errorRefreshingList'),
                    severity: 'error'
                });
            });
    };

    const handleRefreshPostgres = () => {
        setNotification({
            open: true,
            message: t('refreshingPostgresList'),
            severity: 'info'
        });

        // Always do a full refresh when manually requested
        fetchContainers()
            .then(() => {
                setNotification({
                    open: true,
                    message: t('postgresListRefreshed'),
                    severity: 'success'
                });
            })
            .catch((error) => {
                logError('Error refreshing PostgreSQL list:', error);
                setNotification({
                    open: true,
                    message: t('errorRefreshingList'),
                    severity: 'error'
                });
            });
    };

    const handleNewOdooInstance = () => {
        // Using IPC to create a detached window
        ipcRenderer.send('open-window', {
            type: 'new-instance',
            options: {
                modal: true,
                parent: null, // Ensure it's detached
                data: { instanceType: 'odoo' }
            }
        });
    };

    const handleNewPostgresInstance = () => {
        // Using IPC to create a detached window for postgres
        ipcRenderer.send('open-window', {
            type: 'new-postgres',
            options: {
                modal: true,
                parent: null, // Ensure it's detached
                data: { instanceType: 'postgres' }
            }
        });
    };

    const handleHelp = () => {
        // Using IPC to create a detached window
        ipcRenderer.send('open-window', {
            type: 'help',
            options: {
                modal: true,
                parent: null // Ensure it's detached
            }
        });
    };

    useEffect(() => {
        if (isElectron()) {
            const electron = getElectronAPI();

            // Listen for exit confirmation requests
            const exitConfirmHandler = (_event: any, data: any) => {
                setExitDialog({
                    open: true,
                    runningCount: data.runningCount
                });
            };

            if (electron && electron.ipcRenderer) {
                electron.ipcRenderer.on('show-exit-confirmation', exitConfirmHandler);

                return () => {
                    electron.ipcRenderer.removeListener('show-exit-confirmation', exitConfirmHandler);
                };
            }
        }
        return () => {}; // Empty cleanup function
    }, []);

    // Create a ref to track if we're in the process of exiting
    const exitingRef = useRef(false);

    const handleExitConfirm = () => {
        // If we're already exiting, don't handle again
        if (exitingRef.current) {
            return;
        }

        // Mark that we're exiting and close the dialog
        exitingRef.current = true;
        setExitDialog({ open: false, runningCount: 0 });

        if (isElectron()) {
            try {
                // Send the confirmation response before quitting
                const { ipcRenderer } = window.require('electron');

                // Immediately send quit command to main process
                ipcRenderer.send('quit-app');

                // Also send response to close event handler in main process
                ipcRenderer.send('exit-confirmation-response', {
                    canTerminate: true,
                    alreadyConfirmed: true
                });
            } catch (error) {
                logError("Error during exit sequence:", error);
                // Reset exit flag on error
                exitingRef.current = false;
            }
        } else {
            // For browser testing
            window.close();
        }
    };

    const handleExitCancel = () => {
        setExitDialog({ open: false, runningCount: 0 });

        if (isElectron()) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('exit-confirmation-response', { canTerminate: false });
        }
    };

    const handleExit = async () => {
        // For Electron, check for running containers and show custom dialog
        if (isElectron()) {
            // Check if dialog is already open to prevent duplicate dialogs
            if (exitDialog.open) {
                logInfo('[MainLayout] Exit dialog already open, ignoring handleExit call');
                return;
            }

            // Get running containers count
            const runningOdoos = odooContainers.filter(c => c.status.toLowerCase().includes('up')).length;
            const runningPostgres = postgresContainers.filter(c => c.status.toLowerCase().includes('up')).length;
            const totalRunning = runningOdoos + runningPostgres;

            if (totalRunning > 0) {
                logInfo(`[MainLayout] handleExit found ${totalRunning} running containers, showing exit dialog`);
                // Show our custom dialog instead of system dialog
                setExitDialog({
                    open: true,
                    runningCount: totalRunning
                });
            } else {
                // No running containers, just quit
                logInfo('[MainLayout] handleExit found no running containers, quitting app');
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('quit-app');
            }
        } else {
            // Fallback for browser
            window.close();
        }
    };

    // Functions to handle opening Odoo browser UI and database manager
    const handleOpenOdooBrowser = (name: string, port: string) => {
        if (isElectron()) {
            const { shell } = window.require('electron');
            const url = `http://localhost:${port}`;
            shell.openExternal(url).catch((err: Error) => {
                logError(`Error opening Odoo UI: ${err.message}`);
                setNotification({
                    open: true,
                    message: t('errorOpeningOdooUI', { message: err.message }),
                    severity: 'error'
                });
            });
        } else {
            window.open(`http://localhost:${port}`, '_blank');
        }

        setNotification({
            open: true,
            message: t('openingOdooUI', { name }),
            severity: 'info'
        });
    };

    const handleOpenDbManager = (name: string, port: string) => {
        if (isElectron()) {
            const { shell } = window.require('electron');
            const url = `http://localhost:${port}/web/database/manager`;
            shell.openExternal(url).catch((err: Error) => {
                logError(`Error opening Database Manager: ${err.message}`);
                setNotification({
                    open: true,
                    message: t('errorOpeningDbManager', { message: err.message }),
                    severity: 'error'
                });
            });
        } else {
            window.open(`http://localhost:${port}/web/database/manager`, '_blank');
        }

        setNotification({
            open: true,
            message: t('openingDbManager', { name }),
            severity: 'info'
        });
    };

    const handleContainerStart = async (name: string) => {
        logInfo(`Starting container: ${name}`);
        setNotification({
            open: true,
            message: t('startingContainer', { name }),
            severity: 'info'
        });

        try {
            if (isElectron()) {
                const electron = getElectronAPI();
                const result = await electron.ipcRenderer.invoke('docker-operation', {
                    operation: 'start-instance',
                    params: { instanceName: name }
                });

                if (result.success) {
                    // Just update the status of the specific container
                    if (name.includes('odoo') || (!name.includes('postgres') && activeSection === 'odoo')) {
                        setOdooContainers(prevContainers => {
                            return prevContainers.map(c =>
                                c.name === name ? { ...c, status: 'Up 1 second' } : c
                            );
                        });
                    } else {
                        setPostgresContainers(prevContainers => {
                            return prevContainers.map(c =>
                                c.name === name ? { ...c, status: 'Up 1 second' } : c
                            );
                        });
                    }

                    setNotification({
                        open: true,
                        message: t('containerStarted', { name }),
                        severity: 'success'
                    });
                } else {
                    setNotification({
                        open: true,
                        message: t('errorStartingContainer', { message: result.message }),
                        severity: 'error'
                    });
                }
            } else {
                // For demo purposes in browser environment
                if (name.includes('odoo')) {
                    setOdooContainers(odooContainers.map(c =>
                        c.name === name
                            ? { ...c, status: 'Up 1 second' }
                            : c
                    ));
                } else {
                    setPostgresContainers(postgresContainers.map(c =>
                        c.name === name
                            ? { ...c, status: 'Up 1 second' }
                            : c
                    ));
                }
            }
        } catch (error) {
            logError(`Error starting container ${name}:`, error);
            setNotification({
                open: true,
                message: t('errorStartingContainer', { message: error instanceof Error ? error.message : String(error) }),
                severity: 'error'
            });
        }
    };

    const handleContainerStop = async (name: string) => {
        logInfo(`Stopping container: ${name}`);
        setNotification({
            open: true,
            message: t('stoppingContainer', { name }),
            severity: 'info'
        });

        try {
            if (isElectron()) {
                const electron = getElectronAPI();
                const result = await electron.ipcRenderer.invoke('docker-operation', {
                    operation: 'stop-instance',
                    params: { instanceName: name }
                });

                if (result.success) {
                    // Just update the status of the specific container
                    if (name.includes('odoo') || (!name.includes('postgres') && activeSection === 'odoo')) {
                        setOdooContainers(prevContainers => {
                            return prevContainers.map(c =>
                                c.name === name ? { ...c, status: 'Exited (0) 1 second ago' } : c
                            );
                        });
                    } else {
                        setPostgresContainers(prevContainers => {
                            return prevContainers.map(c =>
                                c.name === name ? { ...c, status: 'Exited (0) 1 second ago' } : c
                            );
                        });
                    }

                    setNotification({
                        open: true,
                        message: t('containerStopped', { name }),
                        severity: 'success'
                    });
                } else {
                    setNotification({
                        open: true,
                        message: t('errorStoppingContainer', { message: result.message }),
                        severity: 'error'
                    });
                }
            } else {
                // For demo purposes in browser environment
                if (name.includes('odoo')) {
                    setOdooContainers(odooContainers.map(c =>
                        c.name === name
                            ? { ...c, status: 'Exited (0) 1 second ago' }
                            : c
                    ));
                } else {
                    setPostgresContainers(postgresContainers.map(c =>
                        c.name === name
                            ? { ...c, status: 'Exited (0) 1 second ago' }
                            : c
                    ));
                }
            }
        } catch (error) {
            logError(`Error stopping container ${name}:`, error);
            setNotification({
                open: true,
                message: t('errorStoppingContainer', { message: error instanceof Error ? error.message : String(error) }),
                severity: 'error'
            });
        }
    };

    const handleContainerDelete = (name: string) => {
        logInfo(`Preparing to delete container: ${name}`);

        // Show custom confirmation dialog instead of window.confirm
        setDeleteDialog({
            open: true,
            containerName: name
        });
    };

    const confirmContainerDelete = async () => {
        const name = deleteDialog.containerName;
        setDeleteDialog({ open: false, containerName: '' });

        try {
            setNotification({
                open: true,
                message: t('deletingContainer', { name }),
                severity: 'info'
            });

            if (isElectron()) {
                const electron = getElectronAPI();
                const result = await electron.ipcRenderer.invoke('docker-operation', {
                    operation: 'delete-instance',
                    params: { instanceName: name }
                });

                if (result.success) {
                    // For deletion, directly update the container lists
                    // This is a structural change, so we want to remove from the UI immediately
                    if (name.includes('odoo') || (!name.includes('postgres') && activeSection === 'odoo')) {
                        setOdooContainers(prevContainers => prevContainers.filter(c => c.name !== name));
                    } else {
                        setPostgresContainers(prevContainers => prevContainers.filter(c => c.name !== name));
                    }

                    setNotification({
                        open: true,
                        message: t('containerDeleted', { name }),
                        severity: 'success'
                    });
                } else {
                    setNotification({
                        open: true,
                        message: t('errorDeletingContainer', { message: result.message }),
                        severity: 'error'
                    });
                }
            } else {
                // Demo mode - remove from UI
                if (name.includes('odoo')) {
                    setOdooContainers(prev => prev.filter(c => c.name !== name));
                } else {
                    setPostgresContainers(prev => prev.filter(c => c.name !== name));
                }

                setNotification({
                    open: true,
                    message: t('containerDeletedDemoMode', { name }),
                    severity: 'success'
                });
            }
        } catch (error) {
            logError(`Error deleting container ${name}:`, error);
            setNotification({
                open: true,
                message: t('errorDeletingContainer', { message: error instanceof Error ? error.message : String(error) }),
                severity: 'error'
            });
        }
    };

    const handleContainerLogs = (name: string) => {
        logInfo(`Viewing logs for container: ${name}`);
        // Open logs in a detached window
        ipcRenderer.send('open-window', {
            type: 'container-logs',
            options: {
                title: `Logs: ${name}`,
                modal: false,
                parent: null,
                data: { containerName: name }
            }
        });
    };

    const handleOpenSettings = () => {
        if (isElectron()) {
            // Open settings in a detached window
            ipcRenderer.send('open-window', {
                type: 'settings',
                options: {
                    title: 'Odoo Manager - Settings',
                    modal: false,
                    parent: null,
                    width: 900,
                    height: 700,
                    minWidth: 800,
                    minHeight: 600,
                    resizable: true
                }
            });
        }
    };

    const handleContainerInfo = (name: string) => {
        logInfo(`Viewing info for container: ${name}`);
        // Open info in a detached window
        const isPostgres = name.includes('postgres');
        const instanceNumber = isPostgres
            ? name.split('_')[1]
            : name.split('_')[0].replace('odoo', '');

        ipcRenderer.send('open-window', {
            type: 'container-info',
            options: {
                title: `Info: ${name}`,
                modal: true,
                parent: null,
                data: {
                    containerName: name,
                    info: isPostgres
                        ? `Name: ${name}\nPort: 5432\nVersion: ${name.split('_')[1]}\nUsername: postgres\nPassword: postgres\n`
                        : `Name: ${name}\nPort: 8069\nVersion: ${name.split('_')[1]}\nEdition: ${name.split('_')[2] || 'Community'}\nAdmin password: admin\nDB Filter: No`,
                    instanceNumber,
                    isPostgres
                }
            }
        });
    };

    const handleCloseNotification = () => {
        setNotification({
            ...notification,
            open: false
        });
    };

    return (
        <AnimatePresence>
            <motion.div
                key="main-layout"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                    backgroundColor: theme.palette.mode === 'dark' ? '#121212' : '#f5f5f5',
                    backgroundImage: theme.palette.mode === 'dark'
                        ? 'linear-gradient(120deg, #111111, #000000)'
                        : 'linear-gradient(120deg, #f8f8f8, #f0f0f0)',
                    paddingTop: 0
                }}
            >
                {shouldRenderContent ? (
                    // Only render actual content when shouldRenderContent is true
                    <Container maxWidth="xl" sx={{ flex: 1, py: 4, overflow: 'auto', mt: 4 }}>
                        {/* Top right controls */}
                        <motion.div
                            variants={controlsVariants}
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 30,
                                zIndex: 10,
                                display: 'flex',
                                gap: 8,
                                marginBottom: 2,
                                padding: 1,
                                borderRadius: 2,
                            }}
                        >
                            <motion.div variants={controlButtonVariant}>
                                <Tooltip title={t("applicationLogs")}>
                                    <IconButton
                                        onClick={handleAppLogs}
                                        sx={{
                                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)',
                                            boxShadow: 1
                                        }}
                                    >
                                        <AppLogsIcon />
                                    </IconButton>
                                </Tooltip>
                            </motion.div>

                            <motion.div variants={controlButtonVariant}>
                                <Tooltip title={t(theme.palette.mode === 'dark' ? 'lightMode' : 'darkMode')}>
                                    <IconButton
                                        onClick={async () => {
                                            // First save the new theme value to settings to ensure persistence
                                            const newMode = theme.palette.mode === 'dark' ? 'light' : 'dark';
                                            if (isElectron()) {
                                                try {
                                                    // Import settings service dynamically
                                                    const { default: settingsService } = await import('../../services/settings/settingsService');
                                                    await settingsService.updateSettings({ theme: newMode });
                                                } catch (err) {
                                                    logError('Error saving theme to settings before toggle:', err);
                                                }
                                            }

                                            // Then toggle the theme mode
                                            colorMode.toggleColorMode();
                                        }}
                                        sx={{
                                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)',
                                            boxShadow: 1
                                        }}
                                    >
                                        {theme.palette.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                                    </IconButton>
                                </Tooltip>
                            </motion.div>

                            <motion.div variants={controlButtonVariant}>
                                <Tooltip title={t("settings")}>
                                    <IconButton
                                        onClick={handleOpenSettings}
                                        sx={{
                                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)',
                                            boxShadow: 1
                                        }}
                                    >
                                        <SettingsIcon />
                                    </IconButton>
                                </Tooltip>
                            </motion.div>
                        </motion.div>

                        <Box sx={{ display: 'flex', gap: 3, height: '100%' }}>
                            {/* Left Sidebar */}
                            <motion.div
                                variants={sidebarVariants}
                                style={{ width: 280 }}
                            >
                                <Paper
                                    elevation={3}
                                    sx={{
                                        p: 3,
                                        height: '100%',
                                        borderRadius: 3,
                                        bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? '0 8px 24px rgba(0, 0, 0, 0.3)'
                                            : '0 8px 24px rgba(100, 100, 140, 0.1)',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        mb: 4
                                    }}>
                                        <motion.div
                                            variants={logoVariants}
                                            whileHover="hover"
                                        >
                                            <img
                                                src={logoImg}
                                                alt="Odoo Logo"
                                                style={{
                                                    width: 80,
                                                    height: 80,
                                                    marginBottom: 16,
                                                    filter: theme.palette.mode === 'dark' ? 'drop-shadow(0 0 8px rgba(150, 150, 150, 0.3))' : 'drop-shadow(0 0 8px rgba(0, 0, 100, 0.1))'
                                                }}
                                            />
                                        </motion.div>
                                        <motion.div variants={itemVariants}>
                                            <TranslatedText
                                                i18nKey="appName"
                                                variant="h5"
                                                fontWeight="bold"
                                                align="center"
                                                sx={{
                                                    mb: 1,
                                                    background: theme.palette.mode === 'dark'
                                                        ? 'linear-gradient(45deg, #8a8a8a, #aaaaaa)'
                                                        : 'linear-gradient(45deg, #6e5cf7, #5046e5)',
                                                    backgroundClip: 'text',
                                                    WebkitBackgroundClip: 'text',
                                                    color: 'transparent'
                                                }}
                                            />
                                        </motion.div>
                                        <motion.div variants={itemVariants}>
                                            <TranslatedText i18nKey="dockerContainerManagement" variant="body2" color="text.secondary" align="center" />
                                        </motion.div>
                                    </Box>

                                    <motion.div variants={itemVariants}>
                                        <TranslatedText i18nKey="sections" variant="subtitle2" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }} />
                                    </motion.div>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <motion.div variants={sidebarItemVariants}>
                                            <Paper
                                                elevation={0}
                                                onClick={() => setActiveSection('odoo')}
                                                sx={{
                                                    p: 2,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    bgcolor: activeSection === 'odoo'
                                                        ? (theme.palette.mode === 'dark' ? '#333333' : '#e6e6ff')
                                                        : (theme.palette.mode === 'dark' ? '#222222' : 'rgba(240, 240, 255, 0.6)'),
                                                    borderRadius: 2,
                                                    transition: 'all 0.2s ease',
                                                    borderLeft: activeSection === 'odoo' ? `4px solid ${theme.palette.primary.main}` : 'none',
                                                    pl: activeSection === 'odoo' ? 1.5 : 2,
                                                    '&:hover': {
                                                        bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : 'rgba(230, 230, 255, 0.8)',
                                                    }
                                                }}
                                            >
                                                <OdooIcon color={activeSection === 'odoo' ? "primary" : "inherit"} />
                                                <TranslatedText i18nKey="odooInstances" color={activeSection === 'odoo' ? "primary" : "inherit"} />
                                            </Paper>
                                        </motion.div>

                                        <motion.div variants={sidebarItemVariants}>
                                            <Paper
                                                elevation={0}
                                                onClick={() => setActiveSection('postgres')}
                                                sx={{
                                                    p: 2,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    bgcolor: activeSection === 'postgres'
                                                        ? (theme.palette.mode === 'dark' ? '#333333' : '#e6e6ff')
                                                        : (theme.palette.mode === 'dark' ? '#222222' : 'rgba(240, 240, 255, 0.6)'),
                                                    borderRadius: 2,
                                                    transition: 'all 0.2s ease',
                                                    borderLeft: activeSection === 'postgres' ? `4px solid ${theme.palette.primary.main}` : 'none',
                                                    pl: activeSection === 'postgres' ? 1.5 : 2,
                                                    '&:hover': {
                                                        bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : 'rgba(230, 230, 255, 0.8)',
                                                    }
                                                }}
                                            >
                                                <DatabaseIcon color={activeSection === 'postgres' ? "primary" : "inherit"} />
                                                <TranslatedText i18nKey="postgresqlInstances" color={activeSection === 'postgres' ? "primary" : "inherit"} />
                                            </Paper>
                                        </motion.div>

                                        <Divider sx={{ my: 1 }} />

                                        <motion.div variants={sidebarItemVariants}>
                                            <Paper
                                                elevation={0}
                                                onClick={handleHelp}
                                                sx={{
                                                    p: 2,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    bgcolor: theme.palette.mode === 'dark' ? '#222222' : 'rgba(240, 240, 255, 0.6)',
                                                    borderRadius: 2,
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : 'rgba(230, 230, 255, 0.8)',
                                                    }
                                                }}
                                            >
                                                <HelpIcon color="info" />
                                                <TranslatedText i18nKey="help" />
                                            </Paper>
                                        </motion.div>
                                    </Box>

                                    <Box sx={{ mt: 'auto', pt: 3 }}>
                                        <motion.div variants={sidebarItemVariants}>
                                            <Paper
                                                elevation={0}
                                                onClick={handleExit}
                                                sx={{
                                                    p: 2,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2,
                                                    bgcolor: theme.palette.mode === 'dark' ? '#2a1a1a' : 'rgba(255, 240, 240, 0.6)',
                                                    borderRadius: 2,
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: theme.palette.mode === 'dark' ? '#3a2a2a' : 'rgba(255, 230, 230, 0.8)',
                                                    }
                                                }}
                                            >
                                                <ExitIcon color="error" />
                                                <TranslatedText i18nKey="exitApplication" />
                                            </Paper>
                                        </motion.div>

                                        <motion.div variants={itemVariants}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 2, opacity: 0.7 }}>
                                                <TranslatedText
                                                    i18nKey="version"
                                                    variant="caption"
                                                    color="text.secondary"
                                                />
                                                <Typography variant="caption" color="text.secondary">{appVersion}</Typography>
                                            </Box>
                                        </motion.div>
                                    </Box>
                                </Paper>
                            </motion.div>

                            {/* Main Content */}
                            <motion.div
                                variants={mainContentVariants}
                                style={{ flex: 1 }}
                            >
                                <Paper
                                    elevation={3}
                                    sx={{
                                        p: 3,
                                        height: '100%',
                                        borderRadius: 3,
                                        bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? '0 8px 24px rgba(0, 0, 0, 0.3)'
                                            : '0 8px 24px rgba(100, 100, 140, 0.1)',
                                        overflow: 'auto'
                                    }}
                                >
                                    <AnimatePresence mode="wait">
                                        {activeSection === 'odoo' ? (
                                            <motion.div
                                                key={`odoo-section-${animationKey}`}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                                variants={sectionContainerVariants}
                                            >
                                                <Box sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    mb: 3
                                                }}>
                                                    <motion.div variants={sectionHeaderVariants}>
                                                        <Typography
                                                            variant="h5"
                                                            component="h1"
                                                            fontWeight="bold"
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                backgroundImage: theme.palette.mode === 'dark'
                                                                    ? 'linear-gradient(45deg, #8a8a8a, #aaaaaa)'
                                                                    : 'linear-gradient(45deg, #6e5cf7, #5046e5)',
                                                                backgroundClip: 'text',
                                                                WebkitBackgroundClip: 'text',
                                                                color: 'transparent',
                                                            }}
                                                        >
                                                            <OdooIcon sx={{ mr: 1 }} /> <TranslatedText i18nKey="odooInstances" component="span" />
                                                        </Typography>
                                                    </motion.div>

                                                    <motion.div
                                                        variants={headerButtonsVariants}
                                                        initial="hidden"
                                                        animate="visible"
                                                    >
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                                                <Tooltip title={t("refreshOdooInstances")}>
                                                                    <IconButton onClick={handleRefreshOdoo} color="primary" size="small">
                                                                        <RefreshIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </motion.div>

                                                            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                                                <Tooltip title={t("newOdooInstance")}>
                                                                    <IconButton onClick={handleNewOdooInstance} color="primary" size="small">
                                                                        <AddIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </motion.div>
                                                        </Box>
                                                    </motion.div>
                                                </Box>

                                                {/* Show loading indicator while fetching containers */}
                                                {loading ? (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                                        <CircularProgress />
                                                    </Box>
                                                ) : (
                                                    /* Wrap ContainerList in motion.div with independent animation */
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{
                                                            opacity: 1,
                                                            transition: { delay: 0.1, duration: 0.3 }
                                                        }}
                                                    >
                                                        <ContainerList
                                                            key={`odoo-list-${animationKey}`}
                                                            containers={odooContainers}
                                                            onStart={handleContainerStart}
                                                            onStop={handleContainerStop}
                                                            onDelete={handleContainerDelete}
                                                            onLogs={handleContainerLogs}
                                                            onInfo={handleContainerInfo}
                                                            onOpenBrowser={handleOpenOdooBrowser}
                                                            onOpenDbManager={handleOpenDbManager}
                                                            containerType="odoo"
                                                        />
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key={`postgres-section-${animationKey}`}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                                variants={sectionContainerVariants}
                                            >
                                                <Box sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    mb: 3
                                                }}>
                                                    <motion.div variants={sectionHeaderVariants}>
                                                        <Typography
                                                            variant="h5"
                                                            component="h1"
                                                            fontWeight="bold"
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                backgroundImage: theme.palette.mode === 'dark'
                                                                    ? 'linear-gradient(45deg, #8a8a8a, #aaaaaa)'
                                                                    : 'linear-gradient(45deg, #6e5cf7, #5046e5)',
                                                                backgroundClip: 'text',
                                                                WebkitBackgroundClip: 'text',
                                                                color: 'transparent',
                                                            }}
                                                        >
                                                            <DatabaseIcon sx={{ mr: 1 }} /> <TranslatedText i18nKey="postgresqlInstances" component="span" />
                                                        </Typography>
                                                    </motion.div>

                                                    <motion.div
                                                        variants={headerButtonsVariants}
                                                        initial="hidden"
                                                        animate="visible"
                                                    >
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                                                <Tooltip title={t("refreshPostgresqlInstances")}>
                                                                    <IconButton onClick={handleRefreshPostgres} color="primary" size="small">
                                                                        <RefreshIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </motion.div>

                                                            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                                                <Tooltip title={t("newPostgresqlInstance")}>
                                                                    <IconButton onClick={handleNewPostgresInstance} color="primary" size="small">
                                                                        <AddIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </motion.div>
                                                        </Box>
                                                    </motion.div>
                                                </Box>

                                                {/* Show loading indicator while fetching containers */}
                                                {loading ? (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                                        <CircularProgress />
                                                    </Box>
                                                ) : (
                                                    /* Wrap ContainerList in motion.div with independent animation */
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{
                                                            opacity: 1,
                                                            transition: { delay: 0.1, duration: 0.3 }
                                                        }}
                                                    >
                                                        <ContainerList
                                                            key={`postgres-list-${animationKey}`}
                                                            containers={postgresContainers}
                                                            onStart={handleContainerStart}
                                                            onStop={handleContainerStop}
                                                            onDelete={handleContainerDelete}
                                                            onLogs={handleContainerLogs}
                                                            onInfo={handleContainerInfo}
                                                            containerType="postgres"
                                                        />
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Paper>
                            </motion.div>
                        </Box>
                    </Container>
                ) : (
                    // Empty placeholder Box to render when content shouldn't be shown yet
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.palette.mode === 'dark' ? '#121212' : '#f5f5f5',
                    }} />
                )}

                {/* Footer with more separation */}
                {shouldRenderContent && (
                    <motion.div variants={itemVariants}>
                        <Box sx={{ mt: 3 }}>
                            <Footer />
                        </Box>
                    </motion.div>
                )}

                {/* Toast Notifications */}
                <Snackbar
                    open={notification.open}
                    autoHideDuration={4000}
                    onClose={handleCloseNotification}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert
                        onClose={handleCloseNotification}
                        severity={notification.severity}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {notification.message}
                    </Alert>
                </Snackbar>
                <ConfirmationDialog
                    open={deleteDialog.open}
                    title={t('confirmDeletion')}
                    message={t('confirmDeleteContainer', { name: deleteDialog.containerName })}
                    confirmText={t('delete')}
                    cancelText={t('cancel')}
                    severity="warning"
                    onConfirm={confirmContainerDelete}
                    onCancel={() => setDeleteDialog({ open: false, containerName: '' })}
                />
                <ConfirmationDialog
                    open={exitDialog.open}
                    title={t('containersRunning')}
                    message={t('confirmExit', { count: exitDialog.runningCount })}
                    confirmText={t('exitAnyway')}
                    cancelText={t('cancel')}
                    severity="warning"
                    onConfirm={handleExitConfirm}
                    onCancel={handleExitCancel}
                />
            </motion.div>

            {/* Welcome Screen */}
            {showWelcome && (
                <WelcomeScreen
                    onClose={handleCloseWelcome}
                    onDontShowAgain={handleDontShowWelcomeAgain}
                />
            )}
        </AnimatePresence>
    );
};

export default MainLayout;