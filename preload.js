// Ponte segura entre a janela (index.html / thumbs.html) e o Electron (main.js)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fm', {
  // backup automático + espelho dos dados em disco
  autoBackup: (json) => ipcRenderer.send('auto-backup', json),
  lerDados: () => ipcRenderer.invoke('dados:ler'),
  // registro de erros em arquivo
  log: (linha) => ipcRenderer.send('log', linha),
  abrirLogs: () => ipcRenderer.send('abrir-logs'),
  abrirPastaApp: () => ipcRenderer.send('abrir-pasta-app'),
  // arquivos de verdade em Documentos\Junps Finance\arquivos
  salvarArquivo: (pasta, nome, dataUrl) => ipcRenderer.invoke('arquivo:salvar', { pasta, nome, dataUrl }),
  lerArquivo: (caminho) => ipcRenderer.invoke('arquivo:ler', caminho),
  abrirArquivo: (caminho) => ipcRenderer.send('arquivo:abrir', caminho),
  mostrarArquivo: (caminho) => ipcRenderer.send('arquivo:mostrar', caminho),
  excluirArquivo: (caminho) => ipcRenderer.send('arquivo:excluir', caminho),
  // atualização automática
  versao: () => ipcRenderer.invoke('versao'),
  verificarUpdate: () => ipcRenderer.send('verificar-update'),
  instalarUpdate: () => ipcRenderer.send('instalar-update'),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, info) => cb(info))
});
