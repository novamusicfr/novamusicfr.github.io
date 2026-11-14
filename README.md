# 🎧 Nova Music

L'app de musique de Nova : tu importes tes playlists **Spotify, YouTube, Deezer, SoundCloud et Apple Music** et tu les écoutes au même endroit.
Les comptes se créent avec **Google ou e-mail**, la bibliothèque est **synchronisée** entre le PC et le téléphone, et le pass **Nova Premium** supprime les pubs.

| Plateforme | Ce que tu obtiens |
|---|---|
| 💻 Windows | `NovaMusic-Setup-1.0.0.exe` (installeur) |
| 📱 Android | `NovaMusic.apk` |
| 🍎 iPhone | Version web installable (Safari → Partager → « Sur l'écran d'accueil ») |
| 🌐 Web | `https://TON-PSEUDO.github.io/nova-music/` |

Tout se fabrique **automatiquement sur GitHub** : tu n'as rien à installer sur ton PC.

---

## Étape 1 — Créer le projet Firebase (comptes + base de données)

1. Va sur <https://console.firebase.google.com> → **Ajouter un projet** → nom : `nova-music` (Google Analytics : pas besoin).
2. Sur la page d'accueil du projet, clique sur l'icône **`</>` (Web)** → nom : `Nova Music Web` → **Enregistrer**.
3. Firebase t'affiche un bloc `const firebaseConfig = { … }`. Copie les valeurs dans **`firebase-config.js`** à la place des `COLLE_…` / `TON-PROJET`.
4. Menu de gauche → **Authentication** → **Commencer** → onglet **Sign-in method** :
   - active **Adresse e-mail/Mot de passe** ;
   - active **Google** (choisis ton e-mail d'assistance) → **Enregistrer**.
5. **Authentication → Paramètres → Domaines autorisés** → ajoute `TON-PSEUDO.github.io` (pour la version web/iPhone). `localhost` y est déjà : c'est lui qu'utilise l'app PC.
6. Menu de gauche → **Firestore Database** → **Créer une base de données** → région `europe-west` → **mode production**.
7. Onglet **Règles** de Firestore → remplace tout par le contenu de **`firestore.rules`** → **Publier**.

> Le plan gratuit de Firebase (Spark) suffit largement.

## Étape 2 — Mettre le projet sur GitHub

1. Crée un dépôt `nova-music` sur GitHub et envoie-y **tout le dossier**, *sauf* `SECRET-ne-pas-publier/` (le `.gitignore` l'exclut déjà si tu utilises git).
2. Dépôt → **Settings → Pages** → *Source* : **GitHub Actions**.

## Étape 3 — Ajouter l'app Android dans Firebase

1. Firebase → ⚙️ **Paramètres du projet** → **Ajouter une application** → **Android**.
2. Nom du package : **`fr.nova.music`** (exactement).
3. Ajoute les empreintes **SHA-1** et **SHA-256** données dans `SECRET-ne-pas-publier/LIS-MOI.txt`.
4. Télécharge **`google-services.json`** et mets-le dans le dossier **`android-config/`** du dépôt.

> Si tu ajoutes Google ou les empreintes plus tard, retélécharge `google-services.json`.

## Étape 4 — Ajouter la clé de signature Android sur GitHub

Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret** :

- **Nom** : `ANDROID_DEBUG_KEYSTORE`
- **Valeur** : tout le texte du fichier `SECRET-ne-pas-publier/keystore-base64.txt`

Sans cette clé, l'APK se construit quand même, mais la connexion Google ne marchera pas sur téléphone (l'e-mail, si).

## Étape 5 — Récupérer les apps

À chaque `push` sur `main`, GitHub fabrique tout (≈ 5–10 min) :

- **Actions** → dernier build → en bas, **Artifacts** : `NovaMusic-Windows` (le `.exe`) et `NovaMusic-Android` (l'`.apk`).
- La version web est publiée sur `https://TON-PSEUDO.github.io/nova-music/`.

Pour une **page de téléchargement propre**, crée un tag :

```bash
git tag v1.0.0
git push origin v1.0.0
```

→ une **Release** apparaît sur GitHub avec le `.exe` et l'`.apk` à télécharger. Tu peux mettre ce lien sur ton site Nova et ton Discord.

---

## 👑 Donner Nova Premium à quelqu'un

Les codes sont dans Firestore. Personne ne peut se mettre Premium sans un code valide, et chaque code ne marche **qu'une fois** (c'est vérifié par les règles de sécurité).

1. Firebase → **Firestore Database** → **Commencer une collection** → ID : `codes` (la première fois seulement).
2. **Ajouter un document** :
   - **ID du document** = le code, en MAJUSCULES (lettres, chiffres, tirets). Ex. : `NOVA-7K2P-QX94`
   - Champs :
     - `used` (boolean) = `false`
     - `plan` (string) = `mois`, `an` ou `vie`
     - `days` (number) = `30` pour un mois, `365` pour un an — **ne mets pas ce champ** pour un code à vie
3. Envoie le code à la personne (ticket Discord par exemple). Elle l'entre dans **Nova Premium → Tu as un code ?** et les pubs disparaissent sur **tous ses appareils**.

Pour voir qui a utilisé un code : le document affiche `usedBy` (l'ID du compte) et `usedAt`.

> 💳 Pour vendre le Premium directement par carte (Stripe/PayPal) sans passer par des codes, il faudra une Cloud Function Firebase (plan Blaze) qui crée le code automatiquement après paiement. La base est prête pour ça.

---

## ⚙️ Personnaliser

Tout est dans **`firebase-config.js`** → objet `NOVA` :

- `adSeconds` : durée de la pub pour les comptes gratuits
- `discordUrl` : lien de ton Discord (bouton « Choisir une formule »)
- `plans` : noms, prix et avantages affichés

---

## 🛠️ Tester sur ton PC (optionnel)

Il faut [Node.js 22](https://nodejs.org) :

```bash
npm install
npm run dev     # version web sur http://localhost:5173
npm run pc      # l'app PC (Electron)
npm run pc:exe  # fabrique l'installeur .exe dans release/
```

Pour Android en local : installe Android Studio, puis
`npx cap add android`, copie `google-services.json` dans `android/app/`, ajoute `ext { rgcfaIncludeGoogle = true }` à la fin de `android/variables.gradle`, puis `npm run android:sync` et `npm run android:open`.

---

## ❓ Bon à savoir

- **Extraits de 30 s** : sans être connecté à Spotify ou Deezer, leurs lecteurs ne jouent que des extraits. Clique sur « Se connecter » dans le lecteur (sur PC, la fenêtre de connexion s'ouvre dans l'app) pour avoir les titres en entier — la connexion Spotify par e-mail marche, la connexion « via Google » de Spotify non. Sinon, le bouton ↗ ouvre la playlist directement dans Spotify/Deezer. YouTube et SoundCloud jouent toujours en entier.
- **Liens courts** (`spotify.link`, `link.deezer.com`, `on.soundcloud.com`) : ouvre-les une fois et copie l'adresse complète.
- **Windows SmartScreen** affichera « Éditeur inconnu » au premier lancement (l'app n'est pas signée) → *Informations complémentaires* → *Exécuter quand même*. Un certificat de signature de code supprime ce message.
- **Android** : à l'installation de l'APK, autorise « Sources inconnues ». Pour le **Play Store**, il faudra un compte développeur Google (25 $ une fois) et une clé de *release*.
- **iPhone (vraie app App Store)** : impossible sans Mac et compte Apple Developer (99 $/an). En attendant, la version web s'installe comme une app depuis Safari et garde le même compte.
- **Connexion Google sur PC** : l'app ouvre ton navigateur, tu choisis ton compte, puis tu reviens dans l'app — c'est normal, Google interdit la connexion directement dans les fenêtres d'apps.

## 📁 Structure

```
index.html              ← l'interface
desktop-login.html      ← page de connexion Google pour l'app PC
firebase-config.js      ← TA config Firebase + réglages Nova
firestore.rules         ← règles de sécurité (à coller dans Firebase)
src/                    ← code de l'app (comptes, bibliothèque, lecteur, Premium)
electron/               ← app PC
capacitor.config.json   ← app Android
android-config/         ← mets google-services.json ici
.github/workflows/      ← fabrication automatique .exe / .apk / web
SECRET-ne-pas-publier/  ← clé de signature Android (à garder pour toi)
```
