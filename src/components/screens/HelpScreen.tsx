// src/components/screens/HelpScreen.tsx
import React from 'react';
import { Typography, Button, Box, Container, Paper, Grid, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    Info as InfoIcon,
    Storage as StorageIcon,
    Settings as SettingsIcon,
    Code as CodeIcon,
    GitHub as GitHubIcon,
    Layers as LayersIcon
} from '@mui/icons-material';
import { getElectronAPI } from '../../utils/electron';
import { useAppVersion } from '../../hooks/useAppVersion';

// type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'button' | 'overline' | 'inherit';

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

const HelpScreen: React.FC = () => {
    const { t } = useTranslation();
    
    const handleClose = () => {
        window.close();
    };

    const openGitHub = () => {
        const electron = getElectronAPI();
        if (electron) {
            electron.shell.openExternal('https://github.com/danielmederos2424/odoo-manager');
        } else {
            window.open('https://github.com/danielmederos2424/odoo-manager', '_blank');
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                    <motion.div variants={itemVariants}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            mb: 4,
                            pb: 2,
                            borderBottom: '1px solid',
                            borderColor: 'divider'
                        }}>
                            <InfoIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                            <Typography variant="h4" component="h1" fontWeight="bold">
                                {t('odooManagerHelp')}
                            </Typography>
                        </Box>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                            <StorageIcon sx={{ mr: 1, color: 'secondary.main' }} />
                            {t('gettingStarted')}
                        </Typography>
                        <Typography variant="body1" component="div" sx={{ mb: 2 }}>
                            <strong>{t('prerequisites')}:</strong> {t('prerequisitesDesc')}
                        </Typography>
                        <Box component="ol" sx={{ pl: 3, mb: 2 }}>
                            <Box component="li" sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">{t('setupEnvironment')}</Typography>
                                <Typography variant="body2">
                                    {t('setupEnvironmentDesc')}
                                </Typography>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">{t('downloadImages')}</Typography>
                                <Typography variant="body2">
                                    {t('helpDownloadImagesDesc')}
                                </Typography>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">{t('createFirstInstance')}</Typography>
                                <Typography variant="body2">
                                    {t('createFirstInstanceDesc')}
                                </Typography>
                            </Box>
                        </Box>
                    </motion.div>

                    <Divider sx={{ my: 3 }} />

                    <motion.div variants={itemVariants}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                            <LayersIcon sx={{ mr: 1, color: 'secondary.main' }} />
                            {t('commonTasks')}
                        </Typography>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} md={6}>
                                <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                                    <Typography variant="subtitle1" component="div" fontWeight="bold" gutterBottom>
                                        {t('managingInstances')}
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('startStop')}:</strong> {t('startStopDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('viewLogs')}:</strong> {t('viewLogsDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('accessInfo')}:</strong> {t('accessInfoDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('deleteAction')}:</strong> {t('deleteDesc')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                                    <Typography variant="subtitle1" component="div" fontWeight="bold" gutterBottom>
                                        {t('workingWithCustomImages')}
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('createAction')}:</strong> {t('createDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('addLibraries')}:</strong> {t('addLibrariesDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('buildAction')}:</strong> {t('buildDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('use')}:</strong> {t('useDesc')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                                    <Typography variant="subtitle1" component="div" fontWeight="bold" gutterBottom>
                                        {t('developingWithOdoo')}
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('mountAddons')}:</strong> {t('mountAddonsDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('viewConfig')}:</strong> {t('viewConfigDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('debugMode')}:</strong> {t('debugModeDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('databaseAccess')}:</strong> {t('databaseAccessDesc')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                                    <Typography variant="subtitle1" component="div" fontWeight="bold" gutterBottom>
                                        {t('troubleshooting')}
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('containerErrors')}:</strong> {t('containerErrorsDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('portConflicts')}:</strong> {t('portConflictsDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('dockerIssues')}:</strong> {t('dockerIssuesDesc')}
                                            </Typography>
                                        </Box>
                                        <Box component="li" sx={{ mb: 0.5 }}>
                                            <Typography variant="body2">
                                                <strong>{t('resetInstance')}:</strong> {t('resetInstanceDesc')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>
                    </motion.div>

                    <Divider sx={{ my: 3 }} />

                    <motion.div variants={itemVariants}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                            <SettingsIcon sx={{ mr: 1, color: 'secondary.main' }} />
                            {t('applicationSettings')}
                        </Typography>
                        <Box sx={{ pl: 1 }}>
                            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                                <strong>{t('languageTheme')}:</strong> {t('languageThemeDesc')}
                            </Typography>
                            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                                <strong>{t('workingDirectory')}:</strong> {t('workingDirectoryDesc')}
                            </Typography>
                            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                                <strong>{t('dockerImages')}:</strong> {t('dockerImagesDesc')}
                            </Typography>
                            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                                <strong>{t('customImages')}:</strong> {t('customImagesDesc')}
                            </Typography>
                        </Box>
                    </motion.div>

                    <Divider sx={{ my: 3 }} />

                    <motion.div variants={itemVariants}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                            <CodeIcon sx={{ mr: 1, color: 'secondary.main' }} />
                            {t('technicalInformation')}
                        </Typography>
                        <Box sx={{ pl: 1 }}>
                            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                                <strong>{t('configLocation')}:</strong> {t('configLocationDesc')}
                                <Box component="ul" sx={{ pl: 3, mt: 0.5 }}>
                                    <Box component="li"><Typography variant="body2">{t('windows')}</Typography></Box>
                                    <Box component="li"><Typography variant="body2">{t('macos')}</Typography></Box>
                                    <Box component="li"><Typography variant="body2">{t('linux')}</Typography></Box>
                                </Box>
                            </Typography>
                            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                                <strong>{t('instanceStructure')}:</strong> {t('instanceStructureDesc')}
                                <Box component="ul" sx={{ pl: 3, mt: 0.5 }}>
                                    <Box component="li"><Typography variant="body2">{t('dockerComposeYml')}</Typography></Box>
                                    <Box component="li"><Typography variant="body2">{t('odooConf')}</Typography></Box>
                                    <Box component="li"><Typography variant="body2">{t('addonsDir')}</Typography></Box>
                                    <Box component="li"><Typography variant="body2">{t('dataDir')}</Typography></Box>
                                </Box>
                            </Typography>
                            <Typography variant="body2" component="div">
                                <strong>{t('requirements')}:</strong> {t('requirementsDesc')}
                            </Typography>
                        </Box>
                    </motion.div>

                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <Button
                            variant="outlined"
                            startIcon={<GitHubIcon />}
                            onClick={openGitHub}
                        >
                            {t('githubRepository')}
                        </Button>
                        <Button variant="contained" onClick={handleClose}>
                            {t('close')}
                        </Button>
                    </Box>

                    <Typography
                        variant="caption"
                        component="div"
                        sx={{ mt: 4, display: 'block', textAlign: 'center', opacity: 0.7 }}
                    >
                        {t('odooManagerCredit', { version: useAppVersion() })}
                    </Typography>
                </Paper>
            </motion.div>
        </Container>
    );
};

export default HelpScreen;