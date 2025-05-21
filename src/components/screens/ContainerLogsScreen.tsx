// src/components/screens/ContainerLogsScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Typography,
    Container,
    Paper,
    Button,
    TextField,
    FormControl,
    InputLabel,
    SelectChangeEvent,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert,
    useTheme,
    Theme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CopyIcon from '@mui/icons-material/ContentCopy';
import { isElectron, getElectronAPI } from '../../utils/electron';
import { logInfo, logError } from '../../services/utils/logger';

interface ContainerLogsData {
    containerName: string;
}

interface ContainerLogsScreenProps {
    data?: ContainerLogsData | null;
}

interface LogEntry {
    text: string;
    timestamp?: Date;
    type?: 'info' | 'warning' | 'error' | 'debug';
    highlighted?: boolean;
}

type TimeFilter = 'last_hour' | 'last_2_hours' | 'last_6_hours' | 'all';

const ContainerLogsScreen: React.FC<ContainerLogsScreenProps> = ({ data }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [containerName, setContainerName] = useState<string>('');
    const [rawLogs, setRawLogs] = useState<string>('Loading logs...');
    const [parsedLogs, setParsedLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('last_hour');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);
    const [error, setError] = useState<string | null>(null);
    const [savingLogs, setSavingLogs] = useState<boolean>(false);
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
    const [fetchInProgress, setFetchInProgress] = useState<boolean>(false);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const logEntryRefs = useRef<(HTMLDivElement | null)[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (data?.containerName) {
            setContainerName(data.containerName);
            void fetchLogs(data.containerName, timeFilter);
        }
    }, [data]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!containerName || fetchInProgress) return;

        const debounceTimer = setTimeout(() => {
            void fetchLogs(containerName, timeFilter);
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [timeFilter, containerName]);

    useEffect(() => {
        if (searchQuery) {
            performSearch(searchQuery);
        } else {
            setSearchResults([]);
            setCurrentSearchIndex(-1);
        }
    }, [parsedLogs]);

    const parseLogsWithHighlighting = (logsText: string): LogEntry[] => {
        if (!logsText || logsText === 'Loading logs...') {
            return [{ text: logsText }];
        }

        const lines = logsText.split('\n').filter(line => line.trim());

        return lines.map(line => {
            const entry: LogEntry = { text: line };

            if (line.toLowerCase().includes('error') || line.includes('ERROR') || line.includes('FAIL')) {
                entry.type = 'error';
            } else if (line.toLowerCase().includes('warn') || line.includes('WARNING')) {
                entry.type = 'warning';
            } else if (line.toLowerCase().includes('info') || line.includes('INFO')) {
                entry.type = 'info';
            } else if (line.toLowerCase().includes('debug')) {
                entry.type = 'debug';
            }

            const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
            if (timestampMatch) {
                entry.timestamp = new Date(timestampMatch[0]);
            }

            return entry;
        });
    };

    const fetchLogs = async (name: string, filter: TimeFilter): Promise<void> => {
        if (fetchInProgress) {
            logInfo('Fetch already in progress, skipping...');
            return;
        }

        setLoading(true);
        setError(null);
        setFetchInProgress(true);

        const tailCount = filter === 'all' ? 1000 : 100;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setLoading(false);
            setFetchInProgress(false);
            setError("Log fetching timed out. The container might not have any logs or Docker is busy.");
        }, 30000);

        if (isElectron()) {
            try {
                logInfo(`Fetching logs for ${name} with filter ${filter}`);
                const electron = getElectronAPI();

                if (!electron?.ipcRenderer) {
                    throw new Error('IPC Renderer not available');
                }

                const response = await electron.ipcRenderer.invoke('docker-operation', {
                    operation: 'get-logs',
                    params: {
                        instanceName: name,
                        service: 'auto',
                        tail: tailCount,
                        timeFilter: filter
                    }
                });

                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }

                setLoading(false);
                setFetchInProgress(false);
                logInfo(`Logs response received for ${name}`);

                if (response && response.success && response.logs) {
                    setRawLogs(response.logs);
                    setParsedLogs(parseLogsWithHighlighting(response.logs));
                } else {
                    setError(`Error fetching logs: ${response ? response.message : 'No response received'}`);
                    setRawLogs('');
                    setParsedLogs([]);
                }
            } catch (error) {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }

                logError("Error fetching logs", error);
                setLoading(false);
                setFetchInProgress(false);
                setError(`Error fetching logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
                setRawLogs('');
                setParsedLogs([]);
            }
        }
        else {
            setTimeout(() => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }

                setLoading(false);
                setFetchInProgress(false);
                const mockLogs = generateMockLogs(filter);
                setRawLogs(mockLogs);
                setParsedLogs(parseLogsWithHighlighting(mockLogs));
            }, 1000);
        }
    };

    const generateMockLogs = (filter: TimeFilter): string => {
        const now = new Date();
        const logEntries = [];

        let hoursBack: number;
        switch (filter) {
            case 'last_hour': hoursBack = 1; break;
            case 'last_2_hours': hoursBack = 2; break;
            case 'last_6_hours': hoursBack = 6; break;
            case 'all': hoursBack = 24; break;
            default: hoursBack = 1;
        }

        for (let i = 0; i < 100; i++) {
            const randomTime = new Date(now.getTime() - Math.random() * hoursBack * 60 * 60 * 1000);
            const timestamp = randomTime.toISOString().replace('T', ' ').slice(0, 19);

            const logTypes = [
                `${timestamp} INFO Odoo Server starting at ${timestamp}`,
                `${timestamp} INFO Loading module 'web' (1/42)`,
                `${timestamp} WARNING module_name: Deprecated feature used`,
                `${timestamp} ERROR Database connection failed: could not connect to server`,
                `${timestamp} INFO Database connected successfully`,
                `${timestamp} DEBUG Executing query: SELECT * FROM res_users`,
            ];

            logEntries.push(logTypes[Math.floor(Math.random() * logTypes.length)]);
        }

        return logEntries.sort((a, b) => {
            const timeA = new Date(a.slice(0, 19));
            const timeB = new Date(b.slice(0, 19));
            return timeA.getTime() - timeB.getTime();
        }).join('\n');
    };

    const handleRefresh = () => {
        if (containerName && !fetchInProgress) {
            setSearchQuery('');
            setSearchResults([]);
            setCurrentSearchIndex(-1);
            void fetchLogs(containerName, timeFilter);
        }
    };

    const handleClose = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        window.close();
    };

    const handleTimeFilterChange = (event: SelectChangeEvent<string>) => {
        setTimeFilter(event.target.value as TimeFilter);
    };

    const performSearch = (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setCurrentSearchIndex(-1);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const results: number[] = [];

        parsedLogs.forEach((log, index) => {
            if (log.text.toLowerCase().includes(lowerQuery)) {
                results.push(index);
            }
        });

        setSearchResults(results);
        setCurrentSearchIndex(results.length > 0 ? 0 : -1);

        if (results.length > 0) {
            scrollToLogLine(results[0]);
        }
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    };

    const handleSearchKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            performSearch(searchQuery);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(-1);
    };

    const navigateSearch = (direction: 'next' | 'prev') => {
        if (searchResults.length === 0) return;

        let newIndex;
        if (direction === 'next') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }

        setCurrentSearchIndex(newIndex);
        scrollToLogLine(searchResults[newIndex]);
    };

    const scrollToLogLine = (index: number) => {
        if (logEntryRefs.current[index]) {
            logEntryRefs.current[index]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    };

    const scrollToTop = () => {
        logsContainerRef.current?.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleCopyLogs = () => {
        if (navigator.clipboard && rawLogs) {
            navigator.clipboard.writeText(rawLogs)
                .then(() => {
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 2000);
                })
                .catch(err => {
                    logError('Failed to copy logs to clipboard', err);
                    setError('Failed to copy logs to clipboard');
                });
        }
    };

    const handleSaveLogs = async () => {
        if (!isElectron() || !rawLogs) return;

        try {
            setSavingLogs(true);
            const electron = getElectronAPI();

            if (!electron?.ipcRenderer) {
                throw new Error('IPC Renderer not available');
            }

            const result = await electron.ipcRenderer.invoke('show-save-dialog', {
                title: 'Save Logs',
                defaultPath: `${containerName}-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`,
                filters: [
                    { name: 'Text Files', extensions: ['txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result.canceled || !result.filePath) {
                setSavingLogs(false);
                return;
            }

            const fs = window.require('fs');
            fs.writeFileSync(result.filePath, rawLogs, 'utf8');
            logInfo(`Logs saved to ${result.filePath}`);

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            logError('Error saving logs', error);
            setError(`Failed to save logs: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setSavingLogs(false);
        }
    };

    const logsAvailable = () => {
        return !loading && rawLogs && rawLogs !== 'Loading logs...' && parsedLogs.length > 0;
    };

    logEntryRefs.current = parsedLogs.map((_, i) => logEntryRefs.current[i] || null);

    const getBackgroundColor = (isHighlighted: boolean, theme: Theme): string => {
        if (isHighlighted) {
            return theme.palette.mode === 'dark' ? '#2c4f7c' : '#b3e5fc';
        }
        return 'transparent';
    };

    const getTextColor = (logType: LogEntry['type'] | undefined, theme: Theme): string => {
        if (logType === 'error') {
            return theme.palette.error.main;
        } else if (logType === 'warning') {
            return theme.palette.warning.main;
        } else if (logType === 'debug') {
            return theme.palette.mode === 'dark' ? '#7986cb' : '#3949ab';
        }
        return 'inherit';
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5" component="h1" fontWeight="bold">
                            {t('logsForContainer', { name: containerName })}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={handleRefresh}
                                startIcon={<RefreshIcon />}
                                disabled={loading || fetchInProgress}
                            >
                                {loading || fetchInProgress ? t('loading') : t('refresh')}
                            </Button>
                            <Button variant="outlined" onClick={handleClose}>
                                {t('close')}
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <FormControl variant="outlined" size="small" sx={{ minWidth: 180 }}>
                            <InputLabel id="time-filter-label">{t('timeRange')}</InputLabel>
                            <Select
                                labelId="time-filter-label"
                                value={timeFilter}
                                onChange={handleTimeFilterChange}
                                label={t('timeRange')}
                                disabled={loading || fetchInProgress}
                            >
                                <MenuItem value="last_hour">{t('lastHour')}</MenuItem>
                                <MenuItem value="last_2_hours">{t('last2Hours')}</MenuItem>
                                <MenuItem value="last_6_hours">{t('last6Hours')}</MenuItem>
                                <MenuItem value="all">{t('allLogs')}</MenuItem>
                            </Select>
                        </FormControl>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                                size="small"
                                placeholder={t('searchLogs')}
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearchKeyDown}
                                disabled={loading || fetchInProgress || parsedLogs.length === 0}
                                InputProps={{
                                    startAdornment: (
                                        <SearchIcon fontSize="small" sx={{ ml: 1, mr: 0.5 }} />
                                    ),
                                    endAdornment: searchQuery ? (
                                        <IconButton
                                            size="small"
                                            onClick={handleClearSearch}
                                            edge="end"
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    ) : null
                                }}
                            />
                            <Button
                                variant="contained"
                                size="small"
                                onClick={() => performSearch(searchQuery)}
                                disabled={!searchQuery || loading || fetchInProgress || parsedLogs.length === 0}
                            >
                                {t('search')}
                            </Button>

                            {searchResults.length > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" sx={{ mx: 1 }}>
                                        {currentSearchIndex + 1} of {searchResults.length}
                                    </Typography>
                                    <Box sx={{ display: 'flex' }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => navigateSearch('prev')}
                                            disabled={searchResults.length <= 1}
                                        >
                                            <ArrowUpwardIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => navigateSearch('next')}
                                            disabled={searchResults.length <= 1}
                                        >
                                            <ArrowDownwardIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {saveSuccess && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {savingLogs ? t('logsSaved') : t('logsCopied')}
                        </Alert>
                    )}

                    <Box
                        sx={{
                            position: 'relative',
                            height: '60vh',
                        }}
                    >
                        {loading || fetchInProgress ? (
                            <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                height: '100%'
                            }}>
                                <CircularProgress />
                                <Typography sx={{ mt: 2 }}>
                                    {fetchInProgress ? t('fetchingLogs') : t('loadingLogs')}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                <Paper
                                    ref={logsContainerRef}
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        height: '100%',
                                        overflow: 'auto',
                                        backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f8f8f8',
                                        color: theme.palette.mode === 'dark' ? '#f0f0f0' : '#333',
                                        fontFamily: 'monospace',
                                        fontSize: '0.85rem',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        position: 'relative',
                                    }}
                                >
                                    {parsedLogs.length === 0 ? (
                                        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 10 }}>
                                            {t('noLogsFound')}
                                        </Typography>
                                    ) : (
                                        parsedLogs.map((log, index) => {
                                            const isHighlighted = searchResults.includes(index) &&
                                                currentSearchIndex !== -1 &&
                                                searchResults[currentSearchIndex] === index;

                                            return (
                                                <Box
                                                    key={index}
                                                    ref={el => {
                                                        logEntryRefs.current[index] = el as HTMLDivElement | null;
                                                    }}
                                                    component="div"
                                                    sx={{
                                                        py: 0.5,
                                                        px: 1,
                                                        backgroundColor: getBackgroundColor(isHighlighted, theme),
                                                        color: getTextColor(log.type, theme),
                                                        borderBottom: '1px solid',
                                                        borderColor: 'divider',
                                                        '&:hover': {
                                                            backgroundColor: theme.palette.mode === 'dark'
                                                                ? 'rgba(255, 255, 255, 0.05)'
                                                                : 'rgba(0, 0, 0, 0.02)',
                                                        },
                                                        transition: 'background-color 0.2s',
                                                    }}
                                                >
                                                    {log.text}
                                                </Box>
                                            );
                                        })
                                    )}
                                    <div ref={logsEndRef} />
                                </Paper>

                                <Box sx={{
                                    position: 'absolute',
                                    right: 16,
                                    bottom: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1
                                }}>
                                    <Tooltip title={t('scrollToTop')}>
                                        <IconButton
                                            size="small"
                                            onClick={scrollToTop}
                                            sx={{
                                                backgroundColor: theme.palette.mode === 'dark'
                                                    ? 'rgba(0, 0, 0, 0.5)'
                                                    : 'rgba(255, 255, 255, 0.8)',
                                                '&:hover': {
                                                    backgroundColor: theme.palette.mode === 'dark'
                                                        ? 'rgba(0, 0, 0, 0.7)'
                                                        : 'rgba(255, 255, 255, 0.9)',
                                                }
                                            }}
                                        >
                                            <ArrowUpwardIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={t('scrollToBottom')}>
                                        <IconButton
                                            size="small"
                                            onClick={scrollToBottom}
                                            sx={{
                                                backgroundColor: theme.palette.mode === 'dark'
                                                    ? 'rgba(0, 0, 0, 0.5)'
                                                    : 'rgba(255, 255, 255, 0.8)',
                                                '&:hover': {
                                                    backgroundColor: theme.palette.mode === 'dark'
                                                        ? 'rgba(0, 0, 0, 0.7)'
                                                        : 'rgba(255, 255, 255, 0.9)',
                                                }
                                            }}
                                        >
                                            <ArrowDownwardIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<CopyIcon />}
                            onClick={handleCopyLogs}
                            disabled={!logsAvailable() || savingLogs || fetchInProgress}
                            sx={{ mr: 2 }}
                        >
                            {t('copyLogs')}
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveLogs}
                            disabled={!logsAvailable() || savingLogs || fetchInProgress}
                        >
                            {savingLogs ? t('saving') : t('saveLogs')}
                        </Button>
                    </Box>
                </motion.div>
            </Paper>
        </Container>
    );
};

export default ContainerLogsScreen;