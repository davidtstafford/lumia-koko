import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api = {
  // General IPC
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  
  // Event listeners
  on: (channel: string, callback: Function) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  }
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electron', api); // Alias for compatibility
