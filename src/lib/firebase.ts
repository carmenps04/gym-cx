// Firebase se carga bajo demanda: si no hay configuración, la app funciona en modo local
// y el SDK ni siquiera se descarga.
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let appP: Promise<FirebaseApp> | null = null;
export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appP) appP = import('firebase/app').then(({ initializeApp }) => initializeApp(config));
  return appP;
}

let authP: Promise<Auth> | null = null;
export function getFirebaseAuth(): Promise<Auth> {
  if (!authP) {
    authP = (async () => {
      const [app, { getAuth }] = await Promise.all([getFirebaseApp(), import('firebase/auth')]);
      return getAuth(app);
    })();
  }
  return authP;
}

let dbP: Promise<Firestore> | null = null;
export function getFirebaseDb(): Promise<Firestore> {
  if (!dbP) {
    dbP = (async () => {
      const [app, fs] = await Promise.all([getFirebaseApp(), import('firebase/firestore')]);
      // Caché persistente (IndexedDB): permite usar la app sin conexión y sincroniza al volver.
      return fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true,
      });
    })();
  }
  return dbP;
}
