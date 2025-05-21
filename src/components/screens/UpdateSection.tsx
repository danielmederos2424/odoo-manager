// src/components/screens/UpdateSection.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Skeleton,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
  Paper,
  Chip,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAppVersion } from '../../hooks/useAppVersion';
import manualUpdateService, { UpdateCheckResult } from '../../services/update/manualUpdateService';
import settingsService from '../../services/settings/settingsService';
import { logDebug, logError, logInfo } from '../../services/utils/logger';

// Markdown parser (to be installed: npm install marked)
import { marked } from 'marked';

// Component props interface
interface UpdateSectionProps {
  itemVariants: any; // Animation variants
}

// Function to format bytes to a readable format
const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const UpdateSection: React.FC<UpdateSectionProps> = ({ itemVariants }) => {
  const { t } = useTranslation();
  const appVersion = useAppVersion();
  
  // State for update check
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [lastChecked, setLastChecked] = useState<string>(t('neverChecked'));
  
  // Auto-update settings
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true);
  const [updateCheckFrequency, setUpdateCheckFrequency] = useState<'daily' | 'weekly'>('daily');
  const [showUpdateNotifications, setShowUpdateNotifications] = useState(true);
  
  // Load settings from service
  useEffect(() => {
    const loadUpdateSettings = async () => {
      try {
        const settings = await settingsService.loadSettings();
        if (settings) {
          setAutoCheckUpdates(settings.autoCheckUpdates !== false);
          setUpdateCheckFrequency(settings.updateCheckFrequency || 'daily');
          setShowUpdateNotifications(settings.showUpdateNotifications !== false);
          
          // Get last checked time
          if (settings.lastUpdateCheck) {
            try {
              const date = new Date(settings.lastUpdateCheck);
              setLastChecked(t('lastChecked', { date: date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}) as string);
            } catch (error) {
              setLastChecked(t('lastChecked', { date: settings.lastUpdateCheck }) as string);
            }
          } else {
            setLastChecked(t('neverChecked'));
          }
        }
      } catch (error) {
        logError('Error loading update settings', error);
      }
    };
    
    // Initialize update service
    manualUpdateService.initialize().then(() => {
      loadUpdateSettings();
    });
  }, [t]);
  
  // Handle settings changes
  const handleAutoCheckChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setAutoCheckUpdates(newValue);
    await settingsService.updateSettings({ autoCheckUpdates: newValue });
  };
  
  const handleFrequencyChange = async (event: React.ChangeEvent<{ value: unknown }>) => {
    const newValue = event.target.value as 'daily' | 'weekly';
    setUpdateCheckFrequency(newValue);
    await settingsService.updateSettings({ updateCheckFrequency: newValue });
  };
  
  const handleNotificationsChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setShowUpdateNotifications(newValue);
    await settingsService.updateSettings({ showUpdateNotifications: newValue });
  };
  
  // Check for updates
  const checkForUpdates = async () => {
    setChecking(true);
    setCheckError(null);
    
    try {
      logInfo('Manually checking for updates');
      const result = await manualUpdateService.checkForUpdates();
      setUpdateResult(result);
      
      // Update last checked time
      if (result.lastChecked) {
        setLastChecked(t('lastChecked', { date: result.lastChecked.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}) as string);
      }
      
      logDebug('Update check result', result);
    } catch (error) {
      logError('Error checking for updates', error);
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };
  
  // Handle download click
  const handleDownload = async () => {
    try {
      if (updateResult && updateResult.downloadUrl) {
        await manualUpdateService.openDownloadPage(updateResult.downloadUrl);
      }
    } catch (error) {
      logError('Error opening download page', error);
      setCheckError(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Handle asset download
  const handleAssetDownload = async (url: string) => {
    try {
      await manualUpdateService.openDownloadPage(url);
    } catch (error) {
      logError('Error opening asset download page', error);
      setCheckError(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Render platform name
  const renderPlatformName = (platform: string): string => {
    if (platform.includes('win')) return t('platformWin');
    if (platform.includes('mac') || platform.includes('darwin')) return t('platformMac');
    if (platform.includes('linux')) return t('platformLinux');
    return platform;
  };
  
  // Render the update status section
  const renderUpdateStatus = () => {
    if (checking) {
      return (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <CircularProgress size={40} thickness={4} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            {t('checkingForUpdates')}
          </Typography>
        </Box>
      );
    }
    
    if (checkError) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            {t('updateCheckFailure')}
          </Typography>
          <Typography variant="body2">
            {checkError}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {t('tryAgainLater')}
          </Typography>
        </Alert>
      );
    }
    
    if (!updateResult) {
      return (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1">
            {t('noUpdateCheckPerformed')}
          </Typography>
        </Box>
      );
    }
    
    if (updateResult.hasUpdate) {
      return (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="medium">
              {t('updateAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('updateAvailableDesc')}
            </Typography>
          </Alert>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('currentVersion')}
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                v{updateResult.currentVersion}
              </Typography>
            </Box>
            
            <Box sx={{ mx: 2, display: 'flex', alignItems: 'center' }}>
              <DownloadIcon sx={{ color: 'primary.main' }} />
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('newVersion')}
              </Typography>
              <Typography variant="h6" color="primary" sx={{ fontFamily: 'monospace' }}>
                v{updateResult.latestVersion}
              </Typography>
            </Box>
          </Box>
          
          {updateResult.latestRelease && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('releaseDate', { date: new Date(updateResult.latestRelease.published_at).toLocaleDateString() })}
              </Typography>
            </Box>
          )}
          
          {/* Platform-specific download options */}
          {updateResult.platformAssets && updateResult.platformAssets.length > 0 && (
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('downloadOptionsForYourPlatform')}
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {updateResult.platformAssets.map((asset, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    color="primary"
                    size="medium"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleAssetDownload(asset.browser_download_url)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <Typography variant="body2">
                        {asset.name}
                      </Typography>
                      <Chip 
                        label={formatBytes(asset.size)} 
                        size="small" 
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </Button>
                ))}
              </Box>
            </Box>
          )}
          
          {/* Download button for manual update */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={!updateResult.downloadUrl}
              sx={{ mb: 2 }}
            >
              {t('visitDownloadPage')}
            </Button>
          </Box>
          
          {/* Release notes section */}
          {updateResult.releaseNotes && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                {t('releaseNotes')}
              </Typography>
              
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  maxHeight: '300px',
                  overflow: 'auto',
                  bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                }}
              >
                <Box
                  dangerouslySetInnerHTML={{
                    __html: marked(updateResult.releaseNotes)
                  }}
                  sx={{
                    '& a': {
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      }
                    },
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto'
                    },
                    '& pre, & code': {
                      fontFamily: 'monospace',
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                      p: 1,
                      borderRadius: 1
                    }
                  }}
                />
              </Paper>
            </Box>
          )}
        </Box>
      );
    }
    
    // Up to date
    return (
      <Box sx={{ mt: 2, textAlign: 'center', py: 2 }}>
        <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h6" color="success.main" gutterBottom>
          {t('upToDate')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('currentVersion')}: v{updateResult.currentVersion}
        </Typography>
      </Box>
    );
  };
  
  return (
    <motion.div variants={itemVariants}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" color="primary" gutterBottom>
          {t('odooManagerVersion', { version: appVersion })}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {lastChecked}
        </Typography>
        
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={checkForUpdates}
            disabled={checking}
          >
            {t('checkForUpdates')}
          </Button>
        </Box>
      </Box>
      
      {/* Update Status */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          {renderUpdateStatus()}
        </CardContent>
      </Card>
      
      {/* Auto-Update Settings */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3
        }}
      >
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          {t('autoUpdateSettings')}
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={autoCheckUpdates}
              onChange={handleAutoCheckChange}
              color="primary"
            />
          }
          label={t('autoCheckUpdates')}
        />
        
        {autoCheckUpdates && (
          <Box sx={{ ml: 4, mt: 1 }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="update-frequency-label">{t('autoCheckFrequency')}</InputLabel>
              <Select
                labelId="update-frequency-label"
                value={updateCheckFrequency}
                onChange={handleFrequencyChange as any}
                label={t('autoCheckFrequency')}
              >
                <MenuItem value="daily">{t('autoCheckDaily')}</MenuItem>
                <MenuItem value="weekly">{t('autoCheckWeekly')}</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showUpdateNotifications}
                    onChange={handleNotificationsChange}
                    color="primary"
                  />
                }
                label={t('updateNotificationsEnabled')}
              />
            </Box>
          </Box>
        )}
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('manualUpdateNote')}
          </Typography>
        </Box>
      </Paper>
    </motion.div>
  );
};

export default UpdateSection;