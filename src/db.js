import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, increment, Timestamp,
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
