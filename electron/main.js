// Thin Electron wrapper: boots the same Express server on a free local port,
// points data at Electron userData, and opens a BrowserWindow auto-logged-in
// as admin. The server code is reused completely unchanged.
import { app, BrowserWindow, session, shell } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.join(__dirname, '..', 'server', 'index.js');

let serverProc = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// Stable per-install admin password so sessions survive restarts.
function desktopPassword() {
  const file = path.join(app.getPath('userData'), 'admin-secret.txt');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch {}
  const pw = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pw, 'utf8');
  return pw;
}

function nodeBinary() {
  // Packaged: always run the server via Electron's own binary in Node mode.
  // The bundled better-sqlite3 is rebuilt for Electron's ABI, and only the
  // Electron binary can read the server code out of the asar archive.
  if (app.isPackaged) return null;
  // Dev: prefer the system Node (matches the ABI better-sqlite3 was installed for).
  const probe = spawnSync(process.platform === 'win32' ? 'node.exe' : 'node', ['-v'], { shell: false });
  if (!probe.error) return process.platform === 'win32' ? 'node.exe' : 'node';
  // Fallback: run Electron's binary in Node mode.
  return null;
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Server did not start in time');
}

async function start() {
  const port = await freePort();
  const password = desktopPassword();
  const env = {
    ...process.env,
    PORT: String(port),
    ADMIN_PASSWORD: password,
    DB_PATH: path.join(app.getPath('userData'), 'links.db'),
  };

  const nodeBin = nodeBinary();
  if (nodeBin) {
    serverProc = spawn(nodeBin, [SERVER_ENTRY], { env, stdio: 'inherit' });
  } else {
    serverProc = spawn(process.execPath, [SERVER_ENTRY], {
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit',
    });
  }
  serverProc.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`Server exited with code ${code}`);
  });

  const base = `http://127.0.0.1:${port}`;
  await waitForServer(`${base}/api/me`);

  // Auto-login: derive the same session token the server derives and set it
  // as a cookie before the window loads.
  const token = crypto
    .createHmac('sha256', password)
    .update('link-shortener-admin-session-v1')
    .digest('hex');
  await session.defaultSession.cookies.set({
    url: base,
    name: 'ls_session',
    value: token,
    httpOnly: true,
    sameSite: 'lax',
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // Open external links (destinations, docs) in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  await win.loadURL(base);
}

app.whenReady().then(start).catch((err) => {
  console.error(err);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => {
  if (serverProc && !serverProc.killed) serverProc.kill();
});
