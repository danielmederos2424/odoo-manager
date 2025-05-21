// src/App.tsx
import React, { useEffect, useState } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import './App.css';
import MainLayout from './components/layout/MainLayout';
import SplashScreen from './components/screens/SplashScreen';
import HelpScreen from './components/screens/HelpScreen';
import NewInstanceScreen from './components/screens/NewInstanceScreen';
import ContainerInfoScreen from './components/screens/ContainerInfoScreen';
import ContainerLogsScreen from './components/screens/ContainerLogsScreen';
import SetupScreen from './components/screens/SetupScreen';
import ErrorScreen from './components/screens/ErrorScreen';
import ThemeProvider from './theme/ThemeProvider';
import NewPostgresScreen from "./components/screens/NewPostgresScreen";
import SettingsScreen from "./components/screens/SettingsScreen";
import ErrorBoundary from './components/shared/ErrorBoundary';
import SafeDOMWrapper from './components/shared/SafeDOMWrapper';
import BackgroundUpdateCheck from './components/BackgroundUpdateCheck';
import settingsService from './services/settings/settingsService';
import { initializeLogger, logInfo, logError } from './services/utils/logger';
import { initI18n } from './i18n/i18n';
import i18n from 'i18next';

// Check if the app is running in Electron
const isElectron = (): boolean => {
    return Boolean(window && window.process && window.process.type);
};

// Get any window data passed from main process
const getWindowData = (): any => {
    if (isElectron()) {
        const args = window.process.argv;
        const dataArg = args.find(arg => arg.startsWith('--window-data='));
        if (dataArg) {
            try {
                return JSON.parse(dataArg.replace('--window-data=', ''));
            } catch (e) {
                console.error('Failed to parse window data:', e);
            }
        }
    }
    return null;
};

// Type for IPC Renderer in Electron
interface ElectronIpcRenderer {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
}

function App() {
    const [loading, setLoading] = useState(true);
    const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

    useEffect(() => {
        const initializeApp = async (): Promise<void> => {
            // First check if setup is completed and load settings
            if (isElectron()) {
                try {
                    // Check setup status first
                    const isCompleted = await settingsService.isSetupCompleted();
                    setSetupCompleted(isCompleted);

                    if (isCompleted) {
                        try {
                            const settings = await settingsService.loadSettings();
                            console.log('Settings loaded:', settings);

                            // Initialize logger
                            await initializeLogger();
                            logInfo('Application started with settings loaded');

                            // Initialize i18n with settings
                            try {
                                await initI18n(settings);
                                console.log('i18n initialized in App.tsx with language:', i18n.language);
                                logInfo('i18n initialized with language: ' + i18n.language);

                                // Set up listener for language change events from main process
                                if (window.require) {
                                    const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                                    ipcRenderer.on('language-changed', async (_event: any, language: string) => {
                                        console.log('Received language-changed event from main process:', language);
                                        if (language && language !== i18n.language) {
                                            console.log('Changing language to:', language);
                                            await i18n.changeLanguage(language);
                                            console.log('Language changed via IPC to:', i18n.language);
                                        }
                                    });

                                    // Request current language from main process
                                    try {
                                        const currentLang = await ipcRenderer.invoke('get-current-language');
                                        if (currentLang && currentLang !== i18n.language) {
                                            console.log('Setting language from main process:', currentLang);
                                            await i18n.changeLanguage(currentLang);
                                        }
                                    } catch (err) {
                                        console.error('Error getting language from main process:', err);
                                    }
                                }
                            } catch (i18nError) {
                                console.error('Error initializing i18n:', i18nError);
                                logError('Error initializing i18n:', i18nError);
                            }
                        } catch (settingsError) {
                            console.error('Error loading settings:', settingsError);

                            // Initialize logger even if settings failed
                            try {
                                await initializeLogger();
                                logInfo('Application started without settings');
                                logError('Error loading settings:', settingsError);
                            } catch (loggerError) {
                                console.error('Error initializing logger:', loggerError);
                            }

                            // Initialize i18n with defaults
                            try {
                                await initI18n();
                                console.log('i18n initialized with defaults');

                                // Set up listener for language change events
                                if (window.require) {
                                    const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                                    ipcRenderer.on('language-changed', async (_event: any, language: string) => {
                                        console.log('Received language-changed event from main process:', language);
                                        if (language && language !== i18n.language) {
                                            console.log('Changing language to:', language);
                                            await i18n.changeLanguage(language);
                                            console.log('Language changed via IPC to:', i18n.language);
                                        }
                                    });
                                }
                            } catch (i18nError) {
                                console.error('Error initializing i18n with defaults:', i18nError);
                            }
                        }
                    } else {
                        // If setup is not completed, just initialize logger for setup flow
                        try {
                            await initializeLogger();
                            logInfo('Application started in setup mode');
                        } catch (loggerError) {
                            console.error('Error initializing logger in setup mode:', loggerError);
                        }

                        // Initialize i18n with defaults for setup
                        try {
                            await initI18n();

                            // Set up listener for language change events
                            if (window.require) {
                                const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                                ipcRenderer.on('language-changed', async (_event: any, language: string) => {
                                    console.log('Received language-changed event from main process:', language);
                                    if (language && language !== i18n.language) {
                                        console.log('Changing language to:', language);
                                        await i18n.changeLanguage(language);
                                        console.log('Language changed via IPC to:', i18n.language);
                                    }
                                });
                            }
                        } catch (i18nError) {
                            console.error('Error initializing i18n for setup:', i18nError);
                        }
                    }
                } catch (setupError) {
                    console.error('Error checking setup status:', setupError);
                    setSetupCompleted(false);

                    // Initialize with defaults as fallback
                    try {
                        await initializeLogger();
                        await initI18n();

                        // Set up listener for language change events
                        if (window.require) {
                            const { ipcRenderer } = window.require('electron') as { ipcRenderer: ElectronIpcRenderer };
                            ipcRenderer.on('language-changed', async (_event: any, language: string) => {
                                console.log('Received language-changed event from main process:', language);
                                if (language && language !== i18n.language) {
                                    console.log('Changing language to:', language);
                                    await i18n.changeLanguage(language);
                                    console.log('Language changed via IPC to:', i18n.language);
                                }
                            });
                        }
                    } catch (initError) {
                        console.error('Error in fallback initialization:', initError);
                    }
                }
            } else {
                // Browser mode - assume setup is completed and initialize i18n only
                setSetupCompleted(true);
                try {
                    await initI18n();
                } catch (i18nError) {
                    console.error('Error initializing i18n in browser mode:', i18nError);
                }
            }

            setLoading(false);
        };

        // Call the initialization function and handle any errors
        initializeApp().catch(error => {
            console.error('Error during app initialization:', error);
            setLoading(false);
            setSetupCompleted(false); // Assume setup is needed if there's an error
        });
    }, []);

    // Create routes only after setup check is complete
    const router = React.useMemo(() => {
        // Don't create router until setupCompleted is determined
        if (setupCompleted === null) return null;

        return createHashRouter([
            {
                path: '/',
                element: <Navigate to={!setupCompleted ? '/setup' : '/splash'} replace />,
                errorElement: <ErrorScreen />,
            },
            {
                path: '/setup',
                element: <SetupScreen />,
            },
            {
                path: '/splash',
                element: <SplashScreen />,
            },
            {
                path: '/main',
                element: <MainLayout />,
            },
            {
                path: '/help',
                element: <HelpScreen />,
            },
            {
                path: '/new-instance',
                element: <NewInstanceScreen />,
            },
            {
                path: '/new-postgres',
                element: <NewPostgresScreen />,
            },
            {
                path: '/container-info',
                element: <ContainerInfoScreen data={getWindowData()} />,
            },
            {
                path: '/container-logs',
                element: <ContainerLogsScreen data={getWindowData()} />,
            },
            {
                path: '/settings',
                element: <SettingsScreen />,
            }
        ]);
    }, [setupCompleted]);

    return (
        <ErrorBoundary>
            <SafeDOMWrapper>
                <ThemeProvider>
                    {/* Background update checker */}
                    {setupCompleted && <BackgroundUpdateCheck />}
                    
                    {loading || !router ? (
                        <div className="app-loader" style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100vh',
                            width: '100vw',
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            zIndex: 9999,
                            backgroundColor: 'inherit'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    border: '4px solid var(--spinner-track-color, rgba(0,0,0,0.1))',
                                    borderLeft: '4px solid var(--spinner-color, #3498db)',
                                    borderRadius: '50%',
                                    width: '30px',
                                    height: '30px',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto 10px auto',
                                }} />
                                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                            </div>
                        </div>
                    ) : (
                        <RouterProvider router={router} />
                    )}
                </ThemeProvider>
            </SafeDOMWrapper>
        </ErrorBoundary>
    );
}

export default App;