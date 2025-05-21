// src/theme/safer-style-updater.ts

/**
 * Safer global style updater that avoids problematic DOM manipulations
 * that can cause "Failed to execute 'removeChild' on 'Node'" errors.
 * 
 * @param mode The current theme mode ('light' or 'dark')
 */
export function updateGlobalStyles(mode: 'light' | 'dark'): void {
  // Use requestAnimationFrame for safer DOM operations - this ensures we're outside React's rendering cycle
  requestAnimationFrame(() => {
    try {
      // Generate a unique ID with timestamp to avoid conflicts
      const uniqueId = `theme-globals-${Date.now()}`;
      
      // First, safely handle existing style elements before adding a new one
      const existingStyles = document.querySelectorAll(`style[id^="theme-globals"]`);
      if (existingStyles.length > 0) {
        console.log(`[StyleUpdater] Found ${existingStyles.length} existing style elements to handle`);
        
        // Disable existing styles first to avoid conflicts
        existingStyles.forEach((element: Element) => {
          try {
            if (element instanceof HTMLStyleElement) {
              // Set disabled attribute instead of removing
              element.disabled = true;
              // Also rename to avoid future conflicts
              if (!element.id.includes('-disabled')) {
                element.id = `${element.id}-disabled`;
              }
            }
          } catch (err) {
            console.error('[StyleUpdater] Error handling existing style:', err);
          }
        });
      }
      
      // Create new style element after handling existing ones
      const styleTag = document.createElement('style');
      styleTag.textContent = `
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: auto;
          background-color: ${mode === 'dark' ? '#121212' : '#f5f5f5'};
          background-image: ${mode === 'dark'
            ? 'linear-gradient(120deg, #111111, #000000)'
            : 'linear-gradient(120deg, #f8f8f8, #f0f0f0)'};
        }
      `;
      
      // Give it a unique ID
      styleTag.id = uniqueId;
      
      // Add the new style element to the document head
      if (document.head) {
        document.head.appendChild(styleTag);
      }
    } catch (error) {
      console.error('[StyleUpdater] Error updating global styles:', error);
    }
  });
}