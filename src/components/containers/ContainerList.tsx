// src/components/containers/ContainerList.tsx
import React from 'react';
import {
  Box,
  Card,
  Typography,
  CardContent,
  Button,
  Stack,
  Chip,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Article as LogsIcon,
  Info as InfoIcon,
  Launch as OpenIcon,
  Storage as DatabaseIcon
} from '@mui/icons-material';
import AnimatedContainerItem from './AnimatedContainerItem';

interface Container {
  name: string;
  status: string;
  port?: string;
}

interface ContainerListProps {
  containers: Container[];
  onStart: (name: string) => void;
  onStop: (name: string) => void;
  onDelete: (name: string) => void;
  onLogs: (name: string) => void;
  onInfo: (name: string) => void;
  onOpenBrowser?: (name: string, port: string) => void;
  onOpenDbManager?: (name: string, port: string) => void;
  containerType: 'odoo' | 'postgres';
}

// Container list animation variants
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      when: 'beforeChildren',
      delayChildren: 0.6,
      duration: 0.3
    }
  }
};

// Empty state animation variants
const emptyStateVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3,
      duration: 0.6,
      type: "spring",
      damping: 15,
      stiffness: 90
    }
  }
};

// Button animation variants
const buttonVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20,
      delay: 0.1
    }
  },
  hover: {
    scale: 1.05,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  },
  tap: {
    scale: 0.95,
    transition: {
      type: "spring",
      stiffness: 800,
      damping: 20
    }
  }
};

const ContainerList: React.FC<ContainerListProps> = ({
                                                       containers,
                                                       onStart,
                                                       onStop,
                                                       onDelete,
                                                       onLogs,
                                                       onInfo,
                                                       onOpenBrowser,
                                                       onOpenDbManager,
                                                       containerType
                                                     }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  // Determine status style based on container state
  const getStatusColor = (status: string) => {
    if (status.toLowerCase().includes('up')) {
      return {
        color: 'success.main',
        bgColor: alpha(theme.palette.success.main, 0.1),
        icon: '●'
      };
    } else if (status.toLowerCase().includes('exited')) {
      return {
        color: 'error.main',
        bgColor: alpha(theme.palette.error.main, 0.1),
        icon: '●'
      };
    } else if (status.toLowerCase().includes('created')) {
      return {
        color: 'info.main',
        bgColor: alpha(theme.palette.info.main, 0.1),
        icon: '●'
      };
    } else {
      return {
        color: 'text.secondary',
        bgColor: alpha(theme.palette.text.secondary, 0.1),
        icon: '○'
      };
    }
  };

  // Extract version from the container name
  const getContainerVersion = (name: string): string => {
    if (containerType === 'odoo') {
      const parts = name.split('_');
      return parts[1] || '';
    } else {
      // PostgreSQL container
      const parts = name.split('_');
      return parts[1] || '';
    }
  };

  return (
      <Box sx={{ mt: 2 }}>
        <AnimatePresence mode="wait">
          {containers.length === 0 ? (
              <motion.div
                  key="empty-state"
                  variants={emptyStateVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
              >
                <Card
                    sx={{
                      p: 5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderStyle: 'dashed',
                      borderWidth: 1,
                      borderColor: 'divider',
                      backgroundColor: 'transparent',
                      borderRadius: '16px',
                    }}
                >
                  <Typography variant="h6" color="text.secondary" align="center">
                    {containerType === 'odoo' ? t('noOdooContainers') : t('noPostgresContainers')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                    {t('clickToCreate', { type: containerType === 'odoo' ? 'Odoo' : 'PostgreSQL' })}
                  </Typography>
                </Card>
              </motion.div>
          ) : (
              <motion.div
                  key="container-list"
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
              >
                <Stack spacing={0}>
                  {containers.map((container, index) => {
                    const isRunning = container.status.toLowerCase().includes('up');
                    const statusStyle = getStatusColor(container.status);
                    const version = getContainerVersion(container.name);

                    return (
                        <AnimatedContainerItem key={container.name} index={index}>
                          <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="h6" fontWeight="bold">
                                    {container.name}
                                  </Typography>
                                  {version && (
                                      <Chip
                                          label={`v${version}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ borderRadius: 1 }}
                                      />
                                  )}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography
                                      variant="body2"
                                      component="span"
                                      sx={{
                                        color: statusStyle.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        '&::before': {
                                          content: '""',
                                          display: 'inline-block',
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          backgroundColor: statusStyle.color,
                                          mr: 1
                                        }
                                      }}
                                  >
                                    {container.status}
                                  </Typography>
                                </Box>
                              </Box>

                              <Stack direction="row" spacing={1}>
                                <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                  <Button
                                      variant="outlined"
                                      size="small"
                                      color="primary"
                                      disabled={isRunning}
                                      startIcon={<StartIcon />}
                                      onClick={() => onStart(container.name)}
                                      sx={{ minWidth: '90px' }}
                                  >
                                    {t('start')}
                                  </Button>
                                </motion.div>

                                <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                  <Button
                                      variant="outlined"
                                      size="small"
                                      color="error"
                                      disabled={!isRunning}
                                      startIcon={<StopIcon />}
                                      onClick={() => onStop(container.name)}
                                      sx={{ minWidth: '90px' }}
                                  >
                                    {t('stop')}
                                  </Button>
                                </motion.div>
                              </Stack>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              {/* DELETE BUTTON */}
                              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                <Button
                                    variant="text"
                                    size="small"
                                    color="error"
                                    disabled={isRunning}
                                    startIcon={<DeleteIcon />}
                                    onClick={() => onDelete(container.name)}
                                >
                                  {t('delete')}
                                </Button>
                              </motion.div>

                              {/* LOGS BUTTON */}
                              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<LogsIcon />}
                                    onClick={() => onLogs(container.name)}
                                >
                                  {t('logs')}
                                </Button>
                              </motion.div>

                              {/* INFO BUTTON */}
                              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<InfoIcon />}
                                    onClick={() => onInfo(container.name)}
                                >
                                  {t('info')}
                                </Button>
                              </motion.div>

                              {/* OPEN BROWSER BUTTON - Only for Odoo containers */}
                              {containerType === 'odoo' && onOpenBrowser && container.port && (
                                  <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                    <Button
                                        variant="text"
                                        size="small"
                                        color="primary"
                                        startIcon={<OpenIcon />}
                                        onClick={() => onOpenBrowser(container.name, container.port || '8069')}
                                        disabled={!isRunning}
                                    >
                                      {t('open')}
                                    </Button>
                                  </motion.div>
                              )}

                              {containerType === 'odoo' && onOpenDbManager && container.port && (
                                  <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                                    <Button
                                        variant="text"
                                        size="small"
                                        color="primary"
                                        startIcon={<DatabaseIcon />}
                                        onClick={() => onOpenDbManager(container.name, container.port || '8069')}
                                        disabled={!isRunning}
                                    >
                                      {t('dbManager')}
                                    </Button>
                                  </motion.div>
                              )}
                            </Box>
                          </CardContent>
                        </AnimatedContainerItem>
                    );
                  })}
                </Stack>
              </motion.div>
          )}
        </AnimatePresence>
      </Box>
  );
};

export default ContainerList;