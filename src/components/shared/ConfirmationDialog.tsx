// src/components/shared/ConfirmationDialog.tsx
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    IconButton
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
    Warning as WarningIcon,
    Close as CloseIcon
} from '@mui/icons-material';

interface ConfirmationDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    severity?: 'warning' | 'error' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
                                                                   open,
                                                                   title,
                                                                   message,
                                                                   confirmText,
                                                                   cancelText,
                                                                   severity = 'warning',
                                                                   onConfirm,
                                                                   onCancel
                                                               }) => {
    const { t } = useTranslation();
    // Set default values using translation
    const defaultConfirmText = t('confirm');
    const defaultCancelText = t('cancel');
                                                                   
    const getIconColor = () => {
        switch (severity) {
            case 'error':
                return 'error.main';
            case 'info':
                return 'info.main';
            case 'warning':
            default:
                return 'warning.main';
        }
    };

    const getIcon = () => {
        switch (severity) {
            case 'error':
                return <WarningIcon color="error" sx={{ fontSize: 40 }} />;
            case 'info':
                return <WarningIcon color="info" sx={{ fontSize: 40 }} />;
            case 'warning':
            default:
                return <WarningIcon color="warning" sx={{ fontSize: 40 }} />;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    p: 1
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getIcon()}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                        {title}
                    </Typography>
                </Box>
                <IconButton onClick={onCancel} edge="end" size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                <Typography variant="body1">{message}</Typography>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    variant="outlined"
                    onClick={onCancel}
                >
                    {cancelText || defaultCancelText}
                </Button>
                <Button
                    variant="contained"
                    onClick={onConfirm}
                    color={severity === 'error' ? 'error' : severity === 'info' ? 'primary' : 'warning'}
                    autoFocus
                >
                    {confirmText || defaultConfirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmationDialog;