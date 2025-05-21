import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslation from './locales/en';
import esTranslation from './locales/es';
import settingsService from '../services/settings/settingsService';
import { logInfo, logError } from '../services/utils/logger';

// Initialize basic i18n configuration
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: {
          translation: enTranslation
        },
        es: {
          translation: esTranslation
        }
      },
      lng: 'en', // Default language
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false // React already safes from XSS
      },
      react: {
        useSuspense: false // Disable suspense
      },
      debug: false // Disable debug mode in production
    });

// Initialize i18next with saved settings
const initI18n = async (preloadedSettings?: any) => {
  try {
    // Use provided settings if available, otherwise load from disk
    let settings = preloadedSettings;

    // If settings weren't passed in, try to load them
    if (!settings) {
      try {
        settings = await settingsService.loadSettings();
      } catch (loadError) {
        logError('i18n: error loading settings from disk:', loadError);
        // Continue with default language
      }
    }

    if (settings?.language) {
      const savedLanguage = settings.language;
      logInfo('i18n: initializing with language from settings:', savedLanguage);

      // Change language without using changeLanguage to avoid circular dependency
      await i18n.changeLanguage(savedLanguage);
      logInfo('i18n: initialized with language:', i18n.language);
    } else {
      // Fall back to browser settings or localStorage
      try {
        const storedLanguage = localStorage.getItem('i18n-language');
        if (storedLanguage) {
          logInfo('i18n: initializing with language from localStorage:', storedLanguage);
          await i18n.changeLanguage(storedLanguage);
        } else {
          logInfo('i18n: no saved language, using default');
        }
      } catch (storageError) {
        logError('i18n: error reading from localStorage:', storageError);
        // Continue with default language
      }
    }
  } catch (error) {
    logError('Failed to initialize i18n with saved language:', error);
  }
};

// Function to change language
export const changeLanguage = async (language: string) => {
  logInfo('i18n: changing language to', language);

  try {
    // Change language in i18n
    await i18n.changeLanguage(language);
    logInfo('i18n: language changed to', i18n.language);

    // Store in localStorage for faster access next time
    try {
      localStorage.setItem('i18n-language', language);
    } catch (storageError) {
      logError('i18n: could not save language to localStorage:', storageError);
    }

    // Update language in settings.json for persistence
    try {
      const settings = await settingsService.loadSettings();
      logInfo('i18n: updating settings with language', language);

      if (settings) {
        await settingsService.updateSettings({
          language
        });
        logInfo('i18n: settings updated successfully');
      } else {
        logError('i18n: no settings found to update');
      }
    } catch (settingsError) {
      logError('i18n: error updating settings:', settingsError);
      // Language is still changed in-memory and localStorage even if settings update fails
    }
  } catch (error) {
    logError('Failed to change language:', error);
  }
};

export { initI18n };
export default i18n;