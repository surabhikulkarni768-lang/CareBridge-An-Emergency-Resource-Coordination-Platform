import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe
} from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, auth, db, isFirebaseConfigured } from '../config/firebase';

export interface PushNotificationPreferences {
  pushEnabled: boolean;
  emergencyStatus: boolean;
  requestAssignments: boolean;
  providerResponses: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
  pushEnabled: false,
  emergencyStatus: true,
  requestAssignments: true,
  providerResponses: true
};

const getVapidKey = (): string =>
  typeof import.meta !== 'undefined' ? import.meta.env.VITE_FIREBASE_VAPID_KEY || '' : '';

const assertCurrentUser = (uid: string): void => {
  if (!isFirebaseConfigured || !db || !auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Sign in to this account before changing push notification settings.');
  }
};

const getMessagingInstance = async () => {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Browser push notifications are not supported in this browser.');
  }
  if (!(await isSupported())) {
    throw new Error('This browser does not support Firebase Cloud Messaging.');
  }
  if (!getVapidKey()) {
    throw new Error('Push notifications require VITE_FIREBASE_VAPID_KEY to be configured.');
  }
  return getMessaging(app);
};

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const saveDeviceToken = async (uid: string, token: string): Promise<void> => {
  if (!db) throw new Error('Firestore is not configured.');
  const tokenId = await hashToken(token);
  const tokenRef = doc(db, 'users', uid, 'fcmTokens', tokenId);
  const existing = await getDoc(tokenRef);
  await setDoc(tokenRef, {
    uid,
    token,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

const savePreferences = async (
  uid: string,
  preferences: PushNotificationPreferences
): Promise<void> => {
  if (!db) throw new Error('Firestore is not configured.');
  await setDoc(doc(db, 'users', uid, 'notificationPreferences', 'settings'), {
    ...preferences,
    updatedAt: serverTimestamp()
  });
};

export async function enablePushNotificationsAfterConsent(
  uid: string
): Promise<PushNotificationPreferences> {
  assertCurrentUser(uid);
  const messaging = await getMessagingInstance();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Browser notification permission is blocked. Allow notifications in browser settings to enable push.'
      : 'Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey: getVapidKey(),
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('Firebase did not issue a device token for this browser.');

  await saveDeviceToken(uid, token);
  const preferences = { ...DEFAULT_PUSH_PREFERENCES, pushEnabled: true };
  await savePreferences(uid, preferences);
  return preferences;
}

export async function disablePushNotifications(uid: string): Promise<void> {
  assertCurrentUser(uid);
  await savePreferences(uid, { ...DEFAULT_PUSH_PREFERENCES, pushEnabled: false });
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' &&
    getVapidKey() && await isSupported()) {
    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: getVapidKey(),
      ...(registration ? { serviceWorkerRegistration: registration } : {})
    });
    if (token && db) {
      const tokenId = await hashToken(token);
      await deleteDoc(doc(db, 'users', uid, 'fcmTokens', tokenId));
    }
    await deleteToken(messaging);
  }
}

export async function updatePushNotificationPreferences(
  uid: string,
  preferences: PushNotificationPreferences
): Promise<void> {
  assertCurrentUser(uid);
  await savePreferences(uid, preferences);
}

export function subscribeToPushNotificationPreferences(
  uid: string,
  onUpdate: (preferences: PushNotificationPreferences) => void,
  onError: (message: string) => void
): Unsubscribe {
  assertCurrentUser(uid);
  if (!db) {
    onError('Firestore is not configured.');
    return () => undefined;
  }
  return onSnapshot(
    doc(db, 'users', uid, 'notificationPreferences', 'settings'),
    (snapshot) => {
      const data = snapshot.data();
      onUpdate(data ? {
        pushEnabled: data.pushEnabled === true,
        emergencyStatus: data.emergencyStatus !== false,
        requestAssignments: data.requestAssignments !== false,
        providerResponses: data.providerResponses !== false
      } : DEFAULT_PUSH_PREFERENCES);
    },
    (error) => onError(`Could not load push notification preferences: ${error.message}`)
  );
}
