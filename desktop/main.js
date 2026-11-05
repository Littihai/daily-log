// Daily Log Desktop: เปลือกแอป Windows ที่เปิดเว็บจริง (แก้เว็บแล้วแอปอัปเดตตามอัตโนมัติ ไม่ต้องแจกไฟล์ใหม่)
const { app, BrowserWindow, Menu, session, shell } = require('electron');
const path = require('path');

const APP_URL = 'https://ritz-dailylog-3476.web.app/';
const APP_ORIGIN = new URL(APP_URL).origin;
// หน้าล็อกอิน Microsoft ที่เปิดเป็นหน้าต่างเล็กได้ (ใช้กับปุ่มเชื่อม Outlook / Teams)
const LOGIN_HOSTS = new Set(['login.microsoftonline.com', 'login.live.com', 'login.windows.net']);

let win = null;

function isHttp(u) { return u.protocol === 'https:' || u.protocol === 'http:'; }

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 900, minHeight: 600,
    title: 'Daily Log', icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f1f2f4', show: false, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', e => e.preventDefault()); // คงชื่อหน้าต่างเป็น Daily Log

  win.webContents.setWindowOpenHandler(({ url }) => {
    let u;
    try { u = new URL(url); } catch { return { action: 'deny' }; }
    if (u.origin === APP_ORIGIN || LOGIN_HOSTS.has(u.hostname)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, parent: win, autoHideMenuBar: true, title: 'เข้าสู่ระบบ Microsoft' } };
    }
    if (isHttp(u)) shell.openExternal(url);   // ลิงก์ภายนอกเปิดในเบราว์เซอร์ปกติ
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    let u;
    try { u = new URL(url); } catch { e.preventDefault(); return; }
    if (u.origin === APP_ORIGIN || u.protocol === 'file:') return;
    e.preventDefault();
    if (isHttp(u)) shell.openExternal(url);
  });

  // ต่อเน็ตไม่ได้: แสดงหน้าแจ้งและลองใหม่เมื่อกลับมาออนไลน์
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'));
  });

  // ทางลัดแป้นพิมพ์ (ไม่มีเมนูของแอป)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta, wc = win.webContents;
    if (input.key === 'F5' || (ctrl && input.key.toLowerCase() === 'r')) { wc.reload(); e.preventDefault(); }
    else if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (ctrl && (input.key === '=' || input.key === '+')) { wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 3)); e.preventDefault(); }
    else if (ctrl && input.key === '-') { wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3)); e.preventDefault(); }
    else if (ctrl && input.key === '0') { wc.setZoomLevel(0); e.preventDefault(); }
  });

  win.loadURL(APP_URL);
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const ses = session.defaultSession;
    // ตัดคำว่า Electron ออกจาก User-Agent เพื่อให้เว็บและหน้าล็อกอิน Microsoft ปฏิบัติเหมือนเบราว์เซอร์ทั่วไป
    ses.setUserAgent(ses.getUserAgent().replace(/\s?Electron\/\S+/, '').replace(/\s?daily-log-desktop\/\S+/, ''));
    // ไม่ให้เว็บขอสิทธิ์กล้อง ไมค์ ตำแหน่ง ฯลฯ อนุญาตเฉพาะเต็มจอและคัดลอกข้อความ
    ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen' || permission === 'clipboard-sanitized-write'));
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => app.quit());
}
