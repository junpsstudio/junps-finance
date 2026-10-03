// Ponte segura entre a janela (index.html) e o Electron (main.js)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fm', {
  // backup automático: recebe o JSON com todos os dados e pede ao Electron para gravar
  autoBackup: (json) => ipcRenderer.send('auto-backup', json),
  // registro de erros em arquivo
  log: (linha) => ipcRenderer.send('log', linha),
  abrirLogs: () => ipcRenderer.send('abrir-logs'),
  // atualização automática
  versao: () => ipcRenderer.invoke('versao'),
  verificarUpdate: () => ipcRenderer.send('verificar-update'),
  instalarUpdate: () => ipcRenderer.send('instalar-update'),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, info) => cb(info))
});
