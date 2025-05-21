"use strict";
const { ipcRenderer } = require("electron");
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
      return () => {
      };
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
window.ipcRenderer = safeIpc;
ipcRenderer.on("window-fade-out", () => {
  console.log("Received window-fade-out signal, starting animation");
  try {
    ipcRenderer.send("window-fade-out-confirm");
  } catch (error) {
    console.error("Error during window fade-out:", error);
    ipcRenderer.send("window-fade-out-confirm");
  }
});
window.addEventListener("DOMContentLoaded", () => {
  const preloadStyle = document.createElement("style");
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
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const nodes = Array.from(mutation.addedNodes);
        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            if (el.textContent && el.textContent.includes("Loading resources")) {
              el.style.display = "none";
              el.style.visibility = "hidden";
              setTimeout(() => {
                try {
                  if (el.parentNode) {
                    el.replaceWith(document.createTextNode(""));
                  }
                } catch (e) {
                  console.log("Could not remove loading text node", e);
                }
              }, 0);
            }
          }
        }
      }
    }
  });
  observer.observe(document, {
    childList: true,
    subtree: true
  });
  setTimeout(() => {
    document.body.classList.add("loaded");
    setTimeout(() => observer.disconnect(), 3e3);
  }, 50);
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlbG9hZC5qcyIsInNvdXJjZXMiOlsiLi4vZWxlY3Ryb24vcHJlbG9hZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGlwY1JlbmRlcmVyIH0gPSByZXF1aXJlKCdlbGVjdHJvbicpO1xuXG4vLyBDcmVhdGUgYSBzYWZlIHdyYXBwZXIgZm9yIGlwY1JlbmRlcmVyXG5jb25zdCBzYWZlSXBjID0ge1xuICBzZW5kOiAoY2hhbm5lbCwgLi4uYXJncykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpcGNSZW5kZXJlci5zZW5kKGNoYW5uZWwsIC4uLmFyZ3MpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3Igc2VuZGluZyBtZXNzYWdlIHRvICR7Y2hhbm5lbH06YCwgZXJyKTtcbiAgICB9XG4gIH0sXG4gIG9uY2U6IChjaGFubmVsLCBjYWxsYmFjaykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpcGNSZW5kZXJlci5vbmNlKGNoYW5uZWwsIGNhbGxiYWNrKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHNldHRpbmcgdXAgb25jZSBsaXN0ZW5lciBmb3IgJHtjaGFubmVsfTpgLCBlcnIpO1xuICAgIH1cbiAgfSxcbiAgb246IChjaGFubmVsLCBjYWxsYmFjaykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpcGNSZW5kZXJlci5vbihjaGFubmVsLCBjYWxsYmFjayk7XG4gICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlwY1JlbmRlcmVyLnJlbW92ZUxpc3RlbmVyKGNoYW5uZWwsIGNhbGxiYWNrKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgcmVtb3ZpbmcgbGlzdGVuZXIgZm9yICR7Y2hhbm5lbH06YCwgZXJyKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHNldHRpbmcgdXAgbGlzdGVuZXIgZm9yICR7Y2hhbm5lbH06YCwgZXJyKTtcbiAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICB9XG4gIH0sXG4gIGludm9rZTogKGNoYW5uZWwsIC4uLmFyZ3MpID0+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGlwY1JlbmRlcmVyLmludm9rZShjaGFubmVsLCAuLi5hcmdzKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGludm9raW5nICR7Y2hhbm5lbH06YCwgZXJyKTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgIH1cbiAgfSxcbiAgLy8gQWRkIGhhbmRsZXJzIGZvciBsb2dnZXIgY29vcmRpbmF0aW9uXG4gIHNlbmRTeW5jOiAoY2hhbm5lbCwgLi4uYXJncykgPT4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gaXBjUmVuZGVyZXIuc2VuZFN5bmMoY2hhbm5lbCwgLi4uYXJncyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBpbiBzZW5kU3luYyBmb3IgJHtjaGFubmVsfTpgLCBlcnIpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG59O1xuXG4vLyBXaXRoIGNvbnRleHRJc29sYXRpb24gZGlzYWJsZWQsIHdlIGNhbiBleHBvc2UgcHJvcGVydGllcyBkaXJlY3RseSB0byB3aW5kb3dcbndpbmRvdy5pcGNSZW5kZXJlciA9IHNhZmVJcGM7XG5cbi8vIEFkZCBmYWRlLW91dCBhbmltYXRpb24gd2hlbiB3aW5kb3cgaXMgY2xvc2luZ1xuaXBjUmVuZGVyZXIub24oJ3dpbmRvdy1mYWRlLW91dCcsICgpID0+IHtcbiAgY29uc29sZS5sb2coJ1JlY2VpdmVkIHdpbmRvdy1mYWRlLW91dCBzaWduYWwsIHN0YXJ0aW5nIGFuaW1hdGlvbicpO1xuXG4gIHRyeSB7XG4gICAgLy8gVGVsbCBlbGVjdHJvbiB0byBmYWRlIG91dCB0aGUgd2luZG93IGltbWVkaWF0ZWx5XG4gICAgaXBjUmVuZGVyZXIuc2VuZCgnd2luZG93LWZhZGUtb3V0LWNvbmZpcm0nKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBkdXJpbmcgd2luZG93IGZhZGUtb3V0OicsIGVycm9yKTtcbiAgICAvLyBFbnN1cmUgd2Ugc3RpbGwgbm90aWZ5IG1haW4gcHJvY2VzcyBldmVuIGlmIHRoZXJlJ3MgYW4gZXJyb3JcbiAgICBpcGNSZW5kZXJlci5zZW5kKCd3aW5kb3ctZmFkZS1vdXQtY29uZmlybScpO1xuICB9XG59KTtcblxuLy8gQXBwbHkgZmFkZS1pbiBhbmltYXRpb24gZm9yIG5ldyB3aW5kb3dzIGFuZCBoaWRlIGxvYWRpbmcgcmVzb3VyY2VzIHRleHRcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuICAvLyBIaWRlIGFueSBcIkxvYWRpbmcgcmVzb3VyY2VzLi4uXCIgdGV4dCBieSBhZGRpbmcgYSBzdHlsZSB0byBoaWRlIGl0IGltbWVkaWF0ZWx5XG4gIGNvbnN0IHByZWxvYWRTdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHByZWxvYWRTdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAvKiBIaWRlIGxvYWRpbmcgcmVzb3VyY2VzIHRleHQgdXJnZW50bHkgKi9cbiAgICBib2R5OjpiZWZvcmUsXG4gICAgI3Jvb3Q6OmJlZm9yZSxcbiAgICBkaXZbaWRdOmVtcHR5OjpiZWZvcmUsXG4gICAgZGl2OmVtcHR5OjpiZWZvcmUge1xuICAgICAgY29udGVudDogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgdmlzaWJpbGl0eTogaGlkZGVuICFpbXBvcnRhbnQ7XG4gICAgICBvcGFjaXR5OiAwICFpbXBvcnRhbnQ7XG4gICAgfVxuICAgIFxuICAgIC8qIEhpZGUgYW55IHZpdGUvcmVhY3QgZGV2IG5vdGljZXMgKi9cbiAgICBbZGF0YS12aXRlLWRldi1pZF0sXG4gICAgW2RhdGEtcmVhY3Ryb290XSB+IGRpdjpub3QoW2lkXSk6bm90KFtjbGFzc10pIHtcbiAgICAgIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIHZpc2liaWxpdHk6IGhpZGRlbiAhaW1wb3J0YW50O1xuICAgIH1cbiAgICBcbiAgICAvKiBFbnN1cmUgdGhlIHNwaW5uZXIgaXMgdmlzaWJsZSAqL1xuICAgIC5hcHAtbG9hZGVyIHtcbiAgICAgIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDtcbiAgICAgIHZpc2liaWxpdHk6IHZpc2libGUgIWltcG9ydGFudDtcbiAgICB9XG4gICAgXG4gICAgLyogRmFkZSBpbiB0aGUgYm9keSAqL1xuICAgIGJvZHkge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMzAwbXMgZWFzZS1pbjtcbiAgICB9XG4gICAgYm9keS5sb2FkZWQge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICB9XG4gIGA7XG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQocHJlbG9hZFN0eWxlKTtcblxuICAvLyBDcmVhdGUgTXV0YXRpb25PYnNlcnZlciB0byByZW1vdmUgYW55IFwiTG9hZGluZyByZXNvdXJjZXMuLi5cIiB0ZXh0IHRoYXQgbWlnaHQgYXBwZWFyXG4gIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgIGZvciAoY29uc3QgbXV0YXRpb24gb2YgbXV0YXRpb25zKSB7XG4gICAgICBpZiAobXV0YXRpb24udHlwZSA9PT0gJ2NoaWxkTGlzdCcpIHtcbiAgICAgICAgY29uc3Qgbm9kZXMgPSBBcnJheS5mcm9tKG11dGF0aW9uLmFkZGVkTm9kZXMpO1xuICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsID0gbm9kZTtcbiAgICAgICAgICAgIGlmIChlbC50ZXh0Q29udGVudCAmJiBlbC50ZXh0Q29udGVudC5pbmNsdWRlcygnTG9hZGluZyByZXNvdXJjZXMnKSkge1xuICAgICAgICAgICAgICBlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICBlbC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG5cbiAgICAgICAgICAgICAgLy8gVHJ5IHRvIHJlbW92ZSB0aGUgbm9kZSBzYWZlbHlcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGlmIChlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsLnJlcGxhY2VXaXRoKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0NvdWxkIG5vdCByZW1vdmUgbG9hZGluZyB0ZXh0IG5vZGUnLCBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgLy8gU3RhcnQgb2JzZXJ2aW5nIGFzIHNvb24gYXMgcG9zc2libGVcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudCwge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlXG4gIH0pO1xuXG4gIC8vIEFkZCBsb2FkZWQgY2xhc3MgYWZ0ZXIgYSBzaG9ydCBkZWxheVxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoJ2xvYWRlZCcpO1xuXG4gICAgLy8gU3RvcCBvYnNlcnZpbmcgYWZ0ZXIgYSByZWFzb25hYmxlIHRpbWVcbiAgICBzZXRUaW1lb3V0KCgpID0+IG9ic2VydmVyLmRpc2Nvbm5lY3QoKSwgMzAwMCk7XG4gIH0sIDUwKTtcbn0pOyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsTUFBTSxFQUFFLFlBQUEsSUFBZ0IsUUFBUSxVQUFVO0FBRzFDLE1BQU0sVUFBVTtBQUFBLEVBQ2QsTUFBTSxDQUFDLFlBQVksU0FBUztBQUN0QixRQUFBO0FBQ1Usa0JBQUEsS0FBSyxTQUFTLEdBQUcsSUFBSTtBQUFBLGFBQzFCLEtBQUs7QUFDWixjQUFRLE1BQU0sNEJBQTRCLE9BQU8sS0FBSyxHQUFHO0FBQUEsSUFBQTtBQUFBLEVBRTdEO0FBQUEsRUFDQSxNQUFNLENBQUMsU0FBUyxhQUFhO0FBQ3ZCLFFBQUE7QUFDVSxrQkFBQSxLQUFLLFNBQVMsUUFBUTtBQUFBLGFBQzNCLEtBQUs7QUFDWixjQUFRLE1BQU0sc0NBQXNDLE9BQU8sS0FBSyxHQUFHO0FBQUEsSUFBQTtBQUFBLEVBRXZFO0FBQUEsRUFDQSxJQUFJLENBQUMsU0FBUyxhQUFhO0FBQ3JCLFFBQUE7QUFDVSxrQkFBQSxHQUFHLFNBQVMsUUFBUTtBQUNoQyxhQUFPLE1BQU07QUFDUCxZQUFBO0FBQ1Usc0JBQUEsZUFBZSxTQUFTLFFBQVE7QUFBQSxpQkFDckMsS0FBSztBQUNaLGtCQUFRLE1BQU0sK0JBQStCLE9BQU8sS0FBSyxHQUFHO0FBQUEsUUFBQTtBQUFBLE1BRWhFO0FBQUEsYUFDTyxLQUFLO0FBQ1osY0FBUSxNQUFNLGlDQUFpQyxPQUFPLEtBQUssR0FBRztBQUM5RCxhQUFPLE1BQU07QUFBQSxNQUFDO0FBQUEsSUFBQTtBQUFBLEVBRWxCO0FBQUEsRUFDQSxRQUFRLENBQUMsWUFBWSxTQUFTO0FBQ3hCLFFBQUE7QUFDRixhQUFPLFlBQVksT0FBTyxTQUFTLEdBQUcsSUFBSTtBQUFBLGFBQ25DLEtBQUs7QUFDWixjQUFRLE1BQU0sa0JBQWtCLE9BQU8sS0FBSyxHQUFHO0FBQ3hDLGFBQUEsUUFBUSxPQUFPLEdBQUc7QUFBQSxJQUFBO0FBQUEsRUFFN0I7QUFBQTtBQUFBLEVBRUEsVUFBVSxDQUFDLFlBQVksU0FBUztBQUMxQixRQUFBO0FBQ0YsYUFBTyxZQUFZLFNBQVMsU0FBUyxHQUFHLElBQUk7QUFBQSxhQUNyQyxLQUFLO0FBQ1osY0FBUSxNQUFNLHlCQUF5QixPQUFPLEtBQUssR0FBRztBQUMvQyxhQUFBO0FBQUEsSUFBQTtBQUFBLEVBQ1Q7QUFFSjtBQUdBLE9BQU8sY0FBYztBQUdyQixZQUFZLEdBQUcsbUJBQW1CLE1BQU07QUFDdEMsVUFBUSxJQUFJLHFEQUFxRDtBQUU3RCxNQUFBO0FBRUYsZ0JBQVksS0FBSyx5QkFBeUI7QUFBQSxXQUNuQyxPQUFPO0FBQ04sWUFBQSxNQUFNLGlDQUFpQyxLQUFLO0FBRXBELGdCQUFZLEtBQUsseUJBQXlCO0FBQUEsRUFBQTtBQUU5QyxDQUFDO0FBR0QsT0FBTyxpQkFBaUIsb0JBQW9CLE1BQU07QUFFMUMsUUFBQSxlQUFlLFNBQVMsY0FBYyxPQUFPO0FBQ25ELGVBQWEsY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQWtDbEIsV0FBQSxLQUFLLFlBQVksWUFBWTtBQUd0QyxRQUFNLFdBQVcsSUFBSSxpQkFBaUIsQ0FBQyxjQUFjO0FBQ25ELGVBQVcsWUFBWSxXQUFXO0FBQzVCLFVBQUEsU0FBUyxTQUFTLGFBQWE7QUFDakMsY0FBTSxRQUFRLE1BQU0sS0FBSyxTQUFTLFVBQVU7QUFDNUMsbUJBQVcsUUFBUSxPQUFPO0FBQ3BCLGNBQUEsS0FBSyxhQUFhLEtBQUssY0FBYztBQUN2QyxrQkFBTSxLQUFLO0FBQ1gsZ0JBQUksR0FBRyxlQUFlLEdBQUcsWUFBWSxTQUFTLG1CQUFtQixHQUFHO0FBQ2xFLGlCQUFHLE1BQU0sVUFBVTtBQUNuQixpQkFBRyxNQUFNLGFBQWE7QUFHdEIseUJBQVcsTUFBTTtBQUNYLG9CQUFBO0FBQ0Ysc0JBQUksR0FBRyxZQUFZO0FBQ2pCLHVCQUFHLFlBQVksU0FBUyxlQUFlLEVBQUUsQ0FBQztBQUFBLGtCQUFBO0FBQUEseUJBRXJDLEdBQUc7QUFDRiwwQkFBQSxJQUFJLHNDQUFzQyxDQUFDO0FBQUEsZ0JBQUE7QUFBQSxpQkFFcEQsQ0FBQztBQUFBLFlBQUE7QUFBQSxVQUNOO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUNEO0FBR0QsV0FBUyxRQUFRLFVBQVU7QUFBQSxJQUN6QixXQUFXO0FBQUEsSUFDWCxTQUFTO0FBQUEsRUFBQSxDQUNWO0FBR0QsYUFBVyxNQUFNO0FBQ04sYUFBQSxLQUFLLFVBQVUsSUFBSSxRQUFRO0FBR3BDLGVBQVcsTUFBTSxTQUFTLFdBQVcsR0FBRyxHQUFJO0FBQUEsS0FDM0MsRUFBRTtBQUNQLENBQUM7In0=
