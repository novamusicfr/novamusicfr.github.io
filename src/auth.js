import {
  GoogleAuthProvider, signInWithPopup, signInWithCredential,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, updateProfile,
  signOut, onAuthStateChanged,
} from 'firebase/auth';
import { auth, platform } from './firebase.js';

/* ---------- PC : connexion Google via le navigateur ----------
   L'app ouvre ton navigateur sur une page locale, tu te connectes avec Google,
   la page renvoie le jeton à l'app (voir electron/main.cjs). */
let desktopWaiter = null;
if (window.novaDesktop) {
  window.novaDesktop.onGoogleToken(async ({ idToken, accessToken, error }) => {
    const w = desktopWaiter; desktopWaiter = null;
    if (!w) return;
    clearTimeout(w.timer);
    if (error || !idToken) return w.reject(new Error(error || 'google-cancelled'));
    try { w.resolve(await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))); }
    catch (e) { w.reject(e); }
  });
}

export async function loginWithGoogle() {
  if (platform === 'desktop') {
    if (desktopWaiter) { clearTimeout(desktopWaiter.timer); desktopWaiter.reject(new Error('google-cancelled')); }
    const p = new Promise((resolve, reject) => {
      desktopWaiter = { resolve, reject, timer: setTimeout(() => { desktopWaiter = null; reject(new Error('google-timeout')); }, 5 * 60 * 1000) };
    });
    await window.novaDesktop.googleLogin();
    return p;
  }

  if (platform === 'android' || platform === 'ios') {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const r = await FirebaseAuthentication.signInWithGoogle();
    const c = r.credential || {};
    if (!c.idToken) throw new Error('google-cancelled');
    return signInWithCredential(auth, GoogleAuthProvider.credential(c.idToken, c.accessToken));
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

export async function signUpWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name && name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  try { await sendEmailVerification(cred.user); } catch (_) { /* pas bloquant */ }
  return cred;
}

export const loginWithEmail = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());
export const resendVerification = () => auth.currentUser && sendEmailVerification(auth.currentUser);

export async function logout() {
  if (platform === 'android' || platform === 'ios') {
    try { const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication'); await FirebaseAuthentication.signOut(); } catch (_) {}
  }
  return signOut(auth);
}

export const watchAuth = (cb) => onAuthStateChanged(auth, cb);

/** Traduit les erreurs Firebase en français */
export function authErrorFR(e) {
  const code = (e && (e.code || e.message)) || '';
  const map = {
    'auth/invalid-email': "Adresse e-mail invalide.",
    'auth/missing-email': "Entre ton adresse e-mail.",
    'auth/missing-password': "Entre ton mot de passe.",
    'auth/weak-password': "Mot de passe trop faible (6 caractères minimum).",
    'auth/email-already-in-use': "Un compte existe déjà avec cet e-mail. Connecte-toi.",
    'auth/invalid-credential': "E-mail ou mot de passe incorrect.",
    'auth/wrong-password': "E-mail ou mot de passe incorrect.",
    'auth/user-not-found': "Aucun compte avec cet e-mail.",
    'auth/user-disabled': "Ce compte a été désactivé.",
    'auth/too-many-requests': "Trop d'essais. Réessaie dans quelques minutes.",
    'auth/network-request-failed': "Pas de connexion internet.",
    'auth/popup-closed-by-user': "Connexion Google annulée.",
    'auth/cancelled-popup-request': "Connexion Google annulée.",
    'auth/popup-blocked': "Ton navigateur a bloqué la fenêtre Google. Autorise les pop-ups.",
    'auth/unauthorized-domain': "Ce domaine n'est pas autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés).",
    'auth/operation-not-allowed': "Cette méthode de connexion n'est pas activée dans Firebase.",
    'auth/account-exists-with-different-credential': "Ce mail est déjà lié à une autre méthode de connexion.",
    'google-cancelled': "Connexion Google annulée.",
    'google-timeout': "La connexion Google a expiré. Réessaie.",
  };
  for (const k in map) if (code.includes(k)) return map[k];
  if (/canceled|cancelled|12501|16:/i.test(code)) return "Connexion Google annulée.";
  if (/10:|DEVELOPER_ERROR|28444|Developer console/i.test(code)) return "Google refuse l'app (configuration Android/SHA-1). Code : " + String(code).slice(0, 120);
  if (/No credential|NoCredential/i.test(code)) return "Aucun compte Google trouvé sur ce téléphone. Ajoute un compte Google dans les Paramètres Android puis réessaie.";
  return "Une erreur est survenue. Code : " + String(code || e).slice(0, 160);
}
