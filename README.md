# CareBridge-An-Emergency-Resource-Coordination-Platform
CareBridge is an emergency healthcare coordination platform connecting patients, hospitals, blood banks, oxygen suppliers, ambulance providers, and healthcare professionals. It simplifies resource discovery, emergency requests, referrals, and case tracking through a unified web platform built with React.js and Firebase.

## Browser push notifications

Browser push is opt-in. After signing in, use **Push notification settings** in the header and choose **Enable browser alerts** to grant browser permission and register that device. The device token is stored under the signed-in user's `fcmTokens` subcollection; push preferences are stored separately under `notificationPreferences/settings`. Users can register multiple devices and toggle emergency-status, assignment, and provider-response alerts independently.

To configure a Firebase deployment:

1. Enable Firebase Cloud Messaging and the Firebase Cloud Messaging API in the Google Cloud project, and generate a Web Push certificate key pair in Firebase Console.
2. Set `VITE_FIREBASE_VAPID_KEY` to the public Web Push key alongside the existing `VITE_FIREBASE_*` web app configuration.
3. Use a Firebase plan that supports Cloud Functions deployment (Blaze/billing is required) and deploy with `firebase deploy --only functions,firestore:rules,hosting`.

The Cloud Function uses the Firebase Admin SDK's managed service identity; no FCM server key belongs in frontend configuration. Push delivery is not available until the function is deployed and Web Push is configured. Firestore in-app notifications continue to work independently. FCM delivery is at-least-once: the function records per-event/per-device delivery state and retries transient failures, but a process crash after FCM accepts a message and before its delivery record is committed can result in a duplicate push.
