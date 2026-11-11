import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase Client Configuration for CareBridge
 * Environment variables are loaded via Vite's import.meta.env (prefixed with VITE_)
 */
const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

/**
 * Indicates whether live Firebase credentials have been configured in .env
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !String(firebaseConfig.apiKey).includes('your_api_key')
);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  if (isFirebaseConfigured) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log(`[CareBridge Firebase] Initialized successfully with project ID: ${firebaseConfig.projectId}`);
  } else {
    // Fallback initialization to allow development/review without unhandled runtime exceptions
    const fallbackConfig = {
      apiKey: 'AIzaSyFakeKeyForDevelopmentOnly12345',
      authDomain: 'carebridge-demo.firebaseapp.com',
      projectId: 'carebridge-demo',
      storageBucket: 'carebridge-demo.appspot.com',
      messagingSenderId: '123456789012',
      appId: '1:123456789012:web:abcdef1234567890abcdef'
    };
    app = getApps().length === 0 ? initializeApp(fallbackConfig) : getApp();
    console.warn(
      '[CareBridge Firebase] Running in placeholder mode. Set your VITE_FIREBASE_* credentials in .env to connect to your live Firebase project (see .env.example).'
    );
  }

  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('[CareBridge Firebase] Initialization error:', error);
  throw error;
}

export { app, auth, db };
export default app;

