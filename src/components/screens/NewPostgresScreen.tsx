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
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    InputAdornment,
    Tooltip,
    IconButton,
    Snackbar
} from '@mui/material';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowBack as BackIcon,
    Check as CheckIcon,
    Storage as StorageIcon,
    Refresh as RefreshIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { getElectronAPI } from '../../utils/electron';
import dockerImagesService, { DockerImage } from '../../services/docker/dockerImagesService';
import { isPortAvailable, findAvailablePort } from '../../utils/portUtils';
import { containerNameExists, getSuggestedContainerName } from '../../utils/dockerUtils';
import settingsService from '../../services/settings/settingsService';
import { logError, logInfo, logWarn } from '../../services/utils/logger';

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref,
) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

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

interface PostgresFormData {
    version: string;
    instanceName: string;
    port: string;
    customName: boolean;
    username: string;
    password: string;
}

interface SnackbarState {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
}

const NewPostgresScreen: React.FC = () => {
    const { t } = useTranslation();
    const [activeStep, setActiveStep] = useState(0);
    const [direction, setDirection] = useState(0);
    
    const steps = [
        t('selectPostgresVersion'),
        t('configurePostgresInstance'),
        t('createInstance')
    ];
    const [formData, setFormData] = useState<PostgresFormData>({
        version: '15',
        instanceName: 'main',
        port: '5432',
        customName: false,
        username: 'pgodoouser',
        password: 'pgOd0op4sswOrd'
    });
    const [showPassword, setShowPassword] = useState(false);

    const [availableImages, setAvailableImages] = useState<DockerImage[]>([]);
    const [creatingInstance, setCreatingInstance] = useState(false);
    const [portsLoading, setPortsLoading] = useState(false);
    const [nameLoading, setNameLoading] = useState(false);
    const [errors, setErrors] = useState<{
        version?: string;
        instanceName?: string;
        port?: string;
        general?: string;
    }>({});
    const [portAvailable, setPortAvailable] = useState<boolean | null>(null);
    const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
    const [networkName, setNetworkName] = useState('');

    const [snackbar, setSnackbar] = useState<SnackbarState>({
        open: false,
        message: '',
        severity: 'info'
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const images = await dockerImagesService.getImages();
                const postgresImages = images.filter(img => img.name.startsWith('postgres:'));
                setAvailableImages(postgresImages);

                await checkPortAvailability('5432');

                const suggestedName = await getSuggestedContainerName('main', formData.version);
                setFormData(prev => ({
                    ...prev,
                    instanceName: suggestedName.replace(`postgres_${prev.version}_`, '').trim()
                }));

                const settings = await settingsService.loadSettings();
                if (settings && settings.network) {
                    setNetworkName(settings.network);
                } else {
                    setNetworkName('bridge');
                }
            } catch (error) {
                logError('Error loading initial PostgreSQL data', error);
                setSnackbar({
                    open: true,
                    message: 'Failed to load Docker images. Please ensure Docker is running.',
                    severity: 'error'
                });
            }
        };

        loadData();
    }, [formData.version]);

    const isVersionInstalled = (version: string): boolean => {
        return availableImages.some(img => img.name === `postgres:${version}` && img.installed);
    };

    useEffect(() => {
        const updateNameSuggestion = async () => {
            if (formData.customName) return;

            setNameLoading(true);
            const suggestedName = await getSuggestedContainerName('main', formData.version);
            setFormData(prev => ({
                ...prev,
                instanceName: suggestedName.replace(`postgres_${prev.version}_`, '').trim()
            }));
            setNameLoading(false);
        };

        updateNameSuggestion();
    }, [formData.version, formData.customName]);

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
        const fullName = `postgres_${formData.version}_${name}`;
        setNameLoading(true);
        const exists = await containerNameExists(fullName);
        setNameAvailable(!exists);
        setNameLoading(false);

        return !exists;
    };

    const handleFindAvailablePort = async () => {
        setPortsLoading(true);
        try {
            const basePort = parseInt(formData.port, 10) || 5432;
            
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
            } else {
                setErrors(prev => ({
                    ...prev,
                    port: 'No available ports found after multiple attempts'
                }));
                setPortAvailable(false);
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

    const handleVersionChange = (event: SelectChangeEvent) => {
        const newVersion = event.target.value;

        if (!isVersionInstalled(newVersion)) {
            return;
        }

        setFormData(prev => ({
            ...prev,
            version: newVersion
        }));

        if (errors.version) {
            setErrors(prev => ({
                ...prev,
                version: undefined
            }));
        }
    };

    const handleInstanceNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newName = event.target.value;

        setFormData(prev => ({
            ...prev,
            instanceName: newName,
            customName: true
        }));

        checkNameAvailability(newName);

        if (errors.instanceName) {
            setErrors(prev => ({
                ...prev,
                instanceName: undefined
            }));
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
            setErrors(prev => ({
                ...prev,
                port: undefined
            }));
        }

        return () => clearTimeout(timer);
    };

    const handleNext = async () => {
        if (activeStep === 0) {
            if (!formData.version) {
                setErrors(prev => ({
                    ...prev,
                    version: 'Please select a PostgreSQL version'
                }));
                return;
            }

            if (!isVersionInstalled(formData.version)) {
                setErrors(prev => ({
                    ...prev,
                    version: 'This PostgreSQL version is not installed. Please install it first.'
                }));
                return;
            }
        } else if (activeStep === 1) {
            const validName = await checkNameAvailability(formData.instanceName);
            if (!validName) {
                setErrors(prev => ({
                    ...prev,
                    instanceName: 'This container name already exists'
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

            if (!formData.instanceName.trim()) {
                setErrors(prev => ({
                    ...prev,
                    instanceName: 'Instance name is required'
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
        }

        setErrors({});
        setDirection(1);
        setActiveStep(prev => prev + 1);
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

        const port = parseInt(formData.port, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
            setErrors(prev => ({
                ...prev,
                port: 'Port must be a number between 1024 and 65535'
            }));
            return;
        }

        setCreatingInstance(true);
        const containerName = `postgres_${formData.version}_${formData.instanceName}`;
        logInfo(`Creating PostgreSQL ${formData.version} instance: ${containerName} on port ${port}`);

        const electron = getElectronAPI();
        if (electron) {
            electron.ipcRenderer.send('create-instance', {
                instanceType: 'postgres',
                version: formData.version,
                instanceName: containerName,
                port: port,
                username: formData.username,
                password: formData.password
            });

            const creationSuccessHandler = (_event, data) => {
                if (data.instanceType === 'postgres') {
                    setCreatingInstance(false);

                    const actualPort = data.port || port;
                    const originalPort = port.toString();
                    let message = t('postgresInstanceCreatedWithPort', { version: formData.version, port: actualPort });
                    
                    if (actualPort.toString() !== originalPort) {
                        message = t('postgresInstanceCreatedWithPortChange', { 
                            version: formData.version, 
                            original: originalPort, 
                            new: actualPort 
                        });
                    }
                    
                    logInfo(`PostgreSQL instance created successfully: ${formData.version} on port ${actualPort}`);
                    setSnackbar({
                        open: true,
                        message: message,
                        severity: 'success'
                    });

                    setTimeout(() => window.close(), 2000);
                }
            };

            const creationErrorHandler = (_event, data) => {
                if (data.instanceType === 'postgres') {
                    setCreatingInstance(false);
                    logError(`Error creating PostgreSQL instance: ${data.error}`);
                    
                    setSnackbar({
                        open: true,
                        message: t('errorCreatingPostgresInstance', { error: data.error }),
                        severity: 'error'
                    });
                }
            };

            const timeoutHandler = setTimeout(() => {
                if (creatingInstance) {
                    logWarn('PostgreSQL instance creation is taking longer than expected');
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
        return `postgres_${formData.version}_${formData.instanceName}`;
    };

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2, minHeight: 500 }}>
                    <motion.div variants={itemVariants}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                            <StorageIcon sx={{ fontSize: 32, mr: 2, color: 'secondary.main' }} />
                            <Typography variant="h4" component="h1" fontWeight="bold">
                                {t('newPostgresqlInstance')}
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

                    <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: 400, paddingTop: 2, marginBottom: 4 }}>
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
                                            {t('selectPostgresVersion')}
                                        </Typography>
                                        <FormControl fullWidth margin="normal" error={!!errors.version}>
                                            <InputLabel>{t('versionLabel')}</InputLabel>
                                            <Select
                                                value={formData.version}
                                                label={t('versionLabel')}
                                                onChange={handleVersionChange}
                                            >
                                                {['12', '13', '14', '15', '16'].map(version => {
                                                    const isInstalled = isVersionInstalled(version);
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
                                                                {version === '16' && t('latestVersion')}
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
                                            {errors.version && (
                                                <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                                                    {errors.version}
                                                </Typography>
                                            )}
                                        </FormControl>

                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            {t('postgresDescription', { 
                                                version: formData.version, 
                                                status: isVersionInstalled(formData.version) ? t('willBeInstalled') : t('isNotInstalled') 
                                            })}
                                        </Typography>

                                        {availableImages.length === 0 && (
                                            <Alert severity="warning" sx={{ mt: 2 }}>
                                                {t('noPostgresImagesFound')}
                                            </Alert>
                                        )}
                                    </Box>
                                )}

                                {activeStep === 1 && (
                                    <Box sx={{
                                        maxHeight: '350px',
                                        overflow: 'auto',
                                        pr: 1
                                    }}>
                                        <Typography variant="h6" gutterBottom>
                                            {t('configurePostgresInstance')}
                                        </Typography>

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
                                                        postgres_{formData.version}_
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        {nameLoading ? (
                                                            <CircularProgress size={20} />
                                                        ) : (
                                                            nameAvailable === true && (
                                                                <CheckIcon color="success" />
                                                            )
                                                        )}
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

                                        <TextField
                                            fullWidth
                                            margin="normal"
                                            label={t('username')}
                                            value={formData.username}
                                            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                            helperText={t('postgresUsernameHelper')}
                                        />

                                        <TextField
                                            fullWidth
                                            margin="normal"
                                            label={t('password')}
                                            value={formData.password}
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                            type={showPassword ? "text" : "password"}
                                            helperText={t('postgresPasswordHelper')}
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

                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            {t('postgresCredentialsWarning')}
                                        </Typography>
                                    </Box>
                                )}

                                {activeStep === 2 && (
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            {t('createInstance')}
                                        </Typography>
                                        <MuiAlert severity="info" sx={{ mb: 3 }}>
                                            {t('creatingPostgresInstance', { 
                                                version: formData.version, 
                                                name: getFullContainerName() 
                                            })}
                                        </MuiAlert>

                                        <Typography variant="body1" paragraph>
                                            <strong>{t('portLabel')}:</strong> {formData.port}
                                            {portAvailable === false ? (
                                                <Typography component="span" color="error" variant="caption" sx={{ display: 'block', mt: 1, ml: 2 }}>
                                                    {t('portWarning')} {t('freePortAutoSelection')}
                                                </Typography>
                                            ) : portAvailable === true ? (
                                                <Typography component="span" color="success.main" variant="caption" sx={{ display: 'block', mt: 1, ml: 2 }}>
                                                    {t('portSuccess')}
                                                </Typography>
                                            ) : (
                                                <Typography component="span" color="warning.main" variant="caption" sx={{ display: 'block', mt: 1, ml: 2 }}>
                                                    {t('portAvailabilityUnknown')}
                                                </Typography>
                                            )}
                                            <br />
                                            <strong>{t('username')}:</strong> {formData.username}
                                            <br />
                                            <strong>{t('password')}:</strong> {showPassword ? formData.password : '••••••••'}
                                            <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                            </IconButton>
                                            <br />
                                            <strong>{t('versionLabel')}:</strong> {formData.version}
                                            <br />
                                            <strong>{t('containerNameLabel')}:</strong> {getFullContainerName()}
                                            <br />
                                            <strong>{t('network')}:</strong> {networkName}
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary">
                                            {t('postgresAutoConfigMessage')}
                                        </Typography>

                                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                                            <InfoIcon color="info" sx={{ mr: 1 }} />
                                            <Typography variant="body2" color="info.main">
                                                {t('postgresClientConnectionInfo')}
                                            </Typography>
                                        </Box>
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
                                color={activeStep === 2 ? "success" : "secondary"}
                                onClick={activeStep === 2 ? handleSubmit : handleNext}
                                endIcon={activeStep === 2 && !creatingInstance ? <CheckIcon /> : null}
                                startIcon={creatingInstance && activeStep === 2 ? <CircularProgress size={20} color="inherit" /> : null}
                                disabled={(activeStep === 0 && !isVersionInstalled(formData.version)) || creatingInstance}
                            >
                                {activeStep === 2
                                    ? (creatingInstance ? t('creating') : t('createInstance'))
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

export default NewPostgresScreen;