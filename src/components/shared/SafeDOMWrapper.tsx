// src/components/shared/SafeDOMWrapper.tsx
import React, { useLayoutEffect, ReactNode } from 'react';

/**
 * SafeDOMWrapper is a component that helps prevent React DOM errors by
 * safely handling style elements and other DOM operations that might
 * cause "removeChild" errors.
 * 
 * It cleans up any leftover duplicate theme style elements on mount and
 * provides a safe way to manipulate the DOM outside React's control.
 */
const SafeDOMWrapper: React.FC<{children: ReactNode}> = ({ children }) => {
  // Use layout effect to run DOM cleanup operations before render
  useLayoutEffect(() => {
    try {
      // Look for any theme-globals style tags
      const duplicateStyles = document.querySelectorAll('style[id^="theme-globals"]');
      
      if (duplicateStyles.length > 1) {
        console.log(`[SafeDOMWrapper] Found ${duplicateStyles.length} theme style elements, cleaning up...`);
        
        // Keep only the most recent one (by creation time, if we can determine it)
        // Sort by ID if they include timestamps (e.g., theme-globals-123456789)
        const styleArr = Array.from(duplicateStyles);
        
        // Sort with newest last (if using timestamp IDs like 'theme-globals-{timestamp}')
        styleArr.sort((a, b) => {
          const aId = a.id || '';
          const bId = b.id || '';
          
          // If both have timestamps, compare them
          if (aId.includes('-') && bId.includes('-')) {
            const aTime = parseInt(aId.split('-').pop() || '0', 10);
            const bTime = parseInt(bId.split('-').pop() || '0', 10);
            return aTime - bTime;
          }
          
          // Otherwise, simple string comparison
          return aId.localeCompare(bId);
        });
        
        // Keep the last one (newest), disable all others
        for (let i = 0; i < styleArr.length - 1; i++) {
          try {
            const style = styleArr[i];
            // Instead of removing (which could cause errors), disable them
            style.disabled = true;
            
            // Also mark them as old to avoid conflicts
            style.id = `${style.id}-disabled`;
            
            console.log(`[SafeDOMWrapper] Disabled style element: ${style.id}`);
          } catch (e) {
            console.error('[SafeDOMWrapper] Error disabling style element:', e);
          }
        }
      }
    } catch (error) {
      console.error('[SafeDOMWrapper] Error cleaning up DOM:', error);
    }
    
    return () => {
      // Cleanup function - not needed here as we're just doing a one-time cleanup
    };
  }, []); // Empty dependency array means this runs once on mount

  return <>{children}</>;
};

export default SafeDOMWrapper;