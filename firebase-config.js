// =====================================================================
//  CONFIG FIREBASE — à remplir (voir README, étape 1)
//  Console Firebase → ⚙️ Paramètres du projet → Vos applications → </> Web
//  Copie l'objet firebaseConfig ici. Ces valeurs ne sont pas secrètes :
//  la sécurité vient des règles Firestore (firestore.rules).
// =====================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBcYfU2VvSkDTnUqJG0cRd1lSuEazj1Q1M",
  authDomain: "nova-music-5ad14.firebaseapp.com",
  projectId: "nova-music-5ad14",
  storageBucket: "nova-music-5ad14.firebasestorage.app",
  messagingSenderId: "17213348655",
  appId: "1:17213348655:web:2e57f7cfa7cd0b85e41fda"
};

// =====================================================================
//  RÉGLAGES NOVA MUSIC
// =====================================================================
export const NOVA = {
  adSeconds: 5,                                   // durée de la pub (compte gratuit)
  discordUrl: "https://discord.gg/TON-INVITE",    // où les gens obtiennent un code Premium
  plans: [
    { id: "mois", name: "Mensuel", price: "4,99 €",  per: "/mois",    perks: ["Zéro pub", "Lecture immédiate", "Badge doré"] },
    { id: "an",   name: "Annuel",  price: "39,99 €", per: "/an",      perks: ["Tout le Mensuel", "2 mois offerts", "Accès anticipé"], best: true },
    { id: "vie",  name: "À vie",   price: "79,99 €", per: "une fois", perks: ["Tout l'Annuel", "Paiement unique", "Rôle Discord exclusif"] }
  ]
};
