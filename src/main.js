import { isConfigured, platform } from './firebase.js';
import { NOVA } from '../firebase-config.js';
import {
  loginWithGoogle, signUpWithEmail, loginWithEmail, resetPassword,
  resendVerification, logout, watchAuth, authErrorFR,
} from './auth.js';
import {
  ensureUser, watchUser, watchLibrary, addToLibrary, updateItem,
  removeItem, markPlayed, premiumActive, redeemCode, setDisplayName,
} from './db.js';
import { P, TYPE_FR, parseLink } from './links.js';

/* ================= Helpers ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400); }
function coverBg(it) {
  const c = (P[it.provider] || P.spotify).color;
  let h = 0; for (const ch of it.name || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, ${c}, hsl(${h},70%,28%))`;
}
function info(title, html, actions) {
  $('#infoTitle').textContent = title;
  $('#infoText').innerHTML = html;
  const box = $('#infoActions'); box.innerHTML = '';
  (actions || [{ label: 'OK' }]).forEach((a) => {
    const b = document.createElement(a.href ? 'a' : 'button');
    b.className = 'btn ' + (a.cls || ''); b.textContent = a.label;
    if (a.href) { b.href = a.href; b.target = '_blank'; b.rel = 'noopener'; b.style.textDecoration = 'none'; }
    b.onclick = () => { $('#infoModal').classList.remove('on'); a.fn && a.fn(); };
    box.appendChild(b);
  });
  $('#infoModal').classList.add('on');
}
$('#infoModal').addEventListener('click', (e) => { if (e.target.id === 'infoModal') e.target.classList.remove('on'); });

const GOOGLE_SVG = `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
const LOGO = `<div class="logo"><div class="logo-mark"><svg viewBox="0 0 24 24" fill="#fff"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg></div><div>Nova<small>Music</small></div></div>`;

/* ================= État ================= */
let user = null, profile = {}, library = [];
let unsubs = [];
let filter = 'all', query = '';
let current = null, adTimer = null, adCount = 0;
const isPremium = () => premiumActive(profile);

/* ================= Écran de compte ================= */
let authMode = 'login';
function renderAuth(msg = '', kind = 'err') {
  const card = $('#authCard');
  if (!isConfigured) {
    card.innerHTML = `${LOGO}<div class="setup"><h3 style="margin:14px 0 8px">Firebase pas encore configuré</h3>
      <p class="sub">Ouvre <code>firebase-config.js</code> et colle la configuration de ton projet Firebase (voir README, étape 1), puis relance le build.</p></div>`;
    return;
  }
  const signup = authMode === 'signup';
  card.innerHTML = `${LOGO}
    <p class="tagline">${signup ? 'Crée ton compte gratuit' : 'Content de te revoir'}</p>
    <div class="tabs"><button data-mode="login" class="${!signup ? 'on' : ''}">Connexion</button><button data-mode="signup" class="${signup ? 'on' : ''}">Créer un compte</button></div>
    <button class="gbtn" id="gBtn">${GOOGLE_SVG}Continuer avec Google</button>
    <div class="sep">ou avec ton e-mail</div>
    <form id="mailForm" novalidate>
      ${signup ? `<div class="field"><label for="fName">Pseudo</label><input class="input" id="fName" maxlength="32" autocomplete="nickname" placeholder="Ton pseudo"></div>` : ''}
      <div class="field"><label for="fMail">E-mail</label><input class="input" id="fMail" type="email" autocomplete="email" placeholder="toi@exemple.fr"></div>
      <div class="field"><label for="fPass">Mot de passe</label><input class="input" id="fPass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? '6 caractères minimum' : '••••••••'}"></div>
      <button class="btn" type="submit" id="mailBtn">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
    </form>
    ${!signup ? `<button class="linkbtn" id="forgot">Mot de passe oublié ?</button>` : ''}
    <div class="auth-msg ${kind}" id="authMsg">${esc(msg)}</div>
    <p class="legal">En continuant, tu acceptes les conditions d'utilisation de Nova Music.</p>
    ${platform === 'web' ? `<a class="btn ghost" href="./telecharger.html" style="text-decoration:none;margin-top:14px">📥 Télécharger l'app PC / Android / iPhone</a>` : ''}`;

  card.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { authMode = b.dataset.mode; renderAuth(); }));
  const setMsg = (m, k = 'err') => { const el = $('#authMsg'); el.textContent = m; el.className = 'auth-msg ' + k; };

  $('#gBtn').onclick = async () => {
    const b = $('#gBtn'); b.disabled = true;
    if (platform === 'desktop') setMsg('Termine la connexion dans ton navigateur…', 'ok');
    try { await loginWithGoogle(); }
    catch (e) { console.error(e); setMsg(authErrorFR(e)); }
    finally { if ($('#gBtn')) $('#gBtn').disabled = false; }
  };
  $('#mailForm').onsubmit = async (e) => {
    e.preventDefault();
    const mail = $('#fMail').value, pass = $('#fPass').value;
    const b = $('#mailBtn'); b.disabled = true;
    try {
      if (signup) {
        const name = $('#fName').value;
        const cred = await signUpWithEmail(name, mail, pass);
        if (name.trim()) await setDisplayName(cred.user.uid, name).catch(() => {});
      }
      else await loginWithEmail(mail, pass);
    } catch (err) { console.error(err); setMsg(authErrorFR(err)); }
    finally { if ($('#mailBtn')) $('#mailBtn').disabled = false; }
  };
  const forgot = $('#forgot');
  if (forgot) forgot.onclick = async () => {
    const mail = $('#fMail').value;
    if (!mail) return setMsg('Entre ton e-mail au-dessus, puis reclique.');
    try { await resetPassword(mail); setMsg('E-mail de réinitialisation envoyé ✓', 'ok'); }
    catch (err) { setMsg(authErrorFR(err)); }
  };
}

/* ================= Connexion / déconnexion ================= */
function stopWatchers() { unsubs.forEach((u) => u && u()); unsubs = []; }

watchAuth(async (u) => {
  stopWatchers();
  user = u;
  if (!u) {
    profile = {}; library = []; closePlayer();
    $('#app').classList.add('hidden'); $('#auth').classList.remove('hidden');
    renderAuth();
    return;
  }
  $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
  try { await ensureUser(u); } catch (e) { console.error(e); }
  unsubs.push(watchUser(u.uid, (p) => { profile = p; renderAll(); }, ));
  unsubs.push(watchLibrary(u.uid, (l) => { library = l; renderAll(); }));
  renderAll(); route();
});
if (!isConfigured) { $('#auth').classList.remove('hidden'); renderAuth(); }

const doLogout = () => info('Se déconnecter ?', 'Ta bibliothèque reste sauvegardée sur ton compte.', [
  { label: 'Annuler', cls: 'ghost' }, { label: 'Se déconnecter', fn: () => logout() },
]);
$('#logoutBtn').onclick = doLogout;
$('#logoutBtnMob').onclick = doLogout;

/* ================= Rendu ================= */
const displayName = () => profile.displayName || (user && (user.displayName || (user.email || '').split('@')[0])) || 'Nova';

function cardHTML(it) {
  const p = P[it.provider] || P.spotify;
  return `<div class="card" data-uid="${esc(it.uid)}">
    <div class="cover" style="background:${coverBg(it)}">
      <span class="big">${esc((it.name || '?').trim().charAt(0).toUpperCase())}</span>
      <button class="play" data-act="play" aria-label="Écouter"><svg viewBox="0 0 24 24" fill="#fff"><path d="M7 4v16l13-8z"/></svg></button>
    </div>
    <div class="acts">
      <button class="ic ${it.fav ? 'fav-on' : ''}" data-act="fav" title="Favori"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg></button>
      <button class="ic" data-act="del" title="Supprimer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
    </div>
    <h3 title="${esc(it.name)}">${esc(it.name)}</h3>
    <div class="meta"><span class="pill" style="background:${p.color}">${p.name}</span>${TYPE_FR[it.type] || ''}</div>
  </div>`;
}
const emptyHTML = (msg) => `<div class="empty" style="grid-column:1/-1">${msg}<br><a href="#ajouter" class="btn" style="text-decoration:none">Importer une playlist</a></div>`;

function renderHome() {
  const h = new Date().getHours();
  $('#hello').textContent = `${h < 6 || h >= 18 ? 'Bonsoir' : 'Bonjour'} ${displayName()} ${isPremium() ? '👑' : '👋'}`;
  const v = $('#verifyBox');
  const needVerify = user && !user.emailVerified && user.providerData.some((pd) => pd.providerId === 'password');
  v.innerHTML = needVerify ? `<div class="verify">📩 Confirme ton adresse e-mail (lien envoyé à ${esc(user.email)}). <button id="resend">Renvoyer le mail</button></div>` : '';
  if (needVerify) $('#resend').onclick = async () => { try { await resendVerification(); toast('Mail renvoyé ✓'); } catch (_) { toast('Réessaie dans un moment'); } };

  const counts = Object.keys(P).map((k) => [k, library.filter((i) => i.provider === k).length]);
  $('#stats').innerHTML = `<div class="stat"><b>${library.length}</b><span>Dans ta bibliothèque</span></div>` +
    counts.filter((c) => c[1]).map(([k, n]) => `<div class="stat"><b style="color:${P[k].color}">${n}</b><span>${P[k].name}</span></div>`).join('') +
    `<div class="stat"><b>${profile.plays || 0}</b><span>Écoutes lancées</span></div>`;
  const recent = library.filter((i) => i.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 6);
  $('#recentGrid').innerHTML = recent.length ? recent.map(cardHTML).join('')
    : library.length ? library.slice(0, 6).map(cardHTML).join('') : emptyHTML("Rien écouté pour l'instant — importe ta première playlist !");
  const favs = library.filter((i) => i.fav).slice(0, 12);
  $('#favGrid').innerHTML = favs.length ? favs.map(cardHTML).join('') : `<div class="empty" style="grid-column:1/-1">Clique sur ♥ sur une playlist pour l'ajouter ici.</div>`;
}
function renderLibrary() {
  const list = library.filter((i) => (filter === 'all' || (filter === 'fav' ? i.fav : i.provider === filter)) && (i.name || '').toLowerCase().includes(query.toLowerCase()));
  $('#libGrid').innerHTML = list.length ? list.map(cardHTML).join('') : emptyHTML(library.length ? 'Aucun résultat.' : 'Ta bibliothèque est vide.');
  const n = library.length;
  $('#libCount').textContent = `${n} élément${n > 1 ? 's' : ''} · synchronisé${n > 1 ? 's' : ''} sur tous tes appareils`;
  const chips = [['all', 'Tout'], ['fav', '♥ Favoris'], ...Object.keys(P).map((k) => [k, P[k].name])];
  $('#filters').innerHTML = chips.map(([k, l]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
}
function renderStatus() {
  const prem = isPremium();
  $('#statusBox').classList.toggle('is-prem', prem);
  const photo = user && user.photoURL;
  $('#statusDot').innerHTML = prem ? '👑' : photo
    ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
    : esc(displayName().charAt(0).toUpperCase());
  $('#statusName').textContent = displayName();
  $('#statusSub').textContent = prem ? 'Nova Premium · sans pub' : 'Compte gratuit · avec pubs';
  $('#sideAd').style.display = prem ? 'none' : '';
}
function renderPremium() {
  const z = $('#premiumZone');
  if (isPremium()) {
    const p = profile.premium;
    const since = p.since && p.since.toDate ? p.since.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : "aujourd'hui";
    const until = p.until && p.until.toDate ? `jusqu'au ${p.until.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'à vie';
    z.innerHTML = `<div class="active-prem">
      <div class="crown"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg></div>
      <div style="flex:1"><b style="font-size:19px">Ton pass Nova Premium est actif</b><p class="sub">Depuis le ${since} · ${until} · sur tous tes appareils.</p></div></div>`;
    return;
  }
  const expired = profile.premium && profile.premium.active;
  z.innerHTML = `${expired ? `<div class="verify" style="margin-top:22px">Ton pass Premium a expiré. Entre un nouveau code pour le prolonger.</div>` : ''}
    <h2>Choisis ta formule</h2><div class="plans">${NOVA.plans.map((p) => `
    <div class="plan ${p.best ? 'best' : ''}">${p.best ? '<span class="badge">Le plus populaire</span>' : ''}
      <b style="font-size:18px">${esc(p.name)}</b>
      <div class="price">${esc(p.price)} <small>${esc(p.per)}</small></div>
      <ul>${p.perks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <button class="btn ${p.best ? 'gold' : ''}" data-plan="${esc(p.id)}">Choisir ${esc(p.name)}</button>
    </div>`).join('')}</div>
    <h2>Tu as un code Premium ?</h2>
    <form class="code-row" id="codeForm">
      <input class="input" id="codeInput" placeholder="NOVA-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase">
      <button class="btn gold" type="submit" id="codeBtn">Activer</button>
    </form>`;
  z.querySelectorAll('[data-plan]').forEach((b) => (b.onclick = () => {
    const plan = NOVA.plans.find((p) => p.id === b.dataset.plan);
    info(`Nova Premium ${plan.name}`, `Pour obtenir ton pass <b>${esc(plan.name)}</b> (${esc(plan.price)}), rejoins le Discord Nova et ouvre un ticket : tu recevras un code à entrer juste en dessous.`,
      [{ label: 'Fermer', cls: 'ghost' }, { label: 'Rejoindre le Discord', href: NOVA.discordUrl }]);
  }));
  $('#codeForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#codeBtn'); btn.disabled = true;
    try {
      await redeemCode(user.uid, $('#codeInput').value);
      info('Bienvenue dans Nova Premium 👑', 'Ton pass est activé sur ton compte : plus aucune pub, sur PC comme sur téléphone.');
    } catch (err) {
      console.error(err);
      toast(err.message === 'used' ? 'Ce code a déjà été utilisé' : 'Code invalide');
    } finally { if ($('#codeBtn')) $('#codeBtn').disabled = false; }
  };
}
function renderSources() {
  $('#sources').innerHTML = Object.values(P).map((p) => `<div class="src"><b><i style="background:${p.color}"></i>${p.name}</b>${p.hint}</div>`).join('');
}
function renderAll() {
  if (!user) return;
  renderHome(); renderLibrary(); renderStatus();
  if (!document.activeElement || document.activeElement.id !== 'codeInput') renderPremium();
}

/* ================= Actions bibliothèque ================= */
async function addItem(parsed, name) {
  const exists = library.find((i) => i.embed === parsed.embed);
  if (exists) { toast('Déjà dans ta bibliothèque'); return exists; }
  const item = {
    provider: parsed.provider, type: parsed.type, embed: parsed.embed, url: parsed.url,
    height: parsed.height || 380, video: !!parsed.video,
    name: ((name || '').trim() || `${TYPE_FR[parsed.type] || 'Playlist'} ${P[parsed.provider].name}`).slice(0, 80),
  };
  try {
    const ref = await addToLibrary(user.uid, item);
    toast('Ajouté à ta bibliothèque ✓');
    return { uid: ref.id, ...item };
  } catch (e) { console.error(e); toast("Impossible d'ajouter (connexion ?)"); return null; }
}
function askRemove(id) {
  const it = library.find((i) => i.uid === id); if (!it) return;
  info('Supprimer ?', `« ${esc(it.name)} » sera retiré de ta bibliothèque.`, [
    { label: 'Annuler', cls: 'ghost' },
    { label: 'Supprimer', fn: async () => { await removeItem(user.uid, id); if (current && current.uid === id) closePlayer(); toast('Supprimé'); } },
  ]);
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-f]'); if (chip) { filter = chip.dataset.f; renderLibrary(); return; }
  const card = e.target.closest('.card'); if (!card) return;
  const act = (e.target.closest('[data-act]') || {}).dataset?.act;
  const id = card.dataset.uid;
  const it = library.find((i) => i.uid === id);
  if (!it) return;
  if (act === 'fav') return updateItem(user.uid, id, { fav: !it.fav });
  if (act === 'del') return askRemove(id);
  play(it);
});
$('#search').addEventListener('input', (e) => { query = e.target.value; renderLibrary(); });

/* ================= Lecture + pubs ================= */
const ADS = [
  { emo: '🤖', title: 'Nova, le bot Discord tout-en-un', text: 'Modération, musique, tickets, économie… Ajoute Nova sur ton serveur.', bg: 'linear-gradient(135deg,#3b2a8a,#1b6b8a)' },
  { emo: '👑', title: 'Nova Premium', text: 'Plus de pubs, jamais. Lecture instantanée sur tous tes appareils.', bg: 'linear-gradient(135deg,#6b3d0f,#8a2a5a)' },
  { emo: '🎧', title: 'Importe tout, écoute partout', text: 'Spotify, YouTube, Deezer, SoundCloud, Apple Music : une seule app.', bg: 'linear-gradient(135deg,#0f5a4a,#2a3a8a)' },
];
function play(it) { if (isPremium()) startPlayback(it); else showAd(() => startPlayback(it)); }
function showAd(done) {
  const ad = ADS[adCount++ % ADS.length];
  $('#adVisual').style.background = ad.bg;
  $('#adVisual').innerHTML = `<span class="tag">PUBLICITÉ</span><span class="emo">${ad.emo}</span><b>${esc(ad.title)}</b><span>${esc(ad.text)}</span>`;
  const skip = $('#adSkip'), bar = $('#adBar'), total = NOVA.adSeconds;
  let left = total; skip.disabled = true; skip.textContent = `Passer dans ${left}`; bar.style.width = '0';
  $('#adModal').classList.add('on');
  clearInterval(adTimer);
  adTimer = setInterval(() => {
    left--; bar.style.width = ((total - left) / total) * 100 + '%';
    if (left <= 0) { clearInterval(adTimer); skip.disabled = false; skip.textContent = 'Passer la pub ›'; }
    else skip.textContent = `Passer dans ${left}`;
  }, 1000);
  skip.onclick = () => { $('#adModal').classList.remove('on'); done(); };
  $('#adPremium').onclick = () => { clearInterval(adTimer); $('#adModal').classList.remove('on'); };
}
function startPlayback(it) {
  current = it;
  markPlayed(user.uid, it.uid).catch(() => {});
  const p = P[it.provider] || P.spotify;
  $('#pMini').style.background = coverBg(it); $('#pMini').textContent = (it.name || '?').charAt(0).toUpperCase();
  $('#pTitle').textContent = it.name;
  $('#pSub').textContent = `${p.name} · ${TYPE_FR[it.type] || ''}`;
  $('#pOpen').href = it.url;
  const sep = it.embed.includes('?') ? '&' : '?';
  const src = it.provider === 'youtube' ? it.embed + sep + 'autoplay=1&rel=0&playsinline=1'
    : it.provider === 'deezer' ? it.embed + sep + 'autoplay=true' : it.embed;
  const size = it.video ? 'class="video"' : `height="${Number(it.height) || 380}"`;
  $('#pBody').innerHTML = `<iframe src="${esc(src)}" ${size} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen title="${esc(it.name)}"></iframe>`;
  $('#player').classList.add('on'); $('#player').classList.remove('collapsed');
}
function closePlayer() { current = null; $('#pBody').innerHTML = ''; $('#player').classList.remove('on'); }
$('#pClose').onclick = closePlayer;
$('#pToggle').onclick = () => $('#player').classList.toggle('collapsed');

/* ================= Import ================= */
function detectUI() {
  const r = parseLink($('#addUrl').value), d = $('#detect');
  const ok = r && !r.error;
  $('#addBtn').disabled = !ok; $('#addPlayBtn').disabled = !ok;
  if (!r) { d.textContent = ''; d.className = 'detect'; return null; }
  if (r.error) { d.textContent = '⚠ ' + r.error; d.className = 'detect err'; return null; }
  d.innerHTML = `✓ ${TYPE_FR[r.type] || 'Contenu'} <b>${P[r.provider].name}</b> détecté`; d.className = 'detect ok';
  return r;
}
const resetAdd = () => { $('#addUrl').value = ''; $('#addName').value = ''; detectUI(); };
$('#addUrl').addEventListener('input', detectUI);
$('#addForm').onsubmit = async (e) => { e.preventDefault(); const r = detectUI(); if (!r) return; await addItem(r, $('#addName').value); resetAdd(); location.hash = '#bibliotheque'; };
$('#addPlayBtn').onclick = async () => { const r = detectUI(); if (!r) return; const it = await addItem(r, $('#addName').value); resetAdd(); if (it) play(it); };
$('#quickForm').onsubmit = async (e) => {
  e.preventDefault(); const r = parseLink($('#quickUrl').value);
  if (!r) return;
  if (r.error) { $('#addUrl').value = $('#quickUrl').value; detectUI(); location.hash = '#ajouter'; return; }
  await addItem(r, ''); $('#quickUrl').value = '';
};

/* ================= Navigation ================= */
const VIEWS = ['accueil', 'bibliotheque', 'ajouter', 'premium'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'accueil';
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.v === v));
  document.querySelector('.main').scrollTop = 0;
}
window.addEventListener('hashchange', route);
renderSources(); route();
if (platform === 'web') {
  const a = document.createElement('a');
  a.href = './telecharger.html';
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>Télécharger l\'app';
  document.querySelector('aside .nav').appendChild(a);
}
