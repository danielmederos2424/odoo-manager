// src/theme/ThemeProvider.tsx
import React, { createContext, useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline, PaletteMode } from '@mui/material';
import { blue, grey, amber } from '@mui/material/colors';
import { isElectron } from '../utils/electron';
import { updateGlobalStyles } from './safer-style-updater';

// Define context for theme toggle
export const ColorModeContext = createContext({
    toggleColorMode: () => {},
    mode: 'light' as PaletteMode
});

// Props for the ThemeProvider component
interface ThemeProviderProps {
    children: ReactNode;
}

// IPC Renderer interface
interface ElectronIpcRenderer {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    // State for theme mode
    const [mode, setMode] = useState<PaletteMode>('dark');
    // Flag to track if we've initialized from main process
    const [mainProcessThemeChecked, setMainProcessThemeChecked] = useState<boolean>(false);
    // Flag to track if settings loaded
    const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
    // Flag to prevent cyclic theme changes
    const themeChangeInProgress = useRef<boolean>(false);
    // Store the Electron window ID for this window
    const windowId = useRef<string | null>(null);

    // Get window ID as early as possible
    useEffect(() => {
        if (isElectron()) {
            try {
                const { remote } = window.require('electron');
                if (remote && remote.getCurrentWindow) {
                    const win = remote.getCurrentWindow();
                    windowId.current = win.id.toString();
                    console.log(`[ThemeProvider] Window ID: ${windowId.current}`);
                } else {
                    const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                    // Request window ID from main process
                    ipcRenderer.invoke('get-window-id')
                        .then((id: string | number) => {
                            windowId.current = id.toString();
                            console.log(`[ThemeProvider] Window ID (from IPC): ${windowId.current}`);
                        })
                        .catch((error: Error) => {
                            console.error('[ThemeProvider] Error getting window ID:', error);
                        });
                }
            } catch (error) {
                console.error('[ThemeProvider] Error getting window ID:', error);
            }
        }
    }, []);

    // First, try to get theme from main process (highest priority)
    useEffect(() => {
        // Skip if settings loaded first (for efficiency)
        if (settingsLoaded) return;

        if (isElectron()) {
            try {
                const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };

                // Request current theme on mount - this is crucial for sync between windows
                if (ipcRenderer.invoke) {
                    console.log('[ThemeProvider] Requesting theme from main process');
                    ipcRenderer.invoke('get-current-theme')
                        .then((storedMode: string) => {
                            console.log('[ThemeProvider] Got stored theme from main process:', storedMode);
                            // Only set if we got a valid theme
                            if (storedMode && (storedMode === 'light' || storedMode === 'dark')) {
                                // Use batch update to avoid React state conflicts
                                themeChangeInProgress.current = true;
                                setMode(storedMode as PaletteMode);
                                setTimeout(() => {
                                    themeChangeInProgress.current = false;
                                }, 200);
                            }
                            // Mark that we've checked with main process
                            setMainProcessThemeChecked(true);
                        })
                        .catch((err: Error) => {
                            console.error('[ThemeProvider] Error getting theme from main process:', err);
                            setMainProcessThemeChecked(true); // Mark as checked even on error
                        });
                } else {
                    console.log('[ThemeProvider] ipcRenderer.invoke not available');
                    setMainProcessThemeChecked(true);
                }
            } catch (error) {
                console.error('[ThemeProvider] Error requesting theme from main process:', error);
                setMainProcessThemeChecked(true);
            }
        } else {
            // Not in Electron, skip main process check
            setMainProcessThemeChecked(true);
        }
    }, [settingsLoaded]);

    // Second, try settings.json (highest local priority)
    useEffect(() => {
        const loadThemeFromSettings = async (): Promise<void> => {
            try {
                if (isElectron()) {
                    // Skip if a theme change is in progress
                    if (themeChangeInProgress.current) {
                        console.log('[ThemeProvider] Skipping settings load during theme change');
                        setSettingsLoaded(true);
                        return;
                    }

                    // Try to get settings from settings service
                    const { default: settingsService } = await import('../services/settings/settingsService');
                    const settings = await settingsService.loadSettings();

                    console.log('[ThemeProvider] Loaded settings:', settings);

                    if (settings?.theme && (settings.theme === 'light' || settings.theme === 'dark')) {
                        console.log('[ThemeProvider] Loaded theme from settings:', settings.theme);

                        // Check if theme from settings is different from main process theme
                        if (mainProcessThemeChecked) {
                            if (settings.theme !== mode) {
                                console.log('[ThemeProvider] Settings theme differs from current, updating to:', settings.theme);
                                themeChangeInProgress.current = true;
                                setMode(settings.theme as PaletteMode);
                                setTimeout(() => {
                                    themeChangeInProgress.current = false;
                                }, 200);
                            } else {
                                console.log('[ThemeProvider] Settings theme matches current theme:', settings.theme);
                            }
                        } else {
                            // Main process not checked yet, set theme from settings
                            console.log('[ThemeProvider] Setting theme from settings before main process check:', settings.theme);
                            themeChangeInProgress.current = true;
                            setMode(settings.theme as PaletteMode);
                            setTimeout(() => {
                                themeChangeInProgress.current = false;
                            }, 200);
                        }
                    } else {
                        // No theme in settings, try localStorage
                        const savedMode = localStorage.getItem('theme-mode');
                        if (savedMode === 'light' || savedMode === 'dark') {
                            console.log('[ThemeProvider] Loaded theme from localStorage:', savedMode);

                            if (savedMode !== mode) {
                                themeChangeInProgress.current = true;
                                setMode(savedMode as PaletteMode);
                                setTimeout(() => {
                                    themeChangeInProgress.current = false;
                                }, 200);
                            }
                        }
                    }
                } else {
                    // Browser mode, use localStorage
                    const savedMode = localStorage.getItem('theme-mode');
                    if (savedMode === 'light' || savedMode === 'dark') {
                        console.log('[ThemeProvider] Loaded theme from localStorage (browser):', savedMode);
                        if (savedMode !== mode) {
                            setMode(savedMode as PaletteMode);
                        }
                    }
                }
            } catch (error) {
                console.error('[ThemeProvider] Error loading theme from settings:', error);
                // Fall back to localStorage on error
                const savedMode = localStorage.getItem('theme-mode');
                if (savedMode === 'light' || savedMode === 'dark') {
                    console.log('[ThemeProvider] Loaded theme from localStorage fallback:', savedMode);
                    if (savedMode !== mode) {
                        setMode(savedMode as PaletteMode);
                    }
                }
            } finally {
                setSettingsLoaded(true);
            }
        };

        // Load settings right away (don't wait for main process check)
        loadThemeFromSettings().catch((error: Error) => {
            console.error('[ThemeProvider] Failed to load theme from settings:', error);
            setSettingsLoaded(true); // Mark as loaded even on error to continue
        });
    }, [mode]);

    // Save mode to localStorage and settings.json when it changes and update styles
    useEffect(() => {
        // Skip if still initializing or theme change is in progress
        if (!settingsLoaded || !mainProcessThemeChecked) {
            console.log('[ThemeProvider] Skipping theme update - still initializing');
            return;
        }

        console.log('[ThemeProvider] Theme mode changed to:', mode);

        // Save the current theme to localStorage (for quick access on next load)
        localStorage.setItem('theme-mode', mode);

        // Save to settings.json for persistence
        if (isElectron()) {
            import('../services/settings/settingsService').then(({ default: settingsService }) => {
                settingsService.updateSettings({ theme: mode }).catch((err: Error) => {
                    console.error('[ThemeProvider] Error saving theme to settings:', err);
                });
            }).catch((err: Error) => {
                console.error('[ThemeProvider] Error importing settings service:', err);
            });
        }

        // If in Electron, sync theme with main process (this is crucial!)
        if (isElectron() && !themeChangeInProgress.current) {
            try {
                const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                if (ipcRenderer) {
                    console.log('[ThemeProvider] Sending theme sync to main process:', mode);
                    ipcRenderer.send('sync-theme', {
                        mode,
                        source: windowId.current // Send window ID to prevent echo
                    });
                }
            } catch (err) {
                console.error('[ThemeProvider] Error syncing theme with main process:', err);
            }
        }

        // Use RAF for safer DOM manipulation
        requestAnimationFrame(() => {
            try {
                // Update both document elements for complete coverage
                if (document.body) {
                    document.body.style.backgroundColor = mode === 'dark' ? '#121212' : '#f5f5f5';
                    document.body.style.backgroundImage = mode === 'dark'
                        ? 'linear-gradient(120deg, #111111, #000000)'
                        : 'linear-gradient(120deg, #f8f8f8, #f0f0f0)';
                    document.body.style.transition = 'background-color 0.3s ease, background-image 0.3s ease';
                }

                if (document.documentElement) {
                    document.documentElement.style.backgroundColor = mode === 'dark' ? '#121212' : '#f5f5f5';
                    document.documentElement.style.backgroundImage = mode === 'dark'
                        ? 'linear-gradient(120deg, #111111, #000000)'
                        : 'linear-gradient(120deg, #f8f8f8, #f0f0f0)';
                }

                // Update CSS classes for theme support
                if (mode === 'dark') {
                    document.documentElement?.classList.add('dark-mode');
                    document.body?.classList.add('dark-mode');
                    document.documentElement?.classList.remove('light-mode');
                    document.body?.classList.remove('light-mode');

                    // Update spinner if it exists
                    const loader = document.querySelector('.app-loader');
                    if (loader) {
                        loader.classList.add('dark-mode');
                        loader.classList.remove('light-mode');
                    }
                } else {
                    document.documentElement?.classList.add('light-mode');
                    document.body?.classList.add('light-mode');
                    document.documentElement?.classList.remove('dark-mode');
                    document.body?.classList.remove('dark-mode');

                    // Update spinner if it exists
                    const loader = document.querySelector('.app-loader');
                    if (loader) {
                        loader.classList.add('light-mode');
                        loader.classList.remove('dark-mode');
                    }
                }

                // Use the safer style updater instead of direct DOM manipulation
                updateGlobalStyles(mode);
            } catch (domError) {
                console.error('[ThemeProvider] Error updating DOM for theme change:', domError);
            }
        });
    }, [mode, settingsLoaded, mainProcessThemeChecked]);

    // Create color mode context value
    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                // Skip if initializing or theme change already in progress
                if (!settingsLoaded || !mainProcessThemeChecked || themeChangeInProgress.current) {
                    console.log('[ThemeProvider] Skipping toggle - initialization incomplete or change in progress');
                    return;
                }

                setMode((prevMode) => {
                    const newMode = prevMode === 'light' ? 'dark' : 'light';
                    console.log('[ThemeProvider] Toggling theme from', prevMode, 'to', newMode);
                    return newMode;
                });
            },
            mode,
        }),
        [mode, settingsLoaded, mainProcessThemeChecked],
    );

    // Listen for theme changes from other windows
    useEffect(() => {
        if (isElectron()) {
            try {
                const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                if (!ipcRenderer) {
                    console.error('[ThemeProvider] IPC Renderer is not available for theme synchronization');
                    return;
                }

                // Set up listener for theme changes from other windows
                const themeChangeHandler = (_event: any, newMode: string) => {
                    console.log('[ThemeProvider] Received theme-changed event:', newMode);

                    // Skip if theme change is in progress to prevent cycles
                    if (themeChangeInProgress.current) {
                        console.log('[ThemeProvider] Ignoring theme change event during transition');
                        return;
                    }

                    // Only update if the incoming mode is different from current
                    if (newMode && (newMode === 'light' || newMode === 'dark') && newMode !== mode) {
                        console.log('[ThemeProvider] Updating theme based on IPC event:', newMode);

                        // Set flag to prevent immediate echo
                        themeChangeInProgress.current = true;
                        setMode(newMode as PaletteMode);

                        // Release flag after a short delay
                        setTimeout(() => {
                            themeChangeInProgress.current = false;
                        }, 500);
                    }
                };

                ipcRenderer.on('theme-changed', themeChangeHandler);

                // Clean up
                return () => {
                    try {
                        ipcRenderer.removeListener('theme-changed', themeChangeHandler);
                    } catch (err) {
                        console.error('[ThemeProvider] Error removing theme listener:', err);
                    }
                };
            } catch (error) {
                console.error('[ThemeProvider] Error setting up theme synchronization:', error);
                return () => {}; // Return empty cleanup function
            }
        }
        return () => {}; // Return empty cleanup function for non-Electron env
    }, [mode]);

    // Create theme with the current mode
    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    primary: blue,
                    secondary: amber,
                    ...(mode === 'light'
                        ? {
                            // Light mode palette
                            background: {
                                default: '#f8f9fa',
                                paper: '#ffffff',
                            },
                            text: {
                                primary: grey[900],
                                secondary: grey[700],
                            },
                        }
                        : {
                            // Dark mode palette
                            background: {
                                default: '#121212',
                                paper: '#1a1a1a',
                            },
                            text: {
                                primary: '#ffffff',
                                secondary: grey[400],
                            },
                        }),
                },
                typography: {
                    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                },
                shape: {
                    borderRadius: 10,
                },
                components: {
                    MuiCssBaseline: {
                        styleOverrides: {
                            body: {
                                backgroundColor: mode === 'dark' ? '#121212' : '#f5f5f5',
                                backgroundImage: mode === 'dark'
                                    ? 'linear-gradient(120deg, #111111, #000000)'
                                    : 'linear-gradient(120deg, #f8f8f8, #f0f0f0)',
                            },
                        },
                    },
                    MuiPaper: {
                        styleOverrides: {
                            root: {
                                backgroundImage: 'none',
                                backgroundColor: mode === 'dark' ? '#1a1a1a' : '#ffffff',
                            },
                        },
                    },
                    MuiButton: {
                        styleOverrides: {
                            root: {
                                textTransform: 'none',
                                fontWeight: 500,
                                borderRadius: '8px',
                                padding: '8px 16px',
                                transition: 'all 0.2s ease-in-out',
                            },
                        },
                    },
                    MuiMenuItem: {
                        styleOverrides: {
                            root: {
                                '&.Mui-selected': {
                                    backgroundColor: mode === 'dark'
                                        ? 'rgba(25, 118, 210, 0.12)'
                                        : 'rgba(25, 118, 210, 0.08)',
                                },
                            }
                        }
                    }
                },
            }),
        [mode],
    );

    return (
        <ColorModeContext.Provider value={colorMode}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default ThemeProvider;