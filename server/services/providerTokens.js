const { jwtVerify, createRemoteJWKSet } = require('jose');

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

async function verifyGoogleIdToken(idToken) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID ?? '').trim();
  if (!clientId) throw new Error('MISSING_GOOGLE_CLIENT_ID');
  const t = String(idToken ?? '').trim();
  if (!t) throw new Error('MISSING_TOKEN');
  const { payload } = await jwtVerify(t, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId
  });
  const sub = String(payload?.sub ?? '').trim();
  if (!sub) throw new Error('INVALID_TOKEN');
  return { provider: 'google', providerUserId: sub, email: payload?.email ?? null };
}

async function verifyAppleIdToken(idToken) {
  const clientId = String(process.env.APPLE_CLIENT_ID ?? '').trim();
  if (!clientId) throw new Error('MISSING_APPLE_CLIENT_ID');
  const t = String(idToken ?? '').trim();
  if (!t) throw new Error('MISSING_TOKEN');
  const { payload } = await jwtVerify(t, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience: clientId
  });
  const sub = String(payload?.sub ?? '').trim();
  if (!sub) throw new Error('INVALID_TOKEN');
  return { provider: 'apple', providerUserId: sub, email: payload?.email ?? null };
}

module.exports = { verifyGoogleIdToken, verifyAppleIdToken };

