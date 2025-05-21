// src/components/docker/ImageBuildDialog.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    CircularProgress,
    Alert,
    Paper,
    IconButton
} from '@mui/material';
import { Close as CloseIcon, Stop as StopIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import customImagesService, { BuildImageOptions } from '../../services/docker/customImagesService';
import { ipcRenderer } from 'electron';
import { logInfo, logError } from '../../services/utils/logger';

interface ImageBuildDialogProps {
    open: boolean;
    onClose: () => void;
    buildOptions: BuildImageOptions;
}

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.3
        }
    }
};

const ImageBuildDialog: React.FC<ImageBuildDialogProps> = ({ open, onClose, buildOptions }) => {
    const [building, setBuilding] = useState(false);
    const [buildComplete, setBuildComplete] = useState(false);
    const [buildSuccess, setBuildSuccess] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const logsEndRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Store a reference to the child process for cancellation
    const childProcessRef = useRef<any>(null);

    // Add a ref to track if the build has already been started
    const buildStartedRef = useRef(false);

    // Start build process when dialog opens
    useEffect(() => {
        if (open && !building && !buildComplete && !buildStartedRef.current) {
            // Mark that we've started the build to prevent duplicate starts
            buildStartedRef.current = true;
            startBuild();
        }

        // Reset the flag when the dialog closes
        if (!open) {
            buildStartedRef.current = false;
        }
    }, [open, building, buildComplete]);

    // Auto-scroll logs to bottom
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    // Handle dialog close
    const handleClose = () => {
        if (building) {
            // Show confirmation dialog before closing
            if (window.confirm('Building is in progress. Are you sure you want to cancel?')) {
                cancelBuild();
                onClose();
            }
        } else {
            onClose();
        }
    };

    // Start build process
    const startBuild = async () => {
        setBuilding(true);
        setBuildComplete(false);
        setBuildSuccess(false);
        setLogs([]);
        setErrorMessage('');

        try {
            // Add initial log messages
            addLog(`Starting build process for custom image: ${buildOptions.name}`);
            addLog(`Base Odoo version: ${buildOptions.baseVersion}`);
            addLog(`Python libraries to install: ${buildOptions.pythonLibraries.length}`);
            addLog(`System packages to install: ${buildOptions.systemPackages.length}`);
            addLog('\nPreparing build environment...');

            logInfo(`Starting build process for custom image: ${buildOptions.name}`, {
                baseVersion: buildOptions.baseVersion,
                pythonLibraries: buildOptions.pythonLibraries.length,
                systemPackages: buildOptions.systemPackages.length
            });

            // Start the actual build process
            await customImagesService.buildImage({
                ...buildOptions,
                onProgress: (message) => {
                    addLog(message);
                },
                onError: (error) => {
                    setErrorMessage(error);
                    addLog(`ERROR: ${error}`);
                    logError(`Image build error: ${error}`);
                },
                onComplete: (success, message) => {
                    setBuildComplete(true);
                    setBuildSuccess(success);
                    setBuilding(false);
                    addLog(message);

                    logInfo(`Build completed with ${success ? 'success' : 'failure'}: ${message}`);

                    // Show notification
                    ipcRenderer.invoke('show-message-dialog', {
                        type: success ? 'info' : 'error',
                        buttons: ['OK'],
                        title: success ? 'Build Completed' : 'Build Failed',
                        message: message
                    });
                }
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            setErrorMessage(errorMsg);
            addLog(`ERROR: ${errorMsg}`);
            setBuildComplete(true);
            setBuildSuccess(false);
            setBuilding(false);
            logError('Error starting image build process:', error);
        }
    };

    // Add log message
    const addLog = (message: string) => {
        // Split by newlines and add each line as a separate log entry
        const newLines = message.split('\n').filter(line => line.trim() !== '');
        setLogs(prevLogs => [...prevLogs, ...newLines]);
    };

    // Cancel build process
    const cancelBuild = () => {
        if (childProcessRef.current) {
            try {
                // Kill the child process
                childProcessRef.current.kill();
                addLog('Build process cancelled by user');
                logInfo('Build process cancelled by user');
            } catch (error) {
                logError('Error cancelling build:', error);
            }
        }

        setBuilding(false);
        setBuildComplete(true);
        setBuildSuccess(false);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    minHeight: '70vh'
                }
            }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">
                        {t('buildingCustomImage', { name: buildOptions.name })}
                    </Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {errorMessage && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errorMessage}
                        </Alert>
                    )}

                    {buildComplete && buildSuccess && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {t('customImageSuccess')}
                        </Alert>
                    )}

                    <Typography variant="subtitle2" gutterBottom>
                        {t('buildLogs')}
                    </Typography>

                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2,
                            height: '400px',
                            overflow: 'auto',
                            backgroundColor: '#1e1e1e',
                            color: '#f0f0f0',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {logs.map((log, index) => (
                            <Box
                                key={index}
                                component="div"
                                sx={{
                                    wordBreak: 'break-word',
                                    color: log.startsWith('ERROR') ? '#ff6b6b' :
                                        log.includes('Installing') ? '#4ec9b0' :
                                            log.includes('Downloading') ? '#9cdcfe' :
                                                log.includes('Successfully') ? '#b5cea8' :
                                                    '#f0f0f0'
                                }}
                            >
                                {log}
                            </Box>
                        ))}
                        <div ref={logsEndRef} />
                    </Paper>

                    {building && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            <Typography variant="body2">
                                {t('buildingImage')}
                            </Typography>
                        </Box>
                    )}
                </motion.div>
            </DialogContent>

            <DialogActions>
                {building ? (
                    <Button
                        color="error"
                        variant="outlined"
                        startIcon={<StopIcon />}
                        onClick={cancelBuild}
                    >
                        {t('cancelBuild')}
                    </Button>
                ) : (
                    <Button onClick={handleClose}>
                        {buildComplete ? t('close') : t('cancel')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ImageBuildDialog;