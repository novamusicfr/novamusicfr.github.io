// Page de connexion Google pour l'app PC.
// Elle tourne dans ton vrai navigateur (Google refuse les connexions
// dans les fenêtres d'apps), puis renvoie le jeton à l'app via localhost.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfig } from '../firebase-config.js';

const auth = getAuth(initializeApp(firebaseConfig, 'desktop-login'));
const nonce = new URLSearchParams(location.search).get('nonce') || '';
const $ = (s) => document.querySelector(s);
const msg = (t, k = '') => { $('#msg').textContent = t; $('#msg').className = 'auth-msg ' + k; };

if (!nonce) { msg("Ouvre cette page depuis l'app Nova Music.", 'err'); $('#go').disabled = true; }

$('#go').onclick = async () => {
  $('#go').disabled = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const res = await signInWithPopup(auth, provider);
    const cred = GoogleAuthProvider.credentialFromResult(res);
    const r = await fetch('./auth-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce, idToken: cred.idToken, accessToken: cred.accessToken }),
    });
    await signOut(auth).catch(() => {});
    if (!r.ok) throw new Error('callback');
    $('#txt').textContent = "C'est bon ! Tu peux fermer cet onglet et retourner dans Nova Music 🎧";
    $('#go').style.display = 'none';
    msg('Connecté ✓', 'ok');
    setTimeout(() => window.close(), 1500);
  } catch (e) {
    console.error(e);
    $('#go').disabled = false;
    msg(e.message === 'callback'
      ? "L'app n'a pas reçu la connexion. Relance « Continuer avec Google » depuis l'app."
      : 'Connexion annulée ou impossible. Réessaie.', 'err');
  }
};
