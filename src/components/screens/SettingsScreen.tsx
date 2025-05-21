// src/components/screens/SettingsScreen.tsx
import React, {useState, useContext, useEffect, JSX, Suspense, lazy} from 'react';
import {
    Box,
    Typography,
    Container,
    Paper,
    Button,
    TextField,
    FormControlLabel,
    Switch,
    IconButton,
    useTheme,
    List,
    ListItem,
    ListItemIcon,
    Grid,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    alpha,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    DialogContentText,
    CircularProgress,
    Alert,
    Tooltip
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import odooLogo from '../../assets/imgs/odoo.png';
import {
    Folder as FolderIcon,
    Palette as PaletteIcon,
    Language as LanguageIcon,
    Storage as StorageIcon,
    Update as UpdateIcon,
    Build as BuildIcon,
    Info as InfoIcon,
    Delete as DeleteIcon,
    CloudDownload as DownloadIcon,
    Refresh as RefreshIcon,
    OpenInNew as OpenInNewIcon,
    Email as EmailIcon,
    GitHub as GitHubIcon,
    Instagram as InstagramIcon,
    Facebook as FacebookIcon,
    Help as HelpIcon,
    Check as CheckIcon,
    Stop as StopIcon
} from '@mui/icons-material';
import { useAppVersion } from '../../hooks/useAppVersion';
import { isElectron } from '../../utils/electron';
import { ColorModeContext } from '../../theme/ThemeProvider';
import dockerImagesService, { DockerImage } from '../../services/docker/dockerImagesService';
import customImagesService, { CustomImage, BuildImageOptions } from '../../services/docker/customImagesService';
import settingsService from '../../services/settings/settingsService';
import { changeLanguage } from '../../i18n/i18n';
import TranslatedText from '../shared/TranslatedText';
import ImageBuildDialog from '../docker/ImageBuildDialog';
import { logDebug, logInfo, logWarn, logError } from '../../services/utils/logger';

// Animation variants for UI elements
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            duration: 0.3
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    }
};

const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: i * 0.05,
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    })
};

const SettingsScreen: React.FC = () => {
    const theme = useTheme();
    const colorMode = useContext(ColorModeContext);
    const { t, i18n } = useTranslation();
    const [activeSection, setActiveSection] = useState('GENERAL');
    const [workDirectory, setWorkDirectory] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en'); 
    const appVersion = useAppVersion();

    // Docker images state
    const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
    const [customImages, setCustomImages] = useState<CustomImage[]>([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [error, setError] = useState('');
    const [downloadingImage, setDownloadingImage] = useState<string | null>(null);
    const [updatingImage, setUpdatingImage] = useState<string | null>(null);

    // Custom image state
    const [newCustomImageName, setNewCustomImageName] = useState('');
    const [selectedBaseImage, setSelectedBaseImage] = useState('');
    const [pythonLibraries, setPythonLibraries] = useState('');
    const [systemPackages, setSystemPackages] = useState('');
    const [nameError, setNameError] = useState('');

    // Modal states
    const [showBuildDialog, setShowBuildDialog] = useState(false);
    const [buildOptions, setBuildOptions] = useState<BuildImageOptions | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<CustomImage | null>(null);
    const [showDeleteDockerDialog, setShowDeleteDockerDialog] = useState(false);
    const [dockerImageToDelete, setDockerImageToDelete] = useState<string | null>(null);

    // Notification state
    const [notificationState, setNotificationState] = useState({
        open: false,
        message: '',
        severity: 'info' as 'info' | 'success' | 'warning' | 'error'
    });

    // Define sections for the sidebar
    const sections = [
        { id: 'GENERAL', icon: <FolderIcon />, label: 'GENERAL' },
        { id: 'IMAGES', icon: <StorageIcon />, label: 'IMAGES' },
        { id: 'CUSTOM_IMAGES', icon: <BuildIcon />, label: 'CUSTOM IMAGES' },
        { id: 'UPDATES', icon: <UpdateIcon />, label: 'UPDATES' },
        { id: 'ABOUT', icon: <InfoIcon />, label: 'ABOUT' },
    ];

    // Load settings and initialize data on mount
    useEffect(() => {
        // Load work directory
        void loadWorkDirectory();

        // Initially fetch Docker images regardless of active section to have them ready
        void fetchDockerImages();
    }, []);

    // Load data based on active section
    useEffect(() => {
        // Fetch custom images if active section is CUSTOM_IMAGES
        if (activeSection === 'CUSTOM_IMAGES') {
            void fetchCustomImages();
        }
    }, [activeSection]);
    
    // Handle language change
    const handleLanguageChange = async (language: string): Promise<void> => {
        logInfo(`Changing application language to: ${language}`);
        setSelectedLanguage(language);
        await changeLanguage(language);
        logDebug(`Language change complete, current i18n language: ${i18n.language}`);
        
        // Force a re-render of the entire app by triggering a window refresh event
        if (isElectron()) {
            try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('language-changed', { language });
            } catch (error) {
                logError('Error notifying main process about language change', error);
            }
        }
        
        showNotification(t('languageChanged'), 'success');
    };

    // Load work directory from settings
    const loadWorkDirectory = async (): Promise<void> => {
        try {
            const workDirPath = await settingsService.getWorkDirPath();
            if (workDirPath) {
                setWorkDirectory(workDirPath);
                logDebug(`Work directory loaded: ${workDirPath}`);
            }
        } catch (error) {
            logError('Error loading work directory', error);
            showNotification('Error loading work directory', 'error');
        }
    };

    // Open work directory in file explorer
    const handleOpenWorkDirectory = async (): Promise<void> => {
        if (!isElectron() || !workDirectory) {
            return;
        }

        try {
            logDebug(`Opening work directory in file explorer: ${workDirectory}`);
            const { shell } = window.require('electron');
            await shell.openPath(workDirectory);
        } catch (error) {
            logError('Error opening work directory in file explorer', error);
            showNotification('Error opening directory', 'error');
        }
    };

    // Fetch Docker images
    const fetchDockerImages = async (): Promise<void> => {
        if (activeSection === 'IMAGES' || activeSection === 'CUSTOM_IMAGES') {
            setLoadingImages(true);
        }
        setError('');

        try {
            logDebug('Fetching Docker images');
            const images = await dockerImagesService.getImages();
            setDockerImages(images);
            logDebug(`Successfully fetched ${images.length} Docker images`);
        } catch (error) {
            logError('Error fetching Docker images', error);
            setError('Failed to fetch Docker images. Please make sure Docker is running.');
        } finally {
            if (activeSection === 'IMAGES' || activeSection === 'CUSTOM_IMAGES') {
                setLoadingImages(false);
            }
        }
    };

    // Fetch custom images
    const fetchCustomImages = async (): Promise<void> => {
        setLoadingImages(true);
        setError('');

        try {
            logDebug('Fetching custom Docker images');
            const images = await customImagesService.getCustomImages();
            setCustomImages(images);
            logDebug(`Successfully fetched ${images.length} custom Docker images`);
        } catch (error) {
            logError('Error fetching custom Docker images', error);
            setError('Failed to fetch custom images.');
        } finally {
            setLoadingImages(false);
        }
    };

    // Download Docker image
    const handleDownloadImage = async (imageName: string): Promise<void> => {
        setDownloadingImage(imageName);
        setError('');

        try {
            logInfo(`Starting download of Docker image: ${imageName}`);
            showNotification(`Downloading ${imageName}...`, 'info');

            // Start download
            const success = await dockerImagesService.pullImage(
                imageName,
                undefined,  // No progress callback
                undefined   // No size callback
            );

            if (success) {
                logInfo(`Successfully downloaded Docker image: ${imageName}`);
                showNotification(`Successfully downloaded ${imageName}`, 'success');

                // Refresh the image list
                await fetchDockerImages();

                // Also refresh custom images as base images may have changed
                await fetchCustomImages();
            } else {
                logWarn(`Failed to download Docker image: ${imageName}`);
                showNotification(`Failed to download ${imageName}`, 'error');
            }
        } catch (error) {
            logError(`Error downloading Docker image: ${imageName}`, error);
            setError(`Failed to download ${imageName}. ${error instanceof Error ? error.message : String(error)}`);
            showNotification(`Failed to download ${imageName}`, 'error');
        } finally {
            setDownloadingImage(null);
        }
    };

    // Cancel download
    const cancelDownload = (imageName: string): void => {
        if (!isElectron()) return;

        try {
            logInfo(`Cancelling download of Docker image: ${imageName}`);
            showNotification(`Cancelling download of ${imageName}...`, 'info');

            // Kill the Docker pull process
            const { exec } = window.require('child_process');
            exec(`pkill -f "docker pull ${imageName}"`, (error: Error | null) => {
                if (error) {
                    logError(`Error cancelling download of Docker image: ${imageName}`, error);
                    showNotification(`Error cancelling download: ${error.message}`, 'error');
                } else {
                    logInfo(`Successfully cancelled download of Docker image: ${imageName}`);
                    showNotification(`Download cancelled for ${imageName}`, 'info');
                }

                // Reset downloading state
                setDownloadingImage(null);
            });
        } catch (error) {
            logError(`Error initiating download cancellation for Docker image: ${imageName}`, error);
            showNotification(`Error cancelling download`, 'error');
            setDownloadingImage(null);
        }
    };

    // Update Docker image
    const handleUpdateImage = async (imageName: string): Promise<void> => {
        setUpdatingImage(imageName);
        setError('');

        try {
            logInfo(`Starting update of Docker image: ${imageName}`);
            showNotification(`Updating ${imageName}...`, 'info');

            // Start update (this is essentially the same as pulling)
            const success = await dockerImagesService.pullImage(
                imageName,
                undefined,  // No progress callback
                undefined   // No size callback
            );

            if (success) {
                logInfo(`Successfully updated Docker image: ${imageName}`);
                showNotification(`Successfully updated ${imageName}`, 'success');

                // Refresh the image list
                await fetchDockerImages();
            } else {
                logWarn(`Failed to update Docker image: ${imageName}`);
                showNotification(`Failed to update ${imageName}`, 'error');
            }
        } catch (error) {
            logError(`Error updating Docker image: ${imageName}`, error);
            setError(`Failed to update ${imageName}. ${error instanceof Error ? error.message : String(error)}`);
            showNotification(`Failed to update ${imageName}`, 'error');
        } finally {
            setUpdatingImage(null);
        }
    };

    // Cancel update
    const cancelUpdate = (imageName: string): void => {
        if (!isElectron()) return;

        try {
            logInfo(`Cancelling update of Docker image: ${imageName}`);
            showNotification(`Cancelling update of ${imageName}...`, 'info');

            // Kill the Docker pull process
            const { exec } = window.require('child_process');
            exec(`pkill -f "docker pull ${imageName}"`, (error: Error | null) => {
                if (error) {
                    logError(`Error cancelling update of Docker image: ${imageName}`, error);
                    showNotification(`Error cancelling update: ${error.message}`, 'error');
                } else {
                    logInfo(`Successfully cancelled update of Docker image: ${imageName}`);
                    showNotification(`Update cancelled for ${imageName}`, 'info');
                }

                // Reset updating state
                setUpdatingImage(null);
            });
        } catch (error) {
            logError(`Error initiating update cancellation for Docker image: ${imageName}`, error);
            showNotification(`Error cancelling update`, 'error');
            setUpdatingImage(null);
        }
    };

    // Delete Docker image
    const handleDeleteDockerImage = (imageName: string): void => {
        setDockerImageToDelete(imageName);
        setShowDeleteDockerDialog(true);
    };

    // Confirm delete Docker image
    const confirmDeleteDockerImage = async (): Promise<void> => {
        if (!dockerImageToDelete) return;
        if (!isElectron()) return;

        try {
            setShowDeleteDockerDialog(false);
            logInfo(`Deleting Docker image: ${dockerImageToDelete}`);
            showNotification(`Deleting ${dockerImageToDelete}...`, 'info');

            // Delete Docker image
            const { exec } = window.require('child_process');
            exec(`docker rmi ${dockerImageToDelete}`, async (error: Error | null) => {
                if (error) {
                    logError(`Error deleting Docker image: ${dockerImageToDelete}`, error);
                    showNotification(`Failed to delete ${dockerImageToDelete}: ${error.message}`, 'error');
                } else {
                    logInfo(`Successfully deleted Docker image: ${dockerImageToDelete}`);
                    showNotification(`Deleted ${dockerImageToDelete} successfully`, 'success');

                    // Refresh the image list
                    await fetchDockerImages();

                    // Also check custom images in case they depend on this image
                    await fetchCustomImages();
                }
            });
        } catch (error) {
            logError(`Error deleting Docker image: ${dockerImageToDelete}`, error);
            showNotification(`Failed to delete ${dockerImageToDelete}`, 'error');
        } finally {
            setDockerImageToDelete(null);
        }
    };

    // Delete custom image
    const handleDeleteCustomImage = (image: CustomImage): void => {
        setImageToDelete(image);
        setShowDeleteDialog(true);
    };

    // Confirm delete custom image
    const confirmDeleteImage = async (): Promise<void> => {
        if (!imageToDelete) return;
        if (!isElectron()) return;

        try {
            setShowDeleteDialog(false);
            logInfo(`Deleting custom Docker image: ${imageToDelete.name} (${imageToDelete.imageName}:${imageToDelete.imageTag})`);
            showNotification(`Deleting ${imageToDelete.name}...`, 'info');

            // Delete from Docker
            const { exec } = window.require('child_process');
            exec(`docker rmi ${imageToDelete.imageName}:${imageToDelete.imageTag}`, async (error: Error | null) => {
                if (error) {
                    logWarn(`Error deleting custom image from Docker: ${imageToDelete.name}`, error);
                    // Still continue to delete from custom images list even if Docker removal fails
                }

                try {
                    // Delete from custom images
                    await customImagesService.deleteCustomImage(imageToDelete.id);
                    logInfo(`Successfully deleted custom image from registry: ${imageToDelete.name}`);

                    // Refresh custom images
                    await fetchCustomImages();

                    showNotification(`Deleted ${imageToDelete.name} successfully`, 'success');
                } catch (deleteError) {
                    logError(`Error deleting custom image from registry: ${imageToDelete.name}`, deleteError);
                    showNotification(`Failed to delete ${imageToDelete.name} from registry`, 'error');
                }
            });
        } catch (error) {
            logError(`Error deleting custom image: ${imageToDelete.name}`, error);
            showNotification(`Failed to delete ${imageToDelete.name}`, 'error');
        } finally {
            setImageToDelete(null);
        }
    };

    // Validate custom image name
    const validateImageName = async (name: string): Promise<boolean> => {
        setNameError('');

        // Basic validation
        const validation = customImagesService.validateImageName(name);
        if (!validation.valid) {
            setNameError(validation.message);
            return false;
        }

        // Check if name is available
        const isAvailable = await customImagesService.isImageNameAvailable(name);
        if (!isAvailable) {
            setNameError('Image name already exists');
            return false;
        }

        return true;
    };

    // Handle build image
    const handleBuildImage = async (): Promise<void> => {
        // Validate inputs
        const isValid = await validateImageName(newCustomImageName);
        if (!isValid) {
            logDebug(`Invalid custom image name: ${newCustomImageName}`);
            return;
        }

        if (!selectedBaseImage) {
            logWarn('Build image attempt with no base Odoo image selected');
            setError('Please select a base Odoo image');
            return;
        }

        // Parse Python libraries and system packages
        const pythonLibsList = pythonLibraries
            .split('\n')
            .map(lib => lib.trim())
            .filter(lib => lib !== '');

        const systemPackagesList = systemPackages
            .split('\n')
            .map(pkg => pkg.trim())
            .filter(pkg => pkg !== '');

        // Create build options
        const options: BuildImageOptions = {
            name: newCustomImageName,
            baseVersion: selectedBaseImage,
            pythonLibraries: pythonLibsList,
            systemPackages: systemPackagesList
        };

        logInfo(`Opening build dialog for custom image: ${newCustomImageName} (based on ${selectedBaseImage})`);
        logDebug(`Custom image build configuration: Python libs: ${pythonLibsList.length}, System packages: ${systemPackagesList.length}`);
        
        setBuildOptions(options);
        setShowBuildDialog(true);
    };

    // Handle close build dialog
    const handleCloseBuildDialog = (): void => {
        setShowBuildDialog(false);

        // Reset form and refresh images
        setNewCustomImageName('');
        setPythonLibraries('');
        setSystemPackages('');
        void fetchCustomImages();
        void fetchDockerImages();
    };

    // Handle close notification
    const closeNotification = (): void => {
        setNotificationState({...notificationState, open: false});
    };

    // Show notification
    const showNotification = (message: string, severity: 'info' | 'success' | 'warning' | 'error'): void => {
        setNotificationState({
            open: true,
            message,
            severity
        });
    };

    // Toggle theme
    const handleToggleTheme = async (): Promise<void> => {
        // First save the new theme value to settings to ensure persistence
        const newMode = theme.palette.mode === 'dark' ? 'light' : 'dark';
        if (isElectron()) {
            try {
                logDebug(`Saving theme preference to settings: ${newMode}`);
                await settingsService.updateSettings({ theme: newMode });
            } catch (err) {
                logError('Error saving theme preference to settings', err);
            }
        }
        
        // Then toggle the theme mode
        logInfo(`Toggling application theme to: ${newMode}`);
        colorMode.toggleColorMode();
    };

    // Change active section
    const handleSectionChange = (sectionId: string): void => {
        setActiveSection(sectionId);
    };

    // Handle external link
    const handleExternalLink = (url: string): void => {
        logDebug(`Opening external URL: ${url}`);
        if (isElectron()) {
            const { shell } = window.require('electron');
            shell.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    // Handle email
    const handleSendEmail = (): void => {
        window.location.href = 'mailto:info@webgraphix.online';
    };

    // Render image management item for both Odoo and PostgreSQL sections
    const renderImageItem = (image: DockerImage, index: number): JSX.Element => {
        return (
            <motion.div
                key={image.name}
                custom={index}
                variants={listItemVariants}
            >
                <ListItem
                    sx={{
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        mb: 1,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        p: 2,
                    }}
                >
                    <ListItemIcon>
                        {image.installed ? (
                            <CheckIcon color="success" />
                        ) : downloadingImage === image.name ? (
                            <CircularProgress size={24} />
                        ) : (
                            <DownloadIcon color="primary" />
                        )}
                    </ListItemIcon>
                    <Box flexGrow={1}>
                        <Typography variant="body1" fontWeight={500}>
                            {image.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {image.installed ? t('installed') : t('notInstalled')} • {t('size')}: {image.size}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {image.installed ? (
                            <>
                                {updatingImage === image.name ? (
                                    <>
                                        <CircularProgress size={24} sx={{ mr: 1 }} />
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="error"
                                            startIcon={<StopIcon />}
                                            onClick={() => cancelUpdate(image.name)}
                                        >
                                            {t('cancel')}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<RefreshIcon />}
                                            onClick={() => void handleUpdateImage(image.name)}
                                        >
                                            {t('update')}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            onClick={() => handleDeleteDockerImage(image.name)}
                                        >
                                            {t('delete')}
                                        </Button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {downloadingImage === image.name ? (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="error"
                                        startIcon={<StopIcon />}
                                        onClick={() => cancelDownload(image.name)}
                                    >
                                        {t('cancel')}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() => void handleDownloadImage(image.name)}
                                    >
                                        {t('download')}
                                    </Button>
                                )}
                            </>
                        )}
                    </Box>
                </ListItem>
            </motion.div>
        );
    };

    // Render the section content based on active section
    const renderSectionContent = (): JSX.Element | null => {
        switch (activeSection) {
            case 'GENERAL':
                return (
                    <motion.div
                        key="general-section"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <Box
                            component="div"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 3,
                            }}
                        >
                            <FolderIcon sx={{ color: '#42a5f5', mr: 1.5, fontSize: 20 }} />
                            <TranslatedText
                                i18nKey="generalSettings"
                                variant="h6"
                                sx={{
                                    color: '#42a5f5',
                                    fontWeight: 500,
                                }}
                            />
                        </Box>

                        {/* Work Directory */}
                        <Box
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                p: 3,
                                mb: 3,
                                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                            }}
                        >
                            <motion.div variants={itemVariants}>
                                <TranslatedText i18nKey="workDirectory" variant="subtitle1" fontWeight="bold" gutterBottom />
                                <TranslatedText i18nKey="workDirectoryDescription" variant="body2" color="text.secondary" sx={{ mb: 2 }} />

                                <Box sx={{ mt: 1.5 }}>
                                    <TranslatedText i18nKey="workDirectory" variant="caption" sx={{ display: 'block', mb: 0.5 }} />
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            value={workDirectory}
                                            variant="outlined"
                                            inputProps={{
                                                readOnly: true
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                                                    },
                                                },
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={() => void handleOpenWorkDirectory()}
                                            startIcon={<FolderIcon />}
                                            sx={{
                                                bgcolor: theme.palette.mode === 'dark' ? '#1E88E5' : '#42a5f5',
                                                '&:hover': {
                                                    bgcolor: theme.palette.mode === 'dark' ? '#1976D2' : '#1E88E5',
                                                }
                                            }}
                                            disabled={!workDirectory}
                                        >
                                            <TranslatedText i18nKey="explore" />
                                        </Button>
                                    </Box>
                                </Box>
                            </motion.div>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                            {/* Theme Settings */}
                            <Box
                                sx={{
                                    flex: 1,
                                    bgcolor: 'background.paper',
                                    borderRadius: 2,
                                    p: 3,
                                    border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                                }}
                            >
                                <motion.div variants={itemVariants}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <PaletteIcon sx={{ mr: 1.5, fontSize: 20 }} />
                                        <TranslatedText i18nKey="applicationTheme" variant="subtitle1" fontWeight="bold" />
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <TranslatedText i18nKey={theme.palette.mode === 'dark' ? 'darkMode' : 'lightMode'} />
                                        <IconButton
                                            onClick={handleToggleTheme}
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: '50%',
                                                border: theme.palette.mode === 'dark' ? '2px solid #fff' : '2px solid #000',
                                                backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#fff',
                                                transition: 'all 0.3s ease-in-out',
                                                '&:hover': {
                                                    backgroundColor: theme.palette.mode === 'dark' ? '#444' : '#f5f5f5',
                                                }
                                            }}
                                        >
                                            <motion.div
                                                initial={{ rotate: 0 }}
                                                animate={{ rotate: 180 }}
                                                transition={{ duration: 0.5 }}
                                                key={theme.palette.mode} // This forces animation to run on mode change
                                            >
                                                <PaletteIcon sx={{ fontSize: 20 }} />
                                            </motion.div>
                                        </IconButton>
                                    </Box>
                                </motion.div>
                            </Box>

                            {/* Language Settings */}
                            <Box
                                sx={{
                                    flex: 1,
                                    bgcolor: 'background.paper',
                                    borderRadius: 2,
                                    p: 3,
                                    border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                                }}
                            >
                                <motion.div variants={itemVariants}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <LanguageIcon sx={{ mr: 1.5, fontSize: 20 }} />
                                        <TranslatedText i18nKey="language" variant="subtitle1" fontWeight="bold" />
                                    </Box>

                                    <Box>
                                        <TranslatedText i18nKey="language" variant="caption" sx={{ display: 'block', mb: 0.5 }} />
                                        <FormControl fullWidth size="small">
                                            <Select
                                                value={selectedLanguage}
                                                onChange={(e) => handleLanguageChange(e.target.value)}
                                                sx={{
                                                    height: '45px',
                                                    '& .MuiSelect-select': {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        p: 1.5,
                                                        pl: 2,
                                                    },
                                                    border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)',
                                                    borderRadius: 1,
                                                }}
                                                variant="standard"
                                                disableUnderline
                                            >
                                                <MenuItem value="en">
                                                    <TranslatedText i18nKey="english" />
                                                </MenuItem>
                                                <MenuItem value="es">
                                                    <TranslatedText i18nKey="spanish" />
                                                </MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Box>
                                </motion.div>
                            </Box>
                        </Box>

                    </motion.div>
                );

            case 'IMAGES':
                return (
                    <motion.div
                        key="images-section"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <Box
                            component="div"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 3,
                            }}
                        >
                            <StorageIcon sx={{ color: '#42a5f5', mr: 1.5, fontSize: 20 }} />
                            <TranslatedText
                                i18nKey="imagesManager"
                                variant="h6"
                                sx={{
                                    color: '#42a5f5',
                                    fontWeight: 500,
                                }}
                            />
                        </Box>

                        {loadingImages && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                                <CircularProgress />
                            </Box>
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        {!loadingImages && (
                            <>
                                {/* Odoo Images */}
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        p: 3,
                                        mb: 3,
                                        border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                                    }}
                                >
                                    <motion.div variants={itemVariants}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <TranslatedText i18nKey="odooImages" variant="subtitle1" fontWeight="bold" />
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<RefreshIcon />}
                                                onClick={() => void fetchDockerImages()}
                                            >
                                                <TranslatedText i18nKey="refresh" />
                                            </Button>
                                        </Box>
                                        <TranslatedText i18nKey="manageOdooImages" variant="body2" color="text.secondary" sx={{ mb: 2 }} />

                                        {dockerImages.filter(img => img.name.startsWith('odoo:')).length === 0 ? (
                                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                                <TranslatedText i18nKey="noOdooImages" color="text.secondary" />
                                            </Box>
                                        ) : (
                                            <List sx={{ width: '100%' }}>
                                                {dockerImages
                                                    .filter(img => img.name.startsWith('odoo:'))
                                                    .map((image, index) => renderImageItem(image, index))}
                                            </List>
                                        )}
                                    </motion.div>
                                </Box>

                                {/* PostgreSQL Images */}
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        p: 3,
                                        mb: 4, // Add extra bottom margin
                                        border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                                    }}
                                >
                                    <motion.div variants={itemVariants}>
                                        <TranslatedText i18nKey="postgresqlImages" variant="subtitle1" fontWeight="bold" gutterBottom />
                                        <TranslatedText i18nKey="managePostgresImages" variant="body2" color="text.secondary" sx={{ mb: 2 }} />

                                        {dockerImages.filter(img => img.name.startsWith('postgres:')).length === 0 ? (
                                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography color="text.secondary">
                                                    {t('noPostgresImages')}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <List sx={{ width: '100%' }}>
                                                {dockerImages
                                                    .filter(img => img.name.startsWith('postgres:'))
                                                    .map((image, index) => renderImageItem(image, index))}
                                            </List>
                                        )}
                                    </motion.div>
                                </Box>
                            </>
                        )}
                    </motion.div>
                );

            case 'CUSTOM_IMAGES':
                return (
                    <motion.div
                        key="custom-images-section"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <Box
                            component="div"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 3,
                            }}
                        >
                            <BuildIcon sx={{ color: '#42a5f5', mr: 1.5, fontSize: 20 }} />
                            <TranslatedText
                                i18nKey="customImageBuilder"
                                variant="h6"
                                sx={{
                                    color: '#42a5f5',
                                    fontWeight: 500,
                                }}
                            />
                        </Box>

                        {loadingImages && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                                <CircularProgress />
                            </Box>
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        {!loadingImages && (
                            <>
                                {/* Build Custom Image */}
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        p: 3,
                                        mb: 3,
                                        border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                                    }}
                                >
                                    <motion.div variants={itemVariants}>
                                        <TranslatedText i18nKey="buildCustomOdooImage" variant="subtitle1" fontWeight="bold" gutterBottom />
                                        <TranslatedText i18nKey="createCustomOdooImageDescription" variant="body2" color="text.secondary" sx={{ mb: 2 }} />

                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth sx={{ mb: 2 }}>
                                                    <InputLabel
                                                        id="base-odoo-version-label"
                                                        sx={{
                                                            transform: 'translate(14px, 9px) scale(1)', // Adjust label position
                                                            '&.Mui-focused, &.MuiFormLabel-filled': {
                                                                transform: 'translate(14px, -9px) scale(0.75)',
                                                            }
                                                        }}
                                                    >
                                                        {t('baseOdooVersion')}
                                                    </InputLabel>
                                                    <Select
                                                        labelId="base-odoo-version-label"
                                                        id="base-odoo-version"
                                                        value={selectedBaseImage}
                                                        onChange={(e) => setSelectedBaseImage(e.target.value)}
                                                        label="Base Odoo Version"
                                                        size="small"
                                                        sx={{
                                                            height: '40px', // Fix the height
                                                            '& .MuiSelect-select': {
                                                                display: 'flex',
                                                                alignItems: 'center', // Vertical centering
                                                                minHeight: '0px !important', // Override any minimum height
                                                                paddingTop: '0 !important',
                                                                paddingBottom: '0 !important',
                                                                width: '150px',
                                                                height: '40px'
                                                            },
                                                            '& .MuiOutlinedInput-notchedOutline': {
                                                                // Ensure proper outline
                                                                borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
                                                            }
                                                        }}
                                                    >
                                                        {/* Only show installed Odoo images */}
                                                        {dockerImages
                                                            .filter(img => img.name.startsWith('odoo:') && img.installed)
                                                            .map(image => (
                                                                <MenuItem key={image.name} value={image.name.split(':')[1]}>
                                                                    {image.name}
                                                                </MenuItem>
                                                            ))}
                                                        {dockerImages.filter(img => img.name.startsWith('odoo:') && img.installed).length === 0 && (
                                                            <MenuItem disabled value="">
                                                                {t('noOdooImagesFound')}
                                                            </MenuItem>
                                                        )}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <TextField
                                                    fullWidth
                                                    label={t('imageName')}
                                                    value={newCustomImageName}
                                                    onChange={(e) => {
                                                        setNewCustomImageName(e.target.value);
                                                        // Clear error when typing
                                                        if (nameError) setNameError('');
                                                    }}
                                                    onBlur={() => void validateImageName(newCustomImageName)}
                                                    size="small"
                                                    error={!!nameError}
                                                    helperText={nameError || t('useUniqueName')}
                                                    sx={{ mb: 2 }}
                                                />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    mb: 3
                                                }}>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {t('pythonLibrariesOneLine')}
                                                    </Typography>
                                                    <Tooltip title={t('specifyVersionConstraints')}>
                                                        <IconButton size="small">
                                                            <HelpIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={4}
                                                    value={pythonLibraries}
                                                    onChange={(e) => setPythonLibraries(e.target.value)}
                                                    size="small"
                                                    sx={{ mb: 1 }}
                                                    placeholder="pandas==1.3.5
numpy==1.21.5
xlsxwriter==3.0.3"
                                                />
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('packageVersionsRecommendation')}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    mb: 1
                                                }}>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {t('systemPackagesOneLine')}
                                                    </Typography>
                                                    <Tooltip title={t('useAptPackageNames')}>
                                                        <IconButton size="small">
                                                            <HelpIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={4}
                                                    value={systemPackages}
                                                    onChange={(e) => setSystemPackages(e.target.value)}
                                                    size="small"
                                                    sx={{ mb: 1 }}
                                                    placeholder="curl
wget
libxml2-dev
libxslt1-dev
libldap2-dev
libsasl2-dev"
                                                />
                                                <Typography variant="caption" color="text.secondary">
                                                    {t('systemPackagesRecommendation')}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                                                    <Button
                                                        variant="contained"
                                                        startIcon={<BuildIcon />}
                                                        color="primary"
                                                        onClick={() => void handleBuildImage()}
                                                        disabled={!selectedBaseImage || !newCustomImageName || !!nameError}
                                                    >
                                                        {t('buildImage')}
                                                    </Button>
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => {
                                                            setNewCustomImageName('');
                                                            setSelectedBaseImage('');
                                                            setPythonLibraries('');
                                                            setSystemPackages('');
                                                            setNameError('');
                                                        }}
                                                    >
                                                        {t('resetForm')}
                                                    </Button>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </motion.div>
                                </Box>

                                {/* Custom Images List */}
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        borderRadius: 2,
                                        p: 3,
                                        mb: 4, // Add extra bottom margin
                                        border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                                    }}
                                >
                                    <motion.div variants={itemVariants}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {t('yourCustomImages')}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<RefreshIcon />}
                                                onClick={() => void fetchCustomImages()}
                                            >
                                                {t('refresh')}
                                            </Button>
                                        </Box>

                                        {customImages.length === 0 ? (
                                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                                <Typography color="text.secondary">
                                                    {t('noCustomImages')}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <List sx={{ width: '100%' }}>
                                                {customImages.map((image, index) => (
                                                    <motion.div
                                                        key={image.id}
                                                        custom={index}
                                                        variants={listItemVariants}
                                                    >
                                                        <ListItem
                                                            sx={{
                                                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                                                mb: 1,
                                                                borderRadius: 1,
                                                                border: `1px solid ${theme.palette.divider}`,
                                                                p: 2,
                                                            }}
                                                        >
                                                            <ListItemIcon>
                                                                <BuildIcon color="primary" />
                                                            </ListItemIcon>
                                                            <Box flexGrow={1}>
                                                                <Typography variant="body1" fontWeight={500}>
                                                                    {image.name}
                                                                </Typography>
                                                                <Typography variant="body2" marginRight='20px' color="text.secondary">
                                                                    {t('baseOdoo')} {image.baseVersion} •
                                                                    {t('created')}: {new Date(image.createdAt).toLocaleDateString()} •
                                                                    {t('pythonLibraries')}: {image.pythonLibraries.length} •
                                                                    {t('systemPackages')}: {image.systemPackages.length}
                                                                </Typography>
                                                            </Box>
                                                            <Box>
                                                                <Button
                                                                    color="error"
                                                                    variant="outlined"
                                                                    size="small"
                                                                    startIcon={<DeleteIcon />}
                                                                    onClick={() => handleDeleteCustomImage(image)}
                                                                >
                                                                    {t('delete')}
                                                                </Button>
                                                            </Box>
                                                        </ListItem>
                                                    </motion.div>
                                                ))}
                                            </List>
                                        )}
                                    </motion.div>
                                </Box>
                            </>
                        )}
                    </motion.div>
                );

            case 'UPDATES':
                return (
                    <motion.div
                        key="updates-section"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <Box
                            component="div"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 3,
                            }}
                        >
                            <UpdateIcon sx={{ color: '#42a5f5', mr: 1.5, fontSize: 20 }} />
                            <Typography
                                variant="h6"
                                sx={{
                                    color: '#42a5f5',
                                    fontWeight: 500,
                                }}
                            >
                                {t('updatesTitle')}
                            </Typography>
                        </Box>

                        {/* Update Section */}
                        <Box
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                p: 3,
                                mb: 4,
                                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                            }}
                        >
                            <Suspense fallback={<CircularProgress />}>
                                {
                                    (() => {
                                        const UpdateSection = lazy(() => import('./UpdateSection'));
                                        return <UpdateSection itemVariants={itemVariants} />;
                                    })()
                                }
                            </Suspense>
                        </Box>
                    </motion.div>
                );

            case 'ABOUT':
                return (
                    <motion.div
                        key="about-section"
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <Box
                            component="div"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 3,
                            }}
                        >
                            <InfoIcon sx={{ color: '#42a5f5', mr: 1.5, fontSize: 20 }} />
                            <Typography
                                variant="h6"
                                sx={{
                                    color: '#42a5f5',
                                    fontWeight: 500,
                                }}
                            >
                                {t('aboutTitle')}
                            </Typography>
                        </Box>

                        {/* About Application Section */}
                        <Box
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                p: 3,
                                mb: 3,
                                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                            }}
                        >
                            <motion.div variants={itemVariants}>
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    mb: 3,
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}>
                                    <img
                                        src={odooLogo}
                                        alt="Odoo Manager Logo"
                                        style={{
                                            width: 100,
                                            marginBottom: 16,
                                        }}
                                    />
                                    <Typography variant="h5" align="center" fontWeight="bold" gutterBottom>
                                        Odoo Manager
                                    </Typography>
                                    <Typography variant="body1" align="center" sx={{ mb: 1 }}>
                                        {t('aboutSubtitle')}
                                    </Typography>
                                    <Typography variant="subtitle2" align="center" color="text.secondary">
                                        Version {appVersion}
                                    </Typography>
                                </Box>

                                <Grid container spacing={3} sx={{ mb: 3 }}>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                            {t('appOverview')}
                                        </Typography>
                                        <Typography variant="body2" paragraph>
                                            {t('appOverviewText1')}
                                        </Typography>
                                        <Typography variant="body2">
                                            {t('appOverviewText2')}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                            {t('keyFeatures')}
                                        </Typography>
                                        <Box component="ul" sx={{ pl: 2, mt: 0 }}>
                                            <Box component="li"><Typography variant="body2">{t('featureOneClickCreation')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featureCustomDocker')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featureContainerManagement')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featurePostgresql')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featureModuleMounting')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featureRealtime')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featureMultiLanguage')}</Typography></Box>
                                            <Box component="li"><Typography variant="body2">{t('featureThemes')}</Typography></Box>
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    {t('developmentTeam')}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    {t('developmentTeamDesc')}
                                </Typography>

                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        {t('connectWithUs')}
                                    </Typography>
                                    <Grid container spacing={2} sx={{ mt: 1 }}>
                                        <Grid item xs={12} sm={6} md={4}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<OpenInNewIcon />}
                                                onClick={() => handleExternalLink('https://www.webgraphix.online')}
                                            >
                                                {t('website')}
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={4}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<InstagramIcon />}
                                                onClick={() => handleExternalLink('https://www.instagram.com/webgraphix.online')}
                                                sx={{
                                                    '&:hover': {
                                                        bgcolor: alpha('#E1306C', 0.1),
                                                    }
                                                }}
                                            >
                                                {t('instagram')}
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={4}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<FacebookIcon />}
                                                onClick={() => handleExternalLink('https://www.facebook.com/webgraphix.online')}
                                                sx={{
                                                    '&:hover': {
                                                        bgcolor: alpha('#1877F2', 0.1),
                                                    }
                                                }}
                                            >
                                                {t('facebook')}
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={6}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<EmailIcon />}
                                                onClick={handleSendEmail}
                                            >
                                                {t('emailUs')}
                                            </Button>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={6}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<GitHubIcon />}
                                                onClick={() => handleExternalLink('https://github.com/danielmederos2424/odoo-manager')}
                                                sx={{
                                                    '&:hover': {
                                                        bgcolor: alpha('#333', 0.1),
                                                    }
                                                }}
                                            >
                                                {t('contribute')}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </motion.div>
                        </Box>

                        {/* Documentation */}
                        <Box
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                p: 3,
                                mb: 3,
                                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                            }}
                        >
                            <motion.div variants={itemVariants}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    {t('documentationSupport')}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    {t('documentationSupportDesc')}
                                </Typography>
                                
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            startIcon={<HelpIcon />}
                                            onClick={() => handleExternalLink('https://docs.webgraphix.online/odoo-manager')}
                                        >
                                            {t('documentation')}
                                        </Button>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            startIcon={<OpenInNewIcon />}
                                            onClick={() => handleExternalLink('https://github.com/danielmederos2424/odoo-manager/issues')}
                                        >
                                            {t('reportIssue')}
                                        </Button>
                                    </Grid>
                                </Grid>
                            </motion.div>
                        </Box>

                        {/* License Section */}
                        <Box
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                p: 3,
                                mb: 4, // Add extra bottom margin
                                border: theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                            }}
                        >
                            <motion.div variants={itemVariants}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    {t('license')}
                                </Typography>
                                <Typography variant="body2" paragraph>
                                    {t('licenseDesc')}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    {t('copyright')}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    onClick={() => handleExternalLink('https://github.com/danielmederos2424/odoo-manager/blob/main/LICENSE')}
                                >
                                    {t('viewFullLicense')}
                                </Button>
                            </motion.div>
                        </Box>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <Container
            maxWidth={false}
            disableGutters
            sx={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    borderRadius: 0,
                    bgcolor: theme.palette.mode === 'dark' ? '#121212' : '#fff',
                    transition: 'background-color 0.5s ease, color 0.5s ease',
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        bgcolor: '#42a5f5',
                        p: 3,
                        color: 'white',
                        backgroundImage: 'linear-gradient(135deg, #42a5f5, #1976d2)',
                    }}
                >
                    <TranslatedText i18nKey="settingsTitle" variant="h4" fontWeight="500" />
                    <TranslatedText i18nKey="configureOdooManager" variant="subtitle1" />
                </Box>

                {/* Content area */}
                <Box
                    sx={{
                        display: 'flex',
                        flexGrow: 1,
                        overflow: 'hidden',
                    }}
                >
                    {/* Left navigation */}
                    <Box
                        sx={{
                            width: 230,
                            minWidth: 230, // Ensure minimum width is maintained
                            flexShrink: 0, // Prevent sidebar from shrinking
                            borderRight: 1,
                            borderColor: 'divider',
                            bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
                            pt: 3, // Added proper top margin
                            transition: 'background-color 0.5s ease',
                        }}
                    >
                        {sections.map((section) => (
                            <Box
                                key={section.id}
                                onClick={() => handleSectionChange(section.id)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    py: 1.7,
                                    px: 3,
                                    cursor: 'pointer',
                                    color: activeSection === section.id
                                        ? theme.palette.primary.main
                                        : theme.palette.text.primary,
                                    borderLeft: activeSection === section.id
                                        ? `4px solid ${theme.palette.primary.main}`
                                        : '4px solid transparent',
                                    bgcolor: activeSection === section.id
                                        ? theme.palette.mode === 'dark'
                                            ? 'rgba(25, 118, 210, 0.15)'
                                            : 'rgba(25, 118, 210, 0.08)'
                                        : 'transparent',
                                    '&:hover': {
                                        bgcolor: theme.palette.mode === 'dark'
                                            ? 'rgba(255, 255, 255, 0.05)'
                                            : 'rgba(0, 0, 0, 0.02)',
                                    },
                                    transition: 'background-color 0.2s ease',
                                }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 24,
                                        height: 24,
                                        mr: 2,
                                    }}
                                >
                                    {section.icon}
                                </Box>
                                <TranslatedText
                                    i18nKey={section.id.toLowerCase()}
                                    sx={{
                                        fontSize: '0.875rem',
                                        fontWeight: activeSection === section.id ? 600 : 400,
                                        whiteSpace: 'pre-line',
                                    }}
                                />
                            </Box>
                        ))}
                    </Box>

                    {/* Right content */}
                    <Box
                        sx={{
                            flexGrow: 1,
                            p: 3,
                            overflowY: 'auto',
                            bgcolor: theme.palette.mode === 'dark' ? '#121212' : '#fff',
                            pb: 6, // Added proper bottom margin
                            position: 'relative', // For proper animation positioning
                            transition: 'background-color 0.5s ease',
                        }}
                    >
                        <AnimatePresence mode="wait">
                            {renderSectionContent()}
                        </AnimatePresence>
                    </Box>
                </Box>
            </Paper>

            {/* Delete custom image confirmation dialog */}
            <Dialog
                open={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-description"
            >
                <DialogTitle id="delete-dialog-title">
                    <TranslatedText i18nKey="deleteCustomImage" />
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-dialog-description">
                        {t("confirmDeleteImage", { name: imageToDelete?.name })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowDeleteDialog(false)}>
                        <TranslatedText i18nKey="cancel" />
                    </Button>
                    <Button onClick={() => void confirmDeleteImage()} color="error" autoFocus>
                        <TranslatedText i18nKey="delete" />
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Docker image confirmation dialog */}
            <Dialog
                open={showDeleteDockerDialog}
                onClose={() => setShowDeleteDockerDialog(false)}
                aria-labelledby="delete-docker-dialog-title"
                aria-describedby="delete-docker-dialog-description"
            >
                <DialogTitle id="delete-docker-dialog-title">
                    <TranslatedText i18nKey="deleteDockerImage" />
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-docker-dialog-description">
                        {t("confirmDeleteDockerImage", { name: dockerImageToDelete })}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowDeleteDockerDialog(false)}>
                        <TranslatedText i18nKey="cancel" />
                    </Button>
                    <Button onClick={() => void confirmDeleteDockerImage()} color="error" autoFocus>
                        <TranslatedText i18nKey="delete" />
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Build image dialog */}
            {showBuildDialog && buildOptions && (
                <ImageBuildDialog
                    open={showBuildDialog}
                    onClose={handleCloseBuildDialog}
                    buildOptions={buildOptions}
                />
            )}

            {/* Notification dialog */}
            <Dialog
                open={notificationState.open}
                onClose={closeNotification}
                aria-labelledby="notification-dialog-title"
            >
                <Alert
                    severity={notificationState.severity}
                    onClose={closeNotification}
                    sx={{ minWidth: 300 }}
                >
                    {notificationState.message}
                </Alert>
            </Dialog>
        </Container>
    );
};

export default SettingsScreen;