import React, { useState, useEffect } from 'react';
import { Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
    Typography,
    Button,
    Box,
    Container,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    SelectChangeEvent,
    Alert,
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    InputAdornment,
    Tooltip,
    IconButton,
    Snackbar,
    Checkbox,
    FormHelperText,
    Divider,
    Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowBack as BackIcon,
    Check as CheckIcon,
    Info as InfoIcon,
    Refresh as RefreshIcon,
    Code as OdooIcon
} from '@mui/icons-material';
import { getElectronAPI, isElectron } from '../../utils/electron';
import dockerImagesService, { DockerImage } from '../../services/docker/dockerImagesService';
import customImagesService, { CustomImage } from '../../services/docker/customImagesService';
import { isPortAvailable, findAvailablePort } from '../../utils/portUtils';
import { containerNameExists } from '../../utils/dockerUtils';
import { logError, logInfo, logWarn } from '../../services/utils/logger';

const stepVariants = {
    enter: (direction: number) => {
        return {
            x: direction > 0 ? 100 : -100,
            opacity: 0
        };
    },
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: number) => {
        return {
            x: direction < 0 ? 100 : -100,
            opacity: 0
        };
    }
};

interface PostgresInstance {
    name: string;
    status: string;
    linkedCount: number;
    maxLinkedInstances: number;
    port?: string;
    username?: string;
    password?: string;
}

interface OdooFormData {
    version: string;
    edition: 'Community' | 'Enterprise';
    instanceName: string;
    port: string;
    adminPassword: string;
    dbFilter: boolean;
    customImage: boolean;
    customImageName: string;
    postgresInstance: string;
}

interface SnackbarState {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
}

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
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    }
};

const NewInstanceScreen: React.FC = () => {
    const { t } = useTranslation();
    const [activeStep, setActiveStep] = useState(0);
    const [direction, setDirection] = useState(0);
    
    const steps = [
        t('selectOdooVersion'), 
        t('configureOdooInstance'), 
        t('createInstance')
    ];

    const [formData, setFormData] = useState<OdooFormData>({
        version: '18',
        edition: 'Community',
        instanceName: '',
        port: '8069',
        adminPassword: '',
        dbFilter: false,
        customImage: false,
        customImageName: '',
        postgresInstance: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [availableImages, setAvailableImages] = useState<DockerImage[]>([]);
    const [customImages, setCustomImages] = useState<CustomImage[]>([]);
    const [postgresInstances, setPostgresInstances] = useState<PostgresInstance[]>([]);
    const [creatingInstance, setCreatingInstance] = useState(false);
    const [portsLoading, setPortsLoading] = useState(false);
    const [nameLoading, setNameLoading] = useState(false);

    const [errors, setErrors] = useState<{
        version?: string;
        instanceName?: string;
        port?: string;
        adminPassword?: string;
        postgresInstance?: string;
        general?: string;
    }>({});
    const [portAvailable, setPortAvailable] = useState<boolean | null>(null);
    const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
    const [downloadingImage, setDownloadingImage] = useState<string | null>(null);

    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'info'
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                logInfo('Loading initial Odoo instance data');
                
                const images = await dockerImagesService.getImages();
                const odooImages = images.filter(img => img.name.startsWith('odoo:'));
                setAvailableImages(odooImages);

                const customImgs = await customImagesService.getCustomImages();
                const odooCustomImages = customImgs.filter(img => img.built && img.imageName === 'odoo-custom');
                setCustomImages(odooCustomImages);

                await checkPortAvailability('8069');
                await fetchPostgresInstances();
                
                logInfo('Initial Odoo instance data loaded successfully');
            } catch (error) {
                logError('Error loading initial Odoo instance data', error);
                setSnackbar({
                    open: true,
                    message: t('failedToLoadData'),
                    severity: 'error'
                });
            }
        };

        loadData();
    }, [t]);

    const fetchPostgresInstances = async () => {
        if (!isElectron()) {
            setPostgresInstances([
                { name: 'postgres_13_main', status: 'Up 2 hours', linkedCount: 2, maxLinkedInstances: 4 },
                { name: 'postgres_15_dev', status: 'Up 3 hours', linkedCount: 0, maxLinkedInstances: 4 }
            ]);
            return;
        }

        try {
            const electron = getElectronAPI();
            const containers = await electron.ipcRenderer.invoke('docker-operation', {
                operation: 'list-instances',
                params: {}
            });

            const postgresContainers = containers.filter(c =>
                c.name.includes('postgres') || (c.info && c.info.type === 'postgres')
            );

            const odooContainers = containers.filter(c =>
                c.name.includes('odoo') || (c.info && c.info.type === 'odoo')
            );

            const processedInstances: PostgresInstance[] = postgresContainers.map(pg => {
                const linkedCount = odooContainers.filter(odoo =>
                    odoo.info && odoo.info.postgresInstance === pg.name
                ).length;

                return {
                    name: pg.name,
                    status: pg.status,
                    linkedCount,
                    maxLinkedInstances: 4,
                    port: pg.info?.port?.toString(),
                    username: pg.info?.username,
                    password: pg.info?.password
                };
            });

            setPostgresInstances(processedInstances);
            logInfo(`Found ${processedInstances.length} PostgreSQL instances`);
        } catch (error) {
            logError('Error fetching PostgreSQL instances', error);
            setPostgresInstances([]);
        }
    };

    const isVersionInstalled = (version: string): boolean => {
        if (formData.customImage && formData.customImageName) {
            return customImages.some(img => img.imageTag === formData.customImageName);
        }

        return availableImages.some(img => img.name === `odoo:${version}` && img.installed);
    };

    const checkPortAvailability = async (portStr: string) => {
        const port = parseInt(portStr, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
            setPortAvailable(false);
            return false;
        }

        setPortsLoading(true);

        try {
            const { ipcRenderer } = getElectronAPI() || {};
            if (ipcRenderer) {
                const available = await ipcRenderer.invoke('test-port-availability', port);
                setPortAvailable(available);
                return available;
            } else {
                const available = await isPortAvailable(port);
                setPortAvailable(available);
                return available;
            }
        } catch (error) {
            logError('Error checking port availability', error);
            setPortAvailable(false);
            return false;
        } finally {
            setPortsLoading(false);
        }
    };

    const checkNameAvailability = async (name: string) => {
        const fullName = `odoo_${formData.version}_${formData.edition}_${name}`;
        setNameLoading(true);

        try {
            const exists = await containerNameExists(fullName);
            setNameAvailable(!exists);
            return !exists;
        } catch (error) {
            logError('Error checking name availability', error);
            setNameAvailable(false);
            return false;
        } finally {
            setNameLoading(false);
        }
    };

    const handleFindAvailablePort = async () => {
        setPortsLoading(true);
        try {
            const basePort = parseInt(formData.port, 10) || 8069;

            const { ipcRenderer } = getElectronAPI() || {};
            let nextPort = null;

            if (ipcRenderer) {
                for (let testPort = basePort; testPort < basePort + 20; testPort++) {
                    const available = await ipcRenderer.invoke('test-port-availability', testPort);
                    if (available) {
                        nextPort = testPort;
                        break;
                    }
                }
            } else {
                nextPort = await findAvailablePort(basePort);
            }

            if (nextPort) {
                setFormData(prev => ({
                    ...prev,
                    port: nextPort.toString()
                }));
                setPortAvailable(true);
                logInfo(`Found available port: ${nextPort}`);
            } else {
                setErrors(prev => ({
                    ...prev,
                    port: 'No available ports found after multiple attempts'
                }));
                setPortAvailable(false);
                logWarn('No available ports found after multiple attempts');
            }
        } catch (error) {
            logError('Error finding available port', error);
            setErrors(prev => ({
                ...prev,
                port: 'Error finding available port'
            }));
            setPortAvailable(false);
        } finally {
            setPortsLoading(false);
        }
    };

    const handlePullImage = async (version: string) => {
        setDownloadingImage(`odoo:${version}`);
        setSnackbar({
            open: true,
            message: t('downloadingOdoo', { version }),
            severity: 'info'
        });
        
        logInfo(`Starting Odoo ${version} image download`);

        try {
            const success = await dockerImagesService.pullImage(`odoo:${version}`);

            if (success) {
                logInfo(`Successfully downloaded Odoo ${version} image`);
                setSnackbar({
                    open: true,
                    message: t('odooDownloaded', { version }),
                    severity: 'success'
                });

                const images = await dockerImagesService.getImages();
                const odooImages = images.filter(img => img.name.startsWith('odoo:'));
                setAvailableImages(odooImages);

                setFormData(prev => ({
                    ...prev,
                    version
                }));
            } else {
                logError(`Failed to download Odoo ${version} image`);
                setSnackbar({
                    open: true,
                    message: t('failedToDownload', { version }),
                    severity: 'error'
                });
            }
        } catch (error) {
            logError(`Error downloading Odoo ${version} image`, error);
            setSnackbar({
                open: true,
                message: `Error downloading Odoo ${version}: ${error.message}`,
                severity: 'error'
            });
        } finally {
            setDownloadingImage(null);
        }
    };

    const handleVersionChange = (event: SelectChangeEvent) => {
        const newVersion = event.target.value;
        setFormData(prev => ({
            ...prev,
            version: newVersion
        }));

        if (errors.version) {
            setErrors(prev => ({ ...prev, version: undefined }));
        }
    };

    const handleEditionChange = (event: SelectChangeEvent) => {
        const newEdition = event.target.value as 'Community' | 'Enterprise';
        setFormData(prev => ({
            ...prev,
            edition: newEdition
        }));
    };

    const handleCustomImageToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        const useCustomImage = event.target.checked;
        setFormData(prev => ({
            ...prev,
            customImage: useCustomImage,
            customImageName: useCustomImage ? (customImages.length > 0 ? customImages[0].imageTag : '') : ''
        }));
    };

    const handleCustomImageChange = (event: SelectChangeEvent) => {
        const newCustomImage = event.target.value;
        setFormData(prev => ({
            ...prev,
            customImageName: newCustomImage
        }));
    };

    const handleInstanceNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newName = event.target.value;
        setFormData(prev => ({
            ...prev,
            instanceName: newName
        }));

        checkNameAvailability(newName);

        if (errors.instanceName) {
            setErrors(prev => ({ ...prev, instanceName: undefined }));
        }
    };

    const handlePortChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newPort = event.target.value;
        setFormData(prev => ({
            ...prev,
            port: newPort
        }));

        const timer = setTimeout(() => {
            checkPortAvailability(newPort);
        }, 500);

        if (errors.port) {
            setErrors(prev => ({ ...prev, port: undefined }));
        }

        return () => clearTimeout(timer);
    };

    const handleAdminPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = event.target.value;
        setFormData(prev => ({
            ...prev,
            adminPassword: newPassword
        }));

        if (newPassword.length > 0) {
            const hasLetters = /[a-zA-Z]/.test(newPassword);
            const hasNumbers = /[0-9]/.test(newPassword);
            const isValid = newPassword.length >= 8 && hasLetters && hasNumbers;

            if (!isValid) {
                setErrors(prev => ({
                    ...prev,
                    adminPassword: 'Password must be at least 8 characters with both letters and numbers'
                }));
            } else {
                setErrors(prev => ({ ...prev, adminPassword: undefined }));
            }
        } else {
            setErrors(prev => ({ ...prev, adminPassword: undefined }));
        }
    };

    const handleDbFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            dbFilter: event.target.checked
        }));
    };

    const handlePostgresInstanceChange = (event: SelectChangeEvent) => {
        const selectedInstance = event.target.value;
        setFormData(prev => ({
            ...prev,
            postgresInstance: selectedInstance
        }));

        if (errors.postgresInstance) {
            setErrors(prev => ({ ...prev, postgresInstance: undefined }));
        }
    };

    const handleNext = async () => {
        if (activeStep === 0) {
            if (!formData.version) {
                setErrors(prev => ({
                    ...prev,
                    version: 'Please select an Odoo version'
                }));
                return;
            }

            if (!formData.customImage && !isVersionInstalled(formData.version)) {
                setErrors(prev => ({
                    ...prev,
                    version: 'This Odoo version is not installed. Please install it first.'
                }));
                return;
            }

            if (formData.customImage && !formData.customImageName) {
                setErrors(prev => ({
                    ...prev,
                    version: 'Please select a custom Odoo image'
                }));
                return;
            }
        } else if (activeStep === 1) {
            if (postgresInstances.length === 0) {
                setErrors(prev => ({
                    ...prev,
                    postgresInstance: 'No PostgreSQL instances available. Please create one first.'
                }));
                return;
            }

            if (!formData.postgresInstance) {
                setErrors(prev => ({
                    ...prev,
                    postgresInstance: 'Please select a PostgreSQL instance'
                }));
                return;
            }

            const selectedPg = postgresInstances.find(pg => pg.name === formData.postgresInstance);
            if (selectedPg && selectedPg.linkedCount >= selectedPg.maxLinkedInstances) {
                setErrors(prev => ({
                    ...prev,
                    postgresInstance: `This PostgreSQL instance already has ${selectedPg.maxLinkedInstances} Odoo instances linked to it`
                }));
                return;
            }

            if (!formData.instanceName.trim()) {
                setErrors(prev => ({
                    ...prev,
                    instanceName: 'Instance name is required'
                }));
                return;
            }

            const validName = await checkNameAvailability(formData.instanceName);
            if (!validName) {
                setErrors(prev => ({
                    ...prev,
                    instanceName: 'This container name already exists'
                }));
                return;
            }

            const port = parseInt(formData.port, 10);
            if (isNaN(port) || port < 1024 || port > 65535) {
                setErrors(prev => ({
                    ...prev,
                    port: 'Port must be a number between 1024 and 65535'
                }));
                return;
            }

            const validPort = await checkPortAvailability(formData.port);
            if (!validPort) {
                setErrors(prev => ({
                    ...prev,
                    port: 'This port is not available'
                }));
                return;
            }

            if (!formData.adminPassword) {
                setErrors(prev => ({
                    ...prev,
                    adminPassword: 'Admin password is required'
                }));
                return;
            }

            const hasLetters = /[a-zA-Z]/.test(formData.adminPassword);
            const hasNumbers = /[0-9]/.test(formData.adminPassword);
            if (formData.adminPassword.length < 8 || !hasLetters || !hasNumbers) {
                setErrors(prev => ({
                    ...prev,
                    adminPassword: 'Password must be at least 8 characters with both letters and numbers'
                }));
                return;
            }
        }

        setErrors({});
        setDirection(1);
        setActiveStep(prev => prev + 1);
        logInfo(`Moving to step ${activeStep + 1} in Odoo instance creation`);
    };

    const handleBack = () => {
        setDirection(-1);
        setActiveStep(prev => prev - 1);
    };

    const handleClose = () => {
        window.close();
    };

    const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar({...snackbar, open: false});
    };

    const handleSubmit = () => {
        if (!formData.instanceName.trim()) {
            setErrors(prev => ({
                ...prev,
                instanceName: 'Instance name is required'
            }));
            return;
        }

        if (!formData.adminPassword) {
            setErrors(prev => ({
                ...prev,
                adminPassword: 'Admin password is required'
            }));
            return;
        }

        if (!formData.postgresInstance) {
            setErrors(prev => ({
                ...prev,
                postgresInstance: 'PostgreSQL instance is required'
            }));
            return;
        }

        const port = parseInt(formData.port, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
            setErrors(prev => ({
                ...prev,
                port: 'Port must be a number between 1024 and 65535'
            }));
            return;
        }

        const selectedPg = postgresInstances.find(pg => pg.name === formData.postgresInstance);
        if (!selectedPg) {
            setErrors(prev => ({
                ...prev,
                postgresInstance: 'Selected PostgreSQL instance not found'
            }));
            return;
        }

        setCreatingInstance(true);

        const containerName = `odoo_${formData.version}_${formData.edition}_${formData.instanceName}`;
        logInfo(`Creating Odoo instance: ${containerName} (${formData.version} ${formData.edition}) on port ${port}`);

        const electron = getElectronAPI();
        if (electron) {
            electron.ipcRenderer.send('create-instance', {
                instanceType: 'odoo',
                version: formData.version,
                edition: formData.edition,
                instanceName: containerName,
                adminPassword: formData.adminPassword,
                dbFilter: formData.dbFilter,
                port: port,
                postgresInstance: formData.postgresInstance,
                customImage: formData.customImage,
                customImageName: formData.customImageName,
                pgHost: formData.postgresInstance,
                pgPort: selectedPg.port || '5432',
                pgUser: selectedPg.username || 'postgres',
                pgPassword: selectedPg.password || 'postgres'
            });

            const creationSuccessHandler = (_event, data) => {
                if (data.instanceType === 'odoo') {
                    setCreatingInstance(false);

                    const actualPort = data.port || port;
                    const originalPort = port.toString();
                    let message = t('instanceCreatedWithPort', { 
                        version: formData.version, 
                        edition: formData.edition, 
                        port: actualPort 
                    });

                    if (actualPort.toString() !== originalPort) {
                        message = t('instanceCreatedWithPortChange', { 
                            version: formData.version, 
                            edition: formData.edition, 
                            original: originalPort, 
                            new: actualPort 
                        });
                    }

                    logInfo(`Odoo instance created successfully: ${containerName} on port ${actualPort}`);
                    setSnackbar({
                        open: true,
                        message: message,
                        severity: 'success'
                    });

                    setTimeout(() => window.close(), 2000);
                }
            };

            const creationErrorHandler = (_event, data) => {
                if (data.instanceType === 'odoo') {
                    setCreatingInstance(false);
                    logError(`Error creating Odoo instance: ${data.error}`);
                    
                    setSnackbar({
                        open: true,
                        message: t('errorCreatingInstance', { error: data.error }),
                        severity: 'error'
                    });
                }
            };

            const timeoutHandler = setTimeout(() => {
                if (creatingInstance) {
                    logWarn('Odoo instance creation is taking longer than expected');
                    setSnackbar({
                        open: true,
                        message: t('instanceCreationTimeout'),
                        severity: 'warning'
                    });
                }
            }, 30000);

            electron.ipcRenderer.once('instance-created', creationSuccessHandler);
            electron.ipcRenderer.once('instance-creation-error', creationErrorHandler);

            window.addEventListener('beforeunload', () => {
                electron.ipcRenderer.removeListener('instance-created', creationSuccessHandler);
                electron.ipcRenderer.removeListener('instance-creation-error', creationErrorHandler);
                clearTimeout(timeoutHandler);
            });
        }
    };

    const getFullContainerName = () => {
        return `odoo_${formData.version}_${formData.edition}_${formData.instanceName}`;
    };

    const isEnterpriseEdition = () => {
        return formData.edition === 'Enterprise';
    };

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2, minHeight: '770px' }}>
                    <motion.div variants={itemVariants}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                            <OdooIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
                            <Typography variant="h4" component="h1" fontWeight="bold">
                                {t('newOdooInstance')}
                            </Typography>
                        </Box>

                        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </motion.div>

                    <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: 500, paddingTop: 2, marginBottom: 4 }}>
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
                                style={{ width: '100%', position: 'absolute' }}
                            >
                                {activeStep === 0 && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            {t('selectOdooVersion')}
                                        </Typography>

                                        <Box sx={{ mb: 2 }}>
                                            <FormControl fullWidth margin="normal" error={!!errors.version}>
                                                <InputLabel>{t('versionLabel')}</InputLabel>
                                                <Select
                                                    value={formData.version}
                                                    label={t('versionLabel')}
                                                    onChange={handleVersionChange}
                                                    disabled={formData.customImage}
                                                >
                                                    {['14', '15', '16', '17', '18'].map(version => {
                                                        const isInstalled = availableImages.some(img =>
                                                            img.name === `odoo:${version}` && img.installed
                                                        );
                                                        return (
                                                            <MenuItem
                                                                key={version}
                                                                value={version}
                                                                disabled={!isInstalled}
                                                                sx={{
                                                                    opacity: isInstalled ? 1 : 0.5,
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center'
                                                                }}
                                                            >
                                                                <span>
                                                                    {version}
                                                                    {version === '18' && t('latestVersion')}
                                                                </span>
                                                                {!isInstalled && (
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                        sx={{ ml: 1 }}
                                                                    >
                                                                        {t('notInstalled')}
                                                                    </Typography>
                                                                )}
                                                            </MenuItem>
                                                        );
                                                    })}
                                                </Select>
                                                {!formData.customImage && errors.version && (
                                                    <FormHelperText error>{errors.version}</FormHelperText>
                                                )}
                                            </FormControl>
                                        </Box>

                                        <Box sx={{ mb: 2 }}>
                                            <FormControl component="fieldset" sx={{ mt: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Checkbox
                                                        checked={formData.customImage}
                                                        onChange={handleCustomImageToggle}
                                                        inputProps={{ 'aria-label': 'Use custom image' }}
                                                    />
                                                    <Typography>{t('useCustomImage')}</Typography>
                                                </Box>
                                            </FormControl>
                                        </Box>

                                        {formData.customImage && (
                                            <Box sx={{ mb: 2 }}>
                                                <FormControl fullWidth margin="normal" error={!!errors.version}>
                                                    <InputLabel>{t('customImage')}</InputLabel>
                                                    <Select
                                                        value={formData.customImageName}
                                                        label={t('customImage')}
                                                        onChange={handleCustomImageChange}
                                                    >
                                                        {customImages.length > 0 ? (
                                                            customImages.map(img => (
                                                                <MenuItem key={img.imageTag} value={img.imageTag}>
                                                                    {img.name} (based on Odoo {img.baseVersion})
                                                                </MenuItem>
                                                            ))
                                                        ) : (
                                                            <MenuItem disabled value="">
                                                                {t('noCustomImagesAvailable')}
                                                            </MenuItem>
                                                        )}
                                                    </Select>
                                                    {errors.version && (
                                                        <FormHelperText error>{errors.version}</FormHelperText>
                                                    )}
                                                </FormControl>
                                            </Box>
                                        )}

                                        <Box sx={{ mb: 2 }}>
                                            <FormControl fullWidth margin="normal">
                                                <InputLabel>{t('odooEdition')}</InputLabel>
                                                <Select
                                                    value={formData.edition}
                                                    label={t('odooEdition')}
                                                    onChange={handleEditionChange}
                                                >
                                                    <MenuItem value="Community">{t('communityEdition')}</MenuItem>
                                                    <MenuItem value="Enterprise">{t('enterpriseEdition')}</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>

                                        {formData.edition === 'Enterprise' && (
                                            <Alert severity="warning" sx={{ mt: 2 }}>
                                                <Typography variant="body2">
                                                    {t('enterpriseWarning', { version: formData.version })}
                                                </Typography>
                                            </Alert>
                                        )}

                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            {formData.customImage ? (
                                                <>
                                                    {t('customOdooImageInfo', { name: formData.customImageName || t('noneSelected') })}
                                                </>
                                            ) : formData.edition === 'Community' ? (
                                                <>
                                                    {t('communityEditionInfo')}
                                                </>
                                            ) : (
                                                <>
                                                    {t('enterpriseEditionInfo')}
                                                </>
                                            )}
                                        </Typography>

                                        {!formData.customImage && !isVersionInstalled(formData.version) && (
                                            <Box sx={{ mt: 2 }}>
                                                <Button
                                                    variant="contained"
                                                    color="secondary"
                                                    onClick={() => handlePullImage(formData.version)}
                                                    disabled={!!downloadingImage}
                                                    startIcon={downloadingImage === `odoo:${formData.version}` ? <CircularProgress size={20} color="inherit" /> : null}
                                                >
                                                    {downloadingImage === `odoo:${formData.version}` ? (
                                                        t('downloading')
                                                    ) : (
                                                        t('downloadOdoo', { version: formData.version })
                                                    )}
                                                </Button>
                                            </Box>
                                        )}

                                        {availableImages.length === 0 && !formData.customImage && (
                                            <Alert severity="warning" sx={{ mt: 2 }}>
                                                {t('noOdooImages')}
                                            </Alert>
                                        )}
                                    </Box>
                                )}

                                {activeStep === 1 && (
                                    <Box sx={{ maxHeight: '450px', overflow: 'auto', pr: 1 }}>
                                        <Typography variant="h6" gutterBottom>
                                            {t('configureOdooInstance')}
                                        </Typography>

                                        {postgresInstances.length === 0 ? (
                                            <Alert severity="warning" sx={{ mb: 3 }}>
                                                <Typography variant="body2">
                                                    {t('noPostgresAvailable')}
                                                </Typography>
                                                <Box sx={{ mt: 1 }}>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        onClick={() => {
                                                            const electron = getElectronAPI();
                                                            if (electron) {
                                                                electron.ipcRenderer.send('open-window', {
                                                                    type: 'new-postgres',
                                                                    options: { modal: true }
                                                                });
                                                                handleClose();
                                                            }
                                                        }}
                                                    >
                                                        {t('createPostgresInstance')}
                                                    </Button>
                                                </Box>
                                            </Alert>
                                        ) : (
                                            <>
                                                <FormControl fullWidth margin="normal" error={!!errors.postgresInstance}>
                                                    <InputLabel>{t('postgresInstance')}</InputLabel>
                                                    <Select
                                                        value={formData.postgresInstance}
                                                        label={t('postgresInstance')}
                                                        onChange={handlePostgresInstanceChange}
                                                    >
                                                        <MenuItem value="" disabled> {t('selectPostgresInstance')} </MenuItem>
                                                        {postgresInstances.map(pg => {
                                                            const isAtCapacity = pg.linkedCount >= pg.maxLinkedInstances;
                                                            const isRunning = pg.status.toLowerCase().includes('up');
                                                            const isDisabled = isAtCapacity || !isRunning;

                                                            return (
                                                                <MenuItem
                                                                    key={pg.name}
                                                                    value={pg.name}
                                                                    disabled={isDisabled}
                                                                    sx={{
                                                                        opacity: isDisabled ? 0.5 : 1,
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                        <Typography>{pg.name}</Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {pg.status}
                                                                        </Typography>
                                                                    </Box>
                                                                    <Chip
                                                                        label={t('linkedCount', { current: pg.linkedCount, max: pg.maxLinkedInstances })}
                                                                        size="small"
                                                                        color={isAtCapacity ? "error" : "default"}
                                                                        variant="outlined"
                                                                    />
                                                                </MenuItem>
                                                            );
                                                        })}
                                                    </Select>
                                                    {errors.postgresInstance && (
                                                        <FormHelperText error>{errors.postgresInstance}</FormHelperText>
                                                    )}
                                                </FormControl>

                                                <TextField
                                                    fullWidth
                                                    margin="normal"
                                                    label={t('instanceName')}
                                                    value={formData.instanceName}
                                                    onChange={handleInstanceNameChange}
                                                    error={!!errors.instanceName}
                                                    helperText={errors.instanceName || t('instanceNameHelp')}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                odoo_{formData.version}_{formData.edition}_
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                {nameLoading ? (
                                                                    <CircularProgress size={20} />
                                                                ) : (
                                                                    nameAvailable === true && <CheckIcon color="success" />
                                                                )}
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />

                                                <TextField
                                                    fullWidth
                                                    margin="normal"
                                                    label={t('adminPassword')}
                                                    type={showPassword ? "text" : "password"}
                                                    value={formData.adminPassword}
                                                    onChange={handleAdminPasswordChange}
                                                    error={!!errors.adminPassword}
                                                    helperText={errors.adminPassword || t('adminPasswordHelp')}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    onClick={() => setShowPassword(!showPassword)}
                                                                    edge="end"
                                                                >
                                                                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />

                                                <TextField
                                                    fullWidth
                                                    margin="normal"
                                                    label={t('portLabel')}
                                                    type="number"
                                                    value={formData.port}
                                                    onChange={handlePortChange}
                                                    error={!!errors.port}
                                                    helperText={errors.port || t('portHelp')}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                {portsLoading ? (
                                                                    <CircularProgress size={20} />
                                                                ) : (
                                                                    <>
                                                                        {portAvailable === true && (
                                                                            <CheckIcon color="success" />
                                                                        )}
                                                                        <Tooltip title={t('findNextPort')}>
                                                                            <IconButton
                                                                                edge="end"
                                                                                onClick={handleFindAvailablePort}
                                                                                disabled={portsLoading}
                                                                            >
                                                                                <RefreshIcon />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </>
                                                                )}
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />

                                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                                                    <Checkbox
                                                        checked={formData.dbFilter}
                                                        onChange={handleDbFilterChange}
                                                        inputProps={{ 'aria-label': 'Enable database filter' }}
                                                    />
                                                    <Typography>{t('enableDbFilter')}</Typography>
                                                    <Tooltip title={t('dbFilterTooltip')}>
                                                        <IconButton size="small">
                                                            <InfoIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>

                                                {formData.edition === 'Enterprise' && (
                                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                                        <Typography variant="body2">
                                                            {t('enterpriseNotice', { version: formData.version })}
                                                        </Typography>
                                                    </Alert>
                                                )}
                                            </>
                                        )}
                                    </Box>
                                )}

                                {activeStep === 2 && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            {t('createInstance')}
                                        </Typography>
                                        <Alert severity="info" sx={{ mb: 2 }}>
                                            {t('creatingOdooInstance', { 
                                                version: formData.version, 
                                                edition: formData.edition, 
                                                name: getFullContainerName() 
                                            })}
                                        </Alert>

                                        <Typography variant="body1" paragraph>
                                            <strong>{t('portLabel')}:</strong> {formData.port}
                                            {portAvailable === false ? (
                                                <Typography component="span" color="error" variant="caption" sx={{ display: 'block', mt: 1, ml: 2 }}>
                                                    {t('portWarning')}
                                                </Typography>
                                            ) : portAvailable === true ? (
                                                <Typography component="span" color="success.main" variant="caption" sx={{ display: 'block', mt: 1, ml: 2 }}>
                                                    {t('portSuccess')}
                                                </Typography>
                                            ) : null}
                                            <br />
                                            <strong>{t('postgresInstance')}:</strong> {formData.postgresInstance}
                                            <br />
                                            <strong>{t('adminPassword')}:</strong> {showPassword ? formData.adminPassword : '••••••••'}
                                            <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                            </IconButton>
                                            <br />
                                            <strong>{t('dbFilter')}:</strong> {formData.dbFilter ? t('enabled') : t('disabled')}
                                            <br />
                                            <strong>{t('versionLabel')}:</strong> {formData.version}
                                            <br />
                                            <strong>{t('instanceEdition')}:</strong> {formData.edition}
                                            {formData.customImage && (
                                                <>
                                                    <br />
                                                    <strong>{t('customImage')}:</strong> {formData.customImageName}
                                                </>
                                            )}
                                            <br />
                                            <strong>{t('containerNameLabel')}:</strong> {getFullContainerName()}
                                        </Typography>

                                        <Box sx={{ mt: 3 }}>
                                            <Divider sx={{ mb: 2 }} />
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                {t('configurationDetails')}:
                                            </Typography>
                                            <Box sx={{ pl: 2, mt: 1 }}>
                                                <Typography variant="body2">
                                                    • {t('odooDataPersisted')}
                                                </Typography>
                                                <Typography variant="body2">
                                                    • {t('customAddonsPlacement')}
                                                </Typography>
                                                {isEnterpriseEdition() && (
                                                    <Typography variant="body2">
                                                        • {t('enterpriseAddonsAvailability', { version: formData.version })}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2">
                                                    • {t('instanceConnectedTo', { name: formData.postgresInstance })}
                                                </Typography>
                                                {formData.dbFilter && (
                                                    <Typography variant="body2">
                                                        • {t('dbFilterPattern', { pattern: getFullContainerName() })}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>

                                        {isEnterpriseEdition() && (
                                            <Alert severity="warning" sx={{ mt: 3 }}>
                                                <Typography variant="body2">
                                                    {t('enterpriseNoticeWarn', { version: formData.version })}
                                                </Typography>
                                            </Alert>
                                        )}
                                    </Box>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </Box>

                    <motion.div variants={itemVariants}>
                        <Box sx={{ mt: 5, display: 'flex', justifyContent: 'space-between' }}>
                            <Button
                                variant="outlined"
                                onClick={activeStep === 0 ? handleClose : handleBack}
                                startIcon={activeStep === 0 ? null : <BackIcon />}
                                disabled={creatingInstance}
                            >
                                {activeStep === 0 ? t('cancelBtn') : t('back')}
                            </Button>

                            <Button
                                variant="contained"
                                color={activeStep === 2 ? "success" : "primary"}
                                onClick={activeStep === 2 ? handleSubmit : handleNext}
                                endIcon={activeStep === 2 && !creatingInstance ? <CheckIcon /> : null}
                                startIcon={creatingInstance && activeStep === 2 ? <CircularProgress size={20} color="inherit" /> : null}
                                disabled={
                                    (activeStep === 0 && !isVersionInstalled(formData.version) && !formData.customImage) ||
                                    !!downloadingImage ||
                                    creatingInstance ||
                                    (activeStep === 1 && postgresInstances.length === 0)
                                }
                            >
                                {activeStep === 2
                                    ? (creatingInstance ? t('creating') : t('createBtn'))
                                    : t('next')}
                            </Button>
                        </Box>
                    </motion.div>
                </Paper>
            </motion.div>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default NewInstanceScreen;