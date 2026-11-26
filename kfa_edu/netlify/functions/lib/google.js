/* رمز وصول Google من حساب خدمة Firebase الخاص بموقع kfa_edu (KFA_FIREBASE_SERVICE_ACCOUNT).
   بلا firebase-admin: توقيع JWT عبر node:crypto يكفي ويُسرّع الإقلاع. */
'use strict';
const crypto = require('crypto');
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function serviceAccount() {
  const raw = process.env.KFA_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('KFA_FIREBASE_SERVICE_ACCOUNT غير مضبوط');
  const sa = JSON.parse(raw);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

const CACHED = new Map();
async function accessToken(scope) {
  const now = Math.floor(Date.now() / 1000);
  const c = CACHED.get(scope);
  if (c && c.exp - 60 > now) return c.token;
  const sa = serviceAccount();
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(header + '.' + claim), sa.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${sig}` })
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error('تعذّر الحصول على رمز وصول');
  CACHED.set(scope, { token: j.access_token, exp: now + (j.expires_in || 3600) });
  return j.access_token;
}

const projectId = () => process.env.KFA_FIREBASE_PROJECT || serviceAccount().project_id;
module.exports = { serviceAccount, accessToken, projectId };
