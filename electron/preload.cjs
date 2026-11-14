// Pont sécurisé entre l'app PC et la page Nova Music
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novaDesktop', {
  platform: process.platform,
  googleLogin: () => ipcRenderer.invoke('google-login'),
  onGoogleToken: (cb) => ipcRenderer.on('google-token', (_e, data) => cb(data)),
});
