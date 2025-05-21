const { ipcRenderer } = require('electron');

// Create a safe wrapper for ipcRenderer
const safeIpc = {
  send: (channel, ...args) => {
    try {
      ipcRenderer.send(channel, ...args);
    } catch (err) {
      console.error(`Error sending message to ${channel}:`, err);
    }
  },
  once: (channel, callback) => {
    try {
      ipcRenderer.once(channel, callback);
    } catch (err) {
      console.error(`Error setting up once listener for ${channel}:`, err);
    }
  },
  on: (channel, callback) => {
    try {
      ipcRenderer.on(channel, callback);
      return () => {
        try {
          ipcRenderer.removeListener(channel, callback);
        } catch (err) {
          console.error(`Error removing listener for ${channel}:`, err);
        }
      };
    } catch (err) {
      console.error(`Error setting up listener for ${channel}:`, err);
      return () => {};
    }
  },
  invoke: (channel, ...args) => {
    try {
      return ipcRenderer.invoke(channel, ...args);
    } catch (err) {
      console.error(`Error invoking ${channel}:`, err);
      return Promise.reject(err);
    }
  },
  // Add handlers for logger coordination
  sendSync: (channel, ...args) => {
    try {
      return ipcRenderer.sendSync(channel, ...args);
    } catch (err) {
      console.error(`Error in sendSync for ${channel}:`, err);
      return null;
    }
  }
};

// With contextIsolation disabled, we can expose properties directly to window
window.ipcRenderer = safeIpc;

// Add fade-out animation when window is closing
ipcRenderer.on('window-fade-out', () => {
  console.log('Received window-fade-out signal, starting animation');

  try {
    // Tell electron to fade out the window immediately
    ipcRenderer.send('window-fade-out-confirm');
  } catch (error) {
    console.error('Error during window fade-out:', error);
    // Ensure we still notify main process even if there's an error
    ipcRenderer.send('window-fade-out-confirm');
  }
});

// Apply fade-in animation for new windows and hide loading resources text
window.addEventListener('DOMContentLoaded', () => {
  // Hide any "Loading resources..." text by adding a style to hide it immediately
  const preloadStyle = document.createElement('style');
  preloadStyle.textContent = `
    /* Hide loading resources text urgently */
    body::before,
    #root::before,
    div[id]:empty::before,
    div:empty::before {
      content: none !important;
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    
    /* Hide any vite/react dev notices */
    [data-vite-dev-id],
    [data-reactroot] ~ div:not([id]):not([class]) {
      display: none !important;
      visibility: hidden !important;
    }
    
    /* Ensure the spinner is visible */
    .app-loader {
      display: flex !important;
      visibility: visible !important;
    }
    
    /* Fade in the body */
    body {
      opacity: 0;
      transition: opacity 300ms ease-in;
    }
    body.loaded {
      opacity: 1;
    }
  `;
  document.head.appendChild(preloadStyle);

  // Create MutationObserver to remove any "Loading resources..." text that might appear
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const nodes = Array.from(mutation.addedNodes);
        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            if (el.textContent && el.textContent.includes('Loading resources')) {
              el.style.display = 'none';
              el.style.visibility = 'hidden';

              // Try to remove the node safely
              setTimeout(() => {
                try {
                  if (el.parentNode) {
                    el.replaceWith(document.createTextNode(''));
                  }
                } catch (e) {
                  console.log('Could not remove loading text node', e);
                }
              }, 0);
            }
          }
        }
      }
    }
  });

  // Start observing as soon as possible
  observer.observe(document, {
    childList: true,
    subtree: true
  });

  // Add loaded class after a short delay
  setTimeout(() => {
    document.body.classList.add('loaded');

    // Stop observing after a reasonable time
    setTimeout(() => observer.disconnect(), 3000);
  }, 50);
});