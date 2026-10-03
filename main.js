const { app, BrowserWindow, ipcMain, shell } = require('electron');
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (e) { /* sem o pacote (ex.: rodando do código-fonte) */ }
const path = require('path');
const fs = require('fs');

let mainWindow;

app.setName('Junps Finance');
// Mantém os dados (despesas, clientes, faturas) na mesma pasta do app antigo "controle-financas"
app.setPath('userData', path.join(app.getPath('appData'), 'controle-financas'));

// Data local no formato AAAA-MM-DD (não usar toISOString: é UTC e vira o dia às 21h no Brasil)
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const pastaApp = () => path.join(app.getPath('documents'), 'Junps Finance');
const pastaBackup = () => path.join(pastaApp(), 'backups');
const pastaLogs = () => path.join(pastaApp(), 'logs');
const pastaDados = () => path.join(pastaApp(), 'dados');
const pastaArquivos = () => path.join(pastaApp(), 'arquivos');

// ---- Registro de erros em arquivo (um por mês, nunca cresce sem limite) ----
function log(linha) {
  try {
    fs.mkdirSync(pastaLogs(), { recursive: true });
    const arq = path.join(pastaLogs(), `junps-${isoLocal(new Date()).slice(0, 7)}.log`);
    fs.appendFileSync(arq, linha.replace(/\r?\n/g, ' ') + '\n');
    const antigos = fs.readdirSync(pastaLogs()).filter(f => /^junps-\d{4}-\d{2}\.log$/.test(f)).sort().reverse().slice(6);
    antigos.forEach(f => fs.unlinkSync(path.join(pastaLogs(), f)));
  } catch (err) { console.error('log:', err.message); }
}
ipcMain.on('log', (_e, linha) => log(String(linha).slice(0, 2000)));
ipcMain.on('abrir-logs', () => { fs.mkdirSync(pastaLogs(), { recursive: true }); shell.openPath(pastaLogs()); });
process.on('uncaughtException', err => log(`[${new Date().toLocaleString()}] main: ${err.stack || err.message}`));

// ---- Backup automático: grava em Documentos\Junps Finance\backups e mantém os 30 mais recentes ----
ipcMain.on('auto-backup', (_event, json) => {
  try {
    const dir = pastaBackup();
    fs.mkdirSync(dir, { recursive: true });
    const hoje = isoLocal(new Date());
    fs.writeFileSync(path.join(dir, `backup-${hoje}.json`), json);          // um arquivo por dia (sobrescreve no mesmo dia)
    fs.writeFileSync(path.join(dir, 'latest.json'), json);                   // sempre o mais recente
    // espelho dos dados em disco (gravação atômica: escreve num temporário e renomeia)
    fs.mkdirSync(pastaDados(), { recursive: true });
    const tmp = path.join(pastaDados(), 'junps.json.tmp');
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, path.join(pastaDados(), 'junps.json'));
    const antigos = fs.readdirSync(dir).filter(f => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(30);
    antigos.forEach(f => fs.unlinkSync(path.join(dir, f)));
  } catch (err) {
    log(`[${new Date().toLocaleString()}] backup: ${err.message}`);
  }
});

// ---- Dados em disco: leitura do espelho (usada para restaurar se o armazenamento interno estiver vazio) ----
ipcMain.handle('dados:ler', () => {
  try {
    const arq = path.join(pastaDados(), 'junps.json');
    if (fs.existsSync(arq)) return JSON.parse(fs.readFileSync(arq, 'utf8'));
    const latest = path.join(pastaBackup(), 'latest.json');
    if (fs.existsSync(latest)) return JSON.parse(fs.readFileSync(latest, 'utf8'));
  } catch (err) { log(`[${new Date().toLocaleString()}] dados:ler: ${err.message}`); }
  return null;
});

// ---- Arquivos (anexos, logos, thumbnails) guardados como arquivos de verdade em Documentos\Junps Finance\arquivos ----
const nomeSeguro = n => String(n || 'arquivo').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120);
const dentroDeArquivos = p => { const base = path.resolve(pastaArquivos()) + path.sep; return path.resolve(p).startsWith(base); };
ipcMain.handle('arquivo:salvar', (_e, { pasta, nome, dataUrl }) => {
  const dir = path.join(pastaArquivos(), ...String(pasta || '').split('/').filter(Boolean).map(nomeSeguro));
  fs.mkdirSync(dir, { recursive: true });
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!m) throw new Error('conteúdo inválido');
  let destino = path.join(dir, nomeSeguro(nome));
  if (fs.existsSync(destino)) { const ext = path.extname(destino); destino = path.join(dir, `${path.basename(destino, ext)}-${Date.now()}${ext}`); }
  fs.writeFileSync(destino, Buffer.from(m[2], 'base64'));
  return destino;
});
ipcMain.handle('arquivo:ler', (_e, caminho) => {
  if (!dentroDeArquivos(caminho) || !fs.existsSync(caminho)) return null;
  const ext = path.extname(caminho).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(caminho).toString('base64')}`;
});
ipcMain.on('arquivo:abrir', (_e, caminho) => { if (dentroDeArquivos(caminho) && fs.existsSync(caminho)) shell.openPath(caminho); });
ipcMain.on('arquivo:mostrar', (_e, caminho) => { if (dentroDeArquivos(caminho) && fs.existsSync(caminho)) shell.showItemInFolder(caminho); });
ipcMain.on('arquivo:excluir', (_e, caminho) => { try { if (dentroDeArquivos(caminho) && fs.existsSync(caminho)) fs.unlinkSync(caminho); } catch (err) { log(`[${new Date().toLocaleString()}] arquivo:excluir: ${err.message}`); } });
ipcMain.on('abrir-pasta-app', () => { fs.mkdirSync(pastaApp(), { recursive: true }); shell.openPath(pastaApp()); });
ipcMain.on('abrir-modulo', (_e, arquivo) => { if (mainWindow && /^[a-z.]+\.html$/.test(arquivo)) mainWindow.loadFile(arquivo); });

// Compatibilidade: quem já tinha backups em "Documentos\Finance Manager" continua encontrando-os
try {
  const antiga = path.join(app.getPath('documents'), 'Finance Manager');
  if (fs.existsSync(antiga) && !fs.existsSync(pastaApp())) fs.renameSync(antiga, pastaApp());
} catch (err) { console.error(err.message); }

// ---- Atualização automática (GitHub Releases) ----
function enviarUpdate(info) { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update', info); }
function configurarUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: m => log(`[updater] ${m}`), warn: m => log(`[updater] ${m}`), error: m => log(`[updater] ERRO ${m}`), debug: () => {} };
  autoUpdater.on('checking-for-update', () => enviarUpdate({ estado: 'verificando' }));
  autoUpdater.on('update-available', i => enviarUpdate({ estado: 'baixando', versao: i.version }));
  autoUpdater.on('update-not-available', () => enviarUpdate({ estado: 'atualizado', versao: app.getVersion() }));
  autoUpdater.on('download-progress', p => enviarUpdate({ estado: 'progresso', pct: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => enviarUpdate({ estado: 'pronto', versao: i.version }));
  autoUpdater.on('error', e => enviarUpdate({ estado: 'erro', msg: String(e && e.message || e) }));
  const checar = () => autoUpdater.checkForUpdates().catch(e => log(`[updater] ${e.message}`));
  setTimeout(checar, 5000);                 // 5 s depois de abrir
  setInterval(checar, 6 * 60 * 60 * 1000);  // e a cada 6 horas
}
ipcMain.handle('versao', () => app.getVersion());
ipcMain.on('verificar-update', () => {
  if (!autoUpdater || !app.isPackaged) { enviarUpdate({ estado: 'indisponivel' }); return; }
  autoUpdater.checkForUpdates().catch(e => enviarUpdate({ estado: 'erro', msg: e.message }));
});
ipcMain.on('instalar-update', () => { if (autoUpdater) autoUpdater.quitAndInstall(false, true); });

app.on('ready', () => {
  log(`[${new Date().toLocaleString()}] app iniciado v${app.getVersion()} (Electron ${process.versions.electron}, ${process.platform})`);
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#1c1b20',
    show: false,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('render-process-gone', (_e, d) => log(`[${new Date().toLocaleString()}] janela encerrada: ${d.reason}`));
  mainWindow.loadFile('index.html');
  configurarUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
