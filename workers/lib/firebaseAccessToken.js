/**
 * Firebase Service Account OAuth helper for Cloudflare Workers.
 *
 * Uses FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (wrangler secrets)
 * to obtain short-lived Google OAuth access tokens for Firestore REST APIs.
 */

/** @type {string | null} */
let cachedToken = null;
let cachedTokenExpiresAt = 0;

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

/**
 * @param {string | Uint8Array} input
 * @returns {string}
 */
function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * @param {string} pem
 * @returns {ArrayBuffer}
 */
function pemToArrayBuffer(pem) {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * @param {string} assertionInput
 * @param {string} privateKeyPem
 * @returns {Promise<string>}
 */
async function signJwt(assertionInput, privateKeyPem) {
  const pkcs8 = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(assertionInput)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Get a valid Google OAuth access token for Firestore REST requests.
 *
 * @param {{ FIREBASE_CLIENT_EMAIL?: string, FIREBASE_PRIVATE_KEY?: string }} env Cloudflare worker env
 * @returns {Promise<string>} bearer token
 */
export async function getFirebaseAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  // Reuse token while valid (with 60s safety margin)
  if (cachedToken && cachedTokenExpiresAt - 60 > now) {
    return cachedToken;
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY secret');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: FIRESTORE_SCOPE,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signJwt(signingInput, privateKey);

  const assertion = `${signingInput}.${signature}`;

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to obtain Firebase access token: ${response.status} ${body}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Number(data.expires_in || 3600);

  if (!cachedToken) {
    throw new Error('OAuth response did not include access_token');
  }

  return cachedToken;
}
