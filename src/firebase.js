import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { firebaseConfig } from '../firebase-config.js';

export const isConfigured = !String(firebaseConfig.apiKey).startsWith('COLLE');

export const app = initializeApp(firebaseConfig);

// Dans l'app Android, getAuth() peut bloquer : on force la persistance IndexedDB.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

export const db = getFirestore(app);

/** 'desktop' (Electron), 'android' (Capacitor) ou 'web' (navigateur / iPhone) */
export const platform = window.novaDesktop
  ? 'desktop'
  : Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
