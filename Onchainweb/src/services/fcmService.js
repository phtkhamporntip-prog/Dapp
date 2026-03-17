/**
 * Firebase Cloud Messaging (FCM) Service
 *
 * Provides:
 *  - requestNotificationPermission() — requests browser permission + returns FCM token
 *  - onForegroundMessage(callback)  — subscribe to foreground push messages
 *  - getFCMToken()                  — get current FCM token without requesting permission
 *
 * Design notes:
 *  - firebase/messaging is imported lazily to keep the initial bundle lean.
 *  - The SW is registered with the env-var–injected copy of firebase-messaging-sw.js.
 *  - VAPID_KEY is the Application Identity public key from Firebase Console → Project Settings
 *    → Cloud Messaging → Web Push certificates.
 */

import { isFirebaseAvailable } from '../lib/firebase.js';
import { logger } from '../utils/logger.js';

// Public VAPID key — safe to expose in client code; this is the WEB PUSH identity
// public key, not a secret. Rotate via Firebase Console if ever compromised.
const VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BI_WvNxp_piXQOCG9etViGRLWY-1Yn5zquDUD9p_xqdFOykzUTSkFUYnsDX6E0X7ftfLvyV3t4uvGzKYBt490p0';

// ─── Lazy singleton ───────────────────────────────────────────────────────
let _messaging = null;

/**
 * Lazily initialise and return the Firebase Messaging instance.
 * Returns null when Messaging is unavailable (no Firebase config, no
 * Notification API, or unsupported browser).
 *
 * @returns {Promise<import('firebase/messaging').Messaging | null>}
 */
async function getMessagingInstance() {
  if (_messaging) return _messaging;
  if (!isFirebaseAvailable || typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  try {
    const { getMessaging } = await import('firebase/messaging');
    const { app } = await import('../lib/firebase.js');
    _messaging = getMessaging(app);
    return _messaging;
  } catch (err) {
    logger.error('[FCM] Failed to initialise messaging:', err);
    return null;
  }
}

// ─── Service Worker registration ──────────────────────────────────────────
/**
 * Register the FCM service worker (built by the Vite plugin) and return the
 * ServiceWorkerRegistration, or null on failure.
 *
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
async function ensureSwRegistered() {
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    return navigator.serviceWorker.ready;
  } catch (err) {
    logger.error('[FCM] SW registration failed:', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Request the user's notification permission and, if granted, obtain an
 * FCM device token.
 *
 * @returns {Promise<{ granted: boolean; token?: string; reason?: string }>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, reason: 'not_supported' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { granted: false, reason: permission }; // 'denied' | 'default'
  }

  const [msg, swReg] = await Promise.all([getMessagingInstance(), ensureSwRegistered()]);

  if (!msg || !swReg) {
    return { granted: false, reason: 'firebase_unavailable' };
  }

  try {
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    logger.log('[FCM] Device token obtained');
    return { granted: true, token };
  } catch (err) {
    logger.error('[FCM] Error obtaining token:', err);
    return { granted: false, reason: 'token_error', error: err };
  }
}

/**
 * Subscribe to foreground push messages (app is open/focused).
 * Background messages are handled by the service worker automatically.
 *
 * @param {(payload: import('firebase/messaging').MessagePayload) => void} callback
 * @returns {Promise<() => void>} Unsubscribe function
 */
export async function onForegroundMessage(callback) {
  const msg = await getMessagingInstance();
  if (!msg) return () => {};

  const { onMessage } = await import('firebase/messaging');
  return onMessage(msg, callback);
}

/**
 * Retrieve the current FCM registration token without prompting the user.
 * Returns null if permission is not granted or FCM is unavailable.
 *
 * @returns {Promise<string | null>}
 */
export async function getFCMToken() {
  if (Notification.permission !== 'granted') return null;

  const [msg, swReg] = await Promise.all([getMessagingInstance(), ensureSwRegistered()]);
  if (!msg || !swReg) return null;

  try {
    const { getToken } = await import('firebase/messaging');
    return await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch {
    return null;
  }
}
