// src/components/screens/SetupScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Stepper, Step, StepLabel, Paper, Container, TextField,
    FormControlLabel, Radio, RadioGroup, FormControl, FormLabel, Checkbox, Grid,
    CircularProgress, Alert, List, ListItem, ListItemIcon, ListItemText, Divider,
    Snackbar
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Folder as FolderIcon,
    Check as CheckIcon,
    Error as ErrorIcon,
    Download as DownloadIcon,
    Palette as PaletteIcon,
    Language as LanguageIcon,
    Storage as DatabaseIcon,
    Code as OdooIcon,
    NetworkCheck as NetworkIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ColorModeContext } from '../../theme/ThemeProvider';
import settingsService from '../../services/settings/settingsService';
import dockerImagesService from '../../services/docker/dockerImagesService';
import { changeLanguage } from '../../i18n/i18n';
import { shell } from 'electron';
import { logInfo, logError } from '../../services/utils/logger';

// Define interfaces for our types
interface DockerImage {
    name: string;
    installed: boolean;
    downloading: boolean;
    size: string;
}

interface DockerNetwork {
    name: string;
    default: boolean;
    driver?: string;
}

interface NotificationState {
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
}

// Animation variants for transitions
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 100,
            damping: 15
        }
    }
};

// Step transition variants
const stepVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 100 : -100,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 100 : -100,
        opacity: 0
    })
};

// Steps for the setup wizard
const steps = [
    'welcome',
    'selectWorkDir',
    'preferences',
    'dockerCheck',
    'dockerImages',
    'networkSetup',
    'finish'
];

// Initial Docker images
const initialImages: DockerImage[] = [
    { name: 'odoo:14', installed: false, downloading: false, size: '1.2 GB' },
    { name: 'odoo:15', installed: false, downloading: false, size: '1.3 GB' },
    { name: 'odoo:16', installed: true, downloading: false, size: '1.4 GB' },
    { name: 'odoo:17', installed: false, downloading: false, size: '1.5 GB' },
    { name: 'odoo:18', installed: false, downloading: false, size: '1.6 GB' },
    { name: 'odoo:19', installed: false, downloading: false, size: '1.7 GB' },
    { name: 'postgres:13', installed: false, downloading: false, size: '0.4 GB' },
    { name: 'postgres:14', installed: true, downloading: false, size: '0.5 GB' },
    { name: 'postgres:15', installed: false, downloading: false, size: '0.5 GB' },
    { name: 'postgres:16', installed: false, downloading: false, size: '0.6 GB' },
];

// Available networks
const initialNetworks: DockerNetwork[] = [
    { name: 'odoo-network', default: true },
    { name: 'bridge', default: false },
    { name: 'host', default: false },
    { name: 'custom-network', default: false }
];

const SetupScreen: React.FC = () => {
    const theme = useTheme();
    const colorMode = React.useContext(ColorModeContext);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    // State management
    const [activeStep, setActiveStep] = useState(0);
    const [direction, setDirection] = useState(0);
    const [workDir, setWorkDir] = useState('');
    const [language, setLanguage] = useState(i18n.language || 'en');
    const [dockerStatus, setDockerStatus] = useState<'checking' | 'running' | 'not-running'>('checking');
    const [dockerComposeStatus, setDockerComposeStatus] = useState<'checking' | 'installed' | 'not-installed'>('checking');
    const [images, setImages] = useState<DockerImage[]>(initialImages);
    const [networks, setNetworks] = useState<DockerNetwork[]>(initialNetworks);
    const [selectedNetwork, setSelectedNetwork] = useState('odoo-network');
    const [newNetworkName, setNewNetworkName] = useState('');
    const [createNewNetwork, setCreateNewNetwork] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState('');

    const [notification, setNotification] = useState<NotificationState>({
        open: false,
        message: '',
        severity: 'info'
    });

    // Effect for loading system preferences
    useEffect(() => {
        if (activeStep === 2) {
            void getSystemPreferences();
        }
    }, [activeStep]);

    // Effect to synchronize component state with i18n instance at mount time
    useEffect(() => {
        // Ensure the component's language state is synced with i18n
        setLanguage(i18n.language || 'en');
    }, [i18n.language]);

    // Effect for checking Docker status
    useEffect(() => {
        if (activeStep === 3) {
            void checkDockerStatus();
        }
    }, [activeStep]);

    // Effect for checking Docker images
    useEffect(() => {
        if (activeStep === 4) {
            void fetchDockerImages();
        }
    }, [activeStep]);

    // Effect for checking Docker networks
    useEffect(() => {
        if (activeStep === 5) {
            void fetchDockerNetworks();
        }
    }, [activeStep]);

    // Format error messages to be more user-friendly
    const formatErrorMessage = (error: unknown, context: string): string => {
        let message = '';

        // Handle if error is a string
        if (typeof error === 'string') {
            message = error;
        }
        // Handle if error is an Error object
        else if (error instanceof Error) {
            message = error.message;
        }
        // Handle if error is an object with a message property
        else if (typeof error === 'object' && error !== null && 'message' in error) {
            message = String((error as { message: unknown }).message);
        }
        // Fallback for unknown error types
        else {
            message = 'An unknown error occurred';
        }

        // Add context to the error message if not already included
        if (!message.includes(context)) {
            message = `${context}: ${message}`;
        }

        // Special case handling for common Docker errors
        if (message.includes('connect ECONNREFUSED')) {
            return t('dockerNotRunning', 'Docker is not running. Please start Docker and try again.');
        }
        if (message.includes('permission denied')) {
            return t('dockerPermissionDenied', 'Permission denied. You may need to run Docker with elevated privileges.');
        }
        if (message.includes('network') && message.includes('not found')) {
            return t('networkNotFound', 'Docker network not found. Please check your network settings.');
        }
        if (message.includes('pull access denied')) {
            return t('pullAccessDenied', 'Unable to pull Docker image. The image may be private or not exist.');
        }

        return message;
    };

    // Handle language change
    const handleLanguageChange = async (newLanguage: string): Promise<void> => {
        try {
            // First update the local state
            setLanguage(newLanguage);

            // Then update the i18n instance
            await changeLanguage(newLanguage);

            // Force a re-render by updating a state variable
            setError(''); // Clear any error messages

            // Notify Electron's main process about the language change
            if (isElectron()) {
                try {
                    const { ipcRenderer } = window.require('electron');
                    ipcRenderer.send('language-changed', { language: newLanguage });
                } catch (err) {
                    logError('Error notifying main process about language change:', err);
                }
            }

            // Show notification for confirmation
            setNotification({
                open: true,
                message: t('languageChanged'),
                severity: 'success'
            });

            logInfo(`Language changed to: ${newLanguage}`);
        } catch (err) {
            logError('Error changing language:', err);
            setNotification({
                open: true,
                message: `Error changing language: ${err instanceof Error ? err.message : String(err)}`,
                severity: 'error'
            });
        }
    };

    // Check if running in Electron
    const isElectron = (): boolean => {
        return Boolean(window && window.process && window.process.type === 'renderer');
    };

    // Get system preferences for theme and language
    const getSystemPreferences = async (): Promise<void> => {
        setIsChecking(true);
        setError('');

        try {
            // Get system theme preference
            const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Set theme based on OS preference
            if (prefersDarkMode && theme.palette.mode === 'light') {
                colorMode.toggleColorMode(); // Switch to dark mode
            } else if (!prefersDarkMode && theme.palette.mode === 'dark') {
                colorMode.toggleColorMode(); // Switch to light mode
            }

            // Get system language preference
            const { navigator } = window;
            const browserLang = navigator.language.split('-')[0];

            // Only change language if it hasn't been set already (respect user selection)
            if (!language || language === 'en') {
                // Set language based on browser language (supporting only English and Spanish for now)
                if (browserLang === 'es') {
                    // Set language state and update i18n using handleLanguageChange
                    await handleLanguageChange('es');
                } else {
                    // Default to English for any other language
                    await handleLanguageChange('en');
                }
            }

            logInfo(`System preferences loaded - Theme: ${prefersDarkMode ? 'dark' : 'light'}, Language: ${browserLang}, Using: ${language}`);
        } catch (err) {
            logError('Error getting system preferences:', err);
            // Don't set an error message, just use defaults
        } finally {
            setIsChecking(false);
        }
    };

    // Check if Docker and Docker Compose are running
    const checkDockerStatus = async (): Promise<void> => {
        setIsChecking(true);
        setError('');

        try {
            const dockerRunning = await dockerImagesService.checkDocker();
            setDockerStatus(dockerRunning ? 'running' : 'not-running');

            const composeInstalled = await dockerImagesService.checkDockerCompose();
            setDockerComposeStatus(composeInstalled ? 'installed' : 'not-installed');

            logInfo(`Docker status check - Running: ${dockerRunning}, Compose installed: ${composeInstalled}`);
        } catch (err) {
            logError('Error checking Docker status:', err);
            const errorMsg = formatErrorMessage(err, 'Docker check failed');
            setError(errorMsg);
            setDockerStatus('not-running');
            setDockerComposeStatus('not-installed');

            // Show notification for better visibility
            setNotification({
                open: true,
                message: errorMsg,
                severity: 'error'
            });
        } finally {
            setIsChecking(false);
        }
    };

    // Validate network name
    const validateNetworkName = (name: string): boolean => {
        // Clear previous errors
        setError('');

        // Check if name is empty
        if (!name.trim()) {
            setError(t('networkNameRequired', 'Network name is required'));
            return false;
        }

        // Check length
        if (name.length < 2 || name.length > 64) {
            setError(t('networkNameLength', 'Network name must be between 2 and 64 characters'));
            return false;
        }

        // Check format using regex
        // Allow letters, numbers, underscores, and hyphens
        const validFormat = /^[a-zA-Z0-9_-]+$/;
        if (!validFormat.test(name)) {
            setError(t('networkNameFormatError', 'Network name can only contain letters, numbers, underscores, and hyphens'));
            return false;
        }

        // Check if name is already used
        if (networks.some(network => network.name === name)) {
            setError(t('networkNameExists', 'Network name already exists'));
            return false;
        }

        // No errors
        return true;
    };

    // Fetch available Docker images
    const fetchDockerImages = async (): Promise<void> => {
        setIsChecking(true);
        setError('');

        try {
            // Use the actual Docker images service to get real images
            const realImages = await dockerImagesService.getImages();

            if (realImages.length > 0) {
                // If we got real images from Docker, use them
                setImages(realImages.map(img => ({
                    ...img,
                    downloading: false
                })));
                logInfo(`Found ${realImages.length} Docker images`);
            } else {
                // If no images were found or error occurred, show a message
                setError('No Docker images found. You may need to download the required images.');
                logInfo('No Docker images found, using default recommended images');

                // Set default recommended images with installed=false
                setImages([
                    { name: 'odoo:14', installed: false, downloading: false, size: '1.2 GB' },
                    { name: 'odoo:15', installed: false, downloading: false, size: '1.3 GB' },
                    { name: 'odoo:16', installed: false, downloading: false, size: '1.4 GB' },
                    { name: 'odoo:17', installed: false, downloading: false, size: '1.5 GB' },
                    { name: 'postgres:13', installed: false, downloading: false, size: '0.4 GB' },
                    { name: 'postgres:14', installed: false, downloading: false, size: '0.5 GB' },
                    { name: 'postgres:15', installed: false, downloading: false, size: '0.5 GB' },
                    { name: 'postgres:16', installed: false, downloading: false, size: '0.6 GB' },
                ]);
            }
        } catch (err) {
            logError('Error fetching Docker images:', err);
            const errorMsg = formatErrorMessage(err, 'Docker images check failed');
            setError(errorMsg);

            // Show notification for better visibility
            setNotification({
                open: true,
                message: errorMsg,
                severity: 'error'
            });

            // Set default recommended images in case of error
            setImages([
                { name: 'odoo:14', installed: false, downloading: false, size: '1.2 GB' },
                { name: 'odoo:15', installed: false, downloading: false, size: '1.3 GB' },
                { name: 'odoo:16', installed: false, downloading: false, size: '1.4 GB' },
                { name: 'odoo:17', installed: false, downloading: false, size: '1.5 GB' },
                { name: 'postgres:13', installed: false, downloading: false, size: '0.4 GB' },
                { name: 'postgres:14', installed: false, downloading: false, size: '0.5 GB' },
                { name: 'postgres:15', installed: false, downloading: false, size: '0.5 GB' },
                { name: 'postgres:16', installed: false, downloading: false, size: '0.6 GB' },
            ]);
        } finally {
            setIsChecking(false);
        }
    };

    // Fetch available Docker networks
    const fetchDockerNetworks = async (): Promise<void> => {
        setIsChecking(true);
        setError('');

        try {
            // Call the actual service to get real Docker networks
            const realNetworks = await dockerImagesService.getNetworks();

            if (realNetworks.length === 0) {
                // If no networks found, use at least the bridge network
                setNetworks([
                    { name: 'bridge', default: true }
                ]);
                setSelectedNetwork('bridge');
                logInfo('No Docker networks found, using default bridge network');
            } else {
                setNetworks(realNetworks);
                logInfo(`Found ${realNetworks.length} Docker networks`);

                // Select default bridge network or first available network
                const bridgeNetwork = realNetworks.find(n => n.name === 'bridge');
                if (bridgeNetwork) {
                    setSelectedNetwork('bridge');
                } else if (realNetworks.length > 0) {
                    setSelectedNetwork(realNetworks[0].name);
                }
            }
        } catch (err) {
            logError('Error fetching Docker networks:', err);
            const errorMsg = formatErrorMessage(err, 'Network check failed');
            setError(errorMsg);

            // Show notification for better visibility
            setNotification({
                open: true,
                message: errorMsg,
                severity: 'error'
            });

            // Fallback to bridge network if error
            setNetworks([
                { name: 'bridge', default: true }
            ]);
            setSelectedNetwork('bridge');
        } finally {
            setIsChecking(false);
        }
    };

    // Handler for downloading a Docker image
    const handleDownloadImage = async (imageName: string): Promise<void> => {
        // Show start notification
        setNotification({
            open: true,
            message: t('startingDownload', 'Starting download of {{name}}...', { name: imageName }),
            severity: 'info'
        });

        // Update the image state to show downloading
        setImages(images.map(img =>
            img.name === imageName ? { ...img, downloading: true } : img
        ));

        logInfo(`Starting download of Docker image: ${imageName}`);

        try {
            // Start the actual download using the Docker images service without progress tracking
            const success = await dockerImagesService.pullImage(imageName);

            if (success) {
                // Show success notification
                setNotification({
                    open: true,
                    message: t('downloadSuccess', 'Successfully downloaded {{name}}', { name: imageName }),
                    severity: 'success'
                });

                // Mark as installed once download completes
                setImages(imgs => imgs.map(img =>
                    img.name === imageName ? { ...img, installed: true, downloading: false } : img
                ));

                logInfo(`Successfully downloaded Docker image: ${imageName}`);

                // Refresh the image list to confirm changes
                setTimeout(() => {
                    void fetchDockerImages();
                }, 1000);
            } else {
                // Show error notification
                setNotification({
                    open: true,
                    message: t('downloadFailed', 'Failed to download {{name}}. Docker returned an error.', { name: imageName }),
                    severity: 'error'
                });

                // Mark as not downloading
                setImages(imgs => imgs.map(img =>
                    img.name === imageName ? { ...img, downloading: false } : img
                ));

                logError(`Failed to download Docker image: ${imageName}`);
            }
        } catch (err) {
            logError(`Error downloading ${imageName}:`, err);

            // Format error message
            const errorMsg = formatErrorMessage(err, 'Download failed');

            // Show error notification
            setNotification({
                open: true,
                message: errorMsg,
                severity: 'error'
            });

            // Mark as not downloading
            setImages(imgs => imgs.map(img =>
                img.name === imageName ? { ...img, downloading: false } : img
            ));
        }
    };

    // Select work directory using file picker
    const selectWorkDirectory = async (): Promise<void> => {
        try {
            // Use Electron's file picker
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('show-open-dialog', {
                properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const selectedPath = result.filePaths[0];
                setWorkDir(selectedPath);
                logInfo(`Selected work directory: ${selectedPath}`);

                // Check if directory is empty or contains settings.json
                const fs = window.require('fs');
                const path = window.require('path');

                try {
                    const files = fs.readdirSync(selectedPath);
                    const hasSettingsFile = files.includes('settings.json');

                    if (files.length > 0 && !hasSettingsFile) {
                        setError('Selected directory is not empty and does not contain a settings.json file. Please select an empty directory or one containing a valid settings.json file.');
                    } else if (hasSettingsFile) {
                        // If settings.json exists, try to load it
                        try {
                            const settingsPath = path.join(selectedPath, 'settings.json');
                            const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

                            // This would be replaced with actual validation
                            if (settingsData) {
                                setError(t('existingSettingsFound', 'Found existing settings.json. The setup wizard will use these settings.'));
                                logInfo('Found existing settings.json in selected directory');
                            }
                        } catch (err) {
                            setError(t('invalidSettingsFile', 'Found settings.json but it appears to be invalid. Setup will create a new settings file.'));
                            logError('Invalid settings.json file found:', err);
                        }
                    } else {
                        setError('');
                    }
                } catch (err) {
                    logError('Error reading directory:', err);
                    setError(t('directoryAccessError', 'Error accessing the selected directory. Please ensure you have appropriate permissions.'));
                }
            }
        } catch (err) {
            logError('Error selecting directory:', err);
            setError(t('directoryPickerError', 'Failed to open directory picker. Please try again.'));
        }
    };

    // Function to cancel an ongoing download
    const cancelDownload = (imageName: string): void => {
        logInfo(`Cancelling download for ${imageName}`);

        // Set notification about cancellation
        setNotification({
            open: true,
            message: t('downloadCancelled', 'Download of {{name}} cancelled', { name: imageName }),
            severity: 'info'
        });

        // Reset the image state to not downloading
        setImages(imgs => imgs.map(img =>
            img.name === imageName ? { ...img, downloading: false } : img
        ));

        // Kill the Docker pull process using the terminal command
        try {
            // Find and kill the Docker pull process for this image
            const { exec } = require('child_process');
            exec(`pkill -f "docker pull ${imageName}"`, (error: Error | null) => {
                if (error) {
                    logError(`Error killing Docker pull process: ${error?.message}`);
                    return;
                }
                logInfo(`Docker pull process for ${imageName} terminated`);
            });
        } catch (err) {
            logError('Error killing Docker pull process:', err);
        }
    };

    // Function to check if at least one Odoo and one PostgreSQL image is installed
    const hasRequiredImages = (): boolean => {
        const hasOdooImage = images.some(img => img.name.startsWith('odoo:') && img.installed);
        const hasPostgresImage = images.some(img => img.name.startsWith('postgres:') && img.installed);
        return hasOdooImage && hasPostgresImage;
    };

    // Handle "Next" button click
    const handleNext = (): void => {
        setError('');

        // Validate current step before proceeding
        if (activeStep === 1 && !workDir) {
            setError(t('workDirRequired', 'Please select a work directory to continue.'));
            return;
        }

        // Docker check is mandatory - cannot proceed if Docker is not running
        if (activeStep === 3 && (dockerStatus === 'not-running' || dockerComposeStatus === 'not-installed')) {
            // Instead of showing the dialog that allows skipping, show an error
            setError(t('dockerRequired', 'Docker and Docker Compose are required to continue the setup. Please install and start Docker, then try again.'));
            return;
        }

        // Images are no longer required - just inform the user if they're missing
        if (activeStep === 4) {
            if (!hasRequiredImages()) {
                // Show notification but still allow to continue
                setNotification({
                    open: true,
                    message: t('noImagesDetected', 'No Odoo or PostgreSQL images detected. You can download them later when creating instances.'),
                    severity: 'info'
                });
                // No return statement - we allow proceeding without images
            }
        }

        if (activeStep === 5) {
            if (createNewNetwork) {
                if (!validateNetworkName(newNetworkName)) {
                    return; // Stop if validation fails
                }
            }
        }

        setDirection(1);
        setActiveStep((prevStep) => prevStep + 1);
    };

    // Handle "Back" button click
    const handleBack = (): void => {
        setError('');
        setDirection(-1);
        setActiveStep((prevStep) => prevStep - 1);
    };

    // Complete setup and save settings
    const finishSetup = async (): Promise<void> => {
        setIsChecking(true);
        setError('');

        logInfo('Starting setup completion process');

        try {
            // Create settings object - use selected language from state
            const settings = {
                theme: theme.palette.mode,
                language: language,
                network: createNewNetwork ? newNetworkName : selectedNetwork,
                showWelcomeScreen: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            logInfo('Settings prepared:', settings);

            // Create network if needed
            if (createNewNetwork && newNetworkName) {
                try {
                    logInfo(`Creating network: ${newNetworkName}`);
                    await dockerImagesService.createNetwork(newNetworkName);
                    logInfo(`Network created successfully: ${newNetworkName}`);
                } catch (err) {
                    logError('Error creating network:', err);
                    const errorMsg = formatErrorMessage(err, t('errorCreatingNetwork', 'Network creation failed'));
                    setError(errorMsg);

                    // Show notification for better visibility
                    setNotification({
                        open: true,
                        message: errorMsg,
                        severity: 'error'
                    });

                    setIsChecking(false);
                    return;
                }
            }

            // Save settings to the work directory
            logInfo(`Saving settings to: ${workDir}`);
            await settingsService.saveSettings(settings, workDir);
            logInfo('Settings saved successfully');

            // Save work directory path to app data
            logInfo('Saving work directory path');
            await settingsService.saveWorkDirPath(workDir);
            logInfo('Work directory path saved successfully');

            // Set flag to track setup completion
            localStorage.setItem('setupCompleted', 'true');

            // Show success message to the user
            setError('');
            setNotification({
                open: true,
                message: t('setupCompletedSuccess', 'Setup completed successfully! Redirecting to main screen...'),
                severity: 'success'
            });

            // Do a smooth fadeout animation
            logInfo('Starting window fadeout animation');

            // Get the setup container for visual fadeout
            const setupContainer = document.getElementById('setup-container');
            if (setupContainer) {
                setupContainer.style.transition = 'opacity 1.5s ease';
                setupContainer.style.opacity = '0';
            }

            // Use IPC to tell the main process to resize the window before navigation
            const { ipcRenderer } = window.require('electron');

            // First notify main process to resize window for the main screen
            setTimeout(() => {
                logInfo('Telling main process to prepare for main screen');
                ipcRenderer.send('prepare-for-main-screen');

                // Then navigate to the main screen after a short delay
                setTimeout(() => {
                    logInfo('Redirecting to main screen');
                    // Navigate to the main window route
                    navigate('/main');
                }, 500);
            }, 2000); // Delay to let fadeout animation and notification show

        } catch (err) {
            logError('Error in finishSetup:', err);
            const errorMsg = formatErrorMessage(err, 'Setup completion failed');
            setError(errorMsg);

            // Show notification for better visibility
            setNotification({
                open: true,
                message: errorMsg,
                severity: 'error'
            });

            setIsChecking(false);
        }
    };

    return (
        <Container id="setup-container" maxWidth="lg" sx={{ py: 4, transition: 'opacity 0.3s ease' }}>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: { xs: 3, md: 4 },
                        borderRadius: 3,
                        bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
                        minHeight: 830,
                        maxWidth: 1100,
                        mx: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <Box sx={{ mb: 3 }}>
                        <motion.div variants={itemVariants}>
                            <Typography
                                variant="h5"
                                component="h1"
                                gutterBottom
                                fontWeight="bold"
                                textAlign="center"
                                sx={{ mb: 1 }}
                            >
                                {t('setupTitle', 'Odoo Manager Setup')}
                            </Typography>
                            <Typography
                                variant="body1"
                                textAlign="center"
                                color="text.secondary"
                                sx={{ mb: 2 }}
                            >
                                {t('setupDescription', 'Configure your environment to manage Docker containers for Odoo and PostgreSQL')}
                            </Typography>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Stepper
                                activeStep={activeStep}
                                alternativeLabel
                                sx={{
                                    mt: 2,
                                    '& .MuiStepLabel-label': {
                                        fontSize: '0.8rem',
                                    },
                                    '& .MuiStepIcon-root': {
                                        fontSize: '1.4rem',
                                    },
                                    '& .MuiStepper-root': {
                                        padding: 0,
                                    }
                                }}
                            >
                                {steps.map((labelKey) => (
                                    <Step key={labelKey}>
                                        <StepLabel>{t(labelKey)}</StepLabel>
                                    </Step>
                                ))}
                            </Stepper>
                        </motion.div>
                    </Box>

                    {error && (
                        <motion.div variants={itemVariants}>
                            <Alert
                                severity={error.includes('Found existing settings') ? 'info' : 'error'}
                                sx={{ mb: 3 }}
                            >
                                {error}
                            </Alert>
                        </motion.div>
                    )}

                    <Box sx={{ position: 'relative', minHeight: 400, overflow: 'hidden', flex: 1 }}>
                        <AnimatePresence custom={direction} mode="wait">
                            <motion.div
                                key={activeStep}
                                custom={direction}
                                variants={stepVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30
                                }}
                                style={{ position: 'absolute', width: '100%' }}
                            >
                                {/* Step 0: Welcome */}
                                {activeStep === 0 && (
                                    <Box sx={{ textAlign: 'center', pt: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                                            <Paper
                                                elevation={3}
                                                sx={{
                                                    p: 4,
                                                    borderRadius: '50%',
                                                    width: 70,
                                                    height: 70,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: theme.palette.mode === 'dark'
                                                        ? 'linear-gradient(135deg, #333, #222)'
                                                        : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)'
                                                }}>
                                                <OdooIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                                            </Paper>
                                        </Box>
                                        <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
                                            {t('welcomeHeading', 'Welcome to Odoo Manager!')}
                                        </Typography>
                                        <Typography variant="body1" paragraph sx={{ maxWidth: 600, mx: 'auto' }}>
                                            {t('welcomeDescription', 'This setup wizard will help you configure Odoo Manager for first use. We\'ll guide you through a few simple steps to get you started.')}
                                        </Typography>

                                        <Box sx={{ display: 'flex', justifyContent: 'center', my: { xs: 3, md: 4 } }}>
                                            <Grid container spacing={{ xs: 3, md: 2 }} sx={{ maxWidth: 900 }}>
                                                <Grid item xs={12} md={6}>
                                                    <Box sx={{
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        borderRadius: 2,
                                                        p: { xs: 1.5, sm: 2 },
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-start',
                                                    }}>
                                                        <List dense sx={{ pt: 0.5 }}>
                                                            <ListItem alignItems="flex-start" sx={{ pb: 1.5 }}>
                                                                <ListItemIcon sx={{ mt: 0.5 }}>
                                                                    <FolderIcon color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                            {t('selectWorkDirTitle', 'Select a work directory')}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                                                                            {t('selectWorkDirDesc', 'Where configurations and settings will be stored')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                            <ListItem alignItems="flex-start" sx={{ pb: 1.5 }}>
                                                                <ListItemIcon sx={{ mt: 0.5 }}>
                                                                    <PaletteIcon color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                            {t('choosePrefsTitle', 'Choose your preferences')}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                                                                            {t('choosePrefsDesc', 'Set theme, language and other options')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                            <ListItem alignItems="flex-start" sx={{ pb: 1.5 }}>
                                                                <ListItemIcon sx={{ mt: 0.5 }}>
                                                                    <CheckIcon color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                            {t('verifyDockerTitle', 'Verify Docker installation')}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                                                                            {t('verifyDockerDesc', 'Check Docker and Docker Compose availability')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                        </List>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <Box sx={{
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        borderRadius: 2,
                                                        p: { xs: 1.5, sm: 2 },
                                                        height: '100%',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-start'
                                                    }}>
                                                        <List dense sx={{ pt: 0.5 }}>
                                                            <ListItem alignItems="flex-start" sx={{ pb: 1.5 }}>
                                                                <ListItemIcon sx={{ mt: 0.5 }}>
                                                                    <DownloadIcon color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                            {t('downloadImagesTitle', 'Download Docker images')}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                                                                            {t('downloadImagesDesc', 'Required Odoo and PostgreSQL images')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                            <ListItem alignItems="flex-start" sx={{ pb: 1.5 }}>
                                                                <ListItemIcon sx={{ mt: 0.5 }}>
                                                                    <NetworkIcon color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                            {t('configNetworkTitle', 'Configure Docker network')}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                                                                            {t('configNetworkDesc', 'Set up container networking options')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                            <ListItem alignItems="flex-start" sx={{ pb: 1.5 }}>
                                                                <ListItemIcon sx={{ mt: 0.5 }}>
                                                                    <OdooIcon color="primary" />
                                                                </ListItemIcon>
                                                                <ListItemText
                                                                    primary={
                                                                        <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                            {t('startUsingTitle', 'Start using Odoo Manager')}
                                                                        </Typography>
                                                                    }
                                                                    secondary={
                                                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                                                                            {t('startUsingDesc', 'Create and manage your Odoo instances')}
                                                                        </Typography>
                                                                    }
                                                                />
                                                            </ListItem>
                                                        </List>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Box>

                                        <Typography variant="body1" sx={{ mt: 2 }}>
                                            {t('clickNextToBegin', 'Click "Next" to begin the setup process.')}
                                        </Typography>
                                    </Box>
                                )}

                                {/* Step 1: Work Directory */}
                                {activeStep === 1 && (
                                    <Box sx={{ pt: 2 }}>
                                        <Typography variant="h5" gutterBottom>
                                            {t('selectWorkDirHeading', 'Select Work Directory')}
                                        </Typography>
                                        <Typography variant="body1" paragraph>
                                            {t('selectWorkDirInstructions', 'Choose a directory where Odoo Manager will store all configuration files and settings.')}
                                        </Typography>

                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                            <TextField
                                                fullWidth
                                                label={t('selectWorkDir', 'Work Directory')}
                                                value={workDir}
                                                disabled
                                                sx={{ mr: 2 }}
                                            />
                                            <Button
                                                variant="contained"
                                                onClick={() => void selectWorkDirectory()}
                                                startIcon={<FolderIcon />}
                                            >
                                                {t('browse', 'Browse')}
                                            </Button>
                                        </Box>

                                        <Typography variant="body2" color="text.secondary">
                                            {t('existingSettingsInfo', 'If you select a directory that already contains a settings.json file, Odoo Manager will load existing settings.')}
                                        </Typography>

                                        <Alert severity="info" sx={{ mt: 3 }}>
                                            {t('directoryAccessTip', 'This directory should be easily accessible as you may want to manually edit configuration files later.')}
                                        </Alert>
                                    </Box>
                                )}

                                {/* Step 2: Preferences */}
                                {activeStep === 2 && (
                                    <Box sx={{ pt: 2 }}>
                                        <Typography variant="h5" gutterBottom>
                                            {t('setPreferences', 'Set Preferences')}
                                        </Typography>

                                        <Grid container spacing={4} sx={{ mt: 1 }}>
                                            <Grid item sm={6} lg={4}>
                                                <Paper elevation={2} sx={{ p: 2.5, height: '100%', borderRadius: 2 }}>
                                                    <FormControl component="fieldset">
                                                        <FormLabel component="legend">
                                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                                <PaletteIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                                <Typography variant="h6">{t('theme', 'Theme')}</Typography>
                                                            </Box>
                                                        </FormLabel>
                                                        <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.9rem' }}>
                                                            {t('themeDescription', 'Choose your preferred color theme for the application interface.')}
                                                        </Typography>
                                                        <RadioGroup
                                                            value={theme.palette.mode}
                                                            onChange={() => colorMode.toggleColorMode()}
                                                        >
                                                            <FormControlLabel
                                                                value="light"
                                                                control={<Radio />}
                                                                label={t('lightMode', 'Light Mode')}
                                                            />
                                                            <FormControlLabel
                                                                value="dark"
                                                                control={<Radio />}
                                                                label={t('darkMode', 'Dark Mode')}
                                                            />
                                                        </RadioGroup>
                                                    </FormControl>
                                                </Paper>
                                            </Grid>

                                            <Grid item sm={6} lg={4}>
                                                <Paper elevation={2} sx={{ p: 2.5, height: '100%', borderRadius: 2 }}>
                                                    <FormControl component="fieldset">
                                                        <FormLabel component="legend">
                                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                                <LanguageIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                                <Typography variant="h6">{t('language', 'Language')}</Typography>
                                                            </Box>
                                                        </FormLabel>
                                                        <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.9rem' }}>
                                                            {t('languageDescription', 'Select your preferred language for the application interface.')}
                                                        </Typography>
                                                        <RadioGroup
                                                            value={language}
                                                            onChange={(e) => void handleLanguageChange(e.target.value)}
                                                        >
                                                            <FormControlLabel value="en" control={<Radio />} label={t('english', 'English')} />
                                                            <FormControlLabel value="es" control={<Radio />} label={t('spanish', 'Español')} />
                                                        </RadioGroup>
                                                    </FormControl>
                                                </Paper>
                                            </Grid>
                                        </Grid>

                                        <Alert severity="info" sx={{ mt: 3 }}>
                                            {t('systemPreferencesInfo', 'These preferences are automatically detected from your system settings and can be changed later in the application settings.')}
                                        </Alert>
                                    </Box>
                                )}

                                {/* Step 3: Docker Check */}
                                {activeStep === 3 && (
                                    <Box sx={{ pt: 2 }}>
                                        <Typography variant="h5" gutterBottom>
                                            {t('verifyDockerInstallation', 'Verify Docker Installation')}
                                        </Typography>
                                        <Typography variant="body1" paragraph>
                                            {t('checkingDockerStatus', 'Checking if Docker and Docker Compose are installed and running...')}
                                        </Typography>

                                        <List>
                                            <ListItem>
                                                <ListItemIcon>
                                                    {isChecking ? (
                                                        <CircularProgress size={24} />
                                                    ) : dockerStatus === 'running' ? (
                                                        <CheckIcon color="success" />
                                                    ) : (
                                                        <ErrorIcon color="error" />
                                                    )}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={t('dockerEngine', 'Docker Engine')}
                                                    secondary={
                                                        isChecking
                                                            ? t('checking', 'Checking...')
                                                            : dockerStatus === 'running'
                                                                ? t('running', 'Running')
                                                                : t('notRunning', 'Not running or not installed')
                                                    }
                                                />
                                            </ListItem>

                                            <ListItem>
                                                <ListItemIcon>
                                                    {isChecking ? (
                                                        <CircularProgress size={24} />
                                                    ) : dockerComposeStatus === 'installed' ? (
                                                        <CheckIcon color="success" />
                                                    ) : (
                                                        <ErrorIcon color="error" />
                                                    )}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={t('dockerCompose')}
                                                    secondary={
                                                        isChecking
                                                            ? t('checking', 'Checking...')
                                                            : dockerComposeStatus === 'installed'
                                                                ? t('installed', 'Installed')
                                                                : t('notInstalled', 'Not installed')
                                                    }
                                                />
                                            </ListItem>
                                        </List>
                                        {dockerStatus === 'not-running' && (
                                            <Alert
                                                severity="error"
                                                sx={{ mt: 3 }}
                                                action={
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => void checkDockerStatus()}
                                                        >
                                                            {t('retry', 'Retry')}
                                                        </Button>
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            color="error"
                                                            onClick={() => shell.openExternal('https://docs.docker.com/get-docker/')}
                                                        >
                                                            {t('getDocker', 'Get Docker')}
                                                        </Button>
                                                    </Box>
                                                }
                                            >
                                                {t('dockerNotRunningError', 'Docker is not running or not installed. You need to install and start Docker to use Odoo Manager. Please start Docker and click "Retry".')}
                                            </Alert>
                                        )}

                                        {dockerComposeStatus === 'not-installed' && (
                                            <Alert
                                                severity="error"
                                                sx={{ mt: 3 }}
                                                action={
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={() => void checkDockerStatus()}
                                                        >
                                                            {t('retry', 'Retry')}
                                                        </Button>
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            color="error"
                                                            onClick={() => shell.openExternal('https://docs.docker.com/compose/install/')}
                                                        >
                                                            {t('getDockerCompose', 'Get Docker Compose')}
                                                        </Button>
                                                    </Box>
                                                }
                                            >
                                                {t('dockerComposeNotInstalledError', 'Docker Compose is not installed. You need to install Docker Compose to use Odoo Manager. After installation, click "Retry".')}
                                            </Alert>
                                        )}

                                        {dockerStatus === 'running' && dockerComposeStatus === 'installed' && (
                                            <Alert severity="success" sx={{ mt: 3 }}>
                                                {t('dockerRunningSuccess', 'Docker and Docker Compose are properly installed and running.')}
                                            </Alert>
                                        )}
                                    </Box>
                                )}

                                {/* Step 4: Docker Images */}
                                {activeStep === 4 && (
                                    <Box
                                        sx={{
                                            pt: 2,
                                            height: '100%',
                                            maxHeight: 'calc(65vh - 100px)',
                                            overflow: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="h5" gutterBottom>
                                                {t('dockerImages', 'Docker Images')}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<RefreshIcon />}
                                                onClick={() => void fetchDockerImages()}
                                                disabled={isChecking}
                                            >
                                                {t('refreshImages', 'Refresh')}
                                            </Button>
                                        </Box>
                                        <Typography variant="body1" paragraph>
                                            {t('selectImagesToDownload', 'Select Docker images to download. You\'ll need at least one Odoo and one PostgreSQL image.')}
                                        </Typography>

                                        {isChecking ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                                                <CircularProgress />
                                            </Box>
                                        ) : (
                                            <Box sx={{ overflowY: 'auto', flex: 1 }}>
                                                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                                                    <OdooIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                                                    {t('odooImages', 'Odoo Images')}
                                                </Typography>
                                                <List>
                                                    {images.filter(img => img.name.startsWith('odoo')).map(image => (
                                                        <ListItem key={image.name}>
                                                            <ListItemIcon>
                                                                {image.installed ? (
                                                                    <CheckIcon color="success" />
                                                                ) : image.downloading ? (
                                                                    <CircularProgress
                                                                        size={24}
                                                                    />
                                                                ) : (
                                                                    <DownloadIcon color="primary" />
                                                                )}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={image.name}
                                                                secondary={image.installed ?
                                                                    t('imageSize', 'Size: {{size}}', { size: image.size }) :
                                                                    t('estimatedDownloadSize', 'Estimated download size: {{size}}', { size: image.size })
                                                                }
                                                            />
                                                            {!image.installed && !image.downloading && (
                                                                <Button
                                                                    variant="outlined"
                                                                    size="small"
                                                                    onClick={() => void handleDownloadImage(image.name)}
                                                                >
                                                                    {t('download', 'Download')}
                                                                </Button>
                                                            )}
                                                            {image.downloading && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', minWidth: '180px' }}>
                                                                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                                                                        {t('downloading', 'Downloading...')}
                                                                    </Typography>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color="error"
                                                                        onClick={() => cancelDownload(image.name)}
                                                                    >
                                                                        {t('cancel', 'Cancel')}
                                                                    </Button>
                                                                </Box>
                                                            )}
                                                        </ListItem>
                                                    ))}
                                                </List>

                                                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                                                    <DatabaseIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                                                    {t('postgresqlImages', 'PostgreSQL Images')}
                                                </Typography>
                                                <List>
                                                    {images.filter(img => img.name.startsWith('postgres')).map(image => (
                                                        <ListItem key={image.name}>
                                                            <ListItemIcon>
                                                                {image.installed ? (
                                                                    <CheckIcon color="success" />
                                                                ) : image.downloading ? (
                                                                    <CircularProgress
                                                                        size={24}
                                                                    />
                                                                ) : (
                                                                    <DownloadIcon color="primary" />
                                                                )}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={image.name}
                                                                secondary={image.installed ?
                                                                    t('imageSize', 'Size: {{size}}', { size: image.size }) :
                                                                    t('estimatedDownloadSize', 'Estimated download size: {{size}}', { size: image.size })
                                                                }
                                                            />
                                                            {!image.installed && !image.downloading && (
                                                                <Button
                                                                    variant="outlined"
                                                                    size="small"
                                                                    onClick={() => void handleDownloadImage(image.name)}
                                                                >
                                                                    {t('download', 'Download')}
                                                                </Button>
                                                            )}
                                                            {image.downloading && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', minWidth: '180px' }}>
                                                                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                                                                        {t('downloading', 'Downloading...')}
                                                                    </Typography>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        color="error"
                                                                        onClick={() => cancelDownload(image.name)}
                                                                    >
                                                                        {t('cancel', 'Cancel')}
                                                                    </Button>
                                                                </Box>
                                                            )}
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </Box>
                                        )}

                                        <Alert
                                            severity={hasRequiredImages() ? "success" : "info"}
                                            sx={{ mt: 3 }}
                                        >
                                            {hasRequiredImages()
                                                ? t('hasRequiredImagesSuccess', 'You have Odoo and PostgreSQL images ready to use. You can proceed to the next step.')
                                                : t('noRequiredImagesInfo', 'You need at least one Odoo and one Postgres image. You can download them now or later before creating instances. Download times vary based on image size and your internet connection.')}
                                        </Alert>
                                    </Box>
                                )}

                                {/* Step 5: Network Setup */}
                                {activeStep === 5 && (
                                    <Box
                                        sx={{
                                            pt: 2,
                                            height: '100%',
                                            maxHeight: 'calc(65vh - 100px)',
                                            overflow: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <Typography variant="h5" gutterBottom>
                                            {t('networkConfiguration', 'Network Configuration')}
                                        </Typography>
                                        <Typography variant="body1" paragraph>
                                            {t('selectDockerNetwork', 'Select a Docker network for your Odoo instances or create a new one.')}
                                        </Typography>

                                        {isChecking ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                                                <CircularProgress />
                                            </Box>
                                        ) : (
                                            <Box sx={{ overflowY: 'auto', flex: 1 }}>
                                                <FormControl component="fieldset" sx={{ width: '100%' }}>
                                                    <RadioGroup
                                                        value={selectedNetwork}
                                                        onChange={(e) => {
                                                            setSelectedNetwork(e.target.value);
                                                            setCreateNewNetwork(false);
                                                            setError('');
                                                        }}
                                                    >
                                                        {networks.map(network => (
                                                            <FormControlLabel
                                                                key={network.name}
                                                                value={network.name}
                                                                control={<Radio />}
                                                                label={
                                                                    <Typography>
                                                                        {network.name}
                                                                        {network.default ? ` (${t('default', 'default')})` : ''}
                                                                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                                                            {network.driver && `[${network.driver}]`}
                                                                        </Typography>
                                                                    </Typography>
                                                                }
                                                                disabled={createNewNetwork}
                                                                sx={{ mb: 1 }}
                                                            />
                                                        ))}
                                                    </RadioGroup>
                                                </FormControl>

                                                <Divider sx={{ my: 2 }} />

                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={createNewNetwork}
                                                            onChange={(e) => {
                                                                setCreateNewNetwork(e.target.checked);
                                                                if (!e.target.checked) {
                                                                    setError('');
                                                                }
                                                            }}
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="body1" fontWeight="medium">
                                                            {t('createNewNetwork', 'Create a new network')}
                                                        </Typography>
                                                    }
                                                    sx={{ mt: 0 }}
                                                />

                                                {createNewNetwork && (
                                                    <Box sx={{ mt: 1, mb: 1 }}>
                                                        <TextField
                                                            fullWidth
                                                            label={t('newNetworkName', 'New Network Name')}
                                                            value={newNetworkName}
                                                            onChange={(e) => {
                                                                setNewNetworkName(e.target.value);
                                                                validateNetworkName(e.target.value);
                                                            }}
                                                            placeholder={t('networkNamePlaceholder', 'e.g., my-odoo-network')}
                                                            helperText={
                                                                error && error.includes('network name')
                                                                    ? error
                                                                    : t('networkNameFormat', 'Network name must be 2-64 characters and contain only letters, numbers, hyphens, and underscores')
                                                            }
                                                            error={!!error && error.includes('network name')}
                                                        />
                                                    </Box>
                                                )}

                                                {createNewNetwork && newNetworkName && (
                                                    <Box sx={{ mt: 2, mb: 1, bgcolor: 'background.paper', p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                                        <Typography variant="subtitle2" gutterBottom color="primary">
                                                            {t('commandPreview', 'Command Preview:')}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            fontFamily="monospace"
                                                            sx={{
                                                                p: 1,
                                                                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                                                                borderRadius: 1
                                                            }}
                                                        >
                                                            docker network create {newNetworkName}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}

                                        <Alert severity="info" sx={{ mt: 2 }}>
                                            {t('networkSecurityInfo', 'Using a dedicated Docker network helps isolate your Odoo instances and improves security.')}
                                        </Alert>
                                    </Box>
                                )}

                                {/* Step 6: Finish */}
                                {activeStep === 6 && (
                                    <Box sx={{ pt: 2, textAlign: 'center' }}>
                                        <CheckIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
                                        <Typography variant="h5" gutterBottom>
                                            {t('finish', 'Setup Complete!')}
                                        </Typography>
                                        <Typography variant="body1" paragraph>
                                            {t('setupCompleteMessage', 'Odoo Manager has been successfully configured with the following settings:')}
                                        </Typography>

                                        <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'left', mb: 3 }}>
                                            <Typography variant="body1">
                                                <strong>{t('selectWorkDir', 'Work Directory')}:</strong> {workDir}
                                            </Typography>
                                            <Typography variant="body1">
                                                <strong>{t('theme', 'Theme')}:</strong> {theme.palette.mode === 'dark' ? t('darkMode', 'Dark Mode') : t('lightMode', 'Light Mode')}
                                            </Typography>
                                            <Typography variant="body1">
                                                <strong>{t('language', 'Language')}:</strong> {language === 'en' ? t('english', 'English') : t('spanish', 'Español')}
                                            </Typography>
                                            <Typography variant="body1">
                                                <strong>{t('network', 'Network')}:</strong> {createNewNetwork ? newNetworkName : selectedNetwork}
                                            </Typography>
                                        </Box>

                                        <Typography variant="body1">
                                            {t('clickFinishToSave', 'Click "Finish" to save your settings and start using Odoo Manager.')}
                                        </Typography>
                                    </Box>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </Box>

                    <Box sx={{ mb: 0, pt: 3, display: 'flex', justifyContent: 'space-between' }}>
                        <Button
                            variant="outlined"
                            onClick={handleBack}
                            disabled={activeStep === 0 || isChecking}
                        >
                            {t('back', 'Back')}
                        </Button>

                        {activeStep === steps.length - 1 ? (
                            <Button
                                variant="contained"
                                color="success"
                                onClick={() => void finishSetup()}
                                disabled={isChecking}
                            >
                                {isChecking ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
                                {t('finish', 'Finish')}
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={handleNext}
                                disabled={isChecking}
                            >
                                {isChecking ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
                                {t('next', 'Next')}
                            </Button>
                        )}
                    </Box>
                </Paper>
            </motion.div>

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
        </Container>
    );
};

export default SetupScreen;