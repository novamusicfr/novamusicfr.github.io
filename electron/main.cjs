// Nova Music — app PC (Windows / Mac / Linux)
// L'app sert ses fichiers sur http://localhost (un vrai "site" local) :
// - les lecteurs YouTube/Spotify/Deezer acceptent de s'y afficher ;
// - Firebase autorise "localhost" par défaut ;
// - la connexion Google passe par ton navigateur puis revient ici.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DIST = path.join(__dirname, '..', 'dist');
const PORTS = [47821, 47822, 47823, 47824];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

let win = null;
let port = null;
let pendingNonce = null;

/* ---------- Une seule instance de l'app ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

/* ---------- Mini serveur local ---------- */
function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');

  // Retour de la connexion Google (envoyé par desktop-login.html)
  if (req.method === 'POST' && url.pathname === '/auth-callback') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!pendingNonce || data.nonce !== pendingNonce || !data.idToken) throw new Error('bad');
        pendingNonce = null;
        if (win) {
          win.webContents.send('google-token', { idToken: data.idToken, accessToken: data.accessToken || null });
          if (win.isMinimized()) win.restore();
          win.show(); win.focus();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch (_) { res.writeHead(400); res.end('{"ok":false}'); }
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

function listenOn(p, host) {
  return new Promise((resolve, reject) => {
    const s = http.createServer(handler);
    s.once('error', reject);
    s.listen(p, host, () => resolve(s));
  });
}
async function startServer() {
  for (const p of PORTS) {
    try {
      await listenOn(p, '127.0.0.1');
      // "localhost" peut pointer vers ::1 (IPv6) selon le PC : on écoute aussi là
      await listenOn(p, '::1').catch(() => {});
      return p;
    } catch (_) { /* port occupé, on essaie le suivant */ }
  }
  throw new Error('Aucun port libre pour Nova Music');
}

/* ---------- Fenêtre ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 380, minHeight: 600,
    backgroundColor: '#0a0a12', title: 'Nova Music', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Les liens externes (« Ouvrir sur Spotify », Discord…) s'ouvrent dans le navigateur
  // sauf les fenêtres de connexion Spotify/Deezer, gardées dans l'app pour que
  // les lecteurs intégrés puissent jouer les titres en entier.
  const LOGIN_POPUPS = /^https:\/\/(accounts\.spotify\.com|open\.spotify\.com|(www\.|account\.|connect\.)?deezer\.com)\//;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (LOGIN_POPUPS.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true, backgroundColor: '#ffffff' } };
    }
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://localhost:${port}/`)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });

  win.loadURL(`http://localhost:${port}/index.html`);
  win.on('closed', () => { win = null; });
}

/* ---------- Connexion Google ---------- */
ipcMain.handle('google-login', async () => {
  pendingNonce = crypto.randomBytes(24).toString('hex');
  await shell.openExternal(`http://localhost:${port}/desktop-login.html?nonce=${pendingNonce}`);
  return true;
});

app.whenReady().then(async () => {
  if (!gotLock) return;
  Menu.setApplicationMenu(null);
  port = await startServer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
