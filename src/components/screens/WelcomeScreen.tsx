// src/components/screens/WelcomeScreen.tsx
import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Checkbox,
    FormControlLabel,
    Divider,
    useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import TranslatedText from '../shared/TranslatedText';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Code as OdooIcon,
    Storage as DatabaseIcon,
    Add as AddIcon,
    DeveloperMode as FeatureIcon
} from '@mui/icons-material';

interface WelcomeScreenProps {
    onClose: () => void;
    onDontShowAgain: (dontShow: boolean) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onClose, onDontShowAgain }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [opacity, setOpacity] = useState(1);

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDontShowAgain(event.target.checked);
        onDontShowAgain(event.target.checked);
    };

    // In the handleClose function:
    const handleClose = () => {
        // Start the smooth fadeout animation
        setIsClosing(true);

        // Animate opacity from 1 to 0
        const fadeInterval = setInterval(() => {
            setOpacity(prevOpacity => {
                const newOpacity = prevOpacity - 0.20;

                if (newOpacity <= 0) {
                    clearInterval(fadeInterval);
                    // Call the onClose after the animation completes
                    setTimeout(() => onClose(), 100);
                    return 0;
                }
                return newOpacity;
            });
        }, 0.5);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: opacity }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: 800,
                    maxHeight: '80vh',
                    zIndex: 1000
                }}
            >
                <Paper
                    elevation={5}
                    sx={{
                        borderRadius: 3,
                        overflow: 'hidden',
                        bgcolor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 16px 38px -12px rgba(0,0,0,0.9), 0 4px 25px 0px rgba(0,0,0,0.7), 0 8px 10px -5px rgba(0,0,0,0.4)'
                            : '0 16px 38px -12px rgba(0,0,0,0.2), 0 4px 25px 0px rgba(0,0,0,0.1), 0 8px 10px -5px rgba(0,0,0,0.07)',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '80vh'
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            bgcolor: theme.palette.primary.main,
                            py: 2.5,
                            px: 4,
                            color: 'white',
                            background: theme.palette.mode === 'dark'
                                ? 'linear-gradient(135deg, #1976d2, #1565c0)'
                                : 'linear-gradient(135deg, #42a5f5, #1976d2)'
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <TranslatedText 
                                variant="h5" 
                                component="h1" 
                                sx={{ fontWeight: 'bold' }}
                                i18nKey="welcomeTitle"
                            />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <TranslatedText 
                                variant="subtitle2"
                                i18nKey="welcomeSubtitleAlt"
                            />
                        </motion.div>
                    </Box>

                    {/* Content */}
                    <Box sx={{ p: 3, overflow: 'auto' }}>
                        <TranslatedText 
                            variant="h6" 
                            gutterBottom 
                            fontSize="1rem"
                            i18nKey="gettingStarted"
                        />
                        <TranslatedText 
                            variant="body2" 
                            paragraph
                            i18nKey="gettingStartedDescription"
                        />

                        <Box sx={{ my: 2 }}>
                            {/* Feature 1 */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <OdooIcon color="primary" sx={{ mr: 2, fontSize: 24 }} />
                                    <TranslatedText 
                                        variant="subtitle1" 
                                        fontSize="0.95rem"
                                        i18nKey="manageOdooInstancesTitle"
                                    />
                                </Box>
                                <TranslatedText 
                                    variant="body2" 
                                    sx={{ pl: 5, mb: 2, fontSize: "0.85rem" }}
                                    i18nKey="manageOdooInstancesDescription"
                                />
                            </motion.div>

                            {/* Feature 2 */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <DatabaseIcon color="primary" sx={{ mr: 2, fontSize: 24 }} />
                                    <TranslatedText 
                                        variant="subtitle1" 
                                        fontSize="0.95rem"
                                        i18nKey="postgresqlDatabasesTitle"
                                    />
                                </Box>
                                <TranslatedText 
                                    variant="body2" 
                                    sx={{ pl: 5, mb: 2, fontSize: "0.85rem" }}
                                    i18nKey="postgresqlDatabasesDescription"
                                />
                            </motion.div>

                            {/* Feature 3 */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <AddIcon color="primary" sx={{ mr: 2, fontSize: 24 }} />
                                    <TranslatedText 
                                        variant="subtitle1" 
                                        fontSize="0.95rem"
                                        i18nKey="quickSetupTitle"
                                    />
                                </Box>
                                <TranslatedText 
                                    variant="body2" 
                                    sx={{ pl: 5, mb: 2, fontSize: "0.85rem" }}
                                    i18nKey="quickSetupDescription"
                                />
                            </motion.div>

                            {/* Feature 4 */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <FeatureIcon color="primary" sx={{ mr: 2, fontSize: 24 }} />
                                    <TranslatedText 
                                        variant="subtitle1" 
                                        fontSize="0.95rem"
                                        i18nKey="developerFriendlyTitle"
                                    />
                                </Box>
                                <TranslatedText 
                                    variant="body2" 
                                    sx={{ pl: 5, fontSize: "0.85rem" }}
                                    i18nKey="developerFriendlyDescription"
                                />
                            </motion.div>
                        </Box>
                    </Box>

                    <Divider />

                    {/* Footer with action buttons */}
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={dontShowAgain}
                                    onChange={handleCheckboxChange}
                                    size="small"
                                />
                            }
                            label={<Typography variant="caption">{t('dontShowAgain')}</Typography>}
                        />
                        <Box>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleClose}
                                size="small"
                                sx={{ px: 3 }}
                                disabled={isClosing}
                            >
                                {t('getStarted')}
                            </Button>
                        </Box>
                    </Box>
                </Paper>
            </motion.div>
        </AnimatePresence>
    );
};

export default WelcomeScreen;