/// <reference types="vite/client" />

interface Window {
    ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        sendSync: (channel: string, ...args: any[]) => any;
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        removeListener: (channel: string, listener: Function) => void;
    };
    loggerInitialized?: boolean;
}