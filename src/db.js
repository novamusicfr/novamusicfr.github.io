import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection,
  onSnapshot, query, orderBy, limit, serverTimestamp, writeBatch, increment, Timestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase.js';

/** Crée la fiche utilisateur au premier login */
export async function ensureUser(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName || (user.email || '').split('@')[0] || 'Nova',
      email: user.email || '',
      createdAt: serverTimestamp(),
      plays: 0,
    });
  }
}

export const setDisplayName = (uid, name) =>
  setDoc(doc(db, 'users', uid), { displayName: String(name).trim().slice(0, 32) }, { merge: true });

export const watchUser = (uid, cb) =>
  onSnapshot(doc(db, 'users', uid), (s) => cb(s.exists() ? s.data() : {}));

export const watchLibrary = (uid, cb) =>
  onSnapshot(query(collection(db, 'users', uid, 'library'), orderBy('addedAt', 'desc')),
    (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))));

export const addToLibrary = (uid, item) =>
  addDoc(collection(db, 'users', uid, 'library'), { ...item, fav: false, lastPlayed: 0, addedAt: serverTimestamp() });

export const updateItem = (uid, id, data) => updateDoc(doc(db, 'users', uid, 'library', id), data);
export const removeItem = (uid, id) => deleteDoc(doc(db, 'users', uid, 'library', id));

export async function markPlayed(uid, id) {
  await Promise.all([
    updateItem(uid, id, { lastPlayed: Date.now() }),
    updateDoc(doc(db, 'users', uid), { plays: increment(1) }),
  ]);
}

/** Premium actif ? (gère les codes à durée limitée) */
export function premiumActive(profile) {
  const p = profile && profile.premium;
  if (!p || !p.active) return false;
  if (p.until && p.until.toMillis && p.until.toMillis() < Date.now()) return false;
  return true;
}

/** Utilise un code Premium. Erreurs : 'invalid', 'used' */
export async function redeemCode(uid, raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error('invalid');
  const cref = doc(db, 'codes', code);
  let snap;
  try { snap = await getDoc(cref); } catch (_) { throw new Error('invalid'); }
  if (!snap.exists()) throw new Error('invalid');
  const c = snap.data();
  if (c.used) throw new Error('used');

  const batch = writeBatch(db);
  batch.update(cref, { used: true, usedBy: uid, usedAt: serverTimestamp() });
  batch.update(doc(db, 'users', uid), {
    premium: {
      active: true,
      plan: c.plan || 'code',
      code,
      since: serverTimestamp(),
      // marge d'1 h pour les horloges en avance
      until: c.days ? Timestamp.fromMillis(Date.now() + c.days * 864e5 - 36e5) : null,
    },
  });
  await batch.commit();
  return c;
}

/* ================= Playlists perso ================= */
export const watchPlaylists = (uid, cb) =>
  onSnapshot(query(collection(db, 'users', uid, 'playlists'), orderBy('createdAt', 'desc')),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))));

export const createPlaylist = (uid, name) =>
  addDoc(collection(db, 'users', uid, 'playlists'), { name: String(name).trim().slice(0, 60) || 'Ma playlist', items: [], createdAt: serverTimestamp() });
export const renamePlaylist = (uid, id, name) =>
  updateDoc(doc(db, 'users', uid, 'playlists', id), { name: String(name).trim().slice(0, 60) });
export const deletePlaylist = (uid, id) => deleteDoc(doc(db, 'users', uid, 'playlists', id));
export const addToPlaylist = (uid, id, itemId) =>
  updateDoc(doc(db, 'users', uid, 'playlists', id), { items: arrayUnion(itemId) });
export const removeFromPlaylist = (uid, id, itemId) =>
  updateDoc(doc(db, 'users', uid, 'playlists', id), { items: arrayRemove(itemId) });

/* ================= Admin : codes Premium ================= */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I pour éviter les confusions
function randomCode() {
  const r = crypto.getRandomValues(new Uint32Array(8));
  const part = (a) => Array.from(a, (n) => ALPHA[n % ALPHA.length]).join('');
  return `NOVA-${part(r.slice(0, 4))}-${part(r.slice(4, 8))}`;
}
/** plan : 'mois' | 'an' | 'vie' ; days : nombre ou null (à vie) */
export async function createCodes(uid, plan, days, count) {
  const batch = writeBatch(db);
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = randomCode();
    codes.push(code);
    const data = { used: false, plan, createdAt: serverTimestamp(), createdBy: uid };
    if (days) data.days = days;
    batch.set(doc(db, 'codes', code), data);
  }
  await batch.commit();
  return codes;
}
export const watchCodes = (cb) =>
  onSnapshot(query(collection(db, 'codes'), orderBy('createdAt', 'desc'), limit(200)),
    (s) => cb(s.docs.map((d) => ({ code: d.id, ...d.data() }))), () => cb(null));
export const deleteCode = (code) => deleteDoc(doc(db, 'codes', code));
