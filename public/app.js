import { firebaseConfig } from './firebase-config.js';
import { msConfig } from './ms-config.js';

/* =====================================================================
   ค่าคงที่ (แก้หมวดงาน / สถานะได้ที่นี่)
   ===================================================================== */
const CATEGORIES = [
  { id: 'dev',     label: 'พัฒนาระบบ',        color: '#3b82f6' },
  { id: 'bug',     label: 'แก้ไขบั๊ก',         color: '#ef4444' },
  { id: 'test',    label: 'ทดสอบ',            color: '#8b5cf6' },
  { id: 'deploy',  label: 'Deploy / Release', color: '#f59e0b' },
  { id: 'meeting', label: 'ประชุม',           color: '#22c55e' },
  { id: 'doc',     label: 'เอกสาร',           color: '#14b8a6' },
  { id: 'support', label: 'Support',          color: '#ec4899' },
  { id: 'other',   label: 'อื่นๆ',            color: '#94a3b8' },
];
const STATUSES = [
  { id: 'todo',    label: 'วางแผน',        icon: 'circle' },
  { id: 'doing',   label: 'กำลังทำ',        icon: 'half' },
  { id: 'done',    label: 'เสร็จแล้ว',      icon: 'check' },
  { id: 'blocked', label: 'ติดปัญหา / รอ',  icon: 'alert' },
];
const HOUR_H = 72;
const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const FIELDS = ['title', 'date', 'start', 'end', 'category', 'status', 'project', 'note', 'assignee', 'link', 'ownerId', 'ownerName'];
const SNAP = 15;
const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
// เทมเพลตเริ่มต้น (ผู้ใช้เก็บเทมเพลตของตัวเองเพิ่มได้จากฟอร์ม เก็บไว้ในเบราว์เซอร์เครื่องนั้น)
const DEFAULT_TEMPLATES = [
  { name: 'ประชุมประจำวัน', title: 'ประชุมประจำวัน', category: 'meeting', minutes: 30 },
  { name: 'แก้บั๊ก', title: 'แก้ไขบั๊ก', category: 'bug', minutes: 60 },
  { name: 'ทดสอบระบบ', title: 'ทดสอบระบบ', category: 'test', minutes: 60 },
  { name: 'Support ผู้ใช้', title: 'ตอบปัญหา / Support ผู้ใช้', category: 'support', minutes: 60 },
];
const MAX_REPEAT = 200;

/* =====================================================================
   ฟังก์ชันช่วย
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7)); // เริ่มวันจันทร์
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const minToStr = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const stamp = (key, time) => { const [y, mo, d] = key.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, mo - 1, d, h, mi).getTime(); };
const be = d => d.getFullYear() + 543;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catOf = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const stOf = id => STATUSES.find(s => s.id === id) || STATUSES[0];
const fmtH = m => `${Math.round(m / 60 * 100) / 100} ชม.`;
const fmtThai = d => `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${be(d)}`;
const dur = ev => Math.max(0, toMin(ev.end) - toMin(ev.start));
const snap = m => Math.round(m / SNAP) * SNAP;
const safeUrl = u => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
const round2 = n => Math.round(n * 100) / 100;

const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  dots: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  check: '<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>',
  alert: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  half: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  report: '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/>',
};
const ic = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const stIcon = id => ic(stOf(id).icon);

function pref(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function setPref(key, val) { try { localStorage.setItem(key, val); } catch { /* ignore */ } }

let toastTimer;
function toast(msg, bad = false, action = null) {
  const el = $('#toast');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.textContent = '';
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tbtn'; b.textContent = action.label;
    b.onclick = () => { el.hidden = true; clearTimeout(toastTimer); action.fn(); };
    el.appendChild(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 8000 : bad ? 5000 : 2200);
}

/* =====================================================================
   ชั้นเก็บข้อมูล: Firestore (ถ้าตั้งค่าแล้ว) หรือ localStorage
   ===================================================================== */
const pick = ev => Object.fromEntries(FIELDS.map(k => [k, ev[k] ?? '']));
// งานที่ยังไม่มีเจ้าของจะถูกบันทึกในชื่อผู้ใช้ที่ล็อกอินอยู่
const withOwner = d => (d.ownerId ? d : { ...d, ownerId: state.me.username, ownerName: state.me.name });

function localStore() {
  const KEY = 'dailylog.events.v1';
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { list = []; }
  const subs = new Set();
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
    subs.forEach(f => f(list.slice(), {}));
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  return {
    mode: 'local',
    subscribe(cb) { subs.add(cb); cb(list.slice(), {}); },
    async save(ev) {
      const i = ev.id ? list.findIndex(x => x.id === ev.id) : -1;
      if (i >= 0) list[i] = { ...list[i], ...withOwner(pick(ev)) }; else list.push({ ...withOwner(pick(ev)), id: ev.id || uid() });
      persist();
    },
    async saveMany(evs) { evs.forEach(e => list.push({ ...withOwner(pick(e)), id: uid() })); persist(); },
    async claim(items) { items.forEach(e => { const i = list.findIndex(x => x.id === e.id); if (i >= 0) list[i] = { ...list[i], ownerId: state.me.username, ownerName: state.me.name }; }); persist(); },
    async remove(id) { list = list.filter(x => x.id !== id); persist(); },
  };
}

/* =====================================================================
   Firebase: ล็อกอิน (Authentication) + ฐานข้อมูล (Firestore)
   บัญชีล็อกอินคืออีเมลสังเคราะห์ ชื่อผู้ใช้.rev@dailylog.example.com ใช้รหัส 6 หลักเป็นรหัสผ่าน
   rev เพิ่มทุกครั้งที่แอดมินรีเซ็ตรหัส (ฝั่งเบราว์เซอร์เปลี่ยนรหัสของคนอื่นโดยตรงไม่ได้)
   ===================================================================== */
const EMAIL_DOMAIN = 'dailylog.example.com';
const emailOf = (u, rev) => `${u}.${rev}@${EMAIL_DOMAIN}`;
const unameOf = email => String(email || '').split('.')[0];
const revOf = email => Number(String(email || '').split('.')[1].split('@')[0]) || 0;

async function loadBackend() {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
  const [{ initializeApp, deleteApp }, fs, au] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-firestore.js`),
    import(`${SDK}/firebase-auth.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = au.getAuth(app);
  const db = fs.getFirestore(app); // ใช้แคชในหน่วยความจำ ไม่เก็บข้อมูลค้างในเครื่องที่ใช้ร่วมกัน
  // ทดสอบกับ emulator ได้เฉพาะเปิดจาก localhost ที่ต่อท้าย ?emu
  const emu = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emu');
  if (emu) {
    au.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const col = fs.collection(db, 'events');
  const ts = () => fs.serverTimestamp();
  const userRef = u => fs.doc(db, 'users', u);
  const codeRef = h => fs.doc(db, 'codes', h);
  // รหัส 6 หลักเดาได้ง่าย จึงใช้เป็นตัวระบุตัวตนของเอกสารค้นหา (ชื่อเอกสาร = SHA-256 ของรหัส)
  const codeHash = async code => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dailylog:' + code));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const newId = () => 'u' + Array.from(crypto.getRandomValues(new Uint8Array(6)), x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');

  // สร้างบัญชีล็อกอินด้วยแอปรอง เพื่อไม่ให้แอดมินหลุดจากการล็อกอินของตัวเอง
  async function createAccount(username, code, startRev) {
    const secApp = initializeApp(firebaseConfig, `sec-${Date.now()}`);
    const secAuth = au.initializeAuth(secApp, { persistence: au.inMemoryPersistence });
    if (emu) au.connectAuthEmulator(secAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    try {
      for (let rev = startRev; rev < startRev + 10; rev++) {
        const email = emailOf(username, rev);
        try { await au.createUserWithEmailAndPassword(secAuth, email, code); return { email, rev }; }
        catch (e) { if (e.code !== 'auth/email-already-in-use') throw e; }
      }
      throw { code: 'app/create-failed' };
    } finally {
      try { await au.signOut(secAuth); } catch { /* ignore */ }
      try { await deleteApp(secApp); } catch { /* ignore */ }
    }
  }

  const api = {
    mode: 'firebase', emu,
    onAuth: cb => au.onAuthStateChanged(auth, cb),
    currentUser: () => auth.currentUser,
    logout: () => au.signOut(auth),

    codeTaken: async code => (await fs.getDoc(codeRef(await codeHash(code)))).exists(),

    async login(code, remember) {
      await au.setPersistence(auth, remember ? au.browserLocalPersistence : au.browserSessionPersistence);
      const snap = await fs.getDoc(codeRef(await codeHash(code)));
      if (!snap.exists()) throw { code: 'app/bad-login' };
      await au.signInWithEmailAndPassword(auth, snap.data().email, code);
    },

    async profile() {
      const u = auth.currentUser;
      const s = await fs.getDoc(userRef(unameOf(u.email)));
      if (!s.exists()) throw { code: 'app/no-profile' };
      const d = s.data();
      if (d.active !== true || d.authEmail !== u.email) throw { code: 'app/disabled' };
      return { username: unameOf(u.email), name: d.name, role: d.role };
    },

    eventStore(me) {
      // User เห็นเฉพาะงานของตัวเอง (กฎฝั่งเซิร์ฟเวอร์บังคับด้วย) Admin/Overview เห็นทั้งหมด
      const q = me.role === 'user' ? fs.query(col, fs.where('ownerId', '==', me.username)) : col;
      const own = d => (d.ownerId ? d : { ...d, ownerId: me.username, ownerName: me.name });
      return {
        mode: 'firebase',
        subscribe(cb, onErr) {
          return fs.onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata), onErr);
        },
        save(ev) {
          const data = own({ ...pick(ev), updatedAt: ts() });
          if (ev.id) return fs.setDoc(fs.doc(db, 'events', ev.id), data, { merge: true });
          return fs.setDoc(fs.doc(col), { ...data, createdAt: ts() });
        },
        async saveMany(evs) {
          for (let i = 0; i < evs.length; i += 400) {
            const batch = fs.writeBatch(db);
            evs.slice(i, i + 400).forEach(e => batch.set(fs.doc(col), { ...own(pick(e)), createdAt: ts(), updatedAt: ts() }));
            await batch.commit();
          }
        },
        async claim(items) {
          for (let i = 0; i < items.length; i += 400) {
            const batch = fs.writeBatch(db);
            items.slice(i, i + 400).forEach(e => batch.set(fs.doc(db, 'events', e.id), { ownerId: me.username, ownerName: me.name }, { merge: true }));
            await batch.commit();
          }
        },
        remove(id) { return fs.deleteDoc(fs.doc(db, 'events', id)); },
      };
    },

    subscribeUsers(cb, onErr) {
      return fs.onSnapshot(fs.collection(db, 'users'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), onErr);
    },

    async addUser({ username, name, role, code }) {
      if (await api.codeTaken(code)) throw { code: 'app/code-taken' };
      if (!username) {
        for (let i = 0; i < 6; i++) {
          username = newId();
          if (!(await fs.getDoc(userRef(username))).exists()) break;
        }
      } else if ((await fs.getDoc(userRef(username))).exists()) throw { code: 'app/exists' };
      const { email, rev } = await createAccount(username, code, 0);
      const b = fs.writeBatch(db);
      b.set(userRef(username), { username, name, role, active: true, authEmail: email, rev, createdAt: ts() });
      b.set(codeRef(await codeHash(code)), { email, username });
      await b.commit();
    },

    async resetCode(username, code) {
      const s = await fs.getDoc(userRef(username));
      if (!s.exists()) throw { code: 'app/no-user' };
      if (await api.codeTaken(code)) throw { code: 'app/code-taken' };
      const olds = await fs.getDocs(fs.query(fs.collection(db, 'codes'), fs.where('username', '==', username)));
      const { email, rev } = await createAccount(username, code, (s.data().rev || 0) + 1);
      const b = fs.writeBatch(db);
      b.update(userRef(username), { authEmail: email, rev, updatedAt: ts() });
      b.set(codeRef(await codeHash(code)), { email, username });
      olds.docs.forEach(d => b.delete(d.ref)); // รหัสเก่าใช้ไม่ได้อีก และเอากลับมาใช้ซ้ำได้
      await b.commit();
    },

    setUserActive: (username, active) => fs.updateDoc(userRef(username), { active, updatedAt: ts() }),
    setUserRole: (username, role) => fs.updateDoc(userRef(username), { role, updatedAt: ts() }),

    async changeMyCode(current, next) {
      const u = auth.currentUser;
      if (await api.codeTaken(next)) throw { code: 'app/code-taken' };
      await au.reauthenticateWithCredential(u, au.EmailAuthProvider.credential(u.email, current));
      const newRef = codeRef(await codeHash(next));
      await fs.setDoc(newRef, { email: u.email, username: unameOf(u.email) });
      try { await au.updatePassword(u, next); } catch (e) { await fs.deleteDoc(newRef).catch(() => {}); throw e; }
      await fs.deleteDoc(codeRef(await codeHash(current))).catch(() => {});
    },

    // ติดตั้งครั้งแรก: สร้างแอดมิน (และ Overview ถ้าใส่รหัส) กฎฝั่งเซิร์ฟเวอร์ตรวจรหัสติดตั้งและยอมให้ทำครั้งเดียว
    async setup({ key, name, adminCode, overviewCode }) {
      let email = null, created = false;
      for (let rev = 0; rev < 10 && !email; rev++) {
        const e = emailOf('admin', rev);
        try { await au.createUserWithEmailAndPassword(auth, e, adminCode); email = e; created = true; }
        catch (err) {
          if (err.code !== 'auth/email-already-in-use') throw err;
          try { await au.signInWithEmailAndPassword(auth, e, adminCode); email = e; }
          catch (e2) { if (!['auth/invalid-credential', 'auth/wrong-password'].includes(e2.code)) throw e2; }
        }
      }
      if (!email) throw { code: 'app/create-failed' };
      try {
        await fs.setDoc(fs.doc(db, 'config', 'setup'), { setupKey: key, adminEmail: email });
        const b = fs.writeBatch(db);
        b.set(userRef('admin'), { username: 'admin', name, role: 'admin', active: true, authEmail: email, rev: revOf(email), createdAt: ts() });
        b.set(codeRef(await codeHash(adminCode)), { email, username: 'admin' });
        await b.commit();
      } catch (err) {
        if (created) { try { await au.deleteUser(auth.currentUser); } catch { /* ignore */ } } else { try { await au.signOut(auth); } catch { /* ignore */ } }
        throw err;
      }
      if (overviewCode) await api.addUser({ username: 'overview', name: 'ผู้บริหาร (Overview)', role: 'overview', code: overviewCode });
    },
  };
  return api;
}

/* =====================================================================
   สถานะของแอป
   ===================================================================== */
const state = {
  page: 'calendar',
  view: ['d', '5d', 'w', 'm'].includes(pref('dl.view', '5d')) ? pref('dl.view', '5d') : '5d',
  anchor: new Date(),
  events: [],
  query: '',
  report: { mode: 'week', anchor: new Date(), from: toKey(startOfWeek(new Date())), to: toKey(addDays(startOfWeek(new Date()), 6)) },
  filter: { category: '', status: '', project: '', assignee: '', owner: '' },
  me: null,
  ms: { on: false, items: [], key: '', loadingKey: '', error: '', busy: false, mode: 'all' },
  users: [],
  unsub: null,
  usersUnsub: null,
  dragging: false,
  pendingRender: false,
  conn: { cls: '', text: 'กำลังเชื่อมต่อ...' },
  scrollInit: true,
};
let store;
const byId = id => state.events.find(e => e.id === id);

const filterCount = () => Object.entries(state.filter).filter(([k, v]) => v && !(k === 'owner' && v === defaultOwner())).length;
const passFilter = e => {
  const f = state.filter;
  return (!f.category || catOf(e.category).id === f.category)
    && (!f.status || stOf(e.status).id === f.status)
    && (!f.project || (e.project || '') === f.project)
    && (!f.assignee || (e.assignee || '') === f.assignee)
    && (!f.owner || (e.ownerId || '') === f.owner);
};
const isPending = e => e.date < toKey(new Date()) && e.status !== 'done' && inScope(e);
const visibleEvents = () => {
  const q = state.query.trim().toLowerCase();
  const base = state.events.filter(passFilter);
  if (!q) return base;
  return base.filter(e => `${e.title} ${e.project} ${e.assignee} ${e.ownerName} ${e.note} ${catOf(e.category).label} ${stOf(e.status).label}`.toLowerCase().includes(q));
};
const eventsByDay = list => {
  const map = new Map();
  list.forEach(e => { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date).push(e); });
  map.forEach(a => a.sort((x, y) => toMin(x.start) - toMin(y.start) || toMin(x.end) - toMin(y.end)));
  return map;
};

/* =====================================================================
   ปฏิทิน
   ===================================================================== */
function viewDays() {
  const a = state.anchor;
  if (state.view === 'd') return [new Date(a.getFullYear(), a.getMonth(), a.getDate())];
  const mon = startOfWeek(a);
  return Array.from({ length: state.view === '5d' ? 5 : 7 }, (_, i) => addDays(mon, i));
}

function rangeLabel() {
  const a = state.anchor;
  if (state.view === 'm') return `${MONTHS[a.getMonth()]} ${be(a)}`;
  const days = viewDays(), f = days[0], l = days[days.length - 1];
  if (state.view === 'd') return `${f.getDate()} ${MONTHS[f.getMonth()]} ${be(f)}`;
  if (f.getMonth() === l.getMonth() && f.getFullYear() === l.getFullYear()) return `${MONTHS[f.getMonth()]} ${be(f)}`;
  if (f.getFullYear() === l.getFullYear()) return `${MONTHS_SHORT[f.getMonth()]} - ${MONTHS_SHORT[l.getMonth()]} ${be(f)}`;
  return `${MONTHS_SHORT[f.getMonth()]} ${be(f)} - ${MONTHS_SHORT[l.getMonth()]} ${be(l)}`;
}

function layoutDay(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const ends = [];
    cluster.forEach(it => {
      let c = ends.findIndex(end => end <= it.s);
      if (c < 0) { c = ends.length; ends.push(it.e); } else ends[c] = it.e;
      it.col = c;
    });
    cluster.forEach(it => { it.cols = ends.length; });
    out.push(...cluster); cluster = []; clusterEnd = -1;
  };
  items.forEach(it => {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  });
  if (cluster.length) flush();
  return out;
}

function eventHtml(it) {
  const ev = it.ev, c = catOf(ev.category);
  const h = Math.max((it.e - it.s) / 60 * HOUR_H - 3, 22);
  const short = h < 50;
  const top = it.s / 60 * HOUR_H + 1;
  const style = `--c:${c.color};top:${top}px;height:${h}px;left:calc(${it.col} * 100% / ${it.cols} + 3px);width:calc(100% / ${it.cols} - 6px)`;
  const sub = [ev.ownerId && !isMine(ev) ? ev.ownerName : (!ev.ownerId && can().all ? 'งานเดิม' : ''), ev.project, ev.assignee].filter(Boolean).map(esc).join(' · ');
  const link = safeUrl(ev.link);
  return `<div class="ev st-${esc(ev.status)}${short ? ' short' : ''}" data-id="${esc(ev.id)}" style="${style}" title="${esc(ev.title)}">
    <div class="ev-title">${esc(ev.title)}</div>
    <div class="ev-time">${ic('clock')}<span>${esc(ev.start)} → ${esc(ev.end)}</span>${sub ? `<span class="proj">· ${sub}</span>` : ''}</div>
    <button type="button" class="ev-menu" data-menu aria-label="ตัวเลือก">${ic('dots')}</button>
    ${link ? `<a class="ev-link" data-link href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="เปิดลิงก์">${ic('link')}</a>` : ''}
    <span class="ev-st" title="${esc(stOf(ev.status).label)}">${stIcon(ev.status)}</span>
    <div class="ev-resize" data-resize title="ลากเพื่อปรับเวลาเสร็จ"></div>
  </div>`;
}

function renderTimeGrid(days) {
  const map = eventsByDay(visibleEvents());
  const todayKey = toKey(new Date());
  const minCol = state.view === 'd' ? 280 : state.view === '5d' ? 200 : 140;
  const off = -new Date().getTimezoneOffset() / 60;
  const gmt = `GMT${off >= 0 ? '+' : '-'}${pad(Math.abs(Math.trunc(off)))}`;
  const head = days.map(d => `<div class="tg-dayhead${toKey(d) === todayKey ? ' today' : ''}"><span>${DAY_NAMES[d.getDay()]}</span><b>${pad(d.getDate())}</b></div>`).join('');
  const hours = Array.from({ length: 23 }, (_, i) => `<span style="top:${(i + 1) * HOUR_H}px">${pad(i + 1)}:00</span>`).join('');
  const cols = days.map(d => {
    const key = toKey(d);
    const items = (map.get(key) || []).map(ev => {
      const s = Math.min(toMin(ev.start), 24 * 60 - 15);
      const e = Math.min(Math.max(toMin(ev.end), s + 15), 24 * 60);
      return { ev, s, e };
    });
    return `<div class="tg-col" data-date="${key}" title="คลิกเพื่อเพิ่มงาน">${msBlocksHtml(key)}${layoutDay(items).map(eventHtml).join('')}${key === todayKey ? '<div class="nowline"></div>' : ''}</div>`;
  }).join('');
  return `<div class="tg" style="--cols:${days.length};--mincol:${minCol}px;--hh:${HOUR_H}px">
    <div class="tg-head"><div class="tg-corner">${gmt}</div>${head}</div>
    <div class="tg-body"><div class="tg-gutter">${hours}</div>${cols}</div>
  </div>`;
}

function renderMonth() {
  const a = state.anchor;
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const weeks = Math.ceil(((last - start) / 86400000 + 1) / 7);
  const map = eventsByDay(visibleEvents());
  const todayKey = toKey(new Date());
  const names = [1, 2, 3, 4, 5, 6, 0].map(i => `<div>${DAY_NAMES[i]}</div>`).join('');
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), key = toKey(d), list = map.get(key) || [];
    const chips = list.slice(0, 3).map(ev => {
      const c = catOf(ev.category);
      return `<button type="button" class="chip st-${esc(ev.status)}" data-id="${esc(ev.id)}" style="--c:${c.color}" title="${esc(ev.title)}${ev.assignee ? ' · ' + esc(ev.assignee) : ''}"><i></i><span class="t">${esc(ev.start)}</span><span>${esc(ev.title)}</span></button>`;
    }).join('');
    const more = list.length > 3 ? `<button type="button" class="more" data-goday="${key}">+${list.length - 3} รายการ</button>` : '';
    cells += `<div class="mcell${d.getMonth() !== a.getMonth() ? ' other' : ''}${key === todayKey ? ' today' : ''}" data-date="${key}"><button type="button" class="dn" data-goday="${key}">${d.getDate()}</button>${msCountHtml(key)}${chips}${more}</div>`;
  }
  return `<div class="mv"><div class="mv-head">${names}</div><div class="mv-grid" style="grid-template-rows:repeat(${weeks},minmax(116px,1fr))">${cells}</div></div>`;
}

function renderCalendar() {
  const host = $('#calview');
  const sTop = host.scrollTop, sLeft = host.scrollLeft;
  host.innerHTML = state.view === 'm' ? renderMonth() : renderTimeGrid(viewDays());
  $('#rangeLabel').textContent = rangeLabel();
  $$('#segView button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
  if (state.scrollInit) {
    state.scrollInit = false;
    const now = new Date();
    const showsToday = viewDays().some(d => toKey(d) === toKey(now));
    const hour = showsToday && state.view !== 'm' ? Math.max(now.getHours() - 2, 0) : 7;
    host.scrollTop = hour * HOUR_H; host.scrollLeft = 0;
  } else { host.scrollTop = sTop; host.scrollLeft = sLeft; }
  updateNow();
  msEnsure();
}

function updateNow() {
  const el = $('.nowline');
  if (!el) return;
  const n = new Date();
  el.style.top = `${(n.getHours() * 60 + n.getMinutes()) / 60 * HOUR_H}px`;
}

/* =====================================================================
   แถบข้าง
   ===================================================================== */
function renderSide() {
  const now = Date.now();
  let next = null, nextS = Infinity;
  myEvents().forEach(ev => {
    if (!ev.date || !ev.start || !ev.end || ev.status === 'done') return;
    const s = stamp(ev.date, ev.start), e = stamp(ev.date, ev.end);
    if (e > now && s < nextS) { next = ev; nextS = s; }
  });
  const up = $('#upcoming');
  if (next) {
    const d = fromKey(next.date), c = catOf(next.category);
    up.dataset.id = next.id;
    up.style.setProperty('--c', c.color);
    up.innerHTML = `<div class="up-head"><div class="datebox"><span>${MONTHS_SHORT[d.getMonth()]}</span><b>${pad(d.getDate())}</b></div>
      <div style="min-width:0"><div class="up-label">${nextS <= now ? 'กำลังทำอยู่ตอนนี้' : 'งานถัดไป'}</div><div class="up-title"><i></i><span>${esc(next.title)}</span></div></div></div>
      <div class="up-times"><b>${esc(next.start)}</b>${ic('right')}<b>${esc(next.end)}</b></div>
      <div class="up-meta">${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${be(d)}${next.project ? ' · ' + esc(next.project) : ''}${next.assignee ? ' · ' + esc(next.assignee) : ''}</div>
      ${next.note ? `<div class="up-note">${esc(next.note)}</div>` : ''}`;
  } else {
    delete up.dataset.id;
    up.innerHTML = `<h3>งานถัดไป</h3><div class="empty-card">ยังไม่มีงานที่กำลังจะถึง</div>`;
  }

  const todayList = myEvents().filter(e => e.date === toKey(new Date()));
  const done = todayList.filter(e => e.status === 'done').length;
  const mins = todayList.reduce((s, e) => s + dur(e), 0);
  const pct = todayList.length ? Math.round(done / todayList.length * 100) : 0;
  $('#todayCard').innerHTML = `<div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div class="today-text"><b>สรุปวันนี้</b><div>${todayList.length} งาน · ${fmtH(mins)}</div><div>เสร็จแล้ว ${done}/${todayList.length}</div></div>`;

  const conn = $('#conn');
  conn.className = 'conn ' + state.conn.cls;
  conn.innerHTML = `<i></i><span>${esc(state.conn.text)}</span>`;
  renderLegacy();
  updateBadges();
}

function updateBadges() {
  const n = filterCount();
  $$('[data-fbadge]').forEach(b => { b.textContent = n; b.hidden = !n; });
  const p = state.events.filter(isPending).length;
  const el = $('#pendingCount');
  if (el) { el.textContent = p > 99 ? '99+' : p; el.hidden = !p; }
}

/* =====================================================================
   รายงานสรุป
   ===================================================================== */
function reportRange() {
  const r = state.report, a = r.anchor;
  if (r.mode === 'month') return { from: new Date(a.getFullYear(), a.getMonth(), 1), to: new Date(a.getFullYear(), a.getMonth() + 1, 0) };
  if (r.mode === 'range') {
    let f = fromKey(r.from), t = fromKey(r.to);
    if (t < f) [f, t] = [t, f];
    return { from: f, to: t };
  }
  const from = startOfWeek(a);
  return { from, to: addDays(from, 6) };
}
function prevRange() {
  const { from, to } = reportRange();
  if (state.report.mode === 'month') return { from: new Date(from.getFullYear(), from.getMonth() - 1, 1), to: new Date(from.getFullYear(), from.getMonth(), 0) };
  const n = Math.round((to - from) / 86400000) + 1;
  return { from: addDays(from, -n), to: addDays(from, -1) };
}
function eventsIn({ from, to }) {
  const f = toKey(from), t = toKey(to);
  return state.events.filter(e => e.date >= f && e.date <= t && passFilter(e))
    .sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
}
const reportEvents = () => eventsIn(reportRange());
const summarize = list => ({
  n: list.length,
  m: list.reduce((s, e) => s + dur(e), 0),
  done: list.filter(e => e.status === 'done').length,
  blocked: list.filter(e => e.status === 'blocked').length,
});
function deltaHtml(cur, prev, worseWhenUp = false) {
  const diff = round2(cur - prev);
  if (!diff) return `<em class="delta">เท่ากับช่วงก่อนหน้า</em>`;
  const good = worseWhenUp ? diff < 0 : diff > 0;
  return `<em class="delta ${good ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff} จากช่วงก่อนหน้า (${round2(prev)})</em>`;
}
function rangeLabel2(from, to) {
  const m = state.report.mode;
  if (m === 'month') return `${MONTHS[from.getMonth()]} ${be(from)}`;
  if (m === 'range' && from.getFullYear() !== to.getFullYear()) return `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} ${be(from)} - ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]} ${be(to)}`;
  return `${from.getDate()} ${MONTHS_SHORT[from.getMonth()]} - ${to.getDate()} ${MONTHS_SHORT[to.getMonth()]} ${be(to)}`;
}

function renderReport() {
  const host = $('#reportPage');
  const { from, to } = reportRange();
  const list = reportEvents();
  const cur = summarize(list), prev = summarize(eventsIn(prevRange()));
  const mode = state.report.mode;
  const label = rangeLabel2(from, to);

  const byCat = CATEGORIES.map(c => ({ c, m: list.filter(e => catOf(e.category).id === c.id).reduce((s, e) => s + dur(e), 0) })).filter(x => x.m > 0);
  const maxCat = Math.max(1, ...byCat.map(x => x.m));
  const projMap = new Map();
  list.forEach(e => { const k = e.project || '(ไม่ระบุ)'; const o = projMap.get(k) || { n: 0, m: 0 }; o.n++; o.m += dur(e); projMap.set(k, o); });
  const projects = [...projMap.entries()].sort((a, b) => b[1].m - a[1].m);
  const asgMap = new Map();
  list.forEach(e => { const k = e.assignee || '(ไม่ระบุ)'; const o = asgMap.get(k) || { n: 0, m: 0, d: 0 }; o.n++; o.m += dur(e); if (e.status === 'done') o.d++; asgMap.set(k, o); });
  const assignees = [...asgMap.entries()].sort((a, b) => b[1].m - a[1].m);
  const hasAsg = list.some(e => e.assignee);
  const showOwners = can().all;
  const ownMap = new Map();
  if (showOwners) list.forEach(e => { const k = e.ownerName || '(งานเดิม ยังไม่มีเจ้าของ)'; const o = ownMap.get(k) || { n: 0, m: 0, d: 0 }; o.n++; o.m += dur(e); if (e.status === 'done') o.d++; ownMap.set(k, o); });
  const owners = [...ownMap.entries()].sort((a, b) => b[1].m - a[1].m);
  const ownerPanel = showOwners && owners.length ? `<div class="panel"><h3>ตามผู้บันทึก</h3><table class="pt"><tr><th>ผู้บันทึก</th><th>งาน</th><th>ชั่วโมง</th><th>เสร็จ</th></tr>${owners.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${round2(v.m / 60)}</td><td>${v.d}</td></tr>`).join('')}</table></div>` : '';

  const map = eventsByDay(list);
  const todayKey = toKey(new Date());
  let days = '';
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const key = toKey(d), items = map.get(key) || [];
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    if (weekend && !items.length) continue;
    if (mode === 'range' && !items.length) continue;
    const m = items.reduce((s, e) => s + dur(e), 0);
    days += `<div class="day-block"><div class="day-head${key === todayKey ? ' today' : ''}"><span>${fmtThai(d)}</span><small>${items.length} งาน · ${fmtH(m)}</small></div>` +
      (items.length ? items.map(e => {
        const c = catOf(e.category), st = stOf(e.status), link = safeUrl(e.link);
        return `<div class="task" data-id="${esc(e.id)}" style="--c:${c.color}">
          <div class="t">${esc(e.start)} - ${esc(e.end)}<br><small class="muted">${fmtH(dur(e))}</small></div>
          <div><div class="ttl"><i></i>${esc(e.title)}</div><div class="sub">${esc(c.label)}${e.project ? ' · ' + esc(e.project) : ''}${e.assignee ? ' · ผู้ทำ: ' + esc(e.assignee) : ''}${showOwners ? ' · ผู้บันทึก: ' + esc(e.ownerName || 'งานเดิม') : ''}${link ? ` · <a data-link href="${esc(link)}" target="_blank" rel="noopener noreferrer">ลิงก์</a>` : ''}</div>${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}</div>
          <span class="badge ${esc(e.status)}">${stIcon(e.status)}${esc(st.label)}</span></div>`;
      }).join('') : '<div class="none-row">ไม่มีรายการ</div>') + '</div>';
  }

  const f = state.filter;
  const filterText = [f.category && catOf(f.category).label, f.status && stOf(f.status).label, f.project, f.assignee && 'ผู้ทำ: ' + f.assignee, f.owner !== defaultOwner() && 'ผู้บันทึก: ' + ownerLabel(f.owner)].filter(Boolean).map(esc).join(' · ');
  const nav = mode === 'range'
    ? `<input type="date" class="dinput" data-rfrom value="${esc(state.report.from)}" aria-label="ตั้งแต่วันที่"><span>ถึง</span><input type="date" class="dinput" data-rto value="${esc(state.report.to)}" aria-label="ถึงวันที่">`
    : `<button type="button" class="btn btn-icon" data-rnav="-1" aria-label="ก่อนหน้า">${ic('left')}</button>
        <span class="rp-range">${label}</span>
        <button type="button" class="btn btn-icon" data-rnav="1" aria-label="ถัดไป">${ic('right')}</button>
        <button type="button" class="btn" data-rtoday>${mode === 'month' ? 'เดือนนี้' : 'สัปดาห์นี้'}</button>`;

  host.innerHTML = `
    <div class="rp-bar">
      <h1>รายงานสรุปการทำงาน</h1>
      <div class="rp-controls" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="seg"><button type="button" data-rmode="week" class="${mode === 'week' ? 'on' : ''}">สัปดาห์</button><button type="button" data-rmode="month" class="${mode === 'month' ? 'on' : ''}">เดือน</button><button type="button" data-rmode="range" class="${mode === 'range' ? 'on' : ''}">ช่วงวันที่</button></div>
        ${nav}
        <button type="button" class="btn" data-openfilter>${ic('filter')}ตัวกรอง${filterCount() ? `<b class="fbadge">${filterCount()}</b>` : ''}</button>
        <button type="button" class="btn" data-rprint>${ic('print')}พิมพ์ / PDF</button>
        <button type="button" class="btn" data-rxlsx>${ic('table')}Excel</button>
        <button type="button" class="btn" data-rcsv>${ic('download')}CSV</button>
      </div>
    </div>
    <div class="rp-scroll">
      ${filterCount() ? `<div class="banner">${ic('filter')}<span>กำลังกรอง: ${filterText}</span><button type="button" class="btn sm" data-fclear>ล้างตัวกรอง</button></div>` : ''}
      <div class="stats">
        <div class="stat"><small>จำนวนงาน</small><b>${cur.n}</b>${deltaHtml(cur.n, prev.n)}</div>
        <div class="stat"><small>ชั่วโมงรวม</small><b>${round2(cur.m / 60)}</b>${deltaHtml(cur.m / 60, prev.m / 60)}</div>
        <div class="stat"><small>เสร็จแล้ว</small><b>${cur.done}<em> / ${cur.n}${cur.n ? ` (${Math.round(cur.done / cur.n * 100)}%)` : ''}</em></b>${deltaHtml(cur.done, prev.done)}</div>
        <div class="stat"><small>ติดปัญหา / รอ</small><b>${cur.blocked}</b>${deltaHtml(cur.blocked, prev.blocked, true)}</div>
      </div>
      <div class="rp-grid">
        <div class="panel"><h3>ชั่วโมงตามหมวดงาน</h3>${byCat.length ? byCat.map(x => `<div class="bar-row" style="--c:${x.c.color}"><div class="name"><i></i><span>${esc(x.c.label)}</span></div><div class="track"><i style="width:${x.m / maxCat * 100}%"></i></div><div class="val">${fmtH(x.m)}</div></div>`).join('') : '<div class="muted">ยังไม่มีข้อมูล</div>'}</div>
        <div class="panel"><h3>ตามโปรเจกต์ / ระบบ</h3>${projects.length ? `<table class="pt"><tr><th>โปรเจกต์</th><th>งาน</th><th>ชั่วโมง</th></tr>${projects.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${round2(v.m / 60)}</td></tr>`).join('')}</table>` : '<div class="muted">ยังไม่มีข้อมูล</div>'}</div>
        ${ownerPanel}
        ${hasAsg ? `<div class="panel"><h3>ตามผู้ทำ</h3><table class="pt"><tr><th>ผู้ทำ</th><th>งาน</th><th>ชั่วโมง</th><th>เสร็จ</th></tr>${assignees.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${round2(v.m / 60)}</td><td>${v.d}</td></tr>`).join('')}</table></div>` : ''}
      </div>
      <h3 style="margin:0 0 10px">รายละเอียดรายวัน</h3>
      ${days || '<div class="muted">ไม่มีรายการในช่วงนี้</div>'}
    </div>`;
}

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // กัน formula injection ตอนเปิดใน Excel
  return `"${s.replace(/"/g, '""')}"`;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportCsv() {
  const list = reportEvents();
  if (!list.length) { toast('ไม่มีรายการในช่วงนี้', true); return; }
  const head = ['วันที่', 'วัน', 'เวลาเริ่ม', 'เวลาเสร็จ', 'ชั่วโมง', 'หมวดงาน', 'โปรเจกต์', 'ผู้ทำ', 'หัวข้องาน', 'สถานะ', 'รายละเอียด', 'ลิงก์', 'ผู้บันทึก'];
  const rows = list.map(e => [e.date, DAY_NAMES[fromKey(e.date).getDay()], e.start, e.end, round2(dur(e) / 60), catOf(e.category).label, e.project, e.assignee, e.title, stOf(e.status).label, e.note, e.link, e.ownerName]);
  const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const { from, to } = reportRange();
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `worklog_${toKey(from)}_${toKey(to)}.csv`);
}

function loadScript(src, globalName = 'ExcelJS') {
  return new Promise((resolve, reject) => {
    if (window[globalName]) { resolve(); return; }
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('โหลดไลบรารีไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'));
    document.head.appendChild(el);
  });
}
const utcDate = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

async function buildXlsxBlob(list) {
  await loadScript(EXCELJS_URL);
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'Daily Log';
  const FONT = 'Tahoma';
  const last = list.length + 1;
  const doneLabel = stOf('done').label;
  const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF26272B' } };
  const styleSheet = ws => {
    ws.eachRow(row => row.eachCell(c => { c.font = { name: FONT, size: 10 }; c.alignment = { vertical: 'top', ...(c.alignment || {}) }; }));
    const h = ws.getRow(1);
    h.height = 22;
    h.eachCell(c => { c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEAD_FILL; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  };

  // ชีต 1: รายการทั้งหมด
  const ws = wb.addWorksheet('รายการ', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'วันที่', width: 13 }, { header: 'วัน', width: 12 }, { header: 'เริ่ม', width: 8 }, { header: 'เสร็จ', width: 8 },
    { header: 'ชั่วโมง', width: 10 }, { header: 'หมวดงาน', width: 18 }, { header: 'โปรเจกต์', width: 20 }, { header: 'ผู้ทำ', width: 16 },
    { header: 'หัวข้องาน', width: 44 }, { header: 'สถานะ', width: 14 }, { header: 'รายละเอียด', width: 50 }, { header: 'ลิงก์', width: 32 }, { header: 'ผู้บันทึก', width: 18 },
  ];
  list.forEach((e, i) => {
    const r = i + 2, d = fromKey(e.date);
    const row = ws.addRow([
      utcDate(d), DAY_NAMES[d.getDay()], toMin(e.start) / 1440, toMin(e.end) / 1440,
      { formula: `ROUND((D${r}-C${r})*24,2)`, result: round2(dur(e) / 60) },
      catOf(e.category).label, e.project || '', e.assignee || '', e.title, stOf(e.status).label, e.note || '', e.link || '', e.ownerName || '',
    ]);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(3).numFmt = 'hh:mm';
    row.getCell(4).numFmt = 'hh:mm';
    row.getCell(5).numFmt = '0.00';
    row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(11).alignment = { wrapText: true, vertical: 'top' };
  });
  const tot = ws.addRow(['รวม', '', '', '', { formula: `SUM(E2:E${last})`, result: round2(list.reduce((s, e) => s + dur(e), 0) / 60) }]);
  tot.getCell(5).numFmt = '0.00';
  ws.autoFilter = { from: 'A1', to: `M${last}` };
  styleSheet(ws);
  tot.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, size: 10, bold: true }; });

  const rng = col => `'รายการ'!$${col}$2:$${col}$${last}`;

  // ชีต 2: สรุปรายวัน
  const days = [...new Set(list.map(e => e.date))].sort();
  const ds = wb.addWorksheet('สรุปรายวัน', { views: [{ state: 'frozen', ySplit: 1 }] });
  ds.columns = [{ header: 'วันที่', width: 14 }, { header: 'วัน', width: 12 }, { header: 'จำนวนงาน', width: 12 }, { header: 'ชั่วโมงรวม', width: 13 }, { header: 'เสร็จแล้ว', width: 12 }];
  days.forEach((k, i) => {
    const r = i + 2, d = fromKey(k), items = list.filter(e => e.date === k);
    const row = ds.addRow([
      utcDate(d), DAY_NAMES[d.getDay()],
      { formula: `COUNTIFS(${rng('A')},A${r})`, result: items.length },
      { formula: `SUMIFS(${rng('E')},${rng('A')},A${r})`, result: round2(items.reduce((s, e) => s + dur(e), 0) / 60) },
      { formula: `COUNTIFS(${rng('A')},A${r},${rng('J')},"${doneLabel}")`, result: items.filter(e => e.status === 'done').length },
    ]);
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(4).numFmt = '0.00';
  });
  const dl = days.length + 1;
  const dtot = ds.addRow(['รวม', '',
    { formula: `SUM(C2:C${dl})`, result: list.length },
    { formula: `SUM(D2:D${dl})`, result: round2(list.reduce((s, e) => s + dur(e), 0) / 60) },
    { formula: `SUM(E2:E${dl})`, result: list.filter(e => e.status === 'done').length }]);
  dtot.getCell(4).numFmt = '0.00';
  styleSheet(ds);
  dtot.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, size: 10, bold: true }; });

  // ชีต 3: สรุปตามหมวดงาน
  const cats = CATEGORIES.filter(c => list.some(e => catOf(e.category).id === c.id));
  const cs = wb.addWorksheet('สรุปตามหมวด', { views: [{ state: 'frozen', ySplit: 1 }] });
  cs.columns = [{ header: 'หมวดงาน', width: 22 }, { header: 'จำนวนงาน', width: 12 }, { header: 'ชั่วโมงรวม', width: 13 }];
  cats.forEach((c, i) => {
    const r = i + 2, items = list.filter(e => catOf(e.category).id === c.id);
    const row = cs.addRow([c.label,
      { formula: `COUNTIF(${rng('F')},A${r})`, result: items.length },
      { formula: `SUMIF(${rng('F')},A${r},${rng('E')})`, result: round2(items.reduce((s, e) => s + dur(e), 0) / 60) }]);
    row.getCell(3).numFmt = '0.00';
  });
  const cl = cats.length + 1;
  const ctot = cs.addRow(['รวม', { formula: `SUM(B2:B${cl})`, result: list.length }, { formula: `SUM(C2:C${cl})`, result: round2(list.reduce((s, e) => s + dur(e), 0) / 60) }]);
  ctot.getCell(3).numFmt = '0.00';
  styleSheet(cs);
  ctot.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, size: 10, bold: true }; });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function exportXlsx() {
  const list = reportEvents();
  if (!list.length) { toast('ไม่มีรายการในช่วงนี้', true); return; }
  toast('กำลังสร้างไฟล์ Excel...');
  try {
    const blob = await buildXlsxBlob(list);
    const { from, to } = reportRange();
    download(blob, `worklog_${toKey(from)}_${toKey(to)}.xlsx`);
    toast('ดาวน์โหลดไฟล์ Excel แล้ว');
  } catch (err) {
    console.error(err);
    toast(err.message || 'สร้างไฟล์ Excel ไม่สำเร็จ', true);
  }
}

/* =====================================================================
   ฟอร์มเพิ่ม / แก้ไขงาน
   ===================================================================== */
const dlg = $('#dlg');
let editingId = null;
let overlapAck = '';

function buildFormOptions() {
  $('#fCats').innerHTML = CATEGORIES.map(c => `<label class="chip-opt" style="--c:${c.color}"><input type="radio" name="cat" value="${c.id}"><span><i></i>${esc(c.label)}</span></label>`).join('');
  $('#fStatus').innerHTML = STATUSES.map(s => `<label class="chip-opt"><input type="radio" name="st" value="${s.id}"><span>${stIcon(s.id)}${esc(s.label)}</span></label>`).join('');
}

function openDialog(data, id, ro = false) {
  editingId = id || null;
  $('#dlgTitle').textContent = id ? 'แก้ไขงาน' : 'เพิ่มงาน';
  $('#fTitle').value = data.title || '';
  $('#fDate').value = data.date;
  $('#fStart').value = data.start;
  $('#fEnd').value = data.end;
  $('#fProject').value = data.project || '';
  $('#fNote').value = data.note || '';
  $('#fAssignee').value = data.assignee || '';
  $('#fLink').value = data.link || '';
  $(`input[name=cat][value="${catOf(data.category).id}"]`).checked = true;
  $(`input[name=st][value="${stOf(data.status).id}"]`).checked = true;
  $('#fRepeat').value = 'none';
  $('#fUntil').value = '';
  $('#repeatBox').hidden = !!id;
  $('#tplBox').hidden = !!id;
  overlapAck = '';
  renderTemplates();
  $('#btnDelete').hidden = !id;
  $('#fErr').hidden = true;
  const projects = [...new Set(state.events.map(e => e.project).filter(Boolean))].sort();
  $('#projList').innerHTML = projects.map(p => `<option value="${esc(p)}">`).join('');
  $('#asgList').innerHTML = uniq(state.events.map(e => e.assignee)).map(p => `<option value="${esc(p)}">`).join('');
  setDialogReadonly(ro, data);
  if (!dlg.open) dlg.showModal();
  setTimeout(() => { $('#fTitle').focus(); if (id) $('#fTitle').select(); }, 30);
}

function openNew({ date, start, end, ...rest } = {}) {
  if (!can().log) return;
  const d = date || toKey(new Date());
  let s = start, e = end;
  if (!s) { const n = new Date(); s = minToStr(Math.min(Math.ceil((n.getHours() * 60 + n.getMinutes()) / 30) * 30, 22 * 60)); }
  if (!e) e = minToStr(Math.min(toMin(s) + 60, 24 * 60 - 1));
  openDialog({ date: d, start: s, end: e, category: 'dev', status: 'todo', assignee: (state.me && state.me.name) || '', ...rest }, null);
}
function openEdit(id) {
  const ev = byId(id);
  if (ev) openDialog(ev, ev.id, !canEdit(ev));
}

function setDialogReadonly(ro, data) {
  $$('#evForm input, #evForm textarea, #evForm select').forEach(el => { el.disabled = ro; });
  $('#btnSubmit').hidden = ro;
  $('#btnSaveTpl').hidden = ro;
  if (ro) {
    $('#btnDelete').hidden = true; $('#repeatBox').hidden = true; $('#tplBox').hidden = true;
    $('#dlgTitle').textContent = 'รายละเอียดงาน (ดูอย่างเดียว)';
    showErr(`ผู้บันทึก: ${data.ownerName || 'งานเดิม ยังไม่มีเจ้าของ'}`, true);
  }
}

function showErr(msg, warn = false) { const el = $('#fErr'); el.textContent = msg; el.className = 'err' + (warn ? ' warn' : ''); el.hidden = false; }

function repeatDates(start, mode, untilKey) {
  const out = [], first = fromKey(start), until = fromKey(untilKey);
  for (let d = first; d <= until; d = addDays(d, mode === 'weekly' ? 7 : 1)) {
    if (mode === 'weekdays' && (d.getDay() === 0 || d.getDay() === 6)) continue;
    out.push(toKey(d));
    if (out.length > MAX_REPEAT) break;
  }
  return out;
}

function onSubmit(e) {
  e.preventDefault();
  const data = {
    title: $('#fTitle').value.trim(),
    date: $('#fDate').value,
    start: $('#fStart').value,
    end: $('#fEnd').value,
    category: ($('input[name=cat]:checked') || {}).value || 'other',
    status: ($('input[name=st]:checked') || {}).value || 'todo',
    project: $('#fProject').value.trim(),
    note: $('#fNote').value.trim(),
    assignee: $('#fAssignee').value.trim(),
    link: $('#fLink').value.trim(),
  };
  if (!data.title) return showErr('กรุณาใส่หัวข้องาน');
  if (!data.date) return showErr('กรุณาเลือกวันที่');
  if (!data.start || !data.end) return showErr('กรุณาใส่เวลาเริ่มและเวลาเสร็จ');
  if (toMin(data.end) <= toMin(data.start)) return showErr('เวลาเสร็จต้องอยู่หลังเวลาเริ่ม');
  if (data.link) {
    if (!/^https?:\/\//i.test(data.link)) data.link = 'https://' + data.link;
    try { new URL(data.link); } catch { return showErr('ลิงก์ไม่ถูกต้อง'); }
  }

  const mode = $('#fRepeat').value;
  if (editingId || mode === 'none') {
    const clash = findOverlaps(data, editingId);
    const sig = JSON.stringify([data, editingId]);
    if (clash.length && overlapAck !== sig) {
      overlapAck = sig;
      return showErr(`เวลาซ้อนกับ "${clash[0].title}" (${clash[0].start}-${clash[0].end})${clash.length > 1 ? ` และอีก ${clash.length - 1} งาน` : ''} กดบันทึกอีกครั้งเพื่อยืนยัน`, true);
    }
  }
  let job;
  if (editingId) {
    job = store.save({ id: editingId, ...data });
  } else if (mode !== 'none') {
    const until = $('#fUntil').value;
    if (!until) return showErr('กรุณาเลือกวันที่สิ้นสุดของการทำซ้ำ');
    if (until < data.date) return showErr('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');
    const dates = repeatDates(data.date, mode, until);
    if (dates.length > MAX_REPEAT) return showErr(`ทำซ้ำได้ไม่เกิน ${MAX_REPEAT} รายการต่อครั้ง`);
    job = store.saveMany(dates.map(d => ({ ...data, date: d })));
  } else {
    job = store.save(data);
  }
  Promise.resolve(job).then(() => toast('บันทึกแล้ว')).catch(err => { console.error(err); toast('บันทึกไม่สำเร็จ: ' + (err.code || err.message), true); });
  setPref('dl.assignee', data.assignee);
  state.anchor = fromKey(data.date);
  dlg.close();
  if (state.page === 'calendar') renderCalendar();
}

function removeEvent(id) {
  const ev = byId(id);
  if (!ev) return;
  if (dlg.open) dlg.close();
  Promise.resolve(store.remove(id))
    .then(() => toast('ลบแล้ว', false, {
      label: 'เลิกทำ',
      fn: () => Promise.resolve(store.save(ev)).catch(err => failToast('เลิกทำ', err)),
    }))
    .catch(err => failToast('ลบ', err));
}

/* =====================================================================
   เมนู ⋮
   ===================================================================== */
const ctx = $('#ctx');
function openMenu(btn, id) {
  const ev = byId(id);
  if (!ev) return;
  ctx.dataset.id = id;
  ctx.classList.remove('ms-menu');
  ctx.innerHTML = !canEdit(ev) ? `<button type="button" data-act="edit">${ic('edit')}ดูรายละเอียด</button>` : `
    <button type="button" data-act="edit">${ic('edit')}แก้ไข</button>
    <button type="button" data-act="done">${ic('check')}${ev.status === 'done' ? 'ยกเลิกเสร็จแล้ว' : 'ทำเครื่องหมายเสร็จ'}</button>
    <button type="button" data-act="dup">${ic('copy')}ทำสำเนา</button>
    <button type="button" data-act="del" class="danger">${ic('trash')}ลบ</button>`;
  ctx.hidden = false;
  const r = btn.getBoundingClientRect(), w = ctx.offsetWidth, h = ctx.offsetHeight;
  ctx.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
  ctx.style.top = `${r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
}
ctx.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act.startsWith('ms-')) { handleMsAct(b.dataset.act, ctx.dataset.ms); ctx.hidden = true; return; }
  const id = ctx.dataset.id, ev = byId(id);
  ctx.hidden = true;
  if (!ev) return;
  if (b.dataset.act !== 'edit' && !canEdit(ev)) return;
  if (b.dataset.act === 'edit') openEdit(id);
  if (b.dataset.act === 'del') removeEvent(id);
  if (b.dataset.act === 'dup') openNew({ ...ev, id: undefined });
  if (b.dataset.act === 'done') Promise.resolve(store.save({ ...ev, status: ev.status === 'done' ? 'todo' : 'done' })).catch(err => toast('บันทึกไม่สำเร็จ: ' + (err.code || err.message), true));
});
document.addEventListener('click', e => { if (!e.target.closest('#ctx') && !e.target.closest('[data-menu]')) ctx.hidden = true; });
$('#calview').addEventListener('scroll', () => { ctx.hidden = true; }, { passive: true });

/* =====================================================================
   การทำงานของปุ่มและเหตุการณ์
   ===================================================================== */
function shift(dir) {
  const a = state.anchor;
  if (state.view === 'm') state.anchor = new Date(a.getFullYear(), a.getMonth() + dir, 1);
  else state.anchor = addDays(a, dir * (state.view === 'd' ? 1 : 7));
  renderCalendar();
}

function setPage(page) {
  state.page = page;
  $('#calendarPage').hidden = page !== 'calendar';
  $('#reportPage').hidden = page !== 'report';
  $('#pendingPage').hidden = page !== 'pending';
  $('#settingsPage').hidden = page !== 'settings';
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (page === 'report') renderReport(); else if (page === 'pending') renderPending(); else if (page === 'settings') renderSettings(); else renderCalendar();
}

function bind() {
  $('#btnToday').onclick = () => { state.anchor = new Date(); state.scrollInit = true; renderCalendar(); };
  $('#btnPrev').onclick = () => shift(-1);
  $('#btnNext').onclick = () => shift(1);
  $('#btnAdd').onclick = () => openNew({ date: toKey(state.view === 'm' ? new Date() : (viewDays().some(d => toKey(d) === toKey(new Date())) ? new Date() : viewDays()[0])) });
  $('#segView').onclick = e => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    state.view = b.dataset.view; setPref('dl.view', state.view); state.scrollInit = true; renderCalendar();
  };
  $('#btnGoto').onclick = () => {
    const i = $('#gotoDate'); i.value = toKey(state.anchor);
    try { i.showPicker(); } catch { i.click(); }
  };
  $('#gotoDate').onchange = e => { if (e.target.value) { state.anchor = fromKey(e.target.value); renderCalendar(); } };
  $('#btnFull').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => toast('เบราว์เซอร์นี้ไม่รองรับโหมดเต็มจอ', true));
  };
  $$('.nav button').forEach(b => { b.onclick = () => setPage(b.dataset.page); });
  $('#upcoming').onclick = () => { const id = $('#upcoming').dataset.id; if (id) openEdit(id); };

  const q = $('#q');
  q.addEventListener('input', () => { state.query = q.value; if (state.page === 'calendar') renderCalendar(); });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !dlg.open) { e.preventDefault(); q.focus(); }
    if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; state.query = ''; q.blur(); renderCalendar(); }
  });

  $('#calview').addEventListener('click', e => {
    if (e.target.closest('[data-link]')) return;
    const msEl = e.target.closest('[data-ms]');
    if (msEl) { e.stopPropagation(); openMsMenu(e, msEl.dataset.ms); return; }
    const m = e.target.closest('[data-menu]');
    if (m) { e.stopPropagation(); openMenu(m, m.closest('[data-id]').dataset.id); return; }
    const day = e.target.closest('[data-goday]');
    if (day) { state.anchor = fromKey(day.dataset.goday); state.view = 'd'; setPref('dl.view', 'd'); state.scrollInit = true; renderCalendar(); return; }
    const ev = e.target.closest('[data-id]');
    if (ev) { openEdit(ev.dataset.id); return; }
    const col = e.target.closest('.tg-col');
    if (col) {
      const y = e.clientY - col.getBoundingClientRect().top;
      const start = Math.min(Math.floor(y / HOUR_H * 2) * 30, 23 * 60);
      openNew({ date: col.dataset.date, start: minToStr(start), end: minToStr(Math.min(start + 60, 24 * 60 - 1)) });
      return;
    }
    const cell = e.target.closest('.mcell');
    if (cell) openNew({ date: cell.dataset.date, start: '09:00', end: '10:00' });
  });

  $('#reportPage').addEventListener('click', e => {
    if (e.target.closest('[data-link]')) return;
    const t = e.target.closest('[data-id]');
    if (t) { openEdit(t.dataset.id); return; }
    const mode = e.target.closest('[data-rmode]');
    if (mode) {
      const nm = mode.dataset.rmode;
      if (nm === 'range' && state.report.mode !== 'range') { const r = reportRange(); state.report.from = toKey(r.from); state.report.to = toKey(r.to); }
      state.report.mode = nm; renderReport(); return;
    }
    const nav = e.target.closest('[data-rnav]');
    if (nav) {
      const a = state.report.anchor, n = Number(nav.dataset.rnav);
      state.report.anchor = state.report.mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + n, 1) : addDays(a, 7 * n);
      renderReport(); return;
    }
    if (e.target.closest('[data-rtoday]')) { state.report.anchor = new Date(); renderReport(); return; }
    if (e.target.closest('[data-rprint]')) { window.print(); return; }
    if (e.target.closest('[data-rcsv]')) exportCsv();
  });

  $('#evForm').addEventListener('submit', onSubmit);
  $$('[data-close]').forEach(b => { b.onclick = () => dlg.close(); });
  $('#btnDelete').onclick = () => { if (editingId) removeEvent(editingId); };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  $('#fStart').addEventListener('change', () => {
    const s = toMin($('#fStart').value);
    if ($('#fStart').value && toMin($('#fEnd').value) <= s) $('#fEnd').value = minToStr(Math.min(s + 60, 24 * 60 - 1));
  });
  $('#fRepeat').addEventListener('change', () => {
    const mode = $('#fRepeat').value, d = $('#fDate').value;
    if (mode !== 'none' && d && !$('#fUntil').value) $('#fUntil').value = toKey(addDays(fromKey(d), mode === 'weekly' ? 56 : 27));
  });
}

/* =====================================================================
   เทมเพลต / เตือนเวลาซ้อน / เลิกทำ
   ===================================================================== */
function userTemplates() {
  try { const a = JSON.parse(pref('dl.templates', '[]')); return Array.isArray(a) ? a.slice(0, 30) : []; } catch { return []; }
}
const allTemplates = () => [...DEFAULT_TEMPLATES.map(t => ({ ...t, builtin: true })), ...userTemplates()];

function renderTemplates() {
  $('#tplList').innerHTML = allTemplates().map((t, i) =>
    `<span class="tpl"><button type="button" data-tpl="${i}">${esc(t.name)}</button>${t.builtin ? '' : `<button type="button" class="x" data-tpldel="${i - DEFAULT_TEMPLATES.length}" aria-label="ลบเทมเพลต">×</button>`}</span>`).join('');
}
function applyTemplate(i) {
  const t = allTemplates()[i];
  if (!t) return;
  $('#fTitle').value = t.title || '';
  const cat = $(`input[name=cat][value="${catOf(t.category).id}"]`);
  if (cat) cat.checked = true;
  if (t.project) $('#fProject').value = t.project;
  if (t.assignee) $('#fAssignee').value = t.assignee;
  if (t.note) $('#fNote').value = t.note;
  if (t.link) $('#fLink').value = t.link;
  const s = toMin($('#fStart').value || '09:00');
  $('#fEnd').value = minToStr(Math.min(s + Math.max(Number(t.minutes) || 60, SNAP), 24 * 60 - 1));
  $('#fTitle').focus();
}
function saveTemplate() {
  const title = $('#fTitle').value.trim();
  if (!title) { showErr('ใส่หัวข้องานก่อน แล้วค่อยเก็บเป็นเทมเพลต'); return; }
  const minutes = Math.max(toMin($('#fEnd').value) - toMin($('#fStart').value), SNAP);
  const list = userTemplates();
  list.push({
    name: title.slice(0, 30), title,
    category: ($('input[name=cat]:checked') || {}).value || 'other',
    project: $('#fProject').value.trim(), assignee: $('#fAssignee').value.trim(),
    note: $('#fNote').value.trim(), link: $('#fLink').value.trim(), minutes,
  });
  setPref('dl.templates', JSON.stringify(list.slice(-30)));
  renderTemplates();
  const b = $('#btnSaveTpl'), old = b.textContent;
  b.textContent = 'เก็บแล้ว'; setTimeout(() => { b.textContent = old; }, 1500);
}

function findOverlaps(d, ignoreId) {
  const s = toMin(d.start), e = toMin(d.end);
  return state.events.filter(x => isMine(x) && x.id !== ignoreId && x.date === d.date && (x.assignee || '') === (d.assignee || '') && toMin(x.start) < e && toMin(x.end) > s);
}

const failToast = (what, err) => { console.error(err); toast(`${what}ไม่สำเร็จ: ${err.code || err.message}`, true); };

function commitChange(before, after, msg) {
  const clash = findOverlaps(after, before.id).length;
  Promise.resolve(store.save(after))
    .then(() => toast(clash ? `${msg} (เวลาซ้อนกับงานอื่น)` : msg, false, {
      label: 'เลิกทำ',
      fn: () => Promise.resolve(store.save(before)).catch(err => failToast('เลิกทำ', err)),
    }))
    .catch(err => failToast('บันทึก', err));
}

/* =====================================================================
   ลากย้าย / ยืดการ์ด / ลากคลุมเพื่อสร้างงาน
   ===================================================================== */
let suppressClick = false;

function colAt(x) {
  let best = null, bd = Infinity;
  $$('.tg-col').forEach(c => {
    const r = c.getBoundingClientRect();
    const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (d < bd) { bd = d; best = c; }
  });
  return best;
}

function track(e, h) {
  const host = $('#calview');
  const x0 = e.clientX, y0 = e.clientY, threshold = h.threshold || 5;
  let started = false, lastX = x0, lastY = y0, timer = 0;

  const autoscroll = () => {
    const r = host.getBoundingClientRect();
    const headH = (host.querySelector('.tg-head') || { offsetHeight: 0 }).offsetHeight;
    const top = r.top + headH + 16;
    let dy = 0, dx = 0;
    // เลื่อนเฉพาะเมื่อผู้ใช้ลากไปทางขอบนั้นจริง ไม่เลื่อนเองตอนเพิ่งเริ่มจับการ์ดใกล้ขอบ
    if (lastY > r.bottom - 44 && lastY > y0 + 4) dy = Math.min(22, (lastY - (r.bottom - 44)) / 2 + 4);
    else if (lastY < top && lastY < y0 - 4) dy = -Math.min(22, (top - lastY) / 2 + 4);
    if (lastX > r.right - 44 && lastX > x0 + 4) dx = Math.min(22, (lastX - (r.right - 44)) / 2 + 4);
    else if (lastX < r.left + 100 && lastX < x0 - 4) dx = -Math.min(22, ((r.left + 100) - lastX) / 2 + 4);
    if (dx || dy) { host.scrollTop += dy; host.scrollLeft += dx; h.onMove(lastX, lastY); }
  };
  const onMove = ev => {
    lastX = ev.clientX; lastY = ev.clientY;
    if (!started) {
      if (Math.hypot(lastX - x0, lastY - y0) < threshold) return;
      started = true; state.dragging = true;
      document.body.classList.add('dragging');
      ctx.hidden = true;
      if (h.onStart) h.onStart();
      timer = setInterval(autoscroll, 30);
    }
    ev.preventDefault();
    h.onMove(lastX, lastY);
  };
  const finish = cancelled => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('keydown', onKey, true);
    clearInterval(timer);
    if (!started) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 80);
    try { h.onEnd(lastX, lastY, cancelled); } finally {
      state.dragging = false;
      document.body.classList.remove('dragging');
      if (state.pendingRender) { state.pendingRender = false; rerender(); }
    }
  };
  const onUp = () => finish(false);
  const onCancel = () => finish(true);
  const onKey = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); finish(true); } };
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey, true);
}

function startMove(e, el) {
  const ev = byId(el.dataset.id);
  if (!ev || !canEdit(ev)) return;
  const col0 = el.closest('.tg-col');
  const s0 = toMin(ev.start), len = Math.max(toMin(ev.end) - s0, SNAP);
  const grab = (e.clientY - col0.getBoundingClientRect().top) / HOUR_H * 60 - s0;
  const timeEl = el.querySelector('.ev-time span');
  const label0 = timeEl ? timeEl.textContent : '';
  let target = { date: ev.date, start: s0 };
  track(e, {
    onStart: () => el.classList.add('dragging'),
    onMove: (x, y) => {
      const col = colAt(x);
      if (!col) return;
      const r = col.getBoundingClientRect(), r0 = col0.getBoundingClientRect();
      const s = Math.max(0, Math.min(snap((y - r.top) / HOUR_H * 60 - grab), 24 * 60 - 1 - len));
      target = { date: col.dataset.date, start: s };
      el.style.transform = `translate(${r.left - r0.left}px, ${(s - s0) / 60 * HOUR_H}px)`;
      if (timeEl) timeEl.textContent = `${minToStr(s)} → ${minToStr(s + len)}`;
    },
    onEnd: (x, y, cancelled) => {
      el.classList.remove('dragging');
      el.style.transform = '';
      if (timeEl) timeEl.textContent = label0;
      if (cancelled || (target.date === ev.date && target.start === s0)) return;
      commitChange(ev, { ...ev, date: target.date, start: minToStr(target.start), end: minToStr(target.start + len) }, 'ย้ายงานแล้ว');
    },
  });
}

function startResize(e, el) {
  const ev = byId(el.dataset.id);
  if (!ev || !canEdit(ev)) return;
  const col = el.closest('.tg-col');
  const s0 = toMin(ev.start), end0 = toMin(ev.end);
  const timeEl = el.querySelector('.ev-time span');
  const label0 = timeEl ? timeEl.textContent : '';
  const h0 = el.style.height;
  let end = end0;
  track(e, {
    threshold: 3,
    onStart: () => el.classList.add('dragging'),
    onMove: (x, y) => {
      const r = col.getBoundingClientRect();
      end = Math.max(s0 + SNAP, Math.min(snap((y - r.top) / HOUR_H * 60), 24 * 60 - 1));
      el.style.height = `${Math.max((end - s0) / 60 * HOUR_H - 3, 22)}px`;
      if (timeEl) timeEl.textContent = `${ev.start} → ${minToStr(end)}`;
    },
    onEnd: (x, y, cancelled) => {
      el.classList.remove('dragging');
      el.style.height = h0;
      if (timeEl) timeEl.textContent = label0;
      if (cancelled || end === end0) return;
      commitChange(ev, { ...ev, end: minToStr(end) }, 'ปรับเวลาแล้ว');
    },
  });
}

function startSelect(e, col) {
  if (!can().log) return;
  const r0 = col.getBoundingClientRect();
  const a = Math.max(0, Math.min((e.clientY - r0.top) / HOUR_H * 60, 24 * 60 - 1));
  let ghost, s = 0, en = 0;
  track(e, {
    onStart: () => { ghost = document.createElement('div'); ghost.className = 'sel-ghost'; col.appendChild(ghost); },
    onMove: (x, y) => {
      const r = col.getBoundingClientRect();
      const b = Math.max(0, Math.min((y - r.top) / HOUR_H * 60, 24 * 60 - 1));
      s = Math.floor(Math.min(a, b) / SNAP) * SNAP;
      en = Math.min(Math.max(Math.ceil(Math.max(a, b) / SNAP) * SNAP, s + SNAP), 24 * 60 - 1);
      ghost.style.top = `${s / 60 * HOUR_H}px`;
      ghost.style.height = `${(en - s) / 60 * HOUR_H}px`;
      ghost.textContent = `${minToStr(s)} → ${minToStr(en)}`;
    },
    onEnd: (x, y, cancelled) => {
      if (ghost) ghost.remove();
      if (!cancelled) openNew({ date: col.dataset.date, start: minToStr(s), end: minToStr(en) });
    },
  });
}

function startChipDrag(e, chip) {
  const ev = byId(chip.dataset.id);
  if (!ev || !canEdit(ev)) return;
  let ghost, cell = null;
  const clearDrop = () => $$('.mcell.drop').forEach(n => n.classList.remove('drop'));
  track(e, {
    onStart: () => {
      ghost = chip.cloneNode(true);
      ghost.classList.add('ghost-chip');
      document.body.appendChild(ghost);
      chip.classList.add('dragging');
    },
    onMove: (x, y) => {
      ghost.style.left = `${x + 12}px`; ghost.style.top = `${y + 8}px`;
      clearDrop();
      cell = document.elementFromPoint(x, y)?.closest('.mcell') || null;
      if (cell) cell.classList.add('drop');
    },
    onEnd: (x, y, cancelled) => {
      ghost.remove(); chip.classList.remove('dragging'); clearDrop();
      if (cancelled || !cell || cell.dataset.date === ev.date) return;
      commitChange(ev, { ...ev, date: cell.dataset.date }, 'ย้ายงานแล้ว');
    },
  });
}

function onPointerDown(e) {
  if (e.button !== 0 || state.page !== 'calendar') return;
  if (e.target.closest('[data-menu],[data-link]')) return;
  const mouse = e.pointerType === 'mouse' || e.pointerType === 'pen';
  if (state.view === 'm') {
    const chip = e.target.closest('.chip');
    if (chip && mouse) startChipDrag(e, chip);
    return;
  }
  if (e.target.closest('[data-ms]')) return;
  const evEl = e.target.closest('.ev');
  if (evEl) {
    if (e.target.closest('[data-resize]')) startResize(e, evEl);
    else if (mouse) startMove(e, evEl);
    return;
  }
  const col = e.target.closest('.tg-col');
  if (col && mouse) startSelect(e, col);
}

function initDrag() {
  const host = $('#calview');
  // ดักคลิกที่เกิดหลังลากเสร็จ ไม่ให้เปิดฟอร์มแก้ไข
  host.addEventListener('click', e => { if (suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); suppressClick = false; } }, true);
  host.addEventListener('pointerdown', onPointerDown);
}

/* =====================================================================
   ตัวกรอง
   ===================================================================== */
const dlgFilter = $('#dlgFilter');
function fillFilter() {
  const f = state.filter;
  const put = (id, cur, items) => {
    const el = $(id);
    el.innerHTML = [['', 'ทั้งหมด'], ...items].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    el.value = cur;
  };
  put('#flCat', f.category, CATEGORIES.map(c => [c.id, c.label]));
  put('#flStatus', f.status, STATUSES.map(s => [s.id, s.label]));
  put('#flProject', f.project, uniq(state.events.map(e => e.project)).map(p => [p, p]));
  put('#flAssignee', f.assignee, uniq(state.events.map(e => e.assignee)).map(p => [p, p]));
  $('#flOwnerWrap').hidden = !can().all;
  const el = $('#flOwner');
  el.innerHTML = [['', 'ทุกคน'], ...ownerOptions()].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  el.value = f.owner;
}
function openFilter() { fillFilter(); if (!dlgFilter.open) dlgFilter.showModal(); }
function readFilter() {
  state.filter = { category: $('#flCat').value, status: $('#flStatus').value, project: $('#flProject').value, assignee: $('#flAssignee').value, owner: can().all ? $('#flOwner').value : '' };
  rerender();
}
function clearFilter() {
  state.filter = { category: '', status: '', project: '', assignee: '', owner: defaultOwner() };
  if (dlgFilter.open) fillFilter();
  rerender();
}

/* =====================================================================
   งานค้าง
   ===================================================================== */
function renderPending() {
  const host = $('#pendingPage');
  const todayKey = toKey(new Date());
  const list = state.events.filter(isPending).sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start));
  const rows = list.map(e => {
    const c = catOf(e.category), st = stOf(e.status), d = fromKey(e.date);
    const late = Math.round((fromKey(todayKey) - d) / 86400000);
    return `<div class="task pend" data-id="${esc(e.id)}" style="--c:${c.color}">
      <div class="t">${fmtThai(d)}<br><small class="muted">ค้างมา ${late} วัน</small></div>
      <div><div class="ttl"><i></i>${esc(e.title)}</div><div class="sub">${esc(e.start)} - ${esc(e.end)} · ${esc(c.label)}${e.project ? ' · ' + esc(e.project) : ''}${e.assignee ? ' · ผู้ทำ: ' + esc(e.assignee) : ''}${!isMine(e) ? ' · ผู้บันทึก: ' + esc(e.ownerName || '-') : ''}</div></div>
      <div class="pact"><span class="badge ${esc(e.status)}">${stIcon(e.status)}${esc(st.label)}</span>
        ${canEdit(e) ? `<button type="button" class="btn sm" data-pact="today">เลื่อนมาวันนี้</button>
        <button type="button" class="btn sm" data-pact="done">${ic('check')}เสร็จแล้ว</button>` : ''}</div>
    </div>`;
  }).join('');
  host.innerHTML = `
    <div class="rp-bar">
      <h1>งานค้าง</h1>
      <span class="muted">งานของวันก่อนหน้าที่ยังไม่ได้ทำเครื่องหมายว่าเสร็จ</span>
      <span class="grow"></span>
      ${list.some(canEdit) ? `<button type="button" class="btn" data-pall>เลื่อนทั้งหมด (${list.filter(canEdit).length}) มาวันนี้</button>` : ''}
    </div>
    <div class="rp-scroll">${list.length ? `<div class="day-block">${rows}</div>` : '<div class="empty-card">ไม่มีงานค้าง ทุกงานก่อนหน้านี้เสร็จเรียบร้อย</div>'}</div>`;
}

function moveToToday(list) {
  list = list.filter(canEdit);
  if (!list.length) return;
  const today = toKey(new Date());
  Promise.all(list.map(e => store.save({ ...e, date: today })))
    .then(() => toast(`เลื่อน ${list.length} งานมาวันนี้แล้ว`, false, {
      label: 'เลิกทำ',
      fn: () => Promise.all(list.map(e => store.save(e))).catch(err => failToast('เลิกทำ', err)),
    }))
    .catch(err => failToast('เลื่อนงาน', err));
}

/* =====================================================================
   สำรอง / นำเข้า / โหมดมืด
   ===================================================================== */
function exportBackup() {
  const events = state.events.map(e => ({ id: e.id, ...Object.fromEntries(FIELDS.map(k => [k, e[k] ?? ''])) }));
  const data = { app: 'daily-log', version: 2, exportedAt: new Date().toISOString(), count: events.length, events };
  download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `dailylog_backup_${toKey(new Date())}.json`);
  toast(`สำรองข้อมูล ${events.length} รายการแล้ว`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
function cleanImported(r) {
  if (!r || typeof r !== 'object') return null;
  const str = (v, n) => (v == null ? '' : String(v)).slice(0, n);
  const ev = {
    title: str(r.title, 200).trim(), date: str(r.date, 10), start: str(r.start, 5), end: str(r.end, 5),
    category: str(r.category, 40) || 'other',
    status: STATUSES.some(s => s.id === r.status) ? r.status : 'todo',
    project: str(r.project, 100).trim(), note: str(r.note, 5000),
    assignee: str(r.assignee, 100).trim(), link: safeUrl(str(r.link, 500)),
  };
  if (!ev.title || !DATE_RE.test(ev.date) || !TIME_RE.test(ev.start) || !TIME_RE.test(ev.end)) return null;
  if (toMin(ev.end) <= toMin(ev.start)) return null;
  return ev;
}
async function importBackup(file) {
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกินไป');
    const data = JSON.parse(await file.text());
    const rows = Array.isArray(data) ? data : data && data.events;
    if (!Array.isArray(rows)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
    const keyOf = e => [e.date, e.start, e.end, e.title, e.assignee || ''].join('|');
    const have = new Set(state.events.map(keyOf));
    const fresh = [];
    let bad = 0, dup = 0;
    for (const r of rows.slice(0, 5000)) {
      const ev = cleanImported(r);
      if (!ev) { bad++; continue; }
      const k = keyOf(ev);
      if (have.has(k)) { dup++; continue; }
      have.add(k); fresh.push(ev);
    }
    if (!fresh.length) { toast(`ไม่มีรายการใหม่ให้นำเข้า (ซ้ำ ${dup}, ข้อมูลไม่ครบ ${bad})`, true); return; }
    if (!confirm(`นำเข้า ${fresh.length} รายการใหม่?\nข้ามรายการที่มีอยู่แล้ว ${dup} และที่ข้อมูลไม่ครบ ${bad}\nข้อมูลเดิมจะไม่ถูกแก้ไขหรือลบ`)) return;
    await store.saveMany(fresh);
    toast(`นำเข้า ${fresh.length} รายการแล้ว`);
  } catch (err) {
    console.error(err);
    toast('นำเข้าไม่สำเร็จ: ' + (err.message || err.code), true);
  }
}

const themeNow = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
function paintTheme() {
  const dark = themeNow() === 'dark';
  $('#btnTheme').innerHTML = `${ic(dark ? 'sun' : 'moon')}<span class="btn-label">${dark ? 'สว่าง' : 'มืด'}</span>`;
}
function toggleTheme() {
  const next = themeNow() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  setPref('dl.theme', next);
  paintTheme();
}

function bindExtras() {
  // ตัวกรอง
  $('#btnFilter').onclick = openFilter;
  ['#flCat', '#flStatus', '#flProject', '#flAssignee', '#flOwner'].forEach(id => { $(id).onchange = readFilter; });
  $('#flClear').onclick = clearFilter;
  $('#flDone').onclick = () => dlgFilter.close();
  $('#flClose').onclick = () => dlgFilter.close();
  dlgFilter.addEventListener('click', e => { if (e.target === dlgFilter) dlgFilter.close(); });

  // รายงาน: ช่วงวันที่ / ตัวกรอง / Excel
  const rp = $('#reportPage');
  rp.addEventListener('click', e => {
    if (e.target.closest('[data-openfilter]')) openFilter();
    else if (e.target.closest('[data-fclear]')) clearFilter();
    else if (e.target.closest('[data-rxlsx]')) exportXlsx();
  });
  rp.addEventListener('change', e => {
    if (e.target.matches('[data-rfrom]') && e.target.value) state.report.from = e.target.value;
    else if (e.target.matches('[data-rto]') && e.target.value) state.report.to = e.target.value;
    else return;
    renderReport();
  });

  // งานค้าง
  $('#pendingPage').addEventListener('click', e => {
    if (e.target.closest('[data-pall]')) { moveToToday(state.events.filter(isPending)); return; }
    const row = e.target.closest('.task[data-id]');
    if (!row) return;
    const ev = byId(row.dataset.id);
    if (!ev) return;
    const act = e.target.closest('[data-pact]');
    if (!act) { openEdit(ev.id); return; }
    if (act.dataset.pact === 'today') moveToToday([ev]);
    if (act.dataset.pact === 'done') {
      Promise.resolve(store.save({ ...ev, status: 'done' }))
        .then(() => toast('ทำเครื่องหมายเสร็จแล้ว', false, { label: 'เลิกทำ', fn: () => Promise.resolve(store.save(ev)).catch(err => failToast('เลิกทำ', err)) }))
        .catch(err => failToast('บันทึก', err));
    }
  });

  // เทมเพลต
  $('#tplList').addEventListener('click', e => {
    const b = e.target.closest('[data-tpl]');
    if (b) { applyTemplate(Number(b.dataset.tpl)); return; }
    const d = e.target.closest('[data-tpldel]');
    if (d) {
      const list = userTemplates();
      list.splice(Number(d.dataset.tpldel), 1);
      setPref('dl.templates', JSON.stringify(list));
      renderTemplates();
    }
  });
  $('#btnSaveTpl').onclick = saveTemplate;

  // สำรอง / นำเข้า / ธีม
  $('#btnBackup').onclick = exportBackup;
  $('#btnImport').onclick = () => { $('#importFile').value = ''; $('#importFile').click(); };
  $('#importFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); };
  $('#btnTheme').onclick = toggleTheme;
  paintTheme();
}

/* =====================================================================
   ช่องใส่รหัส 6 หลัก (OTP)
   ===================================================================== */
function buildOtp(el) {
  el.classList.add('otp');
  el.innerHTML = Array.from({ length: 6 }, (_, i) =>
    `<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" aria-label="หลักที่ ${i + 1}">${i === 2 ? '<span class="dash">-</span>' : ''}`).join('');
  const ins = $$('input', el);
  ins.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value && ins[i + 1]) ins[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && ins[i - 1]) { ins[i - 1].value = ''; ins[i - 1].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && ins[i - 1]) { ins[i - 1].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && ins[i + 1]) { ins[i + 1].focus(); e.preventDefault(); }
    });
    inp.addEventListener('paste', e => {
      const t = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, '').slice(0, 6);
      if (!t) return;
      e.preventDefault();
      [...t].forEach((c, k) => { ins[k].value = c; });
      ins[Math.min(t.length, 5)].focus();
    });
    inp.addEventListener('focus', () => inp.select());
  });
}
const otpValue = el => $$('input', el).map(i => i.value).join('');
const otpClear = el => { $$('input', el).forEach(i => { i.value = ''; }); const f = $('input', el); if (f) f.focus(); };

/* =====================================================================
   สิทธิ์การใช้งาน / ผู้ใช้ปัจจุบัน
   ===================================================================== */
const ROLES = { user: 'User', admin: 'Admin', overview: 'Overview (ผู้บริหาร)' };
const can = () => {
  const r = state.me ? state.me.role : '';
  return { log: r === 'user' || r === 'admin', admin: r === 'admin', all: r === 'admin' || r === 'overview' };
};
const isMine = e => !!state.me && (!!state.me.local || e.ownerId === state.me.username);
const canEdit = e => can().log && isMine(e);
const inScope = e => !!state.me && (state.me.role === 'overview' || isMine(e));
const myEvents = () => state.events.filter(inScope);
const defaultOwner = () => (state.me && state.me.role === 'admin' && !state.me.local ? state.me.username : '');
const ownerOptions = () => {
  const m = new Map();
  state.events.forEach(e => { if (e.ownerId) m.set(e.ownerId, e.ownerName || e.ownerId); });
  state.users.forEach(u => m.set(u.username, u.name));
  if (state.me && !state.me.local) m.set(state.me.username, state.me.name);
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'th'));
};
const ownerLabel = id => (id ? (ownerOptions().find(([k]) => k === id) || [id, id])[1] : 'ทุกคน');

function paintMe() {
  const me = state.me;
  $('#meAvatar').textContent = (me.name || '?').trim().charAt(0).toUpperCase();
  $('#meName').textContent = me.name;
  const r = $('#meRole');
  r.textContent = ROLES[me.role] || me.role;
  r.className = `rolepill ${me.role}`;
}

/* ---------- งานเดิมที่ยังไม่มีเจ้าของ (ลงไว้ก่อนมีระบบล็อกอิน) ---------- */
const legacyEvents = () => (can().admin && state.me && !state.me.local ? state.events.filter(e => !e.ownerId) : []);
function renderLegacy() {
  const el = $('#legacyBanner');
  const list = legacyEvents();
  el.hidden = !list.length;
  if (list.length) {
    el.innerHTML = `<span>พบงานเดิม ${list.length} รายการที่ลงไว้ก่อนมีระบบล็อกอิน ตอนนี้ยังไม่มีเจ้าของ</span><button type="button" class="btn sm btn-dark" data-claim>โอนให้ฉัน (${esc(state.me.name)})</button>`;
  }
}
function claimLegacy() {
  const list = legacyEvents();
  if (!list.length) return;
  Promise.resolve(store.claim(list))
    .then(() => toast(`โอนงานเดิม ${list.length} รายการให้คุณแล้ว`))
    .catch(err => failToast('โอนงาน', err));
}

/* =====================================================================
   หน้า Login / ติดตั้งครั้งแรก
   ===================================================================== */
let B = null;            // backend ของ Firebase (null = โหมดทดลองในเครื่อง)
let settingUp = false;   // ระหว่างติดตั้งครั้งแรก ไม่ให้ตัวตรวจสถานะล็อกอินแทรกกลางคัน
let authNotice = '';     // ข้อความที่จะแสดงหลังออกจากระบบ
const otpLogin = $('#otpLogin'), otpSetupAdmin = $('#otpSetupAdmin'), otpSetupAdmin2 = $('#otpSetupAdmin2'), otpSetupOv = $('#otpSetupOv');
const otpCur = $('#otpCur'), otpNew = $('#otpNew'), otpNew2 = $('#otpNew2');

function setErr(id, msg) { const el = $(id); el.textContent = msg || ''; el.hidden = !msg; }
function authBusy(on) { ['#aSubmit', '#sSubmit'].forEach(s => { $(s).disabled = on; }); }

function showAuth(mode, msg = '') {
  document.body.classList.add('auth-pending');
  $('#loginForm').hidden = mode !== 'login';
  $('#setupForm').hidden = mode !== 'setup';
  $('#authWait').hidden = mode !== 'wait';
  setErr('#aErr', mode === 'login' ? msg : '');
  setErr('#sErr', mode === 'setup' ? msg : '');
  authBusy(false);
  if (mode === 'login') {
    $('input', otpLogin).focus();
  }
  if (mode === 'setup') $('#sKey').focus();
}

function authMsg(err) {
  const c = (err && err.code) || '';
  if (['app/bad-login', 'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(c)) return 'รหัสไม่ถูกต้อง';
  if (c === 'auth/too-many-requests') return 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (c === 'auth/network-request-failed') return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง';
  if (c === 'auth/operation-not-allowed') return 'ยังไม่ได้เปิดการล็อกอินแบบอีเมล/รหัสผ่านใน Firebase Console (Authentication > Sign-in method)';
  if (c === 'permission-denied') return 'ไม่มีสิทธิ์ทำรายการนี้ (ถ้าเป็นการติดตั้ง รหัสติดตั้งอาจไม่ถูกต้อง หรือติดตั้งไปแล้ว)';
  if (c === 'app/exists') return 'ผู้ใช้นี้มีอยู่แล้ว';
  if (c === 'app/code-taken') return 'รหัสนี้มีคนใช้แล้ว กรุณาเลือกรหัสอื่น';
  if (c === 'auth/weak-password') return 'รหัสไม่ปลอดภัยพอ ต้องเป็นตัวเลข 6 หลัก';
  if (c === 'auth/requires-recent-login') return 'กรุณาออกจากระบบแล้วเข้าใหม่ จากนั้นลองอีกครั้ง';
  return 'เกิดข้อผิดพลาด: ' + (c || (err && err.message) || 'ไม่ทราบสาเหตุ');
}

async function handleUser(user) {
  if (settingUp) return;
  if (!user) {
    const msg = authNotice; authNotice = '';
    leaveApp(true);
    showAuth(location.hash === '#setup' ? 'setup' : 'login', msg);
    return;
  }
  showAuth('wait');
  try {
    const me = await B.profile();
    enterApp(me, B.eventStore(me));
  } catch (err) {
    console.error(err);
    authNotice = 'บัญชีนี้ยังไม่มีสิทธิ์ใช้งานหรือถูกปิดใช้งาน กรุณาติดต่อแอดมิน';
    try { await B.logout(); } catch { /* ignore */ }
  }
}

function enterApp(me, storeObj) {
  leaveApp(false);
  state.me = me; store = storeObj;
  state.filter = { category: '', status: '', project: '', assignee: '', owner: defaultOwner() };
  state.scrollInit = true;
  paintMe();
  $('#btnAdd').hidden = !can().log;
  $('#btnImport').hidden = !can().log;
  document.body.classList.remove('auth-pending');
  authBusy(false);
  state.unsub = store.subscribe(onData, onDataErr) || null;
  if (can().admin && B) state.usersUnsub = B.subscribeUsers(list => { state.users = list; if (state.page === 'settings') renderUsers(); }, () => {});
  setPage('calendar');
  renderSide();
  msRestore();
}

function leaveApp(showLogin) {
  if (state.unsub) { state.unsub(); state.unsub = null; }
  if (state.usersUnsub) { state.usersUnsub(); state.usersUnsub = null; }
  state.events = []; state.users = []; state.me = null;
  if (showLogin) {
    msWipe();
    [dlg, dlgFilter, $('#dlgUser')].forEach(d => { if (d.open) d.close(); });
    [otpLogin, otpSetupAdmin, otpSetupAdmin2, otpSetupOv, otpCur, otpNew, otpNew2].forEach(o => $$('input', o).forEach(i => { i.value = ''; }));
    ctx.hidden = true;
    state.page = 'calendar';
  }
}

function onData(list, meta) {
  state.events = list.map(e => ({ status: 'todo', category: 'other', project: '', note: '', assignee: '', link: '', ownerId: '', ownerName: '', ...e }));
  if (store.mode === 'firebase') {
    state.conn = meta && meta.fromCache
      ? { cls: 'warn', text: 'ออฟไลน์ - แสดงข้อมูลที่แคชไว้ในเครื่อง' }
      : { cls: 'ok', text: 'เชื่อมต่อ Firebase แล้ว' };
  }
  rerender();
}
function onDataErr(err) {
  console.error(err);
  if (err && err.code === 'permission-denied') {
    authNotice = 'สิทธิ์การใช้งานของคุณถูกเปลี่ยนหรือถูกปิดใช้งาน กรุณาเข้าสู่ระบบใหม่';
    if (B) B.logout();
    return;
  }
  state.conn = { cls: 'err', text: 'เชื่อมต่อ Firebase ไม่ได้: ' + (err.code || err.message) };
  renderSide();
}

function bindAuthUI() {
  [otpLogin, otpSetupAdmin, otpSetupAdmin2, otpSetupOv, otpCur, otpNew, otpNew2].forEach(buildOtp);

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = otpValue(otpLogin);
    if (!/^\d{6}$/.test(code)) { setErr('#aErr', 'กรุณาใส่รหัสให้ครบ 6 หลัก'); return; }
    setErr('#aErr', ''); authBusy(true);
    try { await B.login(code, $('#aRemember').checked); }
    catch (err) { setErr('#aErr', authMsg(err)); otpClear(otpLogin); authBusy(false); }
  });

  $('#setupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const key = $('#sKey').value.trim(), name = $('#sName').value.trim() || 'ผู้ดูแลระบบ';
    const a1 = otpValue(otpSetupAdmin), a2 = otpValue(otpSetupAdmin2), ov = otpValue(otpSetupOv);
    if (!key) return setErr('#sErr', 'กรุณาใส่รหัสติดตั้ง');
    if (!/^\d{6}$/.test(a1)) return setErr('#sErr', 'รหัสแอดมินต้องเป็นตัวเลข 6 หลัก');
    if (a1 !== a2) return setErr('#sErr', 'รหัสแอดมินทั้งสองช่องไม่ตรงกัน');
    if (ov && !/^\d{6}$/.test(ov)) return setErr('#sErr', 'รหัส Overview ต้องเป็นตัวเลข 6 หลัก หรือเว้นว่างไว้');
    if (ov && ov === a1) return setErr('#sErr', 'รหัส Overview ต้องไม่ซ้ำกับรหัสแอดมิน');
    setErr('#sErr', ''); authBusy(true); settingUp = true;
    try {
      await B.setup({ key, name, adminCode: a1, overviewCode: ov });
      settingUp = false;
      history.replaceState(null, '', location.pathname + location.search);
      await handleUser(B.currentUser());
    } catch (err) {
      settingUp = false;
      console.error(err);
      setErr('#sErr', authMsg(err)); authBusy(false);
    }
  });

  window.addEventListener('hashchange', () => { if (!state.me && B && $('#authWait').hidden) showAuth(location.hash === '#setup' ? 'setup' : 'login'); });
  $('#btnLogout').onclick = () => { if (B) B.logout(); else toast('โหมดทดลองไม่มีการล็อกอิน'); };

  // ---------- ตั้งค่า: เปลี่ยนรหัสของฉัน ----------
  $('#codeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const cur = otpValue(otpCur), nw = otpValue(otpNew), nw2 = otpValue(otpNew2);
    if (![cur, nw, nw2].every(v => /^\d{6}$/.test(v))) return setErr('#cErr', 'กรอกรหัสทั้งสามช่องให้ครบ 6 หลัก');
    if (nw !== nw2) return setErr('#cErr', 'รหัสใหม่ทั้งสองช่องไม่ตรงกัน');
    if (nw === cur) return setErr('#cErr', 'รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม');
    setErr('#cErr', ''); $('#cSubmit').disabled = true;
    try {
      await B.changeMyCode(cur, nw);
      [otpCur, otpNew, otpNew2].forEach(o => $$('input', o).forEach(i => { i.value = ''; }));
      toast('เปลี่ยนรหัสแล้ว');
    } catch (err) {
      setErr('#cErr', err && ['auth/invalid-credential', 'auth/wrong-password'].includes(err.code) ? 'รหัสปัจจุบันไม่ถูกต้อง' : authMsg(err));
    }
    $('#cSubmit').disabled = false;
  });

  // ---------- ตั้งค่า: จัดการผู้ใช้ (แอดมิน) ----------
  $('#btnAddUser').onclick = () => openUserDialog('add');
  $('#usersTable').addEventListener('click', e => {
    const reset = e.target.closest('[data-reset]'), tog = e.target.closest('[data-toggle]');
    if (reset) openUserDialog('reset', state.users.find(u => u.username === reset.dataset.reset));
    if (tog) {
      const u = state.users.find(x => x.username === tog.dataset.toggle);
      if (u) Promise.resolve(B.setUserActive(u.username, !u.active)).then(() => toast(u.active ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว')).catch(err => failToast('บันทึก', err));
    }
  });
  $('#usersTable').addEventListener('change', e => {
    const sel = e.target.closest('[data-role]');
    if (sel) Promise.resolve(B.setUserRole(sel.dataset.role, sel.value)).then(() => toast('เปลี่ยนสิทธิ์แล้ว')).catch(err => failToast('บันทึก', err));
  });
  const du = $('#dlgUser');
  $('#uClose').onclick = $('#uCancel').onclick = $('#uOk').onclick = () => du.close();
  $('#uRandom').onclick = async () => {
    // สุ่มรหัสที่ยังไม่มีใครใช้
    for (let i = 0; i < 25; i++) {
      const a = new Uint32Array(1); crypto.getRandomValues(a);
      const c = String(a[0] % 1000000).padStart(6, '0');
      $('#uCode').value = c;
      try { if (!(B && await B.codeTaken(c))) return; } catch { return; }
    }
  };
  $('#uCode').addEventListener('input', () => { $('#uCode').value = $('#uCode').value.replace(/\D/g, '').slice(0, 6); });
  $('#uForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#uName').value.trim(), role = $('#uRole').value, code = $('#uCode').value.trim();
    if (userMode === 'add' && !name) return setErr('#uErr', 'กรุณาใส่ชื่อที่แสดง');
    if (!/^\d{6}$/.test(code)) return setErr('#uErr', 'รหัสต้องเป็นตัวเลข 6 หลัก');
    setErr('#uErr', ''); $('#uSubmit').disabled = true;
    try {
      if (userMode === 'add') await B.addUser({ name, role, code }); else await B.resetCode(userTarget.username, code);
      $('#uForm').hidden = true; $('#uDone').hidden = false;
      $('#uDoneUser').textContent = userMode === 'add' ? name : userTarget.name; $('#uDoneCode').textContent = code;
      $('#uTitle').textContent = userMode === 'add' ? 'สร้างผู้ใช้แล้ว' : 'ตั้งรหัสใหม่แล้ว';
    } catch (err) { console.error(err); setErr('#uErr', authMsg(err)); }
    $('#uSubmit').disabled = false;
  });
  $('#uCopy').onclick = () => {
    const t = `ผู้ใช้: ${$('#uDoneUser').textContent}\nรหัสเข้าระบบ: ${$('#uDoneCode').textContent}`;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { $('#uCopy').textContent = 'คัดลอกแล้ว'; }).catch(() => { $('#uCopy').textContent = 'คัดลอกไม่ได้'; });
  };

  $('#legacyBanner').addEventListener('click', e => { if (e.target.closest('[data-claim]')) claimLegacy(); });
}

let userMode = 'add';
let userTarget = null;
function openUserDialog(mode, u) {
  userMode = mode;
  userTarget = u || null;
  $('#uForm').hidden = false; $('#uDone').hidden = true;
  setErr('#uErr', ''); $('#uCopy').textContent = 'คัดลอก';
  const add = mode === 'add';
  $('#uTitle').textContent = add ? 'เพิ่มผู้ใช้' : `ตั้งรหัสใหม่ให้ ${u ? u.name : ''}`;
  $('#uSubmit').textContent = add ? 'สร้างผู้ใช้' : 'ตั้งรหัสใหม่';
  $('#uNameWrap').hidden = !add; $('#uRoleWrap').hidden = !add;
  $('#uName').value = ''; $('#uRole').value = 'user'; $('#uCode').value = '';
  const d = $('#dlgUser');
  if (!d.open) d.showModal();
  $('#uRandom').click();
  setTimeout(() => (add ? $('#uName') : $('#uCode')).focus(), 30);
}

/* ---------- หน้าตั้งค่า ---------- */
function renderSettings() {
  const me = state.me;
  $('#myProfile').innerHTML = `<div class="avatar">${esc((me.name || '?').trim().charAt(0).toUpperCase())}</div>
    <div><b>${esc(me.name)}</b></div><span class="rolepill ${esc(me.role)}">${esc(ROLES[me.role] || me.role)}</span>`;
  $('#codeForm').hidden = !B;
  renderMsCard();
  $('#usersCard').hidden = !(can().admin && B);
  if (!$('#usersCard').hidden) renderUsers();
}
function renderUsers() {
  const rows = [...state.users].sort((a, b) => a.name.localeCompare(b.name, 'th')).map(u => {
    const self = state.me && u.username === state.me.username;
    return `<tr class="${u.active ? '' : 'off'}">
      <td><b>${esc(u.name)}</b></td>
      <td><select data-role="${esc(u.username)}" ${self ? 'disabled' : ''} aria-label="สิทธิ์ของ ${esc(u.name)}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></td>
      <td>${u.active ? '<span class="badge done">ใช้งานได้</span>' : '<span class="badge blocked">ปิดใช้งาน</span>'}</td>
      <td><div class="uact"><button type="button" class="btn sm" data-reset="${esc(u.username)}">รีเซ็ตรหัส</button>${self ? '' : `<button type="button" class="btn sm${u.active ? ' danger' : ''}" data-toggle="${esc(u.username)}">${u.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button>`}</div></td>
    </tr>`;
  }).join('');
  $('#usersTable').innerHTML = rows
    ? `<table class="utable"><tr><th>ชื่อ</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr>${rows}</table>`
    : '<div class="muted">ยังไม่มีผู้ใช้</div>';
}

/* =====================================================================
   เชื่อม Outlook / Teams (Microsoft Graph) ดึงเฉพาะปฏิทินของคนที่ล็อกอิน อ่านอย่างเดียว
   ประชุม Teams ที่นัดล่วงหน้าอยู่ในปฏิทิน Outlook จึงดึงผ่าน calendarView ตัวเดียวกัน
   ===================================================================== */
const MSAL_URL = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.28.1/lib/msal-browser.min.js';
const GRAPH_SCOPES = ['Calendars.Read'];
// ?msmock (เฉพาะ localhost) ใช้ข้อมูลตัวอย่างแทน Microsoft เพื่อลองหน้าตา
const msMock = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('msmock');
const msConfigured = () => msMock || !!(msConfig && msConfig.clientId);
let msal = null, msAccount = null;

async function msInit() {
  if (msMock || msal) return;
  await loadScript(MSAL_URL, 'msal');
  msal = new window.msal.PublicClientApplication({
    auth: {
      clientId: msConfig.clientId,
      authority: `https://login.microsoftonline.com/${msConfig.tenantId || 'organizations'}`,
      redirectUri: `${location.origin}/redirect.html`,
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await msal.initialize();
  msAccount = msal.getAllAccounts()[0] || null;
}

async function msConnect() {
  if (msMock) { msAccount = { name: 'ผู้ใช้ตัวอย่าง', username: 'sample@company.example' }; return; }
  await msInit();
  const r = await msal.loginPopup({ scopes: GRAPH_SCOPES, prompt: 'select_account' });
  msAccount = r.account;
}

// ออกจากการเชื่อมต่อ และล้างโทเคนที่เก็บไว้ในเครื่อง (ไม่ให้คนถัดไปที่ใช้เครื่องเดียวกันเห็นปฏิทินของคนก่อน)
function msWipe() {
  msal = null; msAccount = null;
  try { Object.keys(localStorage).filter(k => k.startsWith('msal.') || k.includes('login.windows.net') || k.includes('login.microsoftonline.com')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
  setPref('dl.msOn', '');
  state.ms = { ...state.ms, on: false, items: [], key: '', loadingKey: '', error: '', busy: false };
}

async function msToken() {
  try {
    return (await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: msAccount })).accessToken;
  } catch (e) {
    if (window.msal && e instanceof window.msal.InteractionRequiredAuthError) throw { code: 'ms/relogin' };
    throw e;
  }
}

const msParse = o => new Date(String(o.dateTime).split('.')[0] + 'Z'); // Graph ส่งเวลาเป็น UTC ถ้าไม่ขอ timezone
function msNormalize(e) {
  return {
    id: e.id, subject: e.subject || '', s: msParse(e.start).getTime(), e: msParse(e.end).getTime(),
    allDay: !!e.isAllDay, cancelled: !!e.isCancelled,
    teams: !!e.isOnlineMeeting && e.onlineMeetingProvider === 'teamsForBusiness',
    joinUrl: (e.onlineMeeting && e.onlineMeeting.joinUrl) || '', webLink: e.webLink || '',
    organizer: (e.organizer && e.organizer.emailAddress && e.organizer.emailAddress.name) || '',
    showAs: e.showAs || '', priv: ['private', 'confidential'].includes(e.sensitivity),
    declined: !!(e.responseStatus && e.responseStatus.response === 'declined'),
  };
}

function msMockItems(from, to) {
  const out = [], base = new Date(); base.setHours(0, 0, 0, 0);
  const mk = (off, h, m, len, subject, teams, extra = {}) => {
    const s = new Date(base); s.setDate(s.getDate() + off); s.setHours(h, m, 0, 0);
    return { id: `mock-${off}-${h}${m}-${subject}`, subject, s: s.getTime(), e: s.getTime() + len * 60000, allDay: false, cancelled: false, teams,
      joinUrl: teams ? 'https://teams.microsoft.com/l/meetup-join/sample' : '', webLink: 'https://outlook.office.com/calendar/item/sample',
      organizer: 'ฝ่ายบุคคล', showAs: 'busy', priv: false, declined: false, ...extra };
  };
  for (let d = -10; d <= 40; d++) {
    const wd = new Date(base.getTime() + d * 86400000).getDay();
    if (wd === 0 || wd === 6) continue;
    out.push(mk(d, 9, 30, 30, 'Daily Stand-up', true));
    if (wd === 2 || wd === 4) out.push(mk(d, 13, 0, 90, 'ประชุมทีมโครงการ', true));
    if (wd === 3) out.push(mk(d, 15, 0, 60, 'ประชุมผู้ขาย (Outlook)', false));
  }
  out.push(mk(1, 11, 0, 60, 'นัดส่วนตัว', false, { priv: true }));
  out.push(mk(1, 0, 0, 1440, 'วันหยุดบริษัท', false, { allDay: true }));
  out.push(mk(2, 10, 0, 60, 'ยกเลิกแล้ว', true, { cancelled: true }));
  out.push(mk(3, 16, 0, 60, 'ปฏิเสธแล้ว', true, { declined: true }));
  return out.filter(m => m.e > from.getTime() && m.s < to.getTime());
}

async function msFetch(from, to) {
  if (msMock) return msMockItems(from, to);
  const token = await msToken();
  const sel = 'id,subject,start,end,isAllDay,isCancelled,isOnlineMeeting,onlineMeetingProvider,onlineMeeting,organizer,showAs,webLink,sensitivity,responseStatus';
  let url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(from.toISOString())}&endDateTime=${encodeURIComponent(to.toISOString())}&$top=100&$orderby=start/dateTime&$select=${sel}`;
  const rows = [];
  for (let i = 0; i < 10 && url; i++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw { code: `graph/${r.status}` };
    const j = await r.json();
    rows.push(...(j.value || []));
    url = j['@odata.nextLink'];
  }
  return rows.map(msNormalize);
}

function msErrText(e) {
  const t = `${(e && (e.errorCode || e.code)) || ''} ${(e && e.message) || ''} ${(e && e.errorMessage) || ''}`;
  if (/popup_window_error|empty_window_error/i.test(t)) return 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน กรุณาอนุญาต popup สำหรับเว็บนี้แล้วลองใหม่';
  if (/user_cancelled/i.test(t)) return 'ยกเลิกการล็อกอิน Microsoft';
  if (/AADSTS65001|consent_required|AADSTS90094|AADSTS650057/i.test(t)) return 'ต้องให้ผู้ดูแลระบบ (IT) อนุมัติสิทธิ์ Calendars.Read ให้แอปนี้ก่อน';
  if (/AADSTS50011|redirect_uri/i.test(t)) return 'Redirect URI ที่ลงทะเบียนใน Entra ไม่ตรงกับ ' + location.origin + '/redirect.html';
  if (/AADSTS700016|AADSTS90002|invalid_client/i.test(t)) return 'Client ID หรือ Tenant ID ใน ms-config.js ไม่ถูกต้อง';
  if (/ms\/relogin/.test(t)) return 'เซสชัน Microsoft หมดอายุ กรุณากดเชื่อมต่อใหม่';
  if (/graph\/401|graph\/403/.test(t)) return 'Microsoft ไม่อนุญาตให้อ่านปฏิทิน (สิทธิ์ไม่พอ) กรุณาเชื่อมต่อใหม่ หรือแจ้ง IT';
  return 'เชื่อมต่อ Outlook ไม่สำเร็จ: ' + ((e && (e.errorCode || e.code || e.message)) || 'ไม่ทราบสาเหตุ');
}

/* ---------- ช่วงที่ต้องดึง / จัดกลุ่มรายวัน ---------- */
function msRange() {
  let first, last;
  if (state.view === 'm') {
    const a = state.anchor, f = new Date(a.getFullYear(), a.getMonth(), 1), l = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    first = startOfWeek(f); last = addDays(first, Math.ceil(((l - first) / 86400000 + 1) / 7) * 7 - 1);
  } else { const d = viewDays(); first = d[0]; last = d[d.length - 1]; }
  return { from: first, to: addDays(last, 1), key: `${toKey(first)}_${toKey(last)}` };
}

async function msEnsure(force = false) {
  if (!state.ms.on || !state.me) return;
  const r = msRange();
  if (!force && (state.ms.key === r.key || state.ms.loadingKey === r.key)) return;
  state.ms.loadingKey = r.key;
  try {
    const items = await msFetch(r.from, r.to);
    if (state.ms.loadingKey !== r.key) return;
    state.ms.items = items; state.ms.error = '';
  } catch (err) {
    console.error(err);
    if (state.ms.loadingKey !== r.key) return;
    state.ms.items = []; state.ms.error = msErrText(err);
    toast(state.ms.error, true);
  }
  state.ms.key = r.key; state.ms.loadingKey = '';
  if (!state.dragging && state.page === 'calendar') renderCalendar();
  if (state.page === 'settings') renderMsCard();
  if ($('#dlgMs').open) renderMsDialog();
}

const msVisible = () => state.ms.items.filter(m => !m.cancelled && !m.declined && !m.allDay && (state.ms.mode !== 'teams' || m.teams));
const msTitle = m => (m.priv ? '(นัดส่วนตัว)' : (m.subject || '(ไม่มีหัวข้อ)'));
const msLocal = m => {
  const a = new Date(m.s), b = new Date(m.e - 1);
  return { date: toKey(a), start: minToStr(a.getHours() * 60 + a.getMinutes()), end: minToStr(Math.min(b.getHours() * 60 + b.getMinutes() + 1, 1439)), single: toKey(a) === toKey(b) };
};
const msImported = m => { const l = msLocal(m); return myEvents().some(e => e.date === l.date && e.start === l.start && e.end === l.end && e.title === msTitle(m)); };

function msSegments(key) {
  const d0 = fromKey(key).getTime(), d1 = addDays(fromKey(key), 1).getTime(), out = [];
  msVisible().forEach(m => {
    if (m.e <= d0 || m.s >= d1) return;
    const s = Math.round((Math.max(m.s, d0) - d0) / 60000), e = Math.round((Math.min(m.e, d1) - d0) / 60000);
    out.push({ m, s, e: Math.max(e, s + 15) });
  });
  return out;
}

function msBlocksHtml(key) {
  if (!state.ms.on) return '';
  return msSegments(key).map(({ m, s, e }) => {
    const h = Math.max((e - s) / 60 * HOUR_H - 2, 18);
    const done = msImported(m);
    return `<div class="ms${m.teams ? ' teams' : ''}${done ? ' done' : ''}" data-ms="${esc(m.id)}" style="top:${s / 60 * HOUR_H + 1}px;height:${h}px" title="${esc(msTitle(m))}">
      <b>${esc(msTitle(m))}</b>${h > 30 ? `<span>${m.teams ? 'Teams · ' : 'Outlook · '}${minToStr(s)}-${minToStr(Math.min(e, 1439))}${done ? ' · ลงแล้ว' : ''}</span>` : ''}</div>`;
  }).join('');
}
function msCountHtml(key) {
  if (!state.ms.on) return '';
  const n = msSegments(key).length;
  return n ? `<span class="ms-count" title="ประชุม Outlook/Teams ${n} นัด">${ic('calendar')}${n}</span>` : '';
}

/* ---------- นำเข้าเป็นงาน ---------- */
function msToEvent(m) {
  const l = msLocal(m);
  return {
    title: msTitle(m), date: l.date, start: l.start, end: l.end, category: 'meeting',
    status: m.e < Date.now() ? 'done' : 'todo', project: '',
    note: `นำเข้าจาก ${m.teams ? 'Teams' : 'Outlook'}${m.organizer ? ` · ผู้จัด: ${m.organizer}` : ''}`,
    assignee: (state.me && state.me.name) || '', link: safeUrl(m.joinUrl) || safeUrl(m.webLink),
  };
}
function msImport(list) {
  if (!can().log) return;
  const evs = list.filter(m => msLocal(m).single && !msImported(m)).map(msToEvent);
  if (!evs.length) { toast('ไม่มีรายการใหม่ให้นำเข้า (ข้ามนัดที่ข้ามวันหรือที่ลงไว้แล้ว)', true); return; }
  Promise.resolve(store.saveMany(evs)).then(() => toast(`นำเข้า ${evs.length} นัดเป็นงานแล้ว`)).catch(err => failToast('นำเข้า', err));
}

function openMsMenu(e, id) {
  const m = state.ms.items.find(x => x.id === id);
  if (!m) return;
  const l = msLocal(m), url = m.teams ? (safeUrl(m.joinUrl) || safeUrl(m.webLink)) : safeUrl(m.webLink);
  const done = msImported(m);
  ctx.dataset.id = ''; ctx.dataset.ms = id;
  ctx.classList.add('ms-menu');
  ctx.innerHTML = `<div class="ctx-title"><b>${esc(msTitle(m))}</b><small>${l.start}-${l.end}${m.teams ? ' · Teams' : ' · Outlook'}${m.organizer ? ' · ' + esc(m.organizer) : ''}</small></div>`
    + (can().log ? (done ? `<button type="button" disabled>${ic('check')}นำเข้าเป็นงานแล้ว</button>` : (l.single ? `<button type="button" data-act="ms-import">${ic('plus')}นำเข้าเป็นงาน</button>` : '')) : '')
    + (url ? `<a data-act="ms-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${ic('link')}${m.teams ? 'เปิดลิงก์ประชุม Teams' : 'เปิดใน Outlook'}</a>` : '');
  ctx.hidden = false;
  const w = ctx.offsetWidth, h = ctx.offsetHeight;
  ctx.style.left = `${Math.max(8, Math.min(e.clientX, innerWidth - w - 8))}px`;
  ctx.style.top = `${e.clientY + h + 8 > innerHeight ? Math.max(8, e.clientY - h - 4) : e.clientY + 4}px`;
}
function handleMsAct(act, id) {
  const m = state.ms.items.find(x => x.id === id);
  if (act === 'ms-import' && m) msImport([m]);
}

/* ---------- หน้าต่างเทียบ / นำเข้าทั้งช่วงที่เห็น ---------- */
function renderMsDialog() {
  const list = msVisible().sort((a, b) => a.s - b.s);
  const [f, t] = (state.ms.key || '_').split('_');
  const hours = list.reduce((s, m) => s + (m.e - m.s) / 3600000, 0);
  const imported = list.filter(msImported).length;
  const logged = myEvents().filter(e => e.date >= f && e.date <= t && catOf(e.category).id === 'meeting').reduce((s, e) => s + dur(e), 0);
  const rows = list.map(m => {
    const l = msLocal(m), done = msImported(m), ok = can().log && l.single && !done;
    return `<label class="msrow${ok ? '' : ' off'}"><input type="checkbox" data-msck="${esc(m.id)}" ${ok ? 'checked' : 'disabled'}>
      <span class="when">${fmtThai(fromKey(l.date))}<br><small class="muted">${l.start}-${l.single ? l.end : '...'}</small></span>
      <span><b>${esc(msTitle(m))}</b><br><small class="muted">${m.teams ? 'Teams' : 'Outlook'}${m.organizer ? ' · ' + esc(m.organizer) : ''}</small></span>
      <span class="badge ${done ? 'done' : ''}">${done ? 'ลงแล้ว' : (l.single ? 'ยังไม่ได้ลง' : 'ข้ามวัน')}</span></label>`;
  }).join('');
  $('#msDlgBody').innerHTML = `
    <div class="ms-sum"><div><small>นัดใน Outlook/Teams</small><b>${list.length}</b><em>${round2(hours)} ชม.</em></div>
      <div><small>ลงเป็นงานแล้ว</small><b>${imported}</b><em>งานหมวดประชุมที่ลงไว้ ${round2(logged / 60)} ชม.</em></div>
      <div><small>ยังไม่ได้ลง</small><b>${list.length - imported}</b></div></div>
    ${state.ms.error ? `<p class="err">${esc(state.ms.error)}</p>` : ''}
    <div class="msrows">${rows || '<div class="muted" style="padding:14px 0">ไม่มีนัดหมายในช่วงที่เห็น</div>'}</div>`;
  updateMsImportBtn();
}
function updateMsImportBtn() {
  const n = $$('#msDlgBody [data-msck]:checked').length;
  $('#msImport').textContent = `นำเข้าที่เลือก (${n})`;
  $('#msImport').disabled = !n;
  $('#msImport').hidden = !can().log;
}
function openMsDialog() { renderMsDialog(); if (!$('#dlgMs').open) $('#dlgMs').showModal(); }

/* ---------- การ์ดตั้งค่า ---------- */
function renderMsCard() {
  const el = $('#msBody');
  if (!el) return;
  const ms = state.ms;
  if (!msConfigured()) {
    el.innerHTML = `<p class="muted" style="margin:0 0 8px">ฟังก์ชันนี้ดึงนัดหมายและประชุม Teams จาก Outlook มาเทียบกับงานที่ลงไว้ ต้องลงทะเบียนแอปในบริษัทก่อน (ทำครั้งเดียว โดยผู้ดูแล Microsoft 365)</p>
      <ol class="steps"><li>เปิด <b>entra.microsoft.com</b> &gt; Applications &gt; App registrations &gt; New registration</li>
      <li>ตั้งชื่อ Daily Log เลือก "Accounts in this organizational directory only" ใส่ Redirect URI ชนิด <b>Single-page application</b> เป็น <code>${esc(location.origin)}/redirect.html</code></li>
      <li>API permissions &gt; Add &gt; Microsoft Graph &gt; Delegated &gt; <b>Calendars.Read</b> (ถ้าระบบขอ ให้กด Grant admin consent)</li>
      <li>คัดลอก Application (client) ID และ Directory (tenant) ID ไปใส่ในไฟล์ <code>public/ms-config.js</code> แล้ว deploy</li></ol>`;
    return;
  }
  if (!ms.on) {
    el.innerHTML = `<p class="muted" style="margin:0 0 10px">เชื่อมบัญชี Microsoft ของบริษัท เพื่อเห็นนัดหมายและประชุม Teams ซ้อนในปฏิทิน เว็บอ่านปฏิทินของคุณได้อย่างเดียว ไม่แก้ ไม่ส่งอีเมล และไม่เก็บนัดหมายลงฐานข้อมูล</p>
      ${ms.error ? `<p class="err">${esc(ms.error)}</p>` : ''}
      <button type="button" class="btn btn-dark" data-msconnect ${ms.busy ? 'disabled' : ''}>${ms.busy ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ Outlook / Teams'}</button>`;
    return;
  }
  el.innerHTML = `<div class="ms-status"><span class="dotok"></span><div><b>เชื่อมต่อแล้ว</b><div class="muted">${esc((msAccount && (msAccount.username || msAccount.name)) || '')}${msMock ? ' (ข้อมูลตัวอย่าง)' : ''}</div></div></div>
    ${ms.error ? `<p class="err">${esc(ms.error)}</p>` : ''}
    <div class="seg" style="margin:12px 0"><button type="button" data-msmode="all" class="${ms.mode === 'all' ? 'on' : ''}">นัดทั้งหมด</button><button type="button" data-msmode="teams" class="${ms.mode === 'teams' ? 'on' : ''}">เฉพาะประชุม Teams</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-msrefresh>ดึงใหม่</button><button type="button" class="btn sm danger" data-msdisconnect>ตัดการเชื่อมต่อ</button></div>`;
}

function updateMsUi() {
  $('#btnMs').hidden = !state.ms.on;
  renderMsCard();
}

async function msRestore() {
  state.ms.mode = pref('dl.msMode', 'all') === 'teams' ? 'teams' : 'all';
  if (!msConfigured()) { updateMsUi(); return; }
  if (msMock) { await msConnect(); state.ms.on = true; updateMsUi(); msEnsure(true); return; }
  if (pref('dl.msOn', '') !== '1') { updateMsUi(); return; }
  try {
    await msInit();
    if (!msAccount) { setPref('dl.msOn', ''); updateMsUi(); return; }
    state.ms.on = true; updateMsUi(); msEnsure(true);
  } catch (err) { console.error(err); state.ms.error = msErrText(err); updateMsUi(); }
}

function bindMs() {
  $('#btnMs').onclick = openMsDialog;
  $('#msClose').onclick = $('#msCancel').onclick = () => $('#dlgMs').close();
  $('#dlgMs').addEventListener('click', e => { if (e.target === $('#dlgMs')) $('#dlgMs').close(); });
  $('#dlgMs').addEventListener('change', e => { if (e.target.matches('[data-msck]')) updateMsImportBtn(); });
  $('#msImport').onclick = () => {
    const ids = new Set($$('#msDlgBody [data-msck]:checked').map(i => i.dataset.msck));
    msImport(msVisible().filter(m => ids.has(m.id)));
    $('#dlgMs').close();
  };
  $('#msBody').addEventListener('click', async e => {
    if (e.target.closest('[data-msconnect]')) {
      state.ms.busy = true; state.ms.error = ''; renderMsCard();
      try {
        await msConnect();
        state.ms.on = true; setPref('dl.msOn', '1'); state.ms.key = ''; state.ms.loadingKey = '';
        await msEnsure(true);
        if (!state.ms.error) toast('เชื่อม Outlook / Teams แล้ว');
      } catch (err) { console.error(err); state.ms.error = msErrText(err); }
      state.ms.busy = false; updateMsUi();
    }
    const mode = e.target.closest('[data-msmode]');
    if (mode) { state.ms.mode = mode.dataset.msmode; setPref('dl.msMode', state.ms.mode); renderMsCard(); }
    if (e.target.closest('[data-msrefresh]')) { await msEnsure(true); toast('ดึงนัดหมายใหม่แล้ว'); }
    if (e.target.closest('[data-msdisconnect]')) { msWipe(); updateMsUi(); toast('ตัดการเชื่อมต่อ Outlook แล้ว'); if (state.page === 'calendar') renderCalendar(); }
  });
}

/* =====================================================================
   เริ่มทำงาน
   ===================================================================== */
function rerender() {
  if (state.dragging || !state.me) { state.pendingRender = state.dragging; return; }
  renderSide();
  if (state.page === 'report') renderReport(); else if (state.page === 'pending') renderPending(); else if (state.page === 'settings') renderSettings(); else renderCalendar();
}

async function start() {
  $$('[data-ic]').forEach(el => { el.outerHTML = ic(el.dataset.ic); });
  buildFormOptions();
  bind();
  bindExtras();
  initDrag();
  bindAuthUI();
  bindMs();
  setInterval(() => { if (state.me) { updateNow(); renderSide(); } }, 60000);

  if (!(firebaseConfig && firebaseConfig.projectId)) {
    // โหมดทดลอง: ไม่มี Firebase จึงไม่มีล็อกอิน ใช้ ?role=user|admin|overview เพื่อลองหน้าตาแต่ละสิทธิ์
    const role = ['user', 'admin', 'overview'].includes(new URLSearchParams(location.search).get('role')) ? new URLSearchParams(location.search).get('role') : 'admin';
    state.conn = { cls: 'warn', text: 'โหมดทดลอง: เก็บข้อมูลในเบราว์เซอร์นี้เท่านั้น (ยังไม่ได้ตั้งค่า Firebase)' };
    enterApp({ username: 'local', name: 'ผู้ใช้ทดลอง', role, local: true }, localStore());
    return;
  }

  showAuth('wait');
  try { B = await loadBackend(); } catch (err) {
    console.error(err);
    showAuth('login', 'โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า');
    return;
  }
  B.onAuth(handleUser);
}

start();
