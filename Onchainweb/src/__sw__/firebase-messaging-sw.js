/**
 * Firebase Cloud Messaging Service Worker
 *
 * This file is a BUILD-TIME TEMPLATE. The Vite plugin in vite.config.js
 * processes it during build, replacing __VITE_*__ placeholders with real
 * environment variable values. Do NOT edit the generated dist/ copy.
 *
 * Handles background push notifications when the app is not in focus.
 * Uses Firebase compat SDK (required for importScripts / service worker context).
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

// ─── Firebase config injected at build time ───────────────────────────────
firebase.initializeApp({
  apiKey:            '__VITE_FIREBASE_API_KEY__',
  authDomain:        '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId:         '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket:     '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId:             '__VITE_FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

// ─── Background message handler ──────────────────────────────────────────
// Fires when a push arrives while the app is backgrounded or closed.
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title   = notification.title || 'OnchainWeb';
  const options = {
    body:             notification.body   || '',
    icon:             notification.icon   || '/logo.png',
    badge:            '/logo.png',
    image:            notification.image  || undefined,
    tag:              payload.data?.tag   || 'onchainweb-fcm',
    data:             payload.data        || {},
    requireInteraction: false,
    vibrate:          [200, 100, 200],
  };
  self.registration.showNotification(title, options);
});

// ─── Notification click handler ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window/tab if possible
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow(url);
      })
  );
});
