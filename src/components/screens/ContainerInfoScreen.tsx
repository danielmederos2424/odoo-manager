// src/components/screens/ContainerInfoScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Typography,
    Container,
    Paper,
    Button,
    Divider,
    Grid,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    IconButton,
    Tooltip,
    TextField,
    Card,
    CardContent,
    Stack,
    Alert as MuiAlert,
    Switch,
    FormControl,
    FormControlLabel,
    FormHelperText
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import path from 'path';
import { getElectronAPI, isElectron } from '../../utils/electron';
import { logInfo, logError, logWarn } from '../../services/utils/logger';
import {
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    ContentCopy as CopyIcon,
    OpenInNew as OpenInNewIcon,
    Code as CodeIcon,
    FolderOpen as FolderIcon,
    Settings as SettingsIcon,
    Storage as StorageIcon,
    Dataset as DatabaseIcon,
    Web as WebIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon
} from '@mui/icons-material';

interface ContainerInfoData {
    containerName: string;
    info: string;
    instanceNumber?: string;
}

interface ContainerInfoScreenProps {
    data?: ContainerInfoData | null;
}

interface InfoItem {
    label: string;
    value: string;
    sensitive?: boolean;
    copyable?: boolean;
}

interface ConnectionStringInfo {
    displayValue: string;
    actualValue: string;
}

const ContainerInfoScreen: React.FC<ContainerInfoScreenProps> = ({ data }) => {
    const { t } = useTranslation();
    const [containerData, setContainerData] = useState<ContainerInfoData | null>(null);
    const [parsedInfo, setParsedInfo] = useState<InfoItem[]>([]);
    const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
    const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
    const [instanceRunning, setInstanceRunning] = useState<boolean>(false);
    const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
    const [newUsername, setNewUsername] = useState<string>('');
    const [newPassword, setNewPassword] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [updateMessage, setUpdateMessage] = useState<{message: string, severity: 'success' | 'error' | null}>({
        message: '',
        severity: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for DB filter editing
    const [editDbFilterOpen, setEditDbFilterOpen] = useState<boolean>(false);
    const [newDbFilter, setNewDbFilter] = useState<boolean>(false);
    const [isUpdatingDbFilter, setIsUpdatingDbFilter] = useState<boolean>(false);
    const [dbFilterUpdateMessage, setDbFilterUpdateMessage] = useState<{message: string, severity: 'success' | 'error' | null}>({
        message: '',
        severity: null
    });

    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    // Function to check if container is a PostgreSQL instance
    const isPostgresInstance = (): boolean => {
        if (!containerData) return false;

        // Check if it's a PostgreSQL instance by name or info type
        if (containerData.containerName.includes('postgres_')) return true;

        // Check if it's explicitly a PostgreSQL instance from info
        const typeInfo = parsedInfo.find(item => item.label.toLowerCase() === 'type');
        if (typeInfo && typeInfo.value.toLowerCase() === 'postgres') return true;

        return false;
    };

    // Function to check if container is an Odoo instance
    const isOdooInstance = (): boolean => {
        if (!containerData) return false;

        // Check if it's an Odoo instance by name or info type
        if (containerData.containerName.includes('odoo_')) return true;

        // Check if it's explicitly an Odoo instance from info
        const typeInfo = parsedInfo.find(item => item.label.toLowerCase() === 'type');
        if (typeInfo && typeInfo.value.toLowerCase() === 'odoo') return true;

        const editionInfo = parsedInfo.find(item => item.label.toLowerCase() === 'edition');
        if (editionInfo) return true; // Only Odoo has edition info

        return false;
    };

    // Function to show a password
    const togglePasswordVisibility = (index: number): void => {
        setShowPassword(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Function to copy a value to clipboard
    const copyToClipboard = (value: string, index: string | number): void => {
        if (isElectron()) {
            try {
                // If copying connection string, use the actual one with password
                let textToCopy = value;
                if (index === 'conn') {
                    const connectionInfo = getPostgresConnectionString();
                    textToCopy = connectionInfo.actualValue;
                }

                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        logInfo(`Value copied to clipboard (${index})`);
                        // Show copied status for a brief period
                        setCopyStatus(prev => ({
                            ...prev,
                            [index]: true
                        }));

                        setTimeout(() => {
                            setCopyStatus(prev => ({
                                ...prev,
                                [index]: false
                            }));
                        }, 2000);
                    })
                    .catch((clipboardErr: Error) => {
                        logError('Error copying to clipboard', clipboardErr);
                    });
            } catch (err: unknown) {
                logError('Error in copyToClipboard function', err instanceof Error ? err : new Error(String(err)));
            }
        }
    };

    // Handle updating DB filter
    const handleUpdateDbFilter = async (): Promise<void> => {
        if (!containerData) return;

        setIsUpdatingDbFilter(true);
        setDbFilterUpdateMessage({message: '', severity: null});

        try {
            if (isElectron()) {
                const electron = getElectronAPI();
                if (!electron?.ipcRenderer) {
                    throw new Error('IPC Renderer not available');
                }

                logInfo(`Updating DB filter for ${containerData.containerName} to ${newDbFilter}`);
                const result = await electron.ipcRenderer.invoke('update-odoo-config', {
                    instanceName: containerData.containerName,
                    dbFilter: newDbFilter
                });

                if (result.success) {
                    // Update the parsedInfo with new values
                    const updatedInfo = [...parsedInfo];
                    const dbFilterIndex = updatedInfo.findIndex(item =>
                        item.label.toLowerCase() === 'dbfilter' ||
                        item.label.toLowerCase() === 'db filter'
                    );

                    if (dbFilterIndex !== -1) {
                        updatedInfo[dbFilterIndex].value = newDbFilter.toString();
                    } else {
                        // Add DB filter info if it doesn't exist
                        updatedInfo.push({
                            label: 'DB Filter',
                            value: newDbFilter.toString(),
                            sensitive: false,
                            copyable: false
                        });
                    }

                    logInfo('DB filter updated successfully');
                    setParsedInfo(updatedInfo);
                    setDbFilterUpdateMessage({message: t('dbFilterUpdatedSuccess'), severity: 'success'});

                    // Close dialog after a short delay
                    setTimeout(() => {
                        setEditDbFilterOpen(false);
                        setDbFilterUpdateMessage({message: '', severity: null});
                    }, 2000);
                } else {
                    logError('Failed to update DB filter', result.message);
                    setDbFilterUpdateMessage({
                        message: result.message || t('failedToUpdateDbFilter'),
                        severity: 'error'
                    });
                }
            }
        } catch (error: unknown) {
            logError('Error updating DB Filter', error instanceof Error ? error : new Error(String(error)));
            setDbFilterUpdateMessage({message: t('errorUpdatingDbFilter'), severity: 'error'});
        } finally {
            setIsUpdatingDbFilter(false);
        }
    };

    // Function to find dependent Odoo instances for a PostgreSQL instance
    const findDependentInstances = (containers: any[], postgresInstanceName: string): any[] => {
        if (!containers || !postgresInstanceName) return [];

        // Filter for Odoo instances that depend on this PostgreSQL instance
        const dependentContainers = containers.filter(container =>
            container.info?.type === 'odoo' &&
            container.info?.postgresInstance === postgresInstanceName
        );

        logInfo(`Found ${dependentContainers.length} dependent instances for ${postgresInstanceName}`);
        return dependentContainers;
    };

    useEffect(() => {
        if (!data || !data.containerName) {
            setLoading(false);
            return;
        }

        logInfo(`Loading container info for: ${data.containerName}`);
        setContainerData(data);
        setLoading(true);

        // Reset state
        setParsedInfo([]);

        // Get container data from list-instances
        if (isElectron()) {
            const electron = getElectronAPI();
            if (!electron?.ipcRenderer) {
                setError('IPC Renderer not available');
                setLoading(false);
                return;
            }

            electron.ipcRenderer.invoke('docker-operation', {
                operation: 'list-instances',
                params: {},
                _timestamp: new Date().getTime() // Prevent caching
            }).then((containers: any[]) => {
                logInfo(`Retrieved ${containers.length} containers`);

                // Find our container
                const container = containers.find(c => c.name === data.containerName);

                if (container && container.info) {
                    logInfo(`Found container info for: ${container.name}`);

                    // Convert container.info object directly to InfoItems
                    const infoItems: InfoItem[] = [];

                    for (const [key, value] of Object.entries(container.info)) {
                        // Skip unnecessary fields
                        if (key === 'updatedAt') continue;

                        // Create a proper display label based on the key
                        let label;
                        switch(key.toLowerCase()) {
                            case 'port':
                                label = 'Port';
                                break;
                            case 'username':
                                label = 'Username';
                                break;
                            case 'password':
                                label = 'Password';
                                break;
                            case 'version':
                                label = 'Version';
                                break;
                            case 'edition':
                                label = 'Edition';
                                break;
                            case 'name':
                                label = 'Name';
                                break;
                            case 'type':
                                label = 'Type';
                                break;
                            case 'adminpassword':
                                label = 'Admin Password';
                                break;
                            case 'dbfilter':
                                label = 'DB Filter';
                                break;
                            case 'createdat':
                                label = 'Created At';
                                break;
                            case 'postgresinstance':
                                label = 'PostgreSQL Instance';
                                break;
                            case 'customimage':
                                label = 'Custom Image';
                                break;
                            case 'customImageName':
                                label = 'Custom Image Name';
                                break;
                            default:
                                // Capitalize first letter for other fields
                                label = key.charAt(0).toUpperCase() + key.slice(1);
                        }

                        const isSensitive = key.toLowerCase().includes('password');

                        // Determine if field should be copyable
                        const isCopyable = !key.toLowerCase().includes('created') &&
                            key.toLowerCase() !== 'postgresinstance' &&
                            key.toLowerCase() !== 'customimage' &&
                            key.toLowerCase() !== 'customimageaame' &&
                            key.toLowerCase() !== 'dbfilter';

                        // Format values for display
                        let displayValue = value?.toString() || '';
                        if (key.toLowerCase() === 'customimage') {
                            displayValue = value === true || value === 'true' ? 'Yes' : 'No';
                        }

                        infoItems.push({
                            label,
                            value: displayValue,
                            sensitive: isSensitive,
                            copyable: isCopyable
                        });

                        logInfo(`Added info item: ${label} = ${isSensitive ? '[MASKED]' : displayValue}`);
                    }

                    // Set running state from the container status
                    setInstanceRunning(container.status.toLowerCase().includes('up'));

                    // If this is a PostgreSQL instance, find and add dependent Odoo instances
                    if (container.info.type === 'postgres') {
                        const dependentInstances = findDependentInstances(containers, container.name);

                        if (dependentInstances.length > 0) {
                            const dependentNames = dependentInstances.map(instance => instance.name).join(', ');
                            infoItems.push({
                                label: t('dependentInstances'),
                                value: dependentNames,
                                sensitive: false,
                                copyable: false
                            });

                            // Add warning about dependencies
                            infoItems.push({
                                label: t('warning'),
                                value: t('postgresWarningWithDependents', { count: dependentInstances.length }),
                                sensitive: false,
                                copyable: false
                            });
                        } else {
                            infoItems.push({
                                label: t('dependentInstances'),
                                value: t('none'),
                                sensitive: false,
                                copyable: false
                            });
                        }
                    }

                    // Update state with the info items
                    setParsedInfo(infoItems);
                    setLoading(false);

                    // Force a re-render
                    setTimeout(() => {
                        setParsedInfo([...infoItems]);
                    }, 50);
                } else {
                    logWarn(`Container not found or missing info: ${data.containerName}`);
                    // Fallback to parsing from string
                    parseInfoFromString(data.info);
                    setLoading(false);
                }
            }).catch((err: unknown) => {
                logError('Error fetching container info', err instanceof Error ? err : new Error(String(err)));
                setError(t('failedToLoadContainerInfo'));
                parseInfoFromString(data.info);
                setLoading(false);
            });
        } else {
            // For non-Electron environment (like browser preview)
            parseInfoFromString(data.info);
            setLoading(false);
        }
    }, [data, t]);

    // Helper function to parse info from string (fallback method)
    const parseInfoFromString = (infoStr: string): void => {
        logInfo('Parsing container info from string (fallback method)');
        const parsed: InfoItem[] = [];
        const infoLines = infoStr.split('\n');

        infoLines.forEach(line => {
            if (line.trim()) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const label = parts[0].trim();
                    const value = parts.slice(1).join(':').trim();

                    const isSensitive = label.toLowerCase().includes('password');

                    // Determine if field should be copyable
                    const isCopyable = !label.toLowerCase().includes('created') &&
                        label.toLowerCase() !== 'postgresql instance' &&
                        label.toLowerCase() !== 'custom image' &&
                        label.toLowerCase() !== 'custom image name' &&
                        label.toLowerCase() !== 'db filter';

                    // Format values for display
                    let displayValue = value;
                    if (label.toLowerCase() === 'custom image') {
                        displayValue = value === 'true' ? 'Yes' : 'No';
                    }

                    parsed.push({
                        label,
                        value: displayValue,
                        sensitive: isSensitive,
                        copyable: isCopyable
                    });
                }
            }
        });

        setParsedInfo(parsed);
    };

    // Get Odoo version and edition for display
    const getOdooVersion = (): string => {
        const versionInfo = parsedInfo.find(item => item.label.toLowerCase() === 'version');
        return versionInfo ? versionInfo.value : '';
    };

    const getOdooEdition = (): string => {
        const editionInfo = parsedInfo.find(item => item.label.toLowerCase() === 'edition');
        return editionInfo ? editionInfo.value : 'Community';
    };

    // Get the linked PostgreSQL instance name
    const getLinkedPostgres = (): string => {
        const pgInfo = parsedInfo.find(item => item.label.toLowerCase() === 'postgresinstance');
        return pgInfo ? pgInfo.value : '';
    };

    // Check if database filter is enabled
    const isDbFilterEnabled = (): boolean => {
        const dbFilterInfo = parsedInfo.find(item =>
            item.label.toLowerCase() === 'dbfilter' ||
            item.label.toLowerCase() === 'db filter'
        );
        return dbFilterInfo ? dbFilterInfo.value === 'true' : false;
    };

    // Helper function to get port value
    const getPortValue = (): string => {
        const portInfo = parsedInfo.find(item => item.label.toLowerCase() === 'port');
        return portInfo ? portInfo.value : '8069';
    };

    // Function to check if this PostgreSQL instance has dependent Odoo instances
    const hasDependentInstances = (): boolean => {
        const dependentInfo = parsedInfo.find(item =>
            item.label.toLowerCase() === 'dependent instances' ||
            item.label.toLowerCase() === t('dependentInstances').toLowerCase()
        );

        // Check if dependentInfo exists and its value isn't 'None' or the translated 'none'
        if (!dependentInfo) return false;

        const value = dependentInfo.value.toLowerCase();
        return value !== 'none' &&
            value !== 'ninguna' &&
            value !== t('none').toLowerCase() &&
            value !== '' &&
            value !== '0';
    };

    const handleOpenConfig = (): void => {
        if (containerData && isOdooInstance()) {
            logInfo('Opening odoo.conf file');
            if (isElectron()) {
                const electron = getElectronAPI();
                if (!electron?.ipcRenderer) {
                    logError('IPC Renderer not available');
                    return;
                }
                electron.ipcRenderer.send('open-file', {
                    instanceName: containerData.containerName,
                    instanceType: 'odoo',
                    filePath: path.join('config', 'odoo.conf')
                });
            }
        }
    };

    const handleOpenAddons = (): void => {
        if (containerData && isOdooInstance()) {
            logInfo('Opening addons folder');
            if (isElectron()) {
                const electron = getElectronAPI();
                if (!electron?.ipcRenderer) {
                    logError('IPC Renderer not available');
                    return;
                }
                electron.ipcRenderer.send('open-instance-folder', {
                    instanceName: containerData.containerName,
                    instanceType: 'odoo',
                    subPath: 'addons'
                });
            }
        }
    };

    const handleOpenDataFolder = (): void => {
        if (containerData) {
            const instanceType = isPostgresInstance() ? 'postgres' : 'odoo';
            logInfo(`Opening data folder for ${instanceType} instance: ${containerData.containerName}`);

            if (isElectron()) {
                const electron = getElectronAPI();
                if (!electron?.ipcRenderer) {
                    logError('IPC Renderer not available');
                    return;
                }
                electron.ipcRenderer.send('open-instance-folder', {
                    instanceName: containerData.containerName,
                    instanceType: instanceType
                });
            }
        }
    };

    const handleOpenBrowser = (): void => {
        if (containerData && isOdooInstance()) {
            // Extract port from parsed info
            const port = getPortValue();
            if (port) {
                const url = `http://localhost:${port}`;
                logInfo(`Opening Odoo UI at ${url}`);

                if (isElectron()) {
                    try {
                        const electron = getElectronAPI();
                        if (!electron) {
                            window.open(url, '_blank');
                            return;
                        }

                        if (electron.ipcRenderer) {
                            electron.ipcRenderer.invoke('open-external-url', url)
                                .catch((err: unknown) => {
                                    logError(`Error opening Odoo UI`, err instanceof Error ? err : new Error(String(err)));
                                    window.open(url, '_blank');
                                });
                        } else {
                            window.open(url, '_blank');
                        }
                    } catch (err: unknown) {
                        logError('Error accessing electron API', err instanceof Error ? err : new Error(String(err)));
                        window.open(url, '_blank');
                    }
                } else {
                    window.open(url, '_blank');
                }
            }
        }
    };

    const handleOpenDbManager = (): void => {
        if (containerData && isOdooInstance()) {
            // Extract port from parsed info
            const port = getPortValue();
            if (port) {
                const url = `http://localhost:${port}/web/database/manager`;
                logInfo(`Opening database manager at ${url}`);

                if (isElectron()) {
                    try {
                        const electron = getElectronAPI();
                        if (!electron) {
                            window.open(url, '_blank');
                            return;
                        }

                        if (electron.ipcRenderer) {
                            electron.ipcRenderer.invoke('open-external-url', url)
                                .catch((err: unknown) => {
                                    logError(`Error opening Database Manager`, err instanceof Error ? err : new Error(String(err)));
                                    window.open(url, '_blank');
                                });
                        } else {
                            window.open(url, '_blank');
                        }
                    } catch (err: unknown) {
                        logError('Error accessing electron API', err instanceof Error ? err : new Error(String(err)));
                        window.open(url, '_blank');
                    }
                } else {
                    window.open(url, '_blank');
                }
            }
        }
    };

    const handleClose = (): void => {
        logInfo('Closing container info window');
        window.close();
    };

    // Function to get connection string for PostgreSQL
    const getPostgresConnectionString = (): ConnectionStringInfo => {
        // Find port, username and password
        const portInfo = parsedInfo.find(item => item.label.toLowerCase() === 'port');
        const userInfo = parsedInfo.find(item => item.label.toLowerCase() === 'username');
        const passInfo = parsedInfo.find(item => item.label.toLowerCase() === 'password');

        logInfo('Building PostgreSQL connection string');

        if (portInfo && userInfo && passInfo) {
            // For display in UI - replace actual password with asterisks
            const displayValue = `postgresql://${userInfo.value}:********@localhost:${portInfo.value}/postgres`;

            // For clipboard - keep actual password
            const actualValue = `postgresql://${userInfo.value}:${passInfo.value}@localhost:${portInfo.value}/postgres`;

            return { displayValue, actualValue };
        }

        // Fallback with default values
        logWarn('Using default connection string values');
        return {
            displayValue: 'postgresql://postgres:********@localhost:5432/postgres',
            actualValue: 'postgresql://postgres:postgres@localhost:5432/postgres'
        };
    };

    // Handle updating PostgreSQL credentials
    const handleUpdateCredentials = async (): Promise<void> => {
        if (!containerData) return;

        // Check if this PostgreSQL instance has dependent Odoo instances
        if (hasDependentInstances()) {
            logWarn('Cannot update credentials for PostgreSQL instance with dependent Odoo instances');
            setUpdateMessage({
                message: t('cannotUpdateCredentialsMessage'),
                severity: 'error'
            });
            return;
        }

        // Get current values to use if fields are empty
        const currentUsername = parsedInfo.find(item => item.label.toLowerCase().includes('username'))?.value || 'postgres';
        const currentPassword = parsedInfo.find(item => item.label.toLowerCase().includes('password'))?.value || 'postgres';

        // If fields are empty, use current values
        const usernameToUpdate = newUsername.trim() || currentUsername;
        const passwordToUpdate = newPassword.trim() || currentPassword;

        logInfo(`Updating PostgreSQL credentials for ${containerData.containerName}`);
        setIsUpdating(true);
        setUpdateMessage({message: '', severity: null});

        try {
            if (isElectron()) {
                const electron = getElectronAPI();
                if (!electron?.ipcRenderer) {
                    throw new Error('IPC Renderer not available');
                }

                const result = await electron.ipcRenderer.invoke('update-postgres-credentials', {
                    instanceName: containerData.containerName,
                    username: usernameToUpdate,
                    password: passwordToUpdate
                });

                if (result.success) {
                    logInfo('PostgreSQL credentials updated successfully');

                    // Update the parsedInfo with new values
                    const updatedInfo = [...parsedInfo];
                    const usernameIndex = updatedInfo.findIndex(item => item.label.toLowerCase().includes('username'));
                    const passwordIndex = updatedInfo.findIndex(item => item.label.toLowerCase().includes('password'));

                    if (usernameIndex !== -1) {
                        updatedInfo[usernameIndex].value = usernameToUpdate;
                    }

                    if (passwordIndex !== -1) {
                        updatedInfo[passwordIndex].value = passwordToUpdate;
                    }

                    setParsedInfo(updatedInfo);
                    setUpdateMessage({message: t('credentialsUpdatedSuccess'), severity: 'success'});

                    // Close dialog after a short delay
                    setTimeout(() => {
                        setEditDialogOpen(false);
                        setUpdateMessage({message: '', severity: null});
                    }, 2000);
                } else {
                    logError('Failed to update credentials', result.message);
                    setUpdateMessage({
                        message: result.message || t('failedToUpdateCredentials'),
                        severity: 'error'
                    });
                }
            }
        } catch (error: unknown) {
            logError('Error updating credentials', error instanceof Error ? error : new Error(String(error)));
            setUpdateMessage({message: t('errorUpdatingCredentials'), severity: 'error'});
        } finally {
            setIsUpdating(false);
        }
    };

    // Container Details Card - displays info based on container type
    const renderContainerDetails = () => {
        return (
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DatabaseIcon fontSize="small" color={isPostgresInstance() ? "info" : "primary"} />
                        {t('containerDetails')}
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Typography variant="body1" fontWeight="bold">
                                {containerData?.containerName}
                            </Typography>

                            <Box sx={{
                                display: 'flex',
                                gap: 1,
                                alignItems: 'center',
                                mt: 1,
                                flexWrap: 'wrap'
                            }}>
                                {isPostgresInstance() ? (
                                    <Chip
                                        label="PostgreSQL"
                                        size="small"
                                        color="info"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                ) : (
                                    <Chip
                                        label="Odoo"
                                        size="small"
                                        color="primary"
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                )}

                                {getOdooVersion() && !isPostgresInstance() && (
                                    <Chip
                                        label={`v${getOdooVersion()}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}

                                {isOdooInstance() && getOdooEdition() === 'Enterprise' && (
                                    <Chip
                                        label="Enterprise"
                                        size="small"
                                        color="warning"
                                    />
                                )}

                                {parsedInfo.some(item =>
                                    (item.label.toLowerCase().includes('status') &&
                                        item.value.toLowerCase().includes('up'))) || instanceRunning ? (
                                    <Chip
                                        label="Running"
                                        size="small"
                                        color="success"
                                    />
                                ) : (
                                    <Chip
                                        label="Stopped"
                                        size="small"
                                        color="error"
                                    />
                                )}

                                {/* Add dbFilter indicator for Odoo instances */}
                                {isOdooInstance() && (
                                    <Chip
                                        label={isDbFilterEnabled() ? t('dbFilterEnabled') : t('dbFilterDisabled')}
                                        size="small"
                                        color={isDbFilterEnabled() ? "secondary" : "default"}
                                        variant="outlined"
                                    />
                                )}
                            </Box>

                            {/* For Odoo, display the linked PostgreSQL instance */}
                            {isOdooInstance() && getLinkedPostgres() && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    <strong>Linked to:</strong> {getLinkedPostgres()}
                                </Typography>
                            )}
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        );
    };

    // Connection Information Card - displays info based on container type
    const renderConnectionInformation = () => {
        if (isPostgresInstance()) {
            return (
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SettingsIcon fontSize="small" color="info" />
                            {t('connectionInformation')}
                        </Typography>

                        <Grid container spacing={2}>
                            {parsedInfo.map((item, index) => {
                                if (item.label.toLowerCase() === 'name' ||
                                    item.label.toLowerCase() === 'version' ||
                                    item.label.toLowerCase() === 'status' ||
                                    item.label.toLowerCase() === 'type' ||
                                    item.label.toLowerCase() === 'created at') {
                                    return null; // Skip these as they're shown elsewhere
                                }

                                return (
                                    <Grid item xs={12} md={6} key={index}>
                                        <Stack direction="column" spacing={0.5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {item.label}
                                            </Typography>

                                            {item.sensitive ? (
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    variant="outlined"
                                                    value={showPassword[index] ? item.value : '••••••••'}
                                                    inputProps={{
                                                        readOnly: true
                                                    }}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <div style={{ display: 'flex' }}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => togglePasswordVisibility(index)}
                                                                >
                                                                    {showPassword[index] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                                </IconButton>
                                                                {item.copyable && (
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => copyToClipboard(item.value, index)}
                                                                    >
                                                                        <CopyIcon fontSize="small" />
                                                                    </IconButton>
                                                                )}
                                                            </div>
                                                        )
                                                    }}
                                                />
                                            ) : (
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <Typography variant="body1" fontWeight="500">
                                                        {item.value}
                                                    </Typography>

                                                    {item.copyable && (
                                                        <Tooltip
                                                            title={copyStatus[index] ? t('copied') : t('copy')}
                                                            placement="top"
                                                        >
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => copyToClipboard(item.value, index)}
                                                            >
                                                                <CopyIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            )}
                                        </Stack>
                                    </Grid>
                                );
                            })}
                        </Grid>

                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                {t('connectionString')}
                            </Typography>
                            <TextField
                                size="small"
                                fullWidth
                                variant="outlined"
                                value={getPostgresConnectionString().displayValue}
                                inputProps={{
                                    readOnly: true
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <div>
                                            <IconButton
                                                size="small"
                                                onClick={() => copyToClipboard(getPostgresConnectionString().displayValue, 'conn')}
                                            >
                                                <CopyIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    )
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {t('connectionStringDescription')}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            );
        } else {
            // Render Odoo connection information
            return (
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SettingsIcon fontSize="small" color="primary" />
                            {t('connectionInformation')}
                        </Typography>

                        <Grid container spacing={2}>
                            {parsedInfo.map((item, index) => {
                                // Skip certain fields that are shown elsewhere
                                if (item.label.toLowerCase() === 'name' ||
                                    item.label.toLowerCase() === 'version' ||
                                    item.label.toLowerCase() === 'edition' ||
                                    item.label.toLowerCase() === 'status' ||
                                    item.label.toLowerCase() === 'type' ||
                                    item.label.toLowerCase() === 'created at' ||
                                    item.label.toLowerCase() === 'updated at') {
                                    return null;
                                }

                                // Special handling for admin password, linked postgres, and DB filter
                                const isPasswordField = item.label.toLowerCase() === 'adminpassword' ||
                                    item.label.toLowerCase() === 'admin password';

                                const isPostgresField = item.label.toLowerCase() === 'postgresinstance' ||
                                    item.label.toLowerCase() === 'postgresql instance';

                                const isDbFilterField = item.label.toLowerCase() === 'dbfilter' ||
                                    item.label.toLowerCase() === 'db filter';

                                const isCustomImageField = item.label.toLowerCase() === 'customimage' ||
                                    item.label.toLowerCase() === 'custom image';

                                const isCustomImageNameField = item.label.toLowerCase() === 'customimageaame' ||
                                    item.label.toLowerCase() === 'custom image name';

                                return (
                                    <Grid item xs={12} md={6} key={index}>
                                        <Stack direction="column" spacing={0.5}>
                                            <Typography variant="body2" color="text.secondary">
                                                {isPasswordField ? t('adminPassword') :
                                                    isPostgresField ? t('postgresInstance') :
                                                        isCustomImageField ? t('customImage') :
                                                            isCustomImageNameField ? t('customImageName') :
                                                                isDbFilterField ? t('dbFilter') :
                                                                    item.label}
                                            </Typography>

                                            {isPasswordField ? (
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    variant="outlined"
                                                    value={showPassword[index] ? item.value : '••••••••'}
                                                    inputProps={{
                                                        readOnly: true
                                                    }}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <div style={{ display: 'flex' }}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => togglePasswordVisibility(index)}
                                                                >
                                                                    {showPassword[index] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                                </IconButton>
                                                                {item.copyable && (
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => copyToClipboard(item.value, index)}
                                                                    >
                                                                        <CopyIcon fontSize="small" />
                                                                    </IconButton>
                                                                )}
                                                            </div>
                                                        )
                                                    }}
                                                />
                                            ) : isDbFilterField ? (
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <Typography variant="body1" fontWeight="500">
                                                        {item.value === 'true' ? t('enabled') : t('disabled')}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setNewDbFilter(item.value === 'true');
                                                            setEditDbFilterOpen(true);
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            ) : (
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <Typography variant="body1" fontWeight="500">
                                                        {item.value}
                                                    </Typography>

                                                    {item.copyable && (
                                                        <Tooltip
                                                            title={copyStatus[index] ? t('copied') : t('copy')}
                                                            placement="top"
                                                        >
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => copyToClipboard(item.value, index)}
                                                            >
                                                                <CopyIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            )}
                                        </Stack>
                                    </Grid>
                                );
                            })}
                        </Grid>

                        {/* Odoo URL */}
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                {t('odooUrl')}
                            </Typography>
                            <TextField
                                size="small"
                                fullWidth
                                variant="outlined"
                                value={`http://localhost:${getPortValue()}`}
                                inputProps={{
                                    readOnly: true
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <div>
                                            <IconButton
                                                size="small"
                                                onClick={() => copyToClipboard(`http://localhost:${getPortValue()}`, 'url')}
                                            >
                                                <CopyIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    )
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {t('odooUrlDescription')}
                            </Typography>
                        </Box>

                        {/* Database manager URL */}
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                {t('databaseManagerUrl')}
                            </Typography>
                            <TextField
                                size="small"
                                fullWidth
                                variant="outlined"
                                value={`http://localhost:${getPortValue()}/web/database/manager`}
                                inputProps={{
                                    readOnly: true
                                }}
                                InputProps={{
                                    endAdornment: (
                                        <div>
                                            <IconButton
                                                size="small"
                                                onClick={() => copyToClipboard(`http://localhost:${getPortValue()}/web/database/manager`, 'dburl')}
                                            >
                                                <CopyIcon fontSize="small" />
                                            </IconButton>
                                        </div>
                                    )
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {t('databaseManagerUrlDescription')}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            );
        }
    };

    // Action buttons based on container type
    const renderActionButtons = () => {
        if (isPostgresInstance()) {
            return (
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                        <Button
                            variant="contained"
                            fullWidth
                            color="info"
                            startIcon={<FolderIcon />}
                            onClick={handleOpenDataFolder}
                        >
                            {t('openDataFolder')}
                        </Button>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <Tooltip
                            title={hasDependentInstances() ? t('cannotChangeCredentialsWithDependents') : ""}
                            placement="top"
                        >
                            <div style={{ width: '100%' }}>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    color="warning"
                                    startIcon={<EditIcon />}
                                    onClick={() => setEditDialogOpen(true)}
                                    disabled={hasDependentInstances()}
                                >
                                    {t('changeCredentials')}
                                </Button>
                            </div>
                        </Tooltip>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={handleClose}
                        >
                            {t('close')}
                        </Button>
                    </Grid>
                </Grid>
            );
        } else {
            // Odoo action buttons
            return (
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={<OpenInNewIcon />}
                            onClick={handleOpenBrowser}
                            disabled={!instanceRunning}
                        >
                            {t('openOdoo')}
                        </Button>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={<DatabaseIcon />}
                            onClick={handleOpenDbManager}
                            disabled={!instanceRunning}
                        >
                            {t('databaseManager')}
                        </Button>
                    </Grid>

                    <Grid item xs={12} sm={6} md={4}>
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={<CodeIcon />}
                            onClick={handleOpenConfig}
                        >
                            {t('openOdooConf')}
                        </Button>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={<FolderIcon />}
                            onClick={handleOpenAddons}
                        >
                            {t('exploreInstance')}
                        </Button>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={handleClose}
                        >
                            {t('close')}
                        </Button>
                    </Grid>
                </Grid>
            );
        }
    };

    // Render credential edit dialog for PostgreSQL
    const renderEditCredentialsDialog = () => {
        return (
            <Dialog open={editDialogOpen} onClose={() => !isUpdating && setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {t('changePostgresCredentials')}
                </DialogTitle>
                <DialogContent>
                    {hasDependentInstances() ? (
                        <MuiAlert severity="warning" sx={{ mb: 2 }}>
                            {t('postgresHasDependentsWarning')}
                        </MuiAlert>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('updatePostgresCredentialsInfo')}
                        </Typography>
                    )}

                    {updateMessage.message && updateMessage.severity && (
                        <MuiAlert severity={updateMessage.severity} sx={{ mb: 2 }}>
                            {updateMessage.message}
                        </MuiAlert>
                    )}

                    <TextField
                        fullWidth
                        margin="normal"
                        label={t('newUsername')}
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        disabled={isUpdating}
                        inputRef={usernameRef}
                        placeholder={t('enterNewUsername')}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label={t('newPassword')}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isUpdating}
                        inputRef={passwordRef}
                        placeholder={t('enterNewPassword')}
                        type={showPassword['passwordField'] ? 'text' : 'password'}
                        InputProps={{
                            endAdornment: (
                                <div>
                                    <IconButton
                                        onClick={() => setShowPassword(prev => ({
                                            ...prev,
                                            passwordField: !prev.passwordField
                                        }))}
                                    >
                                        {showPassword['passwordField'] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                    </IconButton>
                                </div>
                            )
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setEditDialogOpen(false)}
                        disabled={isUpdating}
                        startIcon={<CancelIcon />}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleUpdateCredentials}
                        variant="contained"
                        color="warning"
                        disabled={isUpdating || hasDependentInstances()}
                        startIcon={isUpdating ? <CircularProgress size={20} /> : <SaveIcon />}
                    >
                        {isUpdating ? t('updating') : t('updateCredentials')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    // Render DB filter edit dialog for Odoo
    const renderEditDbFilterDialog = () => {
        return (
            <Dialog open={editDbFilterOpen} onClose={() => !isUpdatingDbFilter && setEditDbFilterOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {t('changeDbFilterSetting')}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t('dbFilterDescription')}
                    </Typography>

                    {dbFilterUpdateMessage.message && dbFilterUpdateMessage.severity && (
                        <MuiAlert severity={dbFilterUpdateMessage.severity} sx={{ mb: 2 }}>
                            {dbFilterUpdateMessage.message}
                        </MuiAlert>
                    )}

                    <FormControl sx={{ mt: 2 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={newDbFilter}
                                    onChange={(e) => setNewDbFilter(e.target.checked)}
                                    disabled={isUpdatingDbFilter}
                                />
                            }
                            label={newDbFilter ? t('enabled') : t('disabled')}
                        />
                        <FormHelperText>
                            {newDbFilter
                                ? t('dbFilterPatternInfo', { pattern: `^${containerData?.containerName}.*$` })
                                : t('noDbFilterRestrictions')}
                        </FormHelperText>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setEditDbFilterOpen(false)}
                        disabled={isUpdatingDbFilter}
                        startIcon={<CancelIcon />}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleUpdateDbFilter}
                        variant="contained"
                        color="warning"
                        disabled={isUpdatingDbFilter}
                        startIcon={isUpdatingDbFilter ? <CircularProgress size={20} /> : <SaveIcon />}
                    >
                        {isUpdatingDbFilter ? t('updating') : t('updateDbFilter')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    if (!containerData) {
        return (
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                    <Typography variant="h6">{t('noContainerData')}</Typography>
                    <Button variant="contained" onClick={handleClose} sx={{ mt: 2 }}>
                        {t('close')}
                    </Button>
                </Paper>
            </Container>
        );
    }

    if (loading) {
        return (
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CircularProgress size={60} sx={{ mb: 3 }} />
                    <Typography variant="h6">{t('loadingContainerInfo')}</Typography>
                </Paper>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="sm" sx={{ py: 4 }}>
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                    <MuiAlert severity="error" sx={{ mb: 3 }}>{error}</MuiAlert>
                    <Button variant="contained" onClick={handleClose} sx={{ mt: 2 }}>
                        {t('close')}
                    </Button>
                </Paper>
            </Container>
        );
    }

    return (
        <>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{
                        p: 2,
                        backgroundColor: isPostgresInstance() ? 'info.dark' : 'primary.dark',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}>
                        {isPostgresInstance() ? <StorageIcon /> : <WebIcon />}
                        <Typography variant="h5" component="h1" fontWeight="bold">
                            {isPostgresInstance() ? t('postgresqlInstanceInfo') : t('odooInstanceInfo')}
                        </Typography>
                    </Box>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Box sx={{ p: 3 }}>
                            {/* Container Details */}
                            {renderContainerDetails()}

                            {/* Connection Information */}
                            {renderConnectionInformation()}

                            {/* Actions */}
                            <Box sx={{ mt: 4 }}>
                                <Typography variant="h6" gutterBottom>
                                    {t('actions')}
                                </Typography>

                                {renderActionButtons()}
                            </Box>

                            {/* Help information - conditional based on container type */}
                            <Box sx={{ mt: 4 }}>
                                <Divider sx={{ mb: 2 }} />

                                <Typography variant="body2" color="text.secondary">
                                    {isPostgresInstance() ? (
                                        <>
                                            <strong>{t('note')}:</strong> {t('postgresqlNote')}
                                        </>
                                    ) : (
                                        <>
                                            <strong>{t('note')}:</strong> {t('odooNote')}
                                            {isDbFilterEnabled() && (
                                                <> {t('dbFilterEnabledNote')}</>
                                            )}
                                        </>
                                    )}
                                </Typography>
                            </Box>
                        </Box>
                    </motion.div>
                </Paper>
            </Container>

            {/* Render credentials edit dialog for PostgreSQL */}
            {isPostgresInstance() && renderEditCredentialsDialog()}

            {/* Render DB filter edit dialog for Odoo */}
            {isOdooInstance() && renderEditDbFilterDialog()}
        </>
    );
};

export default ContainerInfoScreen;